// src/engine/academicDay.js

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const CANCEL_TYPES = new Set([
  "holiday",
  "partial_holiday",
  "exam",
  "no_class",
]);

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function getDayOfWeek(date) {
  return new Date(`${date}T00:00:00`).getDay();
}

export function getDayName(date) {
  return DAY_NAMES[getDayOfWeek(date)];
}

export function timeToMinutes(value) {
  if (!value) return null;

  const [hours, minutes] = String(value)
    .slice(0, 5)
    .split(":")
    .map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function isFullDayEvent(event) {
  return !event.start_time && !event.end_time;
}

function overlaps(
  classStart,
  classEnd,
  eventStart,
  eventEnd
) {
  // No event time = whole day.
  if (
    eventStart === null ||
    eventEnd === null
  ) {
    return true;
  }

  return (
    classStart < eventEnd &&
    classEnd > eventStart
  );
}

/**
 * Resolves one recurring timetable entry against
 * calendar exceptions for a specific date.
 */
export function resolveClassForDate({
  timetableEntry,
  date,
  events = [],
}) {
  if (!timetableEntry) {
    return {
      held: false,
      status: "NO_CLASS",
      reason: "No timetable entry",
      event: null,
      entry: timetableEntry,
    };
  }

  if (timetableEntry.is_active === false) {
    return {
      held: false,
      status: "INACTIVE",
      reason: "Inactive timetable entry",
      event: null,
      entry: timetableEntry,
    };
  }

  const dateDay = getDayOfWeek(date);

  if (
    Number(timetableEntry.day_of_week) !==
    dateDay
  ) {
    return {
      held: false,
      status: "WRONG_DAY",
      reason: "Wrong day",
      event: null,
      entry: timetableEntry,
    };
  }

  const classStart = timeToMinutes(
    timetableEntry.start_time
  );

  const classEnd = timeToMinutes(
    timetableEntry.end_time
  );

  const matchingEvents = events.filter(
    (event) => {
      if (event.event_date !== date) {
        return false;
      }

      if (event.affects_classes !== true) {
        return false;
      }

      /*
       * If course_id is supplied, the event only
       * affects that course.
       *
       * If course_id is null, it affects all classes.
       */
      if (
        event.course_id &&
        event.course_id !==
          timetableEntry.course_id
      ) {
        return false;
      }

      return true;
    }
  );

  /*
   * Highest priority:
   * EXAM always suppresses ALL classes
   * for the entire day, regardless of
   * whether the exam event has time
   * windows.
   */
  const examEvent = matchingEvents.find(
    (event) =>
      normalize(event.event_type) === "exam"
  );

  if (examEvent) {
    return {
      held: false,
      status: "EXAM",
      reason:
        examEvent.title || "Exam day",
      event: examEvent,
      entry: timetableEntry,
    };
  }

  /*
   * Second priority:
   * full-day holiday / no-class (untimed).
   */
  const fullDayCancellation =
    matchingEvents.find((event) => {
      const type = normalize(
        event.event_type
      );

      return (
        CANCEL_TYPES.has(type) &&
        isFullDayEvent(event)
      );
    });

  if (fullDayCancellation) {
    return {
      held: false,
      status: normalize(
        fullDayCancellation.event_type
      ),
      reason:
        fullDayCancellation.title ||
        "Class cancelled",
      event: fullDayCancellation,
      entry: timetableEntry,
    };
  }

  /*
   * Time-specific holiday/exam.
   *
   * Example:
   * Holiday 10:00 → 13:00
   *
   * 09:00 → 10:00 = held
   * 10:30 → 11:30 = cancelled
   * 13:30 → 14:30 = held
   */
  const partialCancellation =
    matchingEvents.find((event) => {
      const type = normalize(
        event.event_type
      );

      if (!CANCEL_TYPES.has(type)) {
        return false;
      }

      return overlaps(
        classStart,
        classEnd,
        timeToMinutes(event.start_time),
        timeToMinutes(event.end_time)
      );
    });

  if (partialCancellation) {
    return {
      held: false,
      status: normalize(
        partialCancellation.event_type
      ),
      reason:
        partialCancellation.title ||
        "Class cancelled",
      event: partialCancellation,
      entry: timetableEntry,
    };
  }

  return {
    held: true,
    status: "SCHEDULED",
    reason: "Regular class",
    event: null,
    entry: timetableEntry,
  };
}

/**
 * Resolve every timetable entry for a date.
 */
export function resolveDay({
  date,
  timetableEntries = [],
  events = [],
}) {
  return timetableEntries
    .filter(
      (entry) =>
        entry.is_active !== false
    )
    .filter(
      (entry) =>
        Number(entry.day_of_week) ===
        getDayOfWeek(date)
    )
    .map((entry) =>
      resolveClassForDate({
        timetableEntry: entry,
        date,
        events,
      })
    );
}

/**
 * Only classes which actually happened.
 */
export function getHeldClasses({
  date,
  timetableEntries = [],
  events = [],
}) {
  return resolveDay({
    date,
    timetableEntries,
    events,
  }).filter(
    (item) => item.held
  );
}

/**
 * Attendance eligibility.
 */
export function isAttendanceEligible({
  timetableEntry,
  date,
  events = [],
}) {
  return resolveClassForDate({
    timetableEntry,
    date,
    events,
  }).held;
}

/**
 * Recalculate attendance while respecting
 * holidays, exams and partial holidays.
 */
export function calculateAttendance({
  attendanceRecords = [],
  timetableEntries = [],
  calendarEvents = [],
}) {
  let present = 0;
  let absent = 0;
  let excused = 0;

  const validRecords = [];

  for (const record of attendanceRecords) {
    const entry =
      timetableEntries.find(
        (item) =>
          item.id ===
          record.timetable_entry_id
      );

    if (!entry) continue;

    const dayEvents =
      calendarEvents.filter(
        (event) =>
          event.event_date ===
          record.class_date
      );

    const resolved =
      resolveClassForDate({
        timetableEntry: entry,
        date: record.class_date,
        events: dayEvents,
      });

    /*
     * CRITICAL:
     * A class cancelled later by a holiday/exam
     * disappears from attendance calculations.
     */
    if (!resolved.held) {
      continue;
    }

    const status = String(
      record.status || ""
    ).toLowerCase();

    if (status === "present") {
      present++;
      validRecords.push(record);
    }

    if (status === "absent") {
      absent++;
      validRecords.push(record);
    }

    if (status === "excused") {
      excused++;
      validRecords.push(record);
    }
  }

  /*
   * Compute held classes: all timetable entries
   * that actually happened (held=true) on dates
   * that have at least one attendance record.
   * This counts both marked and unmarked held classes.
   */
  const recordDates = new Set(
    attendanceRecords.map((r) => r.class_date)
  );
  let heldClasses = 0;

  for (const date of recordDates) {
    const dayEvents = calendarEvents.filter(
      (event) => event.event_date === date
    );
    for (const entry of timetableEntries) {
      if (entry.is_active === false) continue;
      const resolved = resolveClassForDate({
        timetableEntry: entry,
        date,
        events: dayEvents,
      });
      if (resolved.held) heldClasses++;
    }
  }

  const counted =
    present + absent;

  const percentage =
    counted > 0
      ? Math.round(
          (present / counted) * 100
        )
      : null;

  return {
    present,
    absent,
    excused,
    marked: counted,
    total: counted,
    heldClasses,
    percentage,
    records: validRecords,
  };
}