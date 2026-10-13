import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  ExternalLink,
  FileText,
  Filter,
  Flame,
  LayoutDashboard,
  Menu,
  MousePointerClick,
  Package,
  RefreshCw,
  Search,
  Users,
  Workflow,
  X,
  Monitor,
  Tablet,
  Smartphone,
  Layers,
} from 'lucide-react';
import { DEVICES, RANGES, useFilterHref, useFilters, useRefresh } from '../lib/filters.jsx';
import { useApi } from '../lib/useApi.js';
import { Segmented } from './ui.jsx';
import { fmtNum } from '../lib/format.js';

export const NAV = [
  { section: 'Analytics' },
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/live', label: 'Live', icon: Activity },
  { to: '/funnel', label: 'Funnel', icon: Filter },
  { to: '/flows', label: 'User flow', icon: Workflow },
  { section: 'Behaviour' },
  { to: '/pages', label: 'Pages', icon: FileText },
  { to: '/clicks', label: 'Clicks', icon: MousePointerClick },
  { to: '/heatmap', label: 'Heatmap', icon: Flame },
  { to: '/sessions', label: 'Sessions', icon: Users },
  { section: 'Commerce' },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/search', label: 'Search', icon: Search },
];

const TITLES = [
  [/^\/$/, 'Overview'],
  [/^\/live/, 'Live'],
  [/^\/funnel/, 'Conversion funnel'],
  [/^\/flows/, 'User flow'],
  [/^\/pages/, 'Pages'],
  [/^\/clicks/, 'Clicks'],
  [/^\/heatmap/, 'Heatmap'],
  [/^\/sessions\/.+/, 'Session journey'],
  [/^\/sessions/, 'Sessions'],
  [/^\/products/, 'Products'],
  [/^\/search/, 'Search'],
];
const titleFor = (path) => TITLES.find(([re]) => re.test(path))?.[1] ?? 'Not found';

// Pages where the global date range / device filter has no effect.
const NO_RANGE = [/^\/live/, /^\/sessions\/.+/];
const NO_DEVICE = [/^\/sessions\/.+/];

const DEVICE_OPTS = [
  { value: '', label: 'All', icon: Layers, title: 'All devices', hideLabel: true },
  { value: 'desktop', label: 'Desktop', icon: Monitor, title: 'Desktop', hideLabel: true },
  { value: 'tablet', label: 'Tablet', icon: Tablet, title: 'Tablet', hideLabel: true },
  { value: 'mobile', label: 'Mobile', icon: Smartphone, title: 'Mobile', hideLabel: true },
];

function Sidebar({ open, onClose }) {
  const href = useFilterHref();
  return (
    <>
      <div className={`drawer-backdrop ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside id="sidebar" className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="18" height="18">
              <path d="M7 21l5-6 4 4 8-10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="brand-name">
            ShopVerse <span>Analytics</span>
          </span>
          <button type="button" className="icon-btn drawer-close" onClick={onClose} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>
        <nav className="nav">
          <ul>
            {NAV.map((item) =>
              item.section ? (
                <li key={item.section} className="nav-section" aria-hidden="true">{item.section}</li>
              ) : (
                <li key={item.to}>
                  <NavLink to={href(item.to)} end={item.end} className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`} onClick={onClose}>
                    <item.icon size={16} aria-hidden="true" />
                    {item.label}
                  </NavLink>
                </li>
              ),
            )}
          </ul>
        </nav>
        <div className="sidebar-foot">
          <a className="nav-link" href="/store/" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden="true" />
            Open store ↗
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </aside>
    </>
  );
}

function LivePill() {
  const href = useFilterHref();
  const q = useApi('/api/live', { limit: 1 }, { interval: 15000 });
  const n = q.data?.active_sessions;
  return (
    <NavLink to={href('/live')} className="live-pill" title="Active sessions in the last 5 minutes">
      <span className={`pulse ${q.error ? 'is-off' : ''}`} aria-hidden="true" />
      <span>Live</span>
      {n !== undefined && <span className="live-pill-count">{fmtNum(n)}</span>}
      <span className="sr-only">{n !== undefined ? `${n} active sessions` : ''}</span>
    </NavLink>
  );
}

function Topbar({ onMenu }) {
  const { pathname } = useLocation();
  const { range, device, setRange, setDevice } = useFilters();
  const { refresh } = useRefresh();
  const [spinning, setSpinning] = useState(false);
  const title = titleFor(pathname);
  const rangeOff = NO_RANGE.some((re) => re.test(pathname));
  const deviceOff = NO_DEVICE.some((re) => re.test(pathname));

  useEffect(() => {
    document.title = `${title} · ShopVerse Analytics`;
  }, [title]);

  const onRefresh = () => {
    refresh();
    setSpinning(true);
    setTimeout(() => setSpinning(false), 700);
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="icon-btn menu-btn" onClick={onMenu} aria-label="Open navigation" aria-controls="sidebar">
          <Menu size={18} />
        </button>
        <h1 className="page-title">{title}</h1>
      </div>
      <div className="topbar-right">
        <Segmented
          label="Date range"
          options={RANGES}
          value={range}
          onChange={setRange}
          className={rangeOff ? 'is-dimmed' : ''}
        />
        <Segmented
          label="Device"
          options={DEVICE_OPTS}
          value={DEVICES.includes(device) ? device : ''}
          onChange={setDevice}
          className={deviceOff ? 'is-dimmed' : ''}
        />
        <button type="button" className="icon-btn" onClick={onRefresh} aria-label="Refresh data" title="Refresh data">
          <RefreshCw size={16} className={spinning ? 'spin' : ''} />
        </button>
        <LivePill />
      </div>
    </header>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="main-col">
        <Topbar onMenu={() => setOpen(true)} />
        <main id="main" className="content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
