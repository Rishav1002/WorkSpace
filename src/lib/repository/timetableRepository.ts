import { TimetableSlot, TimetableOverride, AcademicScope } from '../../types';
import { offlineDB } from '../offline/db';
import { supabase, isSupabaseConfigured } from '../supabase';
import { syncRepository } from './syncRepository';
import { OFFICIAL_TIMETABLE_SLOTS } from '../../data/masterData';

export class TimetableRepository {
  /**
   * Strictly scopes timetable queries by:
   * - academic group (e.g. 'MCA DS 1A' vs 'MCA General 1A')
   * - program
   * - semester
   * - section
   * - active academic term
   * - effective date
   * Never returns all cached rows or allows cross-group leakage.
   */
  async getOfficialSlots(
    scopeInput: AcademicScope | string = 'MCA DS 1A',
    termId?: string,
    targetDate?: string
  ): Promise<TimetableSlot[]> {
    const scope: AcademicScope =
      typeof scopeInput === 'string'
        ? { group: scopeInput, activeTermId: termId, effectiveDate: targetDate }
        : { ...scopeInput, activeTermId: termId || scopeInput.activeTermId, effectiveDate: targetDate || scopeInput.effectiveDate };

    const targetGroup = scope.group || 'MCA DS 1A';

    // 1. Check IndexedDB strictly filtered by target group & academic parameters
    const cached = await offlineDB.timetableSlots
      .where('group')
      .equals(targetGroup)
      .toArray();

    // Strict filter: Exclude Mon(1) and Tue(2), and verify all scope parameters
    const validCached = cached.filter(s => {
      // Academic weekend rule: Monday and Tuesday have no regular classes
      if (s.day === 1 || s.day === 2) return false;
      // Group isolation: must strictly match targetGroup
      if (s.group && s.group !== targetGroup) return false;
      // Program isolation
      if (scope.program && s.program && s.program !== scope.program) return false;
      // Semester isolation
      if (scope.semester && s.semester && s.semester !== scope.semester) return false;
      // Section isolation
      if (scope.section && s.section && s.section !== scope.section) return false;
      // Term isolation
      if (scope.activeTermId && s.termId && s.termId !== scope.activeTermId) return false;
      // Effective date bounds
      if (scope.effectiveDate) {
        if (s.effectiveFrom && s.effectiveFrom > scope.effectiveDate) return false;
        if (s.effectiveUntil && s.effectiveUntil < scope.effectiveDate) return false;
      }
      return true;
    });

    if (validCached.length > 0) {
      return validCached;
    }

    // 2. If online and Supabase configured, load official slots strictly for this group & scope
    if (isSupabaseConfigured && supabase && navigator.onLine) {
      try {
        let query = supabase
          .from('timetable_slots')
          .select('*')
          .eq('group', targetGroup)
          .eq('is_official', true)
          .not('day', 'in', '(1,2)');

        if (scope.program) query = query.eq('program', scope.program);
        if (scope.semester) query = query.eq('semester', scope.semester);
        if (scope.section) query = query.eq('section', scope.section);
        if (scope.activeTermId) query = query.eq('term_id', scope.activeTermId);

        const { data, error } = await query;

        if (!error && data && data.length > 0) {
          const slots: TimetableSlot[] = data.map(r => ({
            id: r.id,
            day: r.day,
            startTime: r.start_time,
            endTime: r.end_time,
            courseCode: r.course_code,
            room: r.room,
            teacher: r.teacher,
            name: r.name,
            isOfficial: r.is_official,
            group: r.group,
            program: r.program || 'MCA',
            semester: r.semester || 1,
            section: r.section || '1A',
            termId: r.term_id || r.active_term_id || 'term-sem-1-2026',
            effectiveFrom: r.effective_from,
            effectiveUntil: r.effective_until
          }));
          await offlineDB.timetableSlots.bulkPut(slots);
          return slots;
        }
      } catch (err) {
        console.warn('Failed to fetch group-scoped timetable slots from Supabase:', err);
      }
    }

    // 3. Fallback to master data seeds strictly filtered by target group and scope (Wed-Sun only)
    const masterSlotsForGroup = OFFICIAL_TIMETABLE_SLOTS.filter(s => {
      // Must match group exactly
      if (s.group !== targetGroup) return false;
      // Academic weekend check
      if (s.day === 1 || s.day === 2) return false;
      if (scope.program && s.program && s.program !== scope.program) return false;
      if (scope.semester && s.semester && s.semester !== scope.semester) return false;
      if (scope.section && s.section && s.section !== scope.section) return false;
      if (scope.activeTermId && s.termId && s.termId !== scope.activeTermId) return false;
      return true;
    });

    // Populate IndexedDB with master data seeds for this group only
    if (masterSlotsForGroup.length > 0) {
      await offlineDB.timetableSlots.bulkPut(masterSlotsForGroup);
    }
    return masterSlotsForGroup;
  }

  async getOverrides(userId: string): Promise<TimetableOverride[]> {
    // 1. IndexedDB
    const cached = await offlineDB.timetableOverrides.where('userId').equals(userId).toArray();

    // 2. Fetch from Supabase if online
    if (isSupabaseConfigured && supabase && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('timetable_overrides')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true);

        if (!error && data) {
          const serverOverrides: TimetableOverride[] = data.map(r => ({
            id: r.id,
            userId: r.user_id,
            originalSlotId: r.original_slot_id,
            dateStr: r.date_str,
            effectiveFrom: r.effective_from,
            scope: r.scope,
            overrideType: r.override_type,
            courseCode: r.course_code,
            day: r.day,
            startTime: r.start_time,
            endTime: r.end_time,
            room: r.room,
            teacher: r.teacher,
            isActive: r.is_active
          }));
          await offlineDB.timetableOverrides.bulkPut(serverOverrides);
          return serverOverrides;
        }
      } catch (err) {
        console.warn('Failed to fetch overrides from Supabase:', err);
      }
    }

    return cached;
  }

  async saveOverride(
    userId: string,
    override: Omit<TimetableOverride, 'id' | 'userId'>
  ): Promise<TimetableOverride> {
    const newOverride: TimetableOverride = {
      ...override,
      id: `ovr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId,
      isActive: true
    };

    // Save locally
    await offlineDB.timetableOverrides.put(newOverride);

    // Queue sync
    await syncRepository.enqueueMutation({
      userId,
      entityType: 'timetable_override',
      entityId: newOverride.id,
      operation: 'CREATE',
      payload: newOverride
    });

    return newOverride;
  }

  async deleteOverride(userId: string, overrideId: string): Promise<void> {
    await offlineDB.timetableOverrides.delete(overrideId);

    await syncRepository.enqueueMutation({
      userId,
      entityType: 'timetable_override',
      entityId: overrideId,
      operation: 'DELETE',
      payload: { id: overrideId, userId }
    });
  }

  async restoreOfficialRoutine(userId: string, originalSlotId: string): Promise<void> {
    const existing = await offlineDB.timetableOverrides
      .where('userId')
      .equals(userId)
      .and(o => o.originalSlotId === originalSlotId)
      .toArray();

    for (const ovr of existing) {
      await this.deleteOverride(userId, ovr.id);
    }
  }
}

export const timetableRepository = new TimetableRepository();
