import { useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

export default function AddItemValueModal({ order, isOpen, onClose, onDone }) {
  const { toast } = useApp();
  const [itemValue, setItemValue] = useState(() => order?.itemValue || '');
  const [itemDesc, setItemDesc] = useState(() => order?.itemDesc || order?.pkg?.type || '');
  const [busy, setBusy] = useState(false);

  if (!isOpen || !order) return null;

  const deliveryFee = Number(order.deliveryFee) || 30;
  const numVal = Number(itemValue) || 0;
  const total = deliveryFee + numVal;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (numVal < 0) {
      toast('Please enter a valid item value', 'error');
      return;
    }

    setBusy(true);
    try {
      await api.updateItemValue(order.id, {
        itemValue: numVal,
        itemDesc,
      });
      toast(`Item value of ₹${numVal} added! Total Bill: ₹${total}. Updated bill & invoice PDF sent to customer email.`, 'success');
      if (onDone) onDone();
      onClose();
    } catch (err) {
      toast(err.message || 'Failed to update item value', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gateway-backdrop" onClick={onClose}>
      <div
        className="gateway-container"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440, padding: '28px 24px' }}
      >
        <button
          type="button"
          className="gateway-close-btn"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 4 }}>📦</div>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: '#1e1b4b', margin: '4px 0' }}>
            Add Ordered Item Value
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Order <b>#{order.id}</b> · Cash on Delivery (COD)
          </p>
        </div>

        {/* Live Calculation Preview */}
        <div
          style={{
            background: '#faf5ff',
            border: '1.5px solid #d8b4fe',
            borderRadius: 14,
            padding: '14px 16px',
            textAlign: 'center',
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: '#6b21a8' }}>
            Total COD Collection Preview
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#581c87', margin: '4px 0' }}>
            ₹{Number(total).toFixed(2)}
          </div>
          <div style={{ fontSize: 12, color: '#7e22ce', display: 'flex', justifyContent: 'center', gap: 10 }}>
            <span>Item Value: <b>₹{numVal}</b></span>
            <span>+</span>
            <span>Delivery Fee: <b>₹{deliveryFee}</b></span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Ordered Item Value / Price (₹) *
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={itemValue}
              onChange={(e) => setItemValue(e.target.value)}
              placeholder="e.g. 250"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: '2px solid #c084fc',
                fontSize: 20,
                fontWeight: 800,
                color: '#581c87',
                boxSizing: 'border-box',
              }}
              required
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              What was ordered / Description *
            </label>
            <input
              type="text"
              value={itemDesc}
              onChange={(e) => setItemDesc(e.target.value)}
              placeholder="e.g. Medicine box, 2 shirts, Electronics accessory"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1.5px solid #cbd5e1',
                fontSize: 13,
                boxSizing: 'border-box',
              }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              type="button"
              className="btn ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              style={{ background: '#5f259f', color: '#fff', fontWeight: 800 }}
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Save Item Value'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
