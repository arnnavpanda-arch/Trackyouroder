import express from 'express';
import { User } from '../models/User.js';
import { protect, adminOrDistrictAdmin, adminOnly } from '../middleware/auth.js';
import { getIO } from '../socket.js';
import { sendAgentApprovedEmail, sendAgentRejectedEmail } from '../utils/emailService.js';

const router = express.Router();

// Allow Admin and District Admin access
router.use(protect, adminOrDistrictAdmin);

// @route   GET /api/users
// @desc    List all users (filtered by district if district_admin)
router.get('/', async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'district_admin' && req.user.district) {
      filter = {
        district: req.user.district,
        role: { $in: ['agent', 'user'] }
      };
    }
    const users = await User.find(filter).sort({ createdAt: -1 });
    return res.json(users.map((u) => u.toJSON()));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/users
// @desc    Create a new user / agent / district_admin
router.post('/', async (req, res) => {
  const { name, email, password, role, phone, active, state, district, displayPassword } = req.body;

  try {
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: password || 'user123',
      displayPassword: displayPassword || password || '',
      role: role || 'user',
      phone: phone || '',
      state: state || '',
      district: district || '',
      active: active !== undefined ? active : true,
    });

    return res.status(201).json(user.toJSON());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
router.put('/:id', async (req, res) => {
  const { name, email, role, phone, active, password, state, district, displayPassword } = req.body;

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (email && email.toLowerCase() !== user.email) {
      const exists = await User.findOne({ email: email.toLowerCase() });
      if (exists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = email.toLowerCase();
    }

    if (name) user.name = name;
    if (role) user.role = role;
    if (phone !== undefined) user.phone = phone;
    if (active !== undefined) user.active = active;
    if (state !== undefined) user.state = state;
    if (district !== undefined) user.district = district;
    if (displayPassword !== undefined) user.displayPassword = displayPassword;
    if (password) {
      user.password = password;
      if (!displayPassword) user.displayPassword = password;
    }

    await user.save();
    return res.json(user.toJSON());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user permanently
router.delete('/:id', async (req, res) => {
  try {
    const isHex = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    const filter = isHex
      ? { $or: [{ _id: req.params.id }, { id: req.params.id }] }
      : { id: req.params.id };

    const user = await User.findOne(filter);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.deleteOne({ _id: user._id });

    const io = getIO();
    if (io) {
      io.emit('userDeleted', { userId: user._id.toString(), id: user.id || req.params.id });
    }

    return res.json({ ok: true, id: req.params.id, permanentlyDeleted: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   PATCH /api/users/:id/toggle
// @desc    Toggle user active status
router.patch('/:id/toggle', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.active = !user.active;
    await user.save();
    return res.json(user.toJSON());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   PATCH /api/users/:id/approval
// @desc    Approve or reject a delivery agent account (Admin only)
router.patch('/:id/approval', async (req, res) => {
  const { approved, remarks } = req.body;
  try {
    const isHex = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    const filter = isHex
      ? { $or: [{ _id: req.params.id }, { id: req.params.id }] }
      : { id: req.params.id };

    const user = await User.findOne(filter);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'agent') {
      return res.status(400).json({ message: 'Only delivery agent accounts require administrative approval' });
    }

    if (req.user.role === 'district_admin' && req.user.district) {
      if ((user.district || '').trim().toLowerCase() !== req.user.district.trim().toLowerCase()) {
        return res.status(403).json({ message: `Access denied: You can only review agents registered in ${req.user.district}` });
      }
    }

    user.isApproved = Boolean(approved);
    user.approvalStatus = approved ? 'approved' : 'rejected';
    user.approvalRemarks = remarks ? String(remarks).trim() : '';
    if (approved) {
      user.approvedAt = new Date();
      user.active = true;
    }
    await user.save();

    // Send email notification to agent (approved or rejected)
    if (approved) {
      sendAgentApprovedEmail(user).catch((e) => console.error('[Email Error] Agent approval mail failed:', e.message));
    } else {
      sendAgentRejectedEmail(user, remarks).catch((e) => console.error('[Email Error] Agent rejection mail failed:', e.message));
    }

    const io = getIO();
    if (io) {
      io.emit('userUpdated', user.toJSON());
      io.emit('agentApprovalChanged', {
        userId: user._id.toString(),
        isApproved: user.isApproved,
        approvalStatus: user.approvalStatus,
        remarks: user.approvalRemarks,
      });
    }

    return res.json({
      ok: true,
      message: approved ? 'Agent account approved successfully' : 'Agent application rejected',
      user: user.toJSON(),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

export default router;
