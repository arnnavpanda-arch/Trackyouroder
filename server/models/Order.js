import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      default: '',
    },
    pickup: {
      address: { type: String, required: true },
      state: { type: String, default: '' },
      district: { type: String, default: '' },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      mapLink: { type: String, default: '' },
    },
    drop: {
      address: { type: String, required: true },
      state: { type: String, default: '' },
      district: { type: String, default: '' },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      mapLink: { type: String, default: '' },
    },
    pkg: {
      type: { type: String, default: 'Standard' },
      weight: { type: Number, default: 1 },
      desc: { type: String, default: '' },
    },
    notes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Placed', 'Picked-up', 'In-Transit', 'Delivered', 'Cancelled'],
      default: 'Placed',
      index: true,
    },
    agentId: {
      type: String,
      default: null,
      index: true,
    },
    agentName: {
      type: String,
      default: null,
    },
    history: [
      {
        status: { type: String, required: true },
        at: { type: Date, default: Date.now },
      },
    ],
    agentLoc: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      isExact: { type: Boolean, default: false },
      accuracy: { type: Number, default: null },
      lastUpdate: { type: Number, default: null },
    },
    distanceKm: {
      type: Number,
      default: null,
    },
    durationMins: {
      type: Number,
      default: null,
    },
    rating: {
      type: Number,
      default: null,
    },
    feedback: {
      type: String,
      default: '',
    },
    feedbackAt: {
      type: Date,
      default: null,
    },
    deliveryFee: {
      type: Number,
      default: 40,
    },
    originalDeliveryFee: {
      type: Number,
      default: null,
    },
    offerApplied: {
      type: String,
      default: '',
    },
    itemPaid: {
      type: Boolean,
      default: false,
    },
    utrId: {
      type: String,
      default: '',
    },
    accountHolderName: {
      type: String,
      default: '',
    },
    itemValue: {
      type: Number,
      default: null,
    },
    itemDesc: {
      type: String,
      default: '',
    },
    totalPayable: {
      type: Number,
      default: 40,
    },
    paymentMethod: {
      type: String,
      default: 'cod',
    },
    paymentStatus: {
      type: String,
      default: 'pending_pickup',
      index: true,
    },
    txnId: {
      type: String,
      default: '',
    },
    payerName: {
      type: String,
      default: '',
    },
    verificationNote: {
      type: String,
      default: '',
    },
    agentDisputed: {
      type: Boolean,
      default: false,
    },
    updatedFee: {
      type: Number,
      default: null,
    },
    cancellationFee: {
      type: Number,
      default: 30,
    },
    cancellationFeeApplied: {
      type: Number,
      default: null,
    },
    cancellationTxnId: {
      type: String,
      default: '',
    },
    cancellationPaymentMethod: {
      type: String,
      default: '',
    },
    cancellationFeePaid: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
