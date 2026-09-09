import { NotificationItem, NotificationSettings } from '../../types';
import { offlineDB } from '../offline/db';
import { DEFAULT_NOTIF_SETTINGS } from '../storage';
import { syncRepository } from './syncRepository';
import { supabase, isSupabaseConfigured } from '../supabase';

export class NotificationRepository {
  async getNotifications(userId?: string): Promise<NotificationItem[]> {
    const all = await offlineDB.notifications.reverse().sortBy('timestamp');
    if (!userId) return all;
    return all.filter(n => !n.userId || n.userId === userId);
  }

  async addNotification(notif: Omit<NotificationItem, 'id' | 'timestamp'>): Promise<NotificationItem> {
    const item: NotificationItem = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now()
    };
    await offlineDB.notifications.put(item);
    return item;
  }

  async clearNotifications(userId?: string): Promise<void> {
    if (userId) {
      const items = await offlineDB.notifications.toArray();
      const idsToDelete = items.filter(n => !n.userId || n.userId === userId).map(n => n.id);
      await offlineDB.notifications.bulkDelete(idsToDelete);
    } else {
      await offlineDB.notifications.clear();
    }
  }

  async getSettings(userId?: string): Promise<NotificationSettings> {
    if (!userId) return DEFAULT_NOTIF_SETTINGS;
    try {
      const record = await offlineDB.userNotificationSettings.get(userId);
      if (record?.settings) {
        return record.settings;
      }
      // If remote Supabase is configured and online, check remote
      if (isSupabaseConfigured && supabase && navigator.onLine) {
        const { data } = await supabase
          .from('user_notification_settings')
          .select('settings')
          .eq('user_id', userId)
          .maybeSingle();

        if (data?.settings) {
          await offlineDB.userNotificationSettings.put({
            userId,
            settings: data.settings,
            updatedAt: new Date().toISOString()
          });
          return data.settings;
        }
      }
      return DEFAULT_NOTIF_SETTINGS;
    } catch {
      return DEFAULT_NOTIF_SETTINGS;
    }
  }

  async saveSettings(userId: string, settings: NotificationSettings): Promise<void> {
    if (!userId) return;
    const now = new Date().toISOString();
    await offlineDB.userNotificationSettings.put({
      userId,
      settings,
      updatedAt: now
    });

    await syncRepository.enqueueMutation({
      userId,
      entityType: 'notification_settings',
      entityId: `notif-settings-${userId}`,
      operation: 'UPDATE',
      payload: settings,
      deviceId: 'current-device'
    });
  }
}

export const notificationRepository = new NotificationRepository();
