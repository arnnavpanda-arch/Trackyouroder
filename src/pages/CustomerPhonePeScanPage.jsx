import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';

export default function CustomerPhonePeScanPage() {
  const [params] = useSearchParams();
  const orderId = params.get('orderId') || 'DL1001';
  const initialAmount = Number(params.get('amount')) || 30;
  const customerName = params.get('customer') || 'Customer';

  const [screen, setScreen] = useState('entry'); // 'entry' | 'processing' | 'verifying' | 'success'
  const [amount, setAmount] = useState(initialAmount);
  const [txnId, setTxnId] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const formattedAmount = `₹${Number(amount).toFixed(2)}`;

  const playPaymentSound = () => {
    try {
      const audio = document.getElementById('scanPaymentSound');
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } catch (e) {
      // Audio playback fallback
    }
  };

  const handleStartPayment = () => {
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    // Step 1: Processing
    setScreen('processing');

    // Step 2: Payment Confirmation after 2.5s
    setTimeout(() => {
      setScreen('verifying');

      // Step 3: Success after 3.2s
      setTimeout(async () => {
        const generatedTxn = `PP${Date.now().toString().slice(-8)}`;
        const now = new Date().toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        setTxnId(generatedTxn);
        setDateStr(now);
        setScreen('success');

        playPaymentSound();

        // Update order status in system
        setIsUpdating(true);
        try {
          await api.collectPickupPayment(orderId, {
            txnId: generatedTxn,
            amount,
            method: 'PhonePe UPI (QR Code)',
          });
        } catch (err) {
          console.error('Failed to auto-update order payment:', err);
        } finally {
          setIsUpdating(false);
        }
      }, 3200);
    }, 2500);
  };

  return (
    <div
      style={{
        background: '#f5f2fa',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <audio id="scanPaymentSound" preload="auto">
        <source src="/payment-success.mp3" type="audio/mpeg" />
        <source src="/payment-success.wav" type="audio/wav" />
      </audio>

      <div
        style={{
          background: '#ffffff',
          width: 400,
          maxWidth: '100%',
          padding: '34px 26px',
          borderRadius: 24,
          textAlign: 'center',
          boxShadow: '0 12px 40px rgba(95, 37, 159, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)',
          position: 'relative',
        }}
      >
        {/* STEP 1: ENTRY */}
        {screen === 'entry' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <img
                src="/phonepe.svg"
                alt="PhonePe Logo"
                style={{ width: 165, height: 50, objectFit: 'contain' }}
              />
            </div>

            <div
              style={{
                display: 'inline-block',
                background: '#f3e8ff',
                color: '#7e22ce',
                fontSize: 12,
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: 20,
                marginBottom: 12,
              }}
            >
              Order #{orderId} · Delivery Fee (COD)
            </div>

            <h2 style={{ color: '#1e1b4b', fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
              Make Payment
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
              Paying to Trackora Delivery Agent
            </p>

            <div style={{ position: 'relative', margin: '20px 0' }}>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                readOnly
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: 32,
                  fontWeight: 800,
                  textAlign: 'center',
                  border: '2px solid #e9d5ff',
                  borderRadius: 14,
                  outline: 'none',
                  color: '#581c87',
                  background: '#faf5ff',
                  boxSizing: 'border-box',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: 20,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 26,
                  fontWeight: 800,
                  color: '#7e22ce',
                }}
              >
                ₹
              </span>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '12px 14px',
                textAlign: 'left',
                fontSize: 12.5,
                lineHeight: 1.8,
                color: '#475569',
                marginBottom: 20,
              }}
            >
              <div>👤 Customer: <b>{customerName}</b></div>
              <div>📦 Shipment: <b>Trackora Express Delivery</b></div>
              <div>⚡ Method: <b>Instant UPI Transfer</b></div>
            </div>

            <button
              type="button"
              onClick={handleStartPayment}
              style={{
                width: '100%',
                padding: 16,
                background: '#5f259f',
                color: '#ffffff',
                fontSize: 16,
                fontWeight: 800,
                border: 'none',
                borderRadius: 14,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(95, 37, 159, 0.4)',
                letterSpacing: 0.3,
              }}
            >
              Pay Now · {formattedAmount}
            </button>

            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 18 }}>
              🔒 256-Bit Encrypted · PhonePe Payment Interface Demo
            </div>
          </div>
        )}

        {/* STEP 2: PROCESSING */}
        {screen === 'processing' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <img
                src="/phonepe.svg"
                alt="PhonePe Logo"
                style={{ width: 155, height: 46, objectFit: 'contain' }}
              />
            </div>

            <div className="loader" />

            <h2 style={{ color: '#1e1b4b', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              Processing Payment
            </h2>

            <div style={{ fontSize: 32, fontWeight: 800, color: '#222', margin: '14px 0' }}>
              {formattedAmount}
            </div>

            <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
              Please wait while your payment is being processed.
            </p>
            <p style={{ color: '#64748b', fontSize: 13, fontWeight: 600, marginTop: 6 }}>
              Do not close this window.
            </p>
          </div>
        )}

        {/* STEP 3: PAYMENT CONFIRMATION */}
        {screen === 'verifying' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <img
                src="/phonepe.svg"
                alt="PhonePe Logo"
                style={{ width: 155, height: 46, objectFit: 'contain' }}
              />
            </div>

            <h2 style={{ color: '#1e1b4b', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              Almost There!
            </h2>

            <div style={{ fontSize: 32, fontWeight: 800, color: '#222', margin: '14px 0' }}>
              {formattedAmount}
            </div>

            <div className="confirm-track">
              <div className="confirm-ball" />
            </div>

            <h3 className="confirm-title">PAYMENT CONFIRMATION</h3>

            <p style={{ color: '#64748b', fontSize: 13, marginTop: 15, lineHeight: 1.6 }}>
              Please wait while we confirm your transaction with bank.
            </p>
            <p style={{ color: '#64748b', fontSize: 13, fontWeight: 600, marginTop: 6 }}>
              Do not close this window.
            </p>
          </div>
        )}

        {/* STEP 4: SUCCESS */}
        {screen === 'success' && (
          <div>
            <div className="success-circle">✓</div>

            <h2 className="green" style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
              Payment Successful!
            </h2>

            <div style={{ fontSize: 32, fontWeight: 800, color: '#16a34a', margin: '14px 0' }}>
              {formattedAmount}
            </div>

            <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
              Your delivery fee has been received successfully.
            </p>

            <div className="details" style={{ margin: '20px 0', textAlign: 'left' }}>
              <div>Transaction ID: <b style={{ color: '#1e1b4b' }}>{txnId}</b></div>
              <div>Order ID: <b>#{orderId}</b></div>
              <div>
                Payment Status: <span className="green" style={{ fontWeight: 800 }}>SUCCESS</span>
              </div>
              <div>Date: <b>{dateStr}</b></div>
            </div>

            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 12,
                color: '#15803d',
                fontWeight: 600,
                marginBottom: 16,
              }}
            >
              ✓ Agent dashboard automatically updated to Paid!
            </div>

            <button
              type="button"
              onClick={() => window.close ? window.close() : window.location.reload()}
              style={{
                width: '100%',
                padding: 14,
                background: '#16a34a',
                color: '#ffffff',
                fontSize: 15,
                fontWeight: 800,
                border: 'none',
                borderRadius: 12,
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
