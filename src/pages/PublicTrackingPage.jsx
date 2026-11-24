import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import OrderDetails from './OrderDetails';

export default function PublicTrackingPage() {
  const { id } = useParams();
  const { user } = useApp();
  const nav = useNavigate();

  useEffect(() => {
    if (id) {
      sessionStorage.setItem('dt_user_active_order', id);
    }
  }, [id]);

  const handleBack = () => {
    if (user?.role === 'user') {
      nav('/user/orders');
    } else if (user?.role === 'agent') {
      nav('/agent');
    } else if (user?.role === 'admin') {
      nav('/admin/orders');
    } else {
      nav('/');
    }
  };

  return (
    <div className="public-track-page">
      <header className="public-track-header no-print">
        <div className="public-track-brand">
          <Link to="/" className="public-brand-link">
            <span className="brand-truck-icon">🚚</span>
            <div>
              <span className="brand-title">DELIVERY TRACKER</span>
              <span className="brand-sub">Live Road Tracking & Consignment Verification</span>
            </div>
          </Link>
        </div>

        <div className="public-track-nav">
          <div className="public-status-badge">
            <span className="live-radar-dot" /> LIVE TRACKING ACTIVE
          </div>
          {user ? (
            <Link
              to={user.role === 'admin' ? '/admin' : user.role === 'agent' ? '/agent' : '/user'}
              className="btn sm"
              style={{ background: '#2563eb', color: '#fff', fontWeight: 700, borderRadius: 8, padding: '6px 14px' }}
            >
              Dashboard
            </Link>
          ) : (
            <Link
              to="/login"
              className="btn sm ghost"
              style={{ fontWeight: 700, borderRadius: 8, padding: '6px 14px' }}
            >
              Log In
            </Link>
          )}
        </div>
      </header>

      <main className="public-track-content">
        <OrderDetails orderId={id} onBack={handleBack} />
      </main>
    </div>
  );
}
