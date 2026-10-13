import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { productById } from './catalog.js';
import { track, productProps } from './analytics.js';

const STORAGE_KEY = 'sv_cart';
const MAX_QTY = 30;
const CartContext = createContext(null);

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const items = Array.isArray(raw?.items) ? raw.items : [];
    const saved = Array.isArray(raw?.saved) ? raw.saved : [];
    return {
      items: items
        .filter((i) => productById.has(String(i.id)))
        .map((i) => ({ id: String(i.id), qty: Math.min(MAX_QTY, Math.max(1, Number(i.qty) || 1)) })),
      saved: saved.map(String).filter((id) => productById.has(id)),
    };
  } catch {
    return { items: [], saved: [] };
  }
}

export function CartProvider({ children }) {
  const [state, setState] = useState(load);
  // Mirror of state so actions can compute analytics deltas without side effects in updaters.
  const ref = useRef(state);
  ref.current = state;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full / disabled */
    }
  }, [state]);

  const commit = useCallback((next) => {
    ref.current = next;
    setState(next);
  }, []);

  const add = useCallback(
    (product, qty = 1) => {
      const id = String(product.id);
      const { items, saved } = ref.current;
      const existing = items.find((i) => i.id === id);
      const current = existing ? existing.qty : 0;
      const nextQty = Math.min(MAX_QTY, current + qty);
      const added = nextQty - current;
      if (added <= 0) return;
      commit({
        items: existing ? items.map((i) => (i.id === id ? { ...i, qty: nextQty } : i)) : [...items, { id, qty: nextQty }],
        saved: saved.filter((s) => s !== id),
      });
      track('add_to_cart', productProps(product, added));
    },
    [commit],
  );

  const remove = useCallback(
    (id) => {
      id = String(id);
      const { items, saved } = ref.current;
      const line = items.find((i) => i.id === id);
      if (!line) return;
      commit({ items: items.filter((i) => i.id !== id), saved });
      track('remove_from_cart', productProps(productById.get(id), line.qty));
    },
    [commit],
  );

  const setQty = useCallback(
    (id, qty) => {
      id = String(id);
      const { items, saved } = ref.current;
      const line = items.find((i) => i.id === id);
      if (!line) return;
      const next = Math.min(MAX_QTY, Math.max(0, Math.floor(qty)));
      if (next === 0) return remove(id);
      if (next === line.qty) return;
      commit({ items: items.map((i) => (i.id === id ? { ...i, qty: next } : i)), saved });
      const product = productById.get(id);
      if (next > line.qty) track('add_to_cart', productProps(product, next - line.qty));
      else track('remove_from_cart', productProps(product, line.qty - next));
    },
    [commit, remove],
  );

  const saveForLater = useCallback(
    (id) => {
      id = String(id);
      const { items, saved } = ref.current;
      const line = items.find((i) => i.id === id);
      if (!line) return;
      commit({ items: items.filter((i) => i.id !== id), saved: [id, ...saved.filter((s) => s !== id)] });
      track('remove_from_cart', productProps(productById.get(id), line.qty));
    },
    [commit],
  );

  const moveToCart = useCallback(
    (id) => {
      id = String(id);
      const product = productById.get(id);
      if (product) add(product, 1);
    },
    [add],
  );

  const removeSaved = useCallback(
    (id) => {
      const { items, saved } = ref.current;
      commit({ items, saved: saved.filter((s) => s !== String(id)) });
    },
    [commit],
  );

  const clear = useCallback(() => commit({ items: [], saved: ref.current.saved }), [commit]);

  const value = useMemo(() => {
    const lines = state.items
      .map((i) => ({ ...i, product: productById.get(i.id) }))
      .filter((l) => l.product);
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const subtotal = Math.round(lines.reduce((s, l) => s + l.qty * l.product.price, 0) * 100) / 100;
    const savedProducts = state.saved.map((id) => productById.get(id)).filter(Boolean);
    return { lines, count, subtotal, savedProducts, add, remove, setQty, saveForLater, moveToCart, removeSaved, clear, MAX_QTY };
  }, [state, add, remove, setQty, saveForLater, moveToCart, removeSaved, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
