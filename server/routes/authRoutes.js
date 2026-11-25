import express from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Settings } from '../models/Settings.js';
import { protect } from '../middleware/auth.js';
import { isRegionEligible } from '../utils/indiaGeoData.js';

const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'delivery_tracker_jwt_secret_2026', {
    expiresIn: '30d',
  });
};

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
  const identifier = (req.body.email || req.body.userId || req.body.username || '').trim();
  const { password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ message: 'User ID / Email and password are required' });
  }

  try {
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { phone: identifier },
      ],
    });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials. Please verify your User ID / Email and password.' });
    }

    if (!user.active) {
      return res.status(403).json({ message: 'This account has been deactivated' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user._id);

    return res.json({
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: err.message || 'Server error during login', error: err.message });
  }
});

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', async (req, res) => {
  const { name, email, password, role, phone, state, district, agentDetails } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  if (role === 'admin') {
    return res.status(403).json({ message: 'Administrator accounts cannot be created publicly.' });
  }

  try {
    const [exists, settings] = await Promise.all([
      User.findOne({ email: email.toLowerCase() }).lean(),
      role !== 'admin' ? Settings.findOne().lean() : null,
    ]);

    if (exists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Check serviceable region approval by admin (mandatory for users and agents)
    if (role !== 'admin') {
      if (!state || !state.trim()) {
        return res.status(400).json({ message: 'State selection is required for registration' });
      }
      if (!district || !district.trim()) {
        return res.status(400).json({ message: 'District selection is required for registration' });
      }
      if (settings?.serviceable_regions?.length > 0) {
        const eligible = isRegionEligible(state, district, settings.serviceable_regions);
        if (!eligible) {
          return res.status(400).json({
            message: `Registration restricted: Service is not approved in ${state}${district ? ` (${district})` : ''}. Only admin-approved states & districts are eligible to create an account.`
          });
        }
      }
    }

    const isAgent = role === 'agent';
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: role || 'user',
      phone: phone || '',
      state: (state || '').trim(),
      district: (district || '').trim(),
      isApproved: !isAgent,
      approvalStatus: isAgent ? 'pending' : 'approved',
      agentDetails: isAgent
        ? {
            vehicleType: agentDetails?.vehicleType || 'Bike',
            vehicleNumber: (agentDetails?.vehicleNumber || '').trim(),
            drivingLicense: (agentDetails?.drivingLicense || '').trim(),
            emergencyContact: (agentDetails?.emergencyContact || '').trim(),
            experienceYears: agentDetails?.experienceYears || '',
          }
        : undefined,
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Server error during registration' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
router.get('/me', protect, async (req, res) => {
  return res.json(req.user.toJSON());
});

export default router;
