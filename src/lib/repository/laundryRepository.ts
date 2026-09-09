import { supabase, isSupabaseConfigured } from '../supabase';

export interface LaundrySlot {
  id: string;
  hostelId: string;
  dayOfWeek: number;
  timeSlot: string;
  description: string;
  effectiveFrom?: string;
}

export class LaundryRepository {
  async getLaundrySchedule(hostelId: string): Promise<LaundrySlot[]> {
    if (isSupabaseConfigured && supabase && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('laundry_schedules')
          .select('*')
          .eq('hostel_id', hostelId);

        if (!error && data && data.length > 0) {
          return data.map(r => ({
            id: r.id,
            hostelId: r.hostel_id,
            dayOfWeek: r.day_of_week,
            timeSlot: r.time_slot,
            description: r.description,
            effectiveFrom: r.effective_from
          }));
        }
      } catch (err) {
        console.warn('Failed to load laundry schedule from Supabase:', err);
      }
    }

    return [
      {
        id: 'laundry-tue',
        hostelId,
        dayOfWeek: 2,
        timeSlot: '08:00 AM - 12:00 PM',
        description: 'Tuesday Morning Drop-off'
      },
      {
        id: 'laundry-fri',
        hostelId,
        dayOfWeek: 5,
        timeSlot: '04:00 PM - 08:00 PM',
        description: 'Friday Evening Collection'
      }
    ];
  }
}

export const laundryRepository = new LaundryRepository();
