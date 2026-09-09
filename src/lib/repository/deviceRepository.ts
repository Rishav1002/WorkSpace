import { DeviceSession } from '../../types';
import { offlineDB } from '../offline/db';
import { supabase, isSupabaseConfigured } from '../supabase';

export class DeviceRepository {
  async getActiveDevices(userId: string): Promise<DeviceSession[]> {
    const cached = await offlineDB.deviceSessions.where('userId').equals(userId).toArray();

    if (isSupabaseConfigured && supabase && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('device_sessions')
          .select('*')
          .eq('user_id', userId);

        if (!error && data) {
          const mapped: DeviceSession[] = data.map(r => ({
            id: r.id,
            userId: r.user_id,
            deviceName: r.device_name,
            deviceType: r.device_type,
            lastActive: r.last_active,
            isCurrent: r.is_current
          }));
          await offlineDB.deviceSessions.bulkPut(mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Network error fetching device sessions from Supabase:', err);
      }
    }

    return cached;
  }

  async removeDevice(userId: string, deviceId: string): Promise<void> {
    await offlineDB.deviceSessions.delete(deviceId);

    if (isSupabaseConfigured && supabase && navigator.onLine) {
      await supabase.from('device_sessions').delete().eq('id', deviceId);
    }
  }

  async signOutOtherDevices(userId: string): Promise<void> {
    const current = await offlineDB.deviceSessions
      .where('userId')
      .equals(userId)
      .and(d => d.isCurrent)
      .first();

    await offlineDB.deviceSessions.where('userId').equals(userId).and(d => !d.isCurrent).delete();

    if (isSupabaseConfigured && supabase && navigator.onLine && current) {
      await supabase.from('device_sessions').delete().eq('user_id', userId).neq('id', current.id);
    }
  }
}

export const deviceRepository = new DeviceRepository();
