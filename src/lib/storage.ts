import {
  UserProfile,
  TimetableSlot,
  TimetableOverride,
  CalendarEvent,
  AttendanceRecord,
  TaskItem,
  NotificationItem,
  NotificationSettings,
  DeviceSession,
  AuditLogEntry,
  HostelInfo
} from '../types';
import {
  OFFICIAL_TIMETABLE_SLOTS,
  OFFICIAL_ACADEMIC_CALENDAR,
  OFFICIAL_HOSTELS
} from '../data/masterData';
import { generateGR118748HistoricalAttendance } from '../data/gr118748Attendance';

const STORAGE_KEYS = {
  CURRENT_USER: 'workspace_current_user',
  USERS_STORE: 'workspace_registered_users',
  ACTIVE_DEVICES: 'workspace_active_devices',
  TIMETABLE_SLOTS: 'workspace_timetable_slots',
  TIMETABLE_OVERRIDES: 'workspace_timetable_overrides',
  ATTENDANCE_RECORDS: 'workspace_attendance_records',
  CALENDAR_EVENTS: 'workspace_calendar_events',
  TASKS: 'workspace_tasks',
  NOTIFICATIONS: 'workspace_notifications',
  NOTIF_SETTINGS: 'workspace_notif_settings',
  AUDIT_LOGS: 'workspace_audit_logs',
  HOSTEL_DATA: 'workspace_hostel_data',
  PENDING_MUTATIONS: 'workspace_pending_sync_queue'
};

export const DEFAULT_NOTIF_SETTINGS: NotificationSettings = {
  classes: { upcoming: true, upcomingMinutes: 10, atStart: true },
  tasks: { enabled: true, daysBefore: 1 },
  exams: { enabled: true, daysBefore: 1 },
  meals: { enabled: true, minutesBefore: 15 },
  laundry: { enabled: true, minutesBefore: 30 }
};

