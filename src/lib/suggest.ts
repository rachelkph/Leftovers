import type { Category, InventoryItem, Unit } from './types';

/** A food you might be adding, with sensible defaults to fill the form. */
export interface FoodSuggestion {
  name: string;
  category: Category;
  unit: Unit;
  quantity: number;
  /** Typical days until best-by, kept in a home fridge (pantry for shelf-stable things). */
  days: number;
  /** True when it comes from your own history rather than the built-in list. */
  fromHistory?: boolean;
}

type Row = [name: string, category: Category, unit: Unit, quantity: number, days: number];

// Common groceries. Shelf lives are conservative fridge estimates — a starting point the person can edit.
const CATALOG: Row[] = [
  // Produce
  ['Apples', 'Produce', 'count', 6, 21], ['Avocado', 'Produce', 'count', 2, 4], ['Bananas', 'Produce', 'count', 6, 5],
  ['Basil', 'Produce', 'package', 1, 5], ['Bell pepper', 'Produce', 'count', 2, 7], ['Blackberries', 'Produce', 'package', 1, 3],
  ['Blueberries', 'Produce', 'package', 1, 6], ['Broccoli', 'Produce', 'count', 1, 5], ['Brussels sprouts', 'Produce', 'package', 1, 6],
  ['Cabbage', 'Produce', 'count', 1, 14], ['Carrots', 'Produce', 'package', 1, 21], ['Cauliflower', 'Produce', 'count', 1, 7],
  ['Celery', 'Produce', 'package', 1, 14], ['Cherries', 'Produce', 'package', 1, 5], ['Cherry tomatoes', 'Produce', 'package', 1, 7],
  ['Cilantro', 'Produce', 'package', 1, 7], ['Corn on the cob', 'Produce', 'count', 4, 3], ['Cucumber', 'Produce', 'count', 1, 7],
  ['Eggplant', 'Produce', 'count', 1, 6], ['Garlic', 'Produce', 'count', 1, 60], ['Ginger', 'Produce', 'count', 1, 21],
  ['Grapefruit', 'Produce', 'count', 2, 14], ['Grapes', 'Produce', 'package', 1, 7], ['Green beans', 'Produce', 'package', 1, 5],
  ['Kale', 'Produce', 'package', 1, 5], ['Kiwi', 'Produce', 'count', 4, 10], ['Leeks', 'Produce', 'count', 2, 10],
  ['Lemons', 'Produce', 'count', 3, 21], ['Lettuce', 'Produce', 'count', 1, 7], ['Limes', 'Produce', 'count', 3, 21],
  ['Mango', 'Produce', 'count', 1, 5], ['Mint', 'Produce', 'package', 1, 7], ['Mixed salad greens', 'Produce', 'package', 1, 5],
  ['Mushrooms', 'Produce', 'package', 1, 5], ['Nectarines', 'Produce', 'count', 4, 4], ['Onions', 'Produce', 'count', 3, 30],
  ['Oranges', 'Produce', 'count', 4, 14], ['Parsley', 'Produce', 'package', 1, 7], ['Peaches', 'Produce', 'count', 4, 4],
  ['Pears', 'Produce', 'count', 4, 7], ['Pineapple', 'Produce', 'count', 1, 4], ['Plums', 'Produce', 'count', 4, 5],
  ['Potatoes', 'Produce', 'package', 1, 30], ['Raspberries', 'Produce', 'package', 1, 3], ['Red onion', 'Produce', 'count', 1, 30],
  ['Scallions', 'Produce', 'package', 1, 7], ['Spinach', 'Produce', 'package', 1, 5], ['Strawberries', 'Produce', 'package', 1, 4],
  ['Sweet potatoes', 'Produce', 'count', 3, 21], ['Tomatoes', 'Produce', 'count', 4, 6], ['Watermelon', 'Produce', 'count', 1, 7],
  ['Zucchini', 'Produce', 'count', 2, 6],
  // Dairy & eggs
  ['Butter', 'Dairy & eggs', 'package', 1, 60], ['Cheddar cheese', 'Dairy & eggs', 'package', 1, 28], ['Cottage cheese', 'Dairy & eggs', 'package', 1, 7],
  ['Cream cheese', 'Dairy & eggs', 'package', 1, 14], ['Eggs', 'Dairy & eggs', 'count', 12, 28], ['Feta', 'Dairy & eggs', 'package', 1, 14],
  ['Greek yogurt', 'Dairy & eggs', 'package', 1, 14], ['Half and half', 'Dairy & eggs', 'percent', 100, 7], ['Heavy cream', 'Dairy & eggs', 'percent', 100, 7],
  ['Milk', 'Dairy & eggs', 'percent', 100, 7], ['Mozzarella', 'Dairy & eggs', 'package', 1, 7], ['Parmesan', 'Dairy & eggs', 'package', 1, 45],
  ['Ricotta', 'Dairy & eggs', 'package', 1, 7], ['Sour cream', 'Dairy & eggs', 'package', 1, 14], ['Yogurt', 'Dairy & eggs', 'package', 1, 14],
  // Drinks
  ['Almond milk', 'Drinks', 'percent', 100, 7], ['Apple juice', 'Drinks', 'percent', 100, 10], ['Cold brew', 'Drinks', 'percent', 100, 10],
  ['Kombucha', 'Drinks', 'count', 2, 30], ['Oat milk', 'Drinks', 'percent', 100, 7], ['Orange juice', 'Drinks', 'percent', 100, 7],
  ['Sparkling water', 'Drinks', 'count', 6, 180], ['Soy milk', 'Drinks', 'percent', 100, 7],
  // Protein
  ['Bacon', 'Protein', 'package', 1, 7], ['Chicken breast', 'Protein', 'count', 2, 2], ['Chicken thighs', 'Protein', 'package', 1, 2],
  ['Deli turkey', 'Protein', 'package', 1, 5], ['Ground beef', 'Protein', 'package', 1, 2], ['Ground turkey', 'Protein', 'package', 1, 2],
  ['Ham', 'Protein', 'package', 1, 5], ['Pork chops', 'Protein', 'count', 2, 3], ['Salmon', 'Protein', 'package', 1, 2],
  ['Sausages', 'Protein', 'package', 1, 3], ['Shrimp', 'Protein', 'package', 1, 2], ['Smoked salmon', 'Protein', 'package', 1, 7],
  ['Steak', 'Protein', 'count', 2, 3], ['Tempeh', 'Protein', 'package', 1, 10], ['Tofu', 'Protein', 'package', 1, 7],
  ['White fish', 'Protein', 'package', 1, 2],
  // Leftovers
  ['Leftover curry', 'Leftovers', 'package', 1, 4], ['Leftover pasta', 'Leftovers', 'package', 1, 4], ['Leftover pizza', 'Leftovers', 'count', 3, 4],
  ['Leftover rice', 'Leftovers', 'package', 1, 4], ['Leftover soup', 'Leftovers', 'package', 1, 4], ['Takeout', 'Leftovers', 'package', 1, 3],
  // Bakery
  ['Bagels', 'Bakery', 'count', 6, 5], ['Baguette', 'Bakery', 'count', 1, 2], ['Bread', 'Bakery', 'package', 1, 6],
  ['Croissants', 'Bakery', 'count', 4, 3], ['English muffins', 'Bakery', 'package', 1, 7], ['Pita', 'Bakery', 'package', 1, 7],
  ['Sourdough', 'Bakery', 'count', 1, 5], ['Tortillas', 'Bakery', 'package', 1, 14],
  // Condiments & sauces
  ['Hot sauce', 'Condiments & sauces', 'percent', 100, 180], ['Hummus', 'Condiments & sauces', 'package', 1, 7],
  ['Jam', 'Condiments & sauces', 'percent', 100, 60], ['Ketchup', 'Condiments & sauces', 'percent', 100, 180],
  ['Kimchi', 'Condiments & sauces', 'package', 1, 60], ['Mayonnaise', 'Condiments & sauces', 'percent', 100, 60],
  ['Mustard', 'Condiments & sauces', 'percent', 100, 180], ['Pesto', 'Condiments & sauces', 'package', 1, 7],
  ['Pickles', 'Condiments & sauces', 'package', 1, 90], ['Salad dressing', 'Condiments & sauces', 'percent', 100, 60],
  ['Salsa', 'Condiments & sauces', 'package', 1, 10], ['Soy sauce', 'Condiments & sauces', 'percent', 100, 365],
  // Snacks
  ['Chocolate', 'Snacks', 'count', 1, 180], ['Crackers', 'Snacks', 'package', 1, 60], ['Granola', 'Snacks', 'package', 1, 60],
  ['Granola bars', 'Snacks', 'count', 6, 90], ['Mixed nuts', 'Snacks', 'package', 1, 90], ['Popcorn', 'Snacks', 'package', 1, 60],
  ['Potato chips', 'Snacks', 'package', 1, 30], ['Tortilla chips', 'Snacks', 'package', 1, 30],
  // Frozen
  ['Dumplings', 'Frozen', 'package', 1, 90], ['Frozen berries', 'Frozen', 'package', 1, 180], ['Frozen peas', 'Frozen', 'package', 1, 180],
  ['Frozen pizza', 'Frozen', 'count', 1, 120], ['Frozen vegetables', 'Frozen', 'package', 1, 180], ['Ice cream', 'Frozen', 'package', 1, 60],
  // Pantry
  ['Black beans', 'Pantry', 'count', 1, 365], ['Canned tomatoes', 'Pantry', 'count', 1, 365], ['Canned tuna', 'Pantry', 'count', 2, 365],
  ['Cereal', 'Pantry', 'package', 1, 120], ['Chickpeas', 'Pantry', 'count', 1, 365], ['Olive oil', 'Pantry', 'percent', 100, 365],
  ['Pasta', 'Pantry', 'package', 1, 365], ['Peanut butter', 'Pantry', 'percent', 100, 90], ['Rice', 'Pantry', 'package', 1, 365],
  ['Rolled oats', 'Pantry', 'package', 1, 180],
];

