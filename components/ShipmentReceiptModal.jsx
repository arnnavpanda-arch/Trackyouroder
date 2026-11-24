import { useEffect, useRef, useState } from 'react';
import { QRCodeView, BarcodeView } from './CodeViews';
import { fmtDate } from '../utils/helpers';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

function numberToWordsINR(num) {
  const n = Math.floor(Number(num) || 0);
  if (n === 0) return 'INR Zero Only';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function inWords(val) {
    if ((val = val.toString()).length > 9) return 'Overflow';
    const match = ('000000000' + val).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!match) return '';
    let str = '';
    str += match[1] !== '00' ? (a[Number(match[1])] || `${b[match[1][0]]} ${a[match[1][1]]}`) + ' Crore ' : '';
    str += match[2] !== '00' ? (a[Number(match[2])] || `${b[match[2][0]]} ${a[match[2][1]]}`) + ' Lakh ' : '';
    str += match[3] !== '00' ? (a[Number(match[3])] || `${b[match[3][0]]} ${a[match[3][1]]}`) + ' Thousand ' : '';
    str += match[4] !== '0' ? (a[Number(match[4])] || `${b[match[4][0]]} ${a[match[4][1]]}`) + ' Hundred ' : '';
    str += match[5] !== '00' ? ((str !== '' ? 'and ' : '') + (a[Number(match[5])] || `${b[match[5][0]]} ${a[match[5][1]]}`)) : '';
    return str.trim();
  }
  return `INR ${inWords(n)} Only`;
}

