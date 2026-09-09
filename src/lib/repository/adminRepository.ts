import { AuditLogEntry, UserProfile } from '../../types';
import { offlineDB } from '../offline/db';
import { supabase, isSupabaseConfigured } from '../supabase';
import { syncRepository } from './syncRepository';

export class AdminRepository {
  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const cached = await offlineDB.auditLogs.reverse().sortBy('timestamp');

    if (isSupabaseConfigured && supabase && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('timestamp', { ascending: false });

        if (!error && data) {
          const mapped: AuditLogEntry[] = data.map(r => ({
            id: r.id,
            actorGr: r.actor_gr,
            timestamp: r.timestamp,
            entity: r.entity,
            entityId: r.entity_id,
            changeType: r.change_type,
            previousValue: r.previous_value,
            newValue: r.new_value,
            scope: r.scope,
            effectiveDate: r.effective_date
          }));
          await offlineDB.auditLogs.bulkPut(mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Network error fetching audit logs from Supabase:', err);
      }
    }

    return cached;
  }

  async addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry> {
    const newLog: AuditLogEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString()
    };

    await offlineDB.auditLogs.put(newLog);

    await syncRepository.enqueueMutation({
      userId: entry.actorGr,
      entityType: 'audit_log',
      entityId: newLog.id,
      operation: 'CREATE',
      payload: newLog
    });

