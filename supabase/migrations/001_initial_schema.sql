-- ============================================================
-- MCA-DS WORKSPACE
-- Migration 001: Initial Academic Workspace Schema
-- ============================================================

create extension if not exists "pgcrypto";


-- ============================================================
-- ENUMS
-- ============================================================

create type public.calendar_event_type as enum (
  'holiday',
  'partial_holiday',
  'exam',
  'special_class',
  'cancelled_class',
  'other'
);

create type public.attendance_status as enum (
  'present',
  'absent',
  'late',
  'excused'
);

create type public.task_status as enum (
  'todo',
  'in_progress',
  'completed',
  'cancelled'
);

create type public.task_priority as enum (
  'low',
  'medium',
  'high',
  'urgent'
);


-- ============================================================
-- PROFILES
-- One application profile per Supabase Auth user
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  display_name text,
  avatar_url text,

  timezone text not null default 'Asia/Kolkata',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- ACADEMIC TERMS
-- Example:
-- MCA Semester 1 / 2026-27
-- ============================================================

create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null,

  start_date date not null,
  end_date date not null,

  is_active boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint academic_terms_valid_dates
    check (end_date >= start_date)
);


-- ============================================================
-- COURSES
-- ============================================================

create table public.courses (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  term_id uuid references public.academic_terms(id) on delete set null,

  code text,
  name text not null,

  faculty_name text,

  credits numeric(4,2),

  color text,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- TIMETABLE ENTRIES
--
-- This represents the RECURRING timetable.
--
-- Example:
-- Monday
-- 09:00 - 10:00
-- Artificial Intelligence
--
-- It does NOT represent what happens on a particular date.
-- The Academic Day Resolver will combine this with calendar events.
-- ============================================================

create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  term_id uuid references public.academic_terms(id) on delete set null,

  course_id uuid not null references public.courses(id) on delete cascade,

  day_of_week smallint not null,

  start_time time not null,
  end_time time not null,

  room text,
  faculty_name text,

  notes text,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint timetable_valid_day
    check (day_of_week between 0 and 6),

  constraint timetable_valid_time
    check (end_time > start_time)
);


-- ============================================================
-- CALENDAR EVENTS
--
-- This represents DATE-SPECIFIC changes.
--
-- holiday:
--      Entire academic day affected
--
-- partial_holiday:
--      Only a period of the day affected
--
-- exam:
--      Exam exists on that date/time and normally suppresses
--      overlapping regular classes.
--
-- special_class:
--      Allows an additional class outside the recurring timetable.
--
-- cancelled_class:
--      Allows an individual class/date cancellation.
-- ============================================================

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  term_id uuid references public.academic_terms(id) on delete set null,

  event_type public.calendar_event_type not null,

  title text not null,

  description text,

  event_date date not null,

  start_time time,
  end_time time,

  location text,

  -- Whether this event changes the normal academic schedule.
  affects_classes boolean not null default true,

  -- Whether this event changes normal mess behavior.
  affects_mess boolean not null default false,

  -- Whether this event changes which classes count toward attendance.
  affects_attendance boolean not null default true,

  -- For exam events.
  course_id uuid references public.courses(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint calendar_event_valid_time
    check (
      (start_time is null and end_time is null)
      or
      (start_time is not null and end_time is not null and end_time > start_time)
    ),

  constraint calendar_event_partial_time
    check (
      event_type <> 'partial_holiday'
      or
      (start_time is not null and end_time is not null)
    )
);


-- ============================================================
-- ATTENDANCE RECORDS
--
-- Attendance is attached to:
--
-- user
-- timetable entry
-- actual calendar date
--
-- The Academic Day Resolver determines whether that class
-- should actually count.
-- ============================================================

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  timetable_entry_id uuid not null
    references public.timetable_entries(id) on delete cascade,

  class_date date not null,

  status public.attendance_status not null,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint attendance_unique_class
    unique (user_id, timetable_entry_id, class_date)
);


-- ============================================================
-- TASKS
-- ============================================================

