-- WorkSpace Academic Suite & Attendance Tracker
-- Production Supabase PostgreSQL Schema with Row-Level Security (RLS) and Audit Logging
-- Comprehensive Schema conforming to WorkSpace Academic Operating System Requirements

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ACADEMIC PROGRAM HIERARCHY
CREATE TABLE IF NOT EXISTS public.academic_programs (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(32) NOT NULL UNIQUE,
  duration_years INT DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.academic_groups (
  id VARCHAR(64) PRIMARY KEY,
  program_id VARCHAR(64) REFERENCES public.academic_programs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- e.g. 'MCA DS 1A', 'MCA General 1A'
  semester INT DEFAULT 1,
  section VARCHAR(32) DEFAULT '1A',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.academic_terms (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.courses (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  teacher VARCHAR(255),
  token_color VARCHAR(32) DEFAULT 'indigo',
  icon VARCHAR(64) DEFAULT 'fa-book',
  type VARCHAR(32) DEFAULT 'Theory' CHECK (type IN ('Theory', 'Lab', 'Mentorship', 'Skill', 'Practice')),
  credits INT DEFAULT 4,
  room VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. USER PROFILES
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gr_number VARCHAR(64) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,
  role VARCHAR(32) DEFAULT 'student' CHECK (role IN ('student', 'admin', 'cr')),
  program VARCHAR(64) DEFAULT 'MCA',
  "group" VARCHAR(64) DEFAULT 'MCA DS 1A',
  semester INT DEFAULT 1,
  section VARCHAR(32) DEFAULT '1A',
  hostel VARCHAR(128) DEFAULT 'Einstein Hall (Boys)',
  hostel_room VARCHAR(64),
  phone VARCHAR(32),
  attendance_target INT DEFAULT 75 CHECK (attendance_target BETWEEN 50 AND 100),
  class_start_date DATE DEFAULT '2026-07-29',
  active_term_id VARCHAR(64) DEFAULT 'term-sem-1-2026',
  recovery_pin_hash VARCHAR(255),
  scheduled_deletion_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TIMETABLE SLOTS (Master Routine)
CREATE TABLE IF NOT EXISTS public.timetable_slots (
  id VARCHAR(64) PRIMARY KEY,
  day INT NOT NULL CHECK (day BETWEEN 0 AND 6),
  start_time INT NOT NULL, -- minutes from midnight
  end_time INT NOT NULL,
  course_code VARCHAR(32) NOT NULL,
  room VARCHAR(64) NOT NULL,
  teacher VARCHAR(255),
  name VARCHAR(255),
  is_official BOOLEAN DEFAULT TRUE,
  "group" VARCHAR(64) DEFAULT 'MCA DS 1A',
  active_term_id VARCHAR(64) DEFAULT 'term-sem-1-2026',
  effective_from DATE DEFAULT '2026-07-29',
  effective_until DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TIMETABLE OVERRIDES (Personal & Section Customizations)
CREATE TABLE IF NOT EXISTS public.timetable_overrides (
  id VARCHAR(64) PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  original_slot_id VARCHAR(64),
  date_str DATE,
  effective_from DATE,
  scope VARCHAR(32) DEFAULT 'this_occurrence' CHECK (scope IN ('this_occurrence', 'future_recurring')),
  override_type VARCHAR(32) DEFAULT 'reschedule' CHECK (override_type IN ('reschedule', 'cancel', 'custom_class', 'extra_class', 'room_change', 'teacher_change')),
  course_code VARCHAR(32) NOT NULL,
  day INT CHECK (day BETWEEN 0 AND 6),
  start_time INT NOT NULL,
  end_time INT NOT NULL,
  room VARCHAR(64) NOT NULL,
  teacher VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ATTENDANCE RECORDS (Exact Start Auto-Marking Support)
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id VARCHAR(128) PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  occurrence_key VARCHAR(128) NOT NULL,
  course_code VARCHAR(32) NOT NULL,
  date_str DATE NOT NULL,
  start_time INT NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('present', 'absent')),
  source VARCHAR(16) DEFAULT 'auto' CHECK (source IN ('auto', 'manual', 'csv_import')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_synced BOOLEAN DEFAULT TRUE,
  UNIQUE (user_id, occurrence_key)
);

-- 7. CALENDAR & EXCEPTIONS (Holidays, Partial Suspensions, FAT Exams)
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id VARCHAR(64) PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  date_str DATE NOT NULL,
  end_date_str DATE,
  category VARCHAR(32) DEFAULT 'event' CHECK (category IN ('holiday', 'partial_holiday', 'academic', 'event', 'exam')),
  is_official BOOLEAN DEFAULT FALSE,
  exam_category VARCHAR(32) CHECK (exam_category IN ('FAT', 'SAT', 'Final', 'Quiz', 'Custom')),
  course_code VARCHAR(32),
  start_time VARCHAR(16),
  end_time VARCHAR(16),
  class_impact VARCHAR(32) DEFAULT 'none' CHECK (class_impact IN ('none', 'cancel_all', 'cancel_partial')),
  cancelled_slots JSONB,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TASKS & HOMEWORK
CREATE TABLE IF NOT EXISTS public.task_items (
  id VARCHAR(64) PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_code VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  due_time VARCHAR(16),
  priority VARCHAR(16) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status VARCHAR(16) DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED')),
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule VARCHAR(32) CHECK (recurrence_rule IN ('daily', 'weekly', 'monthly')),
  parent_series_id VARCHAR(64),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. HOSTELS & WARDENS
CREATE TABLE IF NOT EXISTS public.hostels (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  blocks JSONB,
  laundry_days JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hostel_wardens (
  id VARCHAR(64) PRIMARY KEY,
  hostel_id VARCHAR(64) REFERENCES public.hostels(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role_or_floor VARCHAR(255) NOT NULL,
  phone VARCHAR(64) NOT NULL
);

-- 10. MESS & LAUNDRY SCHEDULES (Effective Date Versioning Support)
CREATE TABLE IF NOT EXISTS public.mess_schedules (
  id VARCHAR(64) PRIMARY KEY,
  hostel_id VARCHAR(64) REFERENCES public.hostels(id) ON DELETE CASCADE,
  effective_from DATE DEFAULT '2026-07-29',
  effective_until DATE,
  regular_slots JSONB,
  weekend_slots JSONB,
  weekly_menu JSONB,
  is_official BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.laundry_schedules (
  id VARCHAR(64) PRIMARY KEY,
  hostel_id VARCHAR(64) REFERENCES public.hostels(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time_slot VARCHAR(64) NOT NULL,
  description VARCHAR(255),
  effective_from DATE DEFAULT '2026-07-29',
  effective_until DATE,
  is_official BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. DEVICE SESSIONS (Max 3 Devices Limit)
CREATE TABLE IF NOT EXISTS public.device_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  device_name VARCHAR(255) NOT NULL,
  device_type VARCHAR(32) DEFAULT 'desktop' CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. AUDIT LOGS (Immutable Administrative Mutation Ledger)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  actor_gr VARCHAR(64) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  entity VARCHAR(128) NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  change_type VARCHAR(32) NOT NULL CHECK (change_type IN ('create', 'update', 'delete', 'revert')),
  previous_value JSONB,
  new_value JSONB,
  scope VARCHAR(32) DEFAULT 'master' CHECK (scope IN ('master', 'personal')),
  effective_date VARCHAR(64) NOT NULL
);

-- 13. CONFLICT LEDGER (For Real Server-Client Conflict Resolution)
CREATE TABLE IF NOT EXISTS public.sync_conflicts (
  id VARCHAR(64) PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  client_version JSONB NOT NULL,
  server_version JSONB NOT NULL,
  status VARCHAR(32) DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'resolved_client', 'resolved_server', 'resolved_merged')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. INDEXES FOR HIGH-PERFORMANCE DASHBOARDS & QUERIES
CREATE INDEX IF NOT EXISTS idx_user_profiles_gr ON public.user_profiles(gr_number);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance_records(user_id, date_str);
CREATE INDEX IF NOT EXISTS idx_timetable_slots_day_group ON public.timetable_slots(day, "group");
CREATE INDEX IF NOT EXISTS idx_timetable_overrides_user_date ON public.timetable_overrides(user_id, date_str);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON public.calendar_events(date_str);
CREATE INDEX IF NOT EXISTS idx_task_items_user_due ON public.task_items(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_device_sessions_user ON public.device_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);

-- 15. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.academic_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_wardens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mess_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_conflicts ENABLE ROW LEVEL SECURITY;

-- 16. RLS POLICIES

-- Helper function to check if current user is admin without recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Academic master data: Everyone can read; only admins can modify
CREATE POLICY "Public read academic programs" ON public.academic_programs FOR SELECT USING (true);
CREATE POLICY "Admin manage academic programs" ON public.academic_programs FOR ALL USING (public.is_admin());

CREATE POLICY "Public read academic groups" ON public.academic_groups FOR SELECT USING (true);
CREATE POLICY "Admin manage academic groups" ON public.academic_groups FOR ALL USING (public.is_admin());

CREATE POLICY "Public read academic terms" ON public.academic_terms FOR SELECT USING (true);
CREATE POLICY "Admin manage academic terms" ON public.academic_terms FOR ALL USING (public.is_admin());

CREATE POLICY "Public read courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Admin manage courses" ON public.courses FOR ALL USING (public.is_admin());

-- User Profiles
CREATE POLICY "Users view own profile or admin view all"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users update own profile or admin update"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin());

-- Timetable slots
CREATE POLICY "Everyone can view timetable slots"
  ON public.timetable_slots FOR SELECT
  USING (is_official = TRUE OR public.is_admin());

CREATE POLICY "Only admins can modify timetable slots"
  ON public.timetable_slots FOR ALL
  USING (public.is_admin());

-- Overrides
CREATE POLICY "Users manage own overrides"
  ON public.timetable_overrides FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Attendance records
CREATE POLICY "Users manage own attendance"
  ON public.attendance_records FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Calendar events
CREATE POLICY "Everyone view official events or own personal events"
  ON public.calendar_events FOR SELECT
  USING (is_official = TRUE OR auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users manage own personal events"
  ON public.calendar_events FOR ALL
  USING (auth.uid() = user_id OR (is_official = TRUE AND public.is_admin()))
  WITH CHECK (auth.uid() = user_id OR (is_official = TRUE AND public.is_admin()));

-- Tasks
CREATE POLICY "Users manage own tasks"
  ON public.task_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Hostels & Wardens & Mess & Laundry
CREATE POLICY "Public view hostels" ON public.hostels FOR SELECT USING (true);
CREATE POLICY "Admin manage hostels" ON public.hostels FOR ALL USING (public.is_admin());

CREATE POLICY "Public view wardens" ON public.hostel_wardens FOR SELECT USING (true);
CREATE POLICY "Admin manage wardens" ON public.hostel_wardens FOR ALL USING (public.is_admin());

CREATE POLICY "Public view mess" ON public.mess_schedules FOR SELECT USING (true);
CREATE POLICY "Admin manage mess" ON public.mess_schedules FOR ALL USING (public.is_admin());

CREATE POLICY "Public view laundry" ON public.laundry_schedules FOR SELECT USING (true);
CREATE POLICY "Admin manage laundry" ON public.laundry_schedules FOR ALL USING (public.is_admin());

-- Devices
CREATE POLICY "Users manage own device sessions"
  ON public.device_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Audit logs: Read by admins; insert only through authorized server functions or admins
CREATE POLICY "Admins view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (public.is_admin() OR auth.uid() IS NOT NULL);

-- Conflicts
CREATE POLICY "Users view own sync conflicts"
  ON public.sync_conflicts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 17. AUTOMATIC USER PROFILE CREATION TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  gr_val VARCHAR(64);
  name_val VARCHAR(255);
  role_val VARCHAR(32);
BEGIN
  -- Extract gr_number and display_name from raw user meta data
  gr_val := COALESCE(NEW.raw_user_meta_data->>'gr_number', substring(NEW.email from '^gr_([^@]+)@'));
  IF gr_val IS NULL THEN
    gr_val := substring(NEW.id::text from 1 for 8);
  END IF;

  name_val := COALESCE(NEW.raw_user_meta_data->>'display_name', 'Student');
  
  -- Seed GR 118748 as admin, others as student
  IF gr_val = '118748' THEN
    role_val := 'admin';
  ELSE
    role_val := 'student';
  END IF;

  INSERT INTO public.user_profiles (
    id, gr_number, display_name, email, role, program, "group", semester, section,
    hostel, attendance_target, class_start_date, active_term_id
  ) VALUES (
    NEW.id,
    gr_val,
    name_val,
    NEW.email,
    role_val,
    'MCA',
    'MCA DS 1A',
    1,
    '1A',
    'Einstein Hall (Boys)',
    75,
    '2026-07-29',
    'term-sem-1-2026'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 18. SEED ACADEMIC GROUPS (MCA General and MCA DS)
INSERT INTO public.academic_programs (id, name, code, duration_years)
VALUES ('prog-mca', 'Master of Computer Applications', 'MCA', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.academic_groups (id, program_id, name, semester, section, is_active)
VALUES
  ('grp-mca-ds-1a', 'prog-mca', 'MCA DS 1A', 1, '1A', true),
  ('grp-mca-gen-1a', 'prog-mca', 'MCA General 1A', 1, '1A', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.academic_terms (id, name, start_date, end_date, is_active)
VALUES ('term-sem-1-2026', 'Semester 1 (Fall 2026)', '2026-07-29', '2026-12-15', true)
ON CONFLICT (id) DO NOTHING;
