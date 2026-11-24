import mongoose from 'mongoose';

const pricingSchema = new mongoose.Schema(
  {
    base_fee: {
      type: Number,
      default: 40,
    },
    base_weight_kg: {
      type: Number,
      default: 2,
    },
    extra_per_kg: {
      type: Number,
      default: 15,
    },
    under_1kg: {
      type: Number,
      default: 40,
    },
    tier_1_to_5kg: {
      type: Number,
      default: 80,
    },
    tier_above_5kg: {
      type: Number,
      default: 150,
    },
    base_distance_km: {
      type: Number,
      default: 5,
    },
    min_distance_fee: {
      type: Number,
      default: 50,
    },
    extra_per_km: {
      type: Number,
      default: 12,
    },
    cancellation_fee: {
      type: Number,
      default: 30,
    },
    delivery_offer: {
      active: {
        type: Boolean,
        default: false,
      },
      type: {
        type: String,
        enum: ['min_amount', 'timed_window', 'none'],
        default: 'none',
      },
      min_amount: {
        type: Number,
        default: 500,
      },
      start_date: {
        type: Date,
        default: null,
      },
      end_date: {
        type: Date,
        default: null,
      },
      title: {
        type: String,
        default: '',
      },
      banner_text: {
        type: String,
        default: '',
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Pricing = mongoose.model('Pricing', pricingSchema);
