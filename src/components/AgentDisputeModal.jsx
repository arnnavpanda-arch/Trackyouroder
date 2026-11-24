import { useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

export default function AgentDisputeModal({ order, isOpen, onClose, onDone }) {
  const { toast } = useApp();
  const [updatedAmount, setUpdatedAmount] = useState(() => order?.deliveryFee || 30);
  const [reason, setReason] = useState('Payment could not be verified from UTR statement. Please pay updated amount.');
  const [busy, setBusy] = useState(false);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = Number(updatedAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast('Please enter a valid amount in rupees', 'error');
      return;
    }

    setBusy(true);
    try {
      await api.verifyPayment(order.id, false, {
        updatedAmount: amt,
        reason,
      });
      toast(`Order #${order.id} marked Not Verified. Fee updated to ₹${amt}.`, 'success');
      if (onDone) onDone();
      onClose();
    } catch (err) {
      toast(err.message || 'Failed to update verification', 'error');
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
          <div style={{ fontSize: 36, marginBottom: 4 }}>⚠️</div>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: '#991b1b', margin: '4px 0' }}>
            Dispute Payment & Change Rupees
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Order <b>#{order.id}</b> · Customer: <b>{order.userName || 'Customer'}</b>
          </p>
        </div>

        {/* Existing UTR Info Box */}
        <div
          style={{
            background: '#fef2f2',
            border: '1.5px solid #fecaca',
            borderRadius: 12,
            padding: '12px 14px',
            fontSize: 12.5,
            color: '#7f1d1d',
            lineHeight: 1.8,
            marginBottom: 16,
          }}
        >
          <div><b>Submitted UTR:</b> <code style={{ background: '#fee2e2', padding: '1px 6px', borderRadius: 4 }}>{order.utrId || order.txnId || 'Not provided'}</code></div>
          <div><b>Account Holder:</b> {order.accountHolderName || order.payerName || 'N/A'}</div>
          <div><b>Original Fee:</b> ₹{order.deliveryFee || 30}</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Update Rupees / New Amount Due (₹) *
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={updatedAmount}
              onChange={(e) => setUpdatedAmount(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: '2px solid #fca5a5',
                fontSize: 20,
                fontWeight: 800,
                color: '#991b1b',
                boxSizing: 'border-box',
              }}
              required
            />
            <small style={{ color: '#64748b', fontSize: 11, marginTop: 4, display: 'block' }}>
              The customer will be notified to pay this updated amount again.
            </small>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Reason / Discrepancy Note *
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. UTR reference not found in bank statement, amount mismatch"
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
              className="btn danger"
              style={{ fontWeight: 800 }}
              disabled={busy}
            >
              {busy ? 'Updating…' : 'Update & Dispute'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
