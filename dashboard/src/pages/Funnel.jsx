import { ArrowDown, ShoppingCart, Target, Users } from 'lucide-react';
import { Async, Card, EmptyState, SkeletonRows } from '../components/ui.jsx';
import { useApi } from '../lib/useApi.js';
import { useQueryFilters } from '../lib/hooks.js';
import { fmtNum, fmtPct } from '../lib/format.js';

function Callout({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className={`callout tone-${tone}`}>
      <span className="callout-icon" aria-hidden="true"><Icon size={18} /></span>
      <div>
        <p className="callout-label">{label}</p>
        <p className="callout-value">{value}</p>
        {sub && <p className="callout-sub">{sub}</p>}
      </div>
    </div>
  );
}

export default function Funnel() {
  const f = useQueryFilters();
  const q = useApi('/api/stats/funnel', f);

  return (
    <div className="page">
      <Async
        q={q}
        skeleton={<Card><SkeletonRows rows={10} height={28} /></Card>}
        isEmpty={(d) => !d.steps[0]?.sessions}
        empty={<Card><EmptyState title="No store visits in this period">Try a wider date range.</EmptyState></Card>}
      >
        {({ steps }) => {
          const first = steps[0];
          const last = steps.at(-1);
          const cart = steps.find((s) => s.key === 'add_to_cart');
          const abandonment = cart?.sessions ? (1 - last.sessions / cart.sessions) * 100 : null;
          const biggest = steps.slice(1).reduce((a, s) => (!a || s.drop_off > a.drop_off ? s : a), null);
          return (
            <>
              <div className="callouts">
                <Callout icon={Target} tone="green" label="Overall conversion" value={fmtPct(last.rate_from_start)} sub={`${fmtNum(last.sessions)} of ${fmtNum(first.sessions)} sessions purchased`} />
                <Callout
                  icon={ShoppingCart}
                  tone="amber"
                  label="Cart abandonment"
                  value={abandonment === null ? '—' : fmtPct(abandonment)}
                  sub={cart?.sessions ? `${fmtNum(cart.sessions - last.sessions)} of ${fmtNum(cart.sessions)} carts never purchased` : 'No add-to-cart sessions'}
                />
                <Callout
                  icon={Users}
                  tone="red"
                  label="Biggest drop-off"
                  value={biggest?.drop_off ? `−${fmtNum(biggest.drop_off)}` : '—'}
                  sub={biggest?.drop_off ? `before “${biggest.label}” (${fmtPct(100 - biggest.rate_from_prev)} lost)` : 'No drop-off'}
                />
              </div>

              <Card title="Conversion funnel" subtitle="Sessions that reached each step (and every step before it)">
                <ol className="funnel">
                  {steps.map((s, i) => (
                    <li key={s.key} className="funnel-step">
                      {i > 0 && (
                        <div className="funnel-drop">
                          <ArrowDown size={14} aria-hidden="true" />
                          <span>{fmtPct(s.rate_from_prev)} continued</span>
                          {s.drop_off > 0 && (
                            <span className="drop-chip">
                              −{fmtNum(s.drop_off)} dropped ({fmtPct(100 - s.rate_from_prev)})
                            </span>
                          )}
                        </div>
                      )}
                      <div className="funnel-row">
                        <div className="funnel-label">
                          <span className="funnel-index">{i + 1}</span>
                          <span>{s.label}</span>
                        </div>
                        <div className="funnel-bar-track">
                          <div
                            className="funnel-bar"
                            style={{ width: `${Math.max(s.rate_from_start, 0.8)}%`, '--step': i / Math.max(steps.length - 1, 1) }}
                            role="img"
                            aria-label={`${s.label}: ${fmtNum(s.sessions)} sessions, ${fmtPct(s.rate_from_start)} of start`}
                          />
                        </div>
                        <div className="funnel-nums">
                          <strong>{fmtNum(s.sessions)}</strong>
                          <span className="muted">{fmtPct(s.rate_from_start)} of start</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            </>
          );
        }}
      </Async>
    </div>
  );
}
