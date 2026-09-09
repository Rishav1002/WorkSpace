import React, { useState, useEffect } from 'react';
import {
  Clock,
  MapPin,
  User,
  Utensils,
  Shirt,
  CalendarCheck2,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Coffee,
  CheckCircle2,
  SunMedium
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { getCurrentMinutes, formatMinutes, parseMealPills } from '../../lib/timeUtils';
import { OFFICIAL_MESS_SCHEDULE, LAUNDRY_MANAGER } from '../../data/masterData';

export const TodayView: React.FC = () => {
  const { todayClasses, analytics, setActiveTab, selectedHostel } = useApp();
  const { user } = useAuth();
  const [currentMinutes, setCurrentMinutes] = useState(getCurrentMinutes());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentMinutes(getCurrentMinutes());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const now = new Date();
  const dayOfWeek = now.getDay();

  // Determine current, next, and later classes
  const currentClass = todayClasses.find(
    c => currentMinutes >= c.startTime && currentMinutes < c.endTime
  );

  const nextClass = todayClasses.find(c => c.startTime > currentMinutes);
  const laterClasses = todayClasses.filter(c => c.startTime > currentMinutes && c !== nextClass);
  const remainingCount = todayClasses.filter(c => c.startTime > currentMinutes).length;

  // Hostel Next Meal
  const isWeekendOrHoliday = dayOfWeek === 0 || dayOfWeek === 6;
  const messTimings = isWeekendOrHoliday
    ? OFFICIAL_MESS_SCHEDULE.weekendAndHoliday
    : OFFICIAL_MESS_SCHEDULE.regular;

  const currentOrNextMealTiming = messTimings.find(m => currentMinutes < m.endMin) || messTimings[0];
  const isTomorrowMeal = !messTimings.some(m => currentMinutes < m.endMin);

  const activeMenuDay = isTomorrowMeal ? (dayOfWeek + 1) % 7 : dayOfWeek;
  const mealMenuDay = OFFICIAL_MESS_SCHEDULE.weeklyMenu[activeMenuDay];

  let mealMenuText = 'Hostel meal scheduled';
  if (mealMenuDay) {
    const key = currentOrNextMealTiming.name.toLowerCase();
    if (key.includes('breakfast')) mealMenuText = mealMenuDay.breakfast;
    else if (key.includes('lunch')) mealMenuText = mealMenuDay.lunch;
    else if (key.includes('snack')) mealMenuText = mealMenuDay.snacks;
    else if (key.includes('dinner')) mealMenuText = mealMenuDay.dinner;
  }

  // Laundry Schedule for current day
  const laundryToday = selectedHostel?.laundryDays.find(l => l.day === dayOfWeek);
  const isLaundryWindow = laundryToday && currentMinutes >= 16 * 60 && currentMinutes < 18 * 60; // 4:00 PM - 6:00 PM

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* GREETING BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-primary tracking-tight">
            Welcome back, {user?.displayName.split(' ')[0] || 'Student'}
          </h2>
          <p className="text-xs text-muted font-mono">
            {user?.program} {user?.group} · Section {user?.section} · Semester {user?.semester}
          </p>
        </div>
      </div>

      {/* NOW & NEXT CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* CURRENT CLASS CARD */}
        <div className="lg:col-span-3">
          {currentClass ? (
            <div className="rounded-2xl p-6 relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 text-white shadow-xl flex flex-col justify-between min-h-[220px] border border-indigo-500/30">
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start">
                  <span className="bg-white/20 backdrop-blur-md text-white px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                    Live Now
                  </span>
                  <span className="font-mono text-xs font-bold text-white/95 bg-black/20 px-2.5 py-0.5 rounded-lg backdrop-blur-sm">
                    {formatMinutes(currentClass.startTime)} – {formatMinutes(currentClass.endTime)}
                  </span>
                </div>

                <div className="my-3">
                  <h3 className="font-display text-2xl font-bold tracking-tight text-white leading-tight">
                    {currentClass.courseTitle}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-white/15 px-2.5 py-1 rounded-lg">
                      <MapPin className="w-3 h-3" /> {currentClass.room}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-white/15 px-2.5 py-1 rounded-lg">
                      <User className="w-3 h-3" /> {currentClass.teacher}
                    </span>
                    {currentClass.isLab && (
                      <span className="text-[10px] font-bold uppercase bg-amber-400 text-black px-2 py-0.5 rounded">
                        Lab Session
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="pt-2 border-t border-white/20">
                  <div className="flex justify-between items-center text-[10px] font-mono text-white/80 mb-1">
                    <span>Period Progress</span>
                    <span>
                      {Math.max(0, Math.ceil(currentClass.endTime - currentMinutes))} min remaining
                    </span>
                  </div>
                  <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-white h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            ((currentMinutes - currentClass.startTime) /
                              (currentClass.endTime - currentClass.startTime)) *
                              100
                          )
                        )}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card rounded-2xl p-6 min-h-[220px] flex flex-col justify-center items-center text-center shadow-subtle border-border">
              <div className="w-10 h-10 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mb-3">
                <Coffee className="w-5 h-5" />
              </div>
              <h4 className="font-display text-base font-bold text-primary">Free Period</h4>
              <p className="text-xs text-muted mt-1 max-w-xs">
                {nextClass
                  ? `Next class starts at ${formatMinutes(nextClass.startTime)} (${nextClass.courseTitle})`
                  : 'All classes completed for today. Relax or review homework!'}
              </p>
            </div>
          )}
        </div>

        {/* NEXT CLASS CARD */}
        <div className="lg:col-span-2">
          {nextClass ? (
            <div className="card rounded-2xl p-5 flex flex-col justify-between h-full shadow-subtle border-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-brand bg-brand/10 px-2 py-0.5 rounded-lg">
                  Up Next
                </span>
                <span className="font-mono text-xs text-muted font-semibold">
                  {formatMinutes(nextClass.startTime)}
                </span>
              </div>

              <div>
                <h4 className="font-display text-base font-bold text-primary leading-tight">
                  {nextClass.courseTitle}
                </h4>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 text-xs text-muted bg-surface-hover px-2 py-0.5 rounded-md font-mono">
                    <MapPin className="w-3 h-3 text-brand" /> {nextClass.room}
                  </span>
                  <span className="text-xs text-muted truncate">
                    {nextClass.teacher}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
                <span>Starts in</span>
                <span className="font-mono font-bold text-primary">
                  {Math.max(0, Math.ceil(nextClass.startTime - currentMinutes))} min
                </span>
              </div>
            </div>
          ) : (
            <div className="card rounded-2xl p-5 flex flex-col justify-center items-center text-center h-full text-muted shadow-subtle border-border">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-2 opacity-80" />
              <p className="text-xs font-semibold text-primary">Done for the Day</p>
              <p className="text-[11px] text-muted mt-0.5">No further lectures scheduled.</p>
            </div>
          )}
        </div>
      </div>

      {/* ATTENDANCE SUMMARY STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('hub')}
          className="card card-hoverable rounded-2xl p-4 text-left transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider font-bold">
              Attendance
            </span>
            <TrendingUp className="w-3.5 h-3.5 text-brand" />
          </div>
          <span className="font-display text-2xl font-bold text-primary">
            {analytics.totalHeldPeriods === 0 ? '--%' : `${analytics.overallPercentage}%`}
          </span>
          <span className="text-[10px] text-muted font-mono mt-1">
            Target: {user?.attendanceTarget || 75}%
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hub')}
          className="card card-hoverable rounded-2xl p-4 text-left transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider font-bold">
              Classes Attended
            </span>
            <CalendarCheck2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <span className="font-display text-2xl font-bold text-primary">
            {analytics.totalPresentPeriods}/{analytics.totalHeldPeriods}
          </span>
          <span className="text-[10px] text-muted font-mono mt-1">
            Held to date
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hub')}
          className="card card-hoverable rounded-2xl p-4 text-left transition-all flex flex-col justify-between col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider font-bold">
              Target Status
            </span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <span
            className={`font-display text-2xl font-bold ${
              analytics.isTargetMet ? 'text-emerald-500' : 'text-rose-500'
            }`}
          >
            {analytics.isTargetMet ? `${analytics.safeToMiss} safe` : `Need ${analytics.classesNeeded}`}
          </span>
          <span className="text-[10px] text-muted font-mono mt-1">
            {analytics.isTargetMet ? 'Can safely miss' : 'To reach target'}
          </span>
        </button>
      </div>

      {/* LATER TODAY SCHEDULE */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h4 className="font-mono text-[11px] font-bold tracking-widest uppercase text-muted">
            Later Today
          </h4>
          <span className="text-[11px] font-mono font-bold text-primary">
            {remainingCount} class{remainingCount === 1 ? '' : 'es'} left
          </span>
        </div>

        <div className="card rounded-2xl divide-y divide-border p-2 shadow-subtle border-border">
          {laterClasses.length > 0 ? (
            laterClasses.map(c => (
              <div
                key={c.occurrenceKey}
                className="p-3 flex items-center justify-between gap-3 hover:bg-surface-hover rounded-xl transition-colors"
              >
                <div className="min-w-0">
                  <h5 className="text-xs font-bold text-primary truncate">
                    {c.courseTitle}
                  </h5>
                  <p className="text-[10px] font-mono text-muted mt-0.5 flex items-center gap-2">
                    <span>{formatMinutes(c.startTime)} – {formatMinutes(c.endTime)}</span>
                    <span>•</span>
                    <span>{c.room}</span>
                    <span>•</span>
                    <span>{c.teacher}</span>
                  </p>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-background border border-border text-muted shrink-0">
                  {c.isLab ? 'LAB' : 'THEORY'}
                </span>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-xs text-muted">
              No further lectures remaining for today.
            </div>
          )}
        </div>
      </div>

      {/* HOSTEL & MESS WIDGETS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h4 className="font-mono text-[11px] font-bold tracking-widest uppercase text-primary/70 dark:text-muted">
            Hostel & Routine
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* MEAL HERO CARD */}
          <div
            onClick={() => setActiveTab('hostel')}
            className="rounded-2xl p-5 relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 text-white shadow-lg cursor-pointer flex flex-col justify-between hover:shadow-xl hover:-translate-y-0.5 transition-all border border-indigo-500/30"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-white shadow-xs">
                  <Utensils className="w-3 h-3 text-amber-300" />
                  {isTomorrowMeal ? 'Tomorrow Morning' : 'Next Scheduled Meal'}
                </span>
                <span className="text-xs font-mono font-bold bg-black/35 text-white px-2 py-0.5 rounded-md border border-white/10">
                  {currentOrNextMealTiming.timeDisplay}
                </span>
              </div>

              <h4 className="font-display text-xl font-bold text-white mt-1 drop-shadow-sm">
                {currentOrNextMealTiming.name}
              </h4>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {parseMealPills(mealMenuText).map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium bg-white/20 border border-white/30 text-white backdrop-blur-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs text-white/90">
              <span>View full weekly menu</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* LAUNDRY CARD */}
          <div
            onClick={() => setActiveTab('hostel')}
            className="card card-hoverable rounded-2xl p-5 shadow-subtle border-border cursor-pointer flex flex-col justify-between bg-surface"
          >
            <div>
              <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Shirt className="w-3.5 h-3.5 text-brand" />
                  Laundry Routine ({selectedHostel?.name.split(' ')[0] || 'Hostel'})
                </h4>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    isLaundryWindow
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 animate-pulse'
                      : 'bg-surface-hover text-primary/70 dark:text-muted border border-border'
                  }`}
                >
                  {isLaundryWindow ? 'Drop & Pick Active' : 'Window 4–6 PM'}
                </span>
              </div>

              <p className="text-xs text-primary/80 dark:text-muted leading-relaxed font-medium">
                {laundryToday
                  ? `${laundryToday.description}. Drop or collect clothes between ${laundryToday.timeSlot}.`
                  : 'No scheduled laundry pick/drop for your hostel today.'}
              </p>
            </div>

            <div className="mt-4 pt-2.5 border-t border-border flex items-center justify-between text-[11px] font-mono text-primary/75 dark:text-muted">
              <span>Manager: <strong className="text-primary font-semibold">{LAUNDRY_MANAGER.name}</strong></span>
              <a
                href={`tel:+91${LAUNDRY_MANAGER.phone}`}
                onClick={e => e.stopPropagation()}
                className="text-brand font-bold underline"
              >
                {LAUNDRY_MANAGER.phone}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
