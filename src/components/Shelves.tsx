import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { isEatSoon } from '../lib/dates';
import { moveToCategory } from '../lib/edit';
import { SHELF_NAMES, SHELF_ORDER } from '../lib/food';
import { useLeaving } from '../lib/motion';
import type { Category, InventoryItem } from '../lib/types';
import { ItemThumb } from './ItemThumb';

interface Props {
  items: InventoryItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** How far the pointer must travel before a press becomes a drag (a click stays a click). */
const DRAG_THRESHOLD = 6;
/** How close to an edge (px) the pointer must be for dragging to scroll. */
const EDGE = 70;

interface Drag {
  item: InventoryItem;
  x: number;
  y: number;
  over: Category | null;
}

/**
 * The inside of the fridge: one shelf per category, produce in the crisper at the bottom.
 * Items wrap onto as many rows as they need and the interior scrolls, so nothing is cut off.
 * Drag any item onto another shelf to change its category.
 */
export function Shelves({ items, selectedId, onSelect }: Props) {
  const leaving = useLeaving();
  const scroller = useRef<HTMLDivElement>(null);

  const [drag, setDrag] = useState<Drag | null>(null);
  const [arrived, setArrived] = useState<string | null>(null);
  const press = useRef<{ item: InventoryItem; x0: number; y0: number; dragging: boolean } | null>(null);
  const swallowClick = useRef(false);
  const pointer = useRef({ x: 0, y: 0 });
  const dragging = drag !== null;

  // Hint that there's more below (Mac scrollbars stay hidden until you scroll).
  const [more, setMore] = useState({ above: false, below: false });
  const checkMore = () => {
    const el = scroller.current;
    if (!el) return;
    setMore({ above: el.scrollTop > 4, below: el.scrollTop + el.clientHeight < el.scrollHeight - 4 });
  };
  useEffect(checkMore, [items]);

  const shelfAt = (x: number, y: number): Category | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-shelf]');
    return el ? (el.dataset.shelf as Category) : null;
  };

  // While dragging near an edge, scroll the fridge interior (or the page) so every shelf is reachable.
  const lastEdgeScroll = useRef(0);
  const edgeScroll = () => {
    const { x, y } = pointer.current;
    const speedFor = (top: number, bottom: number) =>
      y > bottom - EDGE && y < bottom + EDGE ? (y - (bottom - EDGE)) / 4 : y < top + EDGE && y > top - EDGE ? -(top + EDGE - y) / 4 : 0;
    const el = scroller.current;
    let moved = false;
    if (el) {
      const box = el.getBoundingClientRect();
      const speed = speedFor(box.top, box.bottom);
      const room = speed > 0 ? el.scrollHeight - el.clientHeight - el.scrollTop : el.scrollTop;
      if (speed && room > 0) {
        el.scrollTop += speed;
        moved = true;
      }
    }
    if (!moved) {
      const speed = speedFor(0, window.innerHeight);
      if (speed) {
        window.scrollBy(0, speed);
        moved = true;
      }
    }
    if (moved) {
      lastEdgeScroll.current = performance.now();
      setDrag((d) => (d ? { ...d, over: shelfAt(x, y) } : d));
    }
  };
  useEffect(() => {
    if (!dragging) return;
    let raf = 0;
    // Keeps scrolling while the pointer rests at an edge (moving the pointer also scrolls).
    const tick = () => {
      if (performance.now() - lastEdgeScroll.current > 30) edgeScroll();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dragging]); // edgeScroll only reads refs

  const onPointerDown = (item: InventoryItem) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    press.current = { item, x0: e.clientX, y0: e.clientY, dragging: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p) return;
    pointer.current = { x: e.clientX, y: e.clientY };
    if (!p.dragging && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < DRAG_THRESHOLD) return;
    p.dragging = true;
    setDrag({ item: p.item, x: e.clientX, y: e.clientY, over: shelfAt(e.clientX, e.clientY) });
    edgeScroll();
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    press.current = null;
    if (!p?.dragging) return;
    swallowClick.current = true; // the click that follows a drag isn't a "select"
    setDrag(null);
    const target = shelfAt(e.clientX, e.clientY);
    if (!target || target === p.item.category) return;
    moveToCategory(p.item, target);
    setArrived(p.item.id);
    setTimeout(() => setArrived((a) => (a === p.item.id ? null : a)), 700);
  };

  const onPointerCancel = () => {
    press.current = null;
    setDrag(null);
  };

  let order = 0;
  return (
    <div
      className={`shelves ${dragging ? 'is-dragging' : ''} ${more.below ? 'has-more-below' : ''} ${more.above ? 'has-more-above' : ''}`}
      ref={scroller}
      onScroll={checkMore}
    >
      <span className="shelves__light" aria-hidden="true" />
      {items.length === 0 && <p className="serif shelves__empty">nothing in here yet.</p>}
      {SHELF_ORDER.map((category) => {
        const shelfItems = items.filter((i) => i.category === category);
        // Empty shelves stay out of the way — they only appear while you're dragging, as places to drop.
        if (shelfItems.length === 0 && !dragging) return null;
        const crisper = category === 'Produce';
        return (
          <section
            key={category}
            data-shelf={category}
            className={[
              'shelf',
              crisper && 'shelf--crisper',
              category === 'Frozen' && 'shelf--freezer',
              shelfItems.length === 0 && 'is-empty',
              drag && drag.over === category && category !== drag.item.category && 'is-drop-target',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={`${SHELF_NAMES[category]}, ${shelfItems.length} ${shelfItems.length === 1 ? 'item' : 'items'}`}
          >
            <span className="mono shelf__label">
              {SHELF_NAMES[category]} · {shelfItems.length === 0 ? 'drop here' : shelfItems.length}
            </span>
            {shelfItems.length > 0 && (
              <div className="shelf__row">
                {shelfItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={[
                      'shelf__item',
                      item.id === selectedId && 'is-selected',
                      leaving.has(item.id) && 'is-leaving',
                      drag?.item.id === item.id && 'is-picked-up',
                      arrived === item.id && 'is-arriving',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ '--i': order++ } as CSSProperties}
                    onPointerDown={onPointerDown(item)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                    onClick={() => {
                      if (swallowClick.current) {
                        swallowClick.current = false;
                        return;
                      }
                      onSelect(item.id);
                    }}
                    title={`${item.name} — drag to another shelf to move it`}
                  >
                    <ItemThumb item={item} size={crisper ? 48 : 52} round={crisper} />
                    {isEatSoon(item.estimatedExpiration) && <span className="soon-dot" aria-label="eat soon" />}
                    <span className={`shelf__name ${isEatSoon(item.estimatedExpiration) ? 'is-soon' : ''}`}>{item.name}</span>
                  </button>
                ))}
              </div>
            )}
            {!crisper && <span className="shelf__glass" aria-hidden="true" />}
          </section>
        );
      })}

      {/* The item in your hand follows the pointer. Portaled: the fridge's 3D perspective would trap it otherwise. */}
      {drag &&
        createPortal(
          <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
            <ItemThumb item={drag.item} size={56} />
            <span>{drag.over && drag.over !== drag.item.category ? `→ ${SHELF_NAMES[drag.over]}` : drag.item.name}</span>
          </div>,
          document.body,
        )}
    </div>
  );
}
