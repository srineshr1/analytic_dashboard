const KEY = 'sv_orders';
const MAX_ORDERS = 20;

function readAll() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function newOrderId() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0');
  return `SV-${Date.now().toString(36).toUpperCase().slice(-4)}${rand}`;
}

export function saveOrder(order) {
  try {
    const list = [order, ...readAll().filter((o) => o.id !== order.id)].slice(0, MAX_ORDERS);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}

export const getOrder = (id) => readAll().find((o) => o.id === id) || null;
export const lastOrderId = () => readAll()[0]?.id || null;
