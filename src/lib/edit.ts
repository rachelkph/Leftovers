import { actions } from './store';
import { showToast } from './toast';
import type { Category, InventoryItem } from './types';

/** Change an item's category (and so its shelf), with an Undo. */
export function moveToCategory(item: InventoryItem, category: Category) {
  if (item.category === category) return;
  const previous = item.category;
  actions.updateItem(item.id, { category });
  showToast(`Moved ${item.name} to ${category}.`, 'Undo', () => actions.updateItem(item.id, { category: previous }));
}
