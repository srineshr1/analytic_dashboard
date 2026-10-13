import products from './data/products.json';

export { products };

export const productById = new Map(products.map((p) => [String(p.id), p]));

/** Human label for a category slug: "womens-dresses" -> "Women's Dresses". */
export function categoryLabel(slug = '') {
  return slug
    .split('-')
    .map((w) => (w === 'womens' ? "Women's" : w === 'mens' ? "Men's" : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export const categories = [...new Set(products.map((p) => p.category))]
  .sort()
  .map((slug) => ({
    slug,
    label: categoryLabel(slug),
    count: products.filter((p) => p.category === slug).length,
  }));

export const categorySlugs = new Set(categories.map((c) => c.slug));

export const brandOf = (p) => p.brand || 'Generic';

export function originalPrice(p) {
  if (!p.discountPercentage) return null;
  return Math.round((p.price / (1 - p.discountPercentage / 100)) * 100) / 100;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const formatPrice = (n) => usd.format(n || 0);

/** Stable pseudo review count so cards look realistic (derived from id + reviews). */
export function ratingCount(p) {
  return ((p.id * 7919) % 4800) + 37 + p.reviews.length;
}

/** Case-insensitive match over title, brand, category and tags. */
export function matches(p, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [p.title, p.brand, p.category, categoryLabel(p.category), ...(p.tags || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return q.split(/\s+/).every((term) => haystack.includes(term));
}

export function searchProducts(query, category) {
  return products.filter((p) => (!category || p.category === category) && matches(p, query));
}

/** Top title matches for the live suggestion dropdown. */
export function suggest(query, category, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const pool = category ? products.filter((p) => p.category === category) : products;
  const starts = [];
  const contains = [];
  for (const p of pool) {
    const t = p.title.toLowerCase();
    if (t.startsWith(q)) starts.push(p);
    else if (t.includes(q)) contains.push(p);
  }
  return [...starts, ...contains].slice(0, limit);
}

export const deals = products
  .filter((p) => p.discountPercentage >= 15)
  .sort((a, b) => b.discountPercentage - a.discountPercentage);

export const topRated = [...products].sort((a, b) => b.rating - a.rating).slice(0, 20);

export function bestSellersIn(slug, limit = 15) {
  return products
    .filter((p) => p.category === slug)
    .sort((a, b) => ratingCount(b) * b.rating - ratingCount(a) * a.rating)
    .slice(0, limit);
}

export const SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Avg. Customer Review' },
  { value: 'discount', label: 'Biggest Discount' },
  { value: 'new', label: 'Newest Arrivals' },
];

export function sortProducts(list, sort) {
  const arr = [...list];
  switch (sort) {
    case 'price-asc':
      return arr.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return arr.sort((a, b) => b.price - a.price);
    case 'rating':
      return arr.sort((a, b) => b.rating - a.rating);
    case 'discount':
      return arr.sort((a, b) => b.discountPercentage - a.discountPercentage);
    case 'new':
      return arr.sort((a, b) => b.id - a.id);
    default:
      return arr;
  }
}

export const PRICE_RANGES = [
  { value: '0-25', label: 'Under $25', min: 0, max: 25 },
  { value: '25-50', label: '$25 to $50', min: 25, max: 50 },
  { value: '50-100', label: '$50 to $100', min: 50, max: 100 },
  { value: '100-500', label: '$100 to $500', min: 100, max: 500 },
  { value: '500-', label: '$500 & Above', min: 500, max: Infinity },
];

/** Delivery estimate label, e.g. "Thu, Oct 15". */
export function deliveryDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Fast" eligibility (our Prime-like badge): in stock and ships quickly. */
export const isFast = (p) => p.stock > 0 && !/month/i.test(p.shippingInformation || '');
