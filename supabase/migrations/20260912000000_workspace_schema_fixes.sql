-- ============================================================================
-- Migration: 20260912000000_workspace_schema_fixes.sql
-- Description: Production-safe, non-destructive alignment of Supabase database 
--              with WorkSpace application architecture.
-- 
-- Audit-Hardened Modules:
--   1. MESS SCHEDULES: Safe schema transition preserving legacy data without DROP/CASCADE.
--   2. USER NOTIFICATION SETTINGS: Provisioned with user-scoped RLS policies.
--   3. TIMETABLE SLOTS: Canonical term_id authority + conflict-resolving sync trigger.
--   4. ATTENDANCE RECONCILIATION: Non-destructive deterministic deduplication,
--      complete-payload archival with surrogate PK, and verified post-reconciliation unique constraint.
--   5. DEVICE SESSIONS: User row-locked concurrency, deterministic max-3 active session limit,
--      explicit active-session counting, and rejection of 4th device without revocation.
--   6. ROLE ESCALATION PROTECTION: Hardened trigger & RLS with safe search_path.
--   7. AUDIT LOG INTEGRITY: Server-authoritative RPC + strict admin insert policy.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. MESS SCHEDULES (Safe schema migration preserving all existing data)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_has_legacy_columns BOOLEAN := FALSE;
  v_has_current_columns BOOLEAN := FALSE;
  v_backup_table_name TEXT := 'legacy_mess_schedules_backup';
BEGIN
  -- Check if mess_schedules table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'mess_schedules'
  ) THEN
    -- Check for legacy individual meal columns
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'mess_schedules' 
        AND column_name IN ('meal_name', 'user_id', 'is_cancelled')
    ) INTO v_has_legacy_columns;

    -- Check for current weekly_menu column
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'mess_schedules' 
        AND column_name = 'weekly_menu'
    ) INTO v_has_current_columns;

    -- If legacy structure detected without current weekly_menu column:
    IF v_has_legacy_columns AND NOT v_has_current_columns THEN
      -- Ensure backup table name does not collide with existing backup
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = v_backup_table_name
      ) THEN
        v_backup_table_name := 'legacy_mess_schedules_backup_' || to_char(NOW(), 'YYYYMMDD_HH24MISS');
      END IF;

      RAISE NOTICE 'Detected legacy mess_schedules structure. Renaming to % to preserve data.', v_backup_table_name;
      EXECUTE format('ALTER TABLE public.mess_schedules RENAME TO %I', v_backup_table_name);
    END IF;
  END IF;
END $$;

