import { useEffect, useState } from 'react';
import { freshnessLabel, isEatSoon, lifeProgress, shortDate } from '../lib/dates';
import { heroPhotoFor, maxFor, quantityLabel, stepFor } from '../lib/food';
import { IMAGE_ACCEPT, toThumbnail } from '../lib/image';
import { moveToCategory } from '../lib/edit';
import { leaveThen, usePulse } from '../lib/motion';
import { actions } from '../lib/store';
import { showToast } from '../lib/toast';
import { CATEGORIES, UNITS, type Category, type InventoryItem, type Unit } from '../lib/types';
import { ItemThumb } from './ItemThumb';

interface Props {
  item: InventoryItem;
  shared: boolean;
  /** Called after the item leaves the fridge, so the parent can pick another. */
  onClosed?: () => void;
  /** Close the panel and go back to the overview, without changing the item. */
  onDismiss?: () => void;
}

const UNIT_NAMES: Record<Unit, string> = { count: 'Count', percent: 'How full (%)', package: 'Packages' };

export function ItemPanel({ item, shared, onClosed, onDismiss }: Props) {
  const [editing, setEditing] = useState(false);
  useEffect(() => setEditing(false), [item.id]);

  const bump = usePulse(item.quantity, 300);

  const close = (status: 'finished' | 'tossed') => {
    const { id, name } = item;
    onClosed?.();
    leaveThen(id, () => {
      actions.close(id, status);
      showToast(`${name} — ${status === 'finished' ? 'finished' : 'tossed'}.`, 'Undo', () => actions.reopen(id));
    });
  };

  const step = stepFor(item.unit);
  const soon = isEatSoon(item.estimatedExpiration);

  return (
    <article className="item-panel">
      <div className="item-panel__media">
        <ItemThumb item={item} src={heroPhotoFor(item)} className="item-panel__hero" />
        {onDismiss && (
          <button type="button" className="item-panel__close" onClick={onDismiss} aria-label="Close details" title="Close (Esc)">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        )}
      </div>
      <div className="item-panel__head">
        <div>
          <span className="mono meta">
            {item.category}
            {shared && ` · ${item.visibility === 'shared' ? 'Shared' : 'Mine'}`} · added {shortDate(item.addedAt)}
          </span>
          <h2 className="serif item-panel__name">{item.name}</h2>
        </div>
        <button type="button" className="link-button" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <EditForm item={item} shared={shared} />
      ) : (
        <>
          <div className="timeline" aria-label={`Best by about ${shortDate(item.estimatedExpiration)}`}>
            <div className="timeline__track">
              <span className="timeline__start" />
              <span className={`timeline__now ${soon ? 'is-soon' : ''}`} style={{ left: `${lifeProgress(item.addedAt, item.estimatedExpiration) * 100}%` }} />
              <span className="timeline__end" />
            </div>
            <div className="timeline__labels mono">
              <span>Added {shortDate(item.addedAt)}</span>
              <span className={soon ? 'is-soon' : ''}>{freshnessLabel(item.estimatedExpiration)}</span>
              <span>Best by ~{shortDate(item.estimatedExpiration)}</span>
            </div>
          </div>

          <div className="row-line">
            <div className="stack-tight">
              <span className="label-strong">Left</span>
              <span className="mono meta">
                {quantityLabel(item.quantity, item.unit)}
                {item.unit === 'count' && item.initialQuantity > item.quantity ? ` · from ${item.initialQuantity}` : ''}
              </span>
            </div>
            <div className="stepper">
              <button type="button" aria-label="Less" disabled={item.quantity <= 0} onClick={() => actions.setQuantity(item.id, Math.max(0, item.quantity - step))}>
                −
              </button>
              <span className={`serif stepper__value ${bump ? 'is-bumped' : ''}`}>{item.unit === 'percent' ? `${Math.round(item.quantity)}%` : item.quantity}</span>
              <button type="button" aria-label="More" disabled={item.quantity >= maxFor(item.unit)} onClick={() => actions.setQuantity(item.id, Math.min(maxFor(item.unit), item.quantity + step))}>
                +
              </button>
            </div>
          </div>

          <div className="row-line">
            <span className="label-strong">Category</span>
            <select className="cell-input cell-select panel-select" aria-label={`Category of ${item.name}`} value={item.category} onChange={(e) => moveToCategory(item, e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {shared && (
            <div className="row-line">
              <span className="label-strong">Whose</span>
              <div className="segmented">
                <button type="button" aria-pressed={item.visibility === 'mine'} onClick={() => actions.updateItem(item.id, { visibility: 'mine' })}>
                  Mine
                </button>
                <button type="button" aria-pressed={item.visibility === 'shared'} onClick={() => actions.updateItem(item.id, { visibility: 'shared' })}>
                  Shared
                </button>
              </div>
            </div>
          )}

          <div className="item-panel__actions">
            <button type="button" className="btn btn--primary btn--grow" onClick={() => close('finished')}>
              Finished it
            </button>
            <button type="button" className="btn" onClick={() => close('tossed')}>
              Tossed it
            </button>
          </div>
          <p className="mono fine-print">Dates are estimates, not food-safety advice. Trust your nose.</p>
        </>
      )}
    </article>
  );
}

function EditForm({ item, shared }: { item: InventoryItem; shared: boolean }) {
  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      actions.updateItem(item.id, { imageUrl: await toThumbnail(file) });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'We couldn’t open that photo.');
    }
  };
  return (
    <div className="edit-form">
      <label className="field">
        <span className="mono">Name</span>
        <input value={item.name} onChange={(e) => actions.updateItem(item.id, { name: e.target.value })} />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="mono">Category</span>
          <select value={item.category} onChange={(e) => moveToCategory(item, e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="mono">Best by (estimate)</span>
          <input
            type="date"
            value={item.estimatedExpiration.slice(0, 10)}
            onChange={(e) => e.target.value && actions.updateItem(item.id, { estimatedExpiration: new Date(e.target.value + 'T00:00').toISOString() })}
          />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span className="mono">Measured as</span>
          <select
            value={item.unit}
            onChange={(e) => {
              const unit = e.target.value as Unit;
              const quantity = unit === 'percent' ? 100 : Math.max(1, Math.round(item.quantity));
              actions.updateItem(item.id, { unit, quantity, initialQuantity: quantity });
            }}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {UNIT_NAMES[u]}
              </option>
            ))}
          </select>
        </label>
        {shared && (
          <label className="field">
            <span className="mono">Whose</span>
            <select value={item.visibility} onChange={(e) => actions.updateItem(item.id, { visibility: e.target.value as 'mine' | 'shared' })}>
              <option value="mine">Mine</option>
              <option value="shared">Shared</option>
            </select>
          </label>
        )}
      </div>
      <label className="field">
        <span className="mono">Photo</span>
        <input type="file" accept={IMAGE_ACCEPT} onChange={(e) => onPhoto(e.target.files?.[0])} />
      </label>
      <button
        type="button"
        className="link-button link-button--danger"
        onClick={() => {
          actions.deleteItem(item.id);
          showToast(`Removed ${item.name}.`);
        }}
      >
        Delete this entry (added by mistake)
      </button>
    </div>
  );
}
