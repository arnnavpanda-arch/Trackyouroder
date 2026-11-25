import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { homeFor } from '../utils/helpers';

export default function BrandSplash() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const target = user ? homeFor(user.role) : '/login';

    // If user already logged in or splash was already shown in this session, navigate immediately
    const alreadySeen = typeof window !== 'undefined' && sessionStorage.getItem('brand_splash_seen');
    if (user || alreadySeen) {
      navigate(target, { replace: true });
      return;
    }

    try {
      sessionStorage.setItem('brand_splash_seen', '1');
    } catch {}

    const exitTimer = setTimeout(() => {
      setLeaving(true);
    }, 450);

    const navTimer = setTimeout(() => {
      navigate(target, { replace: true });
    }, 650);

    const handleSkip = () => {
      navigate(target, { replace: true });
    };

    window.addEventListener('keydown', handleSkip);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(navTimer);
      window.removeEventListener('keydown', handleSkip);
    };
  }, [navigate, user]);

  const handleClick = () => {
    const target = user ? homeFor(user.role) : '/login';
    navigate(target, { replace: true });
  };

  return (
    <div className={`brand-splash ${leaving ? 'fade-out' : ''}`} onClick={handleClick}>
      <div className="brand-splash-grid" />
      <div className="brand-splash-bg-glow" />
      <div className="brand-splash-content">
        <div className="brand-splash-pill">
          <span className="splash-dot" />
          <span>CONNECTED LOGISTICS</span>
        </div>
        <h1 className="brand-splash-title">TRACKORA</h1>
        <p className="brand-splash-sub">Intelligent Fleet, Dispatch & Last-Mile Operations</p>
        <div className="brand-splash-progress">
          <div className="brand-splash-bar" />
        </div>
        <span className="brand-splash-tip">Opening portal...</span>
      </div>
    </div>
  );
}
