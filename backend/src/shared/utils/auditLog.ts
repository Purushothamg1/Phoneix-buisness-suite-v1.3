import { prisma } from '../../config/database';
import { logger } from '../utils/logger';

export type AuditAction =
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'USER_CREATED'
  | 'USER_DELETED'
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_DELETED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'STOCK_ADJUSTED'
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'INVOICE_CANCELLED'
  | 'PAYMENT_RECORDED'
  | 'PAYMENT_REFUNDED'
  | 'REPAIR_CREATED'
  | 'REPAIR_UPDATED'
  | 'REPAIR_DELETED'
  | 'SUPPLIER_CREATED'
  | 'SUPPLIER_UPDATED'
  | 'SUPPLIER_DELETED'
  | 'SETTINGS_UPDATED'
  | 'IMPORT_COMPLETED'
  | 'USER_ROLE_CHANGED';

interface AuditOptions {
  userId: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit logger.
 * Failures are caught and logged to the error log but never bubble up to the caller.
 */
export async function auditLog({ userId, action, metadata }: AuditOptions): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        metadata: metadata ? JSON.stringify(metadata) : "{}",
      },
    });
  } catch (err) {
    logger.error('Failed to write audit log', { userId, action, error: err });
  }
}
