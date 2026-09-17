// components/daily-menu-picker.tsx
'use client';

import { useState } from 'react';

import {
  dailyGroups,
  type CustomDailyChoices,
  type DailyChoices,
  type OrderProduct,
} from '@/lib/griff-daily';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const NONE = '__none__';

type Props = {
  products: OrderProduct[];
  qty: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  disabled?: boolean;
  currency?: string;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency,
  }).format(value / 100);
}

function GriffDailyPicker({
  variants,
  qty,
  onChange,
  disabled,
  currency,
}: {
  variants: OrderProduct[];
  qty: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  disabled: boolean;
  currency: string;
}) {
  const [choices, setChoices] =
    useState<Partial<DailyChoices>>({});

  const [amount, setAmount] = useState('1');
  const [error, setError] = useState('');

  const chosen = variants.filter(
    product => qty[product.id] > 0
  );

  function add() {
    const match = variants.find(product =>
      dailyGroups.every(
        group =>
          product.dailyChoices![group.key] ===
          choices[group.key]
      )
    );

    if (!match) {
      setError(
        'Alege câte un preparat din toate cele 4 categorii.'
      );
      return;
    }

    const number = Number(amount);

    if (
      !Number.isInteger(number) ||
      number < 1 ||
      number + (qty[match.id] || 0) > 999
    ) {
      setError(
        'Cantitatea trebuie să fie între 1 și 999 pentru fiecare combinație.'
      );
      return;
    }

    onChange({
      ...qty,
      [match.id]:
        (qty[match.id] || 0) + number,
    });

    setError('');
    setChoices({});
    setAmount('1');
  }

  return (
    <section
      className="daily-picker"
      aria-label="Meniul zilei Griff"
    >
      <div className="section-heading">
        <h2>Meniul zilei Griff</h2>

        <strong>
          {money(variants[0]?.price || 0, currency)}
          {' / meniu'}
        </strong>
      </div>

      <p>
        Alege câte un preparat din fiecare categorie.
        Cele 4 alegeri formează un singur meniu.
      </p>

      <div className="daily-choices">
        {dailyGroups.map(group => (
          <label key={group.key}>
            {group.label}{' '}
            <span className="required-label">
              Obligatoriu
            </span>

            <Select
              value={choices[group.key] || ''}
              disabled={disabled}
              onValueChange={value =>
                setChoices({
                  ...choices,
                  [group.key]: value,
                })
              }
            >
              <SelectTrigger
                aria-label={`${group.label} — obligatoriu`}
              >
                <SelectValue placeholder="Alege un preparat" />
              </SelectTrigger>

              <SelectContent>
                {Array.from(
                  new Set(
                    variants.map(
                      product =>
                        product.dailyChoices![
                          group.key
                        ]
                    )
                  )
                ).map(value => (
                  <SelectItem
                    key={value}
                    value={value}
                  >
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ))}
      </div>

      <div className="daily-add">
        <label>
          Număr de meniuri

          <input
            type="number"
            min="1"
            max="999"
            step="1"
            value={amount}
            disabled={disabled}
            onChange={event =>
              setAmount(event.target.value)
            }
          />
        </label>

        <button
          type="button"
          className="secondary"
          disabled={disabled}
          onClick={add}
        >
          Adaugă meniul în comandă
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {chosen.length > 0 && (
        <div
          className="daily-selected"
          aria-live="polite"
        >
          <h3>Meniuri alese</h3>

          {chosen.map(product => (
            <div
              className="daily-selection"
              key={product.id}
            >
              <p>
                {dailyGroups
                  .map(
                    group =>
                      product.dailyChoices![
                        group.key
                      ]
                  )
                  .join(' · ')}
              </p>

              <label>
                Cantitate

                <input
                  type="number"
                  min="1"
                  max="999"
                  step="1"
                  disabled={disabled}
                  value={qty[product.id]}
                  onChange={event => {
                    const number = Number(
                      event.target.value
                    );

                    if (
                      Number.isInteger(number) &&
                      number >= 1 &&
                      number <= 999
                    ) {
                      onChange({
                        ...qty,
                        [product.id]: number,
                      });
                    }
                  }}
                />
              </label>

              <strong>
                {money(
                  product.price *
                    qty[product.id],
                  currency
                )}
              </strong>

              <button
                type="button"
                className="text-button"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...qty,
                    [product.id]: 0,
                  })
                }
              >
                Elimină meniul
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CustomDailyPicker({
  variants,
  qty,
  onChange,
  disabled,
  currency,
}: {
  variants: OrderProduct[];
  qty: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  disabled: boolean;
  currency: string;
}) {
  const [choices, setChoices] =
    useState<CustomDailyChoices>({
      first: '',
      second: '',
      dessert: '',
    });

  const [amount, setAmount] = useState('1');
  const [error, setError] = useState('');

  const chosen = variants.filter(
    product => qty[product.id] > 0
  );

  const firstOptions = Array.from(
    new Set(
      variants
        .map(
          product =>
            product.customDailyChoices?.first || ''
        )
        .filter(Boolean)
    )
  );

  const secondOptions = Array.from(
    new Set(
      variants
        .map(
          product =>
            product.customDailyChoices?.second || ''
        )
        .filter(Boolean)
    )
  );

  const dessertOptions = Array.from(
    new Set(
      variants
        .map(
          product =>
            product.customDailyChoices?.dessert || ''
        )
        .filter(Boolean)
    )
  );

  const prices =
    variants[0]?.customDailyPrices;

  const match = variants.find(
    product =>
      product.customDailyChoices?.first ===
        choices.first &&
      product.customDailyChoices?.second ===
        choices.second &&
      product.customDailyChoices?.dessert ===
        choices.dessert
  );

  function setChoice(
    key: keyof CustomDailyChoices,
    value: string
  ) {
    setChoices({
      ...choices,
      [key]: value === NONE ? '' : value,
    });

    setError('');
  }

  function add() {
    if (!choices.first && !choices.second) {
      setError(
        'Alege Felul 1 sau Felul 2. Desertul nu poate fi comandat singur.'
      );
      return;
    }

    if (!match) {
      setError(
        'Combinația selectată nu este disponibilă.'
      );
      return;
    }

    const number = Number(amount);

    if (
      !Number.isInteger(number) ||
      number < 1 ||
      number + (qty[match.id] || 0) > 999
    ) {
      setError(
        'Cantitatea trebuie să fie între 1 și 999.'
      );
      return;
    }

    onChange({
      ...qty,
      [match.id]:
        (qty[match.id] || 0) + number,
    });

    setChoices({
      first: '',
      second: '',
      dessert: '',
    });

    setAmount('1');
    setError('');
  }

  function renderSelect(
    label: string,
    key: keyof CustomDailyChoices,
    options: string[]
  ) {
    return (
      <label>
        {label}

        <Select
          value={choices[key] || NONE}
          disabled={disabled}
          onValueChange={value =>
            setChoice(key, value)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value={NONE}>
              Niciunul
            </SelectItem>

            {options.map(option => (
              <SelectItem
                key={option}
                value={option}
              >
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    );
  }

  return (
    <section
      className="daily-picker custom-daily-picker"
      aria-label="Meniul zilei"
    >
      <div className="section-heading">
        <div>
          <h2>Meniul zilei</h2>

          <p className="small muted">
            Alege ce dorești din fiecare categorie.
          </p>
        </div>

        {prices && (
          <div className="custom-daily-prices">
            <span>
              Meniu complet:{' '}
              <b>
                {money(prices.full, currency)}
              </b>
            </span>

            <span>
              Felul 1:{' '}
              <b>
                {money(prices.first, currency)}
              </b>
            </span>

            <span>
              Felul 2:{' '}
              <b>
                {money(prices.second, currency)}
              </b>
            </span>
          </div>
        )}
      </div>

      <div className="daily-choices custom-daily-choices">
        {renderSelect(
          'Felul 1',
          'first',
          firstOptions
        )}

        {renderSelect(
          'Felul 2',
          'second',
          secondOptions
        )}

        {renderSelect(
          'Desert',
          'dessert',
          dessertOptions
        )}
      </div>

      <div className="custom-daily-current-price">
        <span>Preț selecție</span>

        <strong>
          {match
            ? money(match.price, currency)
            : '—'}
        </strong>
      </div>

      <div className="daily-add">
        <label>
          Număr de meniuri

          <input
            type="number"
            min="1"
            max="999"
            step="1"
            value={amount}
            disabled={disabled}
            onChange={event =>
              setAmount(event.target.value)
            }
          />
        </label>

        <button
          type="button"
          className="secondary"
          disabled={disabled}
          onClick={add}
        >
          Adaugă în comandă
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {chosen.length > 0 && (
        <div
          className="daily-selected"
          aria-live="polite"
        >
          <h3>Meniuri alese</h3>

          {chosen.map(product => {
            const selected =
              product.customDailyChoices!;

            return (
              <div
                className="daily-selection"
                key={product.id}
              >
                <p>
                  <b>Felul 1:</b>{' '}
                  {selected.first ||
                    'Niciunul'}
                  <br />

                  <b>Felul 2:</b>{' '}
                  {selected.second ||
                    'Niciunul'}
                  <br />

                  <b>Desert:</b>{' '}
                  {selected.dessert ||
                    'Niciunul'}
                </p>

                <label>
                  Cantitate

                  <input
                    type="number"
                    min="1"
                    max="999"
                    step="1"
                    disabled={disabled}
                    value={qty[product.id]}
                    onChange={event => {
                      const number = Number(
                        event.target.value
                      );

                      if (
                        Number.isInteger(number) &&
                        number >= 1 &&
                        number <= 999
                      ) {
                        onChange({
                          ...qty,
                          [product.id]: number,
                        });
                      }
                    }}
                  />
                </label>

                <strong>
                  {money(
                    product.price *
                      qty[product.id],
                    currency
                  )}
                </strong>

                <button
                  type="button"
                  className="text-button"
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      ...qty,
                      [product.id]: 0,
                    })
                  }
                >
                  Elimină
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="small muted">
        Dacă alegi Felul 1 + Felul 2, se aplică
        prețul meniului complet. Desertul nu are
        preț separat.
      </p>
    </section>
  );
}

export function DailyMenuPicker({
  products,
  qty,
  onChange,
  disabled = false,
  currency = 'RON',
}: Props) {
  const griffVariants = products.filter(
    product => !!product.dailyChoices
  );

  const customVariants = products.filter(
    product => !!product.customDailyChoices
  );

  if (
    !griffVariants.length &&
    !customVariants.length
  ) {
    return null;
  }

  return (
    <>
      {griffVariants.length > 0 && (
        <GriffDailyPicker
          variants={griffVariants}
          qty={qty}
          onChange={onChange}
          disabled={disabled}
          currency={currency}
        />
      )}

      {customVariants.length > 0 && (
        <CustomDailyPicker
          variants={customVariants}
          qty={qty}
          onChange={onChange}
          disabled={disabled}
          currency={currency}
        />
      )}
    </>
  );
}
