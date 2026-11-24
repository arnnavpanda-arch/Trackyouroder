import { useState } from 'react';
import { QRCodeView } from './CodeViews';
import PaymentGatewayModal from './PaymentGatewayModal';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

export default function AgentQRModal({ order, isOpen, onClose, onPaymentReceived }) {
  const { toast } = useApp();
  const [showDemoPhonePe, setShowDemoPhonePe] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paying, setPaying] = useState(false);

  if (!isOpen || !order) return null;

  const deliveryFee = Number(order.deliveryFee) || 30;
  const itemValue = Number(order.itemValue) || 0;
  const totalAmount = order.totalPayable || (deliveryFee + itemValue);
  const payUrl = `${window.location.origin}/pay/demo?orderId=${order.id}&amount=${totalAmount}&customer=${encodeURIComponent(order.userName || 'Customer')}`;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(payUrl);
    setCopied(true);
    toast('Payment link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePaymentSuccess = async (paymentData) => {
    setPaying(true);
    try {
      await api.collectPickupPayment(order.id, {
        txnId: paymentData.txnId || `PP${Date.now()}`,
        method: 'PhonePe UPI (QR Code)',
        amount: totalAmount,
      });
      toast(`✓ Total payment of ₹${totalAmount} received from customer via PhonePe QR!`, 'success');
      setShowDemoPhonePe(false);
      if (onPaymentReceived) onPaymentReceived(order.id);
      onClose();
    } catch (err) {
      toast(err.message || 'Failed to update payment status', 'error');
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <div className="gateway-backdrop" onClick={onClose}>
        <div
          className="gateway-container agent-qr-modal"
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

          {/* Modal Header */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <img
              src="/phonepe.svg"
              alt="PhonePe Logo"
              style={{ width: 140, height: 42, objectFit: 'contain', margin: '0 auto 8px' }}
            />
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e1b4b', margin: '4px 0' }}>
              Scan & Pay with PhonePe
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Dynamic COD Collection QR for <b>Order #{order.id}</b>
            </p>
          </div>

          {/* Amount Badge with Itemized Breakdown */}
          <div
            style={{
              background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
              border: '1.5px solid #d8b4fe',
              borderRadius: 14,
              padding: '12px 16px',
              textAlign: 'center',
              marginBottom: 18,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: '#6b21a8' }}>
              Total COD Amount Due
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#581c87', margin: '2px 0' }}>
              ₹{Number(totalAmount).toFixed(2)}
            </div>
            {itemValue > 0 ? (
              <div style={{ fontSize: 12, color: '#7e22ce', display: 'flex', justifyContent: 'center', gap: 10, marginTop: 4 }}>
                <span>Item Value: <b>₹{itemValue}</b></span>
                <span>+</span>
                <span>Delivery: <b>₹{deliveryFee}</b></span>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#7e22ce' }}>
                Delivery Fee: <b>₹{deliveryFee}</b>
              </div>
            )}
            <div style={{ fontSize: 11.5, color: '#6b21a8', marginTop: 4 }}>
              Customer: <b>{order.userName || 'Customer'}</b> · {order.itemDesc || order.pkg?.type || 'Package'}
            </div>
          </div>

          {/* Dynamic SVG QR Code */}
          <div style={{ textAlign: 'center', margin: '14px 0' }}>
            <QRCodeView value={payUrl} size={210} logoSize={38} />
            <p style={{ fontSize: 12, color: '#475569', marginTop: 10, fontWeight: 600 }}>
              📲 Customer scans with PhonePe or any UPI app to pay ₹{Number(totalAmount).toFixed(2)}
            </p>
          </div>

          {/* Actions: Simulate Scan & Copy Link */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className="btn"
              style={{
                background: '#5f259f',
                color: '#fff',
                fontWeight: 800,
                fontSize: 14,
                padding: '12px 16px',
                borderRadius: 12,
                boxShadow: '0 4px 14px rgba(95, 37, 159, 0.4)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              onClick={() => setShowDemoPhonePe(true)}
            >
              <span>📱</span> Simulate Customer Scan & Pay
            </button>

            <button
              type="button"
              className="btn ghost"
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                padding: '9px 14px',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              onClick={handleCopyLink}
            >
              <span>{copied ? '✓' : '📋'}</span> {copied ? 'Link Copied!' : 'Copy Payment Link'}
            </button>
          </div>

          <div
            style={{
              textAlign: 'center',
              marginTop: 14,
              fontSize: 11,
              color: '#94a3b8',
            }}
          >
            🔒 Live UPI Demo Gateway · Auto-syncs delivery status once paid
          </div>
        </div>
      </div>

      {/* Simulated Customer PhonePe Payment Gateway Modal */}
      {showDemoPhonePe && (
        <PaymentGatewayModal
          isOpen={showDemoPhonePe}
          amount={totalAmount}
          method="upi_phonepe"
          purpose={`COD Total Collection - Order #${order.id}`}
          title="PhonePe Payment"
          subtitle={`Paying ₹${totalAmount} to Trackora Delivery Agent`}
          userName={order.userName || 'Customer'}
          onClose={() => setShowDemoPhonePe(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
}
