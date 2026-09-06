import { supabase } from "../lib/supabase";

export async function getCourses() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data ?? [];
}