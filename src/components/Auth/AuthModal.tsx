import React, { useState } from 'react';
import {
  User,
  Lock,
  ArrowRight,
  ShieldCheck,
  Mail,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Smartphone,
  Monitor,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register, recoverPassword, pendingDeviceLimit, dismissDeviceLimit } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'recover'>('login');
  const [name, setName] = useState('');
  const [grNumber, setGrNumber] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryPin, setRecoveryPin] = useState('');
  const [recoveryPinOrEmail, setRecoveryPinOrEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (authMode === 'register') {
        const res = await register(name, grNumber, password, email, recoveryPin);
        if (!res.success) {
          setError(res.error || 'Registration failed');
          setLoading(false);
          return;
        }
        onClose();
      } else if (authMode === 'login') {
        const res = await login(grNumber, password);
        if (res.deviceLimitReached) {
          setLoading(false);
          return;
        }
        if (!res.success) {
          setError(res.error || 'Login failed');
          setLoading(false);
          return;
        }
        onClose();
      } else if (authMode === 'recover') {
        const res = await recoverPassword(grNumber, recoveryPinOrEmail, newPassword);
        if (!res.success) {
          setError(res.error || 'Password recovery failed');
          setLoading(false);
          return;
        }
        setSuccessMsg('Password updated! Signing in...');
        setTimeout(async () => {
          const loginRes = await login(grNumber, newPassword);
          if (loginRes.success) {
            onClose();
          } else {
            setAuthMode('login');
            setPassword(newPassword);
            setLoading(false);
          }
        }, 800);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error');
      setLoading(false);
    }
  };

  const handleRevokeDeviceAndLogin = async (deviceId: string) => {
    if (!pendingDeviceLimit) return;
    setLoading(true);
    const res = await login(pendingDeviceLimit.grNumber, pendingDeviceLimit.pass, deviceId);
    setLoading(false);
    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Failed to revoke device');
    }
  };

  return (
    <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="card w-full max-w-sm bg-surface p-6 shadow-2xl animate-in zoom-in-95 border-border">
        {/* DEVICE LIMIT WORKFLOW (Max 3 Devices) */}
        {pendingDeviceLimit ? (
          <div>
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="font-display text-base font-bold text-primary">
                Active Devices Limit (3) Reached
              </h3>
              <p className="text-xs text-muted mt-1">
                Select one of your existing devices to revoke and proceed with this sign-in:
              </p>
            </div>

            <div className="space-y-2 mb-4">
              {pendingDeviceLimit.devices.map(dev => (
                <div
                  key={dev.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-surface-hover/40 text-xs"
                >
                  <div className="flex items-center gap-2">
                    {dev.deviceType === 'mobile' ? (
                      <Smartphone className="w-4 h-4 text-muted shrink-0" />
                    ) : (
                      <Monitor className="w-4 h-4 text-muted shrink-0" />
                    )}
                    <div>
                      <div className="font-medium text-primary">{dev.deviceName}</div>
                      <div className="text-[10px] font-mono text-muted">
                        Active {new Date(dev.lastActive).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleRevokeDeviceAndLogin(dev.id)}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 font-mono text-[11px] font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Revoke & Sign In
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={dismissDeviceLimit}
              className="w-full py-2 rounded-xl text-xs font-mono text-muted hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center font-display font-bold text-xl shadow-lg mb-3">
                W
              </div>
              <h3 className="font-display text-lg font-bold text-primary">
                {authMode === 'register' && 'Create Student Account'}
                {authMode === 'login' && 'Sign in to WorkSpace'}
                {authMode === 'recover' && 'Recover Your Password'}
              </h3>
              <p className="text-xs text-muted mt-1">
                {authMode === 'recover'
                  ? 'Enter your GR Number & 4-digit PIN or Recovery Email'
                  : 'Academic Suite & Attendance Tracker'}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {authMode === 'register' && (
                <div>
                  <label className="block text-[11px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Rishav Kumar"
                      className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-brand font-medium"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                  GR Number (Unique ID)
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={grNumber}
                    onChange={e => setGrNumber(e.target.value)}
                    placeholder="e.g. 118748"
                    className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-brand font-mono font-bold"
                  />
                </div>
              </div>

              {authMode !== 'recover' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-mono font-bold text-muted uppercase tracking-wider">
                      Password
                    </label>
                    {authMode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('recover');
                          setError(null);
                        }}
                        className="text-[11px] text-brand hover:underline font-mono"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </div>
              )}

              {authMode === 'register' && (
                <>
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                      Recovery PIN (4-6 Digits)
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        maxLength={6}
                        value={recoveryPin}
                        onChange={e => setRecoveryPin(e.target.value)}
                        placeholder="e.g. 1234"
                        className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-brand font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                      Recovery Email (Optional)
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="student@example.com"
                        className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>
                  </div>
                </>
              )}

              {authMode === 'recover' && (
                <>
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                      Recovery PIN or Registered Email
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={recoveryPinOrEmail}
                        onChange={e => setRecoveryPinOrEmail(e.target.value)}
                        placeholder="e.g. 2026 or email"
                        className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono font-bold text-muted uppercase tracking-wider mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 mt-4 shadow-sm"
              >
                {loading ? (
                  <span className="animate-pulse">Authenticating...</span>
                ) : (
                  <>
                    <span>
                      {authMode === 'register' && 'Register Account'}
                      {authMode === 'login' && 'Sign In'}
                      {authMode === 'recover' && 'Reset & Sign In'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2">
              {authMode === 'login' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setError(null);
                    }}
                    className="text-xs text-center text-muted hover:text-primary transition-colors"
                  >
                    New student? <span className="text-brand font-semibold">Create an account</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setError(null);
                  }}
                  className="text-xs text-center text-muted hover:text-primary transition-colors"
                >
                  Already have an account? <span className="text-brand font-semibold">Sign In</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="text-xs text-center text-muted/80 hover:text-muted mt-1"
              >
                Continue Browsing Offline
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
