import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCountUp } from '../lib/motion';
import { Fridge } from '../components/Fridge';
import { ItemThumb } from '../components/ItemThumb';
import { freshnessLabel, todayLine } from '../lib/dates';
import { heroPhotoFor, photoFor, quantityLabel } from '../lib/food';
import { activeItems, eatSoon, selectItems, selectSettings, useStore } from '../lib/store';

export function Home({ onAdd }: { onAdd: () => void }) {
  const items = useStore(selectItems);
  const settings = useStore(selectSettings);
  const navigate = useNavigate();
  const active = activeItems(items);
  const soon = eatSoon(items);
  const open = (id: string) => navigate(`/fridge?item=${id}`);
  const count = useCountUp(active.length);

  // Newest first; the most photogenic thing leads the grid.
  const grid = [...active].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const featured = grid.find((i) => photoFor(i));
  const rest = grid.filter((i) => i !== featured).slice(0, 8);

  return (
    <div className="home">
      <aside className="home__side">
        <div className="home__door">
          <Fridge settings={settings} eatSoon={soon} onToggleDoor={() => navigate('/fridge?open=1')} onEatSoonClick={open} />
          <Link to="/fridge/customize" className="mono home__customize">
            Customize door
          </Link>
        </div>
      </aside>

      <section className="home__content">
        <div className="headline">
          <h1 className="serif headline__title">
            {active.length === 0 ? (
              <>
                nothing in <em>here</em> yet.
              </>
            ) : (
              <>
                {settings.name ? `${settings.name.toLowerCase()}, ` : ''}you’ve got <em className="count">{count}</em> {active.length === 1 ? 'thing' : 'things'}.
              </>
            )}
          </h1>
          <span className="mono meta">{todayLine()}</span>
        </div>

        {active.length === 0 ? (
          <div className="empty">
            <p className="meta">Snap a receipt after your next shop and Leftovers will remember the rest.</p>
            <button type="button" className="btn btn--primary" onClick={onAdd}>
              Add your first groceries
            </button>
          </div>
        ) : (
          <div className="home__grid">
            <div className="home__soon">
              <div className="section-head">
                <h2 className="serif">eat soon</h2>
                <span className="mono meta">{soon.length === 0 ? 'nothing pressing' : `${soon.length} ${soon.length === 1 ? 'thing' : 'things'}`}</span>
              </div>
              {soon.length === 0 && <p className="meta soft-note">Everything’s got a few days left. Enjoy.</p>}
              {soon.map((i, n) => (
                <button key={i.id} type="button" className="list-row cascade" style={{ '--i': n } as CSSProperties} onClick={() => open(i.id)}>
                  <ItemThumb item={i} size={56} />
                  <span className="list-row__text">
                    <span>{i.name}</span>
                    <span className="mono meta">
                      {quantityLabel(i.quantity, i.unit)} · {i.category.toLowerCase()}
                    </span>
                  </span>
                  <span className={`mono ${freshnessLabel(i.estimatedExpiration) === 'today' ? 'is-soon' : 'meta'}`}>{freshnessLabel(i.estimatedExpiration)}</span>
                </button>
              ))}
            </div>

            <div className="home__all">
              <div className="section-head">
                <h2 className="serif">everything</h2>
                <Link to="/fridge" className="mono meta">
                  Open the fridge →
                </Link>
              </div>
              <div className="editorial">
                {featured && (
                  <button type="button" className="editorial__feature cascade" onClick={() => open(featured.id)}>
                    <ItemThumb item={featured} src={heroPhotoFor(featured)} className="editorial__img" />
                    <span className="editorial__caption">
                      <span className="serif">{featured.name}</span>
                      <span className="mono meta">{quantityLabel(featured.quantity, featured.unit)}</span>
                    </span>
                  </button>
                )}
                {rest.map((i, n) => (
                  <button key={i.id} type="button" className="editorial__tile cascade" style={{ '--i': n + 1 } as CSSProperties} onClick={() => open(i.id)}>
                    <ItemThumb item={i} className="editorial__img" />
                    <span className="editorial__label">
                      <span>{i.name}</span>
                      <span className="mono meta">{freshnessLabel(i.estimatedExpiration)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
