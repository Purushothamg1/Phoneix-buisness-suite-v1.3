import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import path from 'path';
import { errorHandler } from './shared/middleware/errorHandler';
import { requestLogger } from './shared/middleware/requestLogger';
import { requestId } from './shared/middleware/requestId';
import { authRouter } from './modules/auth/auth.routes';
import { userRouter } from './modules/auth/user.routes';
import { customerRouter } from './modules/customers/customer.routes';
import { supplierRouter } from './modules/suppliers/supplier.routes';
import { productRouter } from './modules/inventory/product.routes';
import { invoiceRouter } from './modules/invoices/invoice.routes';
import { repairRouter } from './modules/repairs/repair.routes';
import { paymentRouter } from './modules/payments/payment.routes';
import { reportRouter } from './modules/reports/report.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { searchRouter } from './modules/search/search.routes';
import { uploadRouter } from './modules/upload/upload.routes';
import { importExportRouter } from './modules/import-export/importExport.routes';
import { auditRouter } from './modules/audit/audit.routes';

const app = express();

// ── Request ID ────────────────────────────────────────────────────────
app.set('trust proxy', 1); // trust first proxy (Render, Vercel, etc.)
app.use(requestId);

// ── Security Headers ──────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  } : false,
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
    : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xFrameOptions: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
}));

// ── CORS ──────────────────────────────────────────────────────────────
const rawOrigins = process.env.FRONTEND_URL || 'http://localhost:3000';
const allowedOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, health checks)
    if (!origin) return cb(null, true);
    // Exact match from FRONTEND_URL env var
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Allow ALL Vercel preview/production deployments for this project
    if (origin.endsWith('.vercel.app')) return cb(null, true);
    // Allow localhost in any environment
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return cb(null, true);
    cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
}));

// ── Compression ───────────────────────────────────────────────────────
app.use(compression({ level: 6, threshold: 1024 }));

// ── Body Parsing ──────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static Files (uploads) ────────────────────────────────────────────
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const absoluteUploadDir = path.isAbsolute(uploadDir)
  ? uploadDir
  : path.resolve(process.cwd(), uploadDir);

app.use('/uploads', express.static(absoluteUploadDir, {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  etag: true,
}));

// ── Request Logging ───────────────────────────────────────────────────
app.use(requestLogger);

// ── Health / Readiness ─────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.4.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/ready', async (_req, res) => {
  try {
    // Quick DB connectivity check
    const { prisma } = await import('./config/database');
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', db: 'ok' });
  } catch {
    res.status(503).json({ status: 'not ready', db: 'error' });
  }
});

// ── Rate Limiters ─────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 300,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  skip: (req) => req.path === '/health' || req.path === '/ready',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.ip || 'unknown',
});

// express-slow-down v2: delayMs MUST be a function with signature (used, req, res)
const authSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 5,
  delayMs: (used: number) => (used - 5) * 200, // v2 compatible
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Search rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Routes ────────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authSlowDown, authLimiter);
app.use('/api/auth', authRouter);
app.use('/api/auth/users', userRouter);
app.use('/api/customers', customerRouter);
app.use('/api/suppliers', supplierRouter);
app.use('/api/products', productRouter);
app.use('/api/invoices', invoiceRouter);
app.use('/api/repairs', repairRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/reports', reportRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/search', searchLimiter, searchRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/import-export', importExportRouter);
app.use('/api/audit', auditRouter);

// ── 404 ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// ── Global Error Handler ──────────────────────────────────────────────
app.use(errorHandler);

export default app;
