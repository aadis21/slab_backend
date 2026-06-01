import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db';

// Routes
import authRoutes from './routes/auth.routes';
import planRoutes from './routes/plan.routes';
import userRoutes from './routes/user.routes';
import referralRoutes from './routes/referral.routes';
import planRequestRoutes from './routes/planRequest.routes';
import withdrawalRoutes from './routes/withdrawal.routes';
import donationRoutes from './routes/donation.routes';

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://slab-frontend.vercel.app';

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);

      // Allow localhost or 127.0.0.1 on any port
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      // Allow configured FRONTEND_URL environment variable
      if (origin === FRONTEND_URL) {
        return callback(null, true);
      }

      // Allow production app and any Vercel deployment preview URLs
      if (
        origin === 'https://aafws.vercel.app' ||
        origin === 'https://slab-frontend.vercel.app' ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/user', userRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/plan-requests', planRequestRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/donations', donationRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    const apiBase = process.env.BACKEND_URL || `http://localhost:${PORT}`;
    console.log(`\n🚀 InvestSlabs API running on ${apiBase}`);
    console.log(`📖 Health check: ${apiBase}/api/health\n`);
  });
};

start();

export default app;
