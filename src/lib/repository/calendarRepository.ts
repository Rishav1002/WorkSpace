import { CalendarEvent } from '../../types';
import { offlineDB } from '../offline/db';
import { supabase, isSupabaseConfigured } from '../supabase';
import { syncRepository } from './syncRepository';
import { OFFICIAL_ACADEMIC_CALENDAR } from '../../data/masterData';

export class CalendarRepository {
  async getEvents(userId?: string): Promise<CalendarEvent[]> {
    const cached = await offlineDB.calendarEvents.toArray();
    let events = cached;

    if (events.length === 0) {
      await offlineDB.calendarEvents.bulkPut(OFFICIAL_ACADEMIC_CALENDAR);
      events = OFFICIAL_ACADEMIC_CALENDAR;
    }

    if (isSupabaseConfigured && supabase && navigator.onLine) {
      try {
        let query = supabase.from('calendar_events').select('*');
        if (userId) {
          query = query.or(`is_official.eq.true,user_id.eq.${userId}`);
        } else {
          query = query.eq('is_official', true);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const serverEvents: CalendarEvent[] = data.map(r => ({
            id: r.id,
            title: r.title,
            dateStr: r.date_str,
            endDateStr: r.end_date_str,
            category: r.category,
            isOfficial: r.is_official,
            userId: r.user_id,
            examCategory: r.exam_category,
            courseCode: r.course_code,
            startTime: r.start_time,
            endTime: r.end_time,
            classImpact: r.class_impact,
            cancelledSlots: r.cancelled_slots,
            description: r.description
          }));
          await offlineDB.calendarEvents.bulkPut(serverEvents);
          return serverEvents;
        }
      } catch (err) {
        console.warn('Network error fetching calendar events from Supabase:', err);
      }
    }

    return events;
  }

  async addEvent(userId: string, eventData: Omit<CalendarEvent, 'id'>, isOfficial: boolean = false): Promise<CalendarEvent> {
    const newEvent: CalendarEvent = {
      ...eventData,
      id: `cal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: isOfficial ? undefined : userId,
      isOfficial
    };

    await offlineDB.calendarEvents.put(newEvent);

    await syncRepository.enqueueMutation({
      userId,
      entityType: 'calendar_event',
      entityId: newEvent.id,
      operation: 'CREATE',
      payload: newEvent
    });

    return newEvent;
  }

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    await offlineDB.calendarEvents.delete(eventId);

    await syncRepository.enqueueMutation({
      userId,
      entityType: 'calendar_event',
      entityId: eventId,
      operation: 'DELETE',
      payload: { id: eventId, userId }
    });
  }
}

export const calendarRepository = new CalendarRepository();
