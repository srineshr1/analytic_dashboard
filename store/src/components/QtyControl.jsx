import { Minus, Plus, Trash2 } from 'lucide-react';

/** -/+ stepper. With `onRemove`, the minus button turns into a trash button at 1. */
export default function QtyControl({ value, max, onChange, label = 'Quantity', onRemove }) {
  return (
    <div className="qty" role="group" aria-label={label}>
      {onRemove && value <= 1 ? (
        <button type="button" onClick={onRemove} aria-label="Remove item" data-track="cart-remove">
          <Trash2 size={16} aria-hidden="true" />
        </button>
      ) : (
        <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Decrease quantity" data-track="qty-decrease">
          <Minus size={16} aria-hidden="true" />
        </button>
      )}
      <output aria-live="polite" aria-label={`${label}: ${value}`}>
        {value}
      </output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity" data-track="qty-increase">
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
