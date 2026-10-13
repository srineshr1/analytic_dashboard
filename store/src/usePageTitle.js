import { useEffect } from 'react';

/** Sets document.title; the tracker reads it for page_view events. */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | ShopVerse` : 'ShopVerse — Shop everything';
  }, [title]);
}
