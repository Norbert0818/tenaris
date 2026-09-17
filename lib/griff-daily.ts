export const DAILY_PRICE = 3500;

export const dailyGroups = [
  {
    key: 'soup',
    label: 'Ciorbă',
    options: [
      'Ciorbă de pui',
      'Ciorbă de burtă',
      'Supă cremă de ciuperci',
    ],
  },
  {
    key: 'main',
    label: 'Felul 2',
    options: [
      'Cașcaval pane',
      'Piept de pui la grătar',
      'Ceafă la grătar',
      'Aripi de pui picante',
      'Șnițel cotlet de porc',
      'Șnițel de pui',
    ],
  },
  {
    key: 'side',
    label: 'Garnitură',
    options: [
      'Cartofi piure',
      'Cartofi prăjiți',
      'Orez cu legume',
    ],
  },
  {
    key: 'salad',
    label: 'Salată',
    options: [
      'Salată de varză',
      'Salată de sfeclă roșie',
      'Salată de roșii cu castraveți',
      'Salată de murături asortate',
    ],
  },
] as const;

export type DailyChoices = Record<
  'soup' | 'main' | 'side' | 'salad',
  string
>;

export type CustomDailyChoices = {
  first: string;
  second: string;
  dessert: string;
};

export type CustomDailyPrices = {
  full: number;
  first: number;
  second: number;
};

export type CustomDailyMenuConfig = {
  fullPrice: number;
  firstPrice: number;
  secondPrice: number;
  firstOptions: string[];
  secondOptions: string[];
  dessertOptions: string[];
};

export type OrderProduct = {
  id: string;
  name: string;
  price: number;
  image?: string;
  section?: string;
  category?: string;
  dailyChoices?: DailyChoices;
  customDailyChoices?: CustomDailyChoices;
  customDailyPrices?: CustomDailyPrices;
};

function uniqueOptions(values: string[]) {
  return Array.from(
    new Set(
      values
        .map(value => value.trim())
        .filter(Boolean)
    )
  );
}

export function dailyVariants(): Omit<
  OrderProduct,
  'id'
>[] {
  const rows: Omit<OrderProduct, 'id'>[] = [];

  for (const soup of dailyGroups[0].options) {
    for (const main of dailyGroups[1].options) {
      for (const side of dailyGroups[2].options) {
        for (const salad of dailyGroups[3].options) {
          rows.push({
            name:
              `Meniul zilei Griff — ` +
              `${soup} + ${main} + ${side} + ${salad}`,
            price: DAILY_PRICE,
            dailyChoices: {
              soup,
              main,
              side,
              salad,
            },
          });
        }
      }
    }
  }

  return rows;
}

export function customDailyVariants(
  config: CustomDailyMenuConfig
): Omit<OrderProduct, 'id'>[] {
  const rows: Omit<OrderProduct, 'id'>[] = [];

  const firstOptions = uniqueOptions(
    config.firstOptions
  );

  const secondOptions = uniqueOptions(
    config.secondOptions
  );

  const dessertOptions = uniqueOptions(
    config.dessertOptions
  );

  const firstValues = ['', ...firstOptions];
  const secondValues = ['', ...secondOptions];
  const dessertValues = ['', ...dessertOptions];

  for (const first of firstValues) {
    for (const second of secondValues) {
      // Nu permitem desert fără Felul 1 sau Felul 2.
      if (!first && !second) {
        continue;
      }

      for (const dessert of dessertValues) {
        const price =
          first && second
            ? config.fullPrice
            : first
              ? config.firstPrice
              : config.secondPrice;

        const parts = [
          `Felul 1: ${first || 'Niciunul'}`,
          `Felul 2: ${second || 'Niciunul'}`,
          `Desert: ${dessert || 'Niciunul'}`,
        ];

        rows.push({
          name: `Meniul zilei — ${parts.join(' · ')}`,
          price,
          customDailyChoices: {
            first,
            second,
            dessert,
          },
          customDailyPrices: {
            full: config.fullPrice,
            first: config.firstPrice,
            second: config.secondPrice,
          },
        });
      }
    }
  }

  return rows;
}
