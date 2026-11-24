import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export const protect = async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'delivery_tracker_jwt_secret_2026';
    
    // Support JWT tokens
    let userId = null;
    try {
      const decoded = jwt.verify(token, secret);
      userId = decoded.id;
    } catch (jwtErr) {
      // Support legacy/mock- prefix tokens (e.g. mock-u1 or direct ID)
      if (token.startsWith('mock-')) {
        const legacyId = token.replace('mock-', '');
        const found = await User.findOne({ $or: [{ _id: legacyId.match(/^[0-9a-fA-F]{24}$/) ? legacyId : null }, { email: `${legacyId}@demo.com` }] });
        if (found) userId = found._id;
      }
    }

    if (!userId) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!user.active) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied: Admin role required' });
};

export const agentOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'agent' || req.user.role === 'admin')) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied: Agent or Admin role required' });
};