const BUILT_IN: FoodSuggestion[] = CATALOG.map(([name, category, unit, quantity, days]) => ({ name, category, unit, quantity, days }));

const DAY = 24 * 60 * 60 * 1000;

/** Foods you've added before, newest first, with the category and timing you actually used. */
function historySuggestions(items: InventoryItem[]): FoodSuggestion[] {
  const seen = new Set<string>();
  const out: FoodSuggestion[] = [];
  for (const item of [...items].sort((a, b) => b.addedAt.localeCompare(a.addedAt))) {
    const key = item.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const days = Math.max(0, Math.round((new Date(item.estimatedExpiration).getTime() - new Date(item.addedAt).getTime()) / DAY));
    out.push({ name: item.name, category: item.category, unit: item.unit, quantity: item.initialQuantity, days, fromHistory: true });
  }
  return out;
}

/**
 * Suggestions for what someone is typing. Names that start with the text rank first,
 * then a word that starts with it ("milk" → "Oat milk"), then anywhere in the name.
 * Your own history wins over the built-in list for the same food.
 */
export function suggestFoods(query: string, items: InventoryItem[], limit = 6): FoodSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const score = (name: string) => {
    const n = name.toLowerCase();
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.split(/\s+/).some((w) => w.startsWith(q))) return 2;
    if (n.includes(q)) return 3;
    return -1;
  };
  const history = historySuggestions(items);
  const historyNames = new Set(history.map((h) => h.name.toLowerCase()));
  const pool = [...history, ...BUILT_IN.filter((b) => !historyNames.has(b.name.toLowerCase()))];
  return pool
    .map((s, i) => ({ s, rank: score(s.name), i }))
    .filter((x) => x.rank >= 0)
    // Better match first; on ties, your history (listed first) before the built-in list.
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.s);
}
