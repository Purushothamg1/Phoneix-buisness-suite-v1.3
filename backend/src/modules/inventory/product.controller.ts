import { Request, Response, NextFunction } from 'express';
import { productService } from './product.service';

export const productController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try { res.json(await productService.list(req.query as Record<string, string>)); }
    catch (e) { next(e); }
  },
  async lowStock(_req: Request, res: Response, next: NextFunction) {
    try { res.json(await productService.lowStock()); }
    catch (e) { next(e); }
  },
  async categories(_req: Request, res: Response, next: NextFunction) {
    try { res.json(await productService.categories()); }
    catch (e) { next(e); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(await productService.create(req.body)); }
    catch (e) { next(e); }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try { res.json(await productService.getById(req.params.id)); }
    catch (e) { next(e); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try { res.json(await productService.update(req.params.id, req.body)); }
    catch (e) { next(e); }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try { await productService.remove(req.params.id); res.status(204).send(); }
    catch (e) { next(e); }
  },
  async adjustStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { quantity, movementType, note } = req.body;
      res.json(await productService.adjustStock(req.params.id, quantity, movementType, note));
    } catch (e) { next(e); }
  },
  async getMovements(req: Request, res: Response, next: NextFunction) {
    try { res.json(await productService.getMovements(req.params.id, req.query as Record<string, string>)); }
    catch (e) { next(e); }
  },
};
