import { useEffect, useState } from 'react';

// Pure PhonePe-style instrumental notification chime (No spoken voice or words)
function playSyntheticPhonePeChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    // Signature 4-tone rapid ascending bell motif
    const tones = [
      { t: 0.00, f: 1174.66, a: 0.22, d: 0.25 }, // D6
      { t: 0.08, f: 1479.98, a: 0.26, d: 0.25 }, // F#6
      { t: 0.16, f: 1760.00, a: 0.30, d: 0.30 }, // A6
      { t: 0.24, f: 2349.32, a: 0.38, d: 0.85 }, // D7 (resonant chime ring)
    ];

    tones.forEach(({ t, f, a, d }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, ctx.currentTime + t);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(a, ctx.currentTime + t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + d);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + d + 0.05);
    });
  } catch (e) {
    console.error('Audio chime error:', e);
  }
}

function playPaymentSound() {
  try {
    const audio = document.getElementById('paymentSound');
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch((err) => {
        console.log('Audio element play blocked by browser, using synthesizer:', err);
        playSyntheticPhonePeChime();
      });
    } else {
      playSyntheticPhonePeChime();
    }
  } catch (err) {
    playSyntheticPhonePeChime();
  }
}

export default function PaymentGatewayModal({
  isOpen,
  amount,
  method = 'upi_phonepe',
  userName,
  purpose = 'Delivery Fee',
  title,
  subtitle,
  onClose,
  onSuccess,
}) {
  const [screen, setScreen] = useState('entry'); // 'entry' | 'processing' | 'verifying' | 'success'
  const [activeMethod, setActiveMethod] = useState(method); // 'upi_phonepe' | 'card'
  const [txnId, setTxnId] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [inputAmount, setInputAmount] = useState(amount || 30);
  const [cardNum, setCardNum] = useState('4242 •••• •••• 4242');
  const [cardExp, setCardExp] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('888');

  useEffect(() => {
    if (isOpen) {
      setScreen('entry');
      setActiveMethod(method === 'card' ? 'card' : 'upi_phonepe');
      setInputAmount(amount || 30);
      setTxnId('');
      setDateStr('');
    }
  }, [isOpen, amount, method]);

  if (!isOpen) return null;

  const isCancellation = purpose === 'Order Cancellation Fee';
  const isPhonePe = activeMethod === 'upi_phonepe';
  const formattedAmount = `₹${Number(inputAmount || amount).toFixed(2)}`;

  const handleStartPayment = () => {
    const amt = Number(inputAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    // Step 1: Processing
    setScreen('processing');

    // Step 2: Payment Confirmation after 2.5s
    setTimeout(() => {
      setScreen('verifying');

      // Step 3: Success after 3.2s
      setTimeout(() => {
        const prefix = isCancellation ? 'CAN' : (isPhonePe ? 'PP' : 'TXN');
        const generatedTxn = `${prefix}${Date.now().toString().slice(-8)}`;
        const now = new Date().toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        setTxnId(generatedTxn);
        setDateStr(now);
        setScreen('success');

        // Play the PhonePe payment success sound effect (pure instrumental chime)
        playPaymentSound();
      }, 3200);
    }, 2500);
  };

  const handleComplete = () => {
    onSuccess({
      txnId: txnId || `TXN${Date.now()}`,
      payerName: userName || 'Customer',
      amount: inputAmount,
      date: dateStr,
      method: isPhonePe ? 'PhonePe UPI' : 'Credit/Debit Card',
      purpose,
    });
  };

  return (
    <div className="gateway-backdrop" onClick={(e) => { if (screen === 'entry') onClose(); }}>
      <div className="gateway-container" onClick={(e) => e.stopPropagation()}>
        {screen === 'entry' && (
          <button
            type="button"
            className="gateway-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        )}

        {/* STEP 1: PAYMENT ENTRY */}
        {screen === 'entry' && (
          <div className="gateway-screen">
            {isCancellation && (
              <div className="gateway-cancel-badge">
                ⚠️ Mandatory Cancellation Fee · COD Not Available
              </div>
            )}

            {/* Method Toggle: PhonePe UPI vs Card (NO COD) */}
            <div className="gateway-method-tabs">
              <button
                type="button"
                className={`gateway-tab-btn ${isPhonePe ? 'active' : ''}`}
                onClick={() => setActiveMethod('upi_phonepe')}
              >
                <span>🟣</span> PhonePe UPI
              </button>
              <button
                type="button"
                className={`gateway-tab-btn ${!isPhonePe ? 'active' : ''}`}
                onClick={() => setActiveMethod('card')}
              >
                <span>💳</span> Debit / Credit Card
              </button>
            </div>

            <div className="gateway-logo">
              {isPhonePe ? (
                <img
                  src="/phonepe.svg"
                  alt="PhonePe Logo"
                  style={{ width: 170, height: 48, objectFit: 'contain' }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <img src="/visa.svg" alt="Visa" style={{ height: 26, objectFit: 'contain' }} />
                  <img src="/mastercard.svg" alt="Mastercard" style={{ height: 26, objectFit: 'contain' }} />
                  <img src="/rupay.svg" alt="RuPay" style={{ height: 26, objectFit: 'contain' }} />
                  <img src="/major-banks.svg" alt="All Major Banks" style={{ height: 26, objectFit: 'contain' }} />
                </div>
              )}
            </div>

            <h2 className="gateway-heading">
              {title || (isCancellation
                ? 'Pay Cancellation Fee'
                : (isPhonePe ? 'Make UPI Payment' : 'Pay via Card'))}
            </h2>
            <p className="gateway-sub">
              {subtitle || (isCancellation
                ? 'Mandatory cancellation fee to cancel shipment'
                : (isPhonePe ? 'Delivery fee payment via PhonePe UPI' : 'Secure debit / credit card payment (Visa, Mastercard, RuPay & All Banks)'))}
            </p>

            {isPhonePe ? (
              <div className="gateway-upi-box">
                <span className="gateway-upi-label">UPI ID / Mobile Number</span>
                <div className="gateway-upi-badge">
                  <span>9876543210@ybl</span>
                  <span className="gateway-upi-verified">✓ Verified</span>
                </div>
              </div>
            ) : (
              <div className="gateway-card-fields">
                <div className="gateway-field-row">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ margin: 0 }}>Card Number</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img src="/visa.svg" alt="Visa" style={{ height: 16, objectFit: 'contain' }} />
                      <img src="/mastercard.svg" alt="Mastercard" style={{ height: 16, objectFit: 'contain' }} />
                      <img src="/rupay.svg" alt="RuPay" style={{ height: 16, objectFit: 'contain' }} />
                      <img src="/major-banks.svg" alt="All Major Banks" style={{ height: 16, objectFit: 'contain' }} />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={cardNum}
                    onChange={(e) => setCardNum(e.target.value)}
                    placeholder="1234 5678 9012 3456"
                    className="gateway-card-input"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="gateway-field-row">
                    <label>Expiry</label>
                    <input
                      type="text"
                      value={cardExp}
                      onChange={(e) => setCardExp(e.target.value)}
                      placeholder="MM/YY"
                      className="gateway-card-input"
                    />
                  </div>
                  <div className="gateway-field-row">
                    <label>CVV</label>
                    <input
                      type="password"
                      maxLength={4}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      placeholder="•••"
                      className="gateway-card-input"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="gateway-amount-wrap">
              <span className="gateway-amount-lbl">
                {isCancellation ? 'Cancellation Fee Payable' : 'Delivery Fee Payable'}
              </span>
              <input
                type="number"
                className="gateway-amount-input"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                min="1"
                step="1"
                readOnly
              />
            </div>

            <button
              type="button"
              className={`gateway-pay-btn ${isPhonePe ? 'phonepe-btn' : 'card-btn'}`}
              onClick={handleStartPayment}
            >
              {isCancellation
                ? `Pay Fee ${formattedAmount} & Cancel Order`
                : `Pay Now · ${formattedAmount}`}
            </button>

            <div className="gateway-note">
              🔒 256-Bit Encrypted · Demo Payment Gateway
            </div>
          </div>
        )}

        {/* STEP 2: PROCESSING */}
        {screen === 'processing' && (
          <div className="gateway-screen">
            <div className="gateway-logo">
              {isPhonePe ? (
                <img
                  src="/phonepe.svg"
                  alt="PhonePe Logo"
                  style={{ width: 155, height: 42, objectFit: 'contain' }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <img src="/visa.svg" alt="Visa" style={{ height: 26, objectFit: 'contain' }} />
                  <img src="/mastercard.svg" alt="Mastercard" style={{ height: 26, objectFit: 'contain' }} />
                  <img src="/rupay.svg" alt="RuPay" style={{ height: 26, objectFit: 'contain' }} />
                  <img src="/major-banks.svg" alt="All Major Banks" style={{ height: 26, objectFit: 'contain' }} />
                </div>
              )}
            </div>

            <div className="loader" />

            <h2 className="gateway-heading">Processing Payment</h2>
            <div className="gateway-amount-big">{formattedAmount}</div>
            <p className="gateway-sub">
              {isCancellation
                ? 'Processing cancellation fee payment...'
                : 'Please wait while your payment is being processed.'}
            </p>
            <p className="gateway-sub" style={{ marginTop: 6, fontWeight: 600 }}>Do not close this window.</p>
          </div>
        )}

        {/* STEP 3: PAYMENT CONFIRMATION */}
        {screen === 'verifying' && (
          <div className="gateway-screen">
            <div className="gateway-logo">
              {isPhonePe ? (
                <img
                  src="/phonepe.svg"
                  alt="PhonePe Logo"
                  style={{ width: 155, height: 42, objectFit: 'contain' }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <img src="/visa.svg" alt="Visa" style={{ height: 26, objectFit: 'contain' }} />
                  <img src="/mastercard.svg" alt="Mastercard" style={{ height: 26, objectFit: 'contain' }} />
                  <img src="/rupay.svg" alt="RuPay" style={{ height: 26, objectFit: 'contain' }} />
                  <img src="/major-banks.svg" alt="All Major Banks" style={{ height: 26, objectFit: 'contain' }} />
                </div>
              )}
            </div>

            <h2 className="gateway-heading">Almost There!</h2>
            <div className="gateway-amount-big">{formattedAmount}</div>

            <div className="confirm-track">
              <div className="confirm-ball" />
            </div>

            <h3 className="confirm-title">PAYMENT CONFIRMATION</h3>
            <p className="gateway-sub" style={{ marginTop: 15 }}>
              Please wait while we confirm your transaction.
            </p>
            <p className="gateway-sub" style={{ marginTop: 6, fontWeight: 600 }}>
              Do not close this window.
            </p>
          </div>
        )}

        {/* STEP 4: SUCCESS */}
        {screen === 'success' && (
          <div className="gateway-screen">
            <div className="success-circle">✓</div>
            <h2 className="gateway-heading green" style={{ color: '#16a34a' }}>
              Payment Successful!
            </h2>
            <div className="gateway-amount-big">{formattedAmount}</div>
            <p className="gateway-sub">
              {isCancellation
                ? 'Cancellation fee payment completed successfully.'
                : 'Your delivery fee has been completed successfully.'}
            </p>

            <div className="gateway-details-box">
              <div className="gateway-detail-row">
                <span>Transaction ID:</span>
                <b>{txnId}</b>
              </div>
              <div className="gateway-detail-row">
                <span>Payment Method:</span>
                <b>{isPhonePe ? 'PhonePe UPI' : 'Debit/Credit Card'}</b>
              </div>
              <div className="gateway-detail-row">
                <span>Purpose:</span>
                <b>{purpose}</b>
              </div>
              <div className="gateway-detail-row">
                <span>Payment Status:</span>
                <span className="green" style={{ color: '#16a34a', fontWeight: 800 }}>SUCCESS</span>
              </div>
              <div className="gateway-detail-row">
                <span>Date & Time:</span>
                <b>{dateStr}</b>
              </div>
            </div>

            <button
              type="button"
              className="gateway-pay-btn"
              style={{ background: isCancellation ? '#dc2626' : '#16a34a' }}
              onClick={handleComplete}
            >
              {isCancellation ? 'Confirm & Cancel Order' : 'Done & View Order'}
            </button>
          </div>
        )}

        {/* Audio Element for PhonePe payment success sound effect */}
        <audio id="paymentSound" preload="auto">
          <source src="payment-success.mp3" type="audio/mpeg" />
          <source src="/payment-success.mp3" type="audio/mpeg" />
          <source src="/payment-success.wav" type="audio/wav" />
        </audio>
      </div>
    </div>
  );
}
