import express from 'express';
import { Settings } from '../models/Settings.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { getIO } from '../socket.js';
import { getDefaultServiceableRegions } from '../utils/indiaGeoData.js';

const router = express.Router();

// @route   GET /api/settings
// @desc    Get public system settings (Copyright, Privacy Policy, Terms & Conditions)
router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    } else if (!settings.serviceable_regions || settings.serviceable_regions.length === 0) {
      settings.serviceable_regions = getDefaultServiceableRegions();
      await settings.save();
    }
    return res.json(settings.toJSON());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/settings
// @desc    Update system settings (Admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  const {
    company_name,
    company_address,
    company_pan,
    company_gstin,
    copyright_text,
    support_email,
    support_phone,
    privacy_policy,
    terms_conditions,
    logo_url,
    google_maps_api_key,
    serviceable_regions,
  } = req.body;

  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    if (company_name !== undefined) settings.company_name = company_name;
    if (company_address !== undefined) settings.company_address = company_address;
    if (company_pan !== undefined) settings.company_pan = company_pan;
    if (company_gstin !== undefined) settings.company_gstin = company_gstin;
    if (copyright_text !== undefined) settings.copyright_text = copyright_text;
    if (support_email !== undefined) settings.support_email = support_email;
    if (support_phone !== undefined) settings.support_phone = support_phone;
    if (privacy_policy !== undefined) settings.privacy_policy = privacy_policy;
    if (terms_conditions !== undefined) settings.terms_conditions = terms_conditions;
    if (logo_url !== undefined) settings.logo_url = logo_url;
    if (google_maps_api_key !== undefined) settings.google_maps_api_key = google_maps_api_key;
    if (serviceable_regions !== undefined) settings.serviceable_regions = serviceable_regions;

    await settings.save();

    const io = getIO();
    if (io) {
      io.emit('settingsUpdated', settings.toJSON());
    }

    return res.json(settings.toJSON());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

export default router;
