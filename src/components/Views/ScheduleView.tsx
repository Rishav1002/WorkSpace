import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  List,
  Search,
  Plus,
  RotateCcw,
  MapPin,
  User,
  Clock,
  Sparkles,
  X,
  AlertCircle,
  Award
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { OFFICIAL_SUBJECTS, COURSE_CODE_SHORTCUTS } from '../../data/masterData';
import { formatMinutes, getWeekDateStrings, timeStringToMinutes } from '../../lib/timeUtils';
import { getExamForDate } from '../../lib/attendanceEngine';
import { TimetableOverride } from '../../types';

export const ScheduleView: React.FC = () => {
  const { user } = useAuth();
  const {
    timetableSlots,
    overrides,
    calendarEvents,
    saveTimetableOverride,
    deleteTimetableOverride,
    restoreOfficialRoutine,
    campusBlocks
  } = useApp();

  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedSlotToOverride, setSelectedSlotToOverride] = useState<any | null>(null);

  // Form states for personal override
  const [overrideCourse, setOverrideCourse] = useState('MCA110226');
  const [overrideRoom, setOverrideRoom] = useState('R512');
  const [overrideTeacher, setOverrideTeacher] = useState('');
  const [overrideScope, setOverrideScope] = useState<'this_occurrence' | 'future_recurring'>('this_occurrence');
  const [overrideDate, setOverrideDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Form states for adding custom class
  const [addClassModalOpen, setAddClassModalOpen] = useState(false);
  const [newClassCourse, setNewClassCourse] = useState('MCA110226');
  const [newClassDay, setNewClassDay] = useState<number>(() => {
    const today = new Date().getDay();
    return today === 1 || today === 2 ? 3 : today;
  });
  const [newClassStartTime, setNewClassStartTime] = useState('09:30');
  const [newClassEndTime, setNewClassEndTime] = useState('10:20');
  const [newClassRoom, setNewClassRoom] = useState('R512');
  const [newClassTeacher, setNewClassTeacher] = useState('');
  const [newClassScope, setNewClassScope] = useState<'this_occurrence' | 'future_recurring'>('future_recurring');
  const [newClassDate, setNewClassDate] = useState(() => new Date().toISOString().split('T')[0]);

  const daysMap: Record<number, string> = {
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
    0: 'Sunday'
  };

  const weekDates = getWeekDateStrings();

  const userAcademicScope = user ? {
    userId: user.id,
    group: user.group,
    program: user.program,
    semester: user.semester,
    section: user.section
  } : undefined;

  // Filter slots
  const q = searchQuery.toLowerCase().trim();
  const filteredSlots = timetableSlots.filter(s => {
    if (!q) return true;
    const meta = OFFICIAL_SUBJECTS[s.courseCode];
    const abbr = COURSE_CODE_SHORTCUTS[s.courseCode] || '';
    return (
      s.courseCode.toLowerCase().includes(q) ||
      abbr.toLowerCase().includes(q) ||
      (meta?.title || '').toLowerCase().includes(q) ||
      s.room.toLowerCase().includes(q) ||
      (s.teacher || meta?.teacher || '').toLowerCase().includes(q)
    );
  });

  const handleOpenOverride = (slot: any) => {
    setSelectedSlotToOverride(slot);
    setOverrideCourse(slot.courseCode);
    setOverrideRoom(slot.room);
    setOverrideTeacher(slot.teacher || '');
    setOverrideModalOpen(true);
  };

  const handleSaveOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotToOverride) return;

    saveTimetableOverride({
      originalSlotId: selectedSlotToOverride.id,
      dateStr: overrideScope === 'this_occurrence' ? overrideDate : undefined,
      effectiveFrom: overrideScope === 'future_recurring' ? overrideDate : undefined,
      scope: overrideScope,
      overrideType: 'reschedule',
      courseCode: overrideCourse,
      day: selectedSlotToOverride.day,
      startTime: selectedSlotToOverride.startTime,
      endTime: selectedSlotToOverride.endTime,
      room: overrideRoom,
      teacher: overrideTeacher,
      isActive: true
    });

    setOverrideModalOpen(false);
    setSelectedSlotToOverride(null);
  };

  const handleSaveNewClass = (e: React.FormEvent) => {
    e.preventDefault();
    const startMin = timeStringToMinutes(newClassStartTime);
    const endMin = timeStringToMinutes(newClassEndTime);

    if (endMin <= startMin) {
      alert('End time must be after start time');
      return;
    }

    saveTimetableOverride({
      dateStr: newClassScope === 'this_occurrence' ? newClassDate : undefined,
      effectiveFrom: newClassScope === 'future_recurring' ? newClassDate : undefined,
      scope: newClassScope,
      overrideType: 'custom_class',
      courseCode: newClassCourse,
      day: newClassDay,
      startTime: startMin,
      endTime: endMin,
      room: newClassRoom,
      teacher: newClassTeacher,
      isActive: true
    });

    setAddClassModalOpen(false);
    setNewClassTeacher('');
  };

  const gridTimeHeaders = [
    { label: '9:30', start: 570 },
    { label: '10:20', start: 620 },
    { label: '11:10', start: 670 },
    { label: '12:00', start: 720 },
    { label: '12:50', start: 770, isLunch: true },
    { label: '1:35', start: 815 },
    { label: '2:20', start: 860 },
    { label: '3:05', start: 905 },
    { label: '3:50', start: 950 }
  ];

  interface GridCell {
    colIndex: number;
    colSpan: number;
    isLunch?: boolean;
    isEmpty?: boolean;
    slot?: any;
    abbr?: string;
    is2Period?: boolean;
  }

  const getRowCells = (daySlots: any[]): GridCell[] => {
    const cells: GridCell[] = [];
    let cIdx = 0;

    while (cIdx < gridTimeHeaders.length) {
      const hdr = gridTimeHeaders[cIdx];

      if (hdr.isLunch) {
        cells.push({ colIndex: cIdx, colSpan: 1, isLunch: true });
        cIdx++;
        continue;
      }

      // Find slot starting at or covering this header time
      const match = daySlots.find(s => s.startTime === hdr.start);

      if (!match || match.courseCode === 'LUNCH') {
        cells.push({ colIndex: cIdx, colSpan: 1, isEmpty: true });
        cIdx++;
        continue;
      }

      // Calculate span across columns (merge consecutive periods)
      let span = 1;
      let nextIdx = cIdx + 1;
      while (nextIdx < gridTimeHeaders.length) {
        const nextHdr = gridTimeHeaders[nextIdx];
        if (nextHdr.isLunch) break;

        // Current slot extends past next header start
        if (match.endTime > nextHdr.start) {
          span++;
          nextIdx++;
          continue;
        }

        // Or consecutive slot for same subject and room exists immediately
        const consecutiveSlot = daySlots.find(
          s =>
            s.startTime === match.endTime &&
            s.startTime === nextHdr.start &&
            s.courseCode === match.courseCode &&
            s.room === match.room
        );
        if (consecutiveSlot) {
          span++;
          nextIdx++;
          continue;
        }

        break;
      }

      const abbr = COURSE_CODE_SHORTCUTS[match.courseCode] || match.courseCode;
      const is2Period = span > 1 || (match.endTime - match.startTime >= 80);

      cells.push({
        colIndex: cIdx,
        colSpan: span,
        slot: match,
        abbr,
        is2Period
      });

      cIdx += span;
    }

    return cells;
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-primary">Master Schedule</h2>
          <p className="text-xs text-muted font-mono">Academic Session 2026–2027 · MCA Routine</p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* SEARCH BAR */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search course, room, teacher..."
              className="w-full bg-surface border border-border rounded-xl pl-8 pr-3 py-2 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-brand font-medium"
            />
          </div>

          {/* ADD CLASS BUTTON */}
          <button
            type="button"
            onClick={() => setAddClassModalOpen(true)}
            className="px-3 py-1.5 text-xs font-bold text-white bg-brand hover:opacity-90 active:scale-95 rounded-xl transition-all shadow-subtle flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Class</span>
          </button>

          {/* VIEW TOGGLE */}
          <div className="flex bg-surface border border-border rounded-xl p-0.5 font-mono text-[11px] font-bold shadow-subtle shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'timeline'
                  ? 'bg-primary text-background shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-primary text-background shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* TIMELINE VIEW */}
      {viewMode === 'timeline' && (
        <div className="space-y-6">
          {[1, 2, 3, 4, 5, 6, 0].map(dayNum => {
            const daySlots = filteredSlots
              .filter(s => s.day === dayNum && s.courseCode !== 'LUNCH')
              .sort((a, b) => a.startTime - b.startTime);

            const dayDateStr = weekDates[dayNum];
            const isToday = new Date().getDay() === dayNum;
            const dayExam = getExamForDate(dayDateStr, calendarEvents, userAcademicScope, timetableSlots);

            return (
              <div key={dayNum} className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3 h-3 rounded-full border-2 ${
                      isToday ? 'bg-brand border-brand/20' : 'bg-border border-background'
                    }`}
                  ></div>
                  <h3
                    className={`font-display font-bold text-base ${
                      isToday ? 'text-brand' : 'text-primary'
                    }`}
                  >
                    {daysMap[dayNum]}
                    <span className="text-xs font-mono font-normal text-muted ml-2">
                      {dayDateStr} {isToday && '• Today'}
                    </span>
                  </h3>
                </div>

                <div className="pl-5 border-l-2 border-border/60 space-y-3">
                  {/* EXAM DAY BANNER IF APPLICABLE */}
                  {dayExam ? (
                    <div className="space-y-2">
                      <div className="card rounded-xl p-4 bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-subtle">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                            <Award className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                                EXAM DAY • {dayExam.examCategory || 'OFFICIAL EXAM'}
                              </span>
                              <span className="text-xs font-mono text-amber-700 dark:text-amber-400">
                                Regular classes suspended
                              </span>
                            </div>
                            <h4 className="font-display font-bold text-sm text-primary mt-1">{dayExam.title}</h4>
                            <div className="flex items-center gap-3 text-xs font-mono text-muted mt-1 flex-wrap">
                              <span>⏱ {dayExam.startTime ? formatMinutes(timeStringToMinutes(dayExam.startTime)) : '10:00 AM'} – {dayExam.endTime ? formatMinutes(timeStringToMinutes(dayExam.endTime)) : '11:30 AM'}</span>
                              <span>📍 {dayExam.description || 'Examination Hall'}</span>
                              {dayExam.courseCode && <span>📚 {COURSE_CODE_SHORTCUTS[dayExam.courseCode] || dayExam.courseCode}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-[11px] font-mono text-muted pl-1">
                        All regular timetable lectures cancelled for this date.
                      </p>
                    </div>
                  ) : daySlots.length === 0 ? (
                    <div className="text-xs text-muted font-mono py-2">
                      {dayNum === 1 || dayNum === 2 ? 'Academic Weekend — No regular classes scheduled.' : 'No classes scheduled.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {daySlots.map(slot => {
                        const meta = OFFICIAL_SUBJECTS[slot.courseCode];
                        const abbr = COURSE_CODE_SHORTCUTS[slot.courseCode] || slot.courseCode;
                        const isLab = meta?.type === 'Lab' || slot.courseCode.includes('Lab');
                        const hasOverride = overrides.some(o => o.originalSlotId === slot.id && o.isActive);
                        const durationMinutes = slot.endTime - slot.startTime;
                        const isStretched = durationMinutes >= 80;

                        return (
                          <div
                            key={slot.id}
                            className={`card rounded-xl p-3.5 flex flex-col justify-between transition-all hover:border-brand/40 shadow-subtle ${
                              hasOverride ? 'border-amber-500/40 bg-amber-500/5' : 'border-border'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-brand/10 text-brand">
                                    {abbr}
                                  </span>
                                  <span className="text-[10px] font-mono text-muted font-bold">
                                    {isLab ? 'LAB' : 'THEORY'}
                                  </span>
                                  {isStretched && (
                                    <span className="text-[9px] font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/15 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                      2 Periods ({durationMinutes}m)
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1">
                                  {hasOverride ? (
                                    <span className="text-[10px] font-mono text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">
                                      Custom Override
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-mono text-muted bg-surface-hover px-1.5 py-0.5 rounded">
                                      Official
                                    </span>
                                  )}
                                </div>
                              </div>

                              <h4 className="text-xs font-bold text-primary truncate">
                                {slot.name || meta?.title || slot.courseCode}
                              </h4>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-muted mt-2">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-brand" />
                                  {formatMinutes(slot.startTime)} – {formatMinutes(slot.endTime)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {slot.room}
                                </span>
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {slot.teacher || meta?.teacher}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => handleOpenOverride(slot)}
                                className="text-[11px] font-semibold text-brand hover:underline flex items-center gap-1"
                              >
                                <Sparkles className="w-3 h-3" /> Customize Class
                              </button>

                              {hasOverride && (
                                <button
                                  type="button"
                                  onClick={() => restoreOfficialRoutine(slot.id)}
                                  className="text-[11px] font-mono text-muted hover:text-rose-500 flex items-center gap-1"
                                  title="Restore official routine"
                                >
                                  <RotateCcw className="w-3 h-3" /> Restore
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MASTER GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="card rounded-2xl overflow-hidden shadow-subtle border-border">
          <div className="overflow-x-auto p-2">
            <table className="w-full text-left text-xs border-collapse min-w-[850px]">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="p-3 text-[10px] font-mono font-bold uppercase text-muted sticky left-0 bg-surface z-10">
                    Day / Date
                  </th>
                  {gridTimeHeaders.map((hdr, idx) => (
                    <th
                      key={idx}
                      className={`p-3 text-[10px] font-mono font-bold uppercase text-muted ${
                        hdr.isLunch ? 'bg-surface-hover text-center' : ''
                      }`}
                    >
                      {hdr.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[1, 2, 3, 4, 5, 6, 0].map(dayNum => {
                  const daySlots = timetableSlots.filter(s => s.day === dayNum);
                  const dayDate = weekDates[dayNum];
                  const dayExam = getExamForDate(dayDate, calendarEvents, userAcademicScope, timetableSlots);
                  const gridCells = getRowCells(daySlots);

                  return (
                    <tr key={dayNum} className="hover:bg-surface-hover/50 transition-colors">
                      <td className="p-3 font-mono font-bold sticky left-0 bg-surface z-10 border-r border-border w-24">
                        <div className="text-primary font-display">{daysMap[dayNum].slice(0, 3).toUpperCase()}</div>
                        <div className="text-[10px] text-muted font-normal">{dayDate}</div>
                      </td>

                      {dayExam ? (
                        <td colSpan={gridTimeHeaders.length} className="p-3 bg-amber-500/10 border-r border-border">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2 font-mono text-xs">
                              <span className="px-2 py-0.5 rounded bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold uppercase text-[10px]">
                                EXAM DAY
                              </span>
                              <span className="font-bold text-primary">{dayExam.title}</span>
                              <span className="text-muted text-[11px]">
                                ({dayExam.startTime ? formatMinutes(timeStringToMinutes(dayExam.startTime)) : '10:00 AM'} – {dayExam.endTime ? formatMinutes(timeStringToMinutes(dayExam.endTime)) : '11:30 AM'})
                              </span>
                              <span className="text-muted text-[11px]">📍 {dayExam.description || 'Exam Hall'}</span>
                            </div>
                            <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider">
                              Regular Classes Suspended
                            </span>
                          </div>
                        </td>
                      ) : (
                        gridCells.map(cell => {
                          if (cell.isLunch) {
                            return (
                              <td
                                key={cell.colIndex}
                                className="p-2 text-center bg-surface-hover/70 text-[10px] font-mono font-bold text-muted border-r border-border"
                              >
                                LUNCH
                              </td>
                            );
                          }

                          if (cell.isEmpty || !cell.slot) {
                            return (
                              <td
                                key={cell.colIndex}
                                className="p-2 text-center text-muted/40 font-mono text-[10px] border-r border-border"
                              >
                                —
                              </td>
                            );
                          }

                          const match = cell.slot;
                          const meta = OFFICIAL_SUBJECTS[match.courseCode];

                          return (
                            <td
                              key={cell.colIndex}
                              colSpan={cell.colSpan}
                              className={`p-2.5 align-top border-r border-border transition-colors cursor-pointer ${
                                cell.colSpan > 1
                                  ? 'bg-indigo-500/5 dark:bg-indigo-950/20 hover:bg-indigo-500/10'
                                  : 'bg-surface hover:bg-brand/5'
                              }`}
                              onClick={() => handleOpenOverride(match)}
                            >
                              <div className="font-bold text-primary font-mono text-[11px] leading-tight flex items-center justify-between gap-1">
                                <span className="truncate">{cell.abbr}</span>
                                {cell.is2Period && (
                                  <span className="text-[8px] font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/15 px-1.5 py-0.5 rounded shrink-0">
                                    2 Periods
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] font-mono text-muted mt-1 truncate flex items-center gap-1">
                                <span>{match.room}</span>
                                {cell.colSpan > 1 && (
                                  <span className="text-muted/60">
                                    ({formatMinutes(match.startTime)}–{formatMinutes(match.endTime)})
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] text-muted/80 truncate mt-0.5">
                                {match.teacher || meta?.teacher}
                              </div>
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PERSONAL OVERRIDE MODAL */}
      {overrideModalOpen && selectedSlotToOverride && (
        <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-md bg-surface p-5 shadow-2xl animate-in zoom-in-95 border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div>
                <h4 className="font-display text-base font-bold text-primary">
                  Customize Routine
                </h4>
                <p className="text-[11px] font-mono text-muted">
                  {daysMap[selectedSlotToOverride.day]} · {formatMinutes(selectedSlotToOverride.startTime)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOverrideModalOpen(false)}
                className="text-muted hover:text-primary p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                  Change Scope
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOverrideScope('this_occurrence')}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                      overrideScope === 'this_occurrence'
                        ? 'border-brand bg-brand/10 text-brand font-bold'
                        : 'border-border text-muted hover:bg-surface-hover'
                    }`}
                  >
                    This occurrence only
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideScope('future_recurring')}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                      overrideScope === 'future_recurring'
                        ? 'border-brand bg-brand/10 text-brand font-bold'
                        : 'border-border text-muted hover:bg-surface-hover'
                    }`}
                  >
                    From date onward
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={overrideDate}
                  onChange={e => setOverrideDate(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                  Subject / Course
                </label>
                <select
                  value={overrideCourse}
                  onChange={e => setOverrideCourse(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
                >
                  {Object.values(OFFICIAL_SUBJECTS).map(c => (
                    <option key={c.code} value={c.code} title={c.title}>
                      {COURSE_CODE_SHORTCUTS[c.code] || c.code}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                    Room
                  </label>
                  <input
                    type="text"
                    value={overrideRoom}
                    onChange={e => setOverrideRoom(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                    Teacher
                  </label>
                  <input
                    type="text"
                    value={overrideTeacher}
                    onChange={e => setOverrideTeacher(e.target.value)}
                    placeholder="e.g. Dr. Jaspreet Singh"
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-hover text-muted hover:text-primary font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand text-white font-bold hover:opacity-90 active:scale-95"
                >
                  Apply Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD CUSTOM CLASS MODAL */}
      {addClassModalOpen && (
        <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-md bg-surface p-5 shadow-2xl animate-in zoom-in-95 border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div>
                <h4 className="font-display text-base font-bold text-primary">
                  Add Class to Routine
                </h4>
                <p className="text-[11px] font-mono text-muted">
                  Insert elective, lab session, tutorial, or personalized class
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddClassModalOpen(false)}
                className="text-muted hover:text-primary p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewClass} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                  Scope
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewClassScope('future_recurring')}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs transition-all ${
                      newClassScope === 'future_recurring'
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border text-muted hover:bg-surface-hover'
                    }`}
                  >
                    Weekly Recurring
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewClassScope('this_occurrence')}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs transition-all ${
                      newClassScope === 'this_occurrence'
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border text-muted hover:bg-surface-hover'
                    }`}
                  >
                    Single Date Only
                  </button>
                </div>
              </div>

              {newClassScope === 'this_occurrence' ? (
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newClassDate}
                    onChange={e => {
                      setNewClassDate(e.target.value);
                      const d = new Date(`${e.target.value}T00:00:00`).getDay();
                      setNewClassDay(d);
                    }}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                    Day of Week
                  </label>
                  <select
                    value={newClassDay}
                    onChange={e => setNewClassDay(parseInt(e.target.value, 10))}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
                  >
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                    <option value={0}>Sunday</option>
                    <option value={1}>Monday (Academic Off)</option>
                    <option value={2}>Tuesday (Academic Off)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                  Subject / Course
                </label>
                <select
                  value={newClassCourse}
                  onChange={e => setNewClassCourse(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
                >
                  {Object.values(OFFICIAL_SUBJECTS).map(c => (
                    <option key={c.code} value={c.code} title={c.title}>
                      {COURSE_CODE_SHORTCUTS[c.code] || c.code} — {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={newClassStartTime}
                    onChange={e => setNewClassStartTime(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={newClassEndTime}
                    onChange={e => setNewClassEndTime(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                    Room / Campus Block
                  </label>
                  <input
                    type="text"
                    required
                    list="campus-blocks-list"
                    value={newClassRoom}
                    onChange={e => setNewClassRoom(e.target.value)}
                    placeholder="e.g. Block 1 - R512"
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary font-mono"
                  />
                  <datalist id="campus-blocks-list">
                    {campusBlocks.map(b => (
                      <option key={b.id} value={`${b.name} - R512`}>
                        {b.name}
                      </option>
                    ))}
                    <option value="R512" />
                    <option value="R605" />
                    <option value="R603" />
                    <option value="R311" />
                    <option value="L604" />
                    <option value="L204" />
                    <option value="L205" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-muted mb-1">
                    Instructor
                  </label>
                  <input
                    type="text"
                    value={newClassTeacher}
                    onChange={e => setNewClassTeacher(e.target.value)}
                    placeholder="e.g. Dr. Jaspreet Singh"
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setAddClassModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-hover text-muted hover:text-primary font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand text-white font-bold hover:opacity-90 active:scale-95"
                >
                  Add to Routine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
