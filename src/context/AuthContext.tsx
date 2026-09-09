import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, DeviceSession } from '../types';
import { authRepository } from '../lib/repository/authRepository';
import { profileRepository } from '../lib/repository/profileRepository';
import { adminRepository } from '../lib/repository/adminRepository';
import { deviceRepository } from '../lib/repository/deviceRepository';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  activeDevices: DeviceSession[];
  pendingDeviceLimit: { grNumber: string; pass: string; devices: DeviceSession[] } | null;
  dismissDeviceLimit: () => void;
  login: (grNumber: string, password: string, deviceToRevokeId?: string) => Promise<{ success: boolean; error?: string; deviceLimitReached?: boolean }>;
  register: (name: string, grNumber: string, password: string, email?: string, recoveryPin?: string) => Promise<{ success: boolean; error?: string }>;
  recoverPassword: (grNumber: string, pinOrEmail: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  changeGrNumber: (newGr: string) => Promise<{ success: boolean; error?: string }>;
  removeDevice: (deviceId: string) => void;
  signOutOtherDevices: () => void;
  requestAccountDeletion: () => void;
  cancelAccountDeletion: () => void;
  adminResetPassword: (targetGr: string, newPass: string) => Promise<boolean>;
  exportDataJSON: () => Promise<string>;
  exportDataCSV: () => Promise<{ attendanceCSV: string; tasksCSV: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeDevices, setActiveDevices] = useState<DeviceSession[]>([]);
  const [pendingDeviceLimit, setPendingDeviceLimit] = useState<{
    grNumber: string;
    pass: string;
    devices: DeviceSession[];
  } | null>(null);

  // Initialize session on mount
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        const { user: initialUser, devices } = await authRepository.getInitialSession();
        if (isMounted) {
          if (initialUser) {
            // Check soft deletion expiration (> 7 days)
            if (initialUser.scheduledDeletionAt) {
              const scheduledTime = new Date(initialUser.scheduledDeletionAt).getTime();
              const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
              if (Date.now() - scheduledTime > sevenDaysMs) {
                // Expired: log out
                await authRepository.logout();
                setUser(null);
                setActiveDevices([]);
                setLoading(false);
                return;
              }
            }
            setUser(initialUser);
            setActiveDevices(devices);
          } else {
            setUser(null);
            setActiveDevices([]);
          }
        }
      } catch (err) {
        console.warn('Error loading auth session:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initSession();

    // Listen to Supabase auth state changes if configured
    let authListener: any = null;
    if (isSupabaseConfigured && supabase) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          if (isMounted) {
            setUser(null);
            setActiveDevices([]);
          }
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session.user) {
            const { user: refreshedUser, devices } = await authRepository.getInitialSession();
            if (isMounted && refreshedUser) {
              setUser(refreshedUser);
              setActiveDevices(devices);
            }
          }
        }
      });
      authListener = data.subscription;
    }

    return () => {
      isMounted = false;
      if (authListener) authListener.unsubscribe();
    };
  }, []);

  const login = async (
    grNumber: string,
    password: string,
    deviceToRevokeId?: string
  ): Promise<{ success: boolean; error?: string; deviceLimitReached?: boolean }> => {
    const res = await authRepository.login(grNumber, password, deviceToRevokeId);

    if (res.deviceLimitReached && res.activeDevices) {
      setPendingDeviceLimit({
        grNumber,
        pass: password,
        devices: res.activeDevices
      });
      return { success: false, deviceLimitReached: true, error: res.error };
    }

    if (res.success && res.user) {
      setPendingDeviceLimit(null);
      setUser(res.user);
      setActiveDevices(res.activeDevices || []);
      return { success: true };
    }

    return { success: false, error: res.error || 'Login failed' };
  };

  const dismissDeviceLimit = () => {
    setPendingDeviceLimit(null);
  };

  const register = async (
    name: string,
    grNumber: string,
    password: string,
    email?: string,
    recoveryPin?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await authRepository.register(name, grNumber, password, email, recoveryPin);
    if (res.success && res.user) {
      setUser(res.user);
      return { success: true };
    }
    return { success: false, error: res.error || 'Registration failed' };
  };

  const recoverPassword = async (
    grNumber: string,
    pinOrEmail: string,
    newPass: string
  ): Promise<{ success: boolean; error?: string }> => {
    return await authRepository.recoverPassword(grNumber, pinOrEmail, newPass);
  };

  const logout = async () => {
    await authRepository.logout();
    setUser(null);
    setActiveDevices([]);
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };
    const updated = await profileRepository.updateProfile(user.id, updates);
    if (updated) {
      setUser(updated);
      return { success: true };
    }
    return { success: false, error: 'Failed to update profile' };
  };

  const changeGrNumber = async (newGr: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };
    const res = await profileRepository.changeGrNumber(user.id, newGr);
    if (res.success) {
      setUser(prev => prev ? { ...prev, grNumber: newGr.trim() } : null);
    }
    return res;
  };

  const removeDevice = async (deviceId: string) => {
    if (!user) return;
    await deviceRepository.removeDevice(user.id, deviceId);
    setActiveDevices(prev => prev.filter(d => d.id !== deviceId));
  };

  const signOutOtherDevices = async () => {
    if (!user) return;
    await deviceRepository.signOutOtherDevices(user.id);
    setActiveDevices(prev => prev.filter(d => d.isCurrent));
  };

  const requestAccountDeletion = async () => {
    if (!user) return;
    await profileRepository.requestAccountDeletion(user.id);
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    setUser(prev => prev ? { ...prev, scheduledDeletionAt: sevenDaysLater } : null);
  };

  const cancelAccountDeletion = async () => {
    if (!user) return;
    await profileRepository.cancelAccountDeletion(user.id);
    setUser(prev => prev ? { ...prev, scheduledDeletionAt: null } : null);
  };

  const adminResetPassword = async (targetGr: string, newPass: string): Promise<boolean> => {
    if (!user || user.role !== 'admin') return false;
    return await adminRepository.adminResetPassword(user.grNumber, targetGr, newPass);
  };

  const exportDataJSON = async (): Promise<string> => {
    if (!user) return '{}';
    return await profileRepository.exportUserDataJSON(user.id);
  };

  const exportDataCSV = async (): Promise<{ attendanceCSV: string; tasksCSV: string }> => {
    if (!user) return { attendanceCSV: '', tasksCSV: '' };
    return await profileRepository.exportUserDataCSV(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        // Critical: Role-based admin check strictly enforced; GR alone never grants privileges
        isAdmin: user?.role === 'admin',
        activeDevices,
        pendingDeviceLimit,
        dismissDeviceLimit,
        login,
        register,
        recoverPassword,
        logout,
        updateProfile,
        changeGrNumber,
        removeDevice,
        signOutOtherDevices,
        requestAccountDeletion,
        cancelAccountDeletion,
        adminResetPassword,
        exportDataJSON,
        exportDataCSV
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
