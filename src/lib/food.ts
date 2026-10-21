import type { Category, InventoryItem, Unit } from './types';

const L = (name: string) => `/food/lib/${name}.jpg`;

/**
 * Library photos in public/food, matched by keywords in the item name.
 * First match wins, so more specific names come before general ones
 * ("pineapple" before "apple", "peanut butter" before "butter").
 * Items with no match show their category photo behind their initials.
 */
const PHOTO_MATCHES: Array<[RegExp, string | null]> = [
  // Dishes and prepared foods first, so "chicken soup" shows soup and "leftover pizza" shows pizza.
  [/pizza/i, L('pizza')],
  [/curry|tikka|korma|dal\b|daal/i, L('curry')],
  [/soup|stew|broth|chowder|ramen|pho\b/i, L('soup')],
  [/dumpling|gyoza|potsticker|wonton|bao\b/i, L('dumplings')],
  // Prepared foods, so "strawberry jam" shows jam and "dill pickles" shows pickles.
  [/granola|muesli/i, L('granola')],
  [/take-?out|takeaway|to-go/i, L('takeout')],
  [/sandwich|deli turkey|turkey slices|sliced turkey|deli meat|cold cuts/i, L('deli-turkey')],
  [/mustard|dijon/i, L('mustard')],
  [/mayo|aioli/i, L('mayonnaise')],
  [/soy sauce|tamari/i, L('soy-sauce')],
  [/chocolate|cocoa|cacao/i, L('chocolate')],
  [/cereal|corn ?flakes|cheerios/i, L('cereal')],
  [/cracker/i, L('crackers')],
  [/\bchips\b|crisps/i, L('chips')],
  [/hummus|houmous/i, L('hummus')],
  [/kimchi|sauerkraut/i, L('kimchi')],
  [/pickle|gherkin/i, L('pickles')],
  [/salsa/i, L('salsa')],
  [/\bjam\b|jelly|marmalade|preserves/i, L('jam')],

  // Specific names that would otherwise be caught by a shorter word below.
  [/pineapple/i, L('pineapple')],
  [/grapefruit/i, L('grapefruit')],
  [/watermelon/i, L('watermelon')],
  [/peanut butter|almond butter/i, null],
  [/sweet potato|\byams?\b/i, L('sweet-potatoes')],
  [/egg ?plant|aubergine/i, L('eggplant')],
  [/orange juice|apple juice|juice/i, L('cat-drinks')],
  [/cream cheese/i, L('cream-cheese')],
  [/ice cream|gelato|sorbet/i, L('ice-cream')],
  [/sour cream|cr[eè]me fra[iî]che/i, L('sour-cream')],
  [/half and half|half & half|heavy cream|whipping cream|\bcream\b|buttermilk/i, L('milk')],
  [/cold brew|iced coffee|coffee/i, L('cold-brew')],
  [/kombucha/i, L('kombucha')],
  [/sparkling water|seltzer|soda water|mineral water|\bwater\b/i, L('sparkling-water')],
  [/spring onion|green onion|scallion/i, L('spring-onions')],
  [/green bean|string bean/i, L('green-beans')],
  [/brussels/i, L('brussels-sprouts')],
  [/parmesan|parmigiano|pecorino/i, L('parmesan')],
  [/popcorn/i, null],
  [/black pepper|peppercorn|pepper flakes|cayenne|chilli powder/i, null],

  // Produce
  [/strawberr/i, '/food/strawberry.jpg'],
  [/raspberr/i, L('raspberries')],
  [/blueberr/i, L('blueberries')],
  [/blackberr/i, L('blackberries')],
  [/\bberries\b|mixed berr/i, L('blueberries')],
  [/cherr(y|ies)(?! tomato)/i, '/food/cherries.jpg'],
  [/grape/i, L('grapes')],
  [/apple/i, L('apple')],
  [/pear\b|pears/i, L('pear')],
  [/peach|nectarine/i, '/food/peach.jpg'],
  [/\bplums?\b/i, L('plums')],
  [/mango/i, L('mango')],
  [/kiwi/i, L('kiwi')],
  [/banana/i, '/food/bananas.jpg'],
  [/orange|clementine|mandarin|tangerine/i, L('orange')],
  [/lemon/i, '/food/lemons.jpg'],
  [/lime/i, L('limes')],
  [/avocado/i, '/food/avocado.jpg'],
  [/tomato/i, '/food/tomato.jpg'],
  [/spinach|greens|kale|chard|arugula|rocket/i, '/food/spinach.jpg'],
  [/lettuce|romaine|little gem/i, L('lettuce')],
  [/salad/i, L('salad')],
  [/broccoli/i, L('broccoli')],
  [/cauliflower/i, L('cauliflower')],
  [/cabbage|bok choy/i, L('cabbage')],
  [/carrot/i, L('carrots')],
  [/celery/i, L('celery')],
  [/cucumber/i, L('cucumber')],
  [/zucchini|courgette/i, L('zucchini')],
  [/okra/i, L('okra')],
  [/\bleeks?\b/i, L('leeks')],
  [/pepper|capsicum/i, L('bell-pepper')],
  [/onion|shallot/i, L('onion')],
  [/garlic/i, L('garlic')],
  [/ginger/i, L('ginger')],
  [/potato/i, L('potatoes')],
  [/mushroom/i, L('mushrooms')],
  [/corn\b|sweetcorn|corn on/i, L('corn')],
  [/\bpeas?\b|edamame|frozen veg|mixed veg|stir.?fry mix/i, L('peas')],
  [/pesto/i, L('pesto')],
  [/parsley|cilantro|coriander|basil|dill|mint|herb/i, L('herbs')],

  // Dairy & eggs
  [/\beggs?\b|egg whites?|egg yolks?/i, '/food/eggs.jpg'],
  [/yog(h)?urt|skyr|kefir/i, '/food/yogurt.jpg'],
  [/butter/i, '/food/butter.jpg'],
  [/milk/i, L('milk')],
  [/cheese|cheddar|brie|gouda|feta|halloumi|mozzarella|camembert|ricotta/i, L('cheese')],

  // Protein
  [/chicken/i, L('chicken')],
  [/salmon|trout/i, '/food/salmon.jpg'],
  [/\btuna\b/i, L('tuna')],
  [/sardine|anchov|tinned fish/i, '/food/sardines.jpg'],
  [/\bcod\b|haddock|tilapia|halibut|pollock|white ?fish|hake/i, L('white-fish')],
  [/shrimp|prawn/i, L('shrimp')],
  [/sausage|chorizo|bratwurst|hot dog/i, L('sausages')],
  [/pork|bacon|ham\b/i, L('pork')],
  [/beef|steak|mince|ground/i, L('beef')],
  [/tofu|tempeh/i, '/food/tofu.jpg'],

  // Everything else
  [/baguette|french bread/i, L('baguette')],
  [/pita|flatbread|naan/i, L('tortillas')],
  [/croissant|brioche|english muffin|muffins?\b/i, L('bread')],
  [/bread|loaf|sourdough|bagel|\bbuns?\b|\brolls?\b/i, L('bread')],
  [/tortilla|wrap|quesadilla/i, L('tortillas')],
  [/pasta|penne|spaghetti|noodle|macaroni|fusilli|lasagn/i, L('pasta')],
  [/\brice\b|risotto/i, L('rice')],
  [/\boats?\b|oatmeal|porridge/i, L('oats')],
  [/\bnuts?\b|almonds|cashews?|walnuts?|pecans?|pistachios?|peanuts\b|hazelnuts?/i, L('nuts')],
  [/\bbeans?\b|chickpeas?|garbanzo|lentils?/i, L('beans')],
  [/olive oil|\boil\b/i, L('olive-oil')],
];

