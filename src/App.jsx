import { useEffect, useMemo, useState } from "react";
import {
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckSquare,
  CircleUserRound,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Utensils,
  X,
} from "lucide-react";

import { supabase } from "./lib/supabase";
import {
  calculateAttendance,
  resolveClassForDate,
} from "./engine/academicDay";

/* =========================================================
   CONSTANTS
========================================================= */

const navItems = [
  {
    to: "/",
    label: "Today",
    icon: LayoutDashboard,
    end: true,
  },
  {
    to: "/schedule",
    label: "Schedule",
    icon: CalendarDays,
  },
  {
    to: "/attendance",
    label: "Attendance",
    icon: CheckSquare,
  },
  {
    to: "/tasks",
    label: "Tasks",
    icon: CheckSquare,
  },
  {
    to: "/hostel",
    label: "Hostel",
    icon: Utensils,
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
  },
];

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/* =========================================================
   HELPERS
========================================================= */

function isoDate(date = new Date()) {
  const d = new Date(date);

  d.setMinutes(
    d.getMinutes() - d.getTimezoneOffset()
  );

  return d.toISOString().slice(0, 10);
}

function prettyDate(dateString) {
  if (!dateString) return "—";

  return new Date(
    `${dateString}T00:00:00`
  ).toLocaleDateString([], {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(value) {
  if (!value) return "—";

  const raw = String(value);

  const parts = raw.split(":");

  const hours = Number(parts[0]);
  const minutes = Number(parts[1] || 0);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return raw;
  }

  const d = new Date();

  d.setHours(hours, minutes, 0, 0);

  return d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeToMinutes(value) {
  if (!value) return 0;

  const parts = String(value)
    .split(":")
    .map(Number);

  return (
    (parts[0] || 0) * 60 +
    (parts[1] || 0)
  );
}

function isCompletedTask(task) {
  const status = String(
    task?.status || ""
  ).toLowerCase();

  return (
    Boolean(task?.completed_at) ||
    status === "completed"
  );
}

function getTaskStatusForToggle(task, complete) {
  if (complete) {
    return "completed";
  }

  const current = String(
    task?.status || ""
  ).toLowerCase();

  if (current === "completed") return "todo";
  if (current === "cancelled") return "todo";

  return "in_progress";
}

function errorMessage(error) {
  if (!error) return "";

  return (
    error.message ||
    error.details ||
    error.hint ||
    "Something went wrong."
  );
}

/* =========================================================
   AUTH SCREEN
========================================================= */

function AuthScreen() {
  const [mode, setMode] = useState("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();

    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (mode === "signup") {
        const { data, error: signUpError } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                full_name: name.trim(),
                display_name: name.trim(),
              },
            },
          });

        if (signUpError) {
          throw signUpError;
        }

        /*
         * If email confirmation is disabled, Supabase may
         * already authenticate the user.
         */
        if (data?.session) {
          setMessage(
            "Account created successfully."
          );
        } else {
          setMessage(
            "Account created. Check your email if confirmation is enabled."
          );
        }

        setMode("signin");
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (signInError) {
          throw signInError;
        }
      }
    } catch (error) {
      setError(
        errorMessage(error) ||
          "Authentication failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="brand centered">
          <div className="brand-mark">
            <GraduationCap size={21} />
          </div>

          <div>
            <strong>MCA-DS</strong>
            <span>Workspace</span>
          </div>
        </div>

        <div className="auth-heading">
          <p className="eyebrow">
            ACADEMIC OS
          </p>

          <h1>
            {mode === "signin"
              ? "Welcome back."
              : "Create your workspace."}
          </h1>

          <p className="muted">
            Your academic data is private to your
            account.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="stack"
        >
          {mode === "signup" && (
            <label>
              Name

              <input
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="Your name"
                required
              />
            </label>
          )}

          <label>
            Email

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password

            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="••••••••"
              required
            />
          </label>

          {error && (
            <div className="notice error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="notice">
              <span>{message}</span>
            </div>
          )}

          <button
            className="primary-btn"
            disabled={busy}
            type="submit"
          >
            {busy
              ? "Working…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <button
          className="text-btn"
          type="button"
          onClick={() => {
            setMode(
              mode === "signin"
                ? "signup"
                : "signin"
            );

            setError("");
            setMessage("");
          }}
        >
          {mode === "signin"
            ? "Create a new account"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   WORKSPACE DATA HOOK
========================================================= */

function useWorkspace(user) {
  const [data, setData] = useState({
    profile: null,
    term: null,
    courses: [],
    timetable: [],
    events: [],
    attendance: [],
    tasks: [],
    mess: [],
    messOverrides: [],

    loading: true,
    error: "",
    warnings: [],
  });

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;

    async function load() {
      /*
       * Important:
       * This hook ALWAYS exists in App().
       * We only skip its database work when there is
       * no authenticated user.
       */

      if (!user) {
        if (alive) {
          setData({
            profile: null,
            term: null,
            courses: [],
            timetable: [],
            events: [],
            attendance: [],
            tasks: [],
            mess: [],
            messOverrides: [],
            loading: false,
            error: "",
            warnings: [],
          });
        }

        return;
      }

      setData((current) => ({
        ...current,
        loading: true,
        error: "",
        warnings: [],
      }));

      try {
        const today = new Date();

        const start = new Date(today);
        start.setDate(
          today.getDate() - 60
        );

        const end = new Date(today);
        end.setDate(
          today.getDate() + 90
        );

        /*
         * DO NOT use Promise.all with immediate throw here.
         *
         * One RLS-protected optional table should not make
         * the entire dashboard blank.
         */

        const queries = {
          profile: supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle(),

          term: supabase
            .from("academic_terms")
            .select("*")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("start_date", {
              ascending: false,
            })
            .limit(1)
            .maybeSingle(),

          courses: supabase
            .from("courses")
            .select("*")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("name"),

          timetable: supabase
            .from("timetable_entries")
            .select("*")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("day_of_week")
            .order("start_time"),

          events: supabase
            .from("calendar_events")
            .select("*")
            .eq("user_id", user.id)
            .gte(
              "event_date",
              isoDate(start)
            )
            .lte(
              "event_date",
              isoDate(end)
            )
            .order("event_date")
            .order("start_time"),

          attendance: supabase
            .from("attendance_records")
            .select("*")
            .eq("user_id", user.id)
            .order("class_date", {
              ascending: false,
            }),

          tasks: supabase
            .from("tasks")
            .select("*")
            .eq("user_id", user.id)
            .order("due_at", {
              ascending: true,
              nullsFirst: false,
            }),

          mess: supabase
            .from("mess_schedules")
            .select("*")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("day_of_week")
            .order("start_time"),

          messOverrides: supabase
            .from("mess_overrides")
            .select("*")
            .eq("user_id", user.id)
            .gte(
              "override_date",
              isoDate(start)
            )
            .lte(
              "override_date",
              isoDate(end)
            )
            .order("override_date")
            .order("start_time"),
        };

        const entries =
          await Promise.all(
            Object.entries(queries).map(
              async ([key, query]) => {
                try {
                  const result =
                    await query;

                  return [
                    key,
                    result,
                  ];
                } catch (error) {
                  return [
                    key,
                    {
                      data: null,
                      error,
                    },
                  ];
                }
              }
            )
          );

        const resultMap =
          Object.fromEntries(entries);

        const warnings = [];

        for (const [
          key,
          result,
        ] of Object.entries(resultMap)) {
          if (result?.error) {
            warnings.push(
              `${key}: ${errorMessage(
                result.error
              )}`
            );
          }
        }

        if (!alive) return;

        setData({
          profile:
            resultMap.profile?.data ||
            null,

          term:
            resultMap.term?.data ||
            null,

          courses:
            resultMap.courses?.data ||
            [],

          timetable:
            resultMap.timetable?.data ||
            [],

          events:
            resultMap.events?.data ||
            [],

          attendance:
            resultMap.attendance?.data ||
            [],

          tasks:
            resultMap.tasks?.data ||
            [],

          mess:
            resultMap.mess?.data ||
            [],

          messOverrides:
            resultMap.messOverrides?.data ||
            [],

          loading: false,

          /*
           * Don't show "permission denied" as a fatal
           * white-screen error.
           */
          error: "",

          warnings,
        });
      } catch (error) {
        if (!alive) return;

        setData((current) => ({
          ...current,
          loading: false,
          error:
            errorMessage(error) ||
            "Could not load workspace.",
        }));
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [user, reloadKey]);

  return {
    ...data,

    refresh: () =>
      setReloadKey(
        (value) => value + 1
      ),
  };
}

/* =========================================================
   LAYOUT
========================================================= */

function Layout({
  user,
  workspace,
}) {
  const location = useLocation();

  const currentNav = navItems.find(
    (item) =>
      item.to === location.pathname
  );

  const title =
    currentNav?.label ||
    "Workspace";

  const displayName =
    workspace.profile?.display_name ||
    user.email?.split("@")[0] ||
    "Student";

  return (
    <div className="app-shell">

      <aside className="sidebar">

        <div className="brand">
          <div className="brand-mark">
            <GraduationCap size={20} />
          </div>

          <div>
            <strong>MCA-DS</strong>
            <span>Workspace</span>
          </div>
        </div>

        <nav>
          {navItems.map(
            ({
              to,
              label,
              icon: Icon,
              end,
            }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  isActive
                    ? "nav-link active"
                    : "nav-link"
                }
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            )
          )}
        </nav>

        <div className="sidebar-footer">
          <CircleUserRound size={16} />

          <span>{displayName}</span>

          <button
            title="Sign out"
            type="button"
            onClick={() =>
              supabase.auth.signOut()
            }
          >
            <LogOut size={15} />
          </button>
        </div>

      </aside>

      <main className="main">

        <header className="topbar">
          <div>
            <span className="topbar-title">
              {title}
            </span>

            <span className="topbar-date">
              {prettyDate(isoDate())}
            </span>
          </div>

          <button
            className="icon-btn"
            title="Refresh data"
            type="button"
            onClick={workspace.refresh}
          >
            <RefreshCw size={17} />
          </button>
        </header>

        {workspace.error && (
          <div className="page">
            <div className="notice error">
              <AlertCircle size={17} />
              <span>
                {workspace.error}
              </span>
            </div>
          </div>
        )}

        {workspace.warnings?.length > 0 && (
          <div className="page workspace-warning">
            <div className="notice">
              <AlertCircle size={17} />

              <span>
                Some optional workspace data
                could not be loaded. Check
                your Supabase RLS policies.
              </span>
            </div>
          </div>
        )}

        <Routes>

          <Route
            path="/"
            element={
              <Today
                workspace={workspace}
              />
            }
          />

          <Route
            path="/schedule"
            element={
              <Schedule
                workspace={workspace}
              />
            }
          />

          <Route
            path="/attendance"
            element={
              <Attendance
                workspace={workspace}
              />
            }
          />

          <Route
            path="/tasks"
            element={
              <Tasks
                workspace={workspace}
              />
            }
          />

          <Route
            path="/hostel"
            element={
              <Hostel
                workspace={workspace}
              />
            }
          />

          <Route
            path="/settings"
            element={
              <SettingsPage
                workspace={workspace}
                user={user}
              />
            }
          />

        </Routes>
      </main>
    </div>
  );
}

/* =========================================================
   DAY RESOLUTION
========================================================= */

/* =========================================================
   TODAY
========================================================= */

function Today({ workspace: w }) {
  const today = isoDate();
  const dow = new Date(`${today}T00:00:00`).getDay();
  const dayEvents = w.events.filter((event) => event.event_date === today);

  const resolved = w.timetable
    .filter((entry) =>
      Number(entry.day_of_week) === dow &&
      entry.is_active !== false &&
      (!w.term?.id || entry.term_id === w.term.id)
    )
    .map((entry) => ({
      ...entry,
      resolution: resolveClassForDate({
        timetableEntry: entry,
        date: today,
        events: dayEvents,
      }),
    }))
    .sort((a, b) =>
      timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
    );

  const classes = resolved.map((item) => ({
    ...item,
    status: item.resolution.held ? "SCHEDULED" : "CANCELLED",
  }));

  const scheduledClasses = classes.filter(
    (entry) => entry.status === "SCHEDULED"
  );

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const nextClass = scheduledClasses.find(
    (entry) => timeToMinutes(entry.start_time) >= nowMinutes
  );

  const attendanceStats = calculateAttendance({
    attendanceRecords: w.attendance,
    timetableEntries: w.timetable,
    calendarEvents: w.events,
  });

  const greeting =
    now.getHours() < 12
      ? "Good morning."
      : now.getHours() < 17
        ? "Good afternoon."
        : "Good evening.";

  const hasExam = dayEvents.some(
    (event) => String(event.event_type || "").toUpperCase() === "EXAM"
  );

  const hasHoliday = dayEvents.some((event) => {
    const type = String(event.event_type || "").toUpperCase();
    return type === "HOLIDAY" || type === "NO_CLASS";
  });

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            {DAY_NAMES[dow].toUpperCase()} · {today}
          </p>
          <h1>{greeting}</h1>
          <p className="muted">
            Your academic day, resolved from your timetable and calendar.
          </p>
        </div>
      </div>

      <div className="grid-3">
        <DayStatusCard
          dayInfo={{
            type: hasHoliday
              ? "HOLIDAY"
              : hasExam
                ? "EXAM"
                : dayEvents.length
                  ? "EVENT"
                  : "NORMAL",
            title:
              dayEvents.find((event) => event.title)?.title || "",
          }}
        />

        <div className="card">
          <span className="label">NEXT CLASS</span>
          {nextClass ? (
            <>
              <h2>
                {getCourseName(w.courses, nextClass.course_id)}
              </h2>
              <p className="muted">
                <Clock3 size={14} /> {" "}
                {fmtTime(nextClass.start_time)} – {fmtTime(nextClass.end_time)}
                {" · "}
                {nextClass.room || "Room TBA"}
              </p>
            </>
          ) : (
            <>
              <h2>—</h2>
              <p className="muted">
                {hasExam
                  ? "Exam day — regular classes are suppressed."
                  : hasHoliday
                    ? "Holiday — no regular classes today."
                    : "No more scheduled classes today."}
              </p>
            </>
          )}
        </div>

        <div className="card">
          <span className="label">ATTENDANCE</span>
          <h2>
            {attendanceStats.percentage === null
              ? "—"
              : `${attendanceStats.percentage}%`}
          </h2>
          <p className="muted">
            {attendanceStats.marked
              ? `${attendanceStats.present} present of ${attendanceStats.marked} marked`
              : "No attendance records yet."}
          </p>
        </div>
      </div>

      <div className="section-title">
        <h2>Today's resolved schedule</h2>
        <span className="muted">
          {scheduledClasses.length} scheduled
        </span>
      </div>

      <div className="timeline-card">
        {classes.length === 0 ? (
          <Empty text="No timetable configured for today." />
        ) : (
          <div className="timeline">
            {classes.map((entry) => (
              <ClassRow
                key={entry.id}
                item={entry}
                course={w.courses.find(
                  (course) => course.id === entry.course_id
                )}
              />
            ))}
          </div>
        )}
      </div>

      {dayEvents.length > 0 && (
        <div className="card event-list-card">
          <div className="section-title">
            <h2>Today's calendar events</h2>
          </div>
          {dayEvents.map((event) => (
            <div className="service-row" key={event.id}>
              <div>
                <strong>{event.title}</strong>
                <span>
                  {event.start_time
                    ? fmtTime(event.start_time)
                    : "All day"}
                  {event.end_time
                    ? ` – ${fmtTime(event.end_time)}`
                    : ""}
                </span>
              </div>
              {event.location && <p>{event.location}</p>}
            </div>
          ))}
        </div>
      )}

      {w.term && (
        <div className="term-strip">
          <BookOpen size={16} />
          <span>
            <strong>{w.term.name}</strong> · {w.term.start_date} → {w.term.end_date}
          </span>
        </div>
      )}
    </section>
  );
}

/* =========================================================
   DAY STATUS
========================================================= */

function DayStatusCard({
  dayInfo,
}) {
  let title = "Normal Day";
  let description =
    "No academic exceptions are applied.";

  if (dayInfo.type === "HOLIDAY") {
    title = "Holiday";
    description =
      dayInfo.title ||
      "No classes today.";
  }

  if (dayInfo.type === "EVENT") {
    title = "Event Day";
    description =
      dayInfo.title ||
      "A calendar event is active.";
  }

  return (
    <div className="card status-card">

      <span className="label">
        DAY STATUS
      </span>

      <h2>{title}</h2>

      <p className="muted">
        {description}
      </p>

    </div>
  );
}

/* =========================================================
   CLASS ROW
========================================================= */

function ClassRow({
  item,
  course,
}) {
  const cancelled =
    item.status ===
    "CANCELLED";

  return (
    <div
      className={`class-row ${
        cancelled
          ? "cancelled"
          : ""
      }`}
    >

      <div className="time">

        {fmtTime(
          item.start_time
        )}

        <small>
          {fmtTime(
            item.end_time
          )}
        </small>

      </div>

      <div className="class-dot" />

      <div className="class-main">

        <strong>
          {course?.name ||
            course?.code ||
            "Class"}
        </strong>

        <span>
          {course?.code
            ? `${course.code} · `
            : ""}

          {item.room ||
            "Room TBA"}

          {item.faculty_name
            ? ` · ${item.faculty_name}`
            : ""}
        </span>

      </div>

      <span className="class-status">
        {cancelled
          ? "Cancelled"
          : "Scheduled"}
      </span>

    </div>
  );
}

/* =========================================================
   SCHEDULE
========================================================= */

function Schedule({
  workspace: w,
}) {
  return (
    <section className="page">

      <div className="page-header">

        <div>
          <p className="eyebrow">
            WEEKLY TIMETABLE
          </p>

          <h1>Schedule</h1>

          <p className="muted">
            Recurring classes from
            your Supabase timetable.
          </p>
        </div>

      </div>

      <div className="week-grid">

        {[
          1,
          2,
          3,
          4,
          5,
          6,
          0,
        ].map((dayNumber) => {
          const rows =
            w.timetable
              .filter(
                (entry) =>
                  Number(
                    entry.day_of_week
                  ) === dayNumber
              )
              .sort(
                (a, b) =>
                  timeToMinutes(
                    a.start_time
                  ) -
                  timeToMinutes(
                    b.start_time
                  )
              );

          const name =
            DAY_NAMES[dayNumber];

          return (
            <div
              className="day-column"
              key={name}
            >

              <div className="day-head">

                <strong>
                  {name.slice(0, 3)}
                </strong>

                <span>
                  {rows.length}
                </span>

              </div>

              {rows.length ? (
                rows.map((entry) => (
                  <div
                    className="mini-class"
                    key={entry.id}
                  >

                    <b>
                      {fmtTime(
                        entry.start_time
                      )}
                    </b>

                    <strong>
                      {getCourseName(
                        w.courses,
                        entry.course_id
                      )}
                    </strong>

                    <span>
                      {entry.room ||
                        "TBA"}
                    </span>

                  </div>
                ))
              ) : (
                <span className="muted tiny">
                  No classes
                </span>
              )}

            </div>
          );
        })}

      </div>

    </section>
  );
}

/* =========================================================
   ATTENDANCE
========================================================= */

function Attendance({ workspace: w }) {
  const today = isoDate();
  const fromDate = w.term?.start_date || today;

  const occurrences = useMemo(() => {
    const rows = [];
    const start = parseLocalDate(fromDate);
    const end = parseLocalDate(today);

    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const date = dateKey(cursor);
      const dayEvents = w.events.filter((event) => event.event_date === date);
      const dow = cursor.getDay();

      const entries = w.timetable
        .filter((entry) =>
          entry.is_active !== false &&
          Number(entry.day_of_week) === dow &&
          (!w.term?.id || entry.term_id === w.term.id)
        )
        .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

      for (const entry of entries) {
        // Prevent attendance from being marked for future classes or classes that have not ended yet
        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        if (date === today) {
          const classEndMinutes = timeToMinutes(entry.end_time);
          if (classEndMinutes > nowMinutes) continue;
        }

        const resolution = resolveClassForDate({
          timetableEntry: entry,
          date,
          events: dayEvents,
        });

        if (!resolution.held) continue;

        const existing = w.attendance.find(
          (record) =>
            record.timetable_entry_id === entry.id &&
            record.class_date === date
        );

        rows.push({
          id: `${entry.id}-${date}`,
          class_date: date,
          entry,
          course: w.courses.find((course) => course.id === entry.course_id),
          record: existing || null,
          status: existing?.status || null,
        });
      }
    }

    return rows.reverse();
  }, [fromDate, today, w.timetable, w.events, w.attendance, w.courses, w.term]);

  const stats = calculateAttendance({
    attendanceRecords: w.attendance,
    timetableEntries: w.timetable,
    calendarEvents: w.events,
  });

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">CLASS RECORDS</p>
          <h1>Attendance</h1>
          <p className="muted">
            Only classes that actually happened count toward attendance.
          </p>
        </div>
      </div>

      <div className="grid-3">
        <Stat
          label="Attendance"
          value={stats.percentage === null ? "—" : `${stats.percentage}%`}
        />
        <Stat label="Present" value={stats.present} />
        <Stat label="Held / Marked" value={`${stats.heldClasses} / ${stats.marked}`} />
      </div>

      <div className="table-card">
        <div className="table-head">
          <strong>Classes</strong>
          <span className="muted">{occurrences.length} held</span>
        </div>

        {occurrences.length ? (
          occurrences.slice(0, 200).map((row) => (
            <AttendanceRow
              key={row.id}
              row={row}
              workspace={w}
            />
          ))
        ) : (
          <Empty text="No held classes found for this term." />
        )}
      </div>
    </section>
  );
}

function AttendanceRow({ row, workspace: w }) {
  const [busy, setBusy] = useState(false);
  const status = String(row.status || "").toLowerCase();

  async function setStatus(nextStatus) {
    if (!row.entry) return;

    // Prevent attendance from being marked for future classes or classes that have not ended yet
    const todayStr = isoDate();
    const classDate = row.class_date;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const classEndMinutes = timeToMinutes(row.entry.end_time);

    if (classDate > todayStr) {
      alert("You cannot mark attendance for a future class.");
      return;
    }

    if (classDate === todayStr && classEndMinutes > nowMinutes) {
      alert("You cannot mark attendance for a class that hasn't finished yet.");
      return;
    }

    const events = w.events.filter(
      (event) => event.event_date === row.class_date
    );

    const resolution = resolveClassForDate({
      timetableEntry: row.entry,
      date: row.class_date,
      events,
    });

    if (!resolution.held) {
      alert("Attendance cannot be recorded because this class was cancelled.");
      return;
    }

    setBusy(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;
      if (!authData?.user) throw new Error("You are not signed in.");

      const payload = {
        user_id: authData.user.id,
        timetable_entry_id: row.entry.id,
        class_date: row.class_date,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };

      if (row.record?.id) {
        const { error } = await supabase
          .from("attendance_records")
          .update({
            status: nextStatus,
            updated_at: payload.updated_at,
          })
          .eq("id", row.record.id)
          .eq("user_id", authData.user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("attendance_records")
          .insert(payload);

        if (error) throw error;
      }

      w.refresh();
    } catch (error) {
      alert(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="att-row">
      <div>
        <strong>
          {row.course?.name || row.course?.code || "Class"}
        </strong>
        <span>
          {row.class_date} · {fmtTime(row.entry?.start_time)} – {fmtTime(row.entry?.end_time)} · {row.entry?.room || "TBA"}
        </span>
      </div>

      <div className="att-actions">
        <button
          disabled={busy}
          type="button"
          className={status === "present" ? "att-present selected" : "att-present"}
          onClick={() => setStatus("present")}
        >
          Present
        </button>

        <button
          disabled={busy}
          type="button"
          className={status === "absent" ? "att-absent selected" : "att-absent"}
          onClick={() => setStatus("absent")}
        >
          Absent
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   TASKS
========================================================= */

function Tasks({
  workspace: w,
}) {
  const [open, setOpen] =
    useState(false);

  const [title, setTitle] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [due, setDue] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const pending =
    w.tasks.filter(
      (task) =>
        !isCompletedTask(task)
    );

  const completed =
    w.tasks.filter(
      (task) =>
        isCompletedTask(task)
    );

  const dueSoon =
    pending.filter((task) => {
      if (!task.due_at) {
        return false;
      }

      const dueDate =
        new Date(task.due_at);

      const now =
        new Date();

      const end =
        new Date(
          now.getTime() +
            7 *
              24 *
              60 *
              60 *
              1000
        );

      return (
        dueDate >= now &&
        dueDate <= end
      );
    });

  async function saveTask(event) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    setBusy(true);

    try {
      const {
        data: authData,
        error: authError,
      } =
        await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      const user =
        authData?.user;

      if (!user) {
        throw new Error(
          "You are not signed in."
        );
      }

      /*
       * The actual tasks table contains:
       * title
       * description
       * status
       * priority
       * due_at
       * completed_at
       *
       * It does NOT contain `completed`.
       */

      const insertPayload = {
        user_id: user.id,
        title: title.trim(),
        description:
          description.trim() ||
          null,
        due_at: due
          ? new Date(
              `${due}T23:59:00`
            ).toISOString()
          : null,

        /*
         * PENDING is the conventional value used here.
         */
        status: "todo",

        /*
         * Priority is an enum in your database.
         * HIGH is intentionally avoided; MEDIUM is used
         * as the neutral default.
         */
        priority: "medium",
      };

      const {
        error,
      } = await supabase
        .from("tasks")
        .insert(insertPayload);

      if (error) {
        throw error;
      }

      setTitle("");
      setDescription("");
      setDue("");
      setOpen(false);

      w.refresh();
    } catch (error) {
      alert(
        errorMessage(error)
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleTask(
    task
  ) {
    const complete =
      !isCompletedTask(task);

    try {
      const newStatus =
        getTaskStatusForToggle(
          task,
          complete
        );

      const payload = {
        status: newStatus,
        completed_at: complete
          ? new Date().toISOString()
          : null,
        updated_at:
          new Date().toISOString(),
      };

      const {
        error,
      } = await supabase
        .from("tasks")
        .update(payload)
        .eq("id", task.id)
        .eq(
          "user_id",
          w.profile?.id
        );

      /*
       * If profile isn't loaded, retry with just ID.
       * RLS should still protect the row.
       */
      if (error) {
        const retry =
          await supabase
            .from("tasks")
            .update(payload)
            .eq(
              "id",
              task.id
            );

        if (retry.error) {
          throw retry.error;
        }
      }

      w.refresh();
    } catch (error) {
      alert(
        errorMessage(error)
      );
    }
  }

  async function deleteTask(
    task
  ) {
    if (
      !window.confirm(
        "Delete this task?"
      )
    ) {
      return;
    }

    try {
      const {
        error,
      } = await supabase
        .from("tasks")
        .delete()
        .eq("id", task.id);

      if (error) {
        throw error;
      }

      w.refresh();
    } catch (error) {
      alert(
        errorMessage(error)
      );
    }
  }

  return (
    <section className="page">

      <div className="page-header split">

        <div>

          <p className="eyebrow">
            ACADEMIC TASKS
          </p>

          <h1>Tasks</h1>

          <p className="muted">
            Assignments, deadlines and
            study work.
          </p>

        </div>

        <button
          className="primary-btn small"
          type="button"
          onClick={() =>
            setOpen(true)
          }
        >
          <Plus size={16} />
          New task
        </button>

      </div>

      <div className="grid-3">

        <Stat
          label="Pending"
          value={pending.length}
        />

        <Stat
          label="Due this week"
          value={dueSoon.length}
        />

        <Stat
          label="Completed"
          value={completed.length}
        />

      </div>

      <div className="task-list">

        {w.tasks.length ? (
          w.tasks.map((task) => {
            const done =
              isCompletedTask(
                task
              );

            const course =
              w.courses.find(
                (item) =>
                  item.id ===
                  task.course_id
              );

            return (
              <div
                className={`task-row ${
                  done
                    ? "done"
                    : ""
                }`}
                key={task.id}
              >

                <button
                  className="check-btn"
                  type="button"
                  onClick={() =>
                    toggleTask(
                      task
                    )
                  }
                >
                  {done ? (
                    <CheckSquare
                      size={18}
                    />
                  ) : (
                    <span />
                  )}
                </button>

                <div>

                  <strong>
                    {task.title}
                  </strong>

                  <span>
                    {course?.code ||
                      course?.name ||
                      "General"}

                    {task.due_at
                      ? ` · Due ${new Date(
                          task.due_at
                        ).toLocaleDateString()}`
                      : ""}
                  </span>

                  {task.description && (
                    <span>
                      {task.description}
                    </span>
                  )}

                </div>

                <button
                  className="icon-btn danger"
                  type="button"
                  onClick={() =>
                    deleteTask(
                      task
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>

              </div>
            );
          })
        ) : (
          <Empty text="No tasks yet." />
        )}

      </div>

      {open && (
        <div className="modal-backdrop">

          <form
            className="modal"
            onSubmit={saveTask}
          >

            <div className="modal-head">

              <h2>New task</h2>

              <button
                type="button"
                className="icon-btn"
                onClick={() =>
                  setOpen(false)
                }
              >
                <X size={17} />
              </button>

            </div>

            <label>
              Title

              <input
                value={title}
                onChange={(e) =>
                  setTitle(
                    e.target.value
                  )
                }
                required
                autoFocus
              />
            </label>

            <label>
              Description

              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(
                    e.target.value
                  )
                }
                rows={3}
              />
            </label>

            <label>
              Due date

              <input
                type="date"
                value={due}
                onChange={(e) =>
                  setDue(
                    e.target.value
                  )
                }
              />
            </label>

            <button
              className="primary-btn"
              disabled={busy}
              type="submit"
            >
              {busy
                ? "Saving…"
                : "Save task"}
            </button>

          </form>

        </div>
      )}

    </section>
  );
}

/* =========================================================
   HOSTEL
========================================================= */

function Hostel({
  workspace: w,
}) {
  const dow =
    new Date().getDay();

  const regularMess =
    w.mess.filter(
      (item) =>
        Number(
          item.day_of_week
        ) === dow
    );

  const today =
    isoDate();

  const overrides =
    w.messOverrides.filter(
      (item) =>
        item.override_date ===
        today
    );

  /*
   * If an override exists for the same meal,
   * it replaces the regular schedule.
   */

  const meals = regularMess
    .map((meal) => {
      const override =
        overrides.find(
          (item) =>
            String(
              item.meal_name
            ).toLowerCase() ===
            String(
              meal.meal_name
            ).toLowerCase()
        );

      return {
        ...meal,
        override,
      };
    });

  return (
    <section className="page">

      <div className="page-header">

        <div>

          <p className="eyebrow">
            HOSTEL SERVICES
          </p>

          <h1>Hostel</h1>

          <p className="muted">
            Today's mess schedule
            and menu.
          </p>

        </div>

      </div>

      <div className="two-col">

        <div className="card">

          <div className="section-title">

            <h2>Mess</h2>

            <span className="muted">
              {DAY_NAMES[dow]}
            </span>

          </div>

          {meals.length ? (
            meals.map((meal) => {
              const override =
                meal.override;

              const cancelled =
                override?.is_cancelled;

              return (
                <div
                  className="service-row"
                  key={meal.id}
                >

                  <div>

                    <strong>
                      {meal.meal_name}
                    </strong>

                    <span>
                      {fmtTime(
                        override?.start_time ||
                          meal.start_time
                      )}

                      {" – "}

                      {fmtTime(
                        override?.end_time ||
                          meal.end_time
                      )}
                    </span>

                  </div>

                  <p>
                    {cancelled
                      ? override.reason ||
                        "Meal cancelled"
                      : override?.menu ||
                        meal.menu ||
                        "Menu not configured"}
                  </p>

                </div>
              );
            })
          ) : (
            <Empty
              text={
                "No mess schedule configured."
              }
            />
          )}

        </div>

        <div className="card">

          <div className="section-title">

            <h2>Today's overrides</h2>

            <span className="muted">
              {today}
            </span>

          </div>

          {overrides.length ? (
            overrides.map(
              (override) => (
                <div
                  className="service-row"
                  key={override.id}
                >

                  <div>
                    <strong>
                      {override.meal_name}
                    </strong>

                    <span>
                      {override.is_cancelled
                        ? "Cancelled"
                        : "Modified"}
                    </span>
                  </div>

                  <p>
                    {override.is_cancelled
                      ? override.reason ||
                        "Meal cancelled"
                      : override.menu ||
                        "Modified menu"}
                  </p>

                </div>
              )
            )
          ) : (
            <Empty
              text={
                "No special mess overrides for today."
              }
            />
          )}

        </div>

      </div>

    </section>
  );
}

/* =========================================================
   SETTINGS
========================================================= */

function SettingsPage({
  workspace: w,
  user,
}) {
  const [name, setName] =
    useState(
      w.profile?.display_name ||
        ""
    );

  const [busy, setBusy] =
    useState(false);

  useEffect(() => {
    setName(
      w.profile?.display_name ||
        ""
    );
  }, [
    w.profile,
  ]);

  async function saveProfile() {
    setBusy(true);

    try {
      const {
        error,
      } = await supabase
        .from("profiles")
        .update({
          display_name:
            name.trim(),
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          user.id
        );

      if (error) {
        throw error;
      }

      w.refresh();
    } catch (error) {
      alert(
        errorMessage(error)
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">

      <div className="page-header">

        <div>

          <p className="eyebrow">
            ACCOUNT
          </p>

          <h1>Settings</h1>

          <p className="muted">
            Profile and academic
            configuration.
          </p>

        </div>

      </div>

      <div className="two-col">

        <div className="card stack">

          <h2>Profile</h2>

          <label>
            Display name

            <input
              value={name}
              onChange={(e) =>
                setName(
                  e.target.value
                )
              }
            />
          </label>

          <label>
            Email

            <input
              value={
                user.email || ""
              }
              disabled
            />
          </label>

          <button
            className="primary-btn"
            disabled={busy}
            type="button"
            onClick={
              saveProfile
            }
          >
            {busy
              ? "Saving…"
              : "Save profile"}
          </button>

        </div>

        <div className="card">

          <h2>Active term</h2>

          {w.term ? (
            <>
              <p className="term-name">
                {w.term.name}
              </p>

              <p className="muted">
                {w.term.start_date}
                {" → "}
                {w.term.end_date}
              </p>
            </>
          ) : (
            <Empty
              text={
                "No active academic term configured."
              }
            />
          )}

        </div>

      </div>

    </section>
  );
}

/* =========================================================
   SHARED COMPONENTS
========================================================= */

function Stat({
  label,
  value,
}) {
  return (
    <div className="card">

      <span className="label">
        {label}
      </span>

      <h2>{value}</h2>

    </div>
  );
}

function Empty({
  text,
}) {
  return (
    <div className="empty">

      <CalendarDays size={22} />

      <span>{text}</span>

    </div>
  );
}

/* =========================================================
   DATA HELPERS
========================================================= */

function getCourseName(
  courses,
  courseId
) {
  const course =
    courses.find(
      (item) =>
        item.id === courseId
    );

  if (!course) {
    return "Class";
  }

  return (
    course.name ||
    course.code ||
    "Class"
  );
}

function parseLocalDate(value) {
  return new Date(`${value}T00:00:00`);
}

function dateKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(value, amount) {
  const d = parseLocalDate(value);
  d.setDate(d.getDate() + amount);
  return dateKey(d);
}

function rangesOverlap(startA, endA, startB, endB) {
  return (
    timeToMinutes(startA) < timeToMinutes(endB) &&
    timeToMinutes(endA) > timeToMinutes(startB)
  );
}

/* =========================================================
   APP
========================================================= */

function App() {
  /*
   * CRITICAL:
   *
   * These hooks must execute on EVERY render.
   *
   * The old version did:
   *
   * if (!user) return ...
   * const workspace = useWorkspace(user)
   *
   * which changes the number/order of hooks when authentication
   * changes and causes:
   *
   * "Rendered more hooks than during the previous render."
   */

  const [user, setUser] =
    useState(undefined);

  /*
   * useWorkspace is deliberately called unconditionally.
   */
  const workspace =
    useWorkspace(user);

  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      try {
        const {
          data,
          error,
        } =
          await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!mounted) return;

        setUser(
          data.session?.user ||
            null
        );
      } catch (error) {
        console.error(
          "Session error:",
          error
        );

        if (mounted) {
          setUser(null);
        }
      }
    }

    getInitialSession();

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (mounted) {
            setUser(
              session?.user ||
                null
            );
          }
        }
      );

    return () => {
      mounted = false;

      authListener?.subscription?.unsubscribe();
    };
  }, []);

  /*
   * Supabase client unavailable.
   */
  if (!supabase) {
    return (
      <div className="auth-page">
        <div className="auth-card">

          <h1>
            Supabase not configured
          </h1>

          <p className="muted">
            Configure your Supabase
            project URL and anon/
            publishable key.
          </p>

        </div>
      </div>
    );
  }

  /*
   * Initial authentication state.
   */
  if (user === undefined) {
    return (
      <div className="loading-page">
        Loading workspace…
      </div>
    );
  }

  /*
   * Not authenticated.
   */
  if (!user) {
    return <AuthScreen />;
  }

  /*
   * Authenticated.
   */
  if (workspace.loading) {
    return (
      <div className="loading-page">
        Loading your workspace…
      </div>
    );
  }

  return (
    <Layout
      user={user}
      workspace={workspace}
    />
  );
}

export default App;