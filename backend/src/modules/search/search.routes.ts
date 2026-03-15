import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { prisma } from '../../config/database';
import { ValidationError } from '../../shared/errors/AppError';

export const searchRouter = Router();
searchRouter.use(authenticate);

searchRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string)?.trim();
    if (!q || q.length < 2) throw new ValidationError('Search query must be at least 2 characters');

    const [customers, products, invoices, repairs] = await Promise.all([
      prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 5,
      }),
      prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
            { barcode: { contains: q } },
          ],
        },
        take: 5,
      }),
      prisma.invoice.findMany({
        where: {
          OR: [
            { number: { contains: q, mode: 'insensitive' } },
            { customer: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        take: 5,
        include: { customer: { select: { name: true } } },
      }),
      prisma.repairJob.findMany({
        where: {
          OR: [
            { jobId: { contains: q, mode: 'insensitive' } },
            { brand: { contains: q, mode: 'insensitive' } },
            { model: { contains: q, mode: 'insensitive' } },
            { customer: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        take: 5,
        include: { customer: { select: { name: true } } },
      }),
    ]);

    res.json({ customers, products, invoices, repairs, query: q });
  } catch (e) { next(e); }
});
