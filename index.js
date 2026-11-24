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
    if (!res.headersSent) {
      return res.status(500).json({
        message: `Database connection error: ${err.message}. Please check MONGODB_URI in Vercel Environment Variables.`,
        error: err.message,
      });
    }
    return;
  }

  return new Promise((resolve) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    app(req, res, () => {
      resolve();
    });
  });
}
