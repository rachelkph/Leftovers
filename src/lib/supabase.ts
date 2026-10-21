import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cloud sync is on when the Supabase project URL and public (anon) key are set
 * (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, in .env.local or the host's settings).
 * Without them the app runs local-only, exactly as before.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

export const cloudEnabled = supabase !== null;
