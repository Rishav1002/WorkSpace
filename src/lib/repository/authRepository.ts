import { supabase, isSupabaseConfigured } from '../supabase';
import { offlineDB } from '../offline/db';
import { UserProfile, DeviceSession, Role } from '../../types';
import { syncRepository } from './syncRepository';

export interface AuthResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
  deviceLimitReached?: boolean;
  activeDevices?: DeviceSession[];
}

export class AuthRepository {
  /**
   * Deterministic internal identity used to bridge Supabase Auth without exposing email in UI
   */
  getInternalIdentity(grNumber: string): string {
    const cleanGr = grNumber.trim().toLowerCase();
    return `gr_${cleanGr}@workspace.internal`;
  }

  private async hashPin(pin: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(`workspace_recovery_salt_${pin}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Check if current session exists in Supabase Auth or cached offline profile
   */
  async getInitialSession(): Promise<{ user: UserProfile | null; devices: DeviceSession[] }> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          // If online and no session, a fresh browser starts strictly logged out
          if (navigator.onLine) {
            await offlineDB.profiles.clear();
            await offlineDB.deviceSessions.clear();
            return { user: null, devices: [] };
          }
        } else {
          // Fetch user profile from Supabase
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            const mappedUser: UserProfile = this.mapProfileRowToModel(profile);
            // Cache to IndexedDB
            await offlineDB.profiles.put(mappedUser);

            // Fetch device sessions
            const { data: deviceRows } = await supabase
              .from('device_sessions')
              .select('*')
              .eq('user_id', mappedUser.id);

            const devices: DeviceSession[] = (deviceRows || []).map(r => ({
              id: r.id,
              userId: r.user_id,
              deviceName: r.device_name,
              deviceType: r.device_type,
              lastActive: r.last_active,
              isCurrent: r.is_current
            }));

            // Sync offline devices
            await offlineDB.deviceSessions.bulkPut(devices);

            return { user: mappedUser, devices };
          }
        }
      } catch (err) {
        console.warn('Network error checking Supabase session, checking offline cache:', err);
      }
    }

    // Fallback to IndexedDB offline cache only if strictly offline
    if (!navigator.onLine) {
      const cachedProfiles = await offlineDB.profiles.toArray();
      const currentUser = cachedProfiles.length > 0 ? cachedProfiles[0] : null;
      let cachedDevices: DeviceSession[] = [];
      if (currentUser) {
        cachedDevices = await offlineDB.deviceSessions.where('userId').equals(currentUser.id).toArray();
      }
      return { user: currentUser, devices: cachedDevices };
    }

    return { user: null, devices: [] };
  }

  async login(grNumber: string, password: string, deviceToRevokeId?: string): Promise<AuthResult> {
    const cleanGr = grNumber.trim();
    if (!cleanGr) return { success: false, error: 'GR Number is required' };
    if (!password) return { success: false, error: 'Password is required' };

    const internalEmail = this.getInternalIdentity(cleanGr);

    if (isSupabaseConfigured && supabase) {
      try {
        // Authenticate with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: internalEmail,
          password
        });

        if (authError || !authData.user) {
          return { success: false, error: authError?.message || 'Invalid GR Number or Password' };
        }

        const userId = authData.user.id;

        // Fetch User Profile
        let { data: profileRow } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (!profileRow) {
          // Create profile record if trigger didn't catch it
          const newProfile: UserProfile = {
            id: userId,
            grNumber: cleanGr,
            displayName: authData.user.user_metadata?.display_name || `Student ${cleanGr}`,
            email: authData.user.email,
            emailVerified: authData.user.user_metadata?.email_verified || false,
            role: (authData.user.app_metadata?.role || authData.user.user_metadata?.role || 'student') as Role,
            program: 'MCA',
            group: 'MCA DS 1A',
            semester: 1,
            section: '1A',
            hostel: 'Einstein Hall (Boys)',
            attendanceTarget: 75,
            classStartDate: '2026-07-29',
            activeTermId: 'term-sem-1-2026',
            scheduledDeletionAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await supabase.from('user_profiles').insert(this.mapModelToProfileRow(newProfile));
          profileRow = this.mapModelToProfileRow(newProfile);
        }

        const user = this.mapProfileRowToModel(profileRow);

        // Cancel scheduled account deletion if returning within 7-day grace period
        if (user.scheduledDeletionAt) {
          user.scheduledDeletionAt = null;
          await supabase.from('user_profiles').update({ scheduled_deletion_at: null }).eq('id', userId);
        }

        // Active devices check (Max 3)
        const { data: deviceRows } = await supabase
          .from('device_sessions')
          .select('*')
          .eq('user_id', userId);

        let devices: DeviceSession[] = (deviceRows || []).map(r => ({
          id: r.id,
          userId: r.user_id,
          deviceName: r.device_name,
          deviceType: r.device_type,
          lastActive: r.last_active,
          isCurrent: r.is_current
        }));

        if (deviceToRevokeId) {
          await supabase.from('device_sessions').delete().eq('id', deviceToRevokeId);
          devices = devices.filter(d => d.id !== deviceToRevokeId);
        }

        const currentDeviceName = navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Browser';
        const currentDeviceId = `dev-${Date.now()}`;

        if (devices.length >= 3) {
          return {
            success: false,
            deviceLimitReached: true,
            activeDevices: devices,
            error: 'Maximum active devices limit (3) reached. Please select a device to revoke.'
          };
        }

        // Register current device session
        const newDevice: DeviceSession = {
          id: currentDeviceId,
          userId,
          deviceName: `${currentDeviceName} (${new Date().toLocaleDateString()})`,
          deviceType: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
          lastActive: new Date().toISOString(),
          isCurrent: true
        };

        await supabase.from('device_sessions').insert({
          id: newDevice.id,
          user_id: newDevice.userId,
          device_name: newDevice.deviceName,
          device_type: newDevice.deviceType,
          last_active: newDevice.lastActive,
          is_current: true
        });

        devices.push(newDevice);

        // Cache user and devices in IndexedDB
        await offlineDB.profiles.clear();
        await offlineDB.profiles.put(user);
        await offlineDB.deviceSessions.clear();
        await offlineDB.deviceSessions.bulkPut(devices);

        return { success: true, user, activeDevices: devices };
      } catch (err: any) {
        return { success: false, error: err.message || 'Login network error' };
      }
    } else {
      // Offline fallback
      const cached = await offlineDB.profiles.where('grNumber').equals(cleanGr).first();
      if (cached) {
        return { success: true, user: cached };
      }
      return { success: false, error: 'Supabase credentials not configured in environment.' };
    }
  }

  async register(
    name: string,
    grNumber: string,
    password: string,
    email?: string,
    recoveryPin?: string
  ): Promise<AuthResult> {
    const cleanGr = grNumber.trim();
    const cleanName = name.trim();
    if (!cleanName) return { success: false, error: 'Name is required' };
    if (!cleanGr) return { success: false, error: 'GR Number is required' };
    if (!password || password.length < 6) return { success: false, error: 'Password must be at least 6 characters' };

    const internalEmail = this.getInternalIdentity(cleanGr);

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: internalEmail,
          password,
          options: {
            data: {
              gr_number: cleanGr,
              display_name: cleanName,
              recovery_email: email ? email.trim() : null
            }
          }
        });

        if (authError || !authData.user) {
          if (authError?.message.includes('already registered')) {
            return { success: false, error: `An account for GR Number ${cleanGr} already exists.` };
          }
          return { success: false, error: authError?.message || 'Registration failed' };
        }

        const userId = authData.user.id;
        const assignedRole: Role = (authData.user.app_metadata?.role || authData.user.user_metadata?.role || 'student') as Role;

        let recoveryPinHash: string | undefined = undefined;
        if (recoveryPin && recoveryPin.trim()) {
          recoveryPinHash = await this.hashPin(recoveryPin.trim());
        }

        const newUser: UserProfile = {
          id: userId,
          grNumber: cleanGr,
          displayName: cleanName,
          email: email ? email.trim() : undefined,
          emailVerified: false,
          role: assignedRole,
          program: 'MCA',
          group: 'MCA DS 1A',
          semester: 1,
          section: '1A',
          hostel: 'Einstein Hall (Boys)',
          attendanceTarget: 75,
          classStartDate: '2026-07-29',
          activeTermId: 'term-sem-1-2026',
          recoveryConfigured: !!recoveryPinHash,
          recoveryPinHash,
          scheduledDeletionAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Persist profile row
        await supabase.from('user_profiles').upsert(this.mapModelToProfileRow(newUser));

        // Cache in IndexedDB
        await offlineDB.profiles.clear();
        await offlineDB.profiles.put(newUser);

        return { success: true, user: newUser };
      } catch (err: any) {
        return { success: false, error: err.message || 'Registration error' };
      }
    } else {
      return { success: false, error: 'Supabase backend is not configured in .env' };
    }
  }

  async logout(): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    await offlineDB.profiles.clear();
    await offlineDB.deviceSessions.clear();
  }

  async recoverPassword(
    grNumber: string,
    pinOrEmail: string,
    newPass: string
  ): Promise<{ success: boolean; error?: string }> {
    const cleanGr = grNumber.trim();
    const cleanInput = pinOrEmail.trim().toLowerCase();

    if (!cleanGr) return { success: false, error: 'GR number is required' };
    if (!cleanInput) return { success: false, error: 'PIN or Email is required' };
    if (!newPass || newPass.length < 6) return { success: false, error: 'New password must be at least 6 characters' };

    if (isSupabaseConfigured && supabase) {
      try {
        // If email was given, request Supabase password reset email
        if (cleanInput.includes('@')) {
          const { error } = await supabase.auth.resetPasswordForEmail(cleanInput, {
            redirectTo: window.location.origin
          });
          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        // Verify recovery PIN via secure hash lookup
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, recovery_pin_hash')
          .eq('gr_number', cleanGr)
          .single();

        if (!profile) {
          return { success: false, error: `Account with GR ${cleanGr} not found` };
        }

        const inputPinHash = await this.hashPin(cleanInput);
        if (profile.recovery_pin_hash !== inputPinHash) {
          return { success: false, error: 'Invalid recovery PIN' };
        }

        // Update password with authenticated session
        const { error: resetError } = await supabase.auth.updateUser({ password: newPass });
        if (resetError) {
          return { success: false, error: resetError.message };
        }

        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'Password recovery error' };
      }
    }

    return { success: false, error: 'Supabase is not configured' };
  }

  private mapProfileRowToModel(row: any): UserProfile {
    return {
      id: row.id,
      grNumber: row.gr_number,
      displayName: row.display_name,
      email: row.email,
      emailVerified: row.email_verified,
      avatarUrl: row.avatar_url,
      phone: row.phone,
      role: row.role as any,
      program: row.program || 'MCA',
      group: row.group || 'MCA DS 1A',
      semester: row.semester || 1,
      section: row.section || '1A',
      hostel: row.hostel,
      hostelRoom: row.hostel_room,
      attendanceTarget: row.attendance_target || 75,
      classStartDate: row.class_start_date || '2026-07-29',
      activeTermId: row.active_term_id || 'term-sem-1-2026',
      recoveryConfigured: !!row.recovery_pin_hash,
      recoveryPinHash: row.recovery_pin_hash,
      scheduledDeletionAt: row.scheduled_deletion_at,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString()
    };
  }

  private mapModelToProfileRow(user: UserProfile): any {
    return {
      id: user.id,
      gr_number: user.grNumber,
      display_name: user.displayName,
      email: user.email,
      email_verified: user.emailVerified,
      avatar_url: user.avatarUrl,
      phone: user.phone,
      role: user.role,
      program: user.program,
      group: user.group,
      semester: user.semester,
      section: user.section,
      hostel: user.hostel,
      hostel_room: user.hostelRoom,
      attendance_target: user.attendanceTarget,
      class_start_date: user.classStartDate,
      active_term_id: user.activeTermId,
      recovery_configured: user.recoveryConfigured ?? false,
      recovery_pin_hash: user.recoveryPinHash,
      scheduled_deletion_at: user.scheduledDeletionAt,
      updated_at: new Date().toISOString()
    };
  }
}

export const authRepository = new AuthRepository();
