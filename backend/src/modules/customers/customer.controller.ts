import { Request, Response, NextFunction } from 'express';
import { customerService } from './customer.service';

export const customerController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try { res.json(await customerService.list(req.query as Record<string, string>)); }
    catch (e) { next(e); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(await customerService.create(req.body)); }
    catch (e) { next(e); }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try { res.json(await customerService.getById(req.params.id)); }
    catch (e) { next(e); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try { res.json(await customerService.update(req.params.id, req.body)); }
    catch (e) { next(e); }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try { await customerService.remove(req.params.id); res.status(204).send(); }
    catch (e) { next(e); }
  },
  async getHistory(req: Request, res: Response, next: NextFunction) {
    try { res.json(await customerService.getHistory(req.params.id)); }
    catch (e) { next(e); }
  },
};