class StorageRepository {
  private getItem<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Failed to write to localStorage', e);
    }
  }

  // --- USERS & AUTH ---
  getUsers(): Record<string, { profile: UserProfile }> {
    return this.getItem<Record<string, { profile: UserProfile }>>(
      STORAGE_KEYS.USERS_STORE,
      {}
    );
  }

  saveUser(profile: UserProfile): void {
    const users = this.getUsers();
    users[profile.grNumber] = { profile };
    this.setItem(STORAGE_KEYS.USERS_STORE, users);
  }

  getCurrentUser(): UserProfile | null {
    return this.getItem<UserProfile | null>(STORAGE_KEYS.CURRENT_USER, null);
  }

  setCurrentUser(user: UserProfile | null): void {
    this.setItem(STORAGE_KEYS.CURRENT_USER, user);
  }

  // --- ACTIVE DEVICES (Limit 3) ---
  getActiveDevices(userId: string): DeviceSession[] {
    const all = this.getItem<Record<string, DeviceSession[]>>(STORAGE_KEYS.ACTIVE_DEVICES, {});
    return all[userId] || [
      {
        id: 'dev-1-primary',
        userId,
        deviceName: 'Primary Browser (Chrome)',
        deviceType: 'desktop',
        lastActive: new Date().toISOString(),
        isCurrent: true
      }
    ];
  }

  saveActiveDevices(userId: string, devices: DeviceSession[]): void {
    const all = this.getItem<Record<string, DeviceSession[]>>(STORAGE_KEYS.ACTIVE_DEVICES, {});
    all[userId] = devices;
    this.setItem(STORAGE_KEYS.ACTIVE_DEVICES, all);
  }

  // --- TIMETABLE ---
  getTimetableSlots(): TimetableSlot[] {
    const stored = this.getItem<TimetableSlot[] | null>(STORAGE_KEYS.TIMETABLE_SLOTS, null);
    // Upgrade if missing Monday slots or if stored count is less than official slots
    if (!stored || stored.length < OFFICIAL_TIMETABLE_SLOTS.length || !stored.some(s => s.day === 1)) {
      this.setItem(STORAGE_KEYS.TIMETABLE_SLOTS, OFFICIAL_TIMETABLE_SLOTS);
      return OFFICIAL_TIMETABLE_SLOTS;
    }
    return stored;
  }

  saveTimetableSlots(slots: TimetableSlot[]): void {
    this.setItem(STORAGE_KEYS.TIMETABLE_SLOTS, slots);
  }

  getTimetableOverrides(userId: string): TimetableOverride[] {
    const all = this.getItem<Record<string, TimetableOverride[]>>(STORAGE_KEYS.TIMETABLE_OVERRIDES, {});
    return all[userId] || [];
  }

  saveTimetableOverrides(userId: string, overrides: TimetableOverride[]): void {
    const all = this.getItem<Record<string, TimetableOverride[]>>(STORAGE_KEYS.TIMETABLE_OVERRIDES, {});
    all[userId] = overrides;
    this.setItem(STORAGE_KEYS.TIMETABLE_OVERRIDES, all);
  }

  // --- ATTENDANCE RECORDS ---
  getAttendanceRecords(userId: string, userGr: string): Record<string, AttendanceRecord> {
    const all = this.getItem<Record<string, Record<string, AttendanceRecord>>>(STORAGE_KEYS.ATTENDANCE_RECORDS, {});
    
    // If no records for GR 118748, seed official historical records
    if (!all[userId] && userGr === '118748') {
      const historicalList = generateGR118748HistoricalAttendance(userId);
      const dict: Record<string, AttendanceRecord> = {};
      historicalList.forEach(r => {
        dict[r.occurrenceKey] = r;
      });
      all[userId] = dict;
      this.setItem(STORAGE_KEYS.ATTENDANCE_RECORDS, all);
      return dict;
    }

    return all[userId] || {};
  }

  saveAttendanceRecord(userId: string, record: AttendanceRecord): void {
    const all = this.getItem<Record<string, Record<string, AttendanceRecord>>>(STORAGE_KEYS.ATTENDANCE_RECORDS, {});
    if (!all[userId]) all[userId] = {};
    all[userId][record.occurrenceKey] = record;
    this.setItem(STORAGE_KEYS.ATTENDANCE_RECORDS, all);
  }

  removeAttendanceRecord(userId: string, occurrenceKey: string): void {
    const all = this.getItem<Record<string, Record<string, AttendanceRecord>>>(STORAGE_KEYS.ATTENDANCE_RECORDS, {});
    if (all[userId] && all[userId][occurrenceKey]) {
      delete all[userId][occurrenceKey];
      this.setItem(STORAGE_KEYS.ATTENDANCE_RECORDS, all);
    }
  }

  // --- CALENDAR EVENTS ---
  getCalendarEvents(userId: string): CalendarEvent[] {
    const official = this.getItem<CalendarEvent[]>(STORAGE_KEYS.CALENDAR_EVENTS, OFFICIAL_ACADEMIC_CALENDAR);
    const personalKey = `${STORAGE_KEYS.CALENDAR_EVENTS}_user_${userId}`;
    const personal = this.getItem<CalendarEvent[]>(personalKey, []);
    return [...official, ...personal];
  }

  savePersonalCalendarEvents(userId: string, events: CalendarEvent[]): void {
    const personalKey = `${STORAGE_KEYS.CALENDAR_EVENTS}_user_${userId}`;
    this.setItem(personalKey, events);
  }

  saveOfficialCalendarEvents(events: CalendarEvent[]): void {
    this.setItem(STORAGE_KEYS.CALENDAR_EVENTS, events);
  }

  // --- TASKS ---
  getTasks(userId: string): TaskItem[] {
    const all = this.getItem<Record<string, TaskItem[]>>(STORAGE_KEYS.TASKS, {});
    if (!all[userId]) {
      all[userId] = [
        {
          id: 'task-1-default',
          userId,
          courseCode: 'MCA110226',
          title: 'Advanced Python OOP & Generators Problem Sheet',
          description: 'Complete questions 1 to 10 from Module 1 handout.',
          dueDate: '2026-09-15',
          priority: 'HIGH',
          status: 'TODO',
          updatedAt: new Date().toISOString()
        },
        {
          id: 'task-2-default',
          userId,
          courseCode: 'MCA110726',
          title: 'Relational Database ER Diagram Assignment',
          dueDate: '2026-09-18',
          priority: 'MEDIUM',
          status: 'TODO',
          updatedAt: new Date().toISOString()
        }
      ];
      this.setItem(STORAGE_KEYS.TASKS, all);
    }
    return all[userId] || [];
  }

  saveTasks(userId: string, tasks: TaskItem[]): void {
    const all = this.getItem<Record<string, TaskItem[]>>(STORAGE_KEYS.TASKS, {});
    all[userId] = tasks;
    this.setItem(STORAGE_KEYS.TASKS, all);
  }

  // --- NOTIFICATIONS & SETTINGS ---
  getNotifications(userId: string): NotificationItem[] {
    const all = this.getItem<Record<string, NotificationItem[]>>(STORAGE_KEYS.NOTIFICATIONS, {});
    return all[userId] || [];
  }

  saveNotifications(userId: string, notifs: NotificationItem[]): void {
    const all = this.getItem<Record<string, NotificationItem[]>>(STORAGE_KEYS.NOTIFICATIONS, {});
    all[userId] = notifs;
    this.setItem(STORAGE_KEYS.NOTIFICATIONS, all);
  }

  getNotificationSettings(userId: string): NotificationSettings {
    const all = this.getItem<Record<string, NotificationSettings>>(STORAGE_KEYS.NOTIF_SETTINGS, {});
    return all[userId] || DEFAULT_NOTIF_SETTINGS;
  }

  saveNotificationSettings(userId: string, settings: NotificationSettings): void {
    const all = this.getItem<Record<string, NotificationSettings>>(STORAGE_KEYS.NOTIF_SETTINGS, {});
    all[userId] = settings;
    this.setItem(STORAGE_KEYS.NOTIF_SETTINGS, all);
  }

  // --- HOSTEL MASTER DATA & OVERRIDES ---
  getHostels(): HostelInfo[] {
    return this.getItem<HostelInfo[]>(STORAGE_KEYS.HOSTEL_DATA, OFFICIAL_HOSTELS);
  }

  saveHostels(hostels: HostelInfo[]): void {
    this.setItem(STORAGE_KEYS.HOSTEL_DATA, hostels);
  }

  // --- AUDIT LOGS ---
  getAuditLogs(): AuditLogEntry[] {
    return this.getItem<AuditLogEntry[]>(STORAGE_KEYS.AUDIT_LOGS, []);
  }

  addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    const logs = this.getAuditLogs();
    const newEntry: AuditLogEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString()
    };
    logs.unshift(newEntry);
    this.setItem(STORAGE_KEYS.AUDIT_LOGS, logs.slice(0, 500)); // retain 500 recent records
  }

  // --- EXPORT FUNCTIONALITY ---
  exportUserDataJson(userId: string): string {
    const user = this.getCurrentUser();
    const attendance = this.getAttendanceRecords(userId, user?.grNumber || '');
    const tasks = this.getTasks(userId);
    const overrides = this.getTimetableOverrides(userId);
    const notifs = this.getNotifications(userId);
    const settings = this.getNotificationSettings(userId);

    const payload = {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      user,
      attendance,
      tasks,
      timetableOverrides: overrides,
      notifications: notifs,
      notificationSettings: settings
    };

    return JSON.stringify(payload, null, 2);
  }

  exportAttendanceCsv(userId: string, userGr: string): string {
    const records = Object.values(this.getAttendanceRecords(userId, userGr));
    const headers = ['Date', 'Course Code', 'Start Time (Min)', 'Status', 'Logged Mode', 'Last Updated'];
    const rows = records.map(r => [
      r.dateStr,
      r.courseCode,
      r.startTime,
      r.status.toUpperCase(),
      r.source,
      r.updatedAt
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  exportTasksCsv(userId: string): string {
    const tasks = this.getTasks(userId);
    const headers = ['Task ID', 'Course Code', 'Title', 'Due Date', 'Priority', 'Status'];
    const rows = tasks.map(t => [
      t.id,
      t.courseCode,
      `"${t.title.replace(/"/g, '""')}"`,
      t.dueDate,
      t.priority,
      t.status
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
}

export const Storage = new StorageRepository();
