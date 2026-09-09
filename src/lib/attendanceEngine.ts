import {
  TimetableSlot,
  TimetableOverride,
  CalendarEvent,
  ResolvedClassOccurrence,
  AttendanceRecord,
  ClassStatus,
  AcademicScope
} from '../types';
import { OFFICIAL_SUBJECTS, COURSE_CODE_SHORTCUTS, getSubjectsForAcademicGroup } from '../data/masterData';
import { getSlotPeriodWeight, timeStringToMinutes } from './timeUtils';

export interface AttendanceAnalytics {
  totalHeldPeriods: number;
  totalPresentPeriods: number;
  totalAbsentPeriods: number;
  overallPercentage: number;
  isTargetMet: boolean;
  safeToMiss: number;
  classesNeeded: number;
  theoryStats: { held: number; present: number; percentage: number };
  labStats: { held: number; present: number; percentage: number };
  subjectWise: Record<
    string,
    {
      code: string;
      title: string;
      abbr: string;
      teacher: string;
      held: number;
      present: number;
      absent: number;
      percentage: number;
      isTargetMet: boolean;
      type: string;
    }
  >;
  bestSubject?: { title: string; percentage: number };
  worstSubject?: { title: string; percentage: number };
}

/**
 * Checks if a calendar event is an applicable exam for the given academic scope.
 * An exam for another academic group/section must not cancel this user's classes.
 */
export function isExamApplicable(
  event: CalendarEvent,
  scope?: AcademicScope,
  groupSlots?: TimetableSlot[]
): boolean {
  if (event.category !== 'exam') return false;

  // Personal user exam
  if (event.userId && scope?.userId && event.userId !== scope.userId) {
    return false;
  }

  // Academic group filter
  if (event.group && scope?.group && event.group !== scope.group) {
    return false;
  }

  // Program filter
  if (event.program && scope?.program && event.program !== scope.program) {
    return false;
  }

  // Semester filter
  if (event.semester && scope?.semester && event.semester !== scope.semester) {
    return false;
  }

  // Section filter
  if (event.section && scope?.section && event.section !== scope.section) {
    return false;
  }

  // If exam has courseCode, verify it matches subjects in this group's schedule
  if (event.courseCode && groupSlots && groupSlots.length > 0) {
    const isSubjectInGroup = groupSlots.some(s => s.courseCode === event.courseCode);
    if (!isSubjectInGroup && !event.isOfficial && !event.group) {
      return false;
    }
  }

  return true;
}

/**
 * Finds an applicable exam for a specific date given calendar events and academic scope.
 */
export function getExamForDate(
  dateStr: string,
  events: CalendarEvent[],
  scope?: AcademicScope,
  groupSlots?: TimetableSlot[]
): CalendarEvent | undefined {
  return events.find(e => {
    const inRange = e.endDateStr ? (dateStr >= e.dateStr && dateStr <= e.endDateStr) : (e.dateStr === dateStr);
    if (!inRange) return false;
    return isExamApplicable(e, scope, groupSlots);
  });
}

/**
 * Resolves all class occurrences for a given date by combining:
 * Official Timetable + Personal Overrides + Calendar Events (Holidays/Exams/Cancellations)
 *
 * Precedence Rule (Requirement 10):
 * 1. Full Holiday (cancel_all)
 * 2. Exam Day (entire day's classes cancelled for group; exam occurrence active)
 * 3. Partial Holiday (cancel_partial)
 * 4. Class Cancellation Override
 * 5. Regular Timetable
 */
