import { MessSchedule } from '../../types';
import { OFFICIAL_MESS_SCHEDULE } from '../../data/masterData';
import { supabase, isSupabaseConfigured } from '../supabase';

export class MessRepository {
  async getMessSchedule(hostelId?: string): Promise<MessSchedule> {
    if (isSupabaseConfigured && supabase && navigator.onLine) {
      try {
        let query = supabase.from('mess_schedules').select('*');
        if (hostelId) query = query.eq('hostel_id', hostelId);
        const { data, error } = await query.order('effective_from', { ascending: false }).limit(1);

        if (!error && data && data.length > 0) {
          const row = data[0];
          return {
            regular: row.regular_slots || OFFICIAL_MESS_SCHEDULE.regular,
            weekendAndHoliday: row.weekend_slots || OFFICIAL_MESS_SCHEDULE.weekendAndHoliday,
            weeklyMenu: row.weekly_menu || OFFICIAL_MESS_SCHEDULE.weeklyMenu
          };
        }
      } catch (err) {
        console.warn('Failed to load mess schedule from Supabase:', err);
      }
    }
    return OFFICIAL_MESS_SCHEDULE;
  }
}

export const messRepository = new MessRepository();
