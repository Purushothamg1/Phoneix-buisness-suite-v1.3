import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';
import { prisma } from '../../config/database';

export const reportRouter = Router();
reportRouter.use(authenticate, authorize('ADMIN', 'MANAGER'));

function dateRange(query: Record<string, string>) {
  const from = query.from
    ? new Date(query.from)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = query.to ? new Date(query.to) : new Date();
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

// Sales Report
reportRouter.get('/sales', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = dateRange(req.query as Record<string, string>);
    const [invoices, totalRevenue, paidCount, unpaidCount, partialCount] = await Promise.all([
      prisma.invoice.findMany({
        where: { createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
        include: { customer: { select: { name: true } }, items: true, payments: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.aggregate({
        where: { createdAt: { gte: from, lte: to }, status: 'PAID' },
        _sum: { totalAmount: true },
      }),
      prisma.invoice.count({ where: { createdAt: { gte: from, lte: to }, status: 'PAID' } }),
      prisma.invoice.count({ where: { createdAt: { gte: from, lte: to }, status: 'UNPAID' } }),
      prisma.invoice.count({ where: { createdAt: { gte: from, lte: to }, status: 'PARTIAL' } }),
    ]);
    res.json({
      invoices,
      totalRevenue: Number(totalRevenue._sum.totalAmount) || 0,
      paidCount, unpaidCount, partialCount,
      from, to,
    });
  } catch (e) { next(e); }
});

// Inventory Report — FIX: use raw SQL for column comparison
reportRouter.get('/inventory', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [products, lowStockItems, totalValue] = await Promise.all([
      prisma.product.findMany({ orderBy: { name: 'asc' } }),
      prisma.$queryRaw<Array<{ id: string; name: string; stockQty: number; minStockLevel: number }>>`
        SELECT id, name, "stockQty", "minStockLevel"
        FROM "Product"
        WHERE "stockQty" <= "minStockLevel"
        ORDER BY "stockQty" ASC
      `,
      prisma.product.findMany({ select: { stockQty: true, purchasePrice: true, sellingPrice: true } }),
    ]);

    const inventoryValue = totalValue.reduce(
      (sum, p) => sum + p.stockQty * Number(p.purchasePrice), 0,
    );
    const retailValue = totalValue.reduce(
      (sum, p) => sum + p.stockQty * Number(p.sellingPrice), 0,
    );

    res.json({
      products,
      lowStockCount: lowStockItems.length,
      lowStockItems,
      inventoryValue,
      retailValue,
      potentialProfit: retailValue - inventoryValue,
    });
  } catch (e) { next(e); }
});

// Repair Report
reportRouter.get('/repairs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = dateRange(req.query as Record<string, string>);
    const [repairs, byStatus, revenue] = await Promise.all([
      prisma.repairJob.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: {
          customer: { select: { name: true } },
          technician: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.repairJob.groupBy({
        by: ['status'],
        where: { createdAt: { gte: from, lte: to } },
        _count: true,
      }),
      prisma.repairJob.aggregate({
        where: { createdAt: { gte: from, lte: to }, finalCost: { not: null } },
        _sum: { finalCost: true },
      }),
    ]);
    res.json({
      repairs,
      byStatus,
      totalRevenue: Number(revenue._sum.finalCost) || 0,
      from, to,
    });
  } catch (e) { next(e); }
});

// Financial Report
reportRouter.get('/financial', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = dateRange(req.query as Record<string, string>);
    const [revenue, payments, byMethod, refunds] = await Promise.all([
      prisma.invoice.aggregate({
        where: { createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true, taxAmount: true, discount: true },
      }),
      prisma.payment.aggregate({
        where: { createdAt: { gte: from, lte: to }, refunded: false },
        _sum: { amount: true },
      }),
      prisma.payment.groupBy({
        by: ['method'],
        where: { createdAt: { gte: from, lte: to }, refunded: false },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { createdAt: { gte: from, lte: to }, refunded: true },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    res.json({
      revenue: {
        total: Number(revenue._sum.totalAmount) || 0,
        tax: Number(revenue._sum.taxAmount) || 0,
        discount: Number(revenue._sum.discount) || 0,
      },
      collected: Number(payments._sum.amount) || 0,
      byMethod: byMethod.map((m) => ({ ...m, _sum: { amount: Number(m._sum.amount) || 0 } })),
      refunds: {
        total: Number(refunds._sum.amount) || 0,
        count: refunds._count,
      },
      from, to,
    });
  } catch (e) { next(e); }
});
