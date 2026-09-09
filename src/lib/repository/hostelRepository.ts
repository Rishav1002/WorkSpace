import { HostelInfo } from '../../types';
import { offlineDB } from '../offline/db';
import { supabase, isSupabaseConfigured } from '../supabase';
import { OFFICIAL_HOSTELS } from '../../data/masterData';

export class HostelRepository {
  async getHostels(): Promise<HostelInfo[]> {
    const cached = await offlineDB.hostels.toArray();
    if (cached.length > 0) return cached;

    if (isSupabaseConfigured && supabase && navigator.onLine) {
      try {
        const { data: hostelRows, error: hError } = await supabase.from('hostels').select('*');
        const { data: wardenRows } = await supabase.from('hostel_wardens').select('*');

        if (!hError && hostelRows && hostelRows.length > 0) {
          const mapped: HostelInfo[] = hostelRows.map(h => {
            const wardens = (wardenRows || [])
              .filter(w => w.hostel_id === h.id)
              .map(w => ({
                id: w.id,
                name: w.name,
                roleOrFloor: w.role_or_floor,
                phone: w.phone,
                hostelId: w.hostel_id
              }));

            return {
              id: h.id,
              name: h.name,
              blocks: h.blocks || [],
              wardens,
              laundryDays: h.laundry_days || []
            };
          });

          await offlineDB.hostels.bulkPut(mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Network error fetching hostels from Supabase:', err);
      }
    }

    // Default to official hostels seed
    await offlineDB.hostels.bulkPut(OFFICIAL_HOSTELS);
    return OFFICIAL_HOSTELS;
  }
}

export const hostelRepository = new HostelRepository();