create table public.tasks (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null,
  description text,

  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',

  due_at timestamptz,

  completed_at timestamptz,

  course_id uuid references public.courses(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- WEEKLY MESS SCHEDULE
--
-- Recurring mess schedule.
--
-- Example:
-- Monday breakfast
-- Monday lunch
-- Monday dinner
-- ============================================================

create table public.mess_schedules (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  day_of_week smallint not null,

  meal_name text not null,

  start_time time not null,
  end_time time not null,

  menu text,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint mess_schedule_valid_day
    check (day_of_week between 0 and 6),

  constraint mess_schedule_valid_time
    check (end_time > start_time)
);


-- ============================================================
-- MESS OVERRIDES
--
-- Allows a particular date to have a different mess schedule.
--
-- Example:
-- Holiday → Breakfast 08:00 instead of 07:30
-- ============================================================

create table public.mess_overrides (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  override_date date not null,

  meal_name text not null,

  start_time time,
  end_time time,

  menu text,

  is_cancelled boolean not null default false,

  reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- INDEXES
-- ============================================================

create index idx_academic_terms_user
  on public.academic_terms(user_id);

create index idx_courses_user
  on public.courses(user_id);

create index idx_courses_term
  on public.courses(term_id);

create index idx_timetable_user
  on public.timetable_entries(user_id);

create index idx_timetable_day
  on public.timetable_entries(day_of_week);

create index idx_timetable_course
  on public.timetable_entries(course_id);

create index idx_calendar_user_date
  on public.calendar_events(user_id, event_date);

create index idx_calendar_type
  on public.calendar_events(event_type);

create index idx_attendance_user_date
  on public.attendance_records(user_id, class_date);

create index idx_attendance_timetable
  on public.attendance_records(timetable_entry_id);

create index idx_tasks_user
  on public.tasks(user_id);

create index idx_tasks_due
  on public.tasks(user_id, due_at);

create index idx_mess_user_day
  on public.mess_schedules(user_id, day_of_week);

create index idx_mess_overrides_user_date
  on public.mess_overrides(user_id, override_date);


-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger academic_terms_updated_at
before update on public.academic_terms
for each row execute function public.set_updated_at();

create trigger courses_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

create trigger timetable_entries_updated_at
before update on public.timetable_entries
for each row execute function public.set_updated_at();

create trigger calendar_events_updated_at
before update on public.calendar_events
for each row execute function public.set_updated_at();

create trigger attendance_records_updated_at
before update on public.attendance_records
for each row execute function public.set_updated_at();

create trigger tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger mess_schedules_updated_at
before update on public.mess_schedules
for each row execute function public.set_updated_at();

create trigger mess_overrides_updated_at
before update on public.mess_overrides
for each row execute function public.set_updated_at();


-- ============================================================
-- AUTO-CREATE PROFILE WHEN A USER SIGNS UP
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  );

  return new;
end;
$$;


create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.academic_terms enable row level security;
alter table public.courses enable row level security;
alter table public.timetable_entries enable row level security;
alter table public.calendar_events enable row level security;
alter table public.attendance_records enable row level security;
alter table public.tasks enable row level security;
alter table public.mess_schedules enable row level security;
alter table public.mess_overrides enable row level security;


-- ============================================================
-- PROFILE POLICIES
-- ============================================================

create policy "Users can view their own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);


-- ============================================================
-- ACADEMIC TERMS POLICIES
-- ============================================================

create policy "Users can view their own terms"
on public.academic_terms
for select
using (auth.uid() = user_id);

create policy "Users can create their own terms"
on public.academic_terms
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own terms"
on public.academic_terms
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own terms"
on public.academic_terms
for delete
using (auth.uid() = user_id);


-- ============================================================
-- COURSES POLICIES
-- ============================================================

create policy "Users can view their own courses"
on public.courses
for select
using (auth.uid() = user_id);

create policy "Users can create their own courses"
on public.courses
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own courses"
on public.courses
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own courses"
on public.courses
for delete
using (auth.uid() = user_id);


-- ============================================================
-- TIMETABLE POLICIES
-- ============================================================

create policy "Users can view their own timetable"
on public.timetable_entries
for select
using (auth.uid() = user_id);

create policy "Users can create their own timetable"
on public.timetable_entries
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own timetable"
on public.timetable_entries
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own timetable"
on public.timetable_entries
for delete
using (auth.uid() = user_id);


-- ============================================================
-- CALENDAR POLICIES
-- ============================================================

create policy "Users can view their own calendar"
on public.calendar_events
for select
using (auth.uid() = user_id);

create policy "Users can create their own calendar events"
on public.calendar_events
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own calendar events"
on public.calendar_events
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own calendar events"
on public.calendar_events
for delete
using (auth.uid() = user_id);


-- ============================================================
-- ATTENDANCE POLICIES
-- ============================================================

create policy "Users can view their own attendance"
on public.attendance_records
for select
using (auth.uid() = user_id);

create policy "Users can create their own attendance"
on public.attendance_records
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own attendance"
on public.attendance_records
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own attendance"
on public.attendance_records
for delete
using (auth.uid() = user_id);


-- ============================================================
-- TASK POLICIES
-- ============================================================

create policy "Users can view their own tasks"
on public.tasks
for select
using (auth.uid() = user_id);

create policy "Users can create their own tasks"
on public.tasks
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own tasks"
on public.tasks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own tasks"
on public.tasks
for delete
using (auth.uid() = user_id);


-- ============================================================
-- MESS SCHEDULE POLICIES
-- ============================================================

create policy "Users can view their own mess schedules"
on public.mess_schedules
for select
using (auth.uid() = user_id);

create policy "Users can create their own mess schedules"
on public.mess_schedules
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own mess schedules"
on public.mess_schedules
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own mess schedules"
on public.mess_schedules
for delete
using (auth.uid() = user_id);


-- ============================================================
-- MESS OVERRIDE POLICIES
-- ============================================================

create policy "Users can view their own mess overrides"
on public.mess_overrides
for select
using (auth.uid() = user_id);

create policy "Users can create their own mess overrides"
on public.mess_overrides
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own mess overrides"
on public.mess_overrides
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own mess overrides"
on public.mess_overrides
for delete
using (auth.uid() = user_id);


-- ============================================================
-- END MIGRATION 001
-- ============================================================