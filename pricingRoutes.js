import express from 'express';
import { Pricing } from '../models/Pricing.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { getIO } from '../socket.js';

const router = express.Router();

// @route   GET /api/pricing
// @desc    Get pricing rules
router.get('/', async (req, res) => {
  try {
    let pricing = await Pricing.findOne();
    if (!pricing) {
      pricing = await Pricing.create({
        base_fee: 40,
        base_weight_kg: 2,
        extra_per_kg: 15,
        cancellation_fee: 30,
      });
    }
    return res.json(pricing.toJSON());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/pricing
// @desc    Update pricing rules and delivery offer (Admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  const {
    base_fee,
    base_weight_kg,
    extra_per_kg,
    under_1kg,
    tier_1_to_5kg,
    tier_above_5kg,
    base_distance_km,
    min_distance_fee,
    extra_per_km,
    cancellation_fee,
    delivery_offer,
  } = req.body;

  try {
    let pricing = await Pricing.findOne();
    if (!pricing) {
      pricing = new Pricing();
    }

    if (base_fee !== undefined) pricing.base_fee = Number(base_fee);
    if (base_weight_kg !== undefined) pricing.base_weight_kg = Number(base_weight_kg);
    if (extra_per_kg !== undefined) pricing.extra_per_kg = Number(extra_per_kg);
    if (under_1kg !== undefined) pricing.under_1kg = Number(under_1kg);
    if (tier_1_to_5kg !== undefined) pricing.tier_1_to_5kg = Number(tier_1_to_5kg);
    if (tier_above_5kg !== undefined) pricing.tier_above_5kg = Number(tier_above_5kg);
    if (base_distance_km !== undefined) pricing.base_distance_km = Number(base_distance_km);
    if (min_distance_fee !== undefined) pricing.min_distance_fee = Number(min_distance_fee);
    if (extra_per_km !== undefined) pricing.extra_per_km = Number(extra_per_km);
    if (cancellation_fee !== undefined) pricing.cancellation_fee = Number(cancellation_fee);
    if (delivery_offer !== undefined) {
      pricing.delivery_offer = {
        ...pricing.delivery_offer,
        ...delivery_offer,
        updatedAt: new Date(),
      };
    }

    await pricing.save();

    const io = getIO();
    if (io) {
      io.emit('pricingUpdated', pricing.toJSON());
      if (pricing.delivery_offer) {
        io.emit('offerUpdated', pricing.delivery_offer);
      }
    }

    return res.json(pricing.toJSON());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/pricing/offer
// @desc    Update delivery offer (Admin only)
router.post('/offer', protect, adminOnly, async (req, res) => {
  try {
    let pricing = await Pricing.findOne();
    if (!pricing) {
      pricing = new Pricing();
    }

    const offerData = req.body || {};
    pricing.delivery_offer = {
      active: Boolean(offerData.active),
      type: offerData.type || 'none',
      min_amount: Number(offerData.min_amount) || 500,
      start_date: offerData.start_date ? new Date(offerData.start_date) : null,
      end_date: offerData.end_date ? new Date(offerData.end_date) : null,
      title: offerData.title || '',
      banner_text: offerData.banner_text || '',
      updatedAt: new Date(),
    };

    await pricing.save();

    const io = getIO();
    if (io) {
      io.emit('pricingUpdated', pricing.toJSON());
      io.emit('offerUpdated', pricing.delivery_offer);
    }

    return res.json(pricing.toJSON());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

export default router;
