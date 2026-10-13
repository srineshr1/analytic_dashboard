import mongoose from 'mongoose';

export const EVENT_TYPES = ['page_view', 'click'];

const eventSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true, maxlength: 128 },
    event_type: { type: String, required: true, enum: EVENT_TYPES },
    // Full URL as seen by the browser (incl. query string).
    page_url: { type: String, required: true, maxlength: 2048 },
    // Normalised URL (origin + pathname) used to group clicks for heatmaps.
    page_key: { type: String, required: true, maxlength: 2048 },
    timestamp: { type: Date, required: true },
    // Click-only fields. x/y are document coordinates (pageX/pageY) in CSS px.
    x: { type: Number },
    y: { type: Number },
    // Context needed to render clicks at the right place on different screens.
    viewport_width: { type: Number },
    viewport_height: { type: Number },
    page_width: { type: Number },
    page_height: { type: Number },
    // Optional element hint for clicks, e.g. "button#buy".
    target: { type: String, maxlength: 256 },
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

export const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);
