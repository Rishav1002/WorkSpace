import { supabase } from "../lib/supabase";

export async function getCalendarEvents(startDate, endDate) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .gte("event_date", startDate)
    .lte("event_date", endDate)
    .order("event_date", { ascending: true });

  if (error) throw error;
  return data ?? [];
}