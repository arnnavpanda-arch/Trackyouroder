import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { seedDatabase } from './utils/seed.js';
import { initSocket } from './socket.js';
import authRoutes from './routes/authRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import userRoutes from './routes/userRoutes.js';
import pricingRoutes from './routes/pricingRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const allowedOrigins = [
  CLIENT_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5001',
  'http://127.0.0.1:5001',
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
];

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

import fs from 'fs';

const distPath = path.join(__dirname, '../dist');
const hasDist = fs.existsSync(distPath);

if (hasDist) {
  app.use(express.static(distPath));
}

// Health Check & Root Info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Delivery Tracker Express API',
    mongoDB: 'Connected',
  });
});

app.get('/api', (req, res) => {
  res.json({
    name: 'Delivery Tracker API',
    version: '1.0.0',
    status: 'Running',
    endpoints: ['/api/auth', '/api/orders', '/api/users', '/api/pricing', '/api/health'],
  });
});

// Routes (support both /api/path and /path for Vercel serverless rewrites)
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/orders', orderRoutes);
app.use('/orders', orderRoutes);

app.use('/api/users', userRoutes);
app.use('/users', userRoutes);

app.use('/api/pricing', pricingRoutes);
app.use('/pricing', pricingRoutes);

app.use('/api/settings', settingsRoutes);
app.use('/settings', settingsRoutes);

// Fallback to React frontend index.html if dist exists
if (hasDist) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Trackora Backend API</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 40px; border-radius: 16px; border: 1px solid #334155; text-align: center; max-width: 500px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
          h1 { color: #38bdf8; margin-top: 0; }
          p { color: #94a3b8; line-height: 1.6; }
          .badge { display: inline-block; background: #065f46; color: #34d399; padding: 4px 12px; border-radius: 999px; font-weight: bold; font-size: 13px; margin-bottom: 20px; }
          .btn { display: inline-block; background: #0284c7; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; margin-top: 20px; }
          .btn:hover { background: #0369a1; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">● BACKEND RUNNING</div>
          <h1>Trackora Delivery API</h1>
          <p>The Express.js + MongoDB backend is running successfully on port <b>5001</b>.</p>
          <p>To view the full delivery tracking web application, click below:</p>
          <a href="http://localhost:5173" class="btn">Open App on Port 5173 →</a>
        </div>
      </body>
      </html>
    `);
  });
}

// 404 Route for API requests
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: `API route ${req.originalUrl} not found` });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

// Initialize Socket.io
initSocket(server, CLIENT_ORIGIN);

// Start Server
async function start() {
  try {
    await connectDB();
    await seedDatabase();

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n=================================================`);
      console.log(`  🚀 Delivery Tracker Backend is LIVE!`);
      console.log(`  📡 Server: http://localhost:${PORT}`);
      console.log(`  🔗 REST API: http://localhost:${PORT}/api`);
      console.log(`  ⚡ Socket.io: ws://localhost:${PORT}`);
      console.log(`  🍃 MongoDB: Connected`);
      console.log(`=================================================\n`);
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

if (!process.env.VERCEL) {
  start();
}

export { app, server, start };
