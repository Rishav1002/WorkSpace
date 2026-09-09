import React, { useState } from 'react';
import {
  User,
  ShieldCheck,
  Bell,
  Palette,
  Laptop,
  Lock,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Save,
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme, ThemeMode, AccentColor } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { Storage } from '../../lib/storage';
import { ConfirmModal } from '../Common/ToastContainer';

export const SettingsView: React.FC = () => {
  const {
    user,
    updateProfile,
    changeGrNumber,
    activeDevices,
    removeDevice,
    signOutOtherDevices,
    requestAccountDeletion,
    cancelAccountDeletion,
    exportDataJSON,
    exportDataCSV,
    logout
  } = useAuth();

  const { mode, accent, setMode, setAccent } = useTheme();
  const { notifSettings, updateNotifSettings, addToast } = useApp();

  // Profile Form States
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [hostelRoom, setHostelRoom] = useState(user?.hostelRoom || '');
  const [attendanceTarget, setAttendanceTarget] = useState(user?.attendanceTarget || 75);
  const [classStartDate, setClassStartDate] = useState(user?.classStartDate || '2026-07-29');
  const [recoveryPin, setRecoveryPin] = useState(user?.recoveryPin || '2026');

  // GR Change State
  const [newGr, setNewGr] = useState(user?.grNumber || '');
  const [grModalOpen, setGrModalOpen] = useState(false);

  // Name Change Confirmation State
  const [nameModalOpen, setNameModalOpen] = useState(false);

  // Account Deletion Confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Save profile info
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName !== user?.displayName) {
      setNameModalOpen(true);
      return;
    }
    await commitProfileUpdates();
  };

  const commitProfileUpdates = async () => {
    const res = await updateProfile({
      displayName: displayName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      hostelRoom: hostelRoom.trim() || undefined,
      attendanceTarget: Number(attendanceTarget),
      classStartDate,
      recoveryPin: recoveryPin.trim() || '2026'
    });
    if (res.success) {
      addToast('Profile Updated', 'Your personal preferences have been saved.', 'success');
    }
  };

  const handleConfirmGrChange = async () => {
    const res = await changeGrNumber(newGr);
    if (res.success) {
      addToast('GR Number Updated', `Academic ID updated to ${newGr}.`, 'success');
      setGrModalOpen(false);
    } else {
      addToast('Error', res.error || 'Failed to change GR Number', 'error');
    }
  };

  const handleExportJson = async () => {
    if (!user) return;
    const jsonStr = await exportDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace_backup_gr${user.grNumber}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Backup Downloaded', 'Complete JSON dataset exported from offline database.', 'success');
  };

  const handleExportAttendanceCsv = async () => {
    if (!user) return;
    const { attendanceCSV } = await exportDataCSV();
    const blob = new Blob([attendanceCSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace_attendance_${user.grNumber}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Export Complete', 'Attendance records CSV downloaded.', 'success');
  };

  const handleExportTasksCsv = async () => {
    if (!user) return;
    const { tasksCSV } = await exportDataCSV();
    const blob = new Blob([tasksCSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace_tasks_${user.grNumber}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Export Complete', 'Tasks CSV downloaded.', 'success');
  };

  const accentOptions: { id: AccentColor; label: string; colorClass: string }[] = [
    { id: 'indigo', label: 'Indigo', colorClass: 'bg-indigo-500' },
    { id: 'emerald', label: 'Emerald', colorClass: 'bg-emerald-500' },
    { id: 'sky', label: 'Sky', colorClass: 'bg-sky-500' },
    { id: 'violet', label: 'Violet', colorClass: 'bg-violet-500' },
    { id: 'rose', label: 'Rose', colorClass: 'bg-rose-500' },
    { id: 'amber', label: 'Amber', colorClass: 'bg-amber-500' }
  ];

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-200">
      {/* HEADER */}
      <div className="border-b border-border pb-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-primary">Settings & Preferences</h2>
          <p className="text-xs text-muted font-mono">
            User profile, notification triggers, theme & session security
          </p>
        </div>

        <button
          type="button"
          onClick={logout}
          className="px-3.5 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors border border-rose-500/20 flex items-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* ACCOUNT DELETION BANNER (IF PENDING) */}
      {user?.scheduledDeletionAt && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <h4 className="text-xs font-bold">Account Scheduled for Deletion</h4>
              <p className="text-[11px] text-muted">
                Your data will be permanently purged on{' '}
                {new Date(new Date(user.scheduledDeletionAt).getTime() + 7 * 86400000).toLocaleDateString()}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={cancelAccountDeletion}
            className="px-3 py-1.5 rounded-xl bg-surface border border-border text-xs font-bold text-primary hover:bg-surface-hover"
          >
            Cancel Deletion
          </button>
        </div>
      )}

      {/* PROFILE & ACADEMIC SECTION */}
      <div className="card rounded-2xl p-5 shadow-subtle border-border space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <User className="w-4 h-4 text-brand" />
          <h3 className="font-display font-bold text-base text-primary">Profile & Identity</h3>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-medium"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary"
                />
                {user?.emailVerified && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-emerald-500 font-bold">
                    VERIFIED
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                Hostel Room No.
              </label>
              <input
                type="text"
                value={hostelRoom}
                onChange={e => setHostelRoom(e.target.value)}
                placeholder="e.g. F-302"
                className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                Attendance Target (%)
              </label>
              <input
                type="number"
                min="50"
                max="100"
                value={attendanceTarget}
                onChange={e => setAttendanceTarget(Number(e.target.value))}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                Classes Start Date
              </label>
              <input
                type="date"
                value={classStartDate}
                onChange={e => setClassStartDate(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                Security Recovery PIN (4 Digits)
              </label>
              <input
                type="text"
                maxLength={6}
                value={recoveryPin}
                onChange={e => setRecoveryPin(e.target.value)}
                placeholder="e.g. 2026"
                className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono font-bold"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-brand text-white font-bold hover:opacity-90 active:scale-95 flex items-center gap-1.5 shadow-subtle"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Profile Changes</span>
            </button>
          </div>
        </form>

        {/* GR NUMBER CHANGE */}
        <div className="mt-4 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-hover/30 p-3.5 rounded-xl">
          <div>
            <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-brand" />
              Academic Identifier (GR Number)
            </h4>
            <p className="text-[11px] text-muted mt-0.5">
              Current GR: <b className="font-mono text-primary">{user?.grNumber}</b>. Changing your GR preserves all your timetable, attendance records, and tasks.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setNewGr(user?.grNumber || '');
              setGrModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-surface border border-border text-xs font-bold text-primary hover:bg-surface-hover transition-colors shrink-0"
          >
            Change GR Number
          </button>
        </div>
      </div>

      {/* APPEARANCE & THEME */}
      <div className="card rounded-2xl p-5 shadow-subtle border-border space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Palette className="w-4 h-4 text-brand" />
          <h3 className="font-display font-bold text-base text-primary">Theme & Styling</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-2">
              Color Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['dark', 'light', 'system'] as ThemeMode[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize transition-all ${
                    mode === m
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-border text-muted hover:bg-surface-hover'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-2">
              Accent Color Preset
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {accentOptions.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAccent(opt.id)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                    accent === opt.id
                      ? 'border-primary bg-surface-hover shadow-sm'
                      : 'border-border text-muted hover:bg-surface-hover'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full ${opt.colorClass}`}></span>
                  <span className="text-[10px]">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* NOTIFICATIONS SETTINGS */}
      <div className="card rounded-2xl p-5 shadow-subtle border-border space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Bell className="w-4 h-4 text-brand" />
          <h3 className="font-display font-bold text-base text-primary">Notification Triggers</h3>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl border border-border">
            <div>
              <h5 className="font-bold text-primary">Upcoming Class Reminders</h5>
              <p className="text-[11px] text-muted">Alert {notifSettings.classes.upcomingMinutes} minutes before period starts</p>
            </div>
            <input
              type="checkbox"
              checked={notifSettings.classes.upcoming}
              onChange={e =>
                updateNotifSettings({
                  ...notifSettings,
                  classes: { ...notifSettings.classes, upcoming: e.target.checked }
                })
              }
              className="rounded border-border text-brand accent-brand"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border">
            <div>
              <h5 className="font-bold text-primary">Exact Start-time Attendance Trigger</h5>
              <p className="text-[11px] text-muted">Auto-mark Present and notify when period starts</p>
            </div>
            <input
              type="checkbox"
              checked={notifSettings.classes.atStart}
              onChange={e =>
                updateNotifSettings({
                  ...notifSettings,
                  classes: { ...notifSettings.classes, atStart: e.target.checked }
                })
              }
              className="rounded border-border text-brand accent-brand"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border">
            <div>
              <h5 className="font-bold text-primary">Homework & Task Deadlines</h5>
              <p className="text-[11px] text-muted">Notify {notifSettings.tasks.daysBefore} day before due date</p>
            </div>
            <input
              type="checkbox"
              checked={notifSettings.tasks.enabled}
              onChange={e =>
                updateNotifSettings({
                  ...notifSettings,
                  tasks: { ...notifSettings.tasks, enabled: e.target.checked }
                })
              }
              className="rounded border-border text-brand accent-brand"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border">
            <div>
              <h5 className="font-bold text-primary">Mess Meal Window Alerts</h5>
              <p className="text-[11px] text-muted">Notify {notifSettings.meals.minutesBefore} minutes before dining opens</p>
            </div>
            <input
              type="checkbox"
              checked={notifSettings.meals.enabled}
              onChange={e =>
                updateNotifSettings({
                  ...notifSettings,
                  meals: { ...notifSettings.meals, enabled: e.target.checked }
                })
              }
              className="rounded border-border text-brand accent-brand"
            />
          </div>
        </div>
      </div>

      {/* ACTIVE DEVICE SESSIONS */}
      <div className="card rounded-2xl p-5 shadow-subtle border-border space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Laptop className="w-4 h-4 text-brand" />
            <h3 className="font-display font-bold text-base text-primary">
              Active Sessions ({activeDevices.length} / 3)
            </h3>
          </div>

          {activeDevices.length > 1 && (
            <button
              type="button"
              onClick={signOutOtherDevices}
              className="text-[11px] font-mono text-rose-500 font-bold hover:underline"
            >
              Sign Out All Other Devices
            </button>
          )}
        </div>

        <div className="space-y-2">
          {activeDevices.map(dev => (
            <div
              key={dev.id}
              className="p-3 rounded-xl border border-border flex items-center justify-between bg-surface-hover/30"
            >
              <div>
                <h5 className="text-xs font-bold text-primary flex items-center gap-1.5">
                  {dev.deviceName}
                  {dev.isCurrent && (
                    <span className="text-[9px] font-mono bg-emerald-500/15 text-emerald-500 px-1.5 py-0.5 rounded font-bold">
                      CURRENT
                    </span>
                  )}
                </h5>
                <p className="text-[10px] font-mono text-muted mt-0.5">
                  Last active: {new Date(dev.lastActive).toLocaleString()}
                </p>
              </div>

              {!dev.isCurrent && (
                <button
                  type="button"
                  onClick={() => removeDevice(dev.id)}
                  className="text-xs text-rose-500 font-bold hover:underline p-1"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* DATA EXPORT & AUDIT */}
      <div className="card rounded-2xl p-5 shadow-subtle border-border space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Download className="w-4 h-4 text-brand" />
          <h3 className="font-display font-bold text-base text-primary">Data Backup & Export</h3>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          Export your complete workspace records. You can download an offline JSON backup or export specific datasets as CSV spreadsheets.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleExportJson}
            className="p-3 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-all text-left flex flex-col justify-between"
          >
            <Download className="w-4 h-4 text-brand mb-2" />
            <div>
              <h5 className="text-xs font-bold text-primary">Full JSON Backup</h5>
              <p className="text-[10px] font-mono text-muted mt-0.5">All settings & records</p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleExportAttendanceCsv}
            className="p-3 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-all text-left flex flex-col justify-between"
          >
            <FileText className="w-4 h-4 text-emerald-500 mb-2" />
            <div>
              <h5 className="text-xs font-bold text-primary">Attendance CSV</h5>
              <p className="text-[10px] font-mono text-muted mt-0.5">Dates, courses & status</p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleExportTasksCsv}
            className="p-3 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-all text-left flex flex-col justify-between"
          >
            <FileText className="w-4 h-4 text-amber-500 mb-2" />
            <div>
              <h5 className="text-xs font-bold text-primary">Tasks & Homework CSV</h5>
              <p className="text-[10px] font-mono text-muted mt-0.5">Due dates & priorities</p>
            </div>
          </button>
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="card rounded-2xl p-5 shadow-subtle border border-rose-500/30 bg-rose-500/5 space-y-3">
        <h3 className="font-display font-bold text-base text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
          <Trash2 className="w-4 h-4" /> Danger Zone
        </h3>
        <p className="text-xs text-muted leading-relaxed">
          Schedule account deletion. A 7-day grace period is provided before irreversible data purge. Logging in during this window automatically cancels the deletion.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 active:scale-95 transition-all shadow-sm"
          >
            Request Account Deletion (7-Day Grace)
          </button>
        </div>
      </div>

      {/* MODALS */}
      <ConfirmModal
        isOpen={grModalOpen}
        title="Confirm GR Number Change"
        message={`Are you sure you want to change your academic GR Number from ${user?.grNumber} to ${newGr}? Your attendance logs, tasks, and routine will be preserved.`}
        confirmText="Update GR Number"
        onConfirm={handleConfirmGrChange}
        onCancel={() => setGrModalOpen(false)}
      />

      <ConfirmModal
        isOpen={nameModalOpen}
        title="Confirm Name Change"
        message={`Do you want to update your registered display name to "${displayName}"?`}
        confirmText="Save Name"
        onConfirm={async () => {
          setNameModalOpen(false);
          await commitProfileUpdates();
        }}
        onCancel={() => setNameModalOpen(false)}
      />

      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Request Account Deletion"
        message="Your account will be placed into a 7-day scheduled deletion queue. You may cancel anytime by simply logging back in. Proceed?"
        confirmText="Schedule Deletion"
        isDestructive
        onConfirm={() => {
          requestAccountDeletion();
          setDeleteModalOpen(false);
          addToast('Scheduled for Deletion', '7-day grace period active.', 'warning');
        }}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </div>
  );
};
