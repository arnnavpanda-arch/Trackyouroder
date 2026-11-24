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

  const handleSavePricing = async (e) => {
    e.preventDefault();
    setSavingPricing(true);
    try {
      await api.savePricing(pricing);
      toast('Delivery & cancellation fee rates saved successfully!', 'success');
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
        sub="Configure promotional zero-fee offers, timed flash sales, and standard weight bracket rates"
      />

      {/* Main Delivery Offers Editor Card */}
      <AdminOfferEditor onOfferSaved={loadPricing} />

      {/* Standard Weight Rates & Cancellation Fee Card */}
      <div className="card admin-pricing-card" style={{ marginBottom: 22 }}>
        <div className="admin-pricing-header">
          <div>
            <h3>Standard Delivery & Cancellation Fee Pricing</h3>
            <p>Applied to customer shipments when no promotional offer is active or qualifying.</p>
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
            <div className="pricing-field-box">
              <label>Under 1 kg Fee</label>
              <div className="input-prefix-wrap">
                <span className="input-prefix">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pricing.under_1kg}
                  onChange={(e) => setPricing((p) => ({ ...p, under_1kg: Math.max(0, Number(e.target.value) || 0) }))}
                  required
                />
              </div>
              <span className="pricing-hint">Small parcels / pouches (&lt; 1 kg)</span>
            </div>

            <div className="pricing-field-box">
              <label>1 kg to 5 kg Fee</label>
              <div className="input-prefix-wrap">
                <span className="input-prefix">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pricing.tier_1_to_5kg}
                  onChange={(e) => setPricing((p) => ({ ...p, tier_1_to_5kg: Math.max(0, Number(e.target.value) || 0) }))}
                  required
                />
              </div>
              <span className="pricing-hint">Medium cartons (1 kg - 5 kg)</span>
            </div>

            <div className="pricing-field-box">
              <label>5 kg+ Heavy Parcel Fee</label>
              <div className="input-prefix-wrap">
                <span className="input-prefix">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pricing.tier_above_5kg}
                  onChange={(e) => setPricing((p) => ({ ...p, tier_above_5kg: Math.max(0, Number(e.target.value) || 0) }))}
                  required
                />
              </div>
              <span className="pricing-hint">Heavy / bulk cargo (&gt; 5 kg)</span>
            </div>

            <div className="pricing-field-box alert-box">
              <label>Order Cancellation Fee</label>
              <div className="input-prefix-wrap">
                <span className="input-prefix">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pricing.cancellation_fee}
                  onChange={(e) => setPricing((p) => ({ ...p, cancellation_fee: Math.max(0, Number(e.target.value) || 0) }))}
                  required
                />
              </div>
              <span className="pricing-hint">Charged if customer cancels unverified order</span>
            </div>
          </div>

          <div className="admin-pricing-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button type="submit" className="btn sm" disabled={savingPricing}>
              {savingPricing ? 'Saving Rates…' : 'Save Pricing Rates'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
