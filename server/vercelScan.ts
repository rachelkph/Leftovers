import type { IncomingMessage } from 'node:http';
import { scanHandler } from './handler.ts';
import { ScanError } from './scan.ts';

/**
 * Hosted POST /api/scan (bundled into a Vercel function by scripts/build-vercel.mjs).
 * Every scan spends API credit, so it only runs for a signed-in session: the bearer token
 * is checked with Supabase Auth. If the site isn't configured for sign-in, it refuses
 * rather than run open. ALLOWED_EMAILS (comma-separated) optionally narrows it further.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const ALLOWED = (process.env.ALLOWED_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

async function authorize(req: IncomingMessage) {
  if (!SUPABASE_URL || !ANON_KEY) throw new ScanError('Scanning isn’t set up on this site yet.', 503);
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new ScanError('Sign in to scan.', 401);

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new ScanError('Your sign-in has expired. Sign in again to scan.', 401);
  const user = (await res.json()) as { email?: string };
  if (ALLOWED.length && !ALLOWED.includes((user.email ?? '').toLowerCase())) {
    throw new ScanError('This account can’t scan here.', 403);
  }
}

export default scanHandler({ authorize });
