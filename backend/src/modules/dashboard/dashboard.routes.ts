import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { prisma } from '../../config/database';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      todaySales,
      monthlyRevenue,
      activeRepairs,
      recentInvoices,
      recentRepairs,
      // FIX: raw SQL to compare two columns (stockQty <= minStockLevel)
      lowStockItems,
      salesByDayRaw,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: { createdAt: { gte: today, lte: todayEnd }, status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: { createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.repairJob.count({ where: { status: { notIn: ['DELIVERED'] } } }),
      prisma.invoice.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } } },
      }),
      prisma.repairJob.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        where: { status: { notIn: ['DELIVERED'] } },
        include: { customer: { select: { name: true } } },
      }),
      // FIX: compare columns via raw SQL
      prisma.$queryRaw<Array<{ id: string; name: string; stockQty: number; minStockLevel: number }>>`
        SELECT id, name, "stockQty", "minStockLevel"
        FROM "Product"
        WHERE "stockQty" <= "minStockLevel"
        ORDER BY "stockQty" ASC
        LIMIT 20
      `,
      // FIX: cast BigInt/Decimal to string-safe types
      prisma.$queryRaw<Array<{ date: Date; total: unknown }>>`
        SELECT DATE("createdAt") as date, SUM("totalAmount")::float as total
        FROM "Invoice"
        WHERE "createdAt" >= ${monthStart} AND status != 'CANCELLED'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
    ]);

    // Serialize BigInts and Decimals safely
    const salesByDay = salesByDayRaw.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      total: Number(r.total) || 0,
    }));

    res.json({
      todaySales: {
        amount: Number(todaySales._sum.totalAmount) || 0,
        count: todaySales._count,
      },
      monthlyRevenue: {
        amount: Number(monthlyRevenue._sum.totalAmount) || 0,
        count: monthlyRevenue._count,
      },
      activeRepairs,
      lowStockAlerts: lowStockItems.length,
      lowStockItems,
      recentInvoices,
      recentRepairs,
      salesByDay,
    });
  } catch (e) { next(e); }
});
