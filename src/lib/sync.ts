import { useSyncExternalStore } from 'react';
import { applyRemote, getState, setLocalChangeHandler, type Change, type Settings } from './store';
import { supabase } from './supabase';
import type { InventoryItem } from './types';

/**
 * Cloud sync for one signed-in person across their devices.
 *
 * The local store stays the source of truth on each device (instant, works offline).
 * Local edits are queued and uploaded shortly after; changes from other devices are
 * pulled when the app opens, regains focus, comes back online, and every 30 seconds
 * while it's visible. The server stamps updated_at, so pulls use the server's clock.
 * A local edit that hasn't uploaded yet always wins over a pulled copy of the same item.
 */

const META_KEY = 'leftovers:sync:v1';
const PUSH_DELAY_MS = 800;
const POLL_MS = 30_000;
const PAGE = 500;

interface Meta {
  userId: string | null; // whose data this device last synced
  lastPulled: string | null; // newest server updated_at seen for items
  settingsPulled: string | null; // server updated_at of the settings we have
  dirty: string[]; // item ids changed locally, not yet uploaded
  removed: string[]; // item ids deleted locally, not yet uploaded
  settingsKeys: string[]; // settings changed locally, not yet uploaded (merged per key)
}

const EMPTY_META: Meta = { userId: null, lastPulled: null, settingsPulled: null, dirty: [], removed: [], settingsKeys: [] };

function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return { ...EMPTY_META, ...(JSON.parse(raw) as Partial<Meta>) };
  } catch {
    // Unreadable — start clean; the next sync re-uploads what's needed.
  }
  return { ...EMPTY_META };
}

let meta: Meta = loadMeta();
function saveMeta() {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Blocked storage: sync still works for this session.
  }
}

// ── status, for the small indicator in Profile
export type SyncStatus = 'off' | 'syncing' | 'synced' | 'offline' | 'error';
let status: SyncStatus = 'off';
const statusListeners = new Set<() => void>();
function setStatus(next: SyncStatus) {
  if (next === status) return;
  status = next;
  statusListeners.forEach((l) => l());
}
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => (statusListeners.add(l), () => statusListeners.delete(l)),
    () => status,
  );
}

// ── queueing local edits
function markChanged(change: Change) {
  const dirty = new Set(meta.dirty);
  const removed = new Set(meta.removed);
  for (const id of change.items ?? []) {
    dirty.add(id);
    removed.delete(id);
  }
  for (const id of change.removed ?? []) {
    removed.add(id);
    dirty.delete(id);
  }
  meta = { ...meta, dirty: [...dirty], removed: [...removed], settingsKeys: [...new Set([...meta.settingsKeys, ...(change.settings ?? [])])] };
  saveMeta();
  schedulePush();
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void cycle(), PUSH_DELAY_MS);
}

// ── upload
async function push() {
  const db = supabase!;
  const { dirty, removed, settingsKeys } = meta;
  if (!dirty.length && !removed.length && !settingsKeys.length) return;
  const items = new Map(getState().items.map((i) => [i.id, i]));

  const rows = [
    ...dirty.filter((id) => items.has(id)).map((id) => ({ id, data: items.get(id)!, deleted: false })),
    ...removed.map((id) => ({ id, data: {}, deleted: true })),
  ];
  if (rows.length) {
    const { error } = await db.from('items').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }
  if (settingsKeys.length) {
    // Merge per setting: start from the cloud's copy and overwrite only what changed here,
    // so two devices changing different settings don't undo each other.
    const { data: row, error: readError } = await db.from('settings').select('data').maybeSingle();
    if (readError) throw readError;
    const merged = { ...(row?.data as Settings | undefined), ...pick(getState().settings, settingsKeys) } as Settings;
    const { error } = await db.from('settings').upsert({ user_id: meta.userId, data: merged }, { onConflict: 'user_id' });
    if (error) throw error;
  }
  // Only clear what we sent; edits made while uploading stay queued.
  const sentItems = new Set(dirty);
  const sentRemoved = new Set(removed);
  const sentKeys = new Set(settingsKeys);
  meta = {
    ...meta,
    dirty: meta.dirty.filter((id) => !sentItems.has(id)),
    removed: meta.removed.filter((id) => !sentRemoved.has(id)),
    settingsKeys: meta.settingsKeys.filter((k) => !sentKeys.has(k)),
  };
  saveMeta();
}

