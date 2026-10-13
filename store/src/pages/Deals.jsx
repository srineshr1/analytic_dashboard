import { Zap } from 'lucide-react';
import Listing from '../components/Listing.jsx';
import { deals } from '../catalog.js';
import { usePageTitle } from '../usePageTitle.js';

export default function Deals() {
  usePageTitle("Today's Deals");
  return (
    <>
      <div className="deals-banner">
        <Zap size={36} aria-hidden="true" />
        <div>
          <h2>Today's Deals</h2>
          <p>
            {deals.length} deals with 15% off or more — biggest discounts first. Ends tonight at midnight.
          </p>
        </div>
      </div>
      <Listing title="All deals" base={deals} categoryMode="filter" cardTrack="deal-card" emptyHint="No deals match these filters right now." />
    </>
  );
}