-- Create canonical mess_schedules if not present
CREATE TABLE IF NOT EXISTS public.mess_schedules (
  id VARCHAR(64) PRIMARY KEY,
  hostel_id VARCHAR(64) REFERENCES public.hostels(id) ON DELETE CASCADE,
  effective_from DATE DEFAULT '2026-07-29',
  effective_until DATE,
  regular_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  weekend_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  weekly_menu JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_official BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all expected columns exist on existing or partially migrated tables
ALTER TABLE public.mess_schedules
  ADD COLUMN IF NOT EXISTS hostel_id VARCHAR(64) REFERENCES public.hostels(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS effective_from DATE DEFAULT '2026-07-29',
  ADD COLUMN IF NOT EXISTS effective_until DATE,
  ADD COLUMN IF NOT EXISTS regular_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS weekend_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS weekly_menu JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_mess_schedules_hostel ON public.mess_schedules(hostel_id, effective_from DESC);

ALTER TABLE public.mess_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mess schedules readable by authenticated users" ON public.mess_schedules;
CREATE POLICY "Mess schedules readable by authenticated users"
  ON public.mess_schedules FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Mess schedules manageable by admin" ON public.mess_schedules;
CREATE POLICY "Mess schedules manageable by admin"
  ON public.mess_schedules FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed official default schedules for hostels if not present
INSERT INTO public.mess_schedules (
  id, hostel_id, effective_from, regular_slots, weekend_slots, weekly_menu, is_official
) VALUES 
(
  'mess-einstein-default',
  'hostel-einstein',
  '2026-07-29',
  '[{"name":"Breakfast","startMin":450,"endMin":540,"timeDisplay":"07:30 AM to 09:00 AM"},{"name":"Lunch","startMin":720,"endMin":840,"timeDisplay":"12:00 PM to 02:00 PM"},{"name":"Evening Snacks","startMin":990,"endMin":1020,"timeDisplay":"04:30 PM to 05:00 PM"},{"name":"Dinner","startMin":1170,"endMin":1260,"timeDisplay":"07:30 PM to 09:00 PM"}]'::jsonb,
  '[{"name":"Breakfast","startMin":480,"endMin":555,"timeDisplay":"08:00 AM to 09:15 AM"},{"name":"Lunch","startMin":750,"endMin":840,"timeDisplay":"12:30 PM to 02:00 PM"},{"name":"Evening Snacks","startMin":990,"endMin":1020,"timeDisplay":"04:30 PM to 05:00 PM"},{"name":"Dinner","startMin":1170,"endMin":1260,"timeDisplay":"07:30 PM to 09:00 PM"}]'::jsonb,
  '{"1":{"breakfast":"Aloo Pyaz Parantha / Butter or Curd / Tea","lunch":"Rajmah Masala / Aloo Nutri Sabji / Rice / Roti / Curd / Salad / Pickle","snacks":"Tea / Samosa with Tomato Sauce","dinner":"Channa Dal Tadka / Gatta Kari Sabji / Rice / Roti / Pickle / Salad / Chutney","dessert":"Sonpapdi"},"2":{"breakfast":"Cornflex / Aloo Sandwich / Banana / Tea / Milk","lunch":"Black Channa / Aloo Capsicum / Peas Pulao / Roti / Salad / Cucumber Raita","snacks":"Tea / Macroni / Tomato Sauce","dinner":"Mix Dal / Zimikand Mutter Sabji / Rice / Roti / Salad / Chutney","dessert":"Kheer"},"3":{"breakfast":"Gobhi Parantha / Curd or Butter / Tea","lunch":"Dal Makhani / Gheeya Sabji / Raita / Nutri Veg Biryani / Roti / Salad / Chutney","snacks":"Tea / Daanish Bunn","dinner":"Masar Dal Sabut / Paneer Makhani~Chicken Curry / Rice / Roti / Salad / Chutney","dessert":"Gulab Jamun"},"4":{"breakfast":"Idly Sambhar / Green Chutney / Banana / Juice / Tea","lunch":"Kari Pakora / Aloo Mutter Sabji / Rice / Roti / Salad / Chutney","snacks":"Tea / Rusk","dinner":"Rajmah Raseela / Paneer Biryani / Curd / Roti / Salad / Chutney","dessert":"Besan Burfi"},"5":{"breakfast":"Ajwain Parantha / Aloo Sabji / Banana / Tea / Milk","lunch":"White Channa / Kadu Khata Meetha / Raita / Veg Pulao / Pickle / Roti / Salad / Papad","snacks":"Tea / Maggi / Tomato Sauce","dinner":"Hari Moong Dal / Veg Manchurian / Fried Rice / Roti / Chutney","dessert":"Sewiyan"},"6":{"breakfast":"Onion Paneer Paratha / Butter / Curd / Pickle / Tea","lunch":"Moongi Masri Dal / Aloo Mushroom Mutter / Curd / Rice / Roti / Salad / Pickle / Chutney","snacks":"Tea / Patties","dinner":"Black Chana / Jeera Aloo / Rice / Roti / Salad / Chutney","dessert":"Kulfi"},"0":{"breakfast":"Channa Bhatura / Pickle / Tea","lunch":"Dal Makhani / Veg Noodles / Curd / Rice / Roti / Salad","snacks":"Coffee / Biscuit / Chips","dinner":"Moth Dal / Mutter Paneer~Egg Curry / Roti / Salad / Chutney","dessert":"Brownie"}}'::jsonb,
  TRUE
),
(
  'mess-curie-default',
  'hostel-curie',
  '2026-07-29',
  '[{"name":"Breakfast","startMin":450,"endMin":540,"timeDisplay":"07:30 AM to 09:00 AM"},{"name":"Lunch","startMin":720,"endMin":840,"timeDisplay":"12:00 PM to 02:00 PM"},{"name":"Evening Snacks","startMin":990,"endMin":1020,"timeDisplay":"04:30 PM to 05:00 PM"},{"name":"Dinner","startMin":1170,"endMin":1260,"timeDisplay":"07:30 PM to 09:00 PM"}]'::jsonb,
  '[{"name":"Breakfast","startMin":480,"endMin":555,"timeDisplay":"08:00 AM to 09:15 AM"},{"name":"Lunch","startMin":750,"endMin":840,"timeDisplay":"12:30 PM to 02:00 PM"},{"name":"Evening Snacks","startMin":990,"endMin":1020,"timeDisplay":"04:30 PM to 05:00 PM"},{"name":"Dinner","startMin":1170,"endMin":1260,"timeDisplay":"07:30 PM to 09:00 PM"}]'::jsonb,
  '{"1":{"breakfast":"Aloo Pyaz Parantha / Butter or Curd / Tea","lunch":"Rajmah Masala / Aloo Nutri Sabji / Rice / Roti / Curd / Salad / Pickle","snacks":"Tea / Samosa with Tomato Sauce","dinner":"Channa Dal Tadka / Gatta Kari Sabji / Rice / Roti / Pickle / Salad / Chutney","dessert":"Sonpapdi"},"2":{"breakfast":"Cornflex / Aloo Sandwich / Banana / Tea / Milk","lunch":"Black Channa / Aloo Capsicum / Peas Pulao / Roti / Salad / Cucumber Raita","snacks":"Tea / Macroni / Tomato Sauce","dinner":"Mix Dal / Zimikand Mutter Sabji / Rice / Roti / Salad / Chutney","dessert":"Kheer"},"3":{"breakfast":"Gobhi Parantha / Curd or Butter / Tea","lunch":"Dal Makhani / Gheeya Sabji / Raita / Nutri Veg Biryani / Roti / Salad / Chutney","snacks":"Tea / Daanish Bunn","dinner":"Masar Dal Sabut / Paneer Makhani~Chicken Curry / Rice / Roti / Salad / Chutney","dessert":"Gulab Jamun"},"4":{"breakfast":"Idly Sambhar / Green Chutney / Banana / Juice / Tea","lunch":"Kari Pakora / Aloo Mutter Sabji / Rice / Roti / Salad / Chutney","snacks":"Tea / Rusk","dinner":"Rajmah Raseela / Paneer Biryani / Curd / Roti / Salad / Chutney","dessert":"Besan Burfi"},"5":{"breakfast":"Ajwain Parantha / Aloo Sabji / Banana / Tea / Milk","lunch":"White Channa / Kadu Khata Meetha / Raita / Veg Pulao / Pickle / Roti / Salad / Papad","snacks":"Tea / Maggi / Tomato Sauce","dinner":"Hari Moong Dal / Veg Manchurian / Fried Rice / Roti / Chutney","dessert":"Sewiyan"},"6":{"breakfast":"Onion Paneer Paratha / Butter / Curd / Pickle / Tea","lunch":"Moongi Masri Dal / Aloo Mushroom Mutter / Curd / Rice / Roti / Salad / Pickle / Chutney","snacks":"Tea / Patties","dinner":"Black Chana / Jeera Aloo / Rice / Roti / Salad / Chutney","dessert":"Kulfi"},"0":{"breakfast":"Channa Bhatura / Pickle / Tea","lunch":"Dal Makhani / Veg Noodles / Curd / Rice / Roti / Salad","snacks":"Coffee / Biscuit / Chips","dinner":"Moth Dal / Mutter Paneer~Egg Curry / Roti / Salad / Chutney","dessert":"Brownie"}}'::jsonb,
  TRUE
)
ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2. USER NOTIFICATION SETTINGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notification_settings_user ON public.user_notification_settings(user_id);

ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notification settings" ON public.user_notification_settings;
CREATE POLICY "Users read own notification settings"
  ON public.user_notification_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users manage own notification settings" ON public.user_notification_settings;
CREATE POLICY "Users manage own notification settings"
  ON public.user_notification_settings FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());


-- ----------------------------------------------------------------------------
-- 3. TIMETABLE SLOTS (Canonical term_id Authority & Conflict Resolution)
-- ----------------------------------------------------------------------------
ALTER TABLE public.timetable_slots
  ADD COLUMN IF NOT EXISTS program VARCHAR(64) DEFAULT 'MCA',
  ADD COLUMN IF NOT EXISTS semester INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS section VARCHAR(32) DEFAULT '1A',
  ADD COLUMN IF NOT EXISTS term_id VARCHAR(64) DEFAULT 'term-sem-1-2026',
  ADD COLUMN IF NOT EXISTS active_term_id VARCHAR(64) DEFAULT 'term-sem-1-2026';

-- Backfill existing rows deterministically: term_id takes canonical priority
UPDATE public.timetable_slots
SET term_id = COALESCE(term_id, active_term_id, 'term-sem-1-2026'),
    active_term_id = COALESCE(term_id, active_term_id, 'term-sem-1-2026'),
    program = COALESCE(program, 'MCA'),
    semester = COALESCE(semester, 1),
    section = COALESCE(section, '1A')
WHERE term_id IS NULL 
   OR active_term_id IS NULL 
   OR term_id <> active_term_id
   OR program IS NULL 
   OR semester IS NULL 
   OR section IS NULL;

-- Trigger ensuring term_id remains canonical and active_term_id is kept in sync.
-- If conflicting non-null values are supplied on INSERT/UPDATE, term_id deterministically overrides active_term_id.
CREATE OR REPLACE FUNCTION public.sync_timetable_slots_term_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Canonical field is term_id
  IF NEW.term_id IS NOT NULL THEN
    NEW.active_term_id := NEW.term_id;
  ELSIF NEW.active_term_id IS NOT NULL THEN
    NEW.term_id := NEW.active_term_id;
  ELSE
    NEW.term_id := 'term-sem-1-2026';
    NEW.active_term_id := 'term-sem-1-2026';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_sync_timetable_slots_term_id ON public.timetable_slots;
CREATE TRIGGER trg_sync_timetable_slots_term_id
  BEFORE INSERT OR UPDATE ON public.timetable_slots
  FOR EACH ROW EXECUTE FUNCTION public.sync_timetable_slots_term_id();


-- ----------------------------------------------------------------------------
-- 4. ATTENDANCE DEDUPLICATION & UNIQUE CONSTRAINT
-- ----------------------------------------------------------------------------
-- Dedicated archive table for superseded duplicates without unique constraints or blocking FKs
CREATE TABLE IF NOT EXISTS public.attendance_duplicates_archive (
  archive_id BIGSERIAL PRIMARY KEY,
  original_id VARCHAR(128) NOT NULL,
  user_id UUID,
  occurrence_key VARCHAR(128) NOT NULL,
  course_code VARCHAR(32) NOT NULL,
  date_str DATE NOT NULL,
  start_time INT NOT NULL,
  status VARCHAR(16) NOT NULL,
  source VARCHAR(32),
  updated_at TIMESTAMPTZ,
  is_synced BOOLEAN,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  reconciliation_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_att_archive_user_occ 
  ON public.attendance_duplicates_archive(user_id, occurrence_key);

CREATE INDEX IF NOT EXISTS idx_att_archive_original_id 
  ON public.attendance_duplicates_archive(original_id);

DO $$
DECLARE
  v_dup_count INT := 0;
  v_superseded_count INT := 0;
  v_archived_count INT := 0;
BEGIN
  -- Check if duplicate (user_id, occurrence_key) groups exist
  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT user_id, occurrence_key
    FROM public.attendance_records
    WHERE occurrence_key IS NOT NULL AND user_id IS NOT NULL
    GROUP BY user_id, occurrence_key
    HAVING COUNT(*) > 1
  ) dups;

  IF v_dup_count > 0 THEN
    RAISE NOTICE 'Found % duplicate (user_id, occurrence_key) groups in attendance_records. Archiving and reconciling.', v_dup_count;

    -- Create temporary table holding superseded duplicate IDs and ranked records
    CREATE TEMPORARY TABLE temp_superseded_attendance ON COMMIT DROP AS
    WITH ranked_records AS (
      SELECT 
        id,
        user_id,
        occurrence_key,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, occurrence_key 
          ORDER BY 
            CASE COALESCE(source, '') 
              WHEN 'manual' THEN 4 
              WHEN 'csv_import' THEN 3 
              WHEN 'auto' THEN 2 
              ELSE 1 
            END DESC,
            updated_at DESC NULLS LAST,
            id DESC
        ) as rank
      FROM public.attendance_records
      WHERE occurrence_key IS NOT NULL AND user_id IS NOT NULL
    )
    SELECT id FROM ranked_records WHERE rank > 1;

    SELECT COUNT(*) INTO v_superseded_count FROM temp_superseded_attendance;

    -- 1. Archive complete payload of all superseded records
    WITH archived_rows AS (
      INSERT INTO public.attendance_duplicates_archive (
        original_id, user_id, occurrence_key, course_code, date_str, start_time, status, source, updated_at, is_synced, reconciliation_reason
      )
      SELECT 
        a.id, a.user_id, a.occurrence_key, a.course_code, a.date_str, a.start_time, a.status, a.source, a.updated_at, a.is_synced,
        'Superseded duplicate: preserved higher-priority source or newer updated_at record'
      FROM public.attendance_records a
      JOIN temp_superseded_attendance s ON a.id = s.id
      RETURNING archive_id
    )
    SELECT COUNT(*) INTO v_archived_count FROM archived_rows;

    -- Safety verification: ensure 100% of superseded records are archived before any deletion
    IF v_archived_count <> v_superseded_count THEN
      RAISE EXCEPTION 'Attendance reconciliation aborted: expected to archive % records, but archived %. Aborting transaction; zero records deleted.',
        v_superseded_count, v_archived_count;
    END IF;

    -- 2. Remove superseded duplicate records, retaining the top-ranked authoritative record
    DELETE FROM public.attendance_records
    WHERE id IN (SELECT id FROM temp_superseded_attendance);

    RAISE NOTICE 'Attendance deduplication complete: % superseded records safely archived and removed.', v_archived_count;
  ELSE
    RAISE NOTICE 'No duplicate attendance records found.';
  END IF;

  -- Add unique constraint only after clean reconciliation
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_user_occurrence_key'
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_user_occurrence_key UNIQUE (user_id, occurrence_key);
    RAISE NOTICE 'Added unique constraint attendance_records_user_occurrence_key.';
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 5. DEVICE SECURITY: DETERMINISTIC SERVER-SIDE MAX 3 ACTIVE SESSIONS
-- ----------------------------------------------------------------------------
-- Business Invariants:
--   - Active Session: Belongs to user_id AND COALESCE(last_active, created_at, NOW()) >= (NOW() - INTERVAL '30 days')
--   - Expired sessions (< 30 days inactive) are cleaned up first.
--   - Parent user row lock (user_profiles FOR UPDATE) serializes concurrent logins without hash collisions.
--   - Count query explicitly tests COALESCE(last_active, created_at, NOW()) >= (NOW() - INTERVAL '30 days').
--   - If active count >= 3, server REJECTS insert with check_violation:
--     active devices are NEVER silently evicted; the user must explicitly revoke an existing device first.

