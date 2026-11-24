import mongoose from 'mongoose';

const sequenceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  seq: {
    type: Number,
    default: 1000,
  },
});

export const Sequence = mongoose.models.Sequence || mongoose.model('Sequence', sequenceSchema);

export async function getNextOrderId() {
  const record = await Sequence.findOneAndUpdate(
    { name: 'orderId' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `DL${record.seq}`;
}
