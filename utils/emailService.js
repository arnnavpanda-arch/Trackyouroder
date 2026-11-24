import nodemailer from 'nodemailer';
import { generateInvoicePdfBuffer } from './invoicePdf.js';
import { Settings } from '../models/Settings.js';

/**
 * Convert numerical INR amount to words
 */
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

/**
 * Initialize nodemailer transporter for Gmail
 */
export function createMailTransporter() {
  const user = (process.env.EMAIL_USER || 'trackoradelivery@gmail.com').trim();
  const pass = (process.env.EMAIL_PASS || 'sxal rsmi ubhv romn').replace(/\s+/g, '');

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

/**
 * Format date for invoice display
 */
function formatInvoiceDate(dateInput) {
  try {
    const d = dateInput ? new Date(dateInput) : new Date();
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return new Date().toLocaleString();
  }
}

/**
 * Generate responsive, email-client compliant HTML Template (Zero cut-off, all inline styles)
 */
export function generateTaxInvoiceHtml(order, recipientEmail, settings = null) {
  const companyName = settings?.company_name || 'Delivery Tracker Logistics Services Pvt. Ltd.';
  const companyAddress = settings?.company_address || 'Plot No. 42, Tech Logistics Park, Saheed Nagar, Bhubaneswar, Odisha - 751007, India';
  const companyGstin = settings?.company_gstin || '21AABCD1234E1Z5';
  const supportEmail = settings?.support_email || 'trackoradelivery@gmail.com';

  const deliveryFee = Number(order.deliveryFee || 40);
  const itemValue = Number(order.itemValue || 0);
  const totalAmount = Number(order.totalPayable || (deliveryFee + itemValue)).toFixed(2);
  const invoiceNum = `DT-INV-${order.id}`;
  const invoiceDate = formatInvoiceDate(order.createdAt);
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const trackingLink = `${clientOrigin}/user/orders`;
  const isPaid = order.paymentStatus === 'paid' || order.paymentStatus === 'verified';
  const amountWords = numberToWordsINR(totalAmount);

  const paymentMethodLabel =
    order.paymentMethod === 'card'
      ? 'Credit/Debit Card'
      : order.paymentMethod === 'cod'
      ? 'Cash on Delivery (COD)'
      : order.paymentMethod === 'pay_on_pickup'
      ? 'Pay on Pickup'
      : order.paymentMethod === 'prepaid'
      ? 'Prepaid (UPI / Net Banking)'
      : 'PhonePe / UPI';

  const paymentStatusLabel = isPaid
    ? 'PAID & VERIFIED'
    : order.paymentStatus === 'not_verified'
    ? 'UNVERIFIED'
    : order.paymentStatus === 'pending_pickup'
    ? 'PAY ON PICKUP (COD)'
    : 'PENDING VERIFICATION';

  const pickupAddress = order.pickup?.address || 'Pickup Point';
  const dropAddress = order.drop?.address || 'Drop Address';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmed & Tax Invoice - #${order.id}</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <!-- Outer Wrapper Table -->
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9; width:100%; margin:0; padding:20px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Container (Responsive max 600px) -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px; background-color:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #cbd5e1; box-shadow:0 4px 14px rgba(15,23,42,0.06);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color:#0284c7; padding:24px 20px; text-align:left; color:#ffffff;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size:22px; font-weight:800; letter-spacing:0.5px; color:#ffffff; margin:0 0 4px 0;">📦 ${companyName.toUpperCase()}</div>
                    <div style="font-size:12px; color:#e0f2fe; margin:0 0 10px 0;">Logistics & Express Consignment Services</div>
                    <span style="display:inline-block; background-color:rgba(255,255,255,0.22); border:1px solid rgba(255,255,255,0.4); color:#ffffff; padding:4px 10px; border-radius:999px; font-size:10.5px; font-weight:700; letter-spacing:0.6px; text-transform:uppercase;">
                      Official Tax Invoice & Consignment Note
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- PDF Attachment Notice Pill -->
          <tr>
            <td style="padding:14px 20px 0 20px;">
              <div style="background-color:#f0fdf4; border:1.5px solid #86efac; border-radius:8px; padding:12px 14px; text-align:left;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="30" valign="middle" style="font-size:22px;">📎</td>
                    <td valign="middle" style="font-size:13px; color:#166534; font-weight:600; line-height:1.4;">
                      <strong>Official PDF Invoice Attached:</strong><br />
                      <span style="font-size:12px; color:#15803d; font-weight:400;">A complete, printable Tax Invoice PDF (<code>Tax_Invoice_${order.id}.pdf</code>) is attached to this email.</span>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:20px;">
              <!-- Greeting -->
              <p style="margin:0 0 16px 0; font-size:14px; line-height:1.5; color:#334155;">
                Hello <strong>${order.userName || 'Valued Customer'}</strong>,<br />
                Your delivery booking has been successfully placed and confirmed. Below is your booking and invoice summary.
              </p>

              <!-- Invoice Metadata Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:18px;">
                <tr>
                  <td style="padding:12px 14px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="4" style="font-size:12.5px;">
                      <tr>
                        <td style="color:#64748b; font-weight:600; width:45%;">Invoice Number:</td>
                        <td style="color:#0f172a; font-weight:700; text-align:right; font-family:monospace;">${invoiceNum}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b; font-weight:600;">Consignment / Order ID:</td>
                        <td style="color:#0284c7; font-weight:700; text-align:right;">#${order.id}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b; font-weight:600;">Invoice Date:</td>
                        <td style="color:#0f172a; font-weight:600; text-align:right;">${invoiceDate}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b; font-weight:600;">Registered Email:</td>
                        <td style="color:#0f172a; font-weight:600; text-align:right; word-break:break-all;">${recipientEmail}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b; font-weight:600;">Consignment Status:</td>
                        <td style="color:#16a34a; font-weight:800; text-align:right;">${(order.status || 'Placed').toUpperCase()}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Addresses Section (Stacked to prevent mobile cut-off) -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:18px;">
                <tr>
                  <td style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px; margin-bottom:10px;">
                    <div style="font-size:11px; font-weight:800; color:#0284c7; text-transform:uppercase; margin-bottom:4px;">📍 Pickup Location</div>
                    <div style="font-size:12.5px; color:#1e293b; line-height:1.4; word-break:break-word;">
                      ${pickupAddress}
                    </div>
                  </td>
                </tr>
                <tr><td height="10"></td></tr>
                <tr>
                  <td style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px;">
                    <div style="font-size:11px; font-weight:800; color:#0284c7; text-transform:uppercase; margin-bottom:4px;">🎯 Delivery Drop Location</div>
                    <div style="font-size:12.5px; color:#1e293b; line-height:1.4; word-break:break-word;">
                      ${dropAddress}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Package & Items Table -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; margin-bottom:18px;">
                <tr style="background-color:#0f172a; color:#ffffff;">
                  <td style="padding:10px 12px; font-size:11.5px; font-weight:700; text-transform:uppercase; text-align:left;">Service Description</td>
                  <td style="padding:10px 12px; font-size:11.5px; font-weight:700; text-transform:uppercase; text-align:right; width:80px;">Amount</td>
                </tr>
                <tr>
                  <td style="padding:12px; border-bottom:1px solid #e2e8f0; font-size:12.5px; color:#1e293b;">
                    <strong>Courier Doorstep Delivery & Transport Fee</strong><br />
                    <span style="font-size:11.5px; color:#64748b;">
                      Package: ${order.pkg?.type || 'Standard'} (${order.pkg?.weight || 1} kg)${order.notes ? ` · Note: ${order.notes}` : ''}
                    </span>
                  </td>
                  <td style="padding:12px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">
                    ₹${deliveryFee.toFixed(2)}
                  </td>
                </tr>
                ${itemValue > 0 ? `
                <tr>
                  <td style="padding:12px; border-bottom:1px solid #e2e8f0; font-size:12.5px; color:#1e293b;">
                    <strong>Consignment Item Value</strong><br />
                    <span style="font-size:11.5px; color:#64748b;">${order.itemDesc || 'Goods amount collected on delivery'}</span>
                  </td>
                  <td style="padding:12px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">
                    ₹${itemValue.toFixed(2)}
                  </td>
                </tr>
                ` : ''}
                <!-- Total Row -->
                <tr style="background-color:#f0fdf4;">
                  <td style="padding:12px; font-size:13px; font-weight:800; color:#166534; text-transform:uppercase;">
                    Total Amount ${isPaid ? 'Paid' : 'Payable'}:
                  </td>
                  <td style="padding:12px; font-size:16px; font-weight:900; color:#166534; text-align:right; white-space:nowrap;">
                    ₹${totalAmount}
                  </td>
                </tr>
              </table>

              <!-- Amount in Words -->
              <div style="background-color:#f1f5f9; border-left:4px solid #0284c7; padding:8px 12px; font-size:12px; color:#334155; margin-bottom:18px; border-radius:0 6px 6px 0;">
                <strong>Amount in Words:</strong> ${amountWords}
              </div>

              <!-- Payment Details Strip -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:22px;">
                <tr>
                  <td style="padding:12px 14px;">
                    <div style="font-size:11.5px; font-weight:800; color:#0f172a; text-transform:uppercase; margin-bottom:6px;">Payment Information</div>
                    <div style="font-size:12px; color:#475569; line-height:1.6;">
                      <strong>Method:</strong> ${paymentMethodLabel}<br />
                      <strong>Status:</strong> <span style="font-weight:700; color:${isPaid ? '#16a34a' : '#d97706'};">${paymentStatusLabel}</span><br />
                      ${order.utrId || order.txnId ? `<strong>Transaction Ref:</strong> <code style="color:#0284c7; font-weight:700;">${order.utrId || order.txnId}</code><br />` : ''}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Action Button: Track Order Live -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:20px 0;">
                <tr>
                  <td align="center">
                    <a href="${trackingLink}" target="_blank" style="display:inline-block; background-color:#0284c7; color:#ffffff; text-decoration:none; font-size:13.5px; font-weight:700; padding:12px 26px; border-radius:8px; box-shadow:0 2px 8px rgba(2,132,199,0.3);">
                      🔍 Track Your Order Live →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Legal / Support Notice -->
              <div style="border-top:1px solid #e2e8f0; padding-top:14px; font-size:11.5px; color:#64748b; line-height:1.5;">
                <strong>Sold By:</strong> ${companyName}, ${companyAddress} (GSTIN: ${companyGstin}).<br /><br />
                This is a computer-generated invoice. For any inquiries, please contact our support team at <a href="mailto:${supportEmail}" style="color:#0284c7; text-decoration:none;">${supportEmail}</a>.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0f172a; color:#94a3b8; padding:16px 20px; text-align:center; font-size:11.5px; line-height:1.5;">
              © ${new Date().getFullYear()} ${companyName}<br />
              Delivered to <strong>${recipientEmail}</strong> for Order <strong>#${order.id}</strong>.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send Booking Tax Invoice with attached PDF to the user's registered email
 */
export async function sendBookingInvoiceEmail(order, userEmail, userName) {
  const targetEmail = (userEmail || order.userEmail || '').trim();
  if (!targetEmail || !targetEmail.includes('@')) {
    console.warn(`[Email] Cannot send tax invoice: No valid email provided for order ${order.id}`);
    return { ok: false, error: 'No valid recipient email address' };
  }

  let settings = null;
  try {
    settings = await Settings.findOne();
  } catch (err) {}

  const companyName = settings?.company_name || 'Delivery Tracker Logistics Services Pvt. Ltd.';
  const companyAddress = settings?.company_address || 'Plot No. 42, Tech Logistics Park, Saheed Nagar, Bhubaneswar, Odisha - 751007, India';
  const companyGstin = settings?.company_gstin || '21AABCD1234E1Z5';
  const supportEmail = settings?.support_email || 'trackoradelivery@gmail.com';

  const senderEmail = (process.env.EMAIL_USER || 'trackoradelivery@gmail.com').trim();
  const fromHeader = process.env.EMAIL_FROM || `"${companyName}" <${senderEmail}>`;
  const subject = `Tax Invoice & Receipt - Consignment #${order.id} | ${companyName}`;
  const html = generateTaxInvoiceHtml(order, targetEmail, settings);
  const text = `
TAX INVOICE & RECEIPT - ${companyName.toUpperCase()}
==================================================
Sold By: ${companyName}
Address: ${companyAddress} (GSTIN: ${companyGstin})
Order ID: #${order.id}
Invoice No: DT-INV-${order.id}
Customer: ${userName || order.userName || 'Customer'}
Registered Email: ${targetEmail}
Delivery Order Barcode: DT-${order.id}
Pickup Address: ${order.pickup?.address || 'N/A'}
Drop Address: ${order.drop?.address || 'N/A'}
Package: ${order.pkg?.type || 'Standard'} (${order.pkg?.weight || 1} kg)
Delivery Fee: INR ${Number(order.deliveryFee || 40).toFixed(2)}
Total Amount: INR ${Number(order.totalPayable || 40).toFixed(2)}
Payment Method: ${order.paymentMethod || 'COD'}
Payment Status: ${order.paymentStatus || 'Pending'}
${order.utrId ? `UTR / Txn: ${order.utrId}` : ''}

Payment & Order Details: ${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/pay/demo?orderId=${order.id}&amount=${order.totalPayable || 40}
Track your order live: ${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/user/orders
Support: ${supportEmail}

(Official uncompacted Tax Invoice PDF with workable Barcode and QR Code is attached: Tax_Invoice_${order.id}.pdf)
==================================================
  `;

  try {
    // 1. Generate PDF buffer in memory
    console.log(`[Email] Generating Tax Invoice PDF for order #${order.id}...`);
    const pdfBuffer = await generateInvoicePdfBuffer(order, targetEmail);

    // 2. Send email with PDF attachment
    const transporter = createMailTransporter();
    console.log(`[Email] Sending booking tax invoice with PDF for order #${order.id} to ${targetEmail}...`);

    const info = await transporter.sendMail({
      from: fromHeader,
      to: targetEmail,
      subject,
      text,
      html,
      attachments: [
        {
          filename: `Tax_Invoice_${order.id}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    console.log(`[Email] Tax invoice with PDF sent successfully! MessageId: ${info.messageId} to ${targetEmail}`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email Error] Failed to send tax invoice for order #${order.id} to ${targetEmail}:`, err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Generate animated, celebratory Delivered Order HTML email with Thank You & Order Again CTA
 */
export function generateDeliveredOrderHtml(order, recipientEmail, settings = null) {
  const companyName = settings?.company_name || 'Trackora Logistics Services Pvt. Ltd.';
  const companyAddress = settings?.company_address || 'Plot No. 42, Tech Logistics Park, Saheed Nagar, Bhubaneswar, Odisha - 751007, India';
  const supportEmail = settings?.support_email || 'trackoradelivery@gmail.com';
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5001';

  const deliveryFee = Number(order.deliveryFee || 40);
  const itemValue = Number(order.itemValue || 0);
  const totalAmount = Number(order.totalPayable || (deliveryFee + itemValue)).toFixed(2);
  const formattedDate = formatInvoiceDate(new Date());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order #${order.id} Delivered Successfully - ${companyName}</title>
  <style>
    @keyframes pulseCheck {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7); }
      70% { transform: scale(1.05); box-shadow: 0 0 0 16px rgba(22, 163, 74, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
    }
    @keyframes cheerFloat {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-6px); }
    }
    .animated-badge {
      animation: pulseCheck 2.2s infinite ease-in-out;
    }
    .cheer-icon {
      animation: cheerFloat 2.6s infinite ease-in-out;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container: Uncompacted, Generous Breathable Padding -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.12); border: 1px solid #e2e8f0;">
          
          <!-- Celebratory Header Banner with Animation Styling -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #064e3b 100%); padding: 44px 32px; text-align: center; color: #ffffff;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <!-- Animated Delivery Success Badge -->
                    <div class="animated-badge" style="display: inline-block; width: 76px; height: 76px; line-height: 76px; border-radius: 50%; background: linear-gradient(145deg, #22c55e, #15803d); color: #ffffff; font-size: 38px; text-align: center; box-shadow: 0 10px 25px rgba(34, 197, 94, 0.45);">
                      ✓
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <span style="display: inline-block; background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.4); padding: 6px 16px; border-radius: 24px; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 12px;">
                      🎉 DELIVERED SUCCESSFULLY
                    </span>
                    <h1 style="margin: 8px 0 12px; font-size: 28px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff;">
                      Your Order #${order.id} is Delivered!
                    </h1>
                    <p style="margin: 0; font-size: 16px; color: #cbd5e1; line-height: 1.6; max-width: 480px;">
                      Great news! Your package was safely handed over at your destination.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Thank You & Celebration Notice -->
          <tr>
            <td style="padding: 32px 32px 24px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <div style="background-color: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 14px; padding: 20px 24px; text-align: center;">
                <span class="cheer-icon" style="font-size: 32px; display: inline-block; margin-bottom: 8px;">🎁</span>
                <h3 style="margin: 0 0 8px; color: #065f46; font-size: 19px; font-weight: 800;">
                  Thank You for Choosing Trackora!
                </h3>
                <p style="margin: 0; color: #047857; font-size: 15px; line-height: 1.6;">
                  We are thrilled to serve you. We hope our real-time tracking, live updates, and swift delivery met your expectations.
                </p>
              </div>
            </td>
          </tr>

          <!-- Uncompacted Order Details Section -->
          <tr>
            <td style="padding: 28px 32px;">
              <h3 style="margin: 0 0 18px; font-size: 17px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em;">
                📦 Delivery Summary
              </h3>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #ffffff;">
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 14px 18px; color: #64748b; font-size: 14px; font-weight: 600; width: 38%; border-bottom: 1px solid #f1f5f9;">
                    Tracking ID
                  </td>
                  <td style="padding: 14px 18px; color: #0f172a; font-size: 15px; font-weight: 800; border-bottom: 1px solid #f1f5f9;">
                    #${order.id}
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 14px 18px; color: #64748b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #f1f5f9;">
                    Delivered On
                  </td>
                  <td style="padding: 14px 18px; color: #0f172a; font-size: 14px; font-weight: 600; border-bottom: 1px solid #f1f5f9;">
                    ${formattedDate}
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 14px 18px; color: #64748b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #f1f5f9;">
                    Recipient
                  </td>
                  <td style="padding: 14px 18px; color: #0f172a; font-size: 14px; font-weight: 700; border-bottom: 1px solid #f1f5f9;">
                    ${order.userName || 'Customer'} (${recipientEmail})
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 14px 18px; color: #64748b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #f1f5f9;">
                    Drop Location
                  </td>
                  <td style="padding: 14px 18px; color: #0f172a; font-size: 14px; line-height: 1.5; font-weight: 500; border-bottom: 1px solid #f1f5f9;">
                    📍 ${order.drop?.address || 'Customer Destination'}
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 14px 18px; color: #64748b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #f1f5f9;">
                    Package Details
                  </td>
                  <td style="padding: 14px 18px; color: #0f172a; font-size: 14px; font-weight: 600; border-bottom: 1px solid #f1f5f9;">
                    ${order.pkg?.type || 'Standard Package'} (${order.pkg?.weight || 1} kg)
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 18px; color: #64748b; font-size: 14px; font-weight: 600;">
                    Total Bill
                  </td>
                  <td style="padding: 14px 18px; color: #15803d; font-size: 17px; font-weight: 800;">
                    ₹${totalAmount} <span style="font-size: 12px; font-weight: 600; color: #166534; background: #dcfce7; padding: 2px 8px; border-radius: 12px;">PAID</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Primary Call To Action: ORDER AGAIN -->
          <tr>
            <td style="padding: 10px 32px 36px; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="background: linear-gradient(145deg, #ffffff, #fff5f5); border: 2px dashed #fca5a5; border-radius: 16px; padding: 28px 24px;">
                    <h3 style="margin: 0 0 8px; color: #991b1b; font-size: 20px; font-weight: 800;">
                      Ready to Ship Something Else?
                    </h3>
                    <p style="margin: 0 0 20px; color: #7f1d1d; font-size: 14px; line-height: 1.5;">
                      Fast pickup, live GPS rider tracking, and verified safe delivery across India.
                    </p>
                    
                    <a href="${clientOrigin}/user/new" style="display: inline-block; background: linear-gradient(145deg, #e8212f, #b91c1c); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 800; padding: 15px 36px; border-radius: 12px; box-shadow: 0 8px 20px -4px rgba(232, 33, 47, 0.5); letter-spacing: 0.02em;">
                      🛍️ ORDER AGAIN NOW →
                    </a>

                    <div style="margin-top: 18px;">
                      <a href="${clientOrigin}/user/orders/${order.id}" style="color: #475569; text-decoration: underline; font-size: 13px; font-weight: 600;">
                        View Full Tracking & Timeline →
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Official Tax Invoice Notice & Attachment Info -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px; font-size: 13px; color: #64748b; font-weight: 500;">
                📎 <strong>Tax Invoice Attached:</strong> Your uncompacted GST invoice (<code>Tax_Invoice_${order.id}.pdf</code>) is attached to this email.
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                ${companyName} · ${companyAddress} · Support: <a href="mailto:${supportEmail}" style="color: #64748b;">${supportEmail}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send celebratory Delivered Order Email with Thank You & Order Again CTA to customer's registered email
 */
export async function sendOrderDeliveredEmail(order, userEmail, userName) {
  const targetEmail = (userEmail || order.userEmail || '').trim();
  if (!targetEmail || !targetEmail.includes('@')) {
    console.warn(`[Email] Cannot send delivered notification: No valid email provided for order ${order.id}`);
    return { ok: false, error: 'No valid recipient email address' };
  }

  let settings = null;
  try {
    settings = await Settings.findOne();
  } catch (err) {}

  const companyName = settings?.company_name || 'Trackora Logistics Services Pvt. Ltd.';
  const senderEmail = (process.env.EMAIL_USER || 'trackoradelivery@gmail.com').trim();
  const fromHeader = process.env.EMAIL_FROM || `"${companyName}" <${senderEmail}>`;
  const subject = `🎉 Order #${order.id} Delivered! Thank You for Choosing ${companyName} — Order Again!`;
  const html = generateDeliveredOrderHtml(order, targetEmail, settings);
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5001';

  const text = `
ORDER DELIVERED SUCCESSFULLY - ${companyName.toUpperCase()}
==================================================
Hello ${userName || order.userName || 'Customer'},

Your Order #${order.id} has been delivered successfully!
Delivered To: ${order.drop?.address || 'Destination'}
Package: ${order.pkg?.type || 'Standard'} (${order.pkg?.weight || 1} kg)
Total Amount: INR ${Number(order.totalPayable || 40).toFixed(2)}

THANK YOU FOR CHOOSING TRACKORA!
We hope you enjoyed our prompt delivery service.

Ready to send another parcel?
Order Again: ${clientOrigin}/user/new

View Consignment Tracking & Details: ${clientOrigin}/user/orders/${order.id}
Support Email: ${settings?.support_email || 'trackoradelivery@gmail.com'}

(Official uncompacted Tax Invoice PDF is attached: Tax_Invoice_${order.id}.pdf)
==================================================
  `;

  try {
    // 1. Generate Tax Invoice PDF buffer
    console.log(`[Email] Generating Tax Invoice PDF attachment for delivered order #${order.id}...`);
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateInvoicePdfBuffer(order, targetEmail);
    } catch (pdfErr) {
      console.warn(`[Email Warning] Could not attach PDF to delivered email:`, pdfErr.message);
    }

    const attachments = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `Tax_Invoice_${order.id}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      });
    }

    // 2. Send email via transporter
    const transporter = createMailTransporter();
    console.log(`[Email] Sending delivered confirmation email for order #${order.id} to ${targetEmail}...`);

    const info = await transporter.sendMail({
      from: fromHeader,
      to: targetEmail,
      subject,
      text,
      html,
      attachments,
    });

    console.log(`[Email] Delivered order email sent successfully! MessageId: ${info.messageId} to ${targetEmail}`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email Error] Failed to send delivered email for order #${order.id} to ${targetEmail}:`, err.message);
    return { ok: false, error: err.message };
  }
}

