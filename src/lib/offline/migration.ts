import { offlineDB } from './db';
import { syncRepository } from '../repository/syncRepository';

export interface LegacyMigrationSummary {
  hasLegacyData: boolean;
  attendanceCount: number;
  tasksCount: number;
  overridesCount: number;
}

export class LocalStorageMigration {
  private MIGRATION_DONE_KEY = 'workspace_localstorage_migrated_v1';

  checkLegacyData(): LegacyMigrationSummary {
    if (localStorage.getItem(this.MIGRATION_DONE_KEY) === 'true') {
      return { hasLegacyData: false, attendanceCount: 0, tasksCount: 0, overridesCount: 0 };
    }

    let attendanceCount = 0;
    let tasksCount = 0;
    let overridesCount = 0;

    try {
      const attData = localStorage.getItem('workspace_attendance_records');
      if (attData) {
        const parsed = JSON.parse(attData);
        for (const userRecords of Object.values(parsed)) {
          if (typeof userRecords === 'object' && userRecords !== null) {
            attendanceCount += Object.keys(userRecords).length;
          }
        }
      }

      const taskData = localStorage.getItem('workspace_tasks');
      if (taskData) {
        const parsed = JSON.parse(taskData);
        for (const userTasks of Object.values(parsed)) {
          if (Array.isArray(userTasks)) {
            tasksCount += userTasks.length;
          }
        }
      }

      const ovrData = localStorage.getItem('workspace_timetable_overrides');
      if (ovrData) {
        const parsed = JSON.parse(ovrData);
        for (const userOvrs of Object.values(parsed)) {
          if (Array.isArray(userOvrs)) {
            overridesCount += userOvrs.length;
          }
        }
      }
    } catch {
      // Ignored
    }

    const hasLegacyData = attendanceCount > 0 || tasksCount > 0 || overridesCount > 0;
    return { hasLegacyData, attendanceCount, tasksCount, overridesCount };
  }

  async migrateLegacyData(currentUserId: string): Promise<{ migratedCount: number }> {
    let migratedCount = 0;

    try {
      // 1. Attendance records
      const attData = localStorage.getItem('workspace_attendance_records');
      if (attData) {
        const parsed = JSON.parse(attData);
        for (const [userId, userRecords] of Object.entries(parsed)) {
          if (typeof userRecords === 'object' && userRecords !== null) {
            for (const record of Object.values(userRecords as any)) {
              const rec = record as any;
              rec.userId = currentUserId;
              await offlineDB.attendanceRecords.put(rec);
              await syncRepository.enqueueMutation({
                userId: currentUserId,
                entityType: 'attendance_record',
                entityId: rec.id,
                operation: 'CREATE',
                payload: rec
              });
              migratedCount++;
            }
          }
        }
      }

      // 2. Tasks
      const taskData = localStorage.getItem('workspace_tasks');
      if (taskData) {
        const parsed = JSON.parse(taskData);
        for (const [userId, userTasks] of Object.entries(parsed)) {
          if (Array.isArray(userTasks)) {
            for (const task of userTasks) {
              task.userId = currentUserId;
              await offlineDB.taskItems.put(task);
              await syncRepository.enqueueMutation({
                userId: currentUserId,
                entityType: 'task',
                entityId: task.id,
                operation: 'CREATE',
                payload: task
              });
              migratedCount++;
            }
          }
        }
      }

      // 3. Overrides
      const ovrData = localStorage.getItem('workspace_timetable_overrides');
      if (ovrData) {
        const parsed = JSON.parse(ovrData);
        for (const [userId, userOvrs] of Object.entries(parsed)) {
          if (Array.isArray(userOvrs)) {
            for (const ovr of userOvrs) {
              ovr.userId = currentUserId;
              await offlineDB.timetableOverrides.put(ovr);
              await syncRepository.enqueueMutation({
                userId: currentUserId,
                entityType: 'timetable_override',
                entityId: ovr.id,
                operation: 'CREATE',
                payload: ovr
              });
              migratedCount++;
            }
          }
        }
      }

      // Mark migration as completed so it won't prompt again
      localStorage.setItem(this.MIGRATION_DONE_KEY, 'true');
    } catch (err) {
      console.error('Migration error:', err);
    }

    return { migratedCount };
  }

  dismissMigration(): void {
    localStorage.setItem(this.MIGRATION_DONE_KEY, 'true');
  }
}

export const localStorageMigration = new LocalStorageMigration();
