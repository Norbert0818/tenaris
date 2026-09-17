type DraftCustomDailyMenu = {
  fullPrice: string;
  firstPrice: string;
  secondPrice: string;
  firstOptions: string[];
  secondOptions: string[];
  dessertOptions: string[];
};

type Draft = {
  name: string;
  price: string;
  image?: string;
  section?: string;
  category?: string;
  dailyMenu?: boolean;
  customDailyMenu?: DraftCustomDailyMenu;
};

function toCents(value: string) {
  return Math.round(
    Number(value.replace(',', '.')) * 100
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

function cleanOptions(values: string[]) {
  return Array.from(
    new Set(
      values
        .map(value => value.trim())
        .filter(Boolean)
    )
  );
}

export function prepareProducts(products: Draft[]) {
  const filled = products.filter(
    product =>
      product.dailyMenu ||
      product.customDailyMenu ||
      product.name.trim() ||
      product.price.trim()
  );

  if (!filled.length) {
    throw Error(
      'Alege un meniu sau introdu cel puțin un produs.'
    );
  }

  if (filled.length > 100) {
    throw Error(
      'Lista poate avea maximum 100 de produse.'
    );
  }

  if (
    filled.some(product => {
      if (
        !product.name.trim() ||
        product.name.length > 200 ||
        !validPrice(product.price)
      ) {
        return true;
      }

      if (!product.customDailyMenu) {
        return false;
      }

      const menu = product.customDailyMenu;

      const firstOptions = cleanOptions(
        menu.firstOptions
      );

      const secondOptions = cleanOptions(
        menu.secondOptions
      );

      const dessertOptions = cleanOptions(
        menu.dessertOptions
      );

      return (
        !validPrice(menu.fullPrice) ||
        !validPrice(menu.firstPrice) ||
        !validPrice(menu.secondPrice) ||
        firstOptions.length < 1 ||
        secondOptions.length < 1 ||
        firstOptions.length > 8 ||
        secondOptions.length > 8 ||
        dessertOptions.length > 8 ||
        [...firstOptions, ...secondOptions, ...dessertOptions]
          .some(option => option.length > 120)
      );
    })
  ) {
    throw Error(
      'Verifică produsele și configurația meniului zilei.'
    );
  }

  return filled.map(product => {
    const customDailyMenu =
      product.customDailyMenu
        ? {
            fullPrice: toCents(
              product.customDailyMenu.fullPrice
            ),
            firstPrice: toCents(
              product.customDailyMenu.firstPrice
            ),
            secondPrice: toCents(
              product.customDailyMenu.secondPrice
            ),
            firstOptions: cleanOptions(
              product.customDailyMenu.firstOptions
            ),
            secondOptions: cleanOptions(
              product.customDailyMenu.secondOptions
            ),
            dessertOptions: cleanOptions(
              product.customDailyMenu.dessertOptions
            ),
          }
        : undefined;

    return {
      name: product.name.trim(),
      price: toCents(product.price),

      ...(product.image
        ? { image: product.image }
        : {}),

      ...(product.section
        ? { section: product.section.trim() }
        : {}),

      ...(product.category
        ? { category: product.category.trim() }
        : {}),

      ...(product.dailyMenu
        ? { dailyMenu: true }
        : {}),

      ...(customDailyMenu
        ? { customDailyMenu }
        : {}),
    };
  });
}
