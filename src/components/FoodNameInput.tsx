import { forwardRef, useId, useMemo, useState } from 'react';
import { selectItems, useStore } from '../lib/store';
import { suggestFoods, type FoodSuggestion } from '../lib/suggest';
import { ItemThumb } from './ItemThumb';

interface Props {
  value: string;
  onChange: (text: string) => void;
  /** Called when a suggestion is chosen, so the form can fill in category, amount and best-by. */
  onPick: (suggestion: FoodSuggestion) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

/**
 * A name field that suggests foods as you type — your own history first, then common groceries.
 * Nothing is pre-selected, so typing a new food and pressing Enter still just submits it.
 */
export const FoodNameInput = forwardRef<HTMLInputElement, Props>(function FoodNameInput(
  { value, onChange, onPick, placeholder, required, className = '' },
  ref,
) {
  const items = useStore(selectItems);
  const listId = useId();
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  // After choosing, stay closed until the text changes again.
  const [pickedText, setPickedText] = useState<string | null>(null);

  const suggestions = useMemo(() => suggestFoods(value, items), [value, items]);
  const exactOnly = suggestions.length === 1 && suggestions[0].name.toLowerCase() === value.trim().toLowerCase();
  const open = focused && pickedText !== value && suggestions.length > 0 && !exactOnly;

  const pick = (s: FoodSuggestion) => {
    onPick(s);
    setPickedText(s.name);
    setActive(-1);
  };

  return (
    <div className="combo">
      <input
        ref={ref}
        className={className}
        value={value}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          onChange(e.target.value);
          setActive(-1);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => (a + 1) % suggestions.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
          } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault();
            pick(suggestions[active]);
          } else if (e.key === 'Escape') {
            e.stopPropagation();
            setPickedText(value);
          }
        }}
      />
      {open && (
        <ul className="combo__list" id={listId} role="listbox" aria-label="Suggestions">
          {suggestions.map((s, i) => (
            <li
              key={`${s.name}-${s.fromHistory ? 'h' : 'b'}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`combo__option ${i === active ? 'is-active' : ''}`}
              // mousedown, not click: keep focus in the field so blur doesn't close the list first.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <ItemThumb item={{ name: s.name, imageUrl: null, category: s.category }} size={32} />
              <span className="combo__name">
                <Highlight text={s.name} query={value} />
              </span>
              <span className="mono combo__meta">
                {s.fromHistory ? 'you’ve had this' : s.category.toLowerCase()} · ~{s.days}d
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

/** Bold the part of the name that matches what you typed. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <strong>{text.slice(at, at + q.length)}</strong>
      {text.slice(at + q.length)}
    </>
  );
}
