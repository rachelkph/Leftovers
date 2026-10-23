import type { Session } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { startSync, stopSync } from './sync';

/**
 * The signed-in session, shared app-wide. Signing in starts cloud sync; signing out stops it
 * (food already on this device stays). `ready` turns true once the first sync after
 * sign-in has finished, so a fresh device shows your fridge rather than onboarding.
 */
interface AuthState {
  session: Session | null | undefined; // undefined while we're still checking
  ready: boolean;
}

let auth: AuthState = { session: supabase ? undefined : null, ready: !supabase };
const listeners = new Set<() => void>();
function set(next: Partial<AuthState>) {
  auth = { ...auth, ...next };
  listeners.forEach((l) => l());
}

if (supabase) {
  let syncingFor: string | null = null;
  supabase.auth.onAuthStateChange((_event, session) => {
    const userId = session?.user.id ?? null;
    set({ session });
    if (userId && userId !== syncingFor) {
      syncingFor = userId;
      set({ ready: false });
      // Defer: Supabase recommends not awaiting its own calls inside this callback.
      setTimeout(() => void startSync(userId).finally(() => set({ ready: true })), 0);
    } else if (!userId && syncingFor) {
      syncingFor = null;
      stopSync();
    }
  });
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => auth,
  );
}

/**
 * Email a one-time sign-in code. Codes rather than links: the Supabase project can be shared
 * with another app whose email template links to that app's site, and a code typed here works
 * in any browser on any device. Never creates an account: only existing users can sign in.
 */
export async function sendSignInCode(email: string) {
  const { error } = await supabase!.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) throw error;
}

export async function verifySignInCode(email: string, code: string) {
  const { error } = await supabase!.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw error;
}

export async function signOut() {
  stopSync();
  await supabase?.auth.signOut();
}

/** The current access token, for calls to our own API (scanning). */
export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
