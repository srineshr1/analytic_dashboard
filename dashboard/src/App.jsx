import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { SkeletonChart } from './components/ui.jsx';

// Route-level code splitting keeps the initial bundle small.
const Overview = lazy(() => import('./pages/Overview.jsx'));
const Live = lazy(() => import('./pages/Live.jsx'));
const Funnel = lazy(() => import('./pages/Funnel.jsx'));
const Flows = lazy(() => import('./pages/Flows.jsx'));
const Pages = lazy(() => import('./pages/Pages.jsx'));
const Clicks = lazy(() => import('./pages/Clicks.jsx'));
const Heatmap = lazy(() => import('./pages/Heatmap.jsx'));
const Sessions = lazy(() => import('./pages/Sessions.jsx'));
const Journey = lazy(() => import('./pages/Journey.jsx'));
const Products = lazy(() => import('./pages/Products.jsx'));
const Search = lazy(() => import('./pages/Search.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

const fallback = (
  <div className="page">
    <SkeletonChart height={320} />
  </div>
);

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Suspense fallback={fallback}><Overview /></Suspense>} />
        <Route path="live" element={<Suspense fallback={fallback}><Live /></Suspense>} />
        <Route path="funnel" element={<Suspense fallback={fallback}><Funnel /></Suspense>} />
        <Route path="flows" element={<Suspense fallback={fallback}><Flows /></Suspense>} />
        <Route path="pages" element={<Suspense fallback={fallback}><Pages /></Suspense>} />
        <Route path="clicks" element={<Suspense fallback={fallback}><Clicks /></Suspense>} />
        <Route path="heatmap" element={<Suspense fallback={fallback}><Heatmap /></Suspense>} />
        <Route path="sessions" element={<Suspense fallback={fallback}><Sessions /></Suspense>} />
        <Route path="sessions/:id" element={<Suspense fallback={fallback}><Journey /></Suspense>} />
        <Route path="products" element={<Suspense fallback={fallback}><Products /></Suspense>} />
        <Route path="search" element={<Suspense fallback={fallback}><Search /></Suspense>} />
        <Route path="*" element={<Suspense fallback={fallback}><NotFound /></Suspense>} />
      </Route>
    </Routes>
  );
}
