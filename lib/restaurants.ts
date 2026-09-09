import griffMenu from '@/lib/griff-menu.json';
import placintaFastFoodMenu from '@/lib/restaurant-menus/placinta-fastfood.json';

export type DraftProduct = {
  presetId?: string;
  name: string;
  price: string;
  image?: string;
  section?: string;
  category?: string;
  dailyMenu?: boolean;
};

type RawMenuProduct = {
  id?: string;
  name: string;
  price: string;
  image?: string;
  section?: string;
  category?: string;
};

export type RestaurantPreset = {
  id: string;
  name: string;
  currency: 'RON' | 'EUR' | 'HUF';
  menuUpdatedAt?: string;
  menuUrl?: string;
  products: DraftProduct[];
  griffDaily?: boolean;
};

function normalizeMenu(
  restaurantId: string,
  rows: RawMenuProduct[]
): DraftProduct[] {
  return rows.map((row, index) => {
    const { id, ...product } = row;

    return {
      ...product,
      presetId: id || `${restaurantId}-${index + 1}`,
    };
  });
}

export const restaurants: RestaurantPreset[] = [
  {
    id: 'griff',
    name: 'Restaurant Griff',
    currency: 'RON',
    menuUpdatedAt: '09.09.2026',
    menuUrl: 'https://griff.restaurant/menu',
    products: normalizeMenu(
      'griff',
      griffMenu as RawMenuProduct[]
    ),
    griffDaily: true,
  },

  {
    id: 'placinta-fastfood',
    name: 'Plăcintă în ulci',
    currency: 'RON',
    menuUpdatedAt: '09.09.2026',
    products: normalizeMenu(
      'placinta-fastfood',
      placintaFastFoodMenu as RawMenuProduct[]
    ),
  },
];

export function getRestaurant(id: string) {
  return restaurants.find(restaurant => restaurant.id === id);
}

export function initialRestaurantProducts(
  restaurant: RestaurantPreset
): DraftProduct[] {
  const fixedProducts = restaurant.products.map(product => ({
    ...product,
  }));

  if (!restaurant.griffDaily) {
    return fixedProducts;
  }

  return [
    ...fixedProducts,
    {
      presetId: 'griff-daily-menu',
      name: 'Meniul zilei Griff',
      price: '35.00',
      dailyMenu: true,
    },
  ];
}