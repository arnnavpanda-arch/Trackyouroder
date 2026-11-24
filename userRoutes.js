import express from 'express';
import { User } from '../models/User.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { getIO } from '../socket.js';

const router = express.Router();

// All user management routes require admin role
router.use(protect, adminOnly);

// @route   GET /api/users
// @desc    List all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    return res.json(users.map((u) => u.toJSON()));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/users
// @desc    Create a new user
router.post('/', async (req, res) => {
  const { name, email, password, role, phone, active } = req.body;

  try {
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: password || 'user123',
      role: role || 'user',
      phone: phone || '',
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
  const { name, email, role, phone, active, password } = req.body;

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
    if (password) user.password = password;

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

export default router;
