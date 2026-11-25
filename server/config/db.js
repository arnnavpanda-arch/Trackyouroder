import mongoose from 'mongoose';

let cachedPromise = null;

export const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  const DEFAULT_URI = 'mongodb+srv://bookpujaconnect_db_user:M3YQ5Vqw19a2LBVH@cluster0.b52rwhb.mongodb.net/pujaconnect?retryWrites=true&w=majority&appName=Cluster0';
  const uri = process.env.MONGODB_URI || DEFAULT_URI;


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
