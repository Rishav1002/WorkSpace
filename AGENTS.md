# WorkSpace — Project Handoff & Development Rules

> **Note for AI Agents & Developers:** This file documents the architecture, authoritative business logic, current system state, and strict development rules for **WorkSpace**. Read this file before making any changes.

---

## 1. Project Overview & Architecture

**WorkSpace** is an academic companion application designed for college/university students (specifically configured for MCA students). It provides timetable management, real-time class tracking, intelligent attendance analytics, assignment tracking, hostel/mess logistics, and offline data synchronization.

### Tech Stack
- **Framework:** React 18 + Vite (TypeScript)
- **Styling:** Tailwind CSS (Dark/Light mode support, IBM Plex Sans / Space Grotesk / IBM Plex Mono fonts)
- **Icons:** `lucide-react`
- **Persistence & Offline:** Dual-layer architecture:
  - **Cloud:** Supabase (PostgreSQL, Auth, RLS)
  - **Local/Offline:** IndexedDB (Dexie-based) with two-way reconciliation and mutation queues (`src/lib/offline/`)
- **State Management:** React Context (`AppContext.tsx` for academic/timetable state, `AuthContext.tsx` for profile & session management)
- **Design Archetype:** Dense, compact, information-rich academic workstation — high legibility, clean borders, minimal fluff.

---

## 2. Authoritative Rules & Architecture Constraints

### A. Central Resolver Mandate (`attendanceEngine.ts`)
- **Single Source of Truth:** `src/lib/attendanceEngine.ts` is the **only authoritative resolver** for computing daily schedules, attendance impacts, and status overrides.
- **Do NOT duplicate resolution logic:** Never calculate whether a class is cancelled, live, or completed independently in UI components. Always consume:
  - `resolveClassesForDate(dateStr, slots, overrides, calendarEvents, attendanceRecords, academicScope)`
  - `getExamForDate(dateStr, calendarEvents, academicScope, timetableSlots)`
  - `calculateAttendanceAnalytics(resolvedHistory, subjects)`

### B. Exam-Day Rule
- **Full-Day Cancellation:** When an official or custom exam is scheduled on a date for a student/group, **the entire day's regular classes are cancelled**.
- **Zero Penalty:** Exam days contribute:
  - `0` held periods
  - `0` absent periods
  - `0` attendance percentage penalties
- **Exam Occurrence Injection:** The central engine replaces regular lectures with the active exam occurrence (e.g., 10:00 AM – 11:30 AM in the designated Exam Hall).
- **UI Representation:** Both Timeline and Master Grid timetable views must span the day with a prominent **Exam Day Banner** indicating class suspension.

### C. Academic Scoping
- Students belong to an academic group (e.g. `MCA-G1`, `MCA-G2`, `MCA-ALL`), elective choices, and term/semester.
- Timetable slots, calendar events, exams, and subject pickers must always be filtered through `AcademicScope` (derived from `user.group` or explicit context).

### D. Timetable Merge Logic (Two-Period Classes)
- Classes lasting $\ge 80$ minutes (such as 100-minute consecutive lab or double-period lecture blocks) must be rendered as a **single unified cell** in the Master Grid table using `colSpan={cell.colSpan}`.
- Do not render duplicate split cards for consecutive slots belonging to the same continuous class.
- Display "2 Periods", room, timing, and instructor within the single expanded block.

### E. Subject Labels & Dropdowns
- **Canonical Short Codes:** Use concise canonical short codes (e.g. `APP`, `SE`, `WT`, `OS`, `BDIJ`) in compact selectors, task dropdowns, grid chips, and table headers.
- **Tooltips for Full Titles:** Full subject titles (e.g. `Advanced Programming with Python`) must be provided via `title` tooltips or detail drawers without bloating compact form elements.

### F. Floating Navigation Clearance
- `src/components/Layout/AppShell.tsx` features a floating/fixed bottom navigation bar.
- The main scrolling container **MUST** retain adequate bottom padding (`pb-[calc(6rem+env(safe-area-inset-bottom,1rem))]`) and an inline buffer element to prevent cards, buttons, and floating modals from being clipped or hidden.

