import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';
import { prisma } from '../../config/database';
import { ValidationError } from '../../shared/errors/AppError';
import fs from 'fs';

export const uploadRouter = Router();
uploadRouter.use(authenticate);

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const type = req.path.includes('logo') ? 'logos' : 'products';
    const dir = path.join(UPLOAD_DIR, type);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`);
  },
});

const fileFilter = (_req: Request, file: any, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new ValidationError('Only JPEG, PNG, and WebP images are allowed'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
});

uploadRouter.post('/product-image/:productId', authorize('ADMIN', 'MANAGER'), upload.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new ValidationError('No file uploaded');
    const imageUrl = `/uploads/products/${req.file.filename}`;
    const product = await prisma.product.update({
      where: { id: req.params.productId },
      data: { imageUrl },
    });
    res.json({ imageUrl, product });
  } catch (e) { next(e); }
});

uploadRouter.post('/logo', authorize('ADMIN'), upload.single('logo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new ValidationError('No file uploaded');
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    await prisma.setting.upsert({
      where: { key: 'logo_url' },
      update: { value: logoUrl },
      create: { key: 'logo_url', value: logoUrl },
    });
    res.json({ logoUrl });
  } catch (e) { next(e); }
});
