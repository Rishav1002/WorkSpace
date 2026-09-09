import { AttendanceRecord } from '../../types';
import { offlineDB } from '../offline/db';
import { supabase, isSupabaseConfigured } from '../supabase';
import { syncRepository } from './syncRepository';
import { generateGR118748HistoricalAttendance } from '../../data/gr118748Attendance';
import { dateToIso, getCurrentMinutes } from '../timeUtils';

export class AttendanceRepository {
  async getAttendanceRecords(userId: string, grNumber?: string): Promise<Record<string, AttendanceRecord>> {
    const recordMap: Record<string, AttendanceRecord> = {};

    // 1. Read from IndexedDB offline cache
    const cached = await offlineDB.attendanceRecords.where('userId').equals(userId).toArray();
    for (const rec of cached) {
      recordMap[rec.occurrenceKey] = rec;
    }

    // 2. If GR 118748 and no records yet, seed historical attendance
    if (Object.keys(recordMap).length === 0 && grNumber === '118748') {
      const historical = generateGR118748HistoricalAttendance(userId);
      for (const rec of historical) {
        recordMap[rec.occurrenceKey] = rec;
      }
      await offlineDB.attendanceRecords.bulkPut(historical);

      // Queue sync to Supabase if connected
      for (const rec of historical) {
        await syncRepository.enqueueMutation({
          userId,
          entityType: 'attendance_record',
          entityId: rec.id,
          operation: 'CREATE',
          payload: rec
        });
      }
    }

    // 3. If online, fetch latest from Supabase and reconcile
    if (isSupabaseConfigured && supabase && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('user_id', userId);

        if (!error && data) {
          const serverRecords: AttendanceRecord[] = data.map(row => ({
            id: row.id,
            userId: row.user_id,
            occurrenceKey: row.occurrence_key,
            courseCode: row.course_code,
            dateStr: row.date_str,
            startTime: row.start_time,
            status: row.status as 'present' | 'absent',
            source: row.source as 'auto' | 'manual',
            updatedAt: row.updated_at,
            isSynced: true
          }));

          for (const sRec of serverRecords) {
            recordMap[sRec.occurrenceKey] = sRec;
          }
          await offlineDB.attendanceRecords.bulkPut(serverRecords);
        }
      } catch (err) {
        console.warn('Network error fetching attendance from Supabase:', err);
      }
    }

    return recordMap;
  }

  async markAttendance(
    userId: string,
    occurrenceKey: string,
    status: 'present' | 'absent' | null,
    courseCode: string,
    dateStr: string,
    startTime: number,
    source: 'auto' | 'manual' = 'manual'
  ): Promise<AttendanceRecord | null> {
    const recordId = `att-${userId}-${occurrenceKey}`;

    if (status === null) {
      // Remove record
      await offlineDB.attendanceRecords.delete(recordId);
      await syncRepository.enqueueMutation({
        userId,
        entityType: 'attendance_record',
        entityId: recordId,
        operation: 'DELETE',
        payload: { id: recordId, userId, occurrenceKey }
      });
      return null;
    }

    // Production Invariant Checks:
    // 1. Auto attendance can ONLY mark 'present', NEVER 'absent'
    if (source === 'auto' && status !== 'present') {
      return null;
    }

    // 2. Auto attendance must NEVER run on Monday (1) or Tuesday (2) academic weekend
    const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
    if (source === 'auto' && (dayOfWeek === 1 || dayOfWeek === 2)) {
      return null;
    }

    // 3. Auto attendance must NEVER mark future classes
    const todayIso = dateToIso(new Date());
    const currentMins = getCurrentMinutes();
    const isFuture = dateStr > todayIso || (dateStr === todayIso && startTime > currentMins);
    if (source === 'auto' && isFuture) {
      return null;
    }

    // 4. Auto attendance must NEVER overwrite existing manual attendance
    const existing = await offlineDB.attendanceRecords.get(recordId);
    if (existing && existing.source === 'manual' && source === 'auto') {
      return existing;
    }

    const newRecord: AttendanceRecord = {
      id: recordId,
      userId,
      occurrenceKey,
      courseCode,
      dateStr,
      startTime,
      status,
      source,
      updatedAt: new Date().toISOString(),
      isSynced: false
    };

    // Update IndexedDB immediately (optimistic UI)
    await offlineDB.attendanceRecords.put(newRecord);

    // Queue for sync
    await syncRepository.enqueueMutation({
      userId,
      entityType: 'attendance_record',
      entityId: recordId,
      operation: 'CREATE',
      payload: newRecord
    });

    return newRecord;
  }
}

export const attendanceRepository = new AttendanceRepository();