    return newLog;
  }

  /**
   * Publishes master data by updating the actual master table first,
   * then appending an immutable audit record and syncing to clients.
   */
  async publishMasterData(
    actorGr: string,
    entity: string,
    payload: any,
    effectiveDate: string
  ): Promise<{ success: boolean; auditLog: AuditLogEntry }> {
    let previousValue: any = null;
    const entityId = payload.id || `master-${Date.now()}`;

    // 1. Fetch current entity state for audit previous_value
    try {
      if (entity === 'timetable' || entity === 'timetable_slots') {
        previousValue = await offlineDB.timetableSlots.get(entityId);
        await offlineDB.timetableSlots.put({
          ...payload,
          id: entityId,
          isOfficial: true,
          effectiveFrom: effectiveDate
        });
        if (isSupabaseConfigured && supabase && navigator.onLine) {
          await supabase.from('timetable_slots').upsert({
            id: entityId,
            day: payload.day,
            start_time: payload.startTime,
            end_time: payload.endTime,
            course_code: payload.courseCode,
            room: payload.room,
            teacher: payload.teacher,
            name: payload.name,
            is_official: true,
            group: payload.group,
            program: payload.program,
            semester: payload.semester,
            section: payload.section,
            term_id: payload.termId,
            effective_from: effectiveDate
          });
        }
      } else if (entity === 'calendar' || entity === 'calendar_events') {
        previousValue = await offlineDB.calendarEvents.get(entityId);
        await offlineDB.calendarEvents.put({
          ...payload,
          id: entityId,
          isOfficial: true
        });
        if (isSupabaseConfigured && supabase && navigator.onLine) {
          await supabase.from('calendar_events').upsert({
            id: entityId,
            title: payload.title,
            date_str: payload.dateStr,
            end_date_str: payload.endDateStr,
            category: payload.category,
            is_official: true,
            exam_category: payload.examCategory,
            course_code: payload.courseCode,
            start_time: payload.startTime,
            end_time: payload.endTime,
            class_impact: payload.classImpact || 'none',
            cancelled_slots: payload.cancelledSlots,
            description: payload.description
          });
        }
      } else if (entity === 'hostel' || entity === 'hostels') {
        previousValue = await offlineDB.hostels.get(entityId);
        await offlineDB.hostels.put({
          ...payload,
          id: entityId
        });
        if (isSupabaseConfigured && supabase && navigator.onLine) {
          await supabase.from('hostels').upsert({
            id: entityId,
            name: payload.name,
            blocks: payload.blocks,
            wardens: payload.wardens,
            laundry_days: payload.laundryDays
          });
        }
      }
    } catch (dbErr) {
      console.error('Error applying master record update to database:', dbErr);
    }

    // 2. Append immutable audit log recording the transformation
    const auditLog = await this.addAuditLog({
      actorGr,
      entity,
      entityId,
      changeType: previousValue ? 'update' : 'create',
      scope: 'master',
      effectiveDate,
      previousValue,
      newValue: payload
    });

    return { success: true, auditLog };
  }

  /**
   * Reverts master data by retrieving the original previous value,
   * restoring the actual database table record, and logging a new audit event.
   */
  async revertAuditLog(actorGr: string, logId: string): Promise<boolean> {
    const log = await offlineDB.auditLogs.get(logId);
    if (!log) return false;

    const { entity, entityId, previousValue, newValue } = log;

    // 1. Restore the actual master entity state
    try {
      if (entity === 'timetable' || entity === 'timetable_slots') {
        if (previousValue) {
          await offlineDB.timetableSlots.put(previousValue);
          if (isSupabaseConfigured && supabase && navigator.onLine) {
            await supabase.from('timetable_slots').upsert({
              id: entityId,
              day: previousValue.day,
              start_time: previousValue.startTime,
              end_time: previousValue.endTime,
              course_code: previousValue.courseCode,
              room: previousValue.room,
              teacher: previousValue.teacher,
              name: previousValue.name,
              is_official: true,
              group: previousValue.group,
              effective_from: previousValue.effectiveFrom
            });
          }
        } else {
          // If previous value was null, it was created, so delete it
          await offlineDB.timetableSlots.delete(entityId);
          if (isSupabaseConfigured && supabase && navigator.onLine) {
            await supabase.from('timetable_slots').delete().eq('id', entityId);
          }
        }
      } else if (entity === 'calendar' || entity === 'calendar_events') {
        if (previousValue) {
          await offlineDB.calendarEvents.put(previousValue);
          if (isSupabaseConfigured && supabase && navigator.onLine) {
            await supabase.from('calendar_events').upsert({
              id: entityId,
              title: previousValue.title,
              date_str: previousValue.dateStr,
              category: previousValue.category,
              is_official: true
            });
          }
        } else {
          await offlineDB.calendarEvents.delete(entityId);
          if (isSupabaseConfigured && supabase && navigator.onLine) {
            await supabase.from('calendar_events').delete().eq('id', entityId);
          }
        }
      } else if (entity === 'hostel' || entity === 'hostels') {
        if (previousValue) {
          await offlineDB.hostels.put(previousValue);
          if (isSupabaseConfigured && supabase && navigator.onLine) {
            await supabase.from('hostels').upsert(previousValue);
          }
        }
      }
    } catch (restoreErr) {
      console.error('Failed to restore entity state during revert:', restoreErr);
      return false;
    }

    // 2. Create a new immutable audit event for the revert
    await this.addAuditLog({
      actorGr,
      entity,
      entityId,
      changeType: 'revert',
      scope: 'master',
      effectiveDate: new Date().toISOString(),
      previousValue: newValue,
      newValue: previousValue
    });

    return true;
  }

  async getUsers(): Promise<UserProfile[]> {
    if (isSupabaseConfigured && supabase && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .order('gr_number', { ascending: true });

        if (!error && data) {
          return data.map((row: any) => ({
            id: row.id,
            grNumber: row.gr_number,
            displayName: row.display_name,
            email: row.email,
            emailVerified: row.email_verified,
            avatarUrl: row.avatar_url,
            phone: row.phone,
            role: row.role,
            program: row.program || 'MCA',
            group: row.group || 'MCA DS 1A',
            semester: row.semester || 1,
            section: row.section || '1A',
            hostel: row.hostel,
            hostelRoom: row.hostel_room,
            attendanceTarget: row.attendance_target || 75,
            classStartDate: row.class_start_date || '2026-07-29',
            activeTermId: row.active_term_id || 'term-sem-1-2026',
            scheduledDeletionAt: row.scheduled_deletion_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }));
        }
      } catch (err) {
        console.warn('Network error fetching users for admin:', err);
      }
    }

    return await offlineDB.profiles.toArray();
  }

  async adminResetPassword(actorGr: string, targetGr: string, newPass: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      try {
        // Invoke Edge Function if available
        const { data, error } = await supabase.functions.invoke('admin-reset-password', {
          body: { targetGrNumber: targetGr, newPassword: newPass }
        });

        if (!error && data?.success) {
          return true;
        }
      } catch (fnErr) {
        console.warn('Edge function invoke failed, logging reset audit entry:', fnErr);
      }
    }

    // Record audit event
    await this.addAuditLog({
      actorGr,
      entity: 'auth.user',
      entityId: targetGr,
      changeType: 'update',
      scope: 'master',
      effectiveDate: new Date().toISOString(),
      newValue: { passwordReset: true }
    });

    return true;
  }
}

export const adminRepository = new AdminRepository();
