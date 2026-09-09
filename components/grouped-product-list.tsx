'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { FoodPhoto } from '@/components/restaurant-picker';
import type { OrderProduct } from '@/lib/griff-daily';

export function GroupedProductList({
  products,
  qty,
  onChange,
  disabled,
  money,
}: {
  products: OrderProduct[];
  qty: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  disabled: boolean;
  money: (value: number) => string;
}) {
  const fixedProducts = products.filter(
    product => !product.dailyChoices
  );

  function renderProduct(product: OrderProduct, index: number) {
    return (
      <div
        key={product.id}
        className={
          'product-row ' +
          (qty[product.id] ? 'selected' : '')
        }
      >
        <Checkbox
          id={product.id}
          className="product-checkbox"
          disabled={disabled}
          checked={!!qty[product.id]}
          onCheckedChange={value =>
            onChange({
              ...qty,
              [product.id]: value ? 1 : 0,
            })
          }
        />

        {product.image ? (
          <FoodPhoto
            src={product.image}
            name={product.name}
          />
        ) : (
          <span className="product-number">
            {String(index + 1).padStart(2, '0')}
          </span>
        )}

        <label htmlFor={product.id}>
          <b>{product.name}</b>
          <span>{money(product.price)} / buc.</span>
        </label>

        <div className="quantity">
          <input
            aria-label={`${product.name} cantitate`}
            type="number"
            min="1"
            max="999"
            step="1"
            disabled={
              !qty[product.id] || disabled
            }
            value={qty[product.id] || ''}
            placeholder="–"
            onChange={event => {
              const value = Number(event.target.value);

              onChange({
                ...qty,
                [product.id]: Math.max(
                  1,
                  Math.min(999, value)
                ),
              });
            }}
          />

          <span>buc.</span>
        </div>
      </div>
    );
  }

  const hasCategories = fixedProducts.some(
    product => product.section || product.category
  );

  if (!hasCategories) {
    return (
      <>
        {fixedProducts.map((product, index) =>
          renderProduct(product, index)
        )}
      </>
    );
  }

  const indexById = new Map(
    fixedProducts.map((product, index) => [
      product.id,
      index,
    ])
  );

  const sections = Array.from(
    new Set(
      fixedProducts.map(
        product => product.section || 'Produse'
      )
    )
  );

  return (
    <div className="order-menu-groups">
      {sections.map(section => {
        const sectionProducts = fixedProducts.filter(
          product =>
            (product.section || 'Produse') === section
        );

        const categories = Array.from(
          new Set(
            sectionProducts.map(
              product =>
                product.category || 'Alte produse'
            )
          )
        );

        return (
          <section
            className="order-menu-section"
            key={section}
          >
            <h3>{section}</h3>

            {categories.map(category => {
              const categoryProducts =
                sectionProducts.filter(
                  product =>
                    (product.category ||
                      'Alte produse') === category
                );

              return (
                <div
                  className="order-menu-category"
                  key={`${section}-${category}`}
                >
                  <h4>{category}</h4>

                  {categoryProducts.map(product =>
                    renderProduct(
                      product,
                      indexById.get(product.id) || 0
                    )
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}