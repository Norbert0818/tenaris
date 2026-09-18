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

  const customDailyMenus = value.filter(
    product => !!product.customDailyMenu
  );

  const selectedIds = new Set<string>(
  value
    .filter(
      product =>
        !product.dailyMenu &&
        !product.customDailyMenu
    )
    .map(product => product.presetId)
    .filter(
      (id): id is string =>
        typeof id === 'string' && id.length > 0
    )
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
      ...customDailyMenus,

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
                  Array.from(selectedIds),
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


function DailyMenuOptionGroup({
  title,
  values,
  setValues,
  placeholder,
}: {
  title: string;
  values: string[];
  setValues: (next: string[]) => void;
  placeholder: string;
}) {
  function updateOption(
    index: number,
    nextValue: string
  ) {
    setValues(
      values.map((value, i) =>
        i === index ? nextValue : value
      )
    );
  }

  function removeOption(index: number) {
    const next = values.filter(
      (_, i) => i !== index
    );

    setValues(next.length ? next : ['']);
  }

  function addOption() {
    if (values.length >= 8) {
      return;
    }

    setValues([...values, '']);
  }

  return (
    <div className="daily-builder-group">
      <div className="daily-builder-group-heading">
        <h4>{title}</h4>

        <span className="small muted">
          Max. 8 variante
        </span>
      </div>

      {values.map((value, index) => (
        <div
          className="daily-builder-option"
          key={`${title}-${index}`}
        >
          <input
            maxLength={120}
            value={value}
            onChange={event =>
              updateOption(
                index,
                event.target.value
              )
            }
            placeholder={placeholder}
          />

          <button
            type="button"
            className="icon-button"
            aria-label={`Șterge varianta ${index + 1}`}
            onClick={() =>
              removeOption(index)
            }
          >
            ×
          </button>
        </div>
      ))}

      <button
        type="button"
        className="text-button"
        disabled={values.length >= 8}
        onClick={addOption}
      >
        + Adaugă variantă
      </button>

      <p className="small muted">
        Opțiunea „Niciunul” se adaugă automat
        pentru colegi.
      </p>
    </div>
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
  const [fullPrice, setFullPrice] = useState('');
  const [firstPrice, setFirstPrice] = useState('');
  const [secondPrice, setSecondPrice] = useState('');

  const [firstOptions, setFirstOptions] = useState([
    '',
  ]);

  const [secondOptions, setSecondOptions] = useState([
    '',
  ]);

  const [dessertOptions, setDessertOptions] = useState([
    '',
  ]);

  const [message, setMessage] = useState('');

  function clean(values: string[]) {
    return Array.from(
      new Set(
        values
          .map(value => value.trim())
          .filter(Boolean)
      )
    );
  }

  function validPrice(value: string) {
    const number = Number(value.replace(',', '.'));

    return (
      value.trim() !== '' &&
      Number.isFinite(number) &&
      number >= 0 &&
      number <= 100000
    );
  }

  function updateOption(
    values: string[],
    setValues: (next: string[]) => void,
    index: number,
    nextValue: string
  ) {
    setValues(
      values.map((value, i) =>
        i === index ? nextValue : value
      )
    );
  }

  function removeOption(
    values: string[],
    setValues: (next: string[]) => void,
    index: number
  ) {
    const next = values.filter(
      (_, i) => i !== index
    );

    setValues(next.length ? next : ['']);
  }

  function addOption(
    values: string[],
    setValues: (next: string[]) => void
  ) {
    if (values.length >= 8) {
      return;
    }

    setValues([...values, '']);
  }

  function add() {
    const first = clean(firstOptions);
    const second = clean(secondOptions);
    const desserts = clean(dessertOptions);

    if (
      !validPrice(fullPrice) ||
      !validPrice(firstPrice) ||
      !validPrice(secondPrice) ||
      !first.length ||
      !second.length
    ) {
      setMessage(
        'Completează prețurile și adaugă cel puțin o variantă pentru Felul 1 și Felul 2.'
      );
      return;
    }

    if (
      [...first, ...second, ...desserts].some(
        option => option.length > 120
      )
    ) {
      setMessage(
        'Denumirea unei variante este prea lungă.'
      );
      return;
    }

    const error = onApply(
      [
        {
          name: 'Meniul zilei',
          price: fullPrice,
          customDailyMenu: {
            fullPrice,
            firstPrice,
            secondPrice,
            firstOptions: first,
            secondOptions: second,
            dessertOptions: desserts,
          },
        },
      ],
      currency
    );

    setMessage(
      error ||
        'Meniul zilei a fost adăugat / actualizat.'
    );
  }


  return (
    <details className="menu-import daily-menu-builder">
      <summary>
        <b>Configurează Meniul zilei</b>
      </summary>

      <p className="muted">
        Colegii vor putea alege Felul 1, Felul 2 și
        Desert. La fiecare categorie apare automat și
        opțiunea „Niciunul”.
      </p>

      <div className="daily-builder-prices">
        <label>
          Preț meniu complet ({currency})

          <input
            type="number"
            min="0"
            max="100000"
            step="0.01"
            value={fullPrice}
            onChange={event =>
              setFullPrice(event.target.value)
            }
            placeholder="Ex. 35.00"
          />
        </label>

        <label>
          Preț Felul 1 ({currency})

          <input
            type="number"
            min="0"
            max="100000"
            step="0.01"
            value={firstPrice}
            onChange={event =>
              setFirstPrice(event.target.value)
            }
            placeholder="Ex. 18.00"
          />
        </label>

        <label>
          Preț Felul 2 ({currency})

          <input
            type="number"
            min="0"
            max="100000"
            step="0.01"
            value={secondPrice}
            onChange={event =>
              setSecondPrice(event.target.value)
            }
            placeholder="Ex. 24.00"
          />
        </label>
      </div>

      <div className="daily-builder-options">
        <DailyMenuOptionGroup
          title="Felul 1"
          values={firstOptions}
          setValues={setFirstOptions}
          placeholder="Ex. Ciorbă de pui"
        />

        <DailyMenuOptionGroup
          title="Felul 2"
          values={secondOptions}
          setValues={setSecondOptions}
          placeholder="Ex. Șnițel de pui cu garnitură"
        />

        <DailyMenuOptionGroup
          title="Desert"
          values={dessertOptions}
          setValues={setDessertOptions}
          placeholder="Ex. Clătite"
        />
      </div>

      <div className="daily-builder-rule">
        <strong>Cum se calculează prețul?</strong>

        <p>
          Felul 1 + Felul 2 = prețul meniului complet.
          Dacă se alege doar un singur fel, se folosește
          prețul acelui fel. Desertul nu are preț separat
          și nu modifică suma.
        </p>
      </div>

      <button
        type="button"
        className="secondary"
        onClick={add}
      >
        Adaugă / actualizează meniul zilei
      </button>

      {message && (
        <p role="status">{message}</p>
      )}
    </details>
  );
}
