import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  CalendarDays,
  CalendarCheck,
  CheckSquare,
  Sparkles,
  Building2,
  Settings,
  ShieldCheck,
  Search,
  Bell,
  Sun,
  Moon,
  Cloud,
  RotateCw,
  LogOut,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SearchPalette } from '../Common/SearchPalette';
import { NotificationDrawer } from '../Common/NotificationDrawer';
import { ToastContainer } from '../Common/ToastContainer';
import { AuthModal } from '../Auth/AuthModal';

// Views
import { TodayView } from '../Views/TodayView';
import { ScheduleView } from '../Views/ScheduleView';
import { TasksView } from '../Views/TasksView';
import { HubView } from '../Views/HubView';
import { HostelView } from '../Views/HostelView';
import { SettingsView } from '../Views/SettingsView';
import { AdminView } from '../Views/AdminView';

export const AppShell: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    syncState,
    triggerManualSync,
    notifications,
    toasts,
    removeToast,
    legacyMigration,
    runLegacyMigration,
    dismissLegacyMigration,
    conflicts,
    resolveConflict
  } = useApp();

  const { user, isAdmin, logout } = useAuth();
  const { toggleDark, isDark } = useTheme();

  const [searchOpen, setSearchOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Swipe gesture tracking for touch devices (phones, tablets, iPads)
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');

  // Main navigation items strictly matching Section 2:
  // Today · Schedule · Tasks · Hub · Hostel · Settings (+ Admin if role permits)
  const navItems = useMemo(() => {
    const items = [
      { id: 'today', label: 'Today', icon: CalendarDays },
      { id: 'schedule', label: 'Schedule', icon: CalendarCheck },
      { id: 'tasks', label: 'Tasks', icon: CheckSquare },
      { id: 'hub', label: 'Hub', icon: Sparkles },
      { id: 'hostel', label: 'Hostel', icon: Building2 },
      { id: 'settings', label: 'Settings', icon: Settings }
    ];

    if (isAdmin) {
      items.push({ id: 'admin', label: 'Admin', icon: ShieldCheck });
    }
    return items;
  }, [isAdmin]);

  const tabOrder = useMemo(() => navItems.map(item => item.id), [navItems]);

  const switchTab = useCallback(
    (targetTab: string, direction?: 'left' | 'right') => {
      const currentIdx = tabOrder.indexOf(activeTab);
      const targetIdx = tabOrder.indexOf(targetTab);
      if (targetIdx === -1) return;
      const dir = direction || (targetIdx > currentIdx ? 'left' : 'right');
      setSlideDirection(dir);
      setActiveTab(targetTab);
    },
    [activeTab, tabOrder, setActiveTab]
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (
      touchStartX.current === null ||
      touchStartY.current === null ||
      touchStartTime.current === null ||
      e.changedTouches.length === 0
    ) {
      touchStartX.current = null;
      touchStartY.current = null;
      touchStartTime.current = null;
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchStartX.current;
    const deltaY = endY - touchStartY.current;
    const duration = Date.now() - touchStartTime.current;
    const velocityX = Math.abs(deltaX) / Math.max(1, duration);

    touchStartX.current = null;
    touchStartY.current = null;
    touchStartTime.current = null;

    // Check if swipe is dominantly horizontal to avoid vertical scrolling interference
    const isDominantlyHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.25;
    // Accurate sensitivity: clear slide >= 45px or swift flick >= 25px with velocity > 0.25 px/ms
    const isValidSwipe =
      isDominantlyHorizontal &&
      duration < 650 &&
      (Math.abs(deltaX) >= 45 || (Math.abs(deltaX) >= 25 && velocityX > 0.25));

    if (isValidSwipe) {
      const currentIndex = tabOrder.indexOf(activeTab);
      if (currentIndex === -1) return;

      if (deltaX < 0) {
        // Swiped LEFT -> Next Tab
        if (currentIndex < tabOrder.length - 1) {
          switchTab(tabOrder[currentIndex + 1], 'left');
        }
      } else {
        // Swiped RIGHT -> Previous Tab
        if (currentIndex > 0) {
          switchTab(tabOrder[currentIndex - 1], 'right');
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-primary flex flex-col selection:bg-brand/20">
      {/* GLOBAL TOASTS */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* SEARCH COMMAND PALETTE */}
      <SearchPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* NOTIFICATIONS DRAWER */}
      <NotificationDrawer isOpen={notifDrawerOpen} onClose={() => setNotifDrawerOpen(false)} />

      {/* AUTH MODAL */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* TOP APP BAR */}
      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-md border-b border-border transition-colors">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* BRAND */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('today')}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-8 h-8 rounded-xl bg-brand text-white flex items-center justify-center font-display font-black text-base shadow-sm group-hover:opacity-90 transition-opacity">
                W
              </div>
              <div className="hidden sm:block">
                <h1 className="font-display text-sm font-bold text-primary tracking-tight leading-none group-hover:text-brand transition-colors">
                  WorkSpace
                </h1>
                <p className="text-[10px] font-mono text-muted leading-none mt-0.5">
                  MCA DS 1A · CGC
                </p>
              </div>
            </button>
          </div>

          {/* ACTION TOOLS */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Search Trigger */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-mono text-muted bg-surface hover:bg-surface-hover border border-border transition-colors shadow-subtle"
              title="Search routine, courses and tasks (Cmd+K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline-block">Search</span>
              <kbd className="hidden sm:inline-block text-[10px] bg-background border border-border px-1 rounded">
                ⌘K
              </kbd>
            </button>

            {/* Cloud Sync Button */}
            <button
              type="button"
              onClick={triggerManualSync}
              className="p-2 rounded-xl text-muted hover:text-primary hover:bg-surface-hover transition-colors relative"
              title={`Sync status: ${syncState}`}
            >
              {syncState === 'syncing' ? (
                <RotateCw className="w-4 h-4 animate-spin text-brand" />
              ) : (
                <Cloud className="w-4 h-4" />
              )}
            </button>

            {/* Notifications Button */}
            <button
              type="button"
              onClick={() => setNotifDrawerOpen(true)}
              className="p-2 rounded-xl text-muted hover:text-primary hover:bg-surface-hover transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand"></span>
              )}
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleDark}
              className="p-2 rounded-xl text-muted hover:text-primary hover:bg-surface-hover transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-brand" />}
            </button>

            {/* USER PROFILE MENU / AUTH TRIGGER */}
            <div className="relative">
              {user ? (
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 p-1 rounded-xl hover:bg-surface-hover transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-brand/15 text-brand border border-brand/30 flex items-center justify-center text-xs font-mono font-bold">
                    {user.grNumber.slice(-2)}
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-bold bg-brand text-white rounded-xl hover:opacity-90 transition-opacity"
                >
                  Sign In
                </button>
              )}

              {/* DROPDOWN MENU */}
              {profileDropdownOpen && user && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-2xl shadow-2xl p-2 z-50 animate-in zoom-in-95 space-y-1"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-xs font-bold text-primary truncate">{user.displayName}</p>
                    <p className="text-[10px] font-mono text-muted">GR {user.grNumber} · {user.role.toUpperCase()}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-primary hover:bg-surface-hover flex items-center gap-2"
                  >
                    <Settings className="w-3.5 h-3.5 text-muted" />
                    <span>Settings & Preferences</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-primary hover:bg-surface-hover flex items-center gap-2"
                  >
                    <User className="w-3.5 h-3.5 text-muted" />
                    <span>Switch Account / Register</span>
                  </button>

                  <button
                    type="button"
                    onClick={logout}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* LEGACY DATA MIGRATION BANNER */}
      {legacyMigration && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              Local WorkSpace data found ({legacyMigration.attendanceCount} attendance records, {legacyMigration.tasksCount} tasks).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runLegacyMigration}
              className="px-2.5 py-1 rounded-lg bg-brand text-white font-mono text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Import Local Data
            </button>
            <button
              type="button"
              onClick={dismissLegacyMigration}
              className="px-2 py-1 text-muted hover:text-primary text-xs transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* SYNC CONFLICTS BANNER */}
      {conflicts.length > 0 && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 text-rose-900 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-rose-500 shrink-0" />
            <span>
              {conflicts.length} cloud conflict(s) detected.
            </span>
          </div>
          <button
            type="button"
            onClick={() => resolveConflict(conflicts[0].id, 'client')}
            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-mono font-semibold transition-colors"
          >
            Keep Local Version
          </button>
        </div>
      )}

      {/* MAIN BODY CONTENT WITH TOUCH SLIDE GESTURES */}
      <div
        className="flex-1 w-full flex flex-col touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={activeTab}
            initial={{ opacity: 0, x: slideDirection === 'left' ? 24 : -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: slideDirection === 'left' ? -24 : 24 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex-1 max-w-6xl w-full mx-auto p-3.5 sm:p-5 md:p-6 pb-[calc(6rem+env(safe-area-inset-bottom,1rem))] sm:pb-36 lg:pb-40"
          >
            {activeTab === 'today' && <TodayView />}
            {activeTab === 'schedule' && <ScheduleView />}
            {activeTab === 'tasks' && <TasksView />}
            {activeTab === 'hub' && <HubView />}
            {activeTab === 'hostel' && <HostelView />}
            {activeTab === 'settings' && <SettingsView />}
            {activeTab === 'admin' && isAdmin && <AdminView />}
            
            {/* Guaranteed buffer space ensuring last element is 100% visible above navigation dock */}
            <div className="h-8 sm:h-12 w-full shrink-0 pointer-events-none" aria-hidden="true" />
          </motion.main>
        </AnimatePresence>
      </div>

      {/* BOTTOM NAVIGATION - MOBILE PHONES (< sm) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-border px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom,0.75rem),0.75rem)] shadow-[0_-4px_20px_rgba(0,0,0,0.15)] flex items-center justify-around">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTab(item.id)}
              className={`min-h-[48px] min-w-[44px] flex-1 py-1 px-1 flex flex-col items-center justify-center rounded-xl transition-all relative ${
                isActive ? 'text-brand font-bold' : 'text-muted hover:text-primary active:scale-95'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-brand/10' : ''}`}>
                <Icon className={`w-4 h-4 transition-transform ${isActive ? 'scale-110' : ''}`} />
              </div>
              <span className="text-[10px] font-mono leading-tight mt-0.5">{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeBottomTabMobile"
                  className="w-1 h-1 rounded-full bg-brand mt-0.5"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* BOTTOM NAVIGATION - TABLETS, IPADS, LAPTOPS & DESKTOPS (>= sm) */}
      <nav className="hidden sm:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface/90 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-1.5 items-center gap-1.5 transition-all max-w-fit">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTab(item.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 relative ${
                isActive
                  ? 'bg-primary text-background shadow-md'
                  : 'text-muted hover:text-primary hover:bg-surface-hover/70 active:scale-95'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