CREATE OR REPLACE FUNCTION public.enforce_device_session_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_active_count INT;
BEGIN
  -- Row-level exclusive lock on the parent user profile to serialize concurrent logins without hash collisions
  PERFORM 1 FROM public.user_profiles WHERE id = NEW.user_id FOR UPDATE;

  -- 1. Purge expired sessions (> 30 days inactive) for this user
  DELETE FROM public.device_sessions
  WHERE user_id = NEW.user_id
    AND id <> NEW.id
    AND COALESCE(last_active, created_at, NOW()) < (NOW() - INTERVAL '30 days');

  -- 2. Explicitly count ONLY ACTIVE sessions for this user (excluding the new row if an update)
  SELECT COUNT(*) INTO v_active_count
  FROM public.device_sessions
  WHERE user_id = NEW.user_id 
    AND id <> NEW.id
    AND COALESCE(last_active, created_at, NOW()) >= (NOW() - INTERVAL '30 days');

  -- 3. Enforce maximum 3 active sessions: reject 4th session insert
  -- Product rule: User must explicitly revoke an existing session from client UI before adding a new one.
  IF v_active_count >= 3 THEN
    RAISE EXCEPTION 'Device limit reached: user % already has 3 active sessions. Please revoke an existing session first.', NEW.user_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.enforce_device_session_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_enforce_device_session_limit ON public.device_sessions;
CREATE TRIGGER trg_enforce_device_session_limit
  BEFORE INSERT ON public.device_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_device_session_limit();


-- ----------------------------------------------------------------------------
-- 6. ROLE PROTECTION (Hardened Trigger + RLS)
-- ----------------------------------------------------------------------------
-- Re-declare is_admin() with hardened search_path to prevent privilege escalation
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Re-declare handle_new_auth_user() with hardened search_path
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  gr_val VARCHAR(64);
  name_val VARCHAR(255);
  role_val VARCHAR(32);
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.protect_user_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Unauthenticated updates blocked
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Unauthenticated users cannot modify profiles.';
  END IF;

  -- Non-admins may only update their own profile
  IF NOT public.is_admin() AND OLD.id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You may only modify your own profile.';
  END IF;

  -- Check if role is being modified by a non-admin
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Unauthorized: Only system administrators can modify user roles.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.protect_user_role_escalation() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_protect_user_role ON public.user_profiles;
CREATE TRIGGER trg_protect_user_role
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_role_escalation();

-- Tighten user_profiles update policy
DROP POLICY IF EXISTS "Users update own profile or admin update" ON public.user_profiles;
CREATE POLICY "Users update own profile or admin update"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    public.is_admin() OR (
      auth.uid() = id
      AND role = (SELECT p.role FROM public.user_profiles p WHERE p.id = auth.uid())
    )
  );


