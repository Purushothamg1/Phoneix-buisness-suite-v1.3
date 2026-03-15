import { Router } from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import { customerController } from './customer.controller';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';

export const customerRouter = Router();
customerRouter.use(authenticate);

const customerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  phone: Joi.string().min(7).max(20).required(),
  email: Joi.string().email().optional().allow('', null),
  address: Joi.string().max(300).optional().allow('', null),
  notes: Joi.string().max(500).optional().allow('', null),
});

customerRouter.get('/', customerController.list);
customerRouter.post('/', celebrate({ [Segments.BODY]: customerSchema }), customerController.create);
customerRouter.get('/:id', customerController.getById);
customerRouter.put('/:id', celebrate({ [Segments.BODY]: customerSchema }), customerController.update);
// FIX: only ADMIN can delete customers (was missing authorize)
customerRouter.delete('/:id', authorize('ADMIN'), customerController.remove);
customerRouter.get('/:id/history', customerController.getHistory);
