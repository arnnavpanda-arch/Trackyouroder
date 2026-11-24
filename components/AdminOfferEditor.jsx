import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { DEFAULT_OFFER, DEFAULT_PRICING, getPricing } from '../utils/helpers';
import OfferBanner from './OfferBanner';

export default function AdminOfferEditor({ onOfferSaved }) {
  const { toast, socket } = useApp() || {};
  const [pricing, setPricing] = useState(() => getPricing());
  const [offer, setOffer] = useState(() => (pricing?.delivery_offer ? { ...DEFAULT_OFFER, ...pricing.delivery_offer } : DEFAULT_OFFER));
  const [savingOffer, setSavingOffer] = useState(false);

  useEffect(() => {
    api.getPricing()
      .then((data) => {
        if (data) {
          setPricing(data);
          if (data.delivery_offer) {
            setOffer({ ...DEFAULT_OFFER, ...data.delivery_offer });
          }
        }
      })
      .catch(() => {});
  }, []);

  // Real-time socket sync
  useEffect(() => {
    if (!socket) return;
    const handleOfferUpdated = (updated) => {
      if (updated) {
        setOffer({ ...DEFAULT_OFFER, ...updated });
      }
    };
    const handlePricingUpdated = (p) => {
      if (p) {
        setPricing(p);
        if (p.delivery_offer) {
          setOffer({ ...DEFAULT_OFFER, ...p.delivery_offer });
        }
      }
    };
    socket.on('offerUpdated', handleOfferUpdated);
    socket.on('pricingUpdated', handlePricingUpdated);
    return () => {
      socket.off('offerUpdated', handleOfferUpdated);
      socket.off('pricingUpdated', handlePricingUpdated);
    };
  }, [socket]);

  const toDatetimeLocal = (d) => {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleSaveOffer = async (e) => {
    e.preventDefault();
    if (offer.active) {
      if (offer.type === 'timed_window') {
        if (!offer.end_date) {
          toast('Please select an expiration end date and time.', 'error');
          return;
        }
        const end = new Date(offer.end_date).getTime();
        const start = offer.start_date ? new Date(offer.start_date).getTime() : 0;
        if (end <= Date.now()) {
          toast('Offer end date/time has already passed. Please choose a future expiration date/time.', 'error');
          return;
        }
        if (start && end <= start) {
          toast('Offer end date/time must be strictly after the start date/time.', 'error');
          return;
        }
      }
    }

    setSavingOffer(true);
    try {
      const payload = {
        active: Boolean(offer.active),
        type: offer.type || 'none',
        min_amount: Math.max(0, Number(offer.min_amount) || 0),
        start_date: offer.start_date ? new Date(offer.start_date).toISOString() : null,
        end_date: offer.end_date ? new Date(offer.end_date).toISOString() : null,
        title: (offer.title || '').trim(),
        banner_text: (offer.banner_text || '').trim(),
      };
      await api.saveOffer(payload);
      toast('Delivery offer published! User dashboard banner and order fees updated.', 'success');
      if (onOfferSaved) onOfferSaved();
    } catch (err) {
      toast(err.message || 'Failed to save offer', 'error');
    } finally {
      setSavingOffer(false);
    }
  };

  return (
    <div className="card admin-offer-card" style={{ marginBottom: 22 }}>
      <form onSubmit={handleSaveOffer}>
        <div className="admin-offer-header">
          <div className="admin-offer-title-group">
            <h3>
              <span>🎁</span> Delivery Offers & Free Delivery Promotions
            </h3>
            <p>
              Configure promotional delivery offers. When active, eligible customers receive <b>₹0 delivery fee</b> and an announcement banner appears on their dashboard.
            </p>
          </div>

          <div className="admin-offer-toggle-wrap">
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: offer.active ? '#15803d' : '#64748b' }}>
                {offer.active ? 'Offer Active (ON)' : 'Offer Disabled (OFF)'}
              </span>
              <div>
                {(() => {
                  if (!offer.active || offer.type === 'none') {
                    return <span className="offer-status-chip disabled">Disabled</span>;
                  }
                  if (offer.type === 'timed_window') {
                    const now = new Date();
                    const start = offer.start_date ? new Date(offer.start_date) : null;
                    const end = offer.end_date ? new Date(offer.end_date) : null;
                    if (end && now > end) return <span className="offer-status-chip expired">Expired Automatically</span>;
                    if (start && now < start) return <span className="offer-status-chip scheduled">Scheduled</span>;
                    return <span className="offer-status-chip live">● Live & Active</span>;
                  }
                  return null;
                })()}
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={offer.active}
              className={`switch ${offer.active ? 'on' : ''}`}
              onClick={() => setOffer((prev) => ({ ...prev, active: !prev.active, type: prev.type === 'none' ? 'timed_window' : prev.type }))}
              title="Toggle Delivery Offer On / Off"
            >
              <span />
            </button>
          </div>
        </div>

        <div className="admin-offer-form-body">
          {/* Specific Date & Time Window Promotional Offer */}
          <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 12, border: '1.5px solid #e2e8f0', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>⚡</span>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                Promotional Free Delivery Date & Time Window
              </h4>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              When active, all shipments placed during this promotional window receive 100% Free Delivery (₹0 fee). Automatically expires once the end time passes.
            </p>
          </div>

          {/* Inputs for Date & Time Window */}
          {offer.type === 'timed_window' && (
            <div className="admin-offer-inputs-grid">
              <div className="offer-input-box" style={{ gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <label style={{ margin: 0 }}>Quick Time Window Presets:</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn xs ghost"
                      style={{ padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '6px', background: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1' }}
                      onClick={() => {
                        const now = new Date();
                        const end = new Date(now.getTime() + 24 * 3600 * 1000);
                        setOffer((prev) => ({
                          ...prev,
                          active: true,
                          start_date: now.toISOString(),
                          end_date: end.toISOString(),
                          title: '24-Hour Flash Sale: 100% Free Delivery!',
                          banner_text: 'Zero delivery fees on all orders placed within the next 24 hours!'
                        }));
                      }}
                    >
                      ⚡ Next 24 Hours
                    </button>
                    <button
                      type="button"
                      className="btn xs ghost"
                      style={{ padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '6px', background: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1' }}
                      onClick={() => {
                        const now = new Date();
                        const end = new Date(now.getTime() + 48 * 3600 * 1000);
                        setOffer((prev) => ({
                          ...prev,
                          active: true,
                          start_date: now.toISOString(),
                          end_date: end.toISOString(),
                          title: 'Weekend Flash Sale: 100% Free Delivery!',
                          banner_text: 'Enjoy zero delivery fees on all shipments throughout the 48-hour promo!'
                        }));
                      }}
                    >
                      ⏱️ Next 48 Hours
                    </button>
                    <button
                      type="button"
                      className="btn xs ghost"
                      style={{ padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '6px', background: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1' }}
                      onClick={() => {
                        const now = new Date();
                        const end = new Date(now.getTime() + 7 * 86400 * 1000);
                        setOffer((prev) => ({
                          ...prev,
                          active: true,
                          start_date: now.toISOString(),
                          end_date: end.toISOString(),
                          title: '7-Day Free Delivery Celebration!',
                          banner_text: 'Zero delivery fees on all customer shipments for the next 7 days!'
                        }));
                      }}
                    >
                      📅 Next 7 Days
                    </button>
                  </div>
                </div>
              </div>

              <div className="offer-input-box">
                <label>Offer Start Date & Time</label>
                <input
                  type="datetime-local"
                  value={toDatetimeLocal(offer.start_date)}
                  onChange={(e) => setOffer((prev) => ({ ...prev, start_date: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                  required
                />
                <span className="pricing-hint">When the free delivery offer begins active promotion.</span>
              </div>

              <div className="offer-input-box">
                <label>
                  <span>Offer End Date & Time (Auto-Expires)</span>
                  {offer.end_date && new Date(offer.end_date) < new Date() && (
                    <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.75rem' }}>Expired Automatically</span>
                  )}
                </label>
                <input
                  type="datetime-local"
                  value={toDatetimeLocal(offer.end_date)}
                  onChange={(e) => setOffer((prev) => ({ ...prev, end_date: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                  required
                />
                <span className="pricing-hint">After this date/time, the offer automatically expires and stops.</span>
              </div>

              <div className="offer-input-box" style={{ gridColumn: 'span 2' }}>
                <label>Offer Headline / Title</label>
                <input
                  type="text"
                  value={offer.title || ''}
                  onChange={(e) => setOffer((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Weekend Flash Sale: 100% Free Delivery!"
                  required
                />
              </div>
            </div>
          )}

          {/* Banner Promotional Text */}
          {offer.type !== 'none' && (
            <div className="offer-input-box">
              <label>User Dashboard Banner Subtext / Promotional Copy</label>
              <input
                type="text"
                value={offer.banner_text || ''}
                onChange={(e) => setOffer((prev) => ({ ...prev, banner_text: e.target.value }))}
                placeholder="e.g. Limited-time offer! Place an order and enjoy ₹0 delivery fees."
                required
              />
              <span className="pricing-hint">Explains the offer details inside the customer announcement banner.</span>
            </div>
          )}

          {/* Live Customer Banner Preview */}
          {offer.active && offer.type !== 'none' && (
            <div className="offer-preview-section">
              <div className="offer-preview-title">
                <span>👁️</span> Live Customer Dashboard Banner Preview
              </div>
              <OfferBanner customOffer={offer} hideCta={false} allowReopen={false} />
            </div>
          )}
        </div>

        <div className="admin-offer-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => {
              setOffer({
                active: false,
                type: 'none',
                min_amount: 500,
                start_date: null,
                end_date: null,
                title: '',
                banner_text: '',
                updatedAt: new Date().toISOString(),
              });
            }}
          >
            Reset Offer to Inactive
          </button>

          <button type="submit" className="btn sm" disabled={savingOffer}>
            {savingOffer ? 'Publishing Offer…' : 'Save & Publish Delivery Offer'}
          </button>
        </div>
      </form>
    </div>
  );
}
