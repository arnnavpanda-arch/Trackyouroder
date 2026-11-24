import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Icon } from './UI';

export default function Navbar({ onMenu }) {
  const { user, notes, markRead, settings } = useApp();
  const [open, setOpen] = useState(false);
  const unread = notes.filter((n) => !n.read).length;
  const toggle = () => { setOpen(!open); if (!open) setTimeout(markRead, 1200); };
  const logo = settings?.logo_url;
  return (
    <header className="nav">
      <button className="icon-btn menu" onClick={onMenu} aria-label="Open menu"><Icon n="menu" /></button>
      <div className="nav-brand">
        {logo ? (
          <img src={logo} alt="Logo" style={{ width: 26, height: 26, objectFit: 'contain', borderRadius: 6, marginRight: 8, background: '#fff' }} />
        ) : (
          <span className="logo">T</span>
        )}
        {settings?.company_name ? settings.company_name.split(' ')[0] : 'Trackora'}
      </div>
      <div className="nav-right">
        <div className="bell-wrap">
          <button className="icon-btn" onClick={toggle} aria-label="Notifications"><Icon n="bell" />{unread > 0 && <span className="count">{unread}</span>}</button>
          {open && (
            <div className="dd">
              <div className="dd-head"><b>Notifications</b><button onClick={() => setOpen(false)}><Icon n="x" size={16} /></button></div>
              {notes.length === 0 ? (
                <p className="dd-empty">You're all caught up.</p>
              ) : (
                notes.map((n) => (
                  <Link
                    key={n.id}
                    to={user.role === 'user' ? '/user/orders' : `/${user.role}/orders/${n.orderId}`}
                    state={user.role === 'user' ? { orderId: n.orderId } : undefined}
                    onClick={() => {
                      if (user.role === 'user') {
                        sessionStorage.setItem('dt_user_active_order', n.orderId);
                      }
                      setOpen(false);
                    }}
                    className={n.read ? '' : 'unread'}
                  >
                    <span>{n.message}</span>
                    <small>{new Date(n.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
        <div className="me"><span className="avatar">{user.name[0]}</span><div><b>{user.name}</b><small>{user.role}</small></div></div>
      </div>
    </header>
  );
}
