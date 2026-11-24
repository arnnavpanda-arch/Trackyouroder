import PDFDocument from 'pdfkit';
import { getBarcodeBars } from './barcode.js';
import { generateQRMatrix } from './qrCode.js';
import { Settings } from '../models/Settings.js';

/**
 * Convert number to words in INR
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
 * Format date nicely
 */
function formatDate(d) {
  try {
    const date = d ? new Date(d) : new Date();
    return date.toLocaleDateString('en-IN', {
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
 * Generate official Tax Invoice PDF buffer matching the customer dashboard receipt
 * @param {Object} order
 * @param {string} recipientEmail
 * @returns {Promise<Buffer>}
 */
export async function generateInvoicePdfBuffer(order, recipientEmail) {
  let settings = null;
  try {
    settings = await Settings.findOne();
  } catch (err) {
    // Graceful fallback if database lookup fails
  }

  const companyName = settings?.company_name || 'Delivery Tracker Logistics Services Pvt. Ltd.';
  const companyAddress = settings?.company_address || 'Plot No. 42, Tech Logistics Park, Saheed Nagar, Bhubaneswar, Odisha - 751007, India';
  const companyPan = settings?.company_pan || 'AABCD1234E';
  const companyGstin = settings?.company_gstin || '21AABCD1234E1Z5';
  const supportEmail = settings?.support_email || 'trackoradelivery@gmail.com';

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        info: {
          Title: `Tax Invoice DT-INV-${order.id}`,
          Author: companyName,
          Subject: `Official Tax Invoice & Consignment Note #${order.id}`,
        },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const startX = 36;
      const pageWidth = 595.28;
      const contentWidth = pageWidth - startX * 2; // 523.28 pt
      let y = 30;

      const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
      const trackingUrl = `${clientOrigin}/user/orders`;
      const deliveryFee = Number(order.deliveryFee || 40);
      const itemValue = Number(order.itemValue || 0);
      const cancellationFee = Number(order.cancellationFeeApplied || order.cancellationFee || 30);
      const totalAmount = (order.status === 'Cancelled'
        ? cancellationFee
        : Number(order.totalPayable || (deliveryFee + itemValue))
      ).toFixed(2);
      const isPaid = order.paymentStatus === 'paid' || order.paymentStatus === 'verified' || order.status === 'Cancelled';

      // --- Top Accent Bar ---
      doc.rect(startX, y, contentWidth, 4).fill('#0284c7');
      y += 12;

      // --- Brand & Document Header (Matches Customer Dashboard) ---
      const brandHeader = companyName.toUpperCase();
      doc.fillColor('#0f172a').fontSize(brandHeader.length > 30 ? 15 : 18).font('Helvetica-Bold')
        .text(brandHeader, startX, y, { width: 280, lineBreak: false });
      doc.fillColor('#0284c7').fontSize(9.5).font('Helvetica-Bold')
        .text('Tax Invoice / Bill of Supply / Consignment Note', startX, y + 21);
      doc.fillColor('#64748b').fontSize(8).font('Helvetica')
        .text('(Original for Recipient)', startX, y + 33);

      // Top Right Document Metadata
      const rightX = startX + 290;
      const rightWidth = contentWidth - 290;
      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold')
        .text(`Invoice Number: DT-INV-${order.id}`, rightX, y, { align: 'right', width: rightWidth });
      doc.fillColor('#334155').fontSize(8).font('Helvetica')
        .text(`Invoice Date: ${formatDate(order.createdAt)}`, rightX, y + 12, { align: 'right', width: rightWidth })
        .text(`Order ID: #${order.id}`, rightX, y + 24, { align: 'right', width: rightWidth });
      
      const statusColor = order.status === 'Cancelled' ? '#b91c1c' : order.status === 'Delivered' ? '#166534' : '#0284c7';
      doc.fillColor(statusColor).fontSize(8.5).font('Helvetica-Bold')
        .text(`Order Status: ${(order.status || 'Placed').toUpperCase()}`, rightX, y + 36, { align: 'right', width: rightWidth });

      y += 50;

      // Divider Line
      doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
      y += 8;

      // --- Two-Column Address Box (Sold By & Consignee) ---
      const colWidth = (contentWidth - 10) / 2;
      const boxHeight = 88;

      // Left Box: Sold By & Dispatched By (Dynamic from Admin System Settings)
      doc.rect(startX, y, colWidth, boxHeight).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#0284c7').fontSize(8).font('Helvetica-Bold').text('SOLD BY & DISPATCHED BY:', startX + 8, y + 8);
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold')
        .text(companyName, startX + 8, y + 19, { width: colWidth - 16, lineBreak: false });
      
      doc.fillColor('#475569').fontSize(7.3).font('Helvetica')
        .text(companyAddress, startX + 8, y + 30, { width: colWidth - 16, height: 22, ellipsis: true })
        .text(`PAN: ${companyPan} | GSTIN: ${companyGstin}`, startX + 8, y + 53)
        .text(`Carrier: ${order.agentName ? `${order.agentName} (Assigned Agent)` : `${companyName} Express Agent`}`, startX + 8, y + 64, { width: colWidth - 16, lineBreak: false })
        .text(`Support Email: ${supportEmail}`, startX + 8, y + 74);

      // Right Box: Shipping & Consignee Details
      const box2X = startX + colWidth + 10;
      doc.rect(box2X, y, colWidth, boxHeight).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#0284c7').fontSize(8).font('Helvetica-Bold').text('SHIPPING & CONSIGNEE DETAILS:', box2X + 8, y + 8);
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(order.userName || 'Customer', box2X + 8, y + 19);

      const email = recipientEmail || order.userEmail || 'Registered Account';
      const dropAddr = (order.drop?.address || 'Designated Destination').substring(0, 52);
      const pickAddr = (order.pickup?.address || 'Designated Station').substring(0, 52);

      doc.fillColor('#475569').fontSize(7.4).font('Helvetica')
        .text(`Delivery Drop: ${dropAddr}`, box2X + 8, y + 30, { width: colWidth - 16, lineBreak: false })
        .text(`Pickup Station: ${pickAddr}`, box2X + 8, y + 41, { width: colWidth - 16, lineBreak: false })
        .text(`Registered Email: ${email}`, box2X + 8, y + 52)
        .text(`Payer: ${order.payerName || order.accountHolderName || order.userName || 'Customer'}`, box2X + 8, y + 63)
        .text('Place of Supply: Odisha (State Code 21)', box2X + 8, y + 74);

      y += boxHeight + 8;

      // --- Shipment Reference Bar ---
      const refBarHeight = 18;
      doc.rect(startX, y, contentWidth, refBarHeight).fillAndStroke('#f1f5f9', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold');
      
      const pkgTypeStr = `${order.pkg?.type || 'Standard'} (${order.pkg?.weight || 1} kg)`;
      const pMethod = order.paymentMethod === 'card' ? 'Credit/Debit Card' : order.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : order.paymentMethod === 'pay_on_pickup' ? 'Pay on Pickup' : 'PhonePe / UPI';
      const pStatus = isPaid ? 'PAID & VERIFIED' : order.paymentStatus === 'not_verified' ? 'NOT VERIFIED' : 'PENDING';

      doc.text(`Package: ${pkgTypeStr}`, startX + 8, y + 5, { width: 130, lineBreak: false });
      doc.text(`Desc: ${(order.pkg?.desc || 'Parcel / Consignment').substring(0, 24)}`, startX + 140, y + 5, { width: 135, lineBreak: false });
      doc.text(`Payment: ${pMethod}`, startX + 280, y + 5, { width: 125, lineBreak: false });
      doc.text(`State: ${pStatus}`, startX + 410, y + 5, { width: 105, lineBreak: false });

      y += refBarHeight + 8;

      // --- Itemized Table ---
      const thHeight = 18;
      doc.rect(startX, y, contentWidth, thHeight).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
      doc.text('SL', startX + 6, y + 5, { width: 22, align: 'center' });
      doc.text('DESCRIPTION OF SERVICE / GOODS', startX + 32, y + 5, { width: 225 });
      doc.text('TYPE / WEIGHT', startX + 262, y + 5, { width: 85, align: 'center' });
      doc.text('QTY', startX + 352, y + 5, { width: 25, align: 'center' });
      doc.text('GROSS (₹)', startX + 382, y + 5, { width: 45, align: 'right' });
      doc.text('TAX (₹)', startX + 432, y + 5, { width: 35, align: 'right' });
      doc.text('TOTAL (₹)', startX + 472, y + 5, { width: 45, align: 'right' });

      y += thHeight;

      // Row 1: Courier Doorstep Delivery & Transportation Fee
      const row1Height = 28;
      doc.rect(startX, y, contentWidth, row1Height).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('1', startX + 6, y + 6, { width: 22, align: 'center' });
      doc.text('Courier Doorstep Delivery & Transportation Fee', startX + 32, y + 6);
      doc.fillColor('#64748b').fontSize(7).font('Helvetica')
        .text(`Consignment from: ${pickAddr.split(',')[0]} to ${dropAddr.split(',')[0]}`, startX + 32, y + 16, { width: 225, lineBreak: false });

      doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica').text(pkgTypeStr, startX + 262, y + 9, { width: 85, align: 'center' });
      doc.text('1', startX + 352, y + 9, { width: 25, align: 'center' });
      doc.text(`₹${deliveryFee.toFixed(2)}`, startX + 382, y + 9, { width: 45, align: 'right' });
      doc.text('₹0.00', startX + 432, y + 9, { width: 35, align: 'right' });
      doc.font('Helvetica-Bold').text(`₹${deliveryFee.toFixed(2)}`, startX + 472, y + 9, { width: 45, align: 'right' });

      y += row1Height;

      // Row 2: Item Value if present
      if (itemValue > 0) {
        const row2Height = 26;
        doc.rect(startX, y, contentWidth, row2Height).fillAndStroke('#ffffff', '#e2e8f0');
        doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('2', startX + 6, y + 5, { width: 22, align: 'center' });
        doc.text('Ordered Goods / Item Value', startX + 32, y + 5);
        doc.fillColor('#64748b').fontSize(7).font('Helvetica')
          .text(order.itemDesc || 'Goods amount collected on delivery', startX + 32, y + 15, { width: 225, lineBreak: false });

        doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica').text('Verified Item', startX + 262, y + 8, { width: 85, align: 'center' });
        doc.text('1', startX + 352, y + 8, { width: 25, align: 'center' });
        doc.text(`₹${itemValue.toFixed(2)}`, startX + 382, y + 8, { width: 45, align: 'right' });
        doc.text('₹0.00', startX + 432, y + 8, { width: 35, align: 'right' });
        doc.font('Helvetica-Bold').text(`₹${itemValue.toFixed(2)}`, startX + 472, y + 8, { width: 45, align: 'right' });

        y += row2Height;
      }

      // Row 3: Cancellation Fee if Cancelled
      if (order.status === 'Cancelled') {
        const row3Height = 26;
        doc.rect(startX, y, contentWidth, row3Height).fillAndStroke('#ffffff', '#e2e8f0');
        doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('3', startX + 6, y + 5, { width: 22, align: 'center' });
        doc.text('Order Cancellation Processing Fee', startX + 32, y + 5);
        doc.fillColor('#64748b').fontSize(7).font('Helvetica')
          .text('Mandatory processing fee as per policy', startX + 32, y + 15);

        doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica').text('Service Charge', startX + 262, y + 8, { width: 85, align: 'center' });
        doc.text('1', startX + 352, y + 8, { width: 25, align: 'center' });
        doc.text(`₹${cancellationFee.toFixed(2)}`, startX + 382, y + 8, { width: 45, align: 'right' });
        doc.text('₹0.00', startX + 432, y + 8, { width: 35, align: 'right' });
        doc.font('Helvetica-Bold').text(`₹${cancellationFee.toFixed(2)}`, startX + 472, y + 8, { width: 45, align: 'right' });

        y += row3Height;
      }

      // Total Row
      const totalRowHeight = 22;
      doc.rect(startX, y, contentWidth, totalRowHeight).fillAndStroke('#f0fdf4', '#86efac');
      doc.fillColor('#166534').fontSize(8.5).font('Helvetica-Bold')
        .text(`TOTAL AMOUNT ${isPaid ? 'PAID' : 'PAYABLE'}:`, startX + 80, y + 6, { width: 350, align: 'right' });
      doc.fontSize(11).font('Helvetica-Bold')
        .text(`₹${totalAmount}`, startX + 435, y + 5, { width: 82, align: 'right' });

      y += totalRowHeight + 8;

      // Amount in Words
      doc.rect(startX, y, contentWidth, 18).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#0284c7').fontSize(7.5).font('Helvetica-Bold').text('AMOUNT IN WORDS: ', startX + 8, y + 5, { continued: true });
      doc.fillColor('#0f172a').font('Helvetica').text(numberToWordsINR(totalAmount));

      y += 26;

      // =========================================================================
      // THREE-COLUMN SECTION: PAYMENT REFERENCE + WORKABLE BARCODE + WORKABLE QR
      // =========================================================================
      const tripleHeight = 88;
      const col1W = 160;
      const col2W = 222;
      const col3W = contentWidth - col1W - col2W - 14; // 127.28 pt

      // --- Column 1: Payment Transaction Reference ---
      doc.rect(startX, y, col1W, tripleHeight).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#0284c7').fontSize(7.5).font('Helvetica-Bold').text('PAYMENT REFERENCE', startX + 8, y + 7);
      
      const txnRef = order.txnId || order.utrId || (order.paymentMethod === 'cod' ? 'COD Pending' : 'N/A');
      const vStatus = isPaid ? 'CONFIRMED & VERIFIED' : order.paymentStatus === 'not_verified' ? 'NOT VERIFIED' : 'PENDING VERIFICATION';

      doc.fillColor('#334155').fontSize(7.2).font('Helvetica')
        .text('Payment Mode:', startX + 8, y + 20)
        .font('Helvetica-Bold').text(pMethod, startX + 8, y + 30)
        .font('Helvetica').text('Txn / UTR Reference:', startX + 8, y + 42)
        .font('Helvetica-Bold').text(txnRef.substring(0, 24), startX + 8, y + 52)
        .font('Helvetica').text('Status:', startX + 8, y + 64)
        .font('Helvetica-Bold').fillColor(isPaid ? '#166534' : '#b45309').text(vStatus, startX + 8, y + 74);

      // --- Column 2: WORKABLE Code 128 BARCODE for Delivery Order Details ---
      const col2X = startX + col1W + 7;
      doc.rect(col2X, y, col2W, tripleHeight).fillAndStroke('#ffffff', '#cbd5e1');
      doc.fillColor('#0284c7').fontSize(7.5).font('Helvetica-Bold')
        .text('DELIVERY ORDER BARCODE', col2X + 6, y + 6, { align: 'center', width: col2W - 12 });
      doc.fillColor('#64748b').fontSize(6.5).font('Helvetica')
        .text('Consignment Details & Carrier Sorting', col2X + 6, y + 16, { align: 'center', width: col2W - 12 });

      const barcodeValue = `DT-${order.id}`;
      try {
        const { bars, totalWidth } = getBarcodeBars(barcodeValue, 1.15, 6);
        const barcodeStartX = col2X + Math.max(4, Math.floor((col2W - totalWidth) / 2));
        const barcodeY = y + 27;
        const barcodeH = 34;

        // Draw crisp vector barcode bars
        for (const bar of bars) {
          doc.rect(barcodeStartX + bar.x, barcodeY, bar.width, barcodeH).fill('#000000');
        }

        // Barcode human readable text
        doc.fillColor('#0f172a').fontSize(8).font('Courier-Bold')
          .text(`*${barcodeValue}*`, col2X, barcodeY + barcodeH + 2, { align: 'center', width: col2W });
        doc.fillColor('#475569').fontSize(6.5).font('Helvetica')
          .text('Workable 1D Barcode for Delivery Details', col2X, barcodeY + barcodeH + 12, { align: 'center', width: col2W });
      } catch (bcErr) {
        console.error('PDF Barcode render error:', bcErr);
        doc.fillColor('#000000').fontSize(8).font('Courier').text(`*${barcodeValue}*`, col2X, y + 45, { align: 'center', width: col2W });
      }

      // --- Column 3: WORKABLE QR CODE for Payment Pay & Other Details ---
      const col3X = col2X + col2W + 7;
      doc.rect(col3X, y, col3W, tripleHeight).fillAndStroke('#ffffff', '#cbd5e1');
      doc.fillColor('#0284c7').fontSize(7.2).font('Helvetica-Bold')
        .text('PAYMENT & ORDER QR', col3X + 4, y + 6, { align: 'center', width: col3W - 8 });

      const payAndDetailsUrl = `${clientOrigin}/pay/demo?orderId=${order.id}&amount=${totalAmount}&customer=${encodeURIComponent(order.userName || 'Customer')}`;
      try {
        const qrMatrix = generateQRMatrix(payAndDetailsUrl);
        if (qrMatrix && qrMatrix.length > 0) {
          const modCount = qrMatrix.length;
          const cellSize = 1.6; // 29 * 1.6 = 46.4 pt
          const qrPixelSize = modCount * cellSize;
          const qrStartX = col3X + Math.floor((col3W - qrPixelSize) / 2);
          const qrStartY = y + 17;

          // Draw QR background
          doc.rect(qrStartX - 2, qrStartY - 2, qrPixelSize + 4, qrPixelSize + 4).fill('#ffffff');

          // Draw vector QR modules
          for (let r = 0; r < modCount; r++) {
            for (let c = 0; c < modCount; c++) {
              if (qrMatrix[r][c]) {
                doc.rect(qrStartX + c * cellSize, qrStartY + r * cellSize, cellSize, cellSize).fill('#000000');
              }
            }
          }

          doc.fillColor('#166534').fontSize(6.5).font('Helvetica-Bold')
            .text(isPaid ? '✓ Paid & Verified' : `Scan to Pay ₹${totalAmount}`, col3X + 2, qrStartY + qrPixelSize + 4, { align: 'center', width: col3W - 4 });
          doc.fillColor('#64748b').fontSize(5.8).font('Helvetica')
            .text('UPI / PhonePe Gateway', col3X + 2, qrStartY + qrPixelSize + 13, { align: 'center', width: col3W - 4 });
        }
      } catch (qrErr) {
        console.error('PDF QR render error:', qrErr);
      }

      y += tripleHeight + 8;

      // --- Declaration & Signatory (Dynamic Company Name & Address) ---
      const decHeight = 54;
      const decLeftW = 345;
      const decRightW = contentWidth - decLeftW - 10;

      // Left: Declaration Box
      doc.rect(startX, y, decLeftW, decHeight).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#334155').fontSize(7.2).font('Helvetica-Bold').text('DECLARATION & TERMS:', startX + 8, y + 6);
      doc.fillColor('#64748b').fontSize(6.8).font('Helvetica')
        .text('1. We declare that this invoice shows the actual price of the goods & delivery services described and all particulars are true and correct.', startX + 8, y + 17, { width: decLeftW - 16 })
        .text('2. Whether tax is payable under reverse charge: No.', startX + 8, y + 29)
        .text(`3. Customer support & online tracking: ${supportEmail} · ${trackingUrl}`, startX + 8, y + 39, { width: decLeftW - 16 });

      // Right: Authorized Signatory Box
      const decRightX = startX + decLeftW + 10;
      doc.rect(decRightX, y, decRightW, decHeight).fillAndStroke('#fafafa', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(6.8).font('Helvetica-Bold')
        .text(`For ${companyName}`, decRightX + 4, y + 6, { align: 'center', width: decRightW - 8, lineBreak: false });

      // Digital Seal Stamp
      doc.rect(decRightX + 16, y + 19, decRightW - 32, 28).dash(2, { space: 2 }).stroke('#64748b');
      doc.undash();
      doc.fillColor('#0f172a').fontSize(7).font('Helvetica-Bold')
        .text('AUTHORIZED SIGNATORY', decRightX + 16, y + 23, { align: 'center', width: decRightW - 32 });
      doc.fillColor('#16a34a').fontSize(5.8).font('Helvetica')
        .text('Digitally Signed & Validated', decRightX + 16, y + 33, { align: 'center', width: decRightW - 32 });

      y += decHeight + 8;

      // --- Footer Note ---
      doc.fillColor('#64748b').fontSize(7).font('Helvetica')
        .text('This is a computer-generated tax invoice and does not require a physical signature. Page 1 of 1.', startX, y, { align: 'center', width: contentWidth });
      doc.fillColor('#94a3b8').fontSize(6.5).font('Helvetica')
        .text(`© ${new Date().getFullYear()} ${companyName} | Original Tax Invoice for Consignment #${order.id}`, startX, y + 9, { align: 'center', width: contentWidth });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
