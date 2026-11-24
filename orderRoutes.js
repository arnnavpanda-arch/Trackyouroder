import express from 'express';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { Pricing } from '../models/Pricing.js';
import { getNextOrderId } from '../models/Sequence.js';
import { protect, agentOrAdmin } from '../middleware/auth.js';
import { getIO } from '../socket.js';
import { geocodeAddress, reverseGeocode, parseMapLinkOrAddress } from '../utils/geocoder.js';
import { sendBookingInvoiceEmail, sendOrderDeliveredEmail } from '../utils/emailService.js';
import { generateInvoicePdfBuffer } from '../utils/invoicePdf.js';

const router = express.Router();

// @route   POST /api/orders/resolve-location
// @desc    Resolve Google Maps link, coordinates, or address to { lat, lng, formattedAddress }
router.post('/resolve-location', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) return res.status(400).json({ message: 'Input is required' });
    const resolved = await parseMapLinkOrAddress(input);
    if (!resolved) {
      return res.status(404).json({ message: 'Could not resolve location. Please verify the link or address.' });
    }
    return res.json({ ok: true, ...resolved });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

const notify = (to, message, orderId) => {
  const io = getIO();
  if (io) {
    io.emit('newNotification', {
      id: Math.random().toString(36).slice(2),
      to,
      message,
      orderId,
      time: Date.now(),
    });
  }
};

const emitOrderUpdate = (orderId, order, extra = {}) => {
  const io = getIO();
  if (io) {
    io.emit('orderStatusUpdated', { orderId, order: order.toJSON(), ...extra });
  }
};

// @route   GET /api/orders/public-stats
// @desc    Get aggregate order counts for login screen banner (public)
router.get('/public-stats', async (req, res) => {
  try {
    const total = await Order.countDocuments();
    const preparing = await Order.countDocuments({ status: 'Placed' });
    const onTheWay = await Order.countDocuments({ status: { $in: ['Picked-up', 'In-Transit'] } });
    const delivered = await Order.countDocuments({ status: 'Delivered' });
    return res.json({ total, preparing, onTheWay, delivered });
  } catch (err) {
    return res.json({ total: 14, preparing: 4, onTheWay: 4, delivered: 6 });
  }
});

// @route   GET /api/orders
// @desc    List all orders (Admin or all logged in users)
router.get('/', protect, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    return res.json(orders.map((o) => o.toJSON()));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/orders/my
// @desc    List orders for current customer
router.get('/my', protect, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id.toString() }).sort({ createdAt: -1 });
    return res.json(orders.map((o) => o.toJSON()));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/orders/assigned
