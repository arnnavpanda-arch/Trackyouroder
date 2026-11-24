import mongoose from 'mongoose';

let cachedPromise = null;

export const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined. Please add MONGODB_URI in your Vercel Project Settings > Environment Variables.');
  }

  if (!cachedPromise) {
    cachedPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      bufferCommands: false,
    }).then((conn) => {
      console.log(`[Database] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    }).catch((err) => {
      cachedPromise = null;
      console.error(`[Database Error] Failed to connect to MongoDB: ${err.message}`);
      throw err;
    });
  }

  return cachedPromise;
};
