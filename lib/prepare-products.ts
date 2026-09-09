type Draft = {
  name: string;
  price: string;
  image?: string;
  section?: string;
  category?: string;
  dailyMenu?: boolean;
};

export function prepareProducts(products: Draft[]) {
  const filled = products.filter(
    product =>
      product.dailyMenu ||
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
    filled.some(
      product =>
        !product.name.trim() ||
        product.name.length > 200 ||
        !product.price.trim() ||
        !Number.isFinite(
          Number(product.price.replace(',', '.'))
        ) ||
        Number(product.price.replace(',', '.')) < 0 ||
        Number(product.price.replace(',', '.')) > 100000
    )
  ) {
    throw Error(
      'Completează denumirea și prețul produselor.'
    );
  }

  return filled.map(product => ({
    name: product.name.trim(),

    price: Math.round(
      Number(product.price.replace(',', '.')) * 100
    ),

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
  }));
}