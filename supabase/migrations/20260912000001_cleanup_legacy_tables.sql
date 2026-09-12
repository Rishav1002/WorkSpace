-- ============================================================
-- Migration: 20260912000001_cleanup_legacy_tables.sql
-- Description: Isolated, non-destructive cleanup migration for legacy & orphan tables.
-- Tables evaluated:
--   - profiles (superseded by user_profiles)
--   - timetable_entries (superseded by timetable_slots + timetable_overrides)
--   - tasks (superseded by task_items)
--   - mess_overrides (superseded by hostel mess system)
--   - legacy_mess_schedules_backup (backup from schema fix)
--
-- Safety Guarantees:
--   - This migration is intentionally separate from primary schema fixes.
--   - ZERO DATA LOSS: Checks row counts before taking action.
--   - Never uses CASCADE. Any table with rows is preserved as archive_legacy_*.
--   - Drops are strictly RESTRICT (will fail rather than dropping unknown dependents).
-- ============================================================

DO $$
DECLARE
  v_count INT;
  v_fk_count INT;
BEGIN
  -- 1. Archive or Clean legacy 'profiles' (Supabase default starter table)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    EXECUTE 'SELECT COUNT(*) FROM public.profiles' INTO v_count;
    IF v_count > 0 THEN
      RAISE NOTICE 'Archiving % rows from legacy public.profiles to public.archive_legacy_profiles', v_count;
      CREATE TABLE IF NOT EXISTS public.archive_legacy_profiles AS TABLE public.profiles;
    END IF;
    -- Verify no dependent foreign keys exist before removing empty or archived table
    SELECT COUNT(*) INTO v_fk_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'profiles' AND tc.table_name <> 'profiles';
    
    IF v_fk_count = 0 THEN
      DROP TABLE public.profiles RESTRICT;
    ELSE
      RAISE NOTICE 'Skipping DROP on public.profiles: % active foreign key references exist.', v_fk_count;
    END IF;
  END IF;

  -- 2. Clean legacy 'timetable_entries' (Old schema with day_of_week / faculty_name)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timetable_entries') THEN
    EXECUTE 'SELECT COUNT(*) FROM public.timetable_entries' INTO v_count;
    IF v_count > 0 THEN
      RAISE NOTICE 'Archiving % rows from legacy public.timetable_entries to public.archive_legacy_timetable_entries', v_count;
      CREATE TABLE IF NOT EXISTS public.archive_legacy_timetable_entries AS TABLE public.timetable_entries;
    END IF;
    DROP TABLE public.timetable_entries RESTRICT;
  END IF;

  -- 3. Clean legacy 'tasks' (Old table with task_status enum, replaced by task_items)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
    EXECUTE 'SELECT COUNT(*) FROM public.tasks' INTO v_count;
    IF v_count > 0 THEN
      RAISE NOTICE 'Archiving % rows from legacy public.tasks to public.archive_legacy_tasks', v_count;
      CREATE TABLE IF NOT EXISTS public.archive_legacy_tasks AS TABLE public.tasks;
    END IF;
    DROP TABLE public.tasks RESTRICT;
  END IF;

  -- 4. Clean legacy 'mess_overrides' (Old meal cancellation table)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mess_overrides') THEN
    EXECUTE 'SELECT COUNT(*) FROM public.mess_overrides' INTO v_count;
    IF v_count > 0 THEN
      RAISE NOTICE 'Archiving % rows from legacy public.mess_overrides to public.archive_legacy_mess_overrides', v_count;
      CREATE TABLE IF NOT EXISTS public.archive_legacy_mess_overrides AS TABLE public.mess_overrides;
    END IF;
    DROP TABLE public.mess_overrides RESTRICT;
  END IF;

  -- 5. Clean temporary 'legacy_mess_schedules_backup' only if empty
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'legacy_mess_schedules_backup') THEN
    EXECUTE 'SELECT COUNT(*) FROM public.legacy_mess_schedules_backup' INTO v_count;
    IF v_count = 0 THEN
      DROP TABLE public.legacy_mess_schedules_backup RESTRICT;
    ELSE
      RAISE NOTICE 'Retaining legacy_mess_schedules_backup as it contains % rows', v_count;
    END IF;
  END IF;
END $$;
