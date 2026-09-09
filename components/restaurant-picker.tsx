'use client';

import { useState } from 'react';

import type {
  DraftProduct,
  RestaurantPreset,
} from '@/lib/restaurants';

export type { DraftProduct } from '@/lib/restaurants';

export function FoodPhoto({
  src,
  name,
}: {
  src?: string;
  name: string;
}) {
  const [failed, setFailed] = useState(false);

  return src && !failed ? (
    <img
      className="food-photo"
      src={src}
      alt={name}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      className="food-photo photo-placeholder"
      aria-hidden="true"
    >
      ♨
    </span>
  );
}

export function RestaurantPicker({
  restaurant,
  value,
  onChange,
}: {
  restaurant: RestaurantPreset;
  value: DraftProduct[];
  onChange: (rows: DraftProduct[]) => void;
}) {
  const [query, setQuery] = useState('');

  const selectedIds = new Set(
    value
      .filter(product => !product.dailyMenu)
      .map(product => product.presetId)
      .filter(Boolean)
  );

  const includeDaily = value.some(product => product.dailyMenu);

  function setSelection(
    ids: string[],
    daily = includeDaily
  ) {
    const idSet = new Set(ids);

    const selectedProducts = restaurant.products.filter(
      product =>
        product.presetId &&
        idSet.has(product.presetId)
    );

    onChange([
      ...selectedProducts,

      ...(restaurant.griffDaily && daily
        ? [
            {
              presetId: 'griff-daily-menu',
              name: 'Meniul zilei Griff',
              price: '35.00',
              dailyMenu: true,
            } satisfies DraftProduct,
          ]
        : []),
    ]);
  }

  function toggleProduct(
    product: DraftProduct,
    checked: boolean
  ) {
    if (!product.presetId) {
      return;
    }

    const next = new Set(selectedIds);

    if (checked) {
      next.add(product.presetId);
    } else {
      next.delete(product.presetId);
    }

    setSelection(Array.from(next));
  }

  const normalizedQuery = query
    .trim()
    .toLocaleLowerCase('ro');

  const filteredProducts = restaurant.products.filter(
    product => {
      if (!normalizedQuery) {
        return true;
      }

      return [
        product.name,
        product.section,
        product.category,
      ]
        .filter(Boolean)
        .some(value =>
          value!
            .toLocaleLowerCase('ro')
            .includes(normalizedQuery)
        );
    }
  );

  const sections = Array.from(
    new Set(
      filteredProducts.map(
        product => product.section || ''
      )
    )
  );

  const money = (value: string) =>
    new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: restaurant.currency,
    }).format(Number(value.replace(',', '.')));

  const allIds = restaurant.products
    .map(product => product.presetId)
    .filter((id): id is string => !!id);

  return (
    <section
      className="menu-import restaurant-picker"
      aria-label={restaurant.name}
    >
      <h2>{restaurant.name}</h2>

      <p className="muted">
        Bifează produsele care vor fi disponibile în
        această comandă.
      </p>

      {restaurant.menuUpdatedAt && (
        <p className="small muted">
          Meniu verificat la {restaurant.menuUpdatedAt}.
          Prețurile nu se actualizează automat.
          {restaurant.menuUrl && (
            <>
              {' '}
              <a
                href={restaurant.menuUrl}
                target="_blank"
                rel="noreferrer"
              >
                Vezi meniul restaurantului
              </a>
              .
            </>
          )}
        </p>
      )}

      {restaurant.griffDaily && (
        <div className="griff-daily-preset">
          <label>
            <input
              type="checkbox"
              checked={includeDaily}
              onChange={event =>
                setSelection(
                  Array.from(selectedIds) as string[],
                  event.target.checked
                )
              }
            />

            Include Meniul zilei Griff — 35,00 lei
          </label>

          <p>
            Colegii aleg obligatoriu ciorba, felul 2,
            garnitura și salata.
          </p>
        </div>
      )}

      <label>
        Caută în meniu

        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Caută un produs..."
        />
      </label>

      <div className="preset-actions">
        <button
          type="button"
          className="text-button"
          onClick={() =>
            setSelection(allIds, includeDaily)
          }
        >
          Selectează toate produsele
        </button>

        <button
          type="button"
          className="text-button"
          onClick={() =>
            setSelection([], includeDaily)
          }
        >
          Debifează toate
        </button>

        {restaurant.griffDaily && (
          <button
            type="button"
            className="text-button"
            onClick={() => setSelection([], true)}
          >
            Doar meniul zilei
          </button>
        )}
      </div>

      <p className="notice" role="status">
        {selectedIds.size} produse
        {includeDaily ? ' + meniul zilei' : ''} vor fi
        incluse în comanda nouă.
      </p>

      <div className="restaurant-menu">
        {sections.map(section => {
          const sectionProducts =
            filteredProducts.filter(
              product =>
                (product.section || '') === section
            );

          const categories = Array.from(
            new Set(
              sectionProducts.map(
                product => product.category || ''
              )
            )
          );

          return (
            <section
              className="restaurant-menu-section"
              key={section || 'products'}
            >
              {section && (
                <h3 className="restaurant-section-title">
                  {section}
                </h3>
              )}

              {categories.map(category => {
                const categoryProducts =
                  sectionProducts.filter(
                    product =>
                      (product.category || '') === category
                  );

                return (
                  <div
                    className="restaurant-menu-category"
                    key={
                      `${section}-${category}` ||
                      'category'
                    }
                  >
                    {category && (
                      <h4 className="restaurant-category-title">
                        {category}
                      </h4>
                    )}

                    {categoryProducts.map(product => (
                      <label
                        className="preset-row"
                        key={product.presetId}
                      >
                        <input
                          type="checkbox"
                          checked={
                            !!product.presetId &&
                            selectedIds.has(
                              product.presetId
                            )
                          }
                          onChange={event =>
                            toggleProduct(
                              product,
                              event.target.checked
                            )
                          }
                        />

                        {product.image && (
                          <FoodPhoto
                            src={product.image}
                            name={product.name}
                          />
                        )}

                        <span>{product.name}</span>

                        <b>{money(product.price)}</b>
                      </label>
                    ))}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      {!value.length && (
        <p className="menu-warning">
          Selectează cel puțin un produs.
        </p>
      )}
    </section>
  );
}

export function DailyMenu({
  currency,
  onApply,
}: {
  currency: string;
  onApply: (
    rows: DraftProduct[],
    currency: string
  ) => string | null;
}) {
  const [mode, setMode] = useState('complete');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [parts, setParts] = useState([
    { name: '', price: '' },
    { name: '', price: '' },
  ]);
  const [message, setMessage] = useState('');

  function add() {
    const rows: DraftProduct[] = [];

    if (mode !== 'separate') {
      rows.push({
        name: 'Meniul zilei — ' + name.trim(),
        price,
      });
    }

    if (mode !== 'complete') {
      rows.push(
        ...parts
          .filter(part => part.name.trim())
          .map(part => ({
            name: 'Separat — ' + part.name.trim(),
            price: part.price,
          }))
      );
    }

    if (
      (mode !== 'separate' && !name.trim()) ||
      !rows.length ||
      rows.some(
        product =>
          !product.price.trim() ||
          !Number.isFinite(Number(product.price)) ||
          Number(product.price) < 0 ||
          Number(product.price) > 100000 ||
          product.name.length > 200
      )
    ) {
      setMessage(
        'Completează denumirea și prețul fiecărei variante oferite.'
      );
      return;
    }

    const error = onApply(rows, currency);

    setMessage(
      error ||
        'Variantele au fost adăugate în listă.'
    );
  }

  return (
    <details className="menu-import">
      <summary>
        <b>Meniul zilei — complet sau pe feluri</b>
      </summary>

      <p className="muted">
        Adaugă manual variantele oferite de restaurant.
      </p>

      <label>
        Ce se poate comanda?

        <select
          value={mode}
          onChange={event => {
            setMode(event.target.value);
            setMessage('');
          }}
        >
          <option value="complete">
            Doar meniul complet
          </option>

          <option value="separate">
            Doar feluri separate
          </option>

          <option value="both">
            Meniu complet și feluri separate
          </option>
        </select>
      </label>

      {mode !== 'separate' && (
        <div className="daily-row">
          <label>
            Conținutul meniului

            <input
              maxLength={180}
              value={name}
              onChange={event =>
                setName(event.target.value)
              }
              placeholder="Ciorbă + fel principal + garnitură"
            />
          </label>

          <label>
            Preț ({currency})

            <input
              type="number"
              min="0"
              max="100000"
              step="0.01"
              value={price}
              onChange={event =>
                setPrice(event.target.value)
              }
            />
          </label>
        </div>
      )}

      {mode !== 'complete' && (
        <>
          {parts.map((part, index) => (
            <div className="daily-row" key={index}>
              <label>
                Fel separat {index + 1}

                <input
                  maxLength={180}
                  value={part.name}
                  onChange={event =>
                    setParts(
                      parts.map((value, i) =>
                        i === index
                          ? {
                              ...value,
                              name: event.target.value,
                            }
                          : value
                      )
                    )
                  }
                />
              </label>

              <label>
                Preț ({currency})

                <input
                  type="number"
                  min="0"
                  max="100000"
                  step="0.01"
                  value={part.price}
                  onChange={event =>
                    setParts(
                      parts.map((value, i) =>
                        i === index
                          ? {
                              ...value,
                              price: event.target.value,
                            }
                          : value
                      )
                    )
                  }
                />
              </label>
            </div>
          ))}

          <button
            type="button"
            className="text-button"
            disabled={parts.length >= 10}
            onClick={() =>
              setParts([
                ...parts,
                { name: '', price: '' },
              ])
            }
          >
            + Alt fel separat
          </button>
        </>
      )}

      <button
        type="button"
        className="secondary"
        onClick={add}
      >
        Adaugă variantele în listă
      </button>

      {message && <p role="status">{message}</p>}
    </details>
  );
}