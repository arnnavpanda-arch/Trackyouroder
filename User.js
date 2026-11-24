import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'agent', 'admin'],
      default: 'user',
    },
    phone: {
      type: String,
      default: '',
    },
    state: {
      type: String,
      default: '',
      trim: true,
    },
    district: {
      type: String,
      default: '',
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      },
    },
  }
);

// Hash password before saving if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to verify password
userSchema.methods.comparePassword = async function (enteredPassword) {
  // Support bcrypt comparison or legacy plain match
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
    return bcrypt.compare(enteredPassword, this.password);
  }
  return enteredPassword === this.password;
};

export const User = mongoose.model('User', userSchema);
