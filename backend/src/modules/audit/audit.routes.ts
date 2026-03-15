import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';
import { prisma } from '../../config/database';
import { getPaginationParams, buildPaginatedResult } from '../../shared/utils/pagination';

export const auditRouter = Router();
auditRouter.use(authenticate, authorize('ADMIN', 'MANAGER'));

/**
 * GET /api/audit
 * Returns a paginated list of audit log entries, newest first.
 * Query params: page, limit, userId, action, from, to
 */
auditRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query as Record<string, string>);
    const { userId, action, from, to } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); dateFilter.lte = d; }
      where.createdAt = dateFilter;
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json(buildPaginatedResult(data, total, { page, limit, skip }));
  } catch (e) { next(e); }
});

/**
 * GET /api/audit/actions
 * Returns distinct action values for filter dropdowns.
 */
auditRouter.get('/actions', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    res.json(rows.map((r) => r.action));
  } catch (e) { next(e); }
});