export function resolveClassesForDate(
  dateStr: string,
  officialSlots: TimetableSlot[],
  overrides: TimetableOverride[],
  events: CalendarEvent[],
  attendanceRecords: Record<string, AttendanceRecord>,
  userClassStartDate?: string,
  userScope?: AcademicScope
): ResolvedClassOccurrence[] {
  // If date is prior to user's class start date, no classes were tracked for this user
  if (userClassStartDate && dateStr < userClassStartDate) {
    return [];
  }

  const dateObj = new Date(`${dateStr}T00:00:00`);
  const dayOfWeek = dateObj.getDay();

  // Filter events active on this date
  const dayEvents = events.filter(e => {
    if (e.endDateStr) {
      return dateStr >= e.dateStr && dateStr <= e.endDateStr;
    }
    return e.dateStr === dateStr;
  });

  // 1. Full Holiday
  const fullHoliday = dayEvents.find(e => e.category === 'holiday' && e.classImpact === 'cancel_all');

  // 2. Exam Day Resolver (Authoritative across all systems)
  const applicableExam = getExamForDate(dateStr, dayEvents, userScope, officialSlots);

  // 3. Partial Holiday
  const partialHolidays = dayEvents.filter(e => e.classImpact === 'cancel_partial');

  // Base slots for this day of week
  const baseSlots = officialSlots.filter(s => s.day === dayOfWeek);

  // Overrides applicable for this date
  const applicableOverrides = overrides.filter(ov => {
    if (!ov.isActive) return false;
    if (ov.scope === 'this_occurrence') {
      return ov.dateStr === dateStr;
    }
    if (ov.scope === 'future_recurring') {
      return ov.day === dayOfWeek && (!ov.effectiveFrom || dateStr >= ov.effectiveFrom);
    }
    return false;
  });

  const resolved: ResolvedClassOccurrence[] = [];

  for (const slot of baseSlots) {
    // Skip Lunch break or general breaks from attendance
    if (slot.courseCode === 'LUNCH') continue;

    // Check if overridden
    const override = applicableOverrides.find(ov => ov.originalSlotId === slot.id);
    if (override && override.overrideType === 'cancel') {
      continue;
    }

    const effectiveSlot = override ? {
      ...slot,
      courseCode: override.courseCode,
      startTime: override.startTime,
      endTime: override.endTime,
      room: override.room,
      teacher: override.teacher || slot.teacher,
      isOfficial: false
    } : slot;

    const courseMeta = OFFICIAL_SUBJECTS[effectiveSlot.courseCode];
    const courseTitle = effectiveSlot.name || courseMeta?.title || effectiveSlot.courseCode;
    const isLab = courseMeta?.type === 'Lab' || effectiveSlot.courseCode.includes('Lab') || effectiveSlot.courseCode === 'BDIJ';
    const periodWeight = getSlotPeriodWeight(effectiveSlot.startTime, effectiveSlot.endTime);
    const occurrenceKey = `${effectiveSlot.courseCode}-${dateStr}-${effectiveSlot.startTime}`;

    // Determine Status according to deterministic priority:
    let status: ClassStatus = 'scheduled';
    let statusNote: string | undefined = undefined;

    if (fullHoliday) {
      status = 'holiday';
      statusNote = fullHoliday.title;
    } else if (applicableExam) {
      // EXAM DAY: The entire day's regular classes are cancelled.
      // Contributes 0 held periods, 0 absent periods, 0 attendance penalty.
      status = 'cancelled';
      statusNote = `Exam Day — ${applicableExam.title}`;
    } else {
      // Check partial holiday cancellation
      const isPartiallyCancelled = partialHolidays.some(ph => {
        return ph.cancelledSlots?.some(cs =>
          cs.courseCode === effectiveSlot.courseCode && cs.startTime === effectiveSlot.startTime
        );
      });

      if (isPartiallyCancelled) {
        status = 'partial_holiday';
        statusNote = 'Period Suspended';
      }
    }

    // Check existing attendance record (only valid if not holiday/exam day)
    const attRecord = status === 'scheduled'
      ? attendanceRecords[occurrenceKey]
      : undefined;

    resolved.push({
      occurrenceKey,
      dateStr,
      dayOfWeek,
      startTime: effectiveSlot.startTime,
      endTime: effectiveSlot.endTime,
      courseCode: effectiveSlot.courseCode,
      courseTitle,
      room: effectiveSlot.room,
      teacher: effectiveSlot.teacher || courseMeta?.teacher || 'Faculty',
      isLab,
      periodWeight,
      status,
      statusNote,
      isOfficial: effectiveSlot.isOfficial,
      attendanceStatus: attRecord ? attRecord.status : null
    });
  }

  // If this date is an Exam Day, append the active Exam occurrence
  if (applicableExam && !fullHoliday) {
    const examStartMin = applicableExam.startTime ? timeStringToMinutes(applicableExam.startTime) : 600; // 10:00 AM
    const examEndMin = applicableExam.endTime ? timeStringToMinutes(applicableExam.endTime) : 690; // 11:30 AM
    const examCourseMeta = applicableExam.courseCode ? OFFICIAL_SUBJECTS[applicableExam.courseCode] : undefined;
    const examRoom = applicableExam.description || (examCourseMeta?.room ? examCourseMeta.room.split('/')[0].trim() : 'Examination Hall');

    resolved.push({
      occurrenceKey: `exam-${applicableExam.id}-${dateStr}`,
      dateStr,
      dayOfWeek,
      startTime: examStartMin,
      endTime: examEndMin,
      courseCode: applicableExam.courseCode || 'EXAM',
      courseTitle: applicableExam.title,
      room: examRoom,
      teacher: 'Exam Invigilator',
      isLab: false,
      periodWeight: 0, // 0 attendance weight
      status: 'exam',
      statusNote: applicableExam.examCategory ? `${applicableExam.examCategory} Exam` : 'Exam Day',
      isOfficial: applicableExam.isOfficial,
      attendanceStatus: null
    });
  }

  // Also include custom classes created as new occurrences (unless full holiday or exam day)
  if (!fullHoliday && !applicableExam) {
    const customClasses = applicableOverrides.filter(ov => ov.overrideType === 'custom_class' && !ov.originalSlotId);
    for (const cc of customClasses) {
      const courseMeta = OFFICIAL_SUBJECTS[cc.courseCode];
      const occurrenceKey = `${cc.courseCode}-${dateStr}-${cc.startTime}`;
      const periodWeight = getSlotPeriodWeight(cc.startTime, cc.endTime);
      const attRecord = attendanceRecords[occurrenceKey];

      resolved.push({
        occurrenceKey,
        dateStr,
        dayOfWeek,
        startTime: cc.startTime,
        endTime: cc.endTime,
        courseCode: cc.courseCode,
        courseTitle: courseMeta?.title || cc.courseCode,
        room: cc.room,
        teacher: cc.teacher || courseMeta?.teacher || 'Faculty',
        isLab: courseMeta?.type === 'Lab',
        periodWeight,
        status: 'scheduled',
        isOfficial: false,
        attendanceStatus: attRecord ? attRecord.status : null
      });
    }
  }

  return resolved.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Central Attendance Analytics Engine
 * Calculates Held vs Present, Target projections, Theory/Lab split, and course metrics
 */
export function calculateAttendanceAnalytics(
  resolvedClassesHistory: ResolvedClassOccurrence[],
  targetPercentage: number = 75,
  groupScope?: string
): AttendanceAnalytics {
  let totalHeldPeriods = 0;
  let totalPresentPeriods = 0;
  let totalAbsentPeriods = 0;

  let theoryHeld = 0;
  let theoryPresent = 0;
  let labHeld = 0;
  let labPresent = 0;

  const subjectWise: AttendanceAnalytics['subjectWise'] = {};

  // Dynamically derive subjects from the academic group scope (Section 5)
  const scopedSubjects = groupScope ? getSubjectsForAcademicGroup(groupScope) : Object.values(OFFICIAL_SUBJECTS);

  // Initialize all relevant academic subjects belonging to the selected group/term
  scopedSubjects.forEach(sub => {
    subjectWise[sub.code] = {
      code: sub.code,
      title: sub.title,
      abbr: COURSE_CODE_SHORTCUTS[sub.code] || sub.code,
      teacher: sub.teacher,
      held: 0,
      present: 0,
      absent: 0,
      percentage: 0,
      isTargetMet: true,
      type: sub.type
    };
  });

  for (const occurrence of resolvedClassesHistory) {
    // Classes that were holidays, exam days, cancelled, or not held DO NOT count
    if (
      occurrence.status === 'holiday' ||
      occurrence.status === 'cancelled' ||
      occurrence.status === 'partial_holiday' ||
      occurrence.status === 'exam'
    ) {
      continue;
    }

    // Only count if an attendance status was recorded (held class)
    if (occurrence.attendanceStatus === 'present' || occurrence.attendanceStatus === 'absent') {
      const weight = occurrence.periodWeight;
      totalHeldPeriods += weight;

      if (!subjectWise[occurrence.courseCode]) {
        subjectWise[occurrence.courseCode] = {
          code: occurrence.courseCode,
          title: occurrence.courseTitle,
          abbr: COURSE_CODE_SHORTCUTS[occurrence.courseCode] || occurrence.courseCode,
          teacher: occurrence.teacher,
          held: 0,
          present: 0,
          absent: 0,
          percentage: 0,
          isTargetMet: true,
          type: occurrence.isLab ? 'Lab' : 'Theory'
        };
      }

      subjectWise[occurrence.courseCode].held += weight;

      if (occurrence.isLab) {
        labHeld += weight;
      } else {
        theoryHeld += weight;
      }

      if (occurrence.attendanceStatus === 'present') {
        totalPresentPeriods += weight;
        subjectWise[occurrence.courseCode].present += weight;
        if (occurrence.isLab) labPresent += weight;
        else theoryPresent += weight;
      } else {
        totalAbsentPeriods += weight;
        subjectWise[occurrence.courseCode].absent += weight;
      }
    }
  }

  // Calculate percentages
  const overallPercentage = totalHeldPeriods === 0 ? 0 : Math.round((totalPresentPeriods / totalHeldPeriods) * 1000) / 10;
  const isTargetMet = totalHeldPeriods === 0 ? true : (overallPercentage >= targetPercentage);

  let safeToMiss = 0;
  let classesNeeded = 0;
  const targetRatio = targetPercentage / 100;

  if (totalHeldPeriods > 0) {
    if (isTargetMet) {
      safeToMiss = Math.max(0, Math.floor((totalPresentPeriods - (targetRatio * totalHeldPeriods)) / targetRatio));
    } else {
      classesNeeded = Math.max(0, Math.ceil(((targetRatio * totalHeldPeriods) - totalPresentPeriods) / (1 - targetRatio)));
    }
  }

  const activeSubjects = Object.values(subjectWise)
    .filter(s => s.held > 0)
    .map(s => {
      s.percentage = Math.round((s.present / s.held) * 1000) / 10;
      s.isTargetMet = s.percentage >= targetPercentage;
      return s;
    })
    .sort((a, b) => a.percentage - b.percentage);

  const bestSubject = activeSubjects.length > 0 ? {
    title: `${activeSubjects[activeSubjects.length - 1].abbr} (${activeSubjects[activeSubjects.length - 1].percentage}%)`,
    percentage: activeSubjects[activeSubjects.length - 1].percentage
  } : undefined;

  const worstSubject = activeSubjects.length > 0 ? {
    title: `${activeSubjects[0].abbr} (${activeSubjects[0].percentage}%)`,
    percentage: activeSubjects[0].percentage
  } : undefined;

  return {
    totalHeldPeriods,
    totalPresentPeriods,
    totalAbsentPeriods,
    overallPercentage,
    isTargetMet,
    safeToMiss,
    classesNeeded,
    theoryStats: {
      held: theoryHeld,
      present: theoryPresent,
      percentage: theoryHeld === 0 ? 0 : Math.round((theoryPresent / theoryHeld) * 1000) / 10
    },
    labStats: {
      held: labHeld,
      present: labPresent,
      percentage: labHeld === 0 ? 0 : Math.round((labPresent / labHeld) * 1000) / 10
    },
    subjectWise,
    bestSubject,
    worstSubject
  };
}
