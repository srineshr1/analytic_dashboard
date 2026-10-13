// Downloads the DummyJSON product catalog once and writes a trimmed copy to
// src/data/products.json (committed, so the store works without this script).
// Usage: npm run fetch-catalog
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'products.json');
const res = await fetch('https://dummyjson.com/products?limit=0');
if (!res.ok) throw new Error(`DummyJSON responded ${res.status}`);
const { products } = await res.json();

const trimmed = products.map((p) => ({
  id: p.id,
  title: p.title,
  description: p.description,
  category: p.category,
  brand: p.brand || 'Generic',
  price: p.price,
  discountPercentage: p.discountPercentage,
  rating: p.rating,
  stock: p.stock,
  tags: p.tags,
  thumbnail: p.thumbnail,
  images: p.images,
  warrantyInformation: p.warrantyInformation,
  shippingInformation: p.shippingInformation,
  availabilityStatus: p.availabilityStatus,
  returnPolicy: p.returnPolicy,
  // Reviewer emails are dropped on purpose.
  reviews: (p.reviews || []).map((r) => ({ rating: r.rating, comment: r.comment, date: r.date, reviewerName: r.reviewerName })),
}));

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(trimmed));
console.log(`Wrote ${trimmed.length} products to ${OUT}`);
