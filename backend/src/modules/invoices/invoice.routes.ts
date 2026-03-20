import { Router } from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';
import { invoiceService } from './invoice.service';
import { pdfService } from '../pdf/pdf.service';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors/AppError';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';

export const invoiceRouter = Router();
invoiceRouter.use(authenticate);

const itemSchema = Joi.object({
  productId: Joi.string().uuid().optional().allow(null, ''),
  description: Joi.string().min(1).max(300).required(),
  qty: Joi.number().integer().min(1).max(9999).required(),
  unitPrice: Joi.number().min(0).max(9_999_999).required(),
  tax: Joi.number().min(0).max(100).optional(),
});

const createSchema = Joi.object({
  customerId: Joi.string().uuid().required(),
  discount: Joi.number().min(0).max(9_999_999).optional(),
  items: Joi.array().items(itemSchema).min(1).max(100).required(),
});

invoiceRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await invoiceService.list(req.query as Record<string, string>)); }
  catch (e) { next(e); }
});

invoiceRouter.post('/', celebrate({ [Segments.BODY]: createSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json(await invoiceService.create(req.body)); }
    catch (e) { next(e); }
  },
);

invoiceRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await invoiceService.getById(req.params.id)); }
  catch (e) { next(e); }
});

invoiceRouter.put('/:id', authorize('ADMIN', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await invoiceService.update(req.params.id, req.body)); }
    catch (e) { next(e); }
  },
);

invoiceRouter.post('/:id/cancel', authorize('ADMIN', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await invoiceService.cancel(req.params.id)); }
    catch (e) { next(e); }
  },
);

// ── Generate/Regenerate PDF ────────────────────────────────────────────
invoiceRouter.post('/:id/regenerate-pdf',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pdfUrl = await pdfService.generateInvoicePdf(req.params.id);
      await prisma.invoice.update({ where: { id: req.params.id }, data: { pdfUrl } });
      res.json({ pdfUrl });
    } catch (e) { next(e); }
  },
);

// ── Force-download PDF (authenticated) ────────────────────────────────
invoiceRouter.get('/:id/pdf/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
      if (!invoice) throw new NotFoundError('Invoice');

      // Always regenerate so the PDF reflects the latest payment status.
      // Serving a cached file would show UNPAID even after a payment is recorded.
      const pdfUrl = await pdfService.generateInvoicePdf(req.params.id);
      await prisma.invoice.update({ where: { id: req.params.id }, data: { pdfUrl } });

      const finalPath = pdfService.getPdfFilePath(pdfUrl);
      const filename = require('path').basename(finalPath);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store');
      fs.createReadStream(finalPath).pipe(res);
    } catch (e) { next(e); }
  },
);
