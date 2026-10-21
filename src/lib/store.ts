import { useSyncExternalStore } from 'react';
import { addDays, daysUntil, todayIso } from './dates';
import { DEFAULT_MAGNETS, MAGNETS, type PlacedMagnet } from './decor';
import type { Category, InventoryItem, ItemSource, Unit, Visibility } from './types';

/**
 * Local-first store, persisted to localStorage.
 * Everything goes through the actions below; when cloud sync is on (src/lib/sync.ts)
 * each change is also uploaded, and changes from other devices arrive via applyRemote.
 */

export interface Settings {
  onboarded: boolean;
  name: string;
  mode: 'solo' | 'shared';
  householdName: string;
  members: string[];
  paint: string;
  finish: 'gloss' | 'matte';
  magnets: PlacedMagnet[];
  fridgeView: 'fridge' | 'list';
}

export interface State {
  items: InventoryItem[];
  settings: Settings;
}

export interface NewItem {
  name: string;
  category: Category;
  quantity: number;
  unit: Unit;
  shelfLifeDays: number;
  imageUrl?: string | null;
  source: ItemSource;
  visibility?: Visibility;
}

const STORAGE_KEY = 'leftovers:v1';

const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  name: '',
  mode: 'solo',
  householdName: '',
  members: [],
  paint: 'teal',
  finish: 'gloss',
  magnets: DEFAULT_MAGNETS,
  fridgeView: 'fridge',
};

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      return {
        // Older versions stored library photo paths; those are now looked up live.
        items: Array.isArray(parsed.items)
          ? parsed.items.map((i) => (i.imageUrl?.startsWith('/food/') ? { ...i, imageUrl: null } : i))
          : [],
        settings: withKnownMagnets({ ...DEFAULT_SETTINGS, ...parsed.settings }),
      };
    }
  } catch {
    // Corrupt or unavailable storage — start fresh rather than crash.
  }
  return { items: [], settings: DEFAULT_SETTINGS };
}

/** Magnets retired from the catalog are removed rather than lingering invisibly. */
function withKnownMagnets(settings: Settings): Settings {
  const known = new Set(MAGNETS.map((m) => m.id));
  return { ...settings, magnets: settings.magnets.filter((m) => known.has(m.id)) };
}

let state: State = load();
const listeners = new Set<() => void>();

/** What a local edit touched, so cloud sync knows what to upload. */
export interface Change {
  items?: string[]; // added or edited item ids
  removed?: string[]; // deleted item ids
  settings?: string[]; // changed settings keys (merged per key across devices)
}
let onLocalChange: ((change: Change) => void) | null = null;

/** Cloud sync registers here to hear about local edits. */
export function setLocalChangeHandler(handler: ((change: Change) => void) | null) {
  onLocalChange = handler;
}

export function getState(): State {
  return state;
}

function save(next: State) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full (large photos) or blocked — keep working in memory.
  }
  listeners.forEach((l) => l());
}

function commit(next: State, change: Change) {
  save(next);
  onLocalChange?.(change);
}

/** Apply data that came from the cloud: saved locally, but not echoed back up. */
export function applyRemote(next: State) {
  save({ ...next, settings: withKnownMagnets({ ...DEFAULT_SETTINGS, ...next.settings }) });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

// Stable selectors (useSyncExternalStore needs referentially stable results).
export const selectItems = (s: State) => s.items;
export const selectSettings = (s: State) => s.settings;

export function activeItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter((i) => i.status === 'active');
}

export function eatSoon(items: InventoryItem[]): InventoryItem[] {
  return activeItems(items)
    .filter((i) => daysUntil(i.estimatedExpiration) <= 3)
    .sort((a, b) => a.estimatedExpiration.localeCompare(b.estimatedExpiration));
}

function newId() {
  return crypto.randomUUID();
}

export function buildItem(input: NewItem): InventoryItem {
  const added = todayIso();
  return {
    id: newId(),
    name: input.name.trim(),
    category: input.category,
    quantity: input.quantity,
    unit: input.unit,
    initialQuantity: input.quantity,
    // Only your own photos are stored; library photos are looked up when shown.
    imageUrl: input.imageUrl ?? null,
    addedAt: added,
    estimatedExpiration: addDays(added, Math.max(0, input.shelfLifeDays)),
    status: 'active',
    source: input.source,
    visibility: input.visibility ?? 'mine',
  };
}

export const actions = {
  addItems(inputs: NewItem[]): InventoryItem[] {
    const created = inputs.map(buildItem);
    commit({ ...state, items: [...created, ...state.items] }, { items: created.map((i) => i.id) });
    return created;
  },

  updateItem(id: string, patch: Partial<InventoryItem>) {
    commit({ ...state, items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }, { items: [id] });
  },

  setQuantity(id: string, quantity: number) {
    this.updateItem(id, { quantity });
  },

  /** Finished or tossed: the item leaves the active fridge but stays in history. */
  close(id: string, status: 'finished' | 'tossed') {
    this.updateItem(id, { status, finishedAt: new Date().toISOString() });
  },

  reopen(id: string) {
    this.updateItem(id, { status: 'active', finishedAt: undefined });
  },

  deleteItem(id: string) {
    commit({ ...state, items: state.items.filter((i) => i.id !== id) }, { removed: [id] });
  },

  updateSettings(patch: Partial<Settings>) {
    commit({ ...state, settings: { ...state.settings, ...patch } }, { settings: Object.keys(patch) });
  },

  removeSampleFood() {
    const removed = state.items.filter((i) => i.source === 'sample').map((i) => i.id);
    commit({ ...state, items: state.items.filter((i) => i.source !== 'sample') }, { removed });
  },

  resetEverything() {
    commit({ items: [], settings: DEFAULT_SETTINGS }, { removed: state.items.map((i) => i.id), settings: Object.keys(DEFAULT_SETTINGS) });
  },

  /** A believable starter fridge so a new person can look around. */
  loadSampleFridge() {
    const sample: Array<[string, Category, number, Unit, number]> = [
      ['Chicken breast', 'Protein', 2, 'count', 0],
      ['Strawberries', 'Produce', 12, 'count', 2],
      ['Spinach', 'Produce', 1, 'package', 3],
      ['Eggs', 'Dairy & eggs', 8, 'count', 21],
      ['Greek yogurt', 'Dairy & eggs', 1, 'package', 12],
      ['Butter', 'Dairy & eggs', 1, 'package', 60],
      ['Oat milk', 'Drinks', 40, 'percent', 9],
      ['Salmon', 'Protein', 1, 'package', 2],
      ['Tofu', 'Protein', 1, 'package', 7],
      ['Leftover pad thai', 'Leftovers', 1, 'package', 3],
      ['Avocado', 'Produce', 2, 'count', 4],
      ['Lemons', 'Produce', 3, 'count', 14],
      ['Bananas', 'Produce', 5, 'count', 5],
      ['Tomatoes', 'Produce', 4, 'count', 6],
      ['Cherries', 'Produce', 1, 'package', 4],
      ['Peaches', 'Produce', 3, 'count', 4],
      ['Sardines', 'Pantry', 1, 'package', 180],
    ];
    this.addItems(
      sample.map(([name, category, quantity, unit, days]) => ({
        name,
        category,
        quantity,
        unit,
        shelfLifeDays: days,
        source: 'sample' as const,
      })),
    );
  },
};