### G. Repository Pattern & Offline First
- UI components must never make raw database calls.
- Use the typed repositories under `src/lib/repository/`:
  - `timetableRepository.ts`
  - `attendanceRepository.ts`
  - `taskRepository.ts`
  - `calendarRepository.ts`
  - `hostelRepository.ts`
  - `authRepository.ts`
  - `profileRepository.ts`
  - `deviceRepository.ts`
  - `syncRepository.ts`

---

## 3. Directory Structure

```
src/
├── components/
│   ├── Common/              # SearchPalette, QuickShortcuts, SyncStatusBanner
│   ├── Layout/              # AppShell (responsive navigation, header, sidebar)
│   └── Views/
│       ├── HubView.tsx      # Today's overview, live countdown, quick marking
│       ├── ScheduleView.tsx # Timeline & Master Grid, merge logic, exam banners
│       ├── TasksView.tsx    # Academic task manager, scoped subject dropdowns
│       ├── CalendarView.tsx # Semester calendar, exams, holidays
│       ├── HostelView.tsx   # Hostel details, mess menus, warden contacts
│       ├── AnalyticsView.tsx# Attendance charts, criteria simulation, safe cuts
│       ├── SettingsView.tsx # Device limits, audit logs, data export/import
│       └── AdminView.tsx    # Master timetable publisher, audit log reverter
├── context/
│   ├── AppContext.tsx       # Core academic state & repository operations
│   └── AuthContext.tsx      # User profile, authentication, device limits
├── data/
│   └── masterData.ts        # Official subjects, faculty, slots, academic calendar
├── lib/
│   ├── attendanceEngine.ts  # Authoritative class and attendance resolver
│   ├── timeUtils.ts         # Minute-based calculations, date formatting
│   ├── storage.ts           # Local storage defaults and keys
│   ├── supabase.ts          # Supabase client initialization
│   ├── offline/             # Dexie IndexedDB schemas, sync queue, migrations
│   └── repository/          # Offline-first repositories for all entities
└── types.ts                 # Canonical TypeScript interfaces & types
```

---

## 4. Current State of Key Features

| Feature | State | Key Files |
| :--- | :--- | :--- |
| **Floating Navigation** | Fixed with safe-area bottom padding & content buffer | `src/components/Layout/AppShell.tsx` |
| **Timetable 2-Period Merge** | Fully implemented in Grid table view with `colSpan` | `src/components/Views/ScheduleView.tsx` |
| **Exam Day Cancellation** | Centralized in resolver; banner rendered in Timeline & Grid | `src/lib/attendanceEngine.ts`, `ScheduleView.tsx` |
| **Task Subject Dropdown** | Scoped to academic group, uses canonical short codes | `src/components/Views/TasksView.tsx` |
| **Attendance Engine** | Computes live/completed/holiday/exam states + safe cuts | `src/lib/attendanceEngine.ts` |
| **Offline Synchronization** | IndexedDB fallback, multi-device tracking, conflict UI | `src/lib/offline/`, `src/lib/repository/` |
| **Admin & Overrides** | Personal occurrence overrides + admin master publisher | `ScheduleView.tsx`, `AdminView.tsx` |

---

## 5. Development Guidelines for Future Changes

1. **Do Not Rebuild From Scratch:** Preserve the existing architecture, database tables, context providers, and design language.
2. **Never Duplicate Resolver Logic:** Always route class status, exam day checks, or attendance calculations through `attendanceEngine.ts`.
3. **Verify Builds Sequentially:**
   - Run `lint_applet` (`tsc --noEmit`) to catch type mismatches early.
   - Run `compile_applet` to verify full Vite build readiness.
4. **Preserve Responsive Layouts:** Verify that controls work on small screens (320px–390px) up to desktop (1440px+).
5. **No Fake / Mock Data for Core Auth:** Respect real session state and repositories.
