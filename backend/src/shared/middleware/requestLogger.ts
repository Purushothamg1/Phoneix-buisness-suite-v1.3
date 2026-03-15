import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const SENSITIVE_FIELDS = new Set([
  'password', 'currentPassword', 'newPassword', 'token', 'secret', 'apiKey', 'authorization',
]);

function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  if (!body || typeof body !== 'object') return body;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    sanitized[key] = SENSITIVE_FIELDS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return sanitized;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, path, query, requestId } = req;
  const userId = (req as any).user?.userId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[level](`[${requestId}] ${method} ${path} ${res.statusCode} ${duration}ms`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId,
      userId: userId || undefined,
      query: Object.keys(query).length ? query : undefined,
      body: method !== 'GET' && req.body ? sanitizeBody(req.body) : undefined,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}
