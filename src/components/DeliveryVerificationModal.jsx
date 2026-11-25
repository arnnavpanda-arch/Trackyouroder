import { useState } from 'react';
import Modal from './Modal';
import { api } from '../services/api';

export default function DeliveryVerificationModal({ order, onClose, onSuccess, toast }) {
  const fee = order.deliveryFee || 30;
  const itemVal = order.itemValue || 0;
  const totalDue = order.totalPayable || (fee + itemVal);

  const isPrepaid =
    order.itemPaid ||
    order.paymentMethod === 'prepaid' ||
    (Boolean(order.utrId) && order.paymentMethod !== 'cod' && order.paymentStatus === 'verified');
  const isCOD = !isPrepaid || order.paymentMethod === 'cod' || (order.itemValue > 0 && !order.itemPaid);
  const needsCash = isCOD && !order.cashCollected && order.paymentStatus !== 'verified';

  const [cashVerified, setCashVerified] = useState(!needsCash);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleVerifyCash = () => {
    setCashVerified(true);
    setErrorMsg('');
    if (toast) {
      toast(`Cash collection of ₹${totalDue} verified! Now enter customer OTP.`, 'success');
    }
  };

  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp) {
      setErrorMsg('Please enter the 4-digit delivery OTP.');
      return;
    }
    if (cleanOtp.length < 4) {
      setErrorMsg('OTP must be a 4-digit number.');
      return;
    }

    setBusy(true);
    setErrorMsg('');
    try {
      await api.deliverWithOtp(order.id, {
        otp: cleanOtp,
        cashCollected: cashVerified || !needsCash,
      });
      if (toast) {
        toast(`🎉 Order #${order.id} verified with OTP and successfully Delivered!`, 'success');
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Invalid Delivery OTP! Please check with customer.');
      setBusy(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={`Deliver Order #${order.id}`}>
      <div className="delivery-verification-modal-content" style={{ padding: '4px 0' }}>
        {/* Step Indicator */}
        {needsCash && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <div
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                background: !cashVerified ? '#fef3c7' : '#ecfdf5',
                border: `1.5px solid ${!cashVerified ? '#f59e0b' : '#10b981'}`,
                color: !cashVerified ? '#b45309' : '#047857',
                fontSize: 12,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{cashVerified ? '✓' : '1'}</span>
              <span>1. Cash Collection</span>
            </div>
            <div
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                background: cashVerified ? '#eff6ff' : '#f1f5f9',
                border: `1.5px solid ${cashVerified ? '#3b82f6' : '#cbd5e1'}`,
                color: cashVerified ? '#1d4ed8' : '#64748b',
                fontSize: 12,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>2</span>
              <span>2. Customer OTP</span>
            </div>
          </div>
        )}

        {/* STEP 1: CASH COLLECTION IF COD */}
        {needsCash && !cashVerified && (
          <div
            style={{
              background: '#fffbeb',
              border: '2px solid #fde68a',
              borderRadius: 14,
              padding: '20px 18px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>💵</div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#92400e', margin: '0 0 6px' }}>
              Step 1: Collect Cash on Delivery
            </h3>
            <p style={{ fontSize: 13, color: '#78350f', margin: '0 0 16px' }}>
              This parcel has cash due. Please collect and verify payment from <strong>{order.userName}</strong>.
            </p>

            <div
              style={{
                background: '#ffffff',
                border: '1.5px solid #fef3c7',
                borderRadius: 10,
                padding: '14px 16px',
                maxWidth: 340,
                margin: '0 auto 20px',
                textAlign: 'left',
                fontSize: 13,
                color: '#334155',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>Delivery Fee:</span>
                <b>₹{fee}</b>
              </div>
              {itemVal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span>Item Value (COD):</span>
                  <b>₹{itemVal}</b>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: 8,
                  borderTop: '1px dashed #cbd5e1',
                  fontSize: 16,
                  fontWeight: 900,
                  color: '#b45309',
                }}
              >
                <span>Total Cash Due:</span>
                <span>₹{totalDue}</span>
              </div>
            </div>

            <button
              type="button"
              className="btn block big"
              style={{
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                color: '#fff',
                fontWeight: 900,
                fontSize: 15,
                border: 'none',
                cursor: 'pointer',
                borderRadius: 10,
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
              }}
              onClick={handleVerifyCash}
            >
              ✓ Cash Received & Verified (₹{totalDue})
            </button>
          </div>
        )}

        {/* STEP 2: CUSTOMER DELIVERY OTP */}
        {(cashVerified || !needsCash) && (
          <form onSubmit={handleVerifyOtpSubmit} style={{ marginTop: 4 }}>
            {needsCash && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#166534',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 700,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>✓</span>
                <span>Cash Collection Verified: ₹{totalDue}</span>
              </div>
            )}

            {!needsCash && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#166534',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 700,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>✓</span>
                <span>Prepaid Order — Delivery Fee / Item Already Paid</span>
              </div>
            )}

            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔐</div>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>
                Enter Customer Delivery OTP
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 auto', maxWidth: 380, lineHeight: 1.5 }}>
                Ask customer <strong>{order.userName}</strong> for the 4-digit verification code shown on their tracking screen.
              </p>
            </div>

            {errorMsg && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1.5px solid #fecaca',
                  borderRadius: 8,
                  color: '#dc2626',
                  padding: '10px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 16,
                  textAlign: 'center',
                }}
              >
                ⚠️ {errorMsg}
              </div>
            )}

            <div style={{ maxWidth: 240, margin: '0 auto 20px', textAlign: 'center' }}>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                maxLength={4}
                autoFocus
                style={{
                  width: '100%',
                  fontSize: 32,
                  fontWeight: 900,
                  letterSpacing: '0.4em',
                  textAlign: 'center',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '2px solid #3b82f6',
                  background: '#f8fafc',
                  fontFamily: 'monospace',
                  outline: 'none',
                  boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.1)',
                }}
              />
              <small style={{ color: '#94a3b8', fontSize: 11, display: 'block', marginTop: 6 }}>
                4-Digit Numeric Customer OTP
              </small>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn ghost sm"
                onClick={onClose}
                disabled={busy}
                style={{ padding: '10px 16px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn sm"
                disabled={busy || otp.trim().length < 4}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  padding: '10px 22px',
                  fontWeight: 800,
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                }}
              >
                {busy ? 'Verifying OTP…' : '🚀 Verify OTP & Deliver Parcel'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
