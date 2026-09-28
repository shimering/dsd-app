import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseUrl.includes('placeholder')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Storage key for offline/local case synchronization when Supabase is not plugged in
 */
const LOCAL_CASES_KEY = 'dsd_local_cases_v1';

export function getLocalCasesStorage(): any[] {
  try {
    const raw = localStorage.getItem(LOCAL_CASES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed reading local cases:', e);
    return [];
  }
}

export function saveLocalCasesStorage(cases: any[]): void {
  try {
    localStorage.setItem(LOCAL_CASES_KEY, JSON.stringify(cases));
  } catch (e) {
    console.error('Failed writing local cases:', e);
  }
}
