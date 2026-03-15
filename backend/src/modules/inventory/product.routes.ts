import { Router } from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';
import { productController } from './product.controller';

export const productRouter = Router();
productRouter.use(authenticate);

const productSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  sku: Joi.string().min(1).max(100).required(),
  barcode: Joi.string().max(100).optional().allow('', null),
  category: Joi.string().max(100).optional().allow('', null),
  purchasePrice: Joi.number().min(0).required(),
  sellingPrice: Joi.number().min(0).required(),
  stockQty: Joi.number().integer().min(0).default(0),
  minStockLevel: Joi.number().integer().min(0).default(5),
});

const adjustStockSchema = Joi.object({
  quantity: Joi.number().integer().not(0).required(),
  movementType: Joi.string().valid('PURCHASE', 'ADJUSTMENT', 'RETURN').required(),
  note: Joi.string().max(300).optional().allow('', null),
});

productRouter.get('/', productController.list);
productRouter.get('/low-stock', productController.lowStock);
productRouter.get('/categories', productController.categories);
productRouter.post(
  '/',
  authorize('ADMIN', 'MANAGER'),
  celebrate({ [Segments.BODY]: productSchema }),
  productController.create,
);
productRouter.get('/:id', productController.getById);
productRouter.put(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  celebrate({ [Segments.BODY]: productSchema }),
  productController.update,
);
productRouter.delete('/:id', authorize('ADMIN'), productController.remove);
productRouter.post(
  '/:id/adjust-stock',
  authorize('ADMIN', 'MANAGER'),
  celebrate({ [Segments.BODY]: adjustStockSchema }),
  productController.adjustStock,
);
productRouter.get('/:id/movements', productController.getMovements);
