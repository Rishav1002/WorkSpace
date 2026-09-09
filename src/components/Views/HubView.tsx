import React, { useState } from 'react';
import {
  TrendingUp,
  CalendarCheck2,
  Calendar as CalendarIcon,
  AlertCircle,
  Plus,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  MapPin,
  Clock,
  X,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { OFFICIAL_SUBJECTS, COURSE_CODE_SHORTCUTS } from '../../data/masterData';
import { dateToIso, formatMinutes } from '../../lib/timeUtils';
import { CalendarEvent, ResolvedClassOccurrence } from '../../types';

export const HubView: React.FC = () => {
  const {
    analytics,
    calendarEvents,
    addCalendarEvent,
    deleteCalendarEvent,
    attendanceRecords,
    markAttendance,
    timetableSlots
  } = useApp();
  const { isAdmin } = useAuth();

  const [hubTab, setHubTab] = useState<'attendance' | 'calendar'>('attendance');

  // Month navigation for Attendance Overview Calendar
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  // Subject details modal
  const [selectedSubjectModal, setSelectedSubjectModal] = useState<string | null>(null);

  // Exception / Exam modal
  const [exceptionModalOpen, setExceptionModalOpen] = useState(false);
  const [exceptionType, setExceptionType] = useState<'holiday' | 'partial_holiday' | 'exam'>('holiday');
  const [exceptionDate, setExceptionDate] = useState(() => dateToIso(new Date()));
  const [exceptionTitle, setExceptionTitle] = useState('');
  const [examCategory, setExamCategory] = useState<'FAT' | 'SAT' | 'Final' | 'Quiz' | 'Custom'>('FAT');
  const [examCourse, setExamCourse] = useState('MCA110926');
  const [examStartTime, setExamStartTime] = useState('10:00');
  const [examEndTime, setExamEndTime] = useState('11:30');
  const [partialCancelledSlots, setPartialCancelledSlots] = useState<{ courseCode: string; startTime: number }[]>([]);

  // Historical Attendance confirmation modal
  const [confirmAttEdit, setConfirmAttEdit] = useState<{
    occurrenceKey: string;
    newStatus: 'present' | 'absent' | null;
  } | null>(null);

  // Calendar event modal
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(() => dateToIso(new Date()));
  const [eventEndDate, setEventEndDate] = useState('');
  const [eventCategory, setEventCategory] = useState<'holiday' | 'academic' | 'event' | 'exam'>('event');
  const [eventImpact, setEventImpact] = useState<'none' | 'cancel_all' | 'cancel_partial'>('none');
  const [isOfficialEvent, setIsOfficialEvent] = useState(false);

  // Calendar math
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
  const monthName = new Date(calYear, calMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(prev => prev - 1);
    } else {
      setCalMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(prev => prev + 1);
    } else {
      setCalMonth(prev => prev + 1);
    }
  };

  // Add Exception handler
  const handleSaveException = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exceptionDate) return;

    let classImpact: 'none' | 'cancel_all' | 'cancel_partial' = 'none';
    if (exceptionType === 'holiday') classImpact = 'cancel_all';
    else if (exceptionType === 'partial_holiday') classImpact = 'cancel_partial';

    addCalendarEvent({
      title: exceptionTitle.trim() || (exceptionType === 'exam' ? `${examCategory} Test` : 'Holiday'),
      dateStr: exceptionDate,
      category: exceptionType,
      isOfficial: isAdmin,
      examCategory: exceptionType === 'exam' ? examCategory : undefined,
      courseCode: exceptionType === 'exam' ? examCourse : undefined,
      startTime: exceptionType === 'exam' ? examStartTime : undefined,
      endTime: exceptionType === 'exam' ? examEndTime : undefined,
      classImpact,
      cancelledSlots: exceptionType === 'partial_holiday' ? partialCancelledSlots : undefined
    }, isAdmin);

    setExceptionModalOpen(false);
  };

  // Add Calendar Event handler
  const handleSaveCalendarEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventDate) return;

    addCalendarEvent({
      title: eventTitle.trim(),
      dateStr: eventDate,
      endDateStr: eventEndDate || undefined,
      category: eventCategory,
      isOfficial: isOfficialEvent && isAdmin,
      classImpact: eventImpact
    }, isOfficialEvent && isAdmin);

    setEventModalOpen(false);
  };

  // Slots for the selected exception date
  const exceptionDayOfWeek = new Date(`${exceptionDate}T00:00:00`).getDay();
  const candidateSlotsForPartial = timetableSlots.filter(
    s => s.day === exceptionDayOfWeek && s.courseCode !== 'LUNCH'
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* HEADER WITH SUBTABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-primary">Academic Hub</h2>
          <p className="text-xs text-muted font-mono">Attendance analytics, university calendar & exceptions</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-surface border border-border rounded-xl p-0.5 font-mono text-xs font-bold shadow-subtle">
            <button
              type="button"
              onClick={() => setHubTab('attendance')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                hubTab === 'attendance'
                  ? 'bg-primary text-background shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Attendance</span>
            </button>
            <button
              type="button"
              onClick={() => setHubTab('calendar')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                hubTab === 'calendar'
                  ? 'bg-primary text-background shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setExceptionModalOpen(true)}
            className="px-3 py-1.5 text-xs font-bold text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 rounded-xl transition-all border border-rose-500/20 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Exceptions & Tests</span>
          </button>
        </div>
      </div>

      {/* ATTENDANCE SUBTAB */}
      {hubTab === 'attendance' && (
        <div className="space-y-5">
          {/* OVERVIEW METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="card rounded-2xl p-5 flex flex-col justify-between border-border">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-muted">
                  Overall Attendance
                </span>
                <span className="text-xs font-mono font-bold text-brand bg-brand/10 px-2 py-0.5 rounded">
                  Target {analytics.isTargetMet ? 'Met' : 'Pending'}
                </span>
              </div>
              <div className="my-2">
                <span className="font-display text-4xl font-bold text-primary">
                  {analytics.totalHeldPeriods === 0 ? '--%' : `${analytics.overallPercentage}%`}
                </span>
              </div>
              <div className="text-xs text-muted flex items-center justify-between border-t border-border pt-2 font-mono">
                <span>{analytics.totalPresentPeriods} Present</span>
                <span>{analytics.totalAbsentPeriods} Absent</span>
                <span>{analytics.totalHeldPeriods} Held</span>
              </div>
            </div>

            <div className="card rounded-2xl p-5 flex flex-col justify-between border-border">
              <span className="text-[10px] font-mono font-bold uppercase text-muted">
                Theory vs Lab Breakdown
              </span>
              <div className="space-y-3 my-2">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-primary font-bold">Theory Lectures</span>
                    <span className="font-bold text-primary">
                      {analytics.theoryStats.percentage}% ({analytics.theoryStats.present}/{analytics.theoryStats.held})
                    </span>
                  </div>
                  <div className="w-full bg-surface-hover rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-brand h-full rounded-full"
                      style={{ width: `${analytics.theoryStats.percentage}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-primary font-bold">Practical Labs</span>
                    <span className="font-bold text-primary">
                      {analytics.labStats.percentage}% ({analytics.labStats.present}/{analytics.labStats.held})
                    </span>
                  </div>
                  <div className="w-full bg-surface-hover rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{ width: `${analytics.labStats.percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-muted font-mono border-t border-border pt-1">
                90-min lab sessions weighted as 2 periods
              </span>
            </div>

            <div className="card rounded-2xl p-5 flex flex-col justify-between border-border">
              <span className="text-[10px] font-mono font-bold uppercase text-muted">
                Target Projection
              </span>
              <div className="my-2">
                <p
                  className={`font-display text-2xl font-bold ${
                    analytics.isTargetMet ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {analytics.isTargetMet
                    ? `Can miss ${analytics.safeToMiss} classes`
                    : `Need ${analytics.classesNeeded} consecutive classes`}
                </p>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  {analytics.isTargetMet
                    ? `You can safely miss up to ${analytics.safeToMiss} periods while staying at or above 75%.`
                    : `You must attend the next ${analytics.classesNeeded} periods without absence to reach 75%.`}
                </p>
              </div>
              <span className="text-[10px] text-muted font-mono border-t border-border pt-1">
                Rule: Leave = Absent
              </span>
            </div>
          </div>

          {/* MONTHLY OVERVIEW CALENDAR */}
          <div className="card rounded-2xl p-5 shadow-subtle border-border space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <CalendarCheck2 className="w-4 h-4 text-brand" />
                <h3 className="font-display font-bold text-base text-primary">
                  Monthly Attendance Overview
                </h3>
              </div>
              <div className="flex items-center gap-1.5 bg-background border border-border p-1 rounded-xl">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 rounded-lg hover:bg-surface-hover text-muted hover:text-primary transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs font-bold px-2 text-primary">
                  {monthName}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded-lg hover:bg-surface-hover text-muted hover:text-primary transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* WEEKDAY LABELS */}
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] font-bold text-muted">
              <span>SUN</span>
              <span>MON</span>
              <span>TUE</span>
              <span>WED</span>
              <span>THU</span>
              <span>FRI</span>
              <span>SAT</span>
            </div>

            {/* CALENDAR CELLS */}
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[50px] p-1.5 rounded-xl bg-surface-hover/20"></div>
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const event = calendarEvents.find(e => e.dateStr === dStr);
                const isHoliday = event?.category === 'holiday';
                const isExam = event?.category === 'exam';

                // Check attendance records on this date
                const dayRecords = Object.values(attendanceRecords).filter(r => r.dateStr === dStr);
                const presentCount = dayRecords.filter(r => r.status === 'present').length;
                const absentCount = dayRecords.filter(r => r.status === 'absent').length;

                let cellBg = 'bg-surface hover:bg-surface-hover border-border';
                let label = '';

                if (isHoliday) {
                  cellBg = 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400';
                  label = 'HOLIDAY';
                } else if (isExam) {
                  cellBg = 'bg-indigo-500/15 border-indigo-500/30 text-indigo-600 dark:text-indigo-400';
                  label = event.examCategory || 'EXAM';
                } else if (presentCount > 0 && absentCount === 0) {
                  cellBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500';
                  label = `${presentCount}P`;
                } else if (absentCount > 0 && presentCount === 0) {
                  cellBg = 'bg-rose-500/10 border-rose-500/30 text-rose-500';
                  label = `${absentCount}A`;
                } else if (presentCount > 0 && absentCount > 0) {
                  cellBg = 'bg-purple-500/10 border-purple-500/30 text-purple-500';
                  label = `${presentCount}P·${absentCount}A`;
                }

                return (
                  <div
                    key={dStr}
                    className={`min-h-[52px] p-2 rounded-xl border flex flex-col justify-between transition-all ${cellBg}`}
                  >
                    <span className="font-mono text-xs font-bold">{day}</span>
                    {label && (
                      <span className="font-mono text-[9px] font-bold truncate block">
                        {label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border text-[11px] font-mono text-muted">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Attended
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> Missed
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Holiday
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Exam
              </span>
            </div>
          </div>

          {/* SUBJECT-WISE CARDS */}
          <div className="space-y-3">
            <h3 className="font-display font-bold text-lg text-primary">
              Subject-wise Performance
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.values(analytics.subjectWise)
                .filter(sub => sub.held > 0 || sub.code.startsWith('MCA'))
                .map(sub => {
                  const meta = OFFICIAL_SUBJECTS[sub.code];
                  const isSafe = sub.percentage >= 75;

                  return (
                    <div
                      key={sub.code}
                      className="card card-hoverable rounded-2xl p-4 flex flex-col justify-between border-border transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-brand/10 text-brand">
                            {sub.abbr}
                          </span>
                          <span
                            className={`font-display text-lg font-bold ${
                              sub.held === 0
                                ? 'text-muted'
                                : isSafe
                                ? 'text-emerald-500'
                                : 'text-rose-500'
                            }`}
                          >
                            {sub.held === 0 ? '--%' : `${sub.percentage}%`}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-primary truncate leading-snug">
                          {sub.title}
                        </h4>
                        <p className="text-[10px] font-mono text-muted mt-0.5">
                          {sub.type} · {sub.teacher}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-border">
                        <div className="flex justify-between text-[10px] font-mono text-muted mb-1">
                          <span>Progress</span>
                          <span>{sub.present} of {sub.held} classes</span>
                        </div>
                        <div className="w-full bg-surface-hover rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isSafe ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            style={{ width: `${sub.percentage}%` }}
                          ></div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedSubjectModal(sub.code)}
                          className="mt-3 w-full py-1.5 rounded-lg bg-surface-hover text-primary hover:text-brand font-bold text-[11px] font-mono transition-colors"
                        >
                          View Monthly Log
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* CALENDAR SUBTAB */}
      {hubTab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-primary">
              University Academic Schedule & Events
            </h3>
            <button
              type="button"
              onClick={() => setEventModalOpen(true)}
              className="px-3 py-1.5 text-xs font-bold text-white bg-brand hover:opacity-90 active:scale-95 rounded-xl transition-all shadow-subtle flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Personal Event</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {calendarEvents
              .sort((a, b) => a.dateStr.localeCompare(b.dateStr))
              .map(event => {
                const isPast = event.dateStr < dateToIso(new Date());

                return (
                  <div
                    key={event.id}
                    className={`card rounded-xl p-4 flex flex-col justify-between border-border transition-all ${
                      isPast ? 'opacity-60 bg-surface-hover/20' : 'bg-surface'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-md uppercase ${
                            event.category === 'holiday'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : event.category === 'exam'
                              ? 'bg-indigo-500/15 text-indigo-500 border border-indigo-500/20'
                              : 'bg-brand/10 text-brand border border-brand/20'
                          }`}
                        >
                          {event.category}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {event.isOfficial ? (
                            <span className="text-[10px] font-mono text-muted flex items-center gap-1 bg-surface-hover px-1.5 py-0.5 rounded">
                              <ShieldCheck className="w-3 h-3 text-brand" /> Official CGC
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-muted bg-surface-hover px-1.5 py-0.5 rounded">
                              Personal
                            </span>
                          )}

                          {(!event.isOfficial || isAdmin) && (
                            <button
                              type="button"
                              onClick={() => deleteCalendarEvent(event.id)}
                              className="text-muted hover:text-rose-500 p-1"
                              title="Delete event"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-primary">{event.title}</h4>
                      {event.description && (
                        <p className="text-[11px] text-muted mt-1">{event.description}</p>
                      )}

                      <div className="flex items-center gap-2 text-[10px] font-mono text-muted mt-2">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-brand" />
                          {event.dateStr} {event.endDateStr ? `to ${event.endDateStr}` : ''}
                        </span>
                        {event.startTime && (
                          <span>• {event.startTime} - {event.endTime}</span>
                        )}
                      </div>
                    </div>

                    {event.classImpact !== 'none' && (
                      <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[10px] font-mono text-amber-500">
                        <span>Class Impact:</span>
                        <span className="font-bold">
                          {event.classImpact === 'cancel_all'
                            ? 'All Classes Cancelled'
                            : 'Partial Suspension'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* EXCEPTIONS & TESTS MODAL */}
      {exceptionModalOpen && (
        <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-md bg-surface p-5 shadow-2xl animate-in zoom-in-95 border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div>
                <h4 className="font-display text-base font-bold text-primary">
                  Exceptions & Tests Manager
                </h4>
                <p className="text-[11px] font-mono text-muted">Holidays, partial cancellations or exams</p>
              </div>
              <button
                type="button"
                onClick={() => setExceptionModalOpen(false)}
                className="text-muted hover:text-primary p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveException} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-1.5 bg-background p-1 rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setExceptionType('holiday')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    exceptionType === 'holiday' ? 'bg-brand text-white shadow-sm' : 'text-muted'
                  }`}
                >
                  Full Holiday
                </button>
                <button
                  type="button"
                  onClick={() => setExceptionType('partial_holiday')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    exceptionType === 'partial_holiday' ? 'bg-brand text-white shadow-sm' : 'text-muted'
                  }`}
                >
                  Partial Off
                </button>
                <button
                  type="button"
                  onClick={() => setExceptionType('exam')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    exceptionType === 'exam' ? 'bg-brand text-white shadow-sm' : 'text-muted'
                  }`}
                >
                  Exam / Test
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={exceptionDate}
                  onChange={e => setExceptionDate(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
                />
              </div>

              {exceptionType !== 'exam' && (
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                    Holiday Title / Reason
                  </label>
                  <input
                    type="text"
                    required
                    value={exceptionTitle}
                    onChange={e => setExceptionTitle(e.target.value)}
                    placeholder="e.g. Festival Break, Bandh, or Local Holiday"
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary"
                  />
                </div>
              )}

              {/* Partial Holiday: Period Checkbox selection */}
              {exceptionType === 'partial_holiday' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                    Select the specific scheduled classes that were suspended. Unselected classes will proceed normally.
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {candidateSlotsForPartial.length > 0 ? (
                      candidateSlotsForPartial.map(slot => {
                        const isChecked = partialCancelledSlots.some(
                          cs => cs.courseCode === slot.courseCode && cs.startTime === slot.startTime
                        );

                        return (
                          <label
                            key={slot.id}
                            className="flex items-center gap-2 p-2 rounded-lg bg-surface border border-border text-xs cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) {
                                  setPartialCancelledSlots(prev => [
                                    ...prev,
                                    { courseCode: slot.courseCode, startTime: slot.startTime }
                                  ]);
                                } else {
                                  setPartialCancelledSlots(prev =>
                                    prev.filter(
                                      cs => !(cs.courseCode === slot.courseCode && cs.startTime === slot.startTime)
                                    )
                                  );
                                }
                              }}
                              className="rounded border-border text-brand accent-brand"
                            />
                            <span className="font-bold text-primary flex-1">
                              {COURSE_CODE_SHORTCUTS[slot.courseCode] || slot.courseCode}
                            </span>
                            <span className="font-mono text-muted text-[10px]">
                              {formatMinutes(slot.startTime)}
                            </span>
                          </label>
                        );
                      })
                    ) : (
                      <p className="text-[10px] text-muted">No scheduled classes found on this day.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Exam Fields */}
              {exceptionType === 'exam' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                        Category
                      </label>
                      <select
                        value={examCategory}
                        onChange={e => setExamCategory(e.target.value as any)}
                        className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary"
                      >
                        <option value="FAT">FAT (Mid-Term)</option>
                        <option value="SAT">SAT</option>
                        <option value="Final">Final Theory Exam</option>
                        <option value="Quiz">Surprise Quiz</option>
                        <option value="Custom">Custom Test</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                        Subject
                      </label>
                      <select
                        value={examCourse}
                        onChange={e => setExamCourse(e.target.value)}
                        className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary"
                      >
                        {Object.values(OFFICIAL_SUBJECTS).map(c => (
                          <option key={c.code} value={c.code}>
                            {COURSE_CODE_SHORTCUTS[c.code] || c.code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={examStartTime}
                        onChange={e => setExamStartTime(e.target.value)}
                        className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={examEndTime}
                        onChange={e => setExamEndTime(e.target.value)}
                        className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-3 flex justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setExceptionModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-hover text-muted hover:text-primary font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand text-white font-bold hover:opacity-90 active:scale-95"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CALENDAR EVENT MODAL */}
      {eventModalOpen && (
        <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-md bg-surface p-5 shadow-2xl animate-in zoom-in-95 border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <h4 className="font-display text-base font-bold text-primary">Add Event</h4>
              <button
                type="button"
                onClick={() => setEventModalOpen(false)}
                className="text-muted hover:text-primary p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCalendarEvent} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  value={eventTitle}
                  onChange={e => setEventTitle(e.target.value)}
                  placeholder="e.g. Hackathon or Study Group"
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={eventEndDate}
                    onChange={e => setEventEndDate(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                  Class Impact
                </label>
                <select
                  value={eventImpact}
                  onChange={e => setEventImpact(e.target.value as any)}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary"
                >
                  <option value="none">No Impact (Personal Reminder)</option>
                  <option value="cancel_all">Cancel All Classes on This Date</option>
                  <option value="cancel_partial">Affects Selected Classes</option>
                </select>
              </div>

              {isAdmin && (
                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOfficialEvent}
                    onChange={e => setIsOfficialEvent(e.target.checked)}
                    className="rounded border-border text-brand accent-brand"
                  />
                  <span className="text-xs font-semibold text-primary">
                    Publish as Official Global Event (Admin)
                  </span>
                </label>
              )}

              <div className="pt-3 flex justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-hover text-muted hover:text-primary font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand text-white font-bold hover:opacity-90 active:scale-95"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBJECT LOG DETAIL MODAL */}
      {selectedSubjectModal && (
        <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-md bg-surface p-5 shadow-2xl animate-in zoom-in-95 border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div>
                <h4 className="font-display text-base font-bold text-primary">
                  {OFFICIAL_SUBJECTS[selectedSubjectModal]?.title}
                </h4>
                <p className="text-[11px] font-mono text-muted">
                  {selectedSubjectModal} · {OFFICIAL_SUBJECTS[selectedSubjectModal]?.teacher}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubjectModal(null)}
                className="text-muted hover:text-primary p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {Object.values(attendanceRecords)
                .filter(r => r.courseCode === selectedSubjectModal)
                .sort((a, b) => b.dateStr.localeCompare(a.dateStr))
                .map(rec => (
                  <div
                    key={rec.occurrenceKey}
                    className="p-2.5 rounded-xl border border-border flex items-center justify-between bg-surface-hover/30"
                  >
                    <div>
                      <span className="font-mono text-xs font-bold text-primary">
                        {rec.dateStr}
                      </span>
                      <span className="text-[10px] font-mono text-muted block">
                        Period start: {formatMinutes(rec.startTime)} ({rec.source})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          rec.status === 'present'
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-rose-500/15 text-rose-500'
                        }`}
                      >
                        {rec.status.toUpperCase()}
                      </span>

                      {/* Historical edit with confirmation */}
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmAttEdit({
                            occurrenceKey: rec.occurrenceKey,
                            newStatus: rec.status === 'present' ? 'absent' : 'present'
                          });
                        }}
                        className="text-[10px] font-mono text-brand underline px-1"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM ATTENDANCE HISTORICAL EDIT MODAL */}
      {confirmAttEdit && (
        <div className="fixed inset-0 z-[140] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-sm bg-surface p-5 shadow-2xl border-border animate-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-2.5 text-amber-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="font-display font-bold text-base text-primary">Confirm Attendance Correction</h4>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              You are modifying a past attendance record for <b>{confirmAttEdit.occurrenceKey}</b> to{' '}
              <b className="text-primary">{confirmAttEdit.newStatus?.toUpperCase()}</b>. Do you want to save this historical change?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setConfirmAttEdit(null)}
                className="px-3.5 py-1.5 rounded-xl bg-surface-hover text-muted hover:text-primary font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  markAttendance(confirmAttEdit.occurrenceKey, confirmAttEdit.newStatus, true);
                  setConfirmAttEdit(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-brand text-white font-bold text-xs hover:opacity-90 active:scale-95"
              >
                Confirm Correction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
