import { useEffect, useState } from 'react';
import SessionsView from './components/SessionsView.jsx';
import HeatmapView from './components/HeatmapView.jsx';

// Tiny hash router: #/sessions, #/sessions/<id>, #/heatmap?page=<url>
function parseHash() {
  const [path, query = ''] = window.location.hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  if (parts[0] === 'heatmap') return { view: 'heatmap', page: params.get('page') || '' };
  return { view: 'sessions', sessionId: parts[1] ? decodeURIComponent(parts[1]) : null };
}

export default function App() {
  const [route, setRoute] = useState(parseHash);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const tab = (id, label, href) => (
    <a href={href} className={`tab ${route.view === id ? 'active' : ''}`} aria-current={route.view === id ? 'page' : undefined}>
      {label}
    </a>
  );

  return (
    <div className="app">
      <header className="topbar">
        <h1>User Analytics</h1>
        <nav aria-label="Views">
          {tab('sessions', 'Sessions', '#/sessions')}
          {tab('heatmap', 'Heatmap', '#/heatmap')}
        </nav>
        <a className="demo-link" href="/demo/" target="_blank" rel="noreferrer">
          Open demo site ↗
        </a>
      </header>
      <main>
        {route.view === 'heatmap' ? (
          <HeatmapView page={route.page} />
        ) : (
          <SessionsView selectedId={route.sessionId} />
        )}
      </main>
    </div>
  );
}
