import { Router } from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import { Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';
import { prisma } from '../../config/database';
import { auditLog } from '../../shared/utils/auditLog';

export const settingsRouter = Router();
settingsRouter.use(authenticate);

// All allowed setting keys — whitelist prevents arbitrary key injection
const ALLOWED_KEYS = new Set([
  // Business info
  'business_name', 'business_address', 'business_phone', 'business_email',
  'gst_number', 'invoice_prefix', 'default_tax', 'currency', 'currency_symbol',
  'logo_url', 'receipt_footer', 'timezone',
  // WhatsApp / messaging
  'whatsapp_phone',
  'whatsapp_message_template_invoice',
  'whatsapp_message_template_repair',
  // Meta API (Cloud API) — stored but not auto-used; UI exposes config panel
  'meta_api_enabled',           // '1' or '0'
  'meta_waba_id',               // WhatsApp Business Account ID
  'meta_phone_number_id',       // Phone Number ID
  'meta_access_token',          // Permanent system-user access token
  'meta_webhook_verify_token',  // Webhook verification token
]);

const settingsUpdateSchema = Joi.object({
  // Business info
  business_name:      Joi.string().max(200).optional(),
  business_address:   Joi.string().max(500).optional(),
  business_phone:     Joi.string().max(20).optional(),
  business_email:     Joi.string().email().optional().allow('', null),
  gst_number:         Joi.string().max(50).optional().allow('', null),
  invoice_prefix:     Joi.string().max(10).alphanum().optional(),
  default_tax:        Joi.number().min(0).max(100).optional(),
  currency:           Joi.string().max(10).optional(),
  currency_symbol:    Joi.string().max(5).optional(),
  receipt_footer:     Joi.string().max(500).optional().allow('', null),
  timezone:           Joi.string().max(50).optional(),
  // WhatsApp
  whatsapp_phone:                      Joi.string().max(25).optional().allow('', null),
  whatsapp_message_template_invoice:   Joi.string().max(1000).optional().allow('', null),
  whatsapp_message_template_repair:    Joi.string().max(1000).optional().allow('', null),
  // Meta API
  meta_api_enabled:          Joi.string().valid('0', '1').optional(),
  meta_waba_id:              Joi.string().max(100).optional().allow('', null),
  meta_phone_number_id:      Joi.string().max(100).optional().allow('', null),
  meta_access_token:         Joi.string().max(500).optional().allow('', null),
  meta_webhook_verify_token: Joi.string().max(100).optional().allow('', null),
}).min(1);

// GET /api/settings — anyone authenticated can read (needed for invoice rendering)
settingsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.setting.findMany();
    const obj = settings.reduce((acc: Record<string, string>, s) => {
      // Never expose sensitive tokens over the API in full
      if (s.key === 'meta_access_token' && s.value) {
        acc[s.key] = s.value.length > 8 ? `${s.value.substring(0, 4)}...${s.value.slice(-4)}` : '****';
      } else {
        acc[s.key] = s.value;
      }
      return acc;
    }, {});
    res.json(obj);
  } catch (e) { next(e); }
});

// PUT /api/settings — ADMIN only
settingsRouter.put(
  '/',
  authorize('ADMIN'),
  celebrate({ [Segments.BODY]: settingsUpdateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updates = req.body as Record<string, string | number>;
      const filtered = Object.entries(updates).filter(([key]) => ALLOWED_KEYS.has(key));
      if (!filtered.length) {
        res.status(400).json({ error: 'No valid setting keys provided' });
        return;
      }

      const ops = filtered.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        }),
      );
      await Promise.all(ops);

      await auditLog({
        userId: req.user!.userId,
        action: 'SETTINGS_UPDATED',
        metadata: { keys: filtered.map(([k]) => k) },
      });

      // Return full settings (re-fetch to reflect DB state)
      const all = await prisma.setting.findMany();
      const obj = all.reduce((acc: Record<string, string>, s) => {
        if (s.key === 'meta_access_token' && s.value) {
          acc[s.key] = s.value.length > 8 ? `${s.value.substring(0, 4)}...${s.value.slice(-4)}` : '****';
        } else {
          acc[s.key] = s.value;
        }
        return acc;
      }, {});
      res.json(obj);
    } catch (e) { next(e); }
  },
);

// PUT /api/settings/meta-token — Separate endpoint for full token update (ADMIN only)
settingsRouter.put(
  '/meta-token',
  authorize('ADMIN'),
  celebrate({
    [Segments.BODY]: Joi.object({
      meta_access_token: Joi.string().min(10).max(500).required(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.setting.upsert({
        where: { key: 'meta_access_token' },
        update: { value: req.body.meta_access_token },
        create: { key: 'meta_access_token', value: req.body.meta_access_token },
      });
      await auditLog({ userId: req.user!.userId, action: 'SETTINGS_UPDATED', metadata: { keys: ['meta_access_token'] } });
      res.json({ message: 'Meta access token saved securely' });
    } catch (e) { next(e); }
  },
);
