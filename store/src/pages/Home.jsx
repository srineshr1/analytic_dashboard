import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import HeroCarousel from '../components/HeroCarousel.jsx';
import { ProductRow, Price } from '../components/Product.jsx';
import { products, deals, topRated, bestSellersIn, categoryLabel, productById, originalPrice, formatPrice } from '../catalog.js';
import { useCart } from '../CartContext.jsx';
import { recentlyViewed } from '../recent.js';
import { usePageTitle } from '../usePageTitle.js';

const best = (slug) => products.filter((p) => p.category === slug).sort((a, b) => b.rating - a.rating)[0];

const GROUPS = [
  { title: 'Top picks in electronics', slugs: ['smartphones', 'laptops', 'tablets', 'mobile-accessories'], more: '/category/smartphones' },
  { title: 'Refresh your space', slugs: ['furniture', 'home-decoration', 'kitchen-accessories', 'groceries'], more: '/category/home-decoration' },
  { title: "Women's fashion", slugs: ['womens-dresses', 'womens-bags', 'womens-shoes', 'womens-jewellery'], more: '/category/womens-dresses' },
  { title: "Men's essentials", slugs: ['mens-shirts', 'mens-shoes', 'mens-watches', 'sunglasses'], more: '/category/mens-shirts' },
  { title: 'Beauty & personal care', slugs: ['beauty', 'skin-care', 'fragrances', 'womens-watches'], more: '/category/beauty' },
  { title: 'On the move', slugs: ['sports-accessories', 'motorcycle', 'vehicle', 'tops'], more: '/category/sports-accessories' },
];

function QuadCard({ group }) {
  return (
    <section className="card-panel quad-card" aria-label={group.title}>
      <h2>{group.title}</h2>
      <ul className="quad-grid">
        {group.slugs.map((slug) => {
          const p = best(slug);
          return (
            <li key={slug}>
              <Link to={`/category/${slug}`} className="quad-tile" data-track="category-tile">
                <span className="quad-img">
                  <img src={p?.thumbnail} alt="" loading="lazy" decoding="async" />
                </span>
                <span className="quad-label">{categoryLabel(slug)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link to={group.more} className="link" data-track="category-see-more">
        See more
      </Link>
    </section>
  );
}

function DealOfDay() {
  const p = deals[0];
  if (!p) return null;
  return (
    <section className="card-panel single-card" aria-label="Deal of the day">
      <h2>Deal of the day</h2>
      <Link to={`/product/${p.id}`} className="single-card-link" data-track="deal-card">
        <span className="single-img">
          <img src={p.thumbnail} alt="" loading="lazy" />
        </span>
        <span className="deal-badges">
          <span className="deal-pill">Up to {Math.round(p.discountPercentage)}% off</span>
          <span className="deal-label">Limited time deal</span>
        </span>
        <span className="single-title">{p.title}</span>
        <span className="single-price">
          <Price value={p.price} size="sm" /> <s>{formatPrice(originalPrice(p))}</s>
        </span>
      </Link>
      <Link to="/deals" className="link" data-track="category-see-more">
        See all deals
      </Link>
    </section>
  );
}

function SignInCard() {
  return (
    <section className="card-panel signin-card" aria-label="Welcome">
      <h2>Welcome to ShopVerse</h2>
      <Link to="/deals" className="btn btn-yellow btn-block" data-track="welcome-deals">
        Shop today&apos;s deals
      </Link>
      <p className="muted small">No account needed: your cart is saved on this device.</p>
      <Link to="/deals" className="signin-promo" data-track="category-tile">
        <img src={best('fragrances')?.thumbnail} alt="" loading="lazy" />
        <span>Fragrance deals from {formatPrice(Math.min(...products.filter((x) => x.category === 'fragrances').map((x) => x.price)))}</span>
      </Link>
    </section>
  );
}

export default function Home() {
  const { lines, savedProducts } = useCart();
  usePageTitle('');

  const recommended = useMemo(() => {
    const seen = recentlyViewed().map((id) => productById.get(id)).filter(Boolean);
    const anchors = [...seen, ...lines.map((l) => l.product), ...savedProducts];
    const excluded = new Set(anchors.map((p) => p.id));
    const cats = [...new Set(anchors.map((p) => p.category))];
    let picks = products.filter((p) => cats.includes(p.category) && !excluded.has(p.id));
    if (picks.length < 10) {
      // Not much history yet: pad with a deterministic, varied mix of well-rated items.
      picks = picks.concat(products.filter((p, i) => i % 9 === 4 && p.rating >= 4 && !excluded.has(p.id)));
    }
    return picks.sort((a, b) => b.rating - a.rating).slice(0, 18);
  }, [lines, savedProducts]);

  const recent = useMemo(() => recentlyViewed().map((id) => productById.get(id)).filter(Boolean), []);

  return (
    <div className="home">
      <HeroCarousel />
      <div className="home-grid">
        {GROUPS.slice(0, 3).map((g) => (
          <QuadCard key={g.title} group={g} />
        ))}
        <SignInCard />
        {GROUPS.slice(3).map((g) => (
          <QuadCard key={g.title} group={g} />
        ))}
        <DealOfDay />
      </div>
      <div className="home-rows">
        <ProductRow title="Today's deals" products={deals.slice(0, 20)} link="/deals" linkLabel="See all deals" trackName="deal-card" />
        <ProductRow title="Best sellers in Beauty" products={bestSellersIn('beauty')} link="/category/beauty" />
        <ProductRow title="Top rated" products={topRated} link="/search?sort=rating" />
        <ProductRow title="Best sellers in Smartphones" products={bestSellersIn('smartphones')} link="/category/smartphones" />
        <ProductRow title="Recommended for you" products={recommended} />
        {recent.length > 0 && <ProductRow title="Your browsing history" products={recent} />}
      </div>
    </div>
  );
}
