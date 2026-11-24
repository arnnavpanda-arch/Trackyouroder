import { app } from '../server/server.js';
import { connectDB } from '../server/config/db.js';
import { seedDatabase } from '../server/utils/seed.js';

let isSeeded = false;

export default async function handler(req, res) {
  try {
    await connectDB();
    if (!isSeeded) {
      await seedDatabase();
      isSeeded = true;
    }
  } catch (err) {
    console.error('[Vercel Serverless] DB connection error:', err.message);
    return res.status(500).json({
      message: `Database connection error: ${err.message}. Please check MONGODB_URI in Vercel Environment Variables and ensure MongoDB Atlas allows 0.0.0.0/0 in Network Access.`,
      error: err.message,
    });
  }
  return app(req, res);
}
