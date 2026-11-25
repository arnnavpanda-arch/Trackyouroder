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
 * Format date nicely: e.g. "25 Nov, 01:24 pm"
 */
function formatDate(d) {
  try {
    const date = d ? new Date(d) : new Date();
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return new Date().toLocaleString();
  }
}

/**
 * Generate official Tax Invoice PDF buffer matching the attached template exactly
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

  const companyName = settings?.company_name || 'Trackora Express Logistics';
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

      // =========================================================================
      // 1. TOP HEADER: BRAND ON LEFT, INVOICE METADATA ON RIGHT (Clean Monochrome)
      // =========================================================================
      const brandHeader = companyName.toUpperCase();
      doc.fillColor('#000000').fontSize(brandHeader.length > 28 ? 14 : 16).font('Helvetica-Bold')
        .text(brandHeader, startX, y, { width: 310, lineBreak: false });
      
      doc.fillColor('#111111').fontSize(9.5).font('Helvetica-Bold')
        .text('Tax Invoice / Bill of Supply / Consignment Note', startX, y + 20);
      
      doc.fillColor('#666666').fontSize(7.5).font('Helvetica')
        .text('(Original for Recipient)', startX, y + 32);

      // Top Right Document Metadata
      const rightX = startX + 310;
      const rightWidth = contentWidth - 310;
      const metaY = y;
      doc.fontSize(8);

      // Line 1: Invoice Number
      doc.fillColor('#000000').font('Helvetica-Bold')
        .text('Invoice Number: ', rightX, metaY, { continued: true, align: 'right', width: rightWidth })
        .font('Helvetica').text(`DT-INV-${order.id}`);

      // Line 2: Invoice Date
      doc.font('Helvetica-Bold')
        .text('Invoice Date: ', rightX, metaY + 11.5, { continued: true, align: 'right', width: rightWidth })
        .font('Helvetica').text(formatDate(order.createdAt));

      // Line 3: Order ID
      doc.font('Helvetica-Bold')
        .text('Order ID: ', rightX, metaY + 23, { continued: true, align: 'right', width: rightWidth })
        .font('Helvetica').text(`#${order.id}`);

      // Line 4: Order Status
      doc.font('Helvetica-Bold')
        .text('Order Status: ', rightX, metaY + 34.5, { continued: true, align: 'right', width: rightWidth })
        .font('Helvetica-Bold').text((order.status || 'Placed').toUpperCase());

      y += 48;

      // Full-width black divider line
      doc.strokeColor('#000000').lineWidth(0.8).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
      y += 8;

      // =========================================================================
      // 2. TWO-COLUMN ADDRESS BOX (Sold By & Consignee Details)
      // =========================================================================
      const colW = contentWidth / 2; // 261.64 pt
      const addrBoxH = 88;

      // Outer border
      doc.rect(startX, y, contentWidth, addrBoxH).strokeColor('#000000').lineWidth(0.8).stroke();
      // Center vertical divider
      doc.moveTo(startX + colW, y).lineTo(startX + colW, y + addrBoxH).strokeColor('#000000').lineWidth(0.8).stroke();

      // Left Column: Sold By & Dispatched By
      doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold')
        .text('SOLD BY & DISPATCHED BY:', startX + 8, y + 8);
      
      doc.fontSize(8.5).font('Helvetica-Bold')
        .text(companyName, startX + 8, y + 20, { width: colW - 16, lineBreak: false });

      doc.fillColor('#222222').fontSize(7.2).font('Helvetica')
        .text(companyAddress, startX + 8, y + 32, { width: colW - 16, height: 20, ellipsis: true })
        .text(`PAN: ${companyPan} | GSTIN: ${companyGstin}`, startX + 8, y + 54)
        .text(`Courier Carrier: ${order.agentName ? `${order.agentName} (Assigned Agent)` : `${companyName} Express Agent`}`, startX + 8, y + 65, { width: colW - 16, lineBreak: false });

      // Right Column: Shipping & Consignee Details
      const rightColX = startX + colW;
      doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold')
        .text('SHIPPING & CONSIGNEE DETAILS:', rightColX + 8, y + 8);

      doc.fontSize(8.5).font('Helvetica-Bold')
        .text(order.userName || 'Customer', rightColX + 8, y + 20, { width: colW - 16, lineBreak: false });

      const email = recipientEmail || order.userEmail || 'Registered Account';
      const dropAddr = (order.drop?.address || 'Designated Destination');
      const pickAddr = (order.pickup?.address || 'Designated Station');

      doc.fillColor('#222222').fontSize(7.2).font('Helvetica')
        .text(`Delivery Drop: ${dropAddr.substring(0, 52)}`, rightColX + 8, y + 32, { width: colW - 16, lineBreak: false });

      if (order.drop?.lat != null && order.drop?.lng != null) {
        doc.fillColor('#555555').fontSize(6.8).font('Helvetica')
          .text(`GPS: ${Number(order.drop.lat).toFixed(5)}, ${Number(order.drop.lng).toFixed(5)}${order.drop?.mapLink ? ' (Google Maps Linked)' : ''}`, rightColX + 8, y + 43, { width: colW - 16, lineBreak: false });
      } else {
        doc.fillColor('#555555').fontSize(6.8).font('Helvetica')
          .text('GPS: Coordinates linked on pickup', rightColX + 8, y + 43);
      }

      doc.fillColor('#222222').fontSize(7.2).font('Helvetica')
        .text(`Pickup Station: ${pickAddr.substring(0, 52)}`, rightColX + 8, y + 53, { width: colW - 16, lineBreak: false })
        .text(`Registered Email: ${email}`, rightColX + 8, y + 63, { width: colW - 16, lineBreak: false })
        .text(`Payer: ${order.payerName || order.accountHolderName || order.userName || 'Customer'} | State Code: 21 (Odisha)`, rightColX + 8, y + 73, { width: colW - 16, lineBreak: false });

      y += addrBoxH;

      // =========================================================================
      // 3. SHIPMENT & CONSIGNMENT REFERENCE BAR (Connected Directly Underneath)
      // =========================================================================
      const refH = 17;
      doc.rect(startX, y, contentWidth, refH).strokeColor('#000000').lineWidth(0.8).stroke();

      doc.fillColor('#111111').fontSize(7.2);
      const pkgTypeStr = `${order.pkg?.type || 'Standard'} (${order.pkg?.weight || 1} kg)`;
      const pkgDescStr = order.pkg?.desc || `${order.pkg?.type || 'Standard'} Package`;
      const pMethod = order.paymentMethod === 'card' ? 'Credit/Debit Card' : order.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : order.paymentMethod === 'pay_on_pickup' ? 'Pay on Pickup' : 'PhonePe / UPI';
      const pStatus = isPaid ? 'PAID & VERIFIED' : order.paymentStatus === 'not_verified' ? 'NOT VERIFIED' : 'PENDING';

      const s1 = startX + 6;
      const s2 = startX + 130;
      const s3 = startX + 260;
      const s4 = startX + 385;

      doc.font('Helvetica-Bold').text('Package: ', s1, y + 4.5, { continued: true }).font('Helvetica').text(pkgTypeStr);
      doc.font('Helvetica-Bold').text('Description: ', s2, y + 4.5, { continued: true }).font('Helvetica').text(pkgDescStr.substring(0, 22));
      doc.font('Helvetica-Bold').text('Payment Method: ', s3, y + 4.5, { continued: true }).font('Helvetica').text(pMethod);
      doc.font('Helvetica-Bold').text('Payment State: ', s4, y + 4.5, { continued: true }).font('Helvetica').text(pStatus);

      y += refH + 10;

      // =========================================================================
      // 4. ITEMIZED TABLE (White Background, Clean Black Outlines & Vertical Lines)
      // =========================================================================
      // Column widths: Sl (25) + Description (228) + Type/Weight (90) + Qty (26) + Gross (50) + Tax (45) + Total (59.28) = 523.28
      const colDefs = [
        { key: 'sl', label: 'Sl.', w: 25, align: 'center' },
        { key: 'desc', label: 'Description', w: 228, align: 'left' },
        { key: 'type', label: 'Type / Weight', w: 90, align: 'center' },
        { key: 'qty', label: 'Qty', w: 26, align: 'center' },
        { key: 'gross', label: 'Gross (₹)', w: 50, align: 'right' },
        { key: 'tax', label: 'Tax (₹)', w: 45, align: 'right' },
        { key: 'total', label: 'Total (₹)', w: 59.28, align: 'right' },
      ];

      const thHeight = 18;
      // Header rectangle
      doc.rect(startX, y, contentWidth, thHeight).strokeColor('#000000').lineWidth(0.8).stroke();

      // Header column text & vertical dividers
      let curX = startX;
      doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold');
      colDefs.forEach((col, idx) => {
        const textPad = col.align === 'left' ? 6 : 0;
        doc.text(col.label, curX + textPad, y + 5, { width: col.w - (col.align === 'left' ? 12 : 0), align: col.align });
        curX += col.w;
        if (idx < colDefs.length - 1) {
          doc.moveTo(curX, y).lineTo(curX, y + thHeight).strokeColor('#000000').lineWidth(0.8).stroke();
        }
      });

      y += thHeight;

      // Helper function to render a table row with vertical dividers
      const renderTableRow = (rowHeight, cells) => {
        doc.rect(startX, y, contentWidth, rowHeight).strokeColor('#000000').lineWidth(0.8).stroke();
        let rX = startX;
        colDefs.forEach((col, idx) => {
          if (idx < colDefs.length - 1) {
            doc.moveTo(rX + col.w, y).lineTo(rX + col.w, y + rowHeight).strokeColor('#000000').lineWidth(0.8).stroke();
          }
          rX += col.w;
        });

        // Cell 0: Sl.
        doc.fillColor('#000000').fontSize(7.5).font('Helvetica').text(cells.sl, startX, y + 6, { width: colDefs[0].w, align: 'center' });

        // Cell 1: Description
        doc.font('Helvetica-Bold').text(cells.descTitle, startX + 6, y + 5, { width: colDefs[1].w - 12 });
        if (cells.descSub) {
          doc.fillColor('#555555').fontSize(6.8).font('Helvetica').text(cells.descSub, startX + 6, y + 15, { width: colDefs[1].w - 12, lineBreak: false });
        }

        // Cell 2: Type / Weight
        doc.fillColor('#000000').fontSize(7.2).font('Helvetica').text(cells.type, startX + colDefs[0].w + colDefs[1].w, y + 7, { width: colDefs[2].w, align: 'center' });

        // Cell 3: Qty
        doc.text(cells.qty, startX + colDefs[0].w + colDefs[1].w + colDefs[2].w, y + 7, { width: colDefs[3].w, align: 'center' });

        // Cell 4: Gross
        const grossX = startX + colDefs[0].w + colDefs[1].w + colDefs[2].w + colDefs[3].w;
        doc.text(cells.gross, grossX, y + 7, { width: colDefs[4].w - 4, align: 'right' });

        // Cell 5: Tax
        const taxX = grossX + colDefs[4].w;
        doc.text(cells.tax, taxX, y + 7, { width: colDefs[5].w - 4, align: 'right' });

        // Cell 6: Total
        const totX = taxX + colDefs[5].w;
        doc.font('Helvetica-Bold').text(cells.total, totX, y + 7, { width: colDefs[6].w - 4, align: 'right' });

        y += rowHeight;
      };

      // Row 1: Courier Doorstep Delivery & Transportation Fee
      renderTableRow(26, {
        sl: '1',
        descTitle: 'Courier Doorstep Delivery & Transportation Fee',
        descSub: `Consignment from: ${pickAddr.split(',')[0]} to ${dropAddr.split(',')[0]}`,
        type: pkgTypeStr,
        qty: '1',
        gross: `₹${deliveryFee.toFixed(2)}`,
        tax: '₹0.00',
        total: `₹${deliveryFee.toFixed(2)}`,
      });

      // Row 2: Ordered Goods / Item Value (if present)
      if (itemValue > 0) {
        renderTableRow(24, {
          sl: '2',
          descTitle: 'Ordered Goods / Item Value',
          descSub: order.itemDesc || 'Goods amount collected on delivery',
          type: 'Verified Item',
          qty: '1',
          gross: `₹${itemValue.toFixed(2)}`,
          tax: '₹0.00',
          total: `₹${itemValue.toFixed(2)}`,
        });
      }

      // Row 3: Order Cancellation Processing Fee (if Cancelled)
      if (order.status === 'Cancelled') {
        renderTableRow(24, {
          sl: '3',
          descTitle: 'Order Cancellation Processing Fee',
          descSub: 'Mandatory processing fee as per policy',
          type: 'Service Charge',
          qty: '1',
          gross: `₹${cancellationFee.toFixed(2)}`,
          tax: '₹0.00',
          total: `₹${cancellationFee.toFixed(2)}`,
        });
      }

      // TOTAL AMOUNT ROW (Exactly as shown in image)
      const totH = 24;
      doc.rect(startX, y, contentWidth, totH).strokeColor('#000000').lineWidth(0.8).stroke();

      // Divider line separating the total label from the total amount box
      const totalColEnd = startX + contentWidth - colDefs[6].w;
      doc.moveTo(totalColEnd, y).lineTo(totalColEnd, y + totH).strokeColor('#000000').lineWidth(0.8).stroke();

      // "TOTAL AMOUNT PAYABLE:" text aligned right before the last column
      doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold')
        .text(`TOTAL AMOUNT ${isPaid ? 'PAID' : 'PAYABLE'}:`, startX + 50, y + 8, { width: totalColEnd - startX - 58, align: 'right' });

      // Big Bold Total in last column
      doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold')
        .text(`₹${totalAmount}`, totalColEnd, y + 6, { width: colDefs[6].w - 4, align: 'right' });

      y += totH + 8;

      // =========================================================================
      // 5. AMOUNT IN WORDS
      // =========================================================================
      doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold')
        .text('Amount in Words: ', startX, y, { continued: true })
        .font('Helvetica').text(numberToWordsINR(totalAmount));

      y += 11;
      doc.strokeColor('#000000').lineWidth(0.8).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
      y += 12;

      // =========================================================================
      // 6. BOTTOM PAYMENT REFERENCE + BARCODE + QR BOX (Exact Match with Image)
      // =========================================================================
      const refBoxH = 88;
      // Large outer box with clean black border
      doc.rect(startX, y, contentWidth, refBoxH).strokeColor('#000000').lineWidth(0.8).stroke();

      // Left Side: Payment Transaction Reference
      const txnRef = order.txnId || order.utrId || (order.paymentMethod === 'cod' ? 'COD Pending' : 'N/A');
      const vStatus = isPaid ? 'CONFIRMED & VERIFIED' : order.paymentStatus === 'not_verified' ? 'NOT VERIFIED' : 'PENDING AGENT VERIFICATION';

      doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold')
        .text('PAYMENT TRANSACTION REFERENCE:', startX + 12, y + 12);

      doc.fillColor('#222222').fontSize(7.2)
        .font('Helvetica').text('Method: ', startX + 12, y + 25, { continued: true }).font('Helvetica-Bold').text(pMethod)
        .font('Helvetica').text('Txn / UTR Ref: ', startX + 12, y + 37, { continued: true }).font('Helvetica-Bold').text(txnRef.substring(0, 28))
        .font('Helvetica').text('Verification: ', startX + 12, y + 49, { continued: true }).font('Helvetica-Bold').text(vStatus);

      // Right Side: DELIVERY ORDER BARCODE CARD + PAYMENT & DETAILS QR CARD
      const cardY = y + 7;
      const cardH = 74;

      // --- Sub-Card 1: Delivery Order Barcode Card ---
      const card1W = 148;
      const card1X = startX + contentWidth - 252;
      doc.rect(card1X, cardY, card1W, cardH).strokeColor('#cbd5e1').lineWidth(0.8).stroke();

      // Badge: DELIVERY ORDER BARCODE
      doc.fillColor('#0284c7').fontSize(6.5).font('Helvetica-Bold')
        .text('DELIVERY ORDER BARCODE', card1X + 4, cardY + 5, { align: 'center', width: card1W - 8 });

      const barcodeValue = `DT-${order.id}`;
      try {
        const { bars, totalWidth } = getBarcodeBars(barcodeValue, 1.05, 4);
        const barcodeStartX = card1X + Math.max(4, Math.floor((card1W - totalWidth) / 2));
        const barcodeY = cardY + 16;
        const barcodeH = 28;

        for (const bar of bars) {
          doc.rect(barcodeStartX + bar.x, barcodeY, bar.width, barcodeH).fill('#000000');
        }

        // Monospace text *DT-DL1037*
        doc.fillColor('#000000').fontSize(7.2).font('Courier-Bold')
          .text(`*${barcodeValue}*`, card1X, barcodeY + barcodeH + 2, { align: 'center', width: card1W });
        
        doc.fillColor('#555555').fontSize(6.2).font('Helvetica')
          .text('Carrier Tracking & Sorting', card1X, barcodeY + barcodeH + 11, { align: 'center', width: card1W });
      } catch (bcErr) {
        console.error('Barcode render error:', bcErr);
        doc.fillColor('#000000').fontSize(7.5).font('Courier').text(`*${barcodeValue}*`, card1X, cardY + 30, { align: 'center', width: card1W });
      }

      // --- Sub-Card 2: Payment & Details QR Card ---
      const card2W = 94;
      const card2X = card1X + card1W + 8;
      doc.rect(card2X, cardY, card2W, cardH).strokeColor('#cbd5e1').lineWidth(0.8).stroke();

      // Badge: PAYMENT & DETAILS QR
      doc.fillColor('#0284c7').fontSize(6.5).font('Helvetica-Bold')
        .text('PAYMENT & DETAILS QR', card2X + 2, cardY + 5, { align: 'center', width: card2W - 4 });

      const payAndDetailsUrl = `${clientOrigin}/pay/demo?orderId=${order.id}&amount=${totalAmount}&customer=${encodeURIComponent(order.userName || 'Customer')}`;
      try {
        const qrMatrix = generateQRMatrix(payAndDetailsUrl);
        if (qrMatrix && qrMatrix.length > 0) {
          const modCount = qrMatrix.length;
          const cellSize = 1.35; // 29 * 1.35 = ~39 pt
          const qrPixelSize = modCount * cellSize;
          const qrStartX = card2X + Math.floor((card2W - qrPixelSize) / 2);
          const qrStartY = cardY + 16;

          for (let r = 0; r < modCount; r++) {
            for (let c = 0; c < modCount; c++) {
              if (qrMatrix[r][c]) {
                doc.rect(qrStartX + c * cellSize, qrStartY + r * cellSize, cellSize, cellSize).fill('#000000');
              }
            }
          }

          doc.fillColor(isPaid ? '#166534' : '#0284c7').fontSize(6.2).font('Helvetica-Bold')
            .text(isPaid ? '✓ Paid & Verified' : `Scan to Pay ₹${totalAmount}`, card2X + 2, qrStartY + qrPixelSize + 4, { align: 'center', width: card2W - 4 });
        }
      } catch (qrErr) {
        console.error('QR render error:', qrErr);
      }

      y += refBoxH + 12;

      // =========================================================================
      // 7. DECLARATION & AUTHORIZED SIGNATORY (Exact Match with Image)
      // =========================================================================
      const decLeftW = 345;
      const decRightW = contentWidth - decLeftW - 10;

      // Left: Declaration Text
      doc.fillColor('#000000').fontSize(7.2).font('Helvetica-Bold')
        .text('Declaration:', startX, y);

      doc.fillColor('#444444').fontSize(6.8).font('Helvetica')
        .text('We declare that this invoice shows the actual price of the goods / services described and that all particulars are true and correct. Whether tax is payable under reverse charge: No.', startX, y + 10, { width: decLeftW, lineBreak: true })
        .text(`Customer support & tracking: ${supportEmail} - ${trackingUrl}`, startX, y + 29, { width: decLeftW, lineBreak: false });

      // Right: For Trackora Express Logistics + Dashed Authorized Signatory Seal
      const decRightX = startX + decLeftW + 10;
      doc.fillColor('#000000').fontSize(7.2).font('Helvetica-Bold')
        .text(`For ${companyName}:`, decRightX, y, { align: 'right', width: decRightW });

      const sigBoxW = 120;
      const sigBoxH = 26;
      const sigBoxX = startX + contentWidth - sigBoxW;
      const sigBoxY = y + 12;

      // Dashed border box
      doc.rect(sigBoxX, sigBoxY, sigBoxW, sigBoxH).dash(2, { space: 2 }).strokeColor('#94a3b8').stroke();
      doc.undash();

      doc.fillColor('#000000').fontSize(6.8).font('Helvetica-Bold')
        .text('AUTHORIZED SIGNATORY', sigBoxX, sigBoxY + 5, { align: 'center', width: sigBoxW });
      
      doc.fillColor('#64748b').fontSize(5.6).font('Helvetica')
        .text('Digitally Signed & Validated', sigBoxX, sigBoxY + 14, { align: 'center', width: sigBoxW });

      y += 48;

      // =========================================================================
      // 8. BOTTOM FOOTNOTE
      // =========================================================================
      doc.fillColor('#555555').fontSize(6.5).font('Helvetica')
        .text(`This is a computer-generated tax invoice and does not require a physical signature. Page 1 of 1. © ${new Date().getFullYear()} ${companyName}.`, startX, y, { align: 'center', width: contentWidth });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
