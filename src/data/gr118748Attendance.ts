import { AttendanceRecord } from '../types';
import { OFFICIAL_TIMETABLE_SLOTS } from './masterData';

// Historical attendance import from official PDF ONLY for GR 118748
// Dates confirmed from the official PDF import (Jul 29, 2026 - Aug 30, 2026)
const GR_ATTENDANCE_DATES = [
  '2026-07-29', // Wed
  '2026-07-30', // Thu
  '2026-07-31', // Fri
  '2026-08-01', // Sat
  '2026-08-02', // Sun
  '2026-08-05', // Wed
  '2026-08-06', // Thu
  '2026-08-07', // Fri
  '2026-08-08', // Sat
  '2026-08-09', // Sun
  '2026-08-12', // Wed
  '2026-08-13', // Thu
  '2026-08-14', // Fri
  '2026-08-16', // Sun
  '2026-08-19', // Wed
  '2026-08-20', // Thu
  '2026-08-22', // Sat
  '2026-08-23', // Sun
  '2026-08-27', // Thu
  '2026-08-28', // Fri
  '2026-08-29', // Sat
  '2026-08-30'  // Sun
];

export function generateGR118748HistoricalAttendance(userId: string): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];

  for (const dateStr of GR_ATTENDANCE_DATES) {
    const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
    const daySlots = OFFICIAL_TIMETABLE_SLOTS.filter(
      s => s.group === 'MCA DS 1A' && s.day === dayOfWeek && s.courseCode !== 'LUNCH' && s.courseCode !== 'LIBRARY'
    );

    for (const slot of daySlots) {
      const occurrenceKey = `${slot.courseCode}-${dateStr}-${slot.startTime}`;
      records.push({
        id: `att-seed-${userId}-${occurrenceKey}`,
        userId,
        occurrenceKey,
        courseCode: slot.courseCode,
        dateStr,
        startTime: slot.startTime,
        status: 'present',
        source: 'manual', // imported official PDF record
        updatedAt: `${dateStr}T17:00:00.000Z`,
        isSynced: true
      });
    }
  }

  return records;
}
