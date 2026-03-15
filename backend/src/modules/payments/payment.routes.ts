import { Router } from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import { Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';
import { prisma } from '../../config/database';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { getPaginationParams, buildPaginatedResult } from '../../shared/utils/pagination';
import { auditLog } from '../../shared/utils/auditLog';

export const paymentRouter = Router();
paymentRouter.use(authenticate, authorize('ADMIN', 'MANAGER'));

const paymentSchema = Joi.object({
  invoiceId: Joi.string().uuid().required(),
  amount: Joi.number().positive().required(),
  method: Joi.string().valid('CASH', 'UPI', 'CARD', 'BANK_TRANSFER').required(),
  note: Joi.string().max(200).optional().allow('', null),
});

async function updateInvoiceStatus(invoiceId: string, tx: any) {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { payments: { where: { refunded: false } } } });
  if (!invoice) return;
  const paid = invoice.payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount.toString()), 0);
  const total = parseFloat(invoice.totalAmount.toString());
  let status: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID';
  if (paid >= total) status = 'PAID';
  else if (paid > 0) status = 'PARTIAL';
  await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
}

// ── Record Payment
paymentRouter.post('/', celebrate({ [Segments.BODY]: paymentSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { invoiceId, amount, method, note } = req.body;
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { payments: { where: { refunded: false } }, customer: true } });
    if (!invoice) throw new NotFoundError('Invoice');
    if (invoice.status === 'CANCELLED') throw new ValidationError('Cannot pay a cancelled invoice');
    if (invoice.status === 'PAID') throw new ValidationError('Invoice is already fully paid');

    const alreadyPaid = invoice.payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
    const remaining = parseFloat(invoice.totalAmount.toString()) - alreadyPaid;
    if (amount > remaining + 0.01) throw new ValidationError(`Payment amount (${amount}) exceeds outstanding balance (${remaining.toFixed(2)})`);

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({ data: { invoiceId, amount, method } });
      await updateInvoiceStatus(invoiceId, tx);
      return p;
    });

    await auditLog({ userId: req.user!.userId, action: 'PAYMENT_RECORDED', metadata: { invoiceId, invoiceNumber: invoice.number, amount, method, customer: invoice.customer.name } });
    res.status(201).json(payment);
  } catch (e) { next(e); }
});

// ── Refund Payment
paymentRouter.post('/refund', celebrate({ [Segments.BODY]: Joi.object({ paymentId: Joi.string().uuid().required() }) }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentId } = req.body;
    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { invoice: { include: { customer: true } } } });
    if (!payment) throw new NotFoundError('Payment');
    if (payment.refunded) throw new ValidationError('Payment already refunded');
    if (payment.invoice.status === 'CANCELLED') throw new ValidationError('Cannot refund on a cancelled invoice individually — cancel the invoice instead');

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({ where: { id: paymentId }, data: { refunded: true } });
      await updateInvoiceStatus(payment.invoiceId, tx);
      return p;
    });

    await auditLog({ userId: req.user!.userId, action: 'PAYMENT_REFUNDED', metadata: { paymentId, invoiceId: payment.invoiceId, amount: Number(payment.amount), method: payment.method } });
    res.json(updated);
  } catch (e) { next(e); }
});

// ── List Payments (paginated, filterable)
paymentRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { invoiceId, from, to, method, refunded } = req.query as Record<string, string>;
    const { page, limit, skip } = getPaginationParams(req.query as Record<string, string>);
    const where: Record<string, any> = {};
    if (invoiceId) where.invoiceId = invoiceId;
    if (method) where.method = method;
    if (refunded !== undefined) where.refunded = refunded === 'true';
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) { const d = new Date(to); d.setHours(23,59,59,999); dateFilter.lte = d; }
      where.createdAt = dateFilter;
    }
    const [data, total] = await Promise.all([
      prisma.payment.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { invoice: { select: { number: true, totalAmount: true, status: true, customer: { select: { name: true, phone: true } } } } } }),
      prisma.payment.count({ where }),
    ]);
    res.json(buildPaginatedResult(data, total, { page, limit, skip }));
  } catch (e) { next(e); }
});

// ── Payment Summary / Stats
paymentRouter.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = req.query as Record<string, string>;
    const dateFilter: Record<string, any> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) { const d = new Date(to); d.setHours(23,59,59,999); dateFilter.lte = d; }
    const where: any = { refunded: false };
    if (Object.keys(dateFilter).length) where.createdAt = dateFilter;

    const [byMethod, totalCollected, refundStats, recentPayments] = await Promise.all([
      prisma.payment.groupBy({ by: ['method'], where, _sum: { amount: true }, _count: true }),
      prisma.payment.aggregate({ where, _sum: { amount: true }, _count: true }),
      prisma.payment.aggregate({ where: { refunded: true, ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}) }, _sum: { amount: true }, _count: true }),
      prisma.payment.findMany({ where, take: 5, orderBy: { createdAt: 'desc' }, include: { invoice: { select: { number: true, customer: { select: { name: true } } } } } }),
    ]);

    res.json({
      totalCollected: Number(totalCollected._sum.amount) || 0,
      totalCount: totalCollected._count,
      byMethod: byMethod.map((m) => ({ method: m.method, total: Number(m._sum.amount) || 0, count: m._count })),
      refunds: { total: Number(refundStats._sum.amount) || 0, count: refundStats._count },
      recentPayments,
    });
  } catch (e) { next(e); }
});

// ── Get single payment
paymentRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { invoice: { include: { customer: true } } } });
    if (!payment) throw new NotFoundError('Payment');
    res.json(payment);
  } catch (e) { next(e); }
});
