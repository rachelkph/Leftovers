// Shared by the browser app and the dev server's /api/scan route.

export const CATEGORIES = [
  'Produce',
  'Dairy & eggs',
  'Protein',
  'Leftovers',
  'Drinks',
  'Bakery',
  'Condiments & sauces',
  'Snacks',
  'Frozen',
  'Pantry',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

// "count" = 8 eggs, "percent" = ~40% of the oat milk left, "package" = 1 bag of spinach.
export const UNITS = ['count', 'percent', 'package'] as const;
export type Unit = (typeof UNITS)[number];

export type Visibility = 'mine' | 'shared';
export type ItemStatus = 'active' | 'finished' | 'tossed';
export type ItemSource = 'receipt' | 'photo' | 'manual' | 'sample';

export interface InventoryItem {
  id: string;
  name: string;
  category: Category;
  quantity: number;
  unit: Unit;
  /** Starting quantity, so the detail view can say "6 left from 12". */
  initialQuantity: number;
  imageUrl: string | null;
  addedAt: string; // ISO date
  estimatedExpiration: string; // ISO date — always an estimate
  status: ItemStatus;
  source: ItemSource;
  visibility: Visibility;
  finishedAt?: string;
}

export type ScanKind = 'receipt' | 'item';

export interface ScanRequest {
  kind: ScanKind;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  /** Base64 image data without the data: prefix. */
  data: string;
}

export interface ScannedItem {
  name: string;
  /** The raw receipt line, e.g. "OATMLK BRST 64OZ". Empty for item photos. */
  receiptText: string;
  isFood: boolean;
  category: Category;
  quantity: number;
  unit: Unit;
  shelfLifeDays: number;
  confidence: 'high' | 'low';
}

export interface ScanResponse {
  items: ScannedItem[];
}
