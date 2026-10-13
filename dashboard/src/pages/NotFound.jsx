import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Card, EmptyState } from '../components/ui.jsx';
import { useFilterHref } from '../lib/filters.jsx';

export default function NotFound() {
  const href = useFilterHref();
  return (
    <div className="page">
      <Card>
        <EmptyState icon={Compass} title="Page not found">
          <p>There’s nothing at this address.</p>
          <Link to={href('/')} className="btn btn-sm btn-primary">Back to overview</Link>
        </EmptyState>
      </Card>
    </div>
  );
}
