import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { products, deals } from '../catalog.js';

const thumb = (slug) => products.filter((p) => p.category === slug).sort((a, b) => b.rating - a.rating)[0]?.thumbnail;

const SLIDES = [
  {
    eyebrow: "Today's Deals",
    title: `Up to ${Math.round(deals[0]?.discountPercentage || 20)}% off top brands`,
    text: 'Fresh lightning deals every day across electronics, fashion, beauty and home.',
    cta: 'Shop deals',
    to: '/deals',
    theme: 'sunset',
    images: deals.slice(0, 3).map((p) => p.thumbnail),
  },
  {
    eyebrow: 'Tech upgrade season',
    title: 'Phones, laptops & tablets you’ll love',
    text: 'Flagship performance, free fast delivery and easy 30-day returns.',
    cta: 'Explore smartphones',
    to: '/category/smartphones',
    theme: 'ocean',
    images: [thumb('smartphones'), thumb('laptops'), thumb('tablets')],
  },
  {
    eyebrow: 'New season styles',
    title: 'Dress for every moment',
    text: 'Discover dresses, bags and jewellery picked by our style editors.',
    cta: "Shop women's dresses",
    to: '/category/womens-dresses',
    theme: 'blossom',
    images: [thumb('womens-dresses'), thumb('womens-bags'), thumb('womens-jewellery')],
  },
  {
    eyebrow: 'Make it home',
    title: 'Refresh your space for less',
    text: 'Furniture, décor and kitchen essentials starting under $10.',
    cta: 'Shop home décor',
    to: '/category/home-decoration',
    theme: 'forest',
    images: [thumb('furniture'), thumb('home-decoration'), thumb('kitchen-accessories')],
  },
];

const INTERVAL = 6000;

export default function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const go = useCallback((delta) => setIndex((i) => (i + delta + SLIDES.length) % SLIDES.length), []);

  const playing = !hovered && !userPaused && !reducedMotion;
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => go(1), INTERVAL);
    return () => clearInterval(t);
  }, [playing, go, index]);

  return (
    <section
      className="hero"
      aria-roledescription="carousel"
      aria-label="Featured promotions"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHovered(false)}
    >
      <div className="hero-track" style={{ transform: `translateX(-${index * 100}%)` }} aria-live={playing ? 'off' : 'polite'}>
        {SLIDES.map((s, i) => (
          <div
            key={s.title}
            className={`hero-slide theme-${s.theme}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${SLIDES.length}: ${s.eyebrow}`}
            aria-hidden={i !== index}
            inert={i !== index ? true : undefined}
          >
            <div className="hero-copy">
              <p className="hero-eyebrow">{s.eyebrow}</p>
              <h2 className="hero-title">{s.title}</h2>
              <p className="hero-text">{s.text}</p>
              <Link to={s.to} className="btn btn-yellow btn-lg" data-track="hero-cta">
                {s.cta}
              </Link>
            </div>
            <div className="hero-images" aria-hidden="true">
              {s.images.filter(Boolean).map((src, j) => (
                <img key={src} src={src} alt="" className={`hero-img hero-img-${j}`} loading={i === 0 ? 'eager' : 'lazy'} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="hero-arrow prev" onClick={() => go(-1)} aria-label="Previous slide" data-track="hero-prev">
        <ChevronLeft size={40} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <button type="button" className="hero-arrow next" onClick={() => go(1)} aria-label="Next slide" data-track="hero-next">
        <ChevronRight size={40} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <div className="hero-controls">
        {!reducedMotion && (
          <button
            type="button"
            className="hero-pause"
            onClick={() => setUserPaused((p) => !p)}
            aria-label={userPaused ? 'Play carousel' : 'Pause carousel'}
            data-track="hero-pause"
          >
            {userPaused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
          </button>
        )}
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            className={`hero-dot${i === index ? ' active' : ''}`}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => setIndex(i)}
            data-track="hero-dot"
          />
        ))}
      </div>
    </section>
  );
}
