import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Package } from 'lucide-react';
import { Async, Card, EmptyState, MiniBar, SkeletonChart, SkeletonRows } from '../components/ui.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { C, ChartTooltip, axisProps, gridProps, tooltipCursor } from '../components/charts.jsx';
import { useApi } from '../lib/useApi.js';
import { useQueryFilters } from '../lib/hooks.js';
import { fmtCompact, fmtCurrency, fmtNum, fmtPct } from '../lib/format.js';

const productCell = (r) => (
  <span className="page-cell">
    <span>{r.name || `Product #${r.product_id}`}</span>
    <span className="muted small">
      {r.category || 'uncategorised'}
      {r.price != null ? ` · ${fmtCurrency(r.price)}` : ''}
    </span>
  </span>
);

const viewToCart = (r) => (
  <MiniBar value={r.view_to_cart} max={100} label={fmtPct(r.view_to_cart)} tone={r.view_to_cart < 5 ? 'red' : r.view_to_cart < 15 ? 'amber' : 'green'} width={64} />
);

function ProductTable({ rows, caption, emphasis, compact = false }) {
  const maxViews = Math.max(1, ...rows.map((r) => r.views));
  const maxRev = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <DataTable
      dense
      sortable
      caption={caption}
      rows={rows}
      rowKey={(r) => r.product_id}
      columns={[
        { key: 'name', label: 'Product', render: productCell, className: 'cell-wrap' },
        {
          key: 'views',
          label: 'Views',
          align: 'right',
          render: (r) => (emphasis === 'views' ? <MiniBar value={r.views} max={maxViews} label={fmtNum(r.views)} width={56} /> : fmtNum(r.views)),
        },
        { key: 'add_to_cart', label: 'Carts', align: 'right', render: (r) => fmtNum(r.add_to_cart) },
        ...(compact ? [] : [
          { key: 'view_to_cart', label: 'View→cart', align: 'right', render: viewToCart },
          { key: 'units_sold', label: 'Units', align: 'right', render: (r) => fmtNum(r.units_sold) },
        ]),
        {
          key: 'revenue',
          label: 'Revenue',
          align: 'right',
          render: (r) => (emphasis === 'revenue' ? <MiniBar value={r.revenue} max={maxRev} label={fmtCurrency(r.revenue)} width={56} tone="green" /> : fmtCurrency(r.revenue)),
        },
      ]}
    />
  );
}

export default function Products() {
  const f = useQueryFilters();
  const q = useApi('/api/stats/products', f);
  const empty = <EmptyState compact icon={Package} title="No product activity in this period" />;

  return (
    <div className="page">
      <div className="grid-12">
        <Card title="Category performance" subtitle="Revenue and product views for the top 12 categories" className="span-12">
          <Async q={q} skeleton={<SkeletonChart height={280} />} isEmpty={(d) => !d.categories.length} empty={empty}>
            {(d) => (
              <div className="chart" style={{ height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={d.categories.slice(0, 12)} margin={{ top: 8, right: 0, left: -4, bottom: 24 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="category" {...axisProps} interval={0} angle={-25} textAnchor="end" height={56} tick={{ fill: '#c3c9d8', fontSize: 11 }} />
                    <YAxis yAxisId="rev" {...axisProps} tickFormatter={(v) => fmtCurrency(v, { compact: true })} width={56} />
                    <YAxis yAxisId="views" orientation="right" {...axisProps} tickFormatter={fmtCompact} width={40} />
                    <Tooltip
                      cursor={tooltipCursor}
                      content={<ChartTooltip valueFormatter={(v, p) => (p.dataKey === 'revenue' ? fmtCurrency(v) : fmtNum(v))} />}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#a3abbd' }} iconType="circle" iconSize={8} />
                    <Bar yAxisId="rev" dataKey="revenue" name="Revenue" fill={C.accent} radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Bar yAxisId="views" dataKey="views" name="Views" fill={C.sky} fillOpacity={0.55} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Async>
        </Card>

        <Card title="Most viewed" className="span-6">
          <Async q={q} skeleton={<SkeletonRows rows={8} />} isEmpty={(d) => !d.top_viewed.length} empty={empty}>
            {(d) => <ProductTable rows={d.top_viewed.slice(0, 10)} caption="Most viewed products" emphasis="views" compact />}
          </Async>
        </Card>

        <Card title="Top revenue" className="span-6">
          <Async q={q} skeleton={<SkeletonRows rows={8} />} isEmpty={(d) => !d.top_revenue.some((p) => p.revenue > 0)} empty={<EmptyState compact title="No purchases in this period" />}>
            {(d) => <ProductTable rows={d.top_revenue.filter((p) => p.revenue > 0).slice(0, 10)} caption="Products by revenue" emphasis="revenue" compact />}
          </Async>
        </Card>

        <Card title="Low conversion" subtitle="Viewed at least 5 times but rarely added to cart — candidates for better pricing, copy or imagery" className="span-12 card-warn">
          <Async q={q} skeleton={<SkeletonRows rows={6} />} isEmpty={(d) => !d.low_conversion.length} empty={<EmptyState compact title="No products with enough views yet" />}>
            {(d) => <ProductTable rows={d.low_conversion} caption="Products with low view-to-cart conversion" emphasis="views" />}
          </Async>
        </Card>
      </div>
    </div>
  );
}
