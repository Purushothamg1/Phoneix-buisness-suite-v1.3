import { Router } from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';
import { invoiceService } from '../invoices/invoice.service';
import { repairService } from './repair.service';
import { pdfService } from '../pdf/pdf.service';
import { prisma } from '../../config/database';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';

export const repairRouter = Router();
repairRouter.use(authenticate);

const createRepairSchema = Joi.object({
  customerId: Joi.string().uuid().required(),
  deviceType: Joi.string().min(1).max(100).required(),
  brand: Joi.string().min(1).max(100).required(),
  model: Joi.string().min(1).max(100).required(),
  serialNumber: Joi.string().max(100).optional().allow('', null),
  issueDescription: Joi.string().min(1).max(2000).required(),
  technicianId: Joi.string().uuid().optional().allow(null, ''),
  estimatedCost: Joi.number().min(0).max(9_999_999).optional().allow(null),
  parts: Joi.array().items(Joi.object({
    productId: Joi.string().uuid().required(),
    qty: Joi.number().integer().min(1).max(9999).required(),
    cost: Joi.number().min(0).max(9_999_999).required(),
  })).optional(),
});

const updateRepairSchema = Joi.object({
  status: Joi.string().valid('RECEIVED','DIAGNOSING','WAITING_FOR_PARTS','IN_REPAIR','READY','DELIVERED').optional(),
  repairNotes: Joi.string().max(2000).optional().allow('', null),
  technicianId: Joi.string().uuid().optional().allow(null, ''),
  finalCost: Joi.number().min(0).max(9_999_999).optional().allow(null),
  estimatedCost: Joi.number().min(0).max(9_999_999).optional().allow(null),
});

repairRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await repairService.list(req.query as Record<string, string>)); }
  catch (e) { next(e); }
});

repairRouter.post('/', celebrate({ [Segments.BODY]: createRepairSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json(await repairService.create(req.body)); }
    catch (e) { next(e); }
  },
);

repairRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await repairService.getById(req.params.id)); }
  catch (e) { next(e); }
});

repairRouter.put('/:id', celebrate({ [Segments.BODY]: updateRepairSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await repairService.update(req.params.id, req.body)); }
    catch (e) { next(e); }
  },
);

repairRouter.delete('/:id', authorize('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try { await repairService.remove(req.params.id); res.status(204).send(); }
    catch (e) { next(e); }
  },
);

repairRouter.post('/:id/regenerate-pdf',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pdfUrl = await pdfService.generateRepairPdf(req.params.id);
      await prisma.repairJob.update({ where: { id: req.params.id }, data: { pdfUrl } });
      res.json({ pdfUrl });
    } catch (e) { next(e); }
  },
);

repairRouter.get('/:id/pdf/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repair = await prisma.repairJob.findUnique({ where: { id: req.params.id } });
      if (!repair) throw new NotFoundError('Repair job');

      let pdfUrl = repair.pdfUrl;
      if (!pdfUrl) {
        pdfUrl = await pdfService.generateRepairPdf(req.params.id);
        await prisma.repairJob.update({ where: { id: req.params.id }, data: { pdfUrl } });
      }

      const filePath = pdfService.getPdfFilePath(pdfUrl);
      if (!fs.existsSync(filePath)) {
        pdfUrl = await pdfService.generateRepairPdf(req.params.id);
        await prisma.repairJob.update({ where: { id: req.params.id }, data: { pdfUrl } });
      }

      const finalPath = pdfService.getPdfFilePath(pdfUrl);
      const filename = require('path').basename(finalPath);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store');
      fs.createReadStream(finalPath).pipe(res);
    } catch (e) { next(e); }
  },
);

// ── Create Invoice from Completed Repair ──────────────────────────────
repairRouter.post('/:id/create-invoice', authorize('ADMIN', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repair = await repairService.getById(req.params.id);
      if (!['READY', 'DELIVERED'].includes(repair.status)) {
        throw new ValidationError('Invoice can only be created for repairs with status READY or DELIVERED');
      }

      const settings = await prisma.setting.findMany();
      const sm = settings.reduce((a: Record<string, string>, s) => { a[s.key] = s.value; return a; }, {});
      const defaultTax = parseFloat(sm.default_tax || '0');

      const items: any[] = [];
      // Parts as line items (stock was already deducted when repair was created)
      for (const part of repair.parts) {
        const productName = (part.product as any)?.name || 'Part';
        items.push({
          productId: null, // Don't link to product so stock isn't re-deducted
          description: `${productName} (Repair Part)`,
          qty: part.qty,
          unitPrice: Number(part.cost),
          tax: defaultTax,
        });
      }

      // Labour line item
      const labourCost = Number(repair.finalCost ?? repair.estimatedCost ?? 0);
      if (labourCost > 0) {
        items.push({
          productId: null,
          description: `Labour — ${repair.brand} ${repair.model} (${repair.jobId})`,
          qty: 1,
          unitPrice: labourCost,
          tax: defaultTax,
        });
      }

      if (items.length === 0) {
        items.push({
          productId: null,
          description: `Repair Service — ${repair.brand} ${repair.model} (${repair.jobId})`,
          qty: 1,
          unitPrice: 0,
          tax: defaultTax,
        });
      }

      
      const invoice = await invoiceService.create({
        customerId: repair.customerId,
        discount: Number(req.body.discount) || 0,
        items,
      });

      // Record invoice number in repair notes for traceability
      const noteLink = `[Invoice: ${invoice.number}]`;
      if (!repair.repairNotes?.includes(noteLink)) {
        await prisma.repairJob.update({
          where: { id: repair.id },
          data: { repairNotes: `${repair.repairNotes || ''}\n${noteLink}`.trim() },
        });
      }

      res.status(201).json(invoice);
    } catch (e) { next(e); }
  },
);
