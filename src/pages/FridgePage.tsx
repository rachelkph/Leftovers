import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Fridge } from '../components/Fridge';
import { ItemPanel } from '../components/ItemPanel';
import { ItemThumb } from '../components/ItemThumb';
import { Shelves } from '../components/Shelves';
import { freshnessLabel, isEatSoon, shortDate } from '../lib/dates';
import { maxFor } from '../lib/food';
import { moveToCategory } from '../lib/edit';
import { useLeaving } from '../lib/motion';
import { actions, activeItems, eatSoon, selectItems, selectSettings, useStore } from '../lib/store';
import { CATEGORIES, type Category, type InventoryItem, type Unit, type Visibility } from '../lib/types';

export function FridgePage({ onAdd }: { onAdd: () => void }) {
  const items = useStore(selectItems);
  const settings = useStore(selectSettings);
  const [params, setParams] = useSearchParams();
  const active = useMemo(() => activeItems(items), [items]);
  const soon = eatSoon(items);
  const shared = settings.mode === 'shared';

  const [open, setOpen] = useState(params.get('open') === '1' || params.has('item'));
  const [selectedId, setSelectedId] = useState<string | null>(params.get('item'));
  const view = settings.fridgeView;

  // Follow search / eat-soon links: select the item and open the door.
  useEffect(() => {
    const id = params.get('item');
    if (id) {
      setSelectedId(id);
      setOpen(true);
    }
  }, [params]);

  const selected = active.find((i) => i.id === selectedId) ?? null;

  const deselect = () => {
    setSelectedId(null);
    setParams({}, { replace: true });
  };

  // Clicking the item that's already open closes it again.
  const select = (id: string) => {
    if (id === selectedId) return deselect();
    setSelectedId(id);
    setParams({ item: id }, { replace: true });
  };

  // Escape goes back to the overview (unless a dialog is open — it handles Escape itself).
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.overlay')) deselect();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="fridge-page">
      <section className="stage" aria-label="Your fridge">
        <div className="stage__bar">
          <div className="stage__bar-left">
            <div className="segmented">
              <button type="button" aria-pressed={view === 'fridge'} onClick={() => actions.updateSettings({ fridgeView: 'fridge' })}>
                Fridge view
              </button>
              <button type="button" aria-pressed={view === 'list'} onClick={() => actions.updateSettings({ fridgeView: 'list' })}>
                List view
              </button>
            </div>
            <span className="mono meta">
              {active.length} {active.length === 1 ? 'thing' : 'things'}
            </span>
          </div>
          <div className="stage__bar-right">
            {view === 'fridge' && (
              <button type="button" className="link-button mono" onClick={() => setOpen((o) => !o)}>
                {open ? 'Close door' : 'Open door'}
              </button>
            )}
            <Link to="/fridge/customize" className="link-button mono">
              Customize
            </Link>
          </div>
        </div>

        {view === 'fridge' ? (
          <div className="stage__fridge">
            <Fridge
              settings={settings}
              eatSoon={soon}
              open={open}
              onToggleDoor={() => setOpen((o) => !o)}
              onEatSoonClick={(id) => {
                select(id);
                setOpen(true);
              }}
              interior={<Shelves items={active} selectedId={selectedId} onSelect={select} />}
            />
            {!open && <p className="mono meta stage__hint">Pull the handle to look inside</p>}
          </div>
        ) : (
          <ListView items={active} selectedId={selectedId} onSelect={select} onFocusItem={(id) => id !== selectedId && select(id)} shared={shared} onAdd={onAdd} />
        )}
      </section>

      <aside className="side">
        <div className="side__soon">
          <div className="section-head">
            <h2 className="serif">eat soon</h2>
          </div>
          {soon.length === 0 && <p className="meta soft-note">Nothing pressing.</p>}
          {soon.map((i) => (
            <button key={i.id} type="button" className={`list-row list-row--compact ${i.id === selectedId ? 'is-selected' : ''}`} onClick={() => select(i.id)}>
              <ItemThumb item={i} size={36} />
              <span className="list-row__text">
                <span>{i.name}</span>
              </span>
              <span className={`mono ${freshnessLabel(i.estimatedExpiration) === 'today' ? 'is-soon' : 'meta'}`}>{freshnessLabel(i.estimatedExpiration)}</span>
            </button>
          ))}
        </div>
        {selected ? (
          <ItemPanel item={selected} shared={shared} onClosed={deselect} onDismiss={deselect} />
        ) : (
          <div className="side__empty">
            <p className="serif side__empty-title">pick something.</p>
            <p className="meta">Click any item on a shelf to see how much is left, change it, or mark it finished.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

interface ListProps {
  items: InventoryItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Show this item without toggling it closed (used when you click into a field). */
  onFocusItem: (id: string) => void;
  shared: boolean;
  onAdd: () => void;
}

const UNIT_SUFFIX: Record<Unit, string> = { count: 'left', package: 'pack', percent: '% full' };

function ListView({ items, selectedId, onSelect, onFocusItem, shared, onAdd }: ListProps) {
  const leaving = useLeaving();
  // Order is fixed while you edit, so a row doesn't jump away from your cursor mid-change.
  const [order, setOrder] = useState<string[]>([]);
  useEffect(() => {
    setOrder((prev) => {
      const byDate = [...items].sort((a, b) => a.estimatedExpiration.localeCompare(b.estimatedExpiration)).map((i) => i.id);
      const kept = prev.filter((id) => byDate.includes(id));
      return [...kept, ...byDate.filter((id) => !kept.includes(id))];
    });
  }, [items]);
  const rows = order.map((id) => items.find((i) => i.id === id)).filter((i): i is InventoryItem => !!i);

  if (items.length === 0) {
    return (
      <div className="list-empty">
        <p className="serif">nothing left here.</p>
        <button type="button" className="btn btn--primary" onClick={onAdd}>
          Add food
        </button>
      </div>
    );
  }
  return (
    <div className="list-view" role="table" aria-label="Everything in your fridge — click any field to edit it">
      <div className={`list-view__row list-view__head mono ${shared ? 'has-whose' : ''}`} role="row">
        <span role="columnheader">Item</span>
        <span role="columnheader">Category</span>
        <span role="columnheader">Left</span>
        <span role="columnheader">Best by</span>
        {shared && <span role="columnheader">Whose</span>}
      </div>
      {rows.map((i, n) => (
        <div
          key={i.id}
          role="row"
          style={{ '--i': n } as CSSProperties}
          className={`list-view__row ${shared ? 'has-whose' : ''} ${i.id === selectedId ? 'is-selected' : ''} ${leaving.has(i.id) ? 'is-leaving' : ''}`}
          onClick={(e) => {
            // Clicking into a field edits it; clicking anywhere else on the row opens or closes it.
            if ((e.target as HTMLElement).closest('input, select')) onFocusItem(i.id);
            else onSelect(i.id);
          }}
        >
          <span className="list-view__item" role="cell">
            <ItemThumb item={i} size={30} />
            <EditableText value={i.name} label="Name" onCommit={(name) => actions.updateItem(i.id, { name })} />
          </span>
          <span role="cell">
            <select className="cell-input cell-select" aria-label={`Category of ${i.name}`} value={i.category} onChange={(e) => moveToCategory(i, e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </span>
          <span role="cell" className="cell-qty">
            <EditableNumber
              value={i.quantity}
              max={maxFor(i.unit)}
              label={`How much ${i.name} is left`}
              onCommit={(quantity) => actions.setQuantity(i.id, quantity)}
            />
            <span className="mono meta">{i.unit === 'package' && i.quantity !== 1 ? 'packs' : UNIT_SUFFIX[i.unit]}</span>
          </span>
          <span role="cell">
            <DateCell
              iso={i.estimatedExpiration}
              soon={isEatSoon(i.estimatedExpiration)}
              label={`Best-by estimate for ${i.name}`}
              onChange={(iso) => actions.updateItem(i.id, { estimatedExpiration: iso })}
            />
          </span>
          {shared && (
            <span role="cell">
              <select
                className="cell-input cell-select"
                aria-label={`Whose ${i.name} is`}
                value={i.visibility}
                onChange={(e) => actions.updateItem(i.id, { visibility: e.target.value as Visibility })}
              >
                <option value="mine">Mine</option>
                <option value="shared">Shared</option>
              </select>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** A compact "~Oct 13" that opens the date picker when clicked. */
function DateCell({ iso, soon, label, onChange }: { iso: string; soon: boolean; label: string; onChange: (iso: string) => void }) {
  return (
    <label className={`cell-input cell-date ${soon ? 'is-soon' : ''}`}>
      <span className="mono">~{shortDate(iso)}</span>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
        <rect x="1.5" y="2.5" width="9" height="8" rx="1" />
        <path d="M1.5 5h9M4 1v3M8 1v3" />
      </svg>
      {/* The real date input sits invisibly on top, so clicking anywhere opens the picker. */}
      <input
        type="date"
        className="cell-date__picker"
        aria-label={label}
        value={iso.slice(0, 10)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker();
          } catch {
            // Older browsers: the focused input still accepts typing.
          }
        }}
        onChange={(e) => e.target.value && onChange(new Date(e.target.value + 'T00:00').toISOString())}
      />
    </label>
  );
}

/** Text that edits in place: saves on Enter or when you click away, Escape puts it back. */
function EditableText({ value, label, onCommit }: { value: string; label: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const v = draft.trim();
    if (v && v !== value) onCommit(v);
    else setDraft(value);
  };
  return (
    <input
      className="cell-input cell-text"
      aria-label={label}
      title={value}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(value);
          e.stopPropagation();
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
    />
  );
}

function EditableNumber({ value, max, label, onCommit }: { value: number; max: number; label: string; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(n) && n >= 0) onCommit(Math.min(max, Math.round(n * 10) / 10));
    else setDraft(String(value));
  };
  return (
    <input
      className="cell-input cell-number mono"
      type="number"
      min={0}
      max={max}
      aria-label={label}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}