// @desc    List orders assigned to current agent
router.get('/assigned', protect, async (req, res) => {
  try {
    const orders = await Order.find({ agentId: req.user._id.toString() }).sort({ createdAt: -1 });
    return res.json(orders.map((o) => o.toJSON()));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/orders/:id
// @desc    Get order details (Public for consignment tracking via QR code or tracking link)
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findOne({ id: { $regex: new RegExp(`^${req.params.id}$`, 'i') } });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    return res.json(order.toJSON());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/orders
// @desc    Create a new delivery order
router.post('/', protect, async (req, res) => {
  try {
    const pricing = (await Pricing.findOne()) || {
      base_fee: 40,
      base_weight_kg: 2,
      extra_per_kg: 15,
      cancellation_fee: 30,
    };

    const pickupAddress = typeof req.body.pickup === 'object' ? req.body.pickup.address : (req.body.pickup || '');
    const dropAddress = typeof req.body.drop === 'object' ? req.body.drop.address : (req.body.drop || '');
    const pickupState = (req.body.pickupState || req.body.pickup?.state || req.user?.state || '').trim();
    const dropState = (req.body.dropState || req.body.drop?.state || pickupState).trim();
    const pickupDistrict = (req.body.pickupDistrict || req.body.pickup?.district || req.user?.district || '').trim();
    const dropDistrict = (req.body.dropDistrict || req.body.drop?.district || '').trim();

    // 1. Mandatory Drop Google Maps URL
    let dropMapLink = (req.body.dropMapLink || req.body.drop?.mapLink || '').trim();
    let pickupMapLink = (req.body.pickupMapLink || req.body.pickup?.mapLink || '').trim();
    if (!dropMapLink) {
      return res.status(400).json({ message: 'Drop location Google Maps URL is compulsory / mandatory.' });
    }

    // 2. Intra-state rule: Must travel in the same state only
    if (pickupState && dropState && pickupState.toLowerCase() !== dropState.toLowerCase()) {
      return res.status(400).json({
        message: `Inter-state delivery is prohibited. Pickup and Drop must be in the same state only (${pickupState}).`
      });
    }

    // 3. Minimum distance boundary and per-km pricing
    const baseDist = Number(pricing.base_distance_km) || 5;
    const minFee = Number(pricing.min_distance_fee) || Number(pricing.under_1kg) || 50;
    const perKm = Number(pricing.extra_per_km) || 12;

    const distanceKm = req.body.distanceKm ? Math.max(0.5, Number(req.body.distanceKm)) : 3.5;
    let distFee = minFee;
    if (distanceKm > baseDist) {
      distFee = minFee + Math.ceil((distanceKm - baseDist) * perKm);
    }

    const weight = Number(req.body.weight) || 1;
    let weightSurcharge = 0;
    if (weight > 5) {
      weightSurcharge = (Number(pricing.tier_above_5kg) || 150) - (Number(pricing.under_1kg) || 40);
    } else if (weight > 1) {
      weightSurcharge = (Number(pricing.tier_1_to_5kg) || 80) - (Number(pricing.under_1kg) || 40);
    }
    const baseFee = distFee + Math.max(0, weightSurcharge);

    const itemValue = req.body.itemValue ? Number(req.body.itemValue) : null;
    let fee = baseFee;
    let offerApplied = '';

    // Check delivery offer discount if active
    const offer = pricing.delivery_offer;
    if (offer && offer.active) {
      const now = new Date();
      if (offer.type === 'timed_window') {
        const start = offer.start_date ? new Date(offer.start_date) : null;
        const end = offer.end_date ? new Date(offer.end_date) : null;
        const notStarted = start && now < start;
        const expired = end && now > end;
        if (!notStarted && !expired) {
          fee = 0;
          offerApplied = offer.title || 'Limited-Time Free Delivery';
        }
      }
    }

    const itemPaid = Boolean(req.body.itemPaid);
    const paymentMethod = itemPaid ? (req.body.paymentMethod || 'prepaid') : 'cod';
    const paymentStatus = req.body.paymentStatus || (itemPaid ? 'pending_agent_verification' : 'pending_pickup');
    const utrId = req.body.utrId || req.body.txnId || '';
    const accountHolderName = req.body.accountHolderName || req.body.payerName || req.user.name;
    const totalPayable = itemValue ? fee + itemValue : fee;

    const orderId = await getNextOrderId();

    // Determine real coordinates: use client coordinates if passed, or geocode the address / map link
    let pickupLat = req.body.pickupCoords?.lat != null ? Number(req.body.pickupCoords.lat) : null;
    let pickupLng = req.body.pickupCoords?.lng != null ? Number(req.body.pickupCoords.lng) : null;
    let dropLat = req.body.dropCoords?.lat != null ? Number(req.body.dropCoords.lat) : null;
    let dropLng = req.body.dropCoords?.lng != null ? Number(req.body.dropCoords.lng) : null;

    if ((pickupLat == null || pickupLng == null) && pickupMapLink) {
      const resolved = await parseMapLinkOrAddress(pickupMapLink);
      if (resolved) {
        pickupLat = resolved.lat;
        pickupLng = resolved.lng;
      }
    }

    if ((dropLat == null || dropLng == null) && dropMapLink) {
      const resolved = await parseMapLinkOrAddress(dropMapLink);
      if (resolved) {
        dropLat = resolved.lat;
        dropLng = resolved.lng;
      }
    }

    if ((pickupLat == null || pickupLng == null) && req.body.pickup) {
      const geo = await parseMapLinkOrAddress(req.body.pickup);
      if (geo) {
        pickupLat = geo.lat;
        pickupLng = geo.lng;
      }
    }

    if ((dropLat == null || dropLng == null) && req.body.drop) {
      const geo = await parseMapLinkOrAddress(req.body.drop);
      if (geo) {
        dropLat = geo.lat;
        dropLng = geo.lng;
      }
    }

    // Preserve real coordinates if provided, otherwise leave as null so unpinned orders are explicit
    const pickupFinalLat = pickupLat != null ? Number(pickupLat) : null;
    const pickupFinalLng = pickupLng != null ? Number(pickupLng) : null;
    const dropFinalLat = dropLat != null ? Number(dropLat) : null;
    const dropFinalLng = dropLng != null ? Number(dropLng) : null;

    const recipientEmail = req.user.email || req.body.email || '';

    const order = await Order.create({
      id: orderId,
      userId: req.user._id.toString(),
      userName: req.user.name,
      userEmail: recipientEmail,
      pickup: {
        address: pickupAddress,
        state: pickupState,
        district: pickupDistrict,
        lat: pickupFinalLat,
        lng: pickupFinalLng,
        mapLink: pickupMapLink,
      },
      drop: {
        address: dropAddress,
        state: dropState,
        district: dropDistrict,
        lat: dropFinalLat,
        lng: dropFinalLng,
        mapLink: dropMapLink,
      },
      distanceKm,
      pkg: {
        type: req.body.type || 'Standard',
        weight,
        desc: req.body.desc || '',
      },
      notes: req.body.notes || '',
      status: 'Placed',
      agentId: null,
      agentName: null,
      history: [{ status: 'Placed', at: new Date() }],
      agentLoc: null,
      rating: null,
      deliveryFee: fee,
      originalDeliveryFee: baseFee,
      offerApplied: offerApplied || '',
      itemPaid,
      utrId,
      accountHolderName,
      itemValue,
      itemDesc: req.body.itemDesc || (itemValue ? `${req.body.type} Goods` : ''),
      totalPayable,
      paymentMethod,
      paymentStatus,
      txnId: utrId || req.body.txnId || (paymentStatus === 'verified' ? `PP${Date.now()}` : ''),
      payerName: accountHolderName,
      cancellationFee: pricing.cancellation_fee,
    });

    const io = getIO();
    if (io) {
      io.emit('orderCreated', order.toJSON());
      io.emit('orderStatusUpdated', { orderId: order.id, order: order.toJSON() });
    }
    notify('admin', `New order ${order.id} placed by ${req.user.name} (Fee: ₹${fee})`, order.id);

    // Automatically send official Tax Invoice with PDF to customer's registered email
    if (recipientEmail) {
      (async () => {
        try {
          await sendBookingInvoiceEmail(order.toJSON(), recipientEmail, req.user.name);
          console.log(`[Email] Automatic booking tax invoice PDF sent to ${recipientEmail} for order #${order.id}`);
        } catch (emailErr) {
          console.error('[Email Error] Failed sending automatic booking tax invoice:', emailErr.message);
        }
      })();
    }

    return res.status(201).json(order.toJSON());
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/orders/:id/send-invoice
// @desc    Manually resend booking tax invoice to registered email
router.post('/:id/send-invoice', protect, async (req, res) => {
  try {
    const order = await Order.findOne({ id: { $regex: new RegExp(`^${req.params.id}$`, 'i') } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Check permissions
    if (req.user.role !== 'admin' && order.userId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to send invoice for this order' });
    }

    const recipientEmail = req.user.email || order.userEmail;
    if (!recipientEmail) {
      return res.status(400).json({ message: 'No registered email found for this user' });
    }

    const result = await sendBookingInvoiceEmail(order.toJSON(), recipientEmail, req.user.name);
    if (result.ok) {
      return res.json({ ok: true, message: `Tax invoice with PDF sent to ${recipientEmail}`, messageId: result.messageId });
    } else {
      return res.status(500).json({ ok: false, message: result.error || 'Failed to send invoice email' });
    }
  } catch (err) {
    console.error('Resend invoice error:', err);
    return res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/orders/:id/send-delivered-email
// @desc    Send / resend delivered order celebration email with Thank You & Order Again CTA
router.post('/:id/send-delivered-email', protect, async (req, res) => {
  try {
    const order = await Order.findOne({ id: { $regex: new RegExp(`^${req.params.id}$`, 'i') } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    let targetEmail = order.userEmail || req.user.email;
    let targetName = order.userName || req.user.name;

    if (!targetEmail && order.userId) {
      const u = await User.findById(order.userId);
      if (u) {
        targetEmail = u.email;
        targetName = u.name;
      }
    }

    if (!targetEmail) {
      return res.status(400).json({ message: 'No registered customer email found for this order' });
    }

    const result = await sendOrderDeliveredEmail(order.toJSON(), targetEmail, targetName);
    if (result.ok) {
      return res.json({ ok: true, message: `Delivered celebration email sent to ${targetEmail}`, messageId: result.messageId });
    } else {
      return res.status(500).json({ ok: false, message: result.error || 'Failed to send delivered email' });
    }
  } catch (err) {
    console.error('Send delivered email error:', err);
    return res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/orders/:id/feedback
// @desc    Submit customer feedback and rating for delivered order (Customer/User only, NOT delivery agent)
router.post('/:id/feedback', async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    const numRating = Number(rating);

    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({ message: 'Rating must be an integer between 1 and 5 stars' });
    }

    const order = await Order.findOne({ id: { $regex: new RegExp(`^${req.params.id}$`, 'i') } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.status !== 'Delivered') {
      return res.status(400).json({ message: 'Feedback can only be provided after the package is delivered' });
    }

    // Check auth header if present
    let authUser = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = (await import('jsonwebtoken')).default;
        const token = authHeader.split(' ')[1];
        let decoded = null;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET || 'delivery_tracker_jwt_secret_2026_super_secure');
        } catch (e) {
          decoded = jwt.verify(token, 'delivery_tracker_jwt_secret_2026');
        }
        if (decoded && decoded.id) {
          authUser = await User.findById(decoded.id);
        }
      } catch (tokenErr) {
        // If invalid token, proceed with public feedback
      }
    }

    // STRICT CHECK: Delivery agents CANNOT rate or submit feedback!
    if (authUser && authUser.role === 'agent') {
      return res.status(403).json({
        message: 'Only the customer or recipient can submit feedback. Delivery agents cannot rate or review their own orders.',
      });
    }

    order.rating = Math.round(numRating);
    order.feedback = String(feedback || '').trim();
    order.feedbackAt = new Date();

    await order.save();
    emitOrderUpdate(order.id, order, { rating: order.rating, feedback: order.feedback });

    notify('admin', `Customer ${order.userName} submitted ${order.rating}★ rating for order #${order.id}${order.feedback ? `: "${order.feedback}"` : ''}`, order.id);
    if (order.agentId) {
      notify(order.agentId, `Customer ${order.userName} rated your delivery for order #${order.id}: ${order.rating}★!`, order.id);
    }

    return res.json({
      ok: true,
      message: 'Feedback submitted successfully. Thank you for your review!',
      order: order.toJSON(),
    });
  } catch (err) {
    console.error('Feedback submission error:', err);
    return res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/orders/:id/invoice-pdf
// @desc    Download official Tax Invoice PDF
router.get('/:id/invoice-pdf', async (req, res) => {
  try {
    const order = await Order.findOne({ id: { $regex: new RegExp(`^${req.params.id}$`, 'i') } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const pdfBuffer = await generateInvoicePdfBuffer(order.toJSON(), order.userEmail || '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Tax_Invoice_${order.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Download PDF error:', err);
    return res.status(500).json({ message: 'Failed to generate PDF' });
  }
});

// @route   PATCH /api/orders/:id/status
// @desc    Update order delivery status
router.patch('/:id/status', protect, agentOrAdmin, async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ message: 'Status is required' });

  try {
    const order = await Order.findOne({ id: req.params.id });
    const isPrepaid = order.itemPaid || order.paymentMethod === 'prepaid' || (Boolean(order.utrId) && order.paymentMethod !== 'cod');
    if ((status === 'Picked-up' || status === 'In-Transit') && isPrepaid && order.paymentStatus !== 'verified' && order.paymentStatus !== 'paid') {
      return res.status(400).json({
        message: 'Prepaid order payment must be verified before pickup! Please verify the customer UTR or wait for the fee payment.',
      });
    }

    order.status = status;
    order.history.push({ status, at: new Date() });

    if (status === 'Delivered') {
      order.agentLoc = null;
      // Note: rating is left for the customer/user to provide, NOT automatically set by agent

      // Send delivered confirmation email with Thank You & Order Again CTA to registered email
      (async () => {
        try {
          let customerEmail = order.userEmail;
          let customerName = order.userName;
          if (!customerEmail && order.userId) {
            const u = await User.findById(order.userId);
            if (u) {
              customerEmail = u.email;
              customerName = u.name;
            }
          }
          if (customerEmail) {
            console.log(`[Order Status] Order ${order.id} is Delivered. Sending confirmation email to ${customerEmail}...`);
            await sendOrderDeliveredEmail(order, customerEmail, customerName);
          } else {
            console.warn(`[Order Status] No customer email found for delivered order ${order.id}`);
          }
        } catch (mailErr) {
          console.error(`[Order Status] Error sending delivered email for ${order.id}:`, mailErr.message);
        }
      })();
    }

    await order.save();
    emitOrderUpdate(order.id, order, { status });

    notify(order.userId, `Order ${order.id} is now ${status}`, order.id);
    notify('admin', `Order ${order.id} marked ${status} by ${req.user.name}`, order.id);

    return res.json(order.toJSON());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   PATCH /api/orders/:id/location
// @desc    Update exact drop/pickup coordinates (Customer, Agent or Admin)
router.patch('/:id/location', protect, async (req, res) => {
  try {
    const { dropCoords, dropAddress, dropMapLink, pickupCoords, pickupAddress, pickupMapLink } = req.body;
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Customer can update their drop location; Agent/Admin can update locations
    const isOwner = order.userId === req.user._id.toString();
    const isAgent = order.agentId === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAgent && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to update location for this order' });
    }

    if (pickupMapLink) {
      order.pickup.mapLink = pickupMapLink;
      const resolved = await parseMapLinkOrAddress(pickupMapLink);
      if (resolved) {
        order.pickup.lat = resolved.lat;
        order.pickup.lng = resolved.lng;
        if (!pickupAddress) order.pickup.address = resolved.formattedAddress;
      }
    }

    if (dropMapLink) {
      order.drop.mapLink = dropMapLink;
      const resolved = await parseMapLinkOrAddress(dropMapLink);
      if (resolved) {
        order.drop.lat = resolved.lat;
        order.drop.lng = resolved.lng;
        if (!dropAddress) order.drop.address = resolved.formattedAddress;
      }
    }

    if (dropCoords && dropCoords.lat != null && dropCoords.lng != null) {
      order.drop.lat = Number(dropCoords.lat);
      order.drop.lng = Number(dropCoords.lng);
      if (dropAddress) order.drop.address = dropAddress;
    } else if (dropAddress) {
      order.drop.address = dropAddress;
      const geo = await parseMapLinkOrAddress(dropAddress);
      if (geo) {
        order.drop.lat = geo.lat;
        order.drop.lng = geo.lng;
      }
    }

    if (pickupCoords && pickupCoords.lat != null && pickupCoords.lng != null) {
      order.pickup.lat = Number(pickupCoords.lat);
      order.pickup.lng = Number(pickupCoords.lng);
      if (pickupAddress) order.pickup.address = pickupAddress;
    } else if (pickupAddress) {
      order.pickup.address = pickupAddress;
      const geo = await geocodeAddress(pickupAddress);
      if (geo) {
        order.pickup.lat = geo.lat;
        order.pickup.lng = geo.lng;
      }
    }

    if (req.body.agentLoc && req.body.agentLoc.lat != null && req.body.agentLoc.lng != null) {
      order.agentLoc = {
        lat: Number(req.body.agentLoc.lat),
        lng: Number(req.body.agentLoc.lng),
        isExact: true,
        lastUpdate: Date.now(),
      };
    }

    if (req.body.distanceKm != null) {
      order.distanceKm = Number(req.body.distanceKm);
    }
    if (req.body.durationMins != null) {
      order.durationMins = Number(req.body.durationMins);
    }

    await order.save();

    const io = getIO();
    if (io) {
      io.emit('orderLocationUpdated', {
        orderId: order.id,
        drop: order.drop,
        pickup: order.pickup,
        agentLoc: order.agentLoc,
        distanceKm: order.distanceKm,
        durationMins: order.durationMins,
      });
    }

    return res.json(order.toJSON());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   PATCH /api/orders/:id/assign
// @desc    Assign delivery agent to order
router.patch('/:id/assign', protect, async (req, res) => {
  const { agentId } = req.body;
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const agent = await User.findById(agentId);
    if (!agent) return res.status(404).json({ message: 'Agent not found' });

    order.agentId = agent._id.toString();
    order.agentName = agent.name;
    await order.save();

    const io = getIO();
    if (io) {
      io.emit('orderAssigned', { orderId: order.id, agentId: order.agentId, order: order.toJSON() });
      io.emit('orderStatusUpdated', { orderId: order.id, order: order.toJSON() });
    }

    notify(agent._id.toString(), `New delivery assigned: ${order.id}`, order.id);
    notify(order.userId, `${agent.name} was assigned to deliver order ${order.id}`, order.id);

    return res.json(order.toJSON());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   PATCH /api/orders/:id/payment-verification
// @desc    Verify or dispute order payment (Agent / Admin)
router.patch('/:id/payment-verification', protect, agentOrAdmin, async (req, res) => {
  const { verified, updatedAmount, reason } = req.body;

  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.paymentStatus = verified ? 'verified' : 'not_verified';
    if (!verified) {
      if (updatedAmount) {
        order.deliveryFee = Number(updatedAmount);
        order.totalPayable = Number(updatedAmount) + (order.itemValue || 0);
        order.updatedFee = Number(updatedAmount);
      }
      if (reason) order.verificationNote = reason;
      order.agentDisputed = true;
    } else {
      order.verificationNote = 'Verified by agent/admin';
      order.agentDisputed = false;
      order.paidAt = new Date();
      order.itemPaid = true;
    }

    await order.save();
    emitOrderUpdate(order.id, order);

    notify(
      order.userId,
      verified
        ? `Payment verified for order ${order.id}. Official receipt & tax invoice sent to your email.`
        : `Payment could NOT be verified for order ${order.id}. Updated fee: ₹${order.deliveryFee}. Please pay via PhonePe QR / Card.`,
      order.id
    );

    // Send verified Tax Invoice with PDF to customer's registered email
    if (verified) {
      (async () => {
        try {
          let email = order.userEmail;
          if (!email && order.userId) {
            const customer = await User.findById(order.userId);
            if (customer) email = customer.email;
          }
          if (email) {
            await sendBookingInvoiceEmail(order.toJSON(), email, order.userName);
            console.log(`[Email] Verified invoice sent to customer ${email} for order #${order.id}`);
          }
        } catch (emailErr) {
          console.error('[Email Error] Failed sending verified invoice:', emailErr.message);
        }
      })();
    }

    return res.json(order.toJSON());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   PATCH /api/orders/:id/item-value
// @desc    Agent adds or updates ordered item value for COD orders
router.patch('/:id/item-value', protect, agentOrAdmin, async (req, res) => {
  const { itemValue, itemDesc } = req.body;

  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.itemValue = Number(itemValue) || 0;
    if (itemDesc) order.itemDesc = itemDesc;
    order.totalPayable = (order.deliveryFee || 40) + order.itemValue;

    await order.save();
    emitOrderUpdate(order.id, order);

    notify(
      order.userId,
      `Agent added item value: ₹${order.itemValue}. Total Bill Due: ₹${order.totalPayable}. You can pay online or on delivery.`,
      order.id
    );
    notify('admin', `Agent updated item value for order ${order.id}: ₹${order.itemValue}`, order.id);

    // If customer has not paid the bill, send updated bill with PDF to customer's registered email
    (async () => {
      try {
        let email = order.userEmail;
        if (!email && order.userId) {
          const customer = await User.findById(order.userId);
          if (customer) email = customer.email;
        }
        if (email) {
          await sendBookingInvoiceEmail(order.toJSON(), email, order.userName);
          console.log(`[Email] Updated item bill sent to customer ${email} for order #${order.id}`);
        }
      } catch (emailErr) {
        console.error('[Email Error] Failed sending item price invoice:', emailErr.message);
      }
    })();

    return res.json(order.toJSON());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   PATCH /api/orders/:id/resubmit-payment
// @desc    Customer resubmits payment details after dispute
router.patch('/:id/resubmit-payment', protect, async (req, res) => {
  const { txnId, payerName } = req.body;

  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.txnId = txnId;
    order.utrId = txnId;
    order.payerName = payerName;
    order.accountHolderName = payerName;
    order.paymentStatus = 'pending_verification';

    await order.save();
    emitOrderUpdate(order.id, order);

    notify('admin', `Payment resubmitted for order ${order.id} by ${order.userName}`, order.id);
    if (order.agentId) notify(order.agentId, `Customer resubmitted payment for order ${order.id}`, order.id);

    return res.json(order.toJSON());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/orders/:id/cancel
// @desc    Cancel order & record cancellation fee payment
router.post('/:id/cancel', protect, async (req, res) => {
  const { txnId, method } = req.body;

  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const pricing = (await Pricing.findOne()) || { cancellation_fee: 30 };

    order.status = 'Cancelled';
    order.cancellationFeeApplied = order.cancellationFee || pricing.cancellation_fee;
    order.cancellationTxnId = txnId || `CAN${Date.now()}`;
    order.cancellationPaymentMethod = method || 'PhonePe UPI';
    order.cancellationFeePaid = true;
    order.history.push({ status: 'Cancelled', at: new Date() });

    await order.save();
    emitOrderUpdate(order.id, order, { status: 'Cancelled' });

    notify(
      order.userId,
      `Order ${order.id} cancelled. Mandatory fee ₹${order.cancellationFeeApplied} paid via ${order.cancellationPaymentMethod}.`,
      order.id
    );
    notify('admin', `Order ${order.id} cancelled by ${req.user.name}`, order.id);

    return res.json(order.toJSON());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/orders/:id/collect-payment
// @desc    Collect payment via PhonePe QR / COD
router.post('/:id/collect-payment', protect, async (req, res) => {
  const { txnId, method, amount } = req.body;

  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.paymentStatus = 'verified';
    order.agentDisputed = false;
    order.itemPaid = true;
    if (txnId) order.txnId = txnId;
    if (method) order.paymentMethod = method;
    order.paidAt = new Date();

    await order.save();
    emitOrderUpdate(order.id, order);

    const collectedAmt = amount || order.totalPayable || order.deliveryFee || 40;
    notify(order.userId, `Payment of ₹${collectedAmt} received for order ${order.id}. Paid Tax Invoice sent to your email.`, order.id);
    notify('admin', `Payment of ₹${collectedAmt} collected for order ${order.id}`, order.id);
    if (order.agentId) notify(order.agentId, `Payment of ₹${collectedAmt} confirmed for order ${order.id}`, order.id);

    // Send official Paid Tax Invoice with PDF to customer
    (async () => {
      try {
        let email = order.userEmail;
        if (!email && order.userId) {
          const customer = await User.findById(order.userId);
          if (customer) email = customer.email;
        }
        if (email) {
          await sendBookingInvoiceEmail(order.toJSON(), email, order.userName);
          console.log(`[Email] Paid invoice sent to customer ${email} for order #${order.id}`);
        }
      } catch (emailErr) {
        console.error('[Email Error] Failed sending paid invoice:', emailErr.message);
      }
    })();

    return res.json(order.toJSON());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   DELETE /api/orders/all
// @desc    Delete all orders permanently (Central bulk delete for Admin)
router.delete('/all', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can delete all orders' });
    }
    const result = await Order.deleteMany({});
    const io = getIO();
    if (io) {
      io.emit('allOrdersDeleted', { deletedCount: result.deletedCount });
      io.emit('orderStatusUpdated', { orderId: null, allDeleted: true });
    }
    notify('admin', `All ${result.deletedCount} orders were permanently deleted from database by ${req.user.name}`);
    return res.json({ ok: true, deletedCount: result.deletedCount, permanentlyDeleted: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   DELETE /api/orders/:id
// @desc    Delete single order permanently by ID (Admin, Customer, or Agent)
router.delete('/:id', protect, async (req, res) => {
  try {
    const isHex = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    const filter = isHex
      ? { $or: [{ id: req.params.id }, { _id: req.params.id }] }
      : { id: req.params.id };

    const order = await Order.findOne(filter);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Authorization: Admin can delete any order. Customer can delete their order. Agent can delete assigned order.
    if (req.user.role === 'user' && order.userId !== req.user._id.toString() && order.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this order' });
    }
    if (req.user.role === 'agent' && order.agentId !== req.user._id.toString() && order.agentId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this order' });
    }

    // Permanently remove from database
    await Order.deleteOne({ _id: order._id });

    const io = getIO();
    if (io) {
      io.emit('orderDeleted', { orderId: order.id, id: order.id });
      io.emit('orderStatusUpdated', { orderId: order.id, deleted: true });
    }
    notify('admin', `Order ${order.id} was permanently deleted by ${req.user.name} (${req.user.role})`, order.id);

    return res.json({ ok: true, id: order.id, permanentlyDeleted: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

export default router;