export default function ShipmentReceiptModal({ order, isOpen, onClose }) {
  const receiptRef = useRef(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const { settings } = useApp() || {};

  const companyName = settings?.company_name || 'Delivery Tracker Logistics Services Pvt. Ltd.';
  const companyAddress = settings?.company_address || 'Plot No. 42, Tech Logistics Park, Saheed Nagar, Bhubaneswar, Odisha - 751007, India';
  const companyPan = settings?.company_pan || 'AABCD1234E';
  const companyGstin = settings?.company_gstin || '21AABCD1234E1Z5';
  const supportEmail = settings?.support_email || 'trackoradelivery@gmail.com';

  useEffect(() => {
    if (!isOpen) return;
    setEmailStatus(null);
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleEmailInvoice = async () => {
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await api.sendInvoiceEmail(order.id);
      setEmailStatus({ type: 'success', msg: res.message || 'Tax invoice sent to your registered email!' });
    } catch (err) {
      setEmailStatus({ type: 'error', msg: err.message || 'Failed to send invoice email' });
    } finally {
      setSendingEmail(false);
    }
  };

  const deliveryFee = order.deliveryFee || 40;
  const itemValue = Number(order.itemValue || 0);
  const totalAmount = Number(order.totalPayable || (deliveryFee + itemValue)).toFixed(2);
  const isPaid = order.paymentStatus === 'paid' || order.paymentStatus === 'verified';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const trackingUrl = `${origin}/user/orders`;
  const barcodeValue = `DT-${order.id}`;
  const payAndDetailsUrl = `${origin}/pay/demo?orderId=${order.id}&amount=${totalAmount}&customer=${encodeURIComponent(order.userName || 'Customer')}`;

  const apiBase = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `${window.location.protocol}//${window.location.hostname}:5001/api`
    : (import.meta.env.VITE_API_URL || 'http://localhost:5001/api');
  const pdfDownloadUrl = `${apiBase}/orders/${order.id}/invoice-pdf`;

  return (
    <div
      className="receipt-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="receipt-modal-dialog amazon-modal-dialog">
        {/* Amazon-style Toolbar (Hidden in Print) */}
        <div className="amazon-print-bar no-print">
          <div className="amazon-bar-left">
            <span className="amazon-doc-badge">TAX INVOICE / RECEIPT</span>
            <span className="amazon-doc-id">Order #{order.id}</span>
          </div>
          <div className="amazon-bar-right" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <a
              href={pdfDownloadUrl}
              target="_blank"
              rel="noreferrer"
              download={`Tax_Invoice_${order.id}.pdf`}
              className="amazon-btn-print"
              style={{
                textDecoration: 'none',
                background: '#0f172a',
                borderColor: '#0f172a',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
              title="Download Official Tax Invoice PDF"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download PDF
            </a>
            <button
              type="button"
              className="amazon-btn-print"
              style={{
                background: sendingEmail ? '#64748b' : '#0284c7',
                borderColor: sendingEmail ? '#64748b' : '#0284c7',
                color: '#ffffff',
                cursor: sendingEmail ? 'not-allowed' : 'pointer',
              }}
              onClick={handleEmailInvoice}
              disabled={sendingEmail}
              title="Send Tax Invoice PDF to registered email ID"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              {sendingEmail ? 'Sending...' : 'Email Invoice'}
            </button>
            <button
              type="button"
              className="amazon-btn-print"
              onClick={handlePrint}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print Invoice
            </button>
            <button
              type="button"
              className="amazon-btn-close"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {emailStatus && (
          <div
            className="no-print"
            style={{
              padding: '8px 16px',
              fontSize: 12.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: emailStatus.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: emailStatus.type === 'success' ? '#166534' : '#991b1b',
              borderBottom: `1px solid ${emailStatus.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            }}
          >
            <span>{emailStatus.type === 'success' ? '✓ ' : '✕ '}{emailStatus.msg}</span>
            <button
              type="button"
              onClick={() => setEmailStatus(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 800 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Amazon Official Tax Invoice Sheet */}
        <div className="amazon-invoice-sheet" ref={receiptRef} id="printable-receipt-sheet">
          {/* Top Header */}
          <div className="amz-header-row">
            <div className="amz-brand">
              <div className="amz-logo-text">{companyName.toUpperCase()}</div>
              <div className="amz-invoice-title">Tax Invoice / Bill of Supply / Consignment Note</div>
              <div className="amz-copy-note">(Original for Recipient)</div>
            </div>
            <div className="amz-doc-meta">
              <div className="amz-meta-line"><b>Invoice Number:</b> DT-INV-{order.id}</div>
              <div className="amz-meta-line"><b>Invoice Date:</b> {fmtDate(order.createdAt)}</div>
              <div className="amz-meta-line"><b>Order ID:</b> #{order.id}</div>
              <div className="amz-meta-line"><b>Order Status:</b> {order.status.toUpperCase()}</div>
            </div>
          </div>

          {/* Sold By & Customer Billing / Shipping Box (Amazon 2-column Box) */}
          <div className="amz-address-box">
            <div className="amz-addr-col border-right">
              <div className="amz-box-heading">Sold By & Dispatched By:</div>
              <div className="amz-addr-name">{companyName}</div>
              <div className="amz-addr-text">
                {companyAddress}<br />
                <b>PAN:</b> {companyPan} &nbsp;|&nbsp; <b>GSTIN:</b> {companyGstin}<br />
                <b>Courier Carrier:</b> {order.agentName ? `${order.agentName} (Assigned Agent)` : `${companyName} Express Agent`}
              </div>
            </div>

            <div className="amz-addr-col">
              <div className="amz-box-heading">Shipping & Consignee Details:</div>
              <div className="amz-addr-name">{order.userName || 'Customer'}</div>
              <div className="amz-addr-text">
                <b>Delivery Drop:</b> {order.drop?.address || 'Drop Address'}<br />
                {order.drop?.lat != null && (
                  <span className="amz-coord-note">
                    GPS: {Number(order.drop.lat).toFixed(5)}, {Number(order.drop.lng).toFixed(5)}
                    {order.drop?.mapLink && ' (Google Maps Linked)'}
                    <br />
                  </span>
                )}
                <b>Pickup Station:</b> {order.pickup?.address || 'Pickup Point'}<br />
                {order.userEmail && <><b>Registered Email:</b> {order.userEmail}<br /></>}
                <b>Payer:</b> {order.payerName || order.accountHolderName || order.userName || 'Customer'} &nbsp;|&nbsp; <b>State Code:</b> 21 (Odisha)
              </div>
            </div>
          </div>

          {/* Shipment & Consignment Reference Bar */}
          <div className="amz-reference-bar">
            <div><b>Package:</b> {order.pkg?.type || 'Standard'} ({order.pkg?.weight || 1} kg)</div>
            <div><b>Description:</b> {order.pkg?.desc || 'General Goods / Parcel'}</div>
            <div><b>Payment Method:</b> {order.paymentMethod === 'card' ? 'Credit/Debit Card' : order.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : order.paymentMethod === 'pay_on_pickup' ? 'Pay on Pickup' : 'PhonePe / UPI'}</div>
            <div><b>Payment State:</b> {isPaid ? 'PAID & VERIFIED' : order.paymentStatus === 'not_verified' ? 'NOT VERIFIED' : 'PENDING'}</div>
          </div>

          {/* Amazon-style Itemized Table */}
          <table className="amz-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>Sl.</th>
                <th>Description</th>
                <th style={{ width: '130px' }}>Type / Weight</th>
                <th style={{ width: '50px', textAlign: 'center' }}>Qty</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Gross (₹)</th>
                <th style={{ width: '90px', textAlign: 'right' }}>Tax (₹)</th>
                <th style={{ width: '110px', textAlign: 'right' }}>Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'center' }}>1</td>
                <td>
                  <b>Courier Doorstep Delivery & Transportation Fee</b>
                  <div className="amz-table-sub">
                    Consignment from: {order.pickup?.address ? order.pickup.address.split(',')[0] : 'Origin'} to {order.drop?.address ? order.drop.address.split(',')[0] : 'Destination'}
                    {order.notes ? ` · Instruction: "${order.notes}"` : ''}
                  </div>
                </td>
                <td>{order.pkg?.type || 'Standard'} ({order.pkg?.weight || 1} kg)</td>
                <td style={{ textAlign: 'center' }}>1</td>
                <td style={{ textAlign: 'right' }}>₹{deliveryFee.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>₹0.00</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{deliveryFee.toFixed(2)}</td>
              </tr>

              {itemValue > 0 && (
                <tr>
                  <td style={{ textAlign: 'center' }}>2</td>
                  <td>
                    <b>Ordered Goods / Item Value</b>
                    <div className="amz-table-sub">{order.itemDesc || 'Goods amount collected on delivery'}</div>
                  </td>
                  <td>Verified Item</td>
                  <td style={{ textAlign: 'center' }}>1</td>
                  <td style={{ textAlign: 'right' }}>₹{itemValue.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>₹0.00</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{itemValue.toFixed(2)}</td>
                </tr>
              )}

              {order.status === 'Cancelled' && (
                <tr>
                  <td style={{ textAlign: 'center' }}>3</td>
                  <td>
                    <b>Order Cancellation Fee</b>
                    <div className="amz-table-sub">Mandatory processing fee as per policy</div>
                  </td>
                  <td>Service Charge</td>
                  <td style={{ textAlign: 'center' }}>1</td>
                  <td style={{ textAlign: 'right' }}>₹{Number(order.cancellationFeeApplied || order.cancellationFee || 30).toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>₹0.00</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{Number(order.cancellationFeeApplied || order.cancellationFee || 30).toFixed(2)}</td>
                </tr>
              )}

              {/* Total Row */}
              <tr className="amz-total-row">
                <td colSpan="4" style={{ textAlign: 'right', fontWeight: 700 }}>
                  TOTAL AMOUNT {isPaid ? 'PAID' : 'PAYABLE'}:
                </td>
                <td colSpan="3" style={{ textAlign: 'right', fontWeight: 900, fontSize: 16 }}>
                  ₹{totalAmount}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Amount in Words */}
          <div className="amz-words-row">
            <b>Amount in Words:</b> <span>{numberToWordsINR(totalAmount)}</span>
          </div>

          {/* Payment Transaction & Verification Details */}
          <div className="amz-payment-strip">
            <div className="amz-pay-block">
              <div className="amz-pay-title">Payment Transaction Reference:</div>
              <div className="amz-pay-line">
                <span>Method:</span> <b>{order.paymentMethod === 'card' ? 'Credit/Debit Card' : order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'PhonePe / UPI Gateway'}</b>
              </div>
              <div className="amz-pay-line">
                <span>Txn / UTR Ref:</span> <code>{order.txnId || order.utrId || (order.paymentMethod === 'cod' ? 'COD Pending' : 'N/A')}</code>
              </div>
              <div className="amz-pay-line">
                <span>Verification:</span> <b>{isPaid ? 'CONFIRMED & VERIFIED' : order.paymentStatus === 'not_verified' ? 'REJECTED / UNVERIFIED' : 'PENDING AGENT VERIFICATION'}</b>
                {order.verificationNote ? ` (${order.verificationNote})` : ''}
              </div>
            </div>

            <div className="amz-qr-barcode-block">
              {/* Workable 1D Barcode for Delivery Order Details */}
              <div className="amz-barcode-card" title="Scannable Logistics Barcode for Delivery Order Details">
                <div className="amz-code-badge">DELIVERY ORDER BARCODE</div>
                <BarcodeView value={barcodeValue} height={38} barWidth={1.25} quietZone={4} showText={true} />
                <div className="amz-code-sub">Carrier Tracking & Sorting</div>
              </div>

              {/* Workable 2D QR Code for Payment Pay & Other Details */}
              <div className="amz-qr-card" title="Scannable QR Code for Payment Pay & Order Details">
                <div className="amz-code-badge">PAYMENT & DETAILS QR</div>
                <div className="amz-qr-box">
                  <QRCodeView value={payAndDetailsUrl} size={76} logoSrc="/phonepe.svg" logoSize={20} />
                </div>
                <div className="amz-code-sub">
                  {isPaid ? '✓ Paid & Verified' : `Scan to Pay ₹${totalAmount}`}
                </div>
              </div>
            </div>
          </div>

          {/* Declaration & Signatory (Amazon Style) */}
          <div className="amz-declaration-row">
            <div className="amz-dec-left">
              <b>Declaration:</b><br />
              We declare that this invoice shows the actual price of the goods / services described and that all particulars are true and correct.
              Whether tax is payable under reverse charge: <b>No</b>.<br />
              Customer support & tracking: <b>{supportEmail} · {trackingUrl}</b>
            </div>
            <div className="amz-dec-right">
              <div className="amz-sign-text">For {companyName}:</div>
              <div className="amz-sign-seal">
                <span className="amz-seal-text">AUTHORIZED SIGNATORY</span>
                <span className="amz-seal-sub">Digitally Signed & Validated</span>
              </div>
            </div>
          </div>

          {/* Bottom Footnote */}
          <div className="amz-footer-note">
            This is a computer-generated tax invoice and does not require a physical signature. Page 1 of 1. © {new Date().getFullYear()} {companyName}.
          </div>
        </div>
      </div>
    </div>
  );
}
