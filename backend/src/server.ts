import 'dotenv/config';
import app from './app';
import { logger } from './shared/utils/logger';
import { prisma } from './config/database';
import http from 'http';

// ── Startup environment validation ────────────────────────────────────
const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

if ((process.env.JWT_SECRET || '').length < 32) {
  console.error('[FATAL] JWT_SECRET must be at least 32 characters. Use 64+ for production.');
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 5000;
const server = http.createServer(app);

// ── Sentry (optional — only if DSN is configured) ─────────────────────
if (process.env.SENTRY_DSN) {
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development' });
    logger.info('Sentry initialized');
  } catch {
    logger.warn('Sentry init failed — continuing without it');
  }
}

async function main(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    // Ensure upload directories exist
    const path = require('path');
    const fs = require('fs');
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const absUploadDir = path.isAbsolute(uploadDir) ? uploadDir : path.resolve(process.cwd(), uploadDir);
    ['pdfs', 'products', 'logos'].forEach((sub) => {
      const dir = path.join(absUploadDir, sub);
      if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); logger.info(`Created directory: ${dir}`); }
    });

    const logsDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

    server.listen(PORT, () => {
      logger.info(`Phoenix Business Suite v1.4.0 on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error('Shutdown error:', err);
      process.exit(1);
    }
  });
  setTimeout(() => {
    logger.error('Forced shutdown after 10s timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection:', reason));
process.on('uncaughtException',  (error) => { logger.error('Uncaught exception:', error); shutdown('uncaughtException'); });

main();