// ── download
async function pull() {
  const db = supabase!;
  let since = meta.lastPulled;
  const changed: { id: string; data: InventoryItem; deleted: boolean }[] = [];
  for (;;) {
    let q = db.from('items').select('id, data, deleted, updated_at').order('updated_at', { ascending: true }).limit(PAGE);
    if (since) q = q.gt('updated_at', since);
    const { data, error } = await q;
    if (error) throw error;
    if (!data.length) break;
    changed.push(...(data as typeof changed));
    since = data[data.length - 1].updated_at as string;
    if (data.length < PAGE) break;
  }

  const { data: settingsRow, error: settingsError } = await db.from('settings').select('data, updated_at').maybeSingle();
  if (settingsError) throw settingsError;

  const state = getState();
  let items = state.items;
  let settings = state.settings;
  let touched = false;

  if (changed.length) {
    const pending = new Set([...meta.dirty, ...meta.removed]);
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const row of changed) {
      if (pending.has(row.id)) continue; // our unsent edit wins
      if (row.deleted) byId.delete(row.id);
      else byId.set(row.id, row.data);
    }
    // Newest additions first, matching how the app orders new items.
    items = [...byId.values()].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    touched = true;
  }
  if (settingsRow && settingsRow.updated_at !== meta.settingsPulled) {
    // Take the cloud's settings, keeping any setting changed here that hasn't uploaded yet.
    settings = { ...(settingsRow.data as Settings), ...pick(settings, meta.settingsKeys) } as Settings;
    meta = { ...meta, settingsPulled: settingsRow.updated_at as string };
    touched = true;
  }
  if (touched) applyRemote({ items, settings });
  meta = { ...meta, lastPulled: since };
  saveMeta();
  return settingsRow;
}

// ── one round: upload pending edits, then fetch everyone else's
let running: Promise<void> | null = null;
let again = false;
async function cycle(): Promise<void> {
  if (!supabase || !started) return;
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    setStatus('syncing');
    try {
      do {
        again = false;
        await push();
        await pull();
      } while (again);
      setStatus(meta.dirty.length || meta.removed.length || meta.settingsKeys.length ? 'syncing' : 'synced');
    } catch (error) {
      console.warn('[sync]', error);
      setStatus(navigator.onLine ? 'error' : 'offline');
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Sync right away (also used by tests). */
export function syncNow(): Promise<void> {
  return cycle();
}

function pick(settings: Settings, keys: string[]): Partial<Settings> {
  const s = settings as unknown as Record<string, unknown>;
  return Object.fromEntries(keys.filter((k) => k in s).map((k) => [k, s[k]])) as Partial<Settings>;
}

// ── lifecycle
let started = false;
let poll: ReturnType<typeof setInterval> | null = null;
const onVisible = () => document.visibilityState === 'visible' && void cycle();
const onOnline = () => void cycle();

/**
 * Start syncing for this user. The first time a device signs in, its local food is
 * uploaded (so nothing is lost) and the cloud's settings win if they exist.
 */
export async function startSync(userId: string) {
  if (!supabase || started) return;
  started = true;
  if (meta.userId !== userId) {
    meta = { ...EMPTY_META, userId };
    // First sign-in here: fetch the cloud's settings before deciding whose to keep.
    const { data } = await supabase.from('settings').select('updated_at').maybeSingle();
    const local = getState();
    meta.dirty = local.items.map((i) => i.id);
    meta.settingsKeys = !data && local.settings.onboarded ? Object.keys(local.settings) : [];
    saveMeta();
  }
  setLocalChangeHandler(markChanged);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  poll = setInterval(() => document.visibilityState === 'visible' && void cycle(), POLL_MS);
  await cycle();
}

export function stopSync() {
  started = false;
  setLocalChangeHandler(null);
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('online', onOnline);
  if (poll) clearInterval(poll);
  if (pushTimer) clearTimeout(pushTimer);
  setStatus('off');
}
