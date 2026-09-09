import Dexie, { Table } from 'dexie';
import {
  UserProfile,
  TimetableSlot,
  TimetableOverride,
  AttendanceRecord,
  CalendarEvent,
  TaskItem,
  HostelInfo,
  NotificationItem,
  NotificationSettings,
  DeviceSession,
  AuditLogEntry
} from '../../types';

export interface SyncQueueItem {
  id: string;
  userId: string;
  entityType:
    | 'profile'
    | 'timetable_override'
    | 'attendance_record'
    | 'task'
    | 'calendar_event'
    | 'hostel'
    | 'device'
    | 'audit_log'
    | 'notification_settings'
    | 'master_data';
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  createdAt: string;
  updatedAt: string;
  attemptCount: number;
  maxRetries?: number;
  nextRetryAt?: string;
  lastError?: string;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'PERMANENTLY_FAILED' | 'CONFLICT';
  clientVersion?: number;
  deviceId?: string;
}

export interface UserNotificationSettingsRecord {
  userId: string;
  settings: NotificationSettings;
  updatedAt: string;
}

export interface SyncConflictItem {
  id: string;
  userId: string;
  entityType: string;
  entityId: string;
  clientVersion: any;
  serverVersion: any;
  status: 'unresolved' | 'resolved_client' | 'resolved_server' | 'resolved_merged';
  createdAt: string;
}

export class WorkSpaceOfflineDB extends Dexie {
  profiles!: Table<UserProfile, string>;
  timetableSlots!: Table<TimetableSlot, string>;
  timetableOverrides!: Table<TimetableOverride, string>;
  attendanceRecords!: Table<AttendanceRecord, string>;
  calendarEvents!: Table<CalendarEvent, string>;
  taskItems!: Table<TaskItem, string>;
  hostels!: Table<HostelInfo, string>;
  notifications!: Table<NotificationItem, string>;
  deviceSessions!: Table<DeviceSession, string>;
  auditLogs!: Table<AuditLogEntry, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  syncConflicts!: Table<SyncConflictItem, string>;
  userNotificationSettings!: Table<UserNotificationSettingsRecord, string>;

  constructor() {
    super('WorkSpaceAcademicDB');
    this.version(1).stores({
      profiles: 'id, grNumber, role, email',
      timetableSlots: 'id, day, courseCode, group, isOfficial',
      timetableOverrides: 'id, userId, originalSlotId, dateStr, courseCode, isActive',
      attendanceRecords: 'id, userId, occurrenceKey, courseCode, dateStr, status, isSynced',
      calendarEvents: 'id, userId, dateStr, category, isOfficial',
      taskItems: 'id, userId, courseCode, dueDate, priority, status',
      hostels: 'id, name',
      notifications: 'id, type, timestamp',
      deviceSessions: 'id, userId, isCurrent',
      auditLogs: 'id, actorGr, timestamp',
      syncQueue: 'id, userId, entityType, entityId, status, createdAt',
      syncConflicts: 'id, userId, entityType, entityId, status, createdAt'
    });

    this.version(2).stores({
      timetableSlots: 'id, day, courseCode, group, isOfficial'
    }).upgrade(async tx => {
      // 1. Purge obsolete Monday (1) and Tuesday (2) official timetable slots
      await tx.table('timetableSlots').where('day').equals(1).delete();
      await tx.table('timetableSlots').where('day').equals(2).delete();

      // 2. Clean up any auto attendance records inadvertently recorded on Mon/Tue
      const attendance = await tx.table('attendanceRecords').toArray();
      const idsToDelete: string[] = [];
      for (const rec of attendance) {
        if (rec.source === 'auto' && rec.dateStr) {
          const d = new Date(`${rec.dateStr}T00:00:00`).getDay();
          if (d === 1 || d === 2) {
            idsToDelete.push(rec.id);
          }
        }
      }
      if (idsToDelete.length > 0) {
        await tx.table('attendanceRecords').bulkDelete(idsToDelete);
      }
    });

    this.version(3).stores({
      userNotificationSettings: 'userId, updatedAt'
    });
  }
}

export const offlineDB = new WorkSpaceOfflineDB();
