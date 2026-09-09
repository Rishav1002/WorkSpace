# WorkSpace — System Handoff & Development Rules

Please refer to [`AGENTS.md`](./AGENTS.md) at the project root for the authoritative and comprehensive system documentation, architecture constraints, and development guidelines.

### Quick Reference
- **Authoritative Resolver:** `src/lib/attendanceEngine.ts` (`resolveClassesForDate`, `getExamForDate`)
- **Exam-Day Rule:** Official exams cancel all regular classes for that student/group for the entire day with 0 held periods, 0 absent periods, and 0 percentage penalties.
- **Timetable Merging:** Classes lasting $\ge 80$ min are merged into a single cell using `colSpan` in Master Grid view (`src/components/Views/ScheduleView.tsx`).
- **Short Codes:** Use canonical short subject codes (e.g. `APP`, `SE`, `WT`, `OS`, `BDIJ`) in compact dropdowns and chips (`src/components/Views/TasksView.tsx`, `ScheduleView.tsx`).
- **Navigation Clearance:** Bottom padding in `src/components/Layout/AppShell.tsx` preserves clearance for the floating navigation bar.
- **Offline & Storage:** Dual-layer Supabase + IndexedDB repository pattern in `src/lib/repository/` and `src/lib/offline/`.
