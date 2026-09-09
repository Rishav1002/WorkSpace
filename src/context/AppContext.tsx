import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  TimetableSlot,
  TimetableOverride,
  CalendarEvent,
  AttendanceRecord,
  TaskItem,
  NotificationItem,
  NotificationSettings,
  ResolvedClassOccurrence,
  HostelInfo,
  AuditLogEntry,
  CampusBlock,
  UserCustomMealDay
} from '../types';
import { useAuth } from './AuthContext';
import { DEFAULT_NOTIF_SETTINGS, Storage } from '../lib/storage';
import { resolveClassesForDate, calculateAttendanceAnalytics, AttendanceAnalytics } from '../lib/attendanceEngine';
import { dateToIso, getCurrentMinutes, formatMinutes } from '../lib/timeUtils';
import { OFFICIAL_TIMETABLE_SLOTS, OFFICIAL_ACADEMIC_CALENDAR, OFFICIAL_HOSTELS } from '../data/masterData';

// Real repositories & offline engine
import { timetableRepository } from '../lib/repository/timetableRepository';
import { attendanceRepository } from '../lib/repository/attendanceRepository';
import { taskRepository } from '../lib/repository/taskRepository';
import { calendarRepository } from '../lib/repository/calendarRepository';
import { hostelRepository } from '../lib/repository/hostelRepository';
import { adminRepository } from '../lib/repository/adminRepository';
import { notificationRepository } from '../lib/repository/notificationRepository';
import { syncRepository, SyncStatus } from '../lib/repository/syncRepository';
import { localStorageMigration, LegacyMigrationSummary } from '../lib/offline/migration';
import { SyncConflictItem } from '../lib/offline/db';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'pending' | 'conflict' | 'error';

interface AppContextType {
  // Navigation
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // Timetable
  timetableSlots: TimetableSlot[];
  overrides: TimetableOverride[];
  saveTimetableOverride: (override: Omit<TimetableOverride, 'id' | 'userId'>) => Promise<void>;
  deleteTimetableOverride: (overrideId: string) => Promise<void>;
  restoreOfficialRoutine: (slotId: string) => Promise<void>;

  // Classes & Attendance
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  todayClasses: ResolvedClassOccurrence[];
  selectedDateClasses: ResolvedClassOccurrence[];
  attendanceRecords: Record<string, AttendanceRecord>;
  markAttendance: (occurrenceKey: string, status: 'present' | 'absent' | null, isManual?: boolean) => Promise<void>;
  analytics: AttendanceAnalytics;

  // Tasks
  tasks: TaskItem[];
  addTask: (task: Omit<TaskItem, 'id' | 'userId' | 'updatedAt'>) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<TaskItem>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleTaskComplete: (taskId: string) => Promise<void>;

  // Calendar
  calendarEvents: CalendarEvent[];
  addCalendarEvent: (event: Omit<CalendarEvent, 'id'>, isOfficial?: boolean) => Promise<void>;
  deleteCalendarEvent: (eventId: string) => Promise<void>;

  // Hostel & Mess
  hostels: HostelInfo[];
  selectedHostel: HostelInfo | undefined;
  requestHostelGlobal: (info: { hostelName: string; notes: string; wardenPhone?: string }) => void;
  campusBlocks: CampusBlock[];
  updateCampusBlock: (blockNumber: number, customName: string) => void;
  customMealRoutine: Record<number, UserCustomMealDay>;
  updateCustomMealDay: (dayMenu: UserCustomMealDay) => void;

  // Notifications
  notifications: NotificationItem[];
  notifSettings: NotificationSettings;
  updateNotifSettings: (settings: NotificationSettings) => void;
  addToast: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  clearNotifications: () => Promise<void>;
  toasts: { id: string; title: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }[];
  removeToast: (id: string) => void;

  // Admin Master Data
  auditLogs: AuditLogEntry[];
  adminPublishMasterData: (entity: string, data: any, effectiveDate: string) => Promise<void>;
  adminRevertAuditLog: (logId: string) => Promise<void>;

  // Real Sync & Conflict Management
  syncState: SyncState;
  triggerManualSync: () => Promise<void>;
  conflicts: SyncConflictItem[];
  resolveConflict: (conflictId: string, resolution: 'client' | 'server' | 'merge', mergedPayload?: any) => Promise<void>;

