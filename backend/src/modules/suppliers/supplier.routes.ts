// ============================================================
// SUPPLIER ROUTES
// ============================================================
import { Router } from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';
import { prisma } from '../../config/database';
import { NotFoundError, ConflictError } from '../../shared/errors/AppError';
import { getPaginationParams, buildPaginatedResult } from '../../shared/utils/pagination';

export const supplierRouter = Router();
supplierRouter.use(authenticate, authorize('ADMIN', 'MANAGER'));

const supplierSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  phone: Joi.string().min(7).max(20).required(),
  email: Joi.string().email().optional().allow('', null),
  address: Joi.string().max(300).optional().allow('', null),
  paymentTerms: Joi.string().max(200).optional().allow('', null),
});

async function listSuppliers(req: any, res: any, next: any) {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const search = req.query.search as string;
    const where = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { phone: { contains: search } }] }
      : {};
    const [data, total] = await Promise.all([
      prisma.supplier.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.supplier.count({ where }),
    ]);
    res.json(buildPaginatedResult(data, total, { page, limit, skip }));
  } catch (e) { next(e); }
}

async function createSupplier(req: any, res: any, next: any) {
  try {
    const existing = await prisma.supplier.findFirst({ where: { phone: req.body.phone } });
    if (existing) throw new ConflictError('Supplier with this phone already exists');
    const supplier = await prisma.supplier.create({ data: req.body });
    res.status(201).json(supplier);
  } catch (e) { next(e); }
}

async function getSupplier(req: any, res: any, next: any) {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!supplier) throw new NotFoundError('Supplier');
    res.json(supplier);
  } catch (e) { next(e); }
}

async function updateSupplier(req: any, res: any, next: any) {
  try {
    const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new NotFoundError('Supplier');
    const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data: req.body });
    res.json(supplier);
  } catch (e) { next(e); }
}

async function deleteSupplier(req: any, res: any, next: any) {
  try {
    const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new NotFoundError('Supplier');
    await prisma.supplier.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) { next(e); }
}

supplierRouter.get('/', listSuppliers);
supplierRouter.post('/', celebrate({ [Segments.BODY]: supplierSchema }), createSupplier);
supplierRouter.get('/:id', getSupplier);
supplierRouter.put('/:id', celebrate({ [Segments.BODY]: supplierSchema }), updateSupplier);
supplierRouter.delete('/:id', authorize('ADMIN'), deleteSupplier);
