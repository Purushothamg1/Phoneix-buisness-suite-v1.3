import { Router } from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';
import { prisma } from '../../config/database';
import { NotFoundError, ConflictError } from '../../shared/errors/AppError';
import { auditLog } from '../../shared/utils/auditLog';

export const userRouter = Router();
userRouter.use(authenticate, authorize('ADMIN'));

// List all users
userRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (e) { next(e); }
});

// Create user
userRouter.post(
  '/',
  celebrate({
    [Segments.BODY]: Joi.object({
      name:     Joi.string().min(2).max(100).required(),
      email:    Joi.string().email().required(),
      password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
        .messages({ 'string.pattern.base': 'Password must contain uppercase, lowercase, and a number' }),
      role:     Joi.string().valid('ADMIN', 'MANAGER', 'STAFF').required(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email: rawEmail, password, role } = req.body;
      const email = rawEmail.toLowerCase().trim();
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) throw new ConflictError('A user with this email already exists');

      const hashed = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { name, email, password: hashed, role },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });

      await auditLog({
        userId: req.user!.userId,
        action: 'USER_CREATED',
        metadata: { createdUserId: user.id, email, role },
      });

      res.status(201).json(user);
    } catch (e) { next(e); }
  },
);

// Update user role
userRouter.put(
  '/:id/role',
  celebrate({ [Segments.BODY]: Joi.object({ role: Joi.string().valid('ADMIN', 'MANAGER', 'STAFF').required() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!user) throw new NotFoundError('User');
      const updated = await prisma.user.update({
        where: { id: req.params.id },
        data: { role: req.body.role },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
      await auditLog({
        userId: req.user!.userId,
        action: 'USER_ROLE_CHANGED',
        metadata: { targetUserId: req.params.id, oldRole: user.role, newRole: req.body.role },
      });
      res.json(updated);
    } catch (e) { next(e); }
  },
);

// Delete user
userRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id === req.user!.userId) {
      res.status(400).json({ error: 'You cannot delete your own account' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new NotFoundError('User');
    await prisma.user.delete({ where: { id: req.params.id } });
    await auditLog({
      userId: req.user!.userId,
      action: 'USER_DELETED',
      metadata: { deletedUserId: req.params.id, email: user.email },
    });
    res.status(204).send();
  } catch (e) { next(e); }
});
