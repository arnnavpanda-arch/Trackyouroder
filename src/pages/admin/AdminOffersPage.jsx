import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { PageHead, Spinner, ErrorBox } from '../../components/UI';
import { DEFAULT_PRICING, getPricing } from '../../utils/helpers';
import AdminOfferEditor from '../../components/AdminOfferEditor';

export default function AdminOffersPage() {
  const { toast } = useApp() || {};
  const [pricing, setPricing] = useState(() => getPricing());
  const [loading, setLoading] = useState(true);
  const [savingPricing, setSavingPricing] = useState(false);

  const loadPricing = () => {
    setLoading(true);
    api.getPricing()
      .then((data) => {
        if (data) setPricing(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPricing();
  }, []);

  const handlePricingFieldChange = (field, val) => {
    setPricing((prev) => ({
      ...prev,
      [field]: val === '' ? '' : val,
    }));
  };

  const handleSavePricing = async (e) => {
    e.preventDefault();
    setSavingPricing(true);
    try {
      const sanitized = {
        ...pricing,
        base_distance_km: Math.max(0.5, Number(pricing.base_distance_km) || 5),
        min_distance_fee: Math.max(0, Number(pricing.min_distance_fee) || 50),
        extra_per_km: Math.max(0, Number(pricing.extra_per_km) || 12),
        cancellation_fee: Math.max(0, Number(pricing.cancellation_fee) || 30),
      };
      await api.savePricing(sanitized);
      setPricing(sanitized);
      toast('Delivery distance rates & cancellation fee saved successfully!', 'success');
    } catch (err) {
      toast(err.message || 'Failed to save pricing', 'error');
    } finally {
      setSavingPricing(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHead
        title="Delivery Offers & Pricing Management"
        sub="Configure promotional zero-fee offers, timed flash sales, and standard road distance rates"
      />

      {/* Main Delivery Offers Editor Card */}
      <AdminOfferEditor onOfferSaved={loadPricing} />

      {/* Distance Boundary & Extra Distance Rates Card */}
      <div className="card admin-pricing-card" style={{ marginBottom: 22, borderRadius: 16, border: '2px solid #93c5fd', boxShadow: '0 4px 18px rgba(37, 99, 235, 0.08)' }}>
        <div className="admin-pricing-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 16, marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.4rem' }}>⚡</span>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                Standard Delivery Distance Boundary & Fee Rates
              </h3>
            </div>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
              Applied to customer shipments based on road transit distance when no promotional offer is active.
            </p>
          </div>
          <button
            type="button"
            className="btn sm ghost"
            onClick={async () => {
              setPricing(DEFAULT_PRICING);
              await api.savePricing(DEFAULT_PRICING);
              toast('Reset fee rates to defaults', 'info');
            }}
          >
            Reset Defaults
          </button>
        </div>

        <form onSubmit={handleSavePricing} className="admin-pricing-form">
          <div className="admin-pricing-grid">
            <div className="pricing-field-box" style={{ background: '#ffffff', borderColor: '#3b82f6' }}>
              <label style={{ color: '#1e40af', fontWeight: 800 }}>Minimum Base Distance (km)</label>
              <div className="input-prefix-wrap">
                <span className="input-prefix" style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 800, padding: '2px 6px', borderRadius: 4, zIndex: 1, pointerEvents: 'none' }}>km</span>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={pricing?.base_distance_km !== undefined && pricing?.base_distance_km !== null ? pricing.base_distance_km : 5}
                  onChange={(e) => handlePricingFieldChange('base_distance_km', e.target.value)}
                  style={{ paddingLeft: 48, fontWeight: 800, fontSize: '1.05rem' }}
                  required
                />
              </div>
              <span className="pricing-hint">Base boundary covered under minimum fee (e.g. 5 km)</span>
            </div>

            <div className="pricing-field-box" style={{ background: '#ffffff', borderColor: '#10b981' }}>
              <label style={{ color: '#065f46', fontWeight: 800 }}>Minimum Distance Delivery Fee</label>
              <div className="input-prefix-wrap">
                <span className="input-prefix" style={{ background: '#ecfdf5', color: '#059669', fontWeight: 800, padding: '2px 6px', borderRadius: 4, zIndex: 1, pointerEvents: 'none' }}>₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pricing?.min_distance_fee !== undefined && pricing?.min_distance_fee !== null ? pricing.min_distance_fee : 50}
                  onChange={(e) => handlePricingFieldChange('min_distance_fee', e.target.value)}
                  style={{ paddingLeft: 34, fontWeight: 800, fontSize: '1.05rem' }}
                  required
                />
              </div>
              <span className="pricing-hint">Flat delivery fee for any trip within base distance</span>
            </div>

            <div className="pricing-field-box" style={{ background: '#ffffff', borderColor: '#f59e0b' }}>
              <label style={{ color: '#92400e', fontWeight: 800 }}>Extra Distance Rate (₹ / km)</label>
              <div className="input-prefix-wrap">
                <span className="input-prefix" style={{ background: '#fffbeb', color: '#d97706', fontWeight: 800, padding: '2px 6px', borderRadius: 4, zIndex: 1, pointerEvents: 'none' }}>₹/km</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={pricing?.extra_per_km !== undefined && pricing?.extra_per_km !== null ? pricing.extra_per_km : 12}
                  onChange={(e) => handlePricingFieldChange('extra_per_km', e.target.value)}
                  style={{ paddingLeft: 64, fontWeight: 800, fontSize: '1.05rem' }}
                  required
                />
              </div>
              <span className="pricing-hint">Charged per extra km exceeding the base boundary</span>
            </div>

            <div className="pricing-field-box alert-box" style={{ background: '#ffffff', borderColor: '#fca5a5' }}>
              <label style={{ color: '#b91c1c', fontWeight: 800 }}>Order Cancellation Fee</label>
              <div className="input-prefix-wrap">
                <span className="input-prefix" style={{ background: '#fef2f2', color: '#dc2626', fontWeight: 800, padding: '2px 6px', borderRadius: 4, zIndex: 1, pointerEvents: 'none' }}>₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pricing?.cancellation_fee !== undefined && pricing?.cancellation_fee !== null ? pricing.cancellation_fee : 30}
                  onChange={(e) => handlePricingFieldChange('cancellation_fee', e.target.value)}
                  style={{ paddingLeft: 34, fontWeight: 800, fontSize: '1.05rem' }}
                  required
                />
              </div>
              <span className="pricing-hint">Charged if customer cancels unverified order</span>
            </div>
          </div>

          <div className="admin-pricing-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <button type="submit" className="btn sm" disabled={savingPricing} style={{ padding: '10px 24px', fontWeight: 800 }}>
              {savingPricing ? 'Saving Rates…' : 'Save Pricing Rates'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
