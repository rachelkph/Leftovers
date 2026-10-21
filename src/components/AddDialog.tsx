import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { DEFAULT_SHELF_LIFE } from '../lib/food';
import { IMAGE_ACCEPT, decodeImage, isImageFile, scan, scanPayloadFrom, thumbnailFrom, toThumbnail } from '../lib/image';
import { actions, type NewItem } from '../lib/store';
import { showToast } from '../lib/toast';
import { CATEGORIES, type Category, type ScanKind, type ScannedItem, type Unit } from '../lib/types';
import { FoodNameInput } from './FoodNameInput';
import { ItemThumb } from './ItemThumb';

interface Props {
  onClose: () => void;
  shared: boolean;
}

interface ReviewRow extends ScannedItem {
  key: string;
  include: boolean;
  /** Low-confidence rows must be confirmed or edited before they're added. */
  confirmed: boolean;
  editing: boolean;
  imageUrl: string | null;
}

type Step =
  | { name: 'choose' }
  | { name: 'scanning'; kind: ScanKind; preview: string }
  | { name: 'review'; kind: ScanKind; rows: ReviewRow[]; preview: string }
  | { name: 'error'; kind: ScanKind; message: string }
  | { name: 'manual' };

export function AddDialog({ onClose, shared }: Props) {
  const [step, setStep] = useState<Step>({ name: 'choose' });
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingKind = useRef<ScanKind>('receipt');
  const panel = useRef<HTMLDivElement>(null);

  // Backdrop clicks and Escape only dismiss when there's nothing to lose.
  const dismissable = step.name === 'choose' || step.name === 'error';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismissable && onClose();
    window.addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, dismissable]);

  const pick = (kind: ScanKind) => {
    pendingKind.current = kind;
    fileInput.current?.click();
  };

  const runScan = async (file: File, kind: ScanKind) => {
    if (!(await isImageFile(file))) {
      setStep({ name: 'error', kind, message: 'That doesn’t look like a photo. Try a JPG, PNG or HEIC.' });
      return;
    }
    // Show progress right away — converting an iPhone HEIC photo can take a moment.
    setStep({ name: 'scanning', kind, preview: '' });
    try {
      // Decode once; both the preview and the scan come from the same picture.
      const bitmap = await decodeImage(file);
      const preview = thumbnailFrom(bitmap);
      const payload = scanPayloadFrom(bitmap, kind);
      bitmap.close();
      setStep({ name: 'scanning', kind, preview });
      const { items } = await scan(payload);
      const rows: ReviewRow[] = items.map((it, i) => ({
        ...it,
        key: `${i}-${it.name}`,
        include: it.isFood,
        confirmed: it.confidence === 'high',
        editing: false,
        // An item photo is the best picture of that item we'll ever get.
        imageUrl: kind === 'item' ? preview : null,
      }));
      setStep({ name: 'review', kind, rows, preview });
    } catch (e) {
      setStep({ name: 'error', kind, message: e instanceof Error ? e.message : 'We couldn’t read that image.' });
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) runScan(file, step.name === 'error' ? step.kind : 'receipt');
  };

  return (
    <div className="overlay" onMouseDown={(e) => dismissable && e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Add food" tabIndex={-1} ref={panel} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <button type="button" className="dialog__close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={IMAGE_ACCEPT}
          capture="environment"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) runScan(file, pendingKind.current);
          }}
        />

        {step.name === 'choose' && (
          <div className="add-choose">
            <h2 className="serif dialog__title">what are you adding?</h2>
            <p className="meta">Snap it, check it, forget it. You can also drop a photo anywhere in this window.</p>
            <div className="add-choose__options">
              <button type="button" className="add-option" onClick={() => pick('receipt')}>
                <img src="/food/receipt.jpg" alt="" className="add-option__img add-option__img--receipt" />
                <span className="serif add-option__title">Scan a receipt</span>
                <span className="meta">Everything from one shop, in one go.</span>
              </button>
              <button type="button" className="add-option" onClick={() => pick('item')}>
                <img src="/food/avocado.jpg" alt="" className="add-option__img add-option__img--round" />
                <span className="serif add-option__title">Scan an item</span>
                <span className="meta">One thing, with its own photo.</span>
              </button>
              <button type="button" className="add-option" onClick={() => setStep({ name: 'manual' })}>
                <span className="add-option__img add-option__img--type serif">Aa</span>
                <span className="serif add-option__title">Add by hand</span>
                <span className="meta">Quick fields, no camera.</span>
              </button>
            </div>
          </div>
        )}

        {step.name === 'scanning' && (
          <div className="scanning">
            <div className="scanning__photo">
              {step.preview ? (
                <img src={step.preview} alt="Your photo" className="scanning__img" />
              ) : (
                <span className="scanning__img scanning__img--pending" aria-hidden="true" />
              )}
              <span className="scanning__sweep" aria-hidden="true" />
            </div>
            <p className="serif scanning__line">{step.kind === 'receipt' ? 'reading your receipt…' : 'taking a look…'}</p>
            <p className="mono meta">Usually 10–20 seconds</p>
          </div>
        )}

        {step.name === 'error' && (
          <div className="scanning">
            <p className="serif scanning__line">hm, that didn’t work.</p>
            <p className="meta">{step.message}</p>
            <div className="btn-row">
              <button type="button" className="btn btn--primary" onClick={() => pick(step.kind)}>
                Try another photo
              </button>
              <button type="button" className="btn" onClick={() => setStep({ name: 'manual' })}>
                Add by hand instead
              </button>
            </div>
          </div>
        )}

        {step.name === 'review' && (
          <Review
            kind={step.kind}
            preview={step.preview}
            rows={step.rows}
            onRows={(rows) => setStep({ ...step, rows })}
            onRescan={() => pick(step.kind)}
            onDone={(items) => {
              actions.addItems(items);
              showToast(items.length === 1 ? `${items[0].name} is in the fridge.` : `${items.length} things in the fridge.`);
              onClose();
            }}
          />
        )}

        {step.name === 'manual' && (
          <ManualForm
            shared={shared}
            onDone={(item, another) => {
              actions.addItems([item]);
              showToast(`${item.name} is in the fridge.`);
              if (!another) onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

interface ReviewProps {
  kind: ScanKind;
  preview: string;
  rows: ReviewRow[];
  onRows: (rows: ReviewRow[]) => void;
  onRescan: () => void;
  onDone: (items: NewItem[]) => void;
}

function Review({ kind, preview, rows, onRows, onRescan, onDone }: ReviewProps) {
  const update = (key: string, patch: Partial<ReviewRow>) => onRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const food = rows.filter((r) => r.isFood);
  const skipped = rows.filter((r) => !r.isFood);
  const ready = rows.filter((r) => r.include && r.confirmed);
  const pending = rows.filter((r) => r.include && !r.confirmed).length;

  if (rows.length === 0) {
    return (
      <div className="scanning">
        <p className="serif scanning__line">we couldn’t find any food in that one.</p>
        <div className="btn-row">
          <button type="button" className="btn btn--primary" onClick={onRescan}>
            Try another photo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="review">
      <div className="review__head">
        <div>
          <h2 className="serif dialog__title">
            look what you <em>got.</em>
          </h2>
          <p className="meta">
            {food.length} {food.length === 1 ? 'thing' : 'things'} found. Tap anything that looks off.
          </p>
        </div>
        <img src={preview} alt="Your photo" className={`review__preview ${kind === 'receipt' ? 'is-receipt' : ''}`} />
      </div>

      <div className="review__list">
        {[...food, ...skipped].map((r, n) => (
          <div key={r.key} className={`review-row cascade ${!r.isFood ? 'is-skipped' : ''}`} style={{ '--i': n } as CSSProperties}>
            {!r.confirmed && r.include ? (
              <div className="unsure">
                <div className="unsure__top">
                  <span className="mono">Not quite sure</span>
                  {r.receiptText && <span className="mono unsure__raw">{r.receiptText}</span>}
                </div>
                <p className="serif unsure__q">
                  Is this <em>{r.name.toLowerCase()}?</em>
                </p>
                <div className="btn-row">
                  <button type="button" className="btn btn--primary btn--small" onClick={() => update(r.key, { confirmed: true })}>
                    Yes
                  </button>
                  <button type="button" className="btn btn--small" onClick={() => update(r.key, { confirmed: true, editing: true })}>
                    Edit
                  </button>
                  <button type="button" className="link-button" onClick={() => update(r.key, { include: false })}>
                    Skip it
                  </button>
                </div>
              </div>
            ) : (
              <>
                <label className="review-row__main">
                  <input type="checkbox" checked={r.include} onChange={(e) => update(r.key, { include: e.target.checked })} />
                  <ItemThumb item={r} size={40} />
                  <span className="review-row__text">
                    <span className={!r.isFood ? 'strike' : ''}>{r.name}</span>
                    <span className="mono meta">
                      {!r.isFood ? 'not food · skipped' : `${qtyText(r.quantity, r.unit)} · ${r.category.toLowerCase()} · best in ~${r.shelfLifeDays}d`}
                    </span>
                  </span>
                </label>
                {r.isFood && (
                  <button type="button" className="link-button" onClick={() => update(r.key, { editing: !r.editing })}>
                    {r.editing ? 'Done' : 'Edit'}
                  </button>
                )}
              </>
            )}
            {r.editing && r.confirmed && <RowEditor row={r} onChange={(patch) => update(r.key, patch)} />}
          </div>
        ))}
      </div>

      <div className="review__foot">
        {pending > 0 && <span className="mono meta">{pending === 1 ? '1 still needs' : `${pending} still need`} a quick look</span>}
        <button
          type="button"
          className="btn btn--primary btn--wide"
          disabled={ready.length === 0}
          onClick={() =>
            onDone(
              ready.map((r) => ({
                name: r.name,
                category: r.category,
                quantity: r.quantity,
                unit: r.unit,
                shelfLifeDays: r.shelfLifeDays,
                imageUrl: r.imageUrl,
                source: kind === 'receipt' ? 'receipt' : 'photo',
              })),
            )
          }
        >
          Add {ready.length} to Leftovers
        </button>
        <span className="mono fine-print">Dates are estimates, not food-safety advice</span>
      </div>
    </div>
  );
}

function qtyText(q: number, unit: Unit) {
  if (unit === 'percent') return `~${q}%`;
  if (unit === 'package') return q === 1 ? '1 pack' : `${q} packs`;
  return `${q}`;
}

function RowEditor({ row, onChange }: { row: ReviewRow; onChange: (patch: Partial<ReviewRow>) => void }) {
  return (
    <div className="row-editor">
      <label className="field field--grow">
        <span className="mono">Name</span>
        <FoodNameInput
          value={row.name}
          onChange={(name) => onChange({ name })}
          onPick={(s) => onChange({ name: s.name, category: s.category, unit: s.unit, shelfLifeDays: s.days })}
        />
      </label>
      <label className="field">
        <span className="mono">Amount</span>
        <input type="number" min={0} value={row.quantity} onChange={(e) => onChange({ quantity: Math.max(0, Number(e.target.value)) })} />
      </label>
      <label className="field">
        <span className="mono">As</span>
        <select value={row.unit} onChange={(e) => onChange({ unit: e.target.value as Unit })}>
          <option value="count">count</option>
          <option value="package">packs</option>
          <option value="percent">% full</option>
        </select>
      </label>
      <label className="field">
        <span className="mono">Category</span>
        <select value={row.category} onChange={(e) => onChange({ category: e.target.value as Category })}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="mono">Best in (days)</span>
        <input type="number" min={0} value={row.shelfLifeDays} onChange={(e) => onChange({ shelfLifeDays: Math.max(0, Math.round(Number(e.target.value))) })} />
      </label>
    </div>
  );
}

function ManualForm({ shared, onDone }: { shared: boolean; onDone: (item: NewItem, another: boolean) => void }) {
  const empty = { name: '', category: 'Produce' as Category, quantity: 1, unit: 'count' as Unit, days: DEFAULT_SHELF_LIFE.Produce, daysTouched: false, shared: false, photo: null as string | null };
  const [f, setF] = useState(empty);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => nameInput.current?.focus(), []);

  const submit = (another: boolean) => {
    if (!f.name.trim()) return;
    onDone(
      {
        name: f.name,
        category: f.category,
        quantity: f.quantity,
        unit: f.unit,
        shelfLifeDays: f.days,
        imageUrl: f.photo ?? undefined,
        source: 'manual',
        visibility: f.shared ? 'shared' : 'mine',
      },
      another,
    );
    if (another) {
      setF(empty);
      nameInput.current?.focus();
    }
  };

  return (
    <form
      className="manual"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
    >
      <h2 className="serif dialog__title">add by hand</h2>
      <label className="field">
        <span className="mono">What is it?</span>
        <FoodNameInput
          ref={nameInput}
          value={f.name}
          placeholder="Start typing — e.g. greek yogurt"
          required
          onChange={(name) => setF((cur) => ({ ...cur, name }))}
          onPick={(s) =>
            setF((cur) => ({ ...cur, name: s.name, category: s.category, unit: s.unit, quantity: s.quantity, days: s.days, daysTouched: false }))
          }
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="mono">Category</span>
          <select
            value={f.category}
            onChange={(e) => {
              const category = e.target.value as Category;
              setF({ ...f, category, days: f.daysTouched ? f.days : DEFAULT_SHELF_LIFE[category] });
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="mono">Best in (days, roughly)</span>
          <input type="number" min={0} value={f.days} onChange={(e) => setF({ ...f, days: Math.max(0, Math.round(Number(e.target.value))), daysTouched: true })} />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span className="mono">How much</span>
          <input type="number" min={0} value={f.quantity} onChange={(e) => setF({ ...f, quantity: Math.max(0, Number(e.target.value)) })} />
        </label>
        <label className="field">
          <span className="mono">Measured as</span>
          <select
            value={f.unit}
            onChange={(e) => {
              const unit = e.target.value as Unit;
              setF({ ...f, unit, quantity: unit === 'percent' ? 100 : f.quantity === 100 ? 1 : f.quantity });
            }}
          >
            <option value="count">Count (8 eggs)</option>
            <option value="package">Packages (1 bag)</option>
            <option value="percent">How full (%)</option>
          </select>
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span className="mono">Photo (optional)</span>
          <input
            type="file"
            accept={IMAGE_ACCEPT}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                setF((cur) => ({ ...cur, photo: null }));
                const photo = await toThumbnail(file);
                setF((cur) => ({ ...cur, photo }));
              } catch (err) {
                showToast(err instanceof Error ? err.message : 'We couldn’t open that photo.');
              }
            }}
          />
        </label>
        {shared && (
          <label className="field field--check">
            <input type="checkbox" checked={f.shared} onChange={(e) => setF({ ...f, shared: e.target.checked })} />
            <span>Shared with the household</span>
          </label>
        )}
      </div>
      <div className="btn-row btn-row--end">
        <button type="button" className="btn" disabled={!f.name.trim()} onClick={() => submit(true)}>
          Add &amp; another
        </button>
        <button type="submit" className="btn btn--primary" disabled={!f.name.trim()}>
          Add to Leftovers
        </button>
      </div>
    </form>
  );
}
