import { UserProfile } from '../../types';
import { offlineDB } from '../offline/db';
import { supabase, isSupabaseConfigured } from '../supabase';
import { syncRepository } from './syncRepository';

export class ProfileRepository {
  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const existing = await offlineDB.profiles.get(userId);
    if (!existing) return null;

    const updated: UserProfile = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await offlineDB.profiles.put(updated);

    await syncRepository.enqueueMutation({
      userId,
      entityType: 'profile',
      entityId: userId,
      operation: 'UPDATE',
      payload: updated
    });

    return updated;
  }

  async changeGrNumber(userId: string, newGr: string): Promise<{ success: boolean; error?: string }> {
    const cleanGr = newGr.trim();
    if (!cleanGr) return { success: false, error: 'GR number cannot be empty' };

    // Check if duplicate GR exists in Supabase
    if (isSupabaseConfigured && supabase && navigator.onLine) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('gr_number', cleanGr)
        .neq('id', userId)
        .maybeSingle();

      if (data) {
        return { success: false, error: `GR Number ${cleanGr} is already assigned to another student.` };
      }
    }

    const updated = await this.updateProfile(userId, { grNumber: cleanGr });
    if (!updated) return { success: false, error: 'Profile not found' };

    return { success: true };
  }

  async uploadAvatar(userId: string, file: File): Promise<string | null> {
    if (isSupabaseConfigured && supabase && navigator.onLine) {
      try {
        const fileExt = file.name.split('.').pop();
        const filePath = `${userId}/avatar-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file, { upsert: true });

        if (!uploadError) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
          if (data?.publicUrl) {
            await this.updateProfile(userId, { avatarUrl: data.publicUrl });
            return data.publicUrl;
          }
        }
      } catch (err) {
        console.warn('Storage upload error, using local object URL:', err);
      }
    }

    // Local object URL fallback
    const localUrl = URL.createObjectURL(file);
    await this.updateProfile(userId, { avatarUrl: localUrl });
    return localUrl;
  }

  async requestAccountDeletion(userId: string): Promise<void> {
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await this.updateProfile(userId, { scheduledDeletionAt: sevenDaysLater });
  }

  async cancelAccountDeletion(userId: string): Promise<void> {
    await this.updateProfile(userId, { scheduledDeletionAt: null });
  }

  async exportUserDataJSON(userId: string): Promise<string> {
    const profile = await offlineDB.profiles.get(userId);
    const attendance = await offlineDB.attendanceRecords.where('userId').equals(userId).toArray();
    const tasks = await offlineDB.taskItems.where('userId').equals(userId).toArray();
    const overrides = await offlineDB.timetableOverrides.where('userId').equals(userId).toArray();
    const events = await offlineDB.calendarEvents.where('userId').equals(userId).toArray();

    const exportPayload = {
      exportTimestamp: new Date().toISOString(),
      profile,
      attendance,
      tasks,
      overrides,
      events
    };

    return JSON.stringify(exportPayload, null, 2);
  }

  async exportUserDataCSV(userId: string): Promise<{ attendanceCSV: string; tasksCSV: string }> {
    const attendance = await offlineDB.attendanceRecords.where('userId').equals(userId).toArray();
    const tasks = await offlineDB.taskItems.where('userId').equals(userId).toArray();

    // Attendance CSV
    const attHeaders = ['Date', 'CourseCode', 'StartTime', 'Status', 'Source', 'UpdatedAt'];
    const attRows = attendance.map(a => [
      a.dateStr,
      a.courseCode,
      a.startTime,
      a.status,
      a.source,
      a.updatedAt
    ]);
    const attendanceCSV = [attHeaders.join(','), ...attRows.map(r => r.join(','))].join('\n');

    // Tasks CSV
    const taskHeaders = ['Title', 'CourseCode', 'DueDate', 'Priority', 'Status', 'CompletedAt'];
    const taskRows = tasks.map(t => [
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.courseCode,
      t.dueDate,
      t.priority,
      t.status,
      t.completedAt || ''
    ]);
    const tasksCSV = [taskHeaders.join(','), ...taskRows.map(r => r.join(','))].join('\n');

    return { attendanceCSV, tasksCSV };
  }
}

export const profileRepository = new ProfileRepository();
