import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Icon } from './UI';

const NAV = {
  user: [['/user', 'Dashboard', 'dash'], ['/user/new', 'Place Order', 'plus'], ['/user/orders', 'My Orders', 'box'], ['/user/history', 'Delivery History', 'clock']],
  agent: [['/agent', 'My Deliveries', 'truck']],
  admin: [
    ['/admin', 'Dashboard', 'dash'],
    ['/admin/offers', 'Delivery Offers', 'gift'],
    ['/admin/regions', 'Serviceable Areas', 'map'],
    ['/admin/orders', 'Manage Orders', 'box'],
    ['/admin/users', 'Users & Agents', 'users'],
    ['/admin/live', 'Live Monitoring', 'map'],
    ['/admin/reports', 'Reports', 'chart'],
    ['/admin/settings', 'System Settings', 'settings'],
  ],
};

export default function Sidebar({ open, onClose }) {
  const { user, logout, settings } = useApp();
  const logo = settings?.logo_url;
  return (
    <>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`side ${open ? 'open' : ''}`}>
        <div className="brand">
          {logo ? (
            <img
              src={logo}
              alt="Logo"
              style={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}
            />
          ) : (
            <span className="logo">T</span>
          )}
          <div><b>{settings?.company_name ? settings.company_name.split(' ')[0] : 'Trackora'}</b><small>{user.role} console</small></div>
        </div>
        <nav>
          {NAV[user.role].map(([to, label, icon], i) => (
            <NavLink
              key={to}
              to={to}
              end={i === 0}
              onClick={() => {
                if (to === '/user/orders') {
                  sessionStorage.removeItem('dt_user_active_order');
                }
                onClose();
              }}
              state={to === '/user/orders' ? { resetList: true } : undefined}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <Icon n={icon} />
              <span>{label}</span>
              {to === '/admin/offers' && (
                <span style={{ marginLeft: 'auto', background: '#059669', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', letterSpacing: '0.02em' }}>
                  PROMO
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <button className="logout" onClick={logout}><Icon n="logout" />Sign out</button>
      </aside>
    </>
  );
}