-- ----------------------------------------------------------------------------
-- 7. AUDIT LOG INTEGRITY & SECURITY
-- ----------------------------------------------------------------------------
-- Restrict direct insert on audit_logs to administrators, strictly verifying actor_gr
DROP POLICY IF EXISTS "Admins insert audit logs" ON public.audit_logs;
CREATE POLICY "Admins insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin() 
    AND actor_gr = (SELECT p.gr_number FROM public.user_profiles p WHERE p.id = auth.uid())
  );

-- Server-authoritative RPC function for recording administrative audit logs
CREATE OR REPLACE FUNCTION public.record_audit_log(
  p_entity TEXT,
  p_entity_id TEXT,
  p_change_type TEXT,
  p_previous_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL,
  p_scope TEXT DEFAULT 'master',
  p_effective_date VARCHAR(64) DEFAULT NULL
)
RETURNS VARCHAR(64) AS $$
DECLARE
  v_actor_gr VARCHAR(64);
  v_new_id VARCHAR(64);
BEGIN
  -- Strict administrative authorization check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only system administrators can record audit logs.';
  END IF;

  -- Derive actor GR server-side from session auth.uid()
  SELECT gr_number INTO v_actor_gr
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF v_actor_gr IS NULL THEN
    RAISE EXCEPTION 'User profile not found for authenticated administrator.';
  END IF;

  v_new_id := 'audit-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.audit_logs (
    id,
    actor_gr,
    timestamp,
    entity,
    entity_id,
    change_type,
    previous_value,
    new_value,
    scope,
    effective_date
  ) VALUES (
    v_new_id,
    v_actor_gr,
    NOW(),
    p_entity,
    p_entity_id,
    p_change_type,
    p_previous_value,
    p_new_value,
    COALESCE(p_scope, 'master'),
    COALESCE(p_effective_date, CURRENT_DATE::text)
  );

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.record_audit_log(TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_audit_log(TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, VARCHAR) TO authenticated;
