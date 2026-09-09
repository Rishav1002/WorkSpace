import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  History,
  Users,
  Calendar,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Key,
  Database,
  Clock,
  Sparkles,
  Search,
  Play
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { adminRepository } from '../../lib/repository/adminRepository';
import { UserProfile } from '../../types';
import { dateToIso } from '../../lib/timeUtils';
import { AttendanceSimulatorTab } from './AttendanceSimulatorTab';

export const AdminView: React.FC = () => {
  const { user, isAdmin, adminResetPassword } = useAuth();
  const { auditLogs, adminRevertAuditLog, addToast } = useApp();

  const [adminTab, setAdminTab] = useState<'simulator' | 'audit' | 'users' | 'master'>('simulator');
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserForReset, setSelectedUserForReset] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [userList, setUserList] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (isAdmin) {
      adminRepository.getUsers().then(users => setUserList(users));
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-12 text-center card rounded-2xl border-border">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="font-display text-lg font-bold text-primary">Access Restricted</h3>
        <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
          Administrative controls are reserved for authorized university staff. Please sign in as an authorized admin account.
        </p>
      </div>
    );
  }

  const filteredUsers = userList.filter(u => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.grNumber.toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  });

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForReset || !newPasswordInput) return;

    const ok = await adminResetPassword(selectedUserForReset, newPasswordInput);
    if (ok) {
      addToast('Password Reset', `Password updated for GR ${selectedUserForReset}.`, 'success');
      setSelectedUserForReset(null);
      setNewPasswordInput('');
    } else {
      addToast('Error', 'Failed to reset password.', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold bg-brand text-white px-2 py-0.5 rounded">
              SYSTEM ADMIN
            </span>
            <h2 className="font-display text-2xl font-bold text-primary">University Control Plane</h2>
          </div>
          <p className="text-xs text-muted font-mono mt-0.5">
            Admin GR: {user?.grNumber} ({user?.displayName}) · Master Data & Audit Logs
          </p>
        </div>

        <div className="flex flex-wrap bg-surface border border-border rounded-xl p-0.5 font-mono text-xs font-bold shadow-subtle">
          <button
            type="button"
            onClick={() => setAdminTab('simulator')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              adminTab === 'simulator'
                ? 'bg-primary text-background shadow-sm'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Engine Simulation & Audit</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('audit')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              adminTab === 'audit'
                ? 'bg-primary text-background shadow-sm'
                : 'text-muted hover:text-primary'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit History</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('users')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              adminTab === 'users'
                ? 'bg-primary text-background shadow-sm'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Accounts</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('master')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              adminTab === 'master'
                ? 'bg-primary text-background shadow-sm'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Master Routine</span>
          </button>
        </div>
      </div>

      {/* SIMULATOR & AUDIT TAB */}
      {adminTab === 'simulator' && <AttendanceSimulatorTab />}

      {/* AUDIT LOG TAB */}
      {adminTab === 'audit' && (
        <div className="card rounded-2xl p-5 shadow-subtle border-border space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-display font-bold text-base text-primary flex items-center gap-2">
              <History className="w-4 h-4 text-brand" />
              Administrative Audit Log ({auditLogs.length} Events)
            </h3>
            <span className="text-[10px] font-mono text-muted">Immutable Ledger</span>
          </div>

          <p className="text-xs text-muted leading-relaxed">
            Every modification to master routines, academic calendars, and global settings is timestamped with actor identity and effective dates. Any action can be reverted instantly.
          </p>

          <div className="space-y-2">
            {auditLogs.length > 0 ? (
              auditLogs.map(log => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl border border-border bg-surface-hover/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-brand/10 text-brand">
                        {log.entity}
                      </span>
                      <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-surface border border-border text-muted">
                        {log.changeType}
                      </span>
                      <span className="text-[9px] font-mono text-muted">
                        Actor GR: {log.actorGr}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-primary">
                      Entity ID: {log.entityId} · Scope: {log.scope.toUpperCase()}
                    </p>
                    <p className="text-[10px] font-mono text-muted mt-0.5">
                      Effective: {log.effectiveDate} · Logged: {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => adminRevertAuditLog(log.id)}
                      className="px-2.5 py-1 rounded-lg bg-surface border border-border text-xs font-mono font-bold text-muted hover:text-rose-500 hover:border-rose-500/30 flex items-center gap-1 transition-all"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Revert Change</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-muted border border-dashed border-border rounded-xl">
                No administrative mutations recorded yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* USER ACCOUNTS TAB */}
      {adminTab === 'users' && (
        <div className="card rounded-2xl p-5 shadow-subtle border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h3 className="font-display font-bold text-base text-primary flex items-center gap-2">
                <Users className="w-4 h-4 text-brand" />
                Registered Student Accounts ({userList.length})
              </h3>
              <p className="text-[11px] font-mono text-muted">Manage roles and reset student credentials</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Filter by Name, GR or Email..."
                className="w-full bg-surface border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-brand font-medium"
              />
            </div>
          </div>

          <div className="space-y-2">
            {filteredUsers.map(u => (
              <div
                key={u.id}
                className="p-3 rounded-xl border border-border bg-surface flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="text-xs font-bold text-primary">{u.displayName}</h5>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface-hover border border-border text-muted">
                      GR {u.grNumber}
                    </span>
                    {u.role === 'admin' && (
                      <span className="text-[9px] font-mono font-bold bg-brand/15 text-brand px-1.5 py-0.5 rounded">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-muted mt-0.5">
                    {u.program} {u.group} · {u.hostel || 'Day Scholar'} · {u.email || 'No email registered'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedUserForReset(u.grNumber);
                    setNewPasswordInput('');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-surface-hover border border-border text-xs font-mono font-bold text-primary hover:text-brand flex items-center gap-1 transition-colors shrink-0"
                >
                  <Key className="w-3 h-3" />
                  <span>Reset Password</span>
                </button>
              </div>
            ))}
          </div>

          {/* RESET PASSWORD MODAL */}
          {selectedUserForReset && (
            <div className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="card w-full max-w-sm bg-surface p-5 shadow-2xl border-border animate-in zoom-in-95 space-y-4">
                <h4 className="font-display text-base font-bold text-primary">
                  Admin Password Reset: GR {selectedUserForReset}
                </h4>
                <form onSubmit={handlePasswordReset} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                      New Password
                    </label>
                    <input
                      type="text"
                      required
                      value={newPasswordInput}
                      onChange={e => setNewPasswordInput(e.target.value)}
                      placeholder="Enter new temporary password"
                      className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono font-bold"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setSelectedUserForReset(null)}
                      className="px-3.5 py-1.5 rounded-xl bg-surface-hover text-muted hover:text-primary font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-brand text-white font-bold hover:opacity-90"
                    >
                      Save Password
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MASTER DATA MANAGEMENT */}
      {adminTab === 'master' && (
        <div className="card rounded-2xl p-5 shadow-subtle border-border space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-display font-bold text-base text-primary flex items-center gap-2">
              <Database className="w-4 h-4 text-brand" />
              Official Routine Master Control
            </h3>
            <span className="text-[10px] font-mono text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
              Active Term: MCA DS 1A
            </span>
          </div>

          <p className="text-xs text-muted leading-relaxed">
            University administrators can push global routine updates across all student devices. Edits published here apply to all students in section 1A automatically while preserving personal overrides.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-primary">Class Start Date Configuration</h4>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">
                  Official commencement date for Semester 1 classes is set to <b>2026-07-29</b>.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-border text-[10px] font-mono text-muted">
                Status: Active Global
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-primary">Minimum Attendance Benchmark</h4>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">
                  University mandatory threshold is set to <b>75.0%</b>. Warnings are issued below 75%.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-border text-[10px] font-mono text-muted">
                Status: Enforced
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
