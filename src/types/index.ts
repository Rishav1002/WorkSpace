export type Role = 'admin' | 'student';

export interface AcademicScope {
  group?: string;
  program?: string;
  semester?: number;
  section?: string;
  activeTermId?: string;
  effectiveDate?: string;
}

export interface UserProfile {
  id: string;
  grNumber: string;
  displayName: string;
  email?: string;
  emailVerified?: boolean;
  avatarUrl?: string;
  phone?: string;
  role: Role;
  program: string;
  group: string;
  semester: number;
  section: string;
  hostel?: string;
  hostelRoom?: string;
  attendanceTarget: number; // e.g. 75
  classStartDate: string; // YYYY-MM-DD
  activeTermId: string;
  recoveryConfigured?: boolean;
  recoveryPinHash?: string;
  recoveryPin?: string;
  scheduledDeletionAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicTerm {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface SubjectCourse {
  code: string;
  title: string;
  teacher: string;
  tokenColor: 'indigo' | 'blue' | 'purple' | 'emerald' | 'rose' | 'amber' | 'slate' | 'orange' | 'pink';
  icon: string;
  type: 'Theory' | 'Lab' | 'Mentorship' | 'Skill' | 'Practice';
  credits?: number;
  room?: string;
}

export interface TimetableSlot {
  id: string;
  day: number; // 0=Sun, 1=Mon, ..., 6=Sat
  startTime: number; // minutes from midnight, e.g. 570 = 9:30 AM
  endTime: number; // minutes from midnight, e.g. 620 = 10:20 AM
  courseCode: string;
  room: string;
  teacher?: string;
  name?: string;
  isOfficial: boolean;
  effectiveFrom?: string;
  effectiveUntil?: string;
  group?: string; // 'MCA General 1A' | 'MCA DS 1A'
  program?: string; // 'MCA'
  semester?: number; // 1
  section?: string; // '1A'
  termId?: string; // 'term-sem-1-2026'
}

export interface TimetableOverride {
  id: string;
  userId: string;
  originalSlotId?: string;
  dateStr?: string; // for "this occurrence only"
  effectiveFrom?: string; // for "from this date onward"
  scope: 'this_occurrence' | 'future_recurring';
  overrideType: 'reschedule' | 'cancel' | 'custom_class';
  courseCode: string;
  day: number;
  startTime: number;
  endTime: number;
  room: string;
  teacher?: string;
  isActive: boolean;
}

export type ClassStatus = 'scheduled' | 'live' | 'completed' | 'cancelled' | 'holiday' | 'partial_holiday' | 'exam';

export interface ResolvedClassOccurrence {
  occurrenceKey: string; // `${courseCode}-${dateStr}-${startTime}`
  dateStr: string;
  dayOfWeek: number;
  startTime: number;
  endTime: number;
  courseCode: string;
  courseTitle: string;
  room: string;
  teacher: string;
  isLab: boolean;
  periodWeight: number;
  status: ClassStatus;
  statusNote?: string;
  isOfficial: boolean;
  attendanceStatus?: 'present' | 'absent' | null;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  occurrenceKey: string;
  courseCode: string;
  dateStr: string;
  startTime: number;
  status: 'present' | 'absent';
  source: 'auto' | 'manual';
  updatedAt: string;
  isSynced: boolean;
}

export interface AcademicScope {
  userId?: string;
  group?: string;
  program?: string;
  semester?: number;
  section?: string;
  termId?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  dateStr: string;
  endDateStr?: string;
  category: 'holiday' | 'partial_holiday' | 'exam' | 'academic' | 'event';
  isOfficial: boolean;
  userId?: string;
  group?: string;
  program?: string;
  semester?: number;
  section?: string;
  termId?: string;
  examCategory?: 'FAT' | 'SAT' | 'Final' | 'Quiz' | 'Custom';
  courseCode?: string;
  startTime?: string;
  endTime?: string;
  classImpact: 'none' | 'cancel_all' | 'cancel_partial';
  cancelledSlots?: { courseCode: string; startTime: number }[];
  isRecurring?: boolean;
  recurrenceRule?: 'daily' | 'weekly' | 'monthly' | 'custom';
  parentSeriesId?: string;
  overrideOfficialId?: string;
  seriesScope?: 'this_occurrence' | 'this_and_future' | 'entire_series';
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TaskItem {
  id: string;
  userId: string;
  courseCode: string;
  title: string;
  description?: string;
  dueDate: string;
  dueTime?: string;
  priority: TaskPriority;
  status: TaskStatus;
  isRecurring?: boolean;
  recurrenceRule?: 'daily' | 'weekly' | 'monthly' | 'custom';
  parentSeriesId?: string;
  recurrenceException?: 'skip' | 'cancel' | 'modify';
  seriesScope?: 'this_occurrence' | 'this_and_future' | 'entire_series';
  completedAt?: string;
  updatedAt: string;
}

export interface HostelInfo {
  id: string;
  name: string;
  blocks?: string[];
  wardens: WardenContact[];
  laundryDays: {
    day: number;
    dayName?: string;
    timeSlot: string;
    description: string;
  }[];
}

export interface WardenContact {
  id: string;
  name: string;
  roleOrFloor: string;
  phone: string;
  hostelId: string;
}

export interface MessMenuDay {
  breakfast: string;
  lunch: string;
  snacks: string;
  dinner: string;
  dessert?: string;
}

export interface MessSchedule {
  regular: {
    name: string;
    startMin: number;
    endMin: number;
    timeDisplay: string;
  }[];
  weekendAndHoliday: {
    name: string;
    startMin: number;
    endMin: number;
    timeDisplay: string;
  }[];
  weeklyMenu: Record<number, MessMenuDay>;
}

export interface NotificationItem {
  id: string;
  userId?: string;
  title: string;
  body: string;
  type: 'class' | 'task' | 'exam' | 'meal' | 'laundry' | 'system';
  time: string;
  timestamp: number;
  read?: boolean;
}

export interface NotificationSettings {
  classes: {
    upcoming: boolean;
    upcomingMinutes: number;
    atStart: boolean;
  };
  tasks: {
    enabled: boolean;
    daysBefore: number;
  };
  exams: {
    enabled: boolean;
    daysBefore: number;
  };
  meals: {
    enabled: boolean;
    minutesBefore: number;
  };
  laundry: {
    enabled: boolean;
    minutesBefore: number;
  };
}

export interface DeviceSession {
  id: string;
  userId: string;
  deviceName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  lastActive: string;
  isCurrent: boolean;
}

export interface AuditLogEntry {
  id: string;
  actorGr: string;
  timestamp: string;
  entity: string;
  entityId: string;
  changeType: 'create' | 'update' | 'delete' | 'revert';
  previousValue?: any;
  newValue?: any;
  scope: 'master' | 'personal';
  effectiveDate: string;
}