  // Legacy LocalStorage Migration
  legacyMigration: LegacyMigrationSummary | null;
  runLegacyMigration: () => Promise<void>;
  dismissLegacyMigration: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<string>('today');
  const [selectedDate, setSelectedDate] = useState<string>(() => dateToIso(new Date()));

  // Reactive state
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>(() =>
    OFFICIAL_TIMETABLE_SLOTS.filter(s => s.group === 'MCA DS 1A' && s.day !== 1 && s.day !== 2)
  );
  const [overrides, setOverrides] = useState<TimetableOverride[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(OFFICIAL_ACADEMIC_CALENDAR);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [hostels, setHostels] = useState<HostelInfo[]>(OFFICIAL_HOSTELS);
  const [campusBlocks, setCampusBlocks] = useState<CampusBlock[]>(() => Storage.getCampusBlocks());
  const [customMealRoutine, setCustomMealRoutine] = useState<Record<number, UserCustomMealDay>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(DEFAULT_NOTIF_SETTINGS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [conflicts, setConflicts] = useState<SyncConflictItem[]>([]);
  const [toasts, setToasts] = useState<{ id: string; title: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }[]>([]);

  // Migration detection
  const [legacyMigration, setLegacyMigration] = useState<LegacyMigrationSummary | null>(null);

  // Toast dispatch helper
  const addToast = useCallback((title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Check legacy localStorage data when user is authenticated
  useEffect(() => {
    if (user) {
      const summary = localStorageMigration.checkLegacyData();
      if (summary.hasLegacyData) {
        setLegacyMigration(summary);
      }
    }
  }, [user]);

  const runLegacyMigration = async () => {
    if (!user) return;
    const { migratedCount } = await localStorageMigration.migrateLegacyData(user.id);
    setLegacyMigration(null);
    addToast('Data Imported', `Successfully imported ${migratedCount} records into cloud sync queue.`, 'success');
    // Refresh user records
    const attMap = await attendanceRepository.getAttendanceRecords(user.id, user.grNumber);
    setAttendanceRecords(attMap);
    const userTasks = await taskRepository.getTasks(user.id);
    setTasks(userTasks);
    const userOvrs = await timetableRepository.getOverrides(user.id);
    setOverrides(userOvrs);
  };

  const dismissLegacyMigration = () => {
    localStorageMigration.dismissMigration();
    setLegacyMigration(null);
  };

  // Sync state observer
  const refreshSyncStatus = useCallback(async () => {
    try {
      const status: SyncStatus = await syncRepository.getSyncStatus();
      if (status === 'OFFLINE') setSyncState('offline');
      else if (status === 'SYNCING') setSyncState('syncing');
      else if (status === 'CONFLICT') {
        setSyncState('conflict');
        if (user) {
          const userConflicts = await syncRepository.getConflicts(user.id);
          setConflicts(userConflicts);
        }
      } else if (status === 'PENDING') setSyncState('pending');
      else if (status === 'ERROR') setSyncState('error');
      else setSyncState('synced');
    } catch {
      setSyncState('idle');
    }
  }, [user]);

  // Load repositories when user logs in or group/term changes
  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      const userGroup = user?.group || 'MCA DS 1A';
      const userTerm = user?.activeTermId || 'term-sem-1-2026';

      // 1. Hostels & Timetable Master Slots strictly scoped by academic group
      const [loadedSlots, loadedHostels] = await Promise.all([
        timetableRepository.getOfficialSlots(userGroup, userTerm),
        hostelRepository.getHostels()
      ]);

      if (!isCancelled) {
        setTimetableSlots(loadedSlots);
        setHostels(loadedHostels);
      }

      if (user) {
        // 2. User specific datasets
        const [userOvrs, attMap, userEvents, userTasks, userNotifs, userSettings, logs] = await Promise.all([
          timetableRepository.getOverrides(user.id),
          attendanceRepository.getAttendanceRecords(user.id, user.grNumber),
          calendarRepository.getEvents(user.id),
          taskRepository.getTasks(user.id),
          notificationRepository.getNotifications(user.id),
          notificationRepository.getSettings(user.id),
          isAdmin ? adminRepository.getAuditLogs() : Promise.resolve([])
        ]);

        if (!isCancelled) {
          setOverrides(userOvrs);
          setAttendanceRecords(attMap);
          setCalendarEvents(userEvents);
          setTasks(userTasks);
          setNotifications(userNotifs);
          setNotifSettings(userSettings);
          setAuditLogs(logs);
          setCustomMealRoutine(Storage.getCustomMealRoutine(user.id));
        }
      } else {
        if (!isCancelled) {
          setOverrides([]);
          setAttendanceRecords({});
          setCalendarEvents(OFFICIAL_ACADEMIC_CALENDAR);
          setTasks([]);
          setNotifications([]);
          setAuditLogs([]);
          setCustomMealRoutine({});
        }
      }

      refreshSyncStatus();
    }

    loadData();

    // Listen for online/offline events
    const handleOnline = () => {
      refreshSyncStatus();
      syncRepository.processQueue().then(() => refreshSyncStatus());
    };
    const handleOffline = () => setSyncState('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isCancelled = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, isAdmin, refreshSyncStatus]);

  // Today's Date ISO
  const todayIso = useMemo(() => dateToIso(new Date()), []);

  // Academic Scope for User
  const userAcademicScope = useMemo(() => {
    if (!user) return undefined;
    return {
      userId: user.id,
      group: user.group,
      program: user.program,
      semester: user.semester,
      section: user.section
    };
  }, [user]);

  // Central Class Occurrence Resolver for Today
  const todayClasses = useMemo(() => {
    if (!user) return [];
    return resolveClassesForDate(
      todayIso,
      timetableSlots,
      overrides,
      calendarEvents,
      attendanceRecords,
      user.classStartDate,
      userAcademicScope
    );
  }, [todayIso, timetableSlots, overrides, calendarEvents, attendanceRecords, user, userAcademicScope]);

  // Selected date classes
  const selectedDateClasses = useMemo(() => {
    if (!user) return [];
    return resolveClassesForDate(
      selectedDate,
      timetableSlots,
      overrides,
      calendarEvents,
      attendanceRecords,
      user.classStartDate,
      userAcademicScope
    );
  }, [selectedDate, timetableSlots, overrides, calendarEvents, attendanceRecords, user, userAcademicScope]);

  // EXACT START-TIME AUTO ATTENDANCE (Section 23)
  // At the exact moment scheduled period starts: mark Present locally and queue sync!
  useEffect(() => {
    if (!user) return;
    const currentMins = getCurrentMinutes();

    todayClasses.forEach(cls => {
      if (
        cls.status === 'scheduled' &&
        currentMins >= cls.startTime &&
        !cls.attendanceStatus
      ) {
        // Automatic present!
        attendanceRepository
          .markAttendance(user.id, cls.occurrenceKey, 'present', cls.courseCode, cls.dateStr, cls.startTime, 'auto')
          .then(rec => {
            if (rec) {
              setAttendanceRecords(prev => ({
                ...prev,
                [cls.occurrenceKey]: rec
              }));
              if (notifSettings.classes.atStart) {
                addToast('Class Started', `${cls.courseTitle} marked Present automatically.`, 'success');
              }
              refreshSyncStatus();
            }
          });
      }
    });
  }, [todayClasses, user, notifSettings.classes.atStart, addToast, refreshSyncStatus]);

  // Calculate full semester history for analytics
  const allResolvedHistory = useMemo(() => {
    if (!user) return [];

    const history: ResolvedClassOccurrence[] = [];
    const startDate = new Date(user.classStartDate || '2026-07-29');
    const endDate = new Date();

    const cur = new Date(startDate);
    while (cur <= endDate) {
      const dStr = dateToIso(cur);
      const dayOccurrences = resolveClassesForDate(
        dStr,
        timetableSlots,
        overrides,
        calendarEvents,
        attendanceRecords,
        user.classStartDate,
        userAcademicScope
      );
      history.push(...dayOccurrences);
      cur.setDate(cur.getDate() + 1);
    }

    return history;
  }, [user, timetableSlots, overrides, calendarEvents, attendanceRecords, userAcademicScope]);

  // Central Analytics Engine
  const analytics = useMemo(() => {
    return calculateAttendanceAnalytics(allResolvedHistory, user?.attendanceTarget || 75, user?.group);
  }, [allResolvedHistory, user?.attendanceTarget, user?.group]);

  // Mark / Edit Attendance (PRESENT or ABSENT only)
  const markAttendance = useCallback(
    async (occurrenceKey: string, status: 'present' | 'absent' | null, isManual: boolean = true) => {
      if (!user) return;

      const parts = occurrenceKey.split('-');
      const startTime = parseInt(parts[parts.length - 1], 10);
      const dateStr = parts.slice(parts.length - 4, parts.length - 1).join('-');
      const courseCode = parts.slice(0, parts.length - 4).join('-');

      // Enforce eligibility: future classes cannot be marked manually before start time
      const todayStr = dateToIso(new Date());
      const currentMins = getCurrentMinutes();
      const isFuture = dateStr > todayStr || (dateStr === todayStr && startTime > currentMins);

      if (isManual && isFuture) {
        addToast(
          'Cannot Mark Future Class',
          `Attendance can only be recorded once class start time arrives (${formatMinutes(startTime)}).`,
          'warning'
        );
        return;
      }

      // Holiday check
      const calEvent = calendarEvents.find(e => e.dateStr === dateStr);
      if (calEvent?.classImpact === 'cancel_all') {
        addToast('Holiday Class', 'Cannot record attendance on scheduled university holidays.', 'warning');
        return;
      }

      const rec = await attendanceRepository.markAttendance(
        user.id,
        occurrenceKey,
        status,
        courseCode,
        dateStr,
        startTime,
        isManual ? 'manual' : 'auto'
      );

      if (status === null) {
        setAttendanceRecords(prev => {
          const next = { ...prev };
          delete next[occurrenceKey];
          return next;
        });
        addToast('Attendance Cleared', 'Attendance status reset.', 'info');
      } else if (rec) {
        setAttendanceRecords(prev => ({
          ...prev,
          [occurrenceKey]: rec
        }));
        addToast(
          status === 'present' ? 'Marked Present' : 'Marked Absent',
          `${courseCode} on ${dateStr}`,
          status === 'present' ? 'success' : 'warning'
        );
      }

      refreshSyncStatus();
    },
    [user, calendarEvents, addToast, refreshSyncStatus]
  );

  // Timetable Overrides
  const saveTimetableOverride = useCallback(
    async (overrideData: Omit<TimetableOverride, 'id' | 'userId'>) => {
      if (!user) return;
      const newOvr = await timetableRepository.saveOverride(user.id, overrideData);
      setOverrides(prev => [...prev, newOvr]);
      addToast('Timetable Updated', 'Schedule change applied and queued for sync.', 'success');
      refreshSyncStatus();
    },
    [user, addToast, refreshSyncStatus]
  );

  const deleteTimetableOverride = useCallback(
    async (overrideId: string) => {
      if (!user) return;
      await timetableRepository.deleteOverride(user.id, overrideId);
      setOverrides(prev => prev.filter(o => o.id !== overrideId));
      addToast('Override Removed', 'Reverted back to default schedule.', 'info');
      refreshSyncStatus();
    },
    [user, addToast, refreshSyncStatus]
  );

  const restoreOfficialRoutine = useCallback(
    async (slotId: string) => {
      if (!user) return;
      await timetableRepository.restoreOfficialRoutine(user.id, slotId);
      const updated = await timetableRepository.getOverrides(user.id);
      setOverrides(updated);
      addToast('Official Routine Restored', 'Personal override deactivated.', 'success');
      refreshSyncStatus();
    },
    [user, addToast, refreshSyncStatus]
  );

  // Tasks Management
  const addTask = useCallback(
    async (taskData: Omit<TaskItem, 'id' | 'userId' | 'updatedAt'>) => {
      if (!user) return;
      const newTask = await taskRepository.addTask(user.id, taskData);
      setTasks(prev => [...prev, newTask]);
      addToast('Task Added', newTask.title, 'success');
      refreshSyncStatus();
    },
    [user, addToast, refreshSyncStatus]
  );

  const updateTask = useCallback(
    async (taskId: string, updates: Partial<TaskItem>) => {
      if (!user) return;
      const updated = await taskRepository.updateTask(user.id, taskId, updates);
      if (updated) {
        setTasks(prev => prev.map(t => (t.id === taskId ? updated : t)));
        addToast('Task Updated', 'Changes saved successfully.', 'info');
        refreshSyncStatus();
      }
    },
    [user, addToast, refreshSyncStatus]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!user) return;
      await taskRepository.deleteTask(user.id, taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      addToast('Task Removed', 'Task deleted.', 'info');
      refreshSyncStatus();
    },
    [user, addToast, refreshSyncStatus]
  );

  const toggleTaskComplete = useCallback(
    async (taskId: string) => {
      if (!user) return;
      const updated = await taskRepository.toggleTaskComplete(user.id, taskId);
      if (updated) {
        setTasks(prev => prev.map(t => (t.id === taskId ? updated : t)));
        refreshSyncStatus();
      }
    },
    [user, refreshSyncStatus]
  );

  // Calendar Management
  const addCalendarEvent = useCallback(
    async (eventData: Omit<CalendarEvent, 'id'>, isOfficial: boolean = false) => {
      if (!user) return;
      const newEvent = await calendarRepository.addEvent(user.id, eventData, isOfficial);

      if (isOfficial && isAdmin) {
        await adminRepository.addAuditLog({
          actorGr: user.grNumber,
          entity: 'calendar.event',
          entityId: newEvent.id,
          changeType: 'create',
          scope: 'master',
          effectiveDate: newEvent.dateStr,
          newValue: newEvent
        });
        const updatedLogs = await adminRepository.getAuditLogs();
        setAuditLogs(updatedLogs);
      }

      setCalendarEvents(prev => [...prev, newEvent]);
      addToast('Event Created', newEvent.title, 'success');
      refreshSyncStatus();
    },
    [user, isAdmin, addToast, refreshSyncStatus]
  );

  const deleteCalendarEvent = useCallback(
    async (eventId: string) => {
      if (!user) return;
      await calendarRepository.deleteEvent(user.id, eventId);
      setCalendarEvents(prev => prev.filter(e => e.id !== eventId));
      addToast('Event Removed', 'Event removed from calendar.', 'info');
      refreshSyncStatus();
    },
    [user, addToast, refreshSyncStatus]
  );

  const selectedHostel = useMemo(() => {
    return hostels.find(h => h.name === (user?.hostel || 'Einstein Hall')) || hostels[0];
  }, [hostels, user?.hostel]);

  const updateCampusBlock = useCallback((blockNumber: number, customName: string) => {
    const updated = Storage.saveCampusBlock(blockNumber, customName);
    setCampusBlocks(updated);
    addToast('Campus Block Updated', `Block ${blockNumber} designated as "${customName.trim() || `Block ${blockNumber}`}".`, 'success');
  }, [addToast]);

  const updateCustomMealDay = useCallback((dayMenu: UserCustomMealDay) => {
    if (!user) return;
    const updated = Storage.saveCustomMealDay(user.id, dayMenu);
    setCustomMealRoutine(updated);
    addToast('Meal Routine Saved', 'Personalized meal schedule updated for the day.', 'success');
  }, [user, addToast]);

  const requestHostelGlobal = useCallback(
    (info: { hostelName: string; notes: string; wardenPhone?: string }) => {
      if (!user) return;
      adminRepository.addAuditLog({
        actorGr: user.grNumber,
        entity: 'hostel.global_request',
        entityId: `req-${Date.now()}`,
        changeType: 'create',
        scope: 'personal',
        effectiveDate: new Date().toISOString(),
        newValue: info
      });
      addToast('Request Submitted', 'Hostel information sent to Admin for review.', 'success');
      refreshSyncStatus();
    },
    [user, addToast, refreshSyncStatus]
  );

  // Notification Settings
  const updateNotifSettings = useCallback(
    async (newSettings: NotificationSettings) => {
      setNotifSettings(newSettings);
      if (user) {
        await notificationRepository.saveSettings(user.id, newSettings);
      }
      addToast('Preferences Saved', 'Notification triggers updated.', 'success');
    },
    [user, addToast]
  );

  const clearNotifications = useCallback(async () => {
    await notificationRepository.clearNotifications(user?.id);
    setNotifications([]);
  }, [user]);

  // Admin Master Data Operations
  const adminPublishMasterData = useCallback(
    async (entity: string, data: any, effectiveDate: string) => {
      if (!isAdmin || !user) {
        addToast('Unauthorized', 'Admin privileges required.', 'error');
        return;
      }

      const res = await adminRepository.publishMasterData(user.grNumber, entity, data, effectiveDate);
      if (res.success) {
        const [updatedLogs, refreshedSlots, refreshedEvents, refreshedHostels] = await Promise.all([
          adminRepository.getAuditLogs(),
          timetableRepository.getOfficialSlots(user.group || 'MCA DS 1A', user.activeTermId),
          calendarRepository.getEvents(user.id),
          hostelRepository.getHostels()
        ]);
        setAuditLogs(updatedLogs);
        setTimetableSlots(refreshedSlots);
        setCalendarEvents(refreshedEvents);
        setHostels(refreshedHostels);
        addToast('Master Data Published', `Changes to ${entity} committed to database and recorded in audit ledger.`, 'success');
        refreshSyncStatus();
      } else {
        addToast('Publish Failed', `Could not publish master records for ${entity}.`, 'error');
      }
    },
    [isAdmin, user, addToast, refreshSyncStatus]
  );

  const adminRevertAuditLog = useCallback(
    async (logId: string) => {
      if (!isAdmin || !user) return;
      const success = await adminRepository.revertAuditLog(user.grNumber, logId);
      if (success) {
        const [updatedLogs, refreshedSlots, refreshedEvents, refreshedHostels] = await Promise.all([
          adminRepository.getAuditLogs(),
          timetableRepository.getOfficialSlots(user.group || 'MCA DS 1A', user.activeTermId),
          calendarRepository.getEvents(user.id),
          hostelRepository.getHostels()
        ]);
        setAuditLogs(updatedLogs);
        setTimetableSlots(refreshedSlots);
        setCalendarEvents(refreshedEvents);
        setHostels(refreshedHostels);
        addToast('Entity Restored', 'Reversal completed. Master record restored to prior state.', 'info');
        refreshSyncStatus();
      } else {
        addToast('Revert Failed', 'Could not restore entity from audit ledger.', 'error');
      }
    },
    [isAdmin, user, addToast, refreshSyncStatus]
  );

  // Real Manual Sync trigger
  const triggerManualSync = useCallback(async () => {
    setSyncState('syncing');
    try {
      const res = await syncRepository.processQueue();
      await refreshSyncStatus();
      if (res.processed > 0) {
        addToast('Synchronized', `${res.processed} change(s) synchronized to cloud.`, 'success');
      } else {
        addToast('Up to Date', 'All records are in sync.', 'info');
      }
    } catch (err: any) {
      setSyncState('error');
      addToast('Sync Error', err.message || 'Could not sync queue.', 'warning');
    }
  }, [addToast, refreshSyncStatus]);

  // Conflict Resolution
  const resolveConflict = useCallback(
    async (conflictId: string, resolution: 'client' | 'server' | 'merge', mergedPayload?: any) => {
      await syncRepository.resolveConflict(conflictId, resolution, mergedPayload);
      setConflicts(prev => prev.filter(c => c.id !== conflictId));
      addToast('Conflict Resolved', `Resolved with ${resolution} version.`, 'success');
      await refreshSyncStatus();
    },
    [addToast, refreshSyncStatus]
  );

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        timetableSlots,
        overrides,
        saveTimetableOverride,
        deleteTimetableOverride,
        restoreOfficialRoutine,
        selectedDate,
        setSelectedDate,
        todayClasses,
        selectedDateClasses,
        attendanceRecords,
        markAttendance,
        analytics,
        tasks,
        addTask,
        updateTask,
        deleteTask,
        toggleTaskComplete,
        calendarEvents,
        addCalendarEvent,
        deleteCalendarEvent,
        hostels,
        selectedHostel,
        requestHostelGlobal,
        campusBlocks,
        updateCampusBlock,
        customMealRoutine,
        updateCustomMealDay,
        notifications,
        notifSettings,
        updateNotifSettings,
        addToast,
        clearNotifications,
        toasts,
        removeToast,
        auditLogs,
        adminPublishMasterData,
        adminRevertAuditLog,
        syncState,
        triggerManualSync,
        conflicts,
        resolveConflict,
        legacyMigration,
        runLegacyMigration,
        dismissLegacyMigration
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
