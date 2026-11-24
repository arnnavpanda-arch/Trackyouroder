import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { evaluateDeliveryOffer } from '../utils/helpers';

function formatRemainingTime(endTime) {
  if (!endTime) return '';
  const diff = new Date(endTime).getTime() - Date.now();
  const totalSecs = Math.floor(diff / 1000);
  if (totalSecs <= 0) return 'Expired';

  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  if (days > 0) {
    return `${days}d ${hours}h left`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }
  return `${minutes}m ${String(seconds).padStart(2, '0')}s left`;
}

export default function OfferBanner({ customOffer = null, hideCta = false, allowReopen = true }) {
  const { socket } = useApp() || {};
  const [offer, setOffer] = useState(customOffer);
  const [dismissed, setDismissed] = useState(false);
  const [remainingTime, setRemainingTime] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const updatedTimerRef = useRef(null);

  // 1. Fetch initial offer if not provided via props
  useEffect(() => {
    if (customOffer) {
      setOffer(customOffer);
      return;
    }
    let isMounted = true;
    api.getPricing()
      .then((pricing) => {
        if (isMounted && pricing?.delivery_offer) {
          setOffer(pricing.delivery_offer);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [customOffer]);

  // 2. Real-time updates via Socket.io
  useEffect(() => {
    if (!socket) return;
    const handleOfferUpdated = (updatedOffer) => {
      if (updatedOffer) {
        setOffer(updatedOffer);
        // Un-dismiss banner when admin creates or updates an offer so user sees it immediately
        setDismissed(false);
        setJustUpdated(true);
        if (updatedTimerRef.current) clearTimeout(updatedTimerRef.current);
        updatedTimerRef.current = setTimeout(() => setJustUpdated(false), 6000);
        try {
          localStorage.removeItem('trackora_dismissed_offer_ts');
        } catch {}
      }
    };
    const handlePricingUpdated = (pricing) => {
      if (pricing?.delivery_offer) {
        setOffer(pricing.delivery_offer);
        setDismissed(false);
      }
    };
    socket.on('offerUpdated', handleOfferUpdated);
    socket.on('pricingUpdated', handlePricingUpdated);
    return () => {
      socket.off('offerUpdated', handleOfferUpdated);
      socket.off('pricingUpdated', handlePricingUpdated);
      if (updatedTimerRef.current) clearTimeout(updatedTimerRef.current);
    };
  }, [socket]);

  // 3. Check dismissed state in localStorage (and un-dismiss if offer was updated by admin)
  useEffect(() => {
    if (!offer || !offer.active) return;
    try {
      const dismissedTs = localStorage.getItem('trackora_dismissed_offer_ts');
      const offerUpdatedTs = offer.updatedAt ? new Date(offer.updatedAt).getTime() : 0;
      if (dismissedTs && Number(dismissedTs) >= offerUpdatedTs) {
        setDismissed(true);
      } else {
        setDismissed(false);
      }
    } catch {
      setDismissed(false);
    }
  }, [offer]);

  // 4. Live expiration countdown ticker with automatic expiration detection
  useEffect(() => {
    if (!offer || !offer.active || offer.type !== 'timed_window' || !offer.end_date) {
      setIsExpired(false);
      setRemainingTime('');
      return;
    }

    const checkExpiration = () => {
      const now = Date.now();
      const end = new Date(offer.end_date).getTime();
      const start = offer.start_date ? new Date(offer.start_date).getTime() : 0;

      if (now >= end) {
        setIsExpired(true);
        setRemainingTime('Expired');
      } else if (start && now < start) {
        setIsExpired(false);
        setRemainingTime('Scheduled');
      } else {
        setIsExpired(false);
        setRemainingTime(formatRemainingTime(offer.end_date));
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 1000);
    return () => clearInterval(interval);
  }, [offer]);

  const evalResult = useMemo(() => evaluateDeliveryOffer(offer, 0), [offer]);

  // If inactive, none, or expired, don't show
  if (!offer || !offer.active || offer.type === 'none') {
    return null;
  }
  if (isExpired || evalResult.isExpired || evalResult.notStarted) {
    return null;
  }

  const handleDismiss = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setDismissed(true);
    try {
      const ts = offer.updatedAt ? new Date(offer.updatedAt).getTime() : Date.now();
      localStorage.setItem('trackora_dismissed_offer_ts', String(ts));
    } catch {}
  };

  const handleReopen = () => {
    setDismissed(false);
    try {
      localStorage.removeItem('trackora_dismissed_offer_ts');
    } catch {}
  };

  const isTimed = offer.type === 'timed_window';
  const isMinAmount = offer.type === 'min_amount';

  // If the user closed the banner, show an elegant compact minimized pill so they can re-open it anytime
  if (dismissed) {
    if (!allowReopen) return null;
    return (
      <div
        className="offer-minimized-pill"
        onClick={handleReopen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleReopen(); }}
        title="Delivery offer is active. Click to view announcement banner."
      >
        <div className="offer-minimized-content">
          <span className="offer-minimized-icon">{isTimed ? '⚡' : '🎁'}</span>
          <span className="offer-minimized-tag">FREE DELIVERY OFFER</span>
          <span className="offer-minimized-title">
            {offer.title || (isTimed ? 'Limited-Time Free Delivery!' : `Free Delivery on orders above ₹${offer.min_amount}`)}
          </span>
          {isTimed && remainingTime && remainingTime !== 'Expired' && (
            <span className="offer-minimized-timer">⏱️ {remainingTime}</span>
          )}
          {isMinAmount && (
            <span className="offer-minimized-timer">📦 Min ₹{offer.min_amount}</span>
          )}
        </div>
        <button type="button" className="offer-minimized-expand-btn">
          <span>View Offer</span>
          <span>▾</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`offer-banner ${justUpdated ? 'offer-just-updated' : ''}`}>
      <div className="offer-banner-content">
        <div className="offer-banner-icon">
          {isTimed ? '⚡' : '🎉'}
        </div>
        <div className="offer-banner-text">
          <div className="offer-banner-meta">
            <span className="offer-badge">
              {isTimed ? 'LIMITED TIME PROMO' : 'FREE DELIVERY OFFER'}
            </span>
            {justUpdated && (
              <span className="offer-badge updated-flash">
                ✨ JUST UPDATED
              </span>
            )}
            {isTimed && remainingTime && remainingTime !== 'Expired' && (
              <span className="offer-timer-chip">
                <span>⏱️</span> {remainingTime}
              </span>
            )}
            {isMinAmount && (
              <span className="offer-timer-chip">
                <span>📦</span> Min. Order ₹{offer.min_amount}
              </span>
            )}
          </div>
          <h4 className="offer-banner-title">
            {offer.title || (isTimed ? 'Limited-Time Free Delivery!' : `Free Delivery on orders above ₹${offer.min_amount}`)}
          </h4>
          <p className="offer-banner-desc">
            {offer.banner_text || (isTimed ? 'Enjoy zero delivery fees on all shipments!' : `Place an order worth ₹${offer.min_amount} or more and pay ₹0 delivery fee.`)}
          </p>
        </div>
      </div>

      <div className="offer-banner-actions">
        {!hideCta && (
          <Link to="/user/new" className="offer-cta-btn">
            <span>Place Order</span>
            <span>→</span>
          </Link>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          className="offer-dismiss-btn"
          title="Minimize offer announcement"
          aria-label="Close delivery offer banner"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
