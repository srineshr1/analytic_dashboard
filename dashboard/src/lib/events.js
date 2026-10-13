import {
  CreditCard,
  Eye,
  Flame,
  Hourglass,
  MousePointerClick,
  MoveDown,
  Package,
  Search,
  ShoppingBag,
  ShoppingCart,
  CircleMinus,
} from 'lucide-react';
import { fmtCurrency, fmtDuration, fmtNum, plural } from './format.js';

/** Icon + accent colour per event type. Colours are tuned for the dark theme. */
export const EVENT_META = {
  page_view: { label: 'Page view', icon: Eye, color: '#818cf8' },
  click: { label: 'Click', icon: MousePointerClick, color: '#38bdf8' },
  rage_click: { label: 'Rage click', icon: Flame, color: '#f87171' },
  scroll_depth: { label: 'Scroll', icon: MoveDown, color: '#94a3b8' },
  time_on_page: { label: 'Time on page', icon: Hourglass, color: '#94a3b8' },
  product_view: { label: 'Product view', icon: Package, color: '#c084fc' },
  search: { label: 'Search', icon: Search, color: '#fbbf24' },
  add_to_cart: { label: 'Add to cart', icon: ShoppingCart, color: '#34d399' },
  remove_from_cart: { label: 'Remove from cart', icon: CircleMinus, color: '#fb923c' },
  begin_checkout: { label: 'Checkout', icon: CreditCard, color: '#2dd4bf' },
  purchase: { label: 'Purchase', icon: ShoppingBag, color: '#4ade80' },
};

export const metaFor = (type) => EVENT_META[type] || { label: type, icon: Eye, color: '#94a3b8' };

const page = (e) => e.page_group || '';
const productName = (p) => p.product_name || (p.product_id ? `product #${p.product_id}` : 'a product');

/** Human-readable one-liner for an event. */
export function describeEvent(e) {
  const p = e.props || {};
  const label = e.target_label || e.target || 'an element';
  switch (e.event_type) {
    case 'page_view':
      return `Viewed ${page(e)}`;
    case 'click':
      return `Clicked ${label} on ${page(e)}`;
    case 'rage_click':
      return `Rage-clicked ${label}${p.count ? ` (${p.count}×)` : ''} on ${page(e)}`;
    case 'scroll_depth':
      return `Scrolled ${fmtNum(p.depth)}% of ${page(e)}`;
    case 'time_on_page':
      return `Spent ${fmtDuration(p.duration_ms)} on ${page(e)}`;
    case 'product_view':
      return `Viewed ${productName(p)}${p.price != null ? ` (${fmtCurrency(p.price)})` : ''}`;
    case 'search':
      return `Searched “${p.query ?? ''}”${p.results != null ? ` · ${plural(p.results, 'result')}` : ''}`;
    case 'add_to_cart': {
      const qty = p.quantity > 1 ? `${p.quantity} × ` : '';
      const price = p.price != null ? ` (${fmtCurrency(p.price * (p.quantity || 1))})` : '';
      return `Added ${qty}${productName(p)} to cart${price}`;
    }
    case 'remove_from_cart':
      return `Removed ${productName(p)} from cart`;
    case 'begin_checkout': {
      const parts = ['Started checkout'];
      if (p.items_count != null) parts.push(plural(p.items_count, 'item'));
      if (p.value != null) parts.push(fmtCurrency(p.value));
      return parts.join(' · ');
    }
    case 'purchase': {
      const n = p.items_count ?? p.items?.reduce((s, i) => s + (i.quantity || 1), 0);
      return `Purchased ${n != null ? plural(n, 'item') : 'order'} · ${fmtCurrency(p.value)}`;
    }
    default:
      return `${metaFor(e.event_type).label} on ${page(e)}`;
  }
}