const CATEGORY_PHOTOS: Record<Category, string> = {
  Produce: L('cat-produce'),
  'Dairy & eggs': '/food/eggs.jpg',
  Protein: L('cat-protein'),
  Leftovers: L('cat-leftovers'),
  Drinks: L('cat-drinks'),
  Bakery: L('baguette'),
  'Condiments & sauces': L('salsa'),
  Snacks: L('chips'),
  Frozen: L('peas'),
  Pantry: L('cat-pantry'),
  Other: L('cat-other'),
};

/** Larger, more editorial crops for the detail view where we have them. */
const HERO_PHOTOS: Record<string, string> = {
  '/food/strawberry.jpg': '/food/strawberries-hands.jpg',
};

export function stockPhotoFor(name: string): string | null {
  // A null entry means "we know this food but have no good photo" — stop, don't fall through.
  for (const [re, url] of PHOTO_MATCHES) if (re.test(name)) return url;
  return null;
}

type Photographable = Pick<InventoryItem, 'name' | 'imageUrl'>;

/**
 * The picture to show for an item: your own photo first, then the library.
 * Stock photos are looked up at display time (never stored), so every item
 * benefits when the library grows.
 */
export function photoFor(item: Photographable): string | null {
  return item.imageUrl ?? stockPhotoFor(item.name);
}

export function heroPhotoFor(item: Photographable): string | null {
  const url = photoFor(item);
  return url ? (HERO_PHOTOS[url] ?? url) : null;
}

/** Soft background for items with no photo of their own, so every tile is still a photograph. */
export function categoryPhoto(category: Category): string {
  return CATEGORY_PHOTOS[category];
}

export function monogram(name: string): string {
  const words = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2);
  return words[0][0] + words[1][0];
}

/** Fallback shelf life (days) when a person adds food by hand. */
export const DEFAULT_SHELF_LIFE: Record<Category, number> = {
  Produce: 5,
  'Dairy & eggs': 10,
  Protein: 3,
  Leftovers: 4,
  Drinks: 10,
  Bakery: 5,
  'Condiments & sauces': 60,
  Snacks: 60,
  Frozen: 90,
  Pantry: 90,
  Other: 7,
};

/**
 * One shelf per category, top to bottom, the way a real fridge is usually stocked.
 * Produce lives in the crisper drawer at the bottom.
 */
export const SHELF_ORDER: Category[] = [
  'Dairy & eggs',
  'Drinks',
  'Protein',
  'Leftovers',
  'Condiments & sauces',
  'Bakery',
  'Snacks',
  'Frozen',
  'Pantry',
  'Other',
  'Produce',
];

/** What each shelf is called inside the fridge. */
export const SHELF_NAMES: Record<Category, string> = {
  'Dairy & eggs': 'Dairy & eggs',
  Drinks: 'Drinks',
  Protein: 'Protein',
  Leftovers: 'Leftovers',
  'Condiments & sauces': 'Condiments & sauces',
  Bakery: 'Bakery',
  Snacks: 'Snacks',
  Frozen: 'Freezer',
  Pantry: 'Pantry',
  Other: 'Everything else',
  Produce: 'Crisper · produce',
};

export function quantityLabel(qty: number, unit: Unit): string {
  if (unit === 'percent') return `~${Math.round(qty)}% left`;
  if (unit === 'package') return qty === 1 ? '1 pack' : `${qty} packs`;
  return `${qty} left`;
}

export function stepFor(unit: Unit): number {
  return unit === 'percent' ? 10 : 1;
}

export function maxFor(unit: Unit): number {
  return unit === 'percent' ? 100 : 999;
}
