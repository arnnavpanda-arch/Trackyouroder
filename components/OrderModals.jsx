import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import Modal from './Modal';
import { Spinner } from './UI';
import { QRCodeView } from './CodeViews';
import PaymentGatewayModal from './PaymentGatewayModal';

/**
 * Assign Agent Modal (Admin & Manager assignment)
 */
export function AssignAgentModal({ order, onClose, onDone }) {
  const { toast } = useApp();
  const [agents, setAgents] = useState(null);
  const [sel, setSel] = useState(order.agentId || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listUsers()
      .then((u) => setAgents(u.filter((x) => x.role === 'agent' && x.active)))
      .catch((e) => toast(e.message, 'error'));
  }, [toast]);

  const submit = async () => {
    setBusy(true);
    try {
      await api.assignAgent(order.id, sel);
      toast(`Agent assigned to ${order.id}`, 'success');
      onDone();
      onClose();
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Assign agent · ${order.id}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={!sel || busy} onClick={submit}>
            {busy ? 'Assigning…' : 'Assign agent'}
          </button>
        </>
      }
    >
      {!agents ? (
        <Spinner />
      ) : agents.length === 0 ? (
        <p>No active agents available.</p>
      ) : (
        <div className="pick">
          {agents.map((a) => (
            <label key={a.id} className={sel === a.id ? 'on' : ''}>
              <input type="radio" name="agent" checked={sel === a.id} onChange={() => setSel(a.id)} />
              <span className="avatar">{a.name[0]}</span>
              <div><b>{a.name}</b><small>{a.phone}</small></div>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

/**
 * Add Item Value Modal (Agent sets item price on pickup)
 */
export function AddItemValueModal({ order, isOpen, onClose, onDone }) {
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
      toast(`Item value of ₹${numVal} added! Total Bill: ₹${total}. Updated bill & invoice sent to customer.`, 'success');
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
      <div className="gateway-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <button type="button" className="gateway-close-btn" onClick={onClose} aria-label="Close">✕</button>

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>📦</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: 0 }}>
            Add Package Item Value
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            Set actual item cost for <b>Order #{order.id}</b>
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              Item Price / Value (₹) *
            </label>
            <input
              type="number"
              min="0"
              step="any"
              required
              placeholder="e.g. 500"
              value={itemValue}
              onChange={(e) => setItemValue(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 10,
                border: '1.5px solid #cbd5e1',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              Item Description / Name
            </label>
            <input
              type="text"
              placeholder="e.g. Medicine, Groceries, Documents"
              value={itemDesc}
              onChange={(e) => setItemDesc(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: 14,
                borderRadius: 10,
                border: '1.5px solid #cbd5e1',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
              <span>Item Value:</span>
              <b>₹{numVal}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
              <span>Delivery Fee:</span>
              <b>₹{deliveryFee}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, color: '#0f172a', borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
              <span>Total Bill for Customer:</span>
              <span style={{ color: '#059669' }}>₹{total}</span>
            </div>
          </div>

          <button
            type="submit"
            className="btn"
            disabled={busy}
            style={{
              padding: '12px 20px',
              fontWeight: 800,
              fontSize: 14,
              background: '#059669',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              marginTop: 6,
            }}
          >
            {busy ? 'Saving Bill…' : '✓ Update Bill & Generate Invoice'}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Agent Dispute Modal (Agent disputes invalid UTR or unverified payment)
 */
export function AgentDisputeModal({ order, isOpen, onClose, onDone }) {
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
      <div className="gateway-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <button type="button" className="gateway-close-btn" onClick={onClose} aria-label="Close">✕</button>

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#b91c1c', margin: 0 }}>
            Dispute / Reject UTR
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            Flag unverified payment for <b>Order #{order.id}</b>
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              Correct Amount Customer Must Pay (₹) *
            </label>
            <input
              type="number"
              min="1"
              required
              value={updatedAmount}
              onChange={(e) => setUpdatedAmount(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 10,
                border: '1.5px solid #cbd5e1',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              Dispute Reason / Explanation for Customer *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 13,
                borderRadius: 10,
                border: '1.5px solid #cbd5e1',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
          </div>

          <button
            type="submit"
            className="btn"
            disabled={busy}
            style={{
              padding: '12px 20px',
              fontWeight: 800,
              fontSize: 14,
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              marginTop: 6,
            }}
          >
            {busy ? 'Flagging Payment…' : '⚠️ Mark Not Verified & Request Payment'}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Agent QR Code Modal (Scan & Pay with PhonePe on pickup)
 */
export function AgentQRModal({ order, isOpen, onClose, onPaymentReceived }) {
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
          <button type="button" className="gateway-close-btn" onClick={onClose} aria-label="Close">✕</button>

          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <img src="/phonepe.svg" alt="PhonePe Logo" style={{ width: 140, height: 42, objectFit: 'contain', margin: '0 auto 8px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e1b4b', margin: '4px 0' }}>Scan & Pay with PhonePe</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Dynamic COD Collection QR for <b>Order #{order.id}</b></p>
          </div>

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

          <div style={{ textAlign: 'center', margin: '14px 0' }}>
            <QRCodeView value={payUrl} size={210} logoSize={38} />
            <p style={{ fontSize: 12, color: '#475569', marginTop: 10, fontWeight: 600 }}>
              📲 Customer scans with PhonePe or any UPI app to pay ₹{Number(totalAmount).toFixed(2)}
            </p>
          </div>

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

          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: '#94a3b8' }}>
            🔒 Live UPI Demo Gateway · Auto-syncs delivery status once paid
          </div>
        </div>
      </div>

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
