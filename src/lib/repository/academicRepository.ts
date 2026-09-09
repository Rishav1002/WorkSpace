import { SubjectCourse } from '../../types';
import { OFFICIAL_SUBJECTS } from '../../data/masterData';
import { supabase, isSupabaseConfigured } from '../supabase';

export class AcademicRepository {
  async getCourses(): Promise<Record<string, SubjectCourse>> {
    if (isSupabaseConfigured && supabase && navigator.onLine) {
      try {
        const { data, error } = await supabase.from('courses').select('*');
        if (!error && data && data.length > 0) {
          const map: Record<string, SubjectCourse> = {};
          for (const c of data) {
            map[c.code] = {
              code: c.code,
              title: c.title,
              teacher: c.teacher,
              tokenColor: c.token_color,
              icon: c.icon,
              type: c.type,
              credits: c.credits,
              room: c.room
            };
          }
          return map;
        }
      } catch (err) {
        console.warn('Failed to load courses from Supabase:', err);
      }
    }
    return OFFICIAL_SUBJECTS;
  }
}

export const academicRepository = new AcademicRepository();
