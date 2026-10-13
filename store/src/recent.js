const KEY = 'sv_recent';
const MAX = 15;

export function recentlyViewed() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list.map(String) : [];
  } catch {
    return [];
  }
}

export function rememberViewed(id) {
  try {
    const list = [String(id), ...recentlyViewed().filter((x) => x !== String(id))].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
