import { CATEGORIES, UNITS, type ScanKind, type ScannedItem } from '../src/lib/types.ts';

// Shared by both scanners: the Anthropic API (scanApi.ts) and Claude Code (scanClaudeCode.ts).

export const SYSTEM = `You read photos for Leftovers, an app that remembers what food someone has in their fridge.

You receive either a grocery receipt or a photo of one food item. Return every food item you can identify, one entry per product (not per unit — "EGGS 12CT" is one item with quantity 12).

For each item:
- name: a short, plain, human name in sentence case ("Oat milk", "Chicken breast", "Greek yogurt"). Expand receipt abbreviations. No brand names unless the brand is the product's common name.
- receiptText: the exact receipt line you read it from, or "" for an item photo.
- isFood: false for non-food lines (paper towels, bags, tax, discounts, deposits, soap). Still include them so the person can see what was skipped.
- category: the best fit from the allowed list. Bakery is bread, tortillas, bagels and pastries. Condiments & sauces is ketchup, mustard, mayo, jam, dressings, salsa, pesto, hummus, pickles and kimchi. Snacks is chips, crackers, nuts, granola, chocolate and bars. Frozen is anything sold frozen. Pantry is shelf-stable staples like rice, pasta, oats, cereal, canned goods and oil. Use Other only when nothing else fits.
- quantity and unit: "count" for countable things (eggs → 12, bananas → 6), "package" for things bought as one pack/bag/tub/carton (spinach → 1), "percent" only for a photo of a partly used container (then 0–100 for how much is left). Default to quantity 1, unit "package" when unsure.
- shelfLifeDays: typical days until it should be eaten, stored in a home fridge (or pantry for shelf-stable items), counted from purchase. A rough, conservative estimate.
- confidence: "low" whenever you had to guess what the product is (cryptic abbreviation, blurry text, ambiguous packaging); otherwise "high".

If the image contains no food at all, return an empty items array.`;

export const scanSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'receiptText', 'isFood', 'category', 'quantity', 'unit', 'shelfLifeDays', 'confidence'],
        properties: {
          name: { type: 'string' },
          receiptText: { type: 'string' },
          isFood: { type: 'boolean' },
          category: { type: 'string', enum: [...CATEGORIES] },
          quantity: { type: 'number' },
          unit: { type: 'string', enum: [...UNITS] },
          shelfLifeDays: { type: 'integer' },
          confidence: { type: 'string', enum: ['high', 'low'] },
        },
      },
    },
  },
} as const;

export class ScanError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function instructionFor(kind: ScanKind): string {
  return kind === 'receipt'
    ? 'This is a grocery receipt. List every line item.'
    : 'This is a photo of food someone just bought. Identify it.';
}

/** Defensive cleanup of model output: never trust shapes blindly. */
export function sanitize(raw: unknown): ScannedItem[] {
  const items = (raw as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((it): ScannedItem[] => {
    if (!it || typeof it !== 'object') return [];
    const r = it as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!name) return [];
    const category = (CATEGORIES as readonly string[]).includes(r.category as string)
      ? (r.category as ScannedItem['category'])
      : 'Other';
    const unit = (UNITS as readonly string[]).includes(r.unit as string) ? (r.unit as ScannedItem['unit']) : 'package';
    const qty = Number(r.quantity);
    const days = Number(r.shelfLifeDays);
    return [
      {
        name,
        receiptText: typeof r.receiptText === 'string' ? r.receiptText : '',
        isFood: r.isFood !== false,
        category,
        unit,
        quantity: Number.isFinite(qty) && qty > 0 ? (unit === 'percent' ? Math.min(100, qty) : qty) : 1,
        shelfLifeDays: Number.isFinite(days) && days > 0 ? Math.round(days) : 7,
        confidence: r.confidence === 'low' ? 'low' : 'high',
      },
    ];
  });
}
