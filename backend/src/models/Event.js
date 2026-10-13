import mongoose from 'mongoose';

export const EVENT_TYPES = [
  'page_view',
  'click',
  'scroll_depth',
  'rage_click',
  'time_on_page',
  'product_view',
  'search',
  'add_to_cart',
  'remove_from_cart',
  'begin_checkout',
  'purchase',
];

export const DEVICES = ['desktop', 'tablet', 'mobile'];

const itemSchema = new mongoose.Schema(
  {
    product_id: String,
    name: String,
    category: String,
    price: Number,
    quantity: Number,
  },
  { _id: false }
);

// Whitelisted event-specific properties. Anything else sent by a client is dropped.
const propsSchema = new mongoose.Schema(
  {
    product_id: String,
    product_name: String,
    category: String,
    brand: String,
    price: Number,
    quantity: Number,
    query: String,
    results: Number,
    value: Number,
    items_count: Number,
    items: { type: [itemSchema], default: undefined },
    order_id: String,
    depth: Number,
    duration_ms: Number,
    count: Number,
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true, maxlength: 128 },
    event_type: { type: String, required: true, enum: EVENT_TYPES },
    // Full URL as seen by the browser (incl. query string).
    page_url: { type: String, required: true, maxlength: 2048 },
    // origin + page group (e.g. https://shop.test/store/product/:id), or origin + path
    // when the site doesn't define groups. Used for heatmaps and page stats.
    page_key: { type: String, required: true, maxlength: 2048 },
    // Path-only form of page_key, e.g. "/store/product/:id".
    page_group: { type: String, required: true, maxlength: 512 },
    timestamp: { type: Date, required: true },
    // Click-only fields. x/y are document coordinates (pageX/pageY) in CSS px.
    x: Number,
    y: Number,
    target: { type: String, maxlength: 256 }, // CSS-ish selector hint, e.g. "button#buy"
    target_label: { type: String, maxlength: 128 }, // data-track value or visible text
    viewport_width: Number,
    viewport_height: Number,
    page_width: Number,
    page_height: Number,
    device: { type: String, enum: DEVICES },
    props: propsSchema,
    referrer: { type: String, maxlength: 2048 },
    user_agent: { type: String, maxlength: 512 },
    received_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// Session journey lookups and session aggregation.
eventSchema.index({ session_id: 1, timestamp: 1 });
// Heatmap lookups.
eventSchema.index({ page_key: 1, event_type: 1 });
// Date-range analytics.
eventSchema.index({ timestamp: 1, event_type: 1 });

export const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);
