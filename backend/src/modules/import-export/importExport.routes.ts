import { pdfService } from '../pdf/pdf.service';
import { Router } from 'express';
import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';
import { prisma } from '../../config/database';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import * as XLSX from 'xlsx';

export const importExportRouter = Router();
importExportRouter.use(authenticate, authorize('ADMIN', 'MANAGER'));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Product Import
importExportRouter.post('/products/import', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];
    if (!rows.length) { res.status(400).json({ error: 'File is empty or has no data rows' }); return; }
    const results = { imported: 0, updated: 0, skipped: 0, errors: [] as string[] };
    for (const [index, row] of rows.entries()) {
      try {
        const sku = String(row.sku || row.SKU || row.Sku || '').trim();
        if (!sku) { results.errors.push(`Row ${index + 2}: missing SKU`); results.skipped++; continue; }
        const name = String(row.name || row.Name || '').trim();
        if (!name) { results.errors.push(`Row ${index + 2}: missing name`); results.skipped++; continue; }
        const sellingPrice = parseFloat(row.sellingPrice || row.selling_price || row['Selling Price'] || 0);
        const existing = await prisma.product.findUnique({ where: { sku } });
        await prisma.product.upsert({
          where: { sku },
          update: { name, category: String(row.category || row.Category || '').trim() || null, purchasePrice: parseFloat(row.purchasePrice || row.purchase_price || row['Purchase Price'] || 0), sellingPrice, stockQty: parseInt(row.stockQty || row.stock_qty || row['Stock Qty'] || 0), minStockLevel: parseInt(row.minStockLevel || row.min_stock || row['Min Stock Level'] || 5) },
          create: { sku, name, barcode: row.barcode || row.Barcode || null, category: String(row.category || row.Category || '').trim() || null, purchasePrice: parseFloat(row.purchasePrice || row.purchase_price || row['Purchase Price'] || 0), sellingPrice, stockQty: parseInt(row.stockQty || row.stock_qty || row['Stock Qty'] || 0), minStockLevel: parseInt(row.minStockLevel || row.min_stock || row['Min Stock Level'] || 5) },
        });
        if (existing) results.updated++; else results.imported++;
      } catch (err: any) { results.skipped++; results.errors.push(`Row ${index + 2}: ${err?.message || 'Unknown error'}`); }
    }
    res.json(results);
  } catch (e) { next(e); }
});

// ── Product Export
importExportRouter.get('/products/export', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });
    const data = products.map((p) => ({ SKU: p.sku, Name: p.name, Category: p.category || '', Barcode: p.barcode || '', 'Purchase Price': Number(p.purchasePrice), 'Selling Price': Number(p.sellingPrice), 'Stock Qty': p.stockQty, 'Min Stock Level': p.minStockLevel }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 15 }, { wch: 35 }, { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="products-export-${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// ── Sales Report Export
importExportRouter.get('/reports/sales/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    to.setHours(23, 59, 59, 999);
    const invoices = await prisma.invoice.findMany({ where: { createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } }, include: { customer: { select: { name: true, phone: true } }, payments: { where: { refunded: false } } }, orderBy: { createdAt: 'desc' } });
    const data = invoices.map((inv) => { const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0); return { 'Invoice #': inv.number, Customer: inv.customer.name, Phone: inv.customer.phone, Status: inv.status, 'Tax Amount': Number(inv.taxAmount), Discount: Number(inv.discount), 'Total Amount': Number(inv.totalAmount), 'Amount Paid': paid, Outstanding: Math.max(0, Number(inv.totalAmount) - paid), Date: inv.createdAt.toLocaleDateString('en-IN') }; });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Sales Report');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="sales-report-${from.toISOString().split('T')[0]}-to-${to.toISOString().split('T')[0]}.xlsx"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// ── Customers Export
importExportRouter.get('/customers/export', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } });
    const data = customers.map((c) => ({ Name: c.name, Phone: c.phone, Email: c.email || '', Address: c.address || '', Notes: c.notes || '', 'Created At': c.createdAt.toLocaleDateString('en-IN') }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Customers');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="customers-export-${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// ── WhatsApp Share + PDF Download Trigger
importExportRouter.post('/prepare-send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, id } = req.body as { type: 'invoice' | 'repair'; id: string };
    if (!type || !id) throw new ValidationError('type and id are required');

    const settingsRows = await prisma.setting.findMany();
    const settings = settingsRows.reduce((acc: Record<string, string>, s) => { acc[s.key] = s.value; return acc; }, {});
    const bizName = settings.business_name || 'Our Business';
    const currency = settings.currency_symbol || '₹';

    let pdfUrl = '';
    let pdfName = '';
    let phone = '';
    let message = '';
    let downloadUrl = '';

    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || '';

    if (type === 'invoice') {
      const invoice = await prisma.invoice.findUnique({ where: { id }, include: { customer: true, payments: { where: { refunded: false } } } });
      if (!invoice) throw new NotFoundError('Invoice');

      if (!invoice.pdfUrl) {
        
        const url = await pdfService.generateInvoicePdf(id);
        await prisma.invoice.update({ where: { id }, data: { pdfUrl: url } });
        pdfUrl = url;
      } else {
        pdfUrl = invoice.pdfUrl;
      }

      const paid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
      const outstanding = Math.max(0, Number(invoice.totalAmount) - paid);
      phone = invoice.customer.phone.replace(/\D/g, '');
      pdfName = pdfUrl.split('/').pop() || `${invoice.number}.pdf`;
      // Download URL points to the force-download endpoint
      downloadUrl = `/api/invoices/${id}/pdf/download`;

      const lines = [`Hello ${invoice.customer.name}! 👋`, ``, `Your invoice from *${bizName}* is ready.`, ``, `📋 *Invoice #:* ${invoice.number}`, `💰 *Total:* ${currency}${Number(invoice.totalAmount).toFixed(2)}`];
      if (paid > 0) lines.push(`✅ *Paid:* ${currency}${paid.toFixed(2)}`);
      if (outstanding > 0.01) lines.push(`⏳ *Outstanding:* ${currency}${outstanding.toFixed(2)}`);
      lines.push(``, `Please find the PDF invoice attached.`);
      if (settings.receipt_footer) lines.push(``, settings.receipt_footer);
      message = lines.join('\n');

    } else if (type === 'repair') {
      const repair = await prisma.repairJob.findUnique({ where: { id }, include: { customer: true } });
      if (!repair) throw new NotFoundError('Repair job');

      if (!repair.pdfUrl) {
        
        const url = await pdfService.generateRepairPdf(id);
        await prisma.repairJob.update({ where: { id }, data: { pdfUrl: url } });
        pdfUrl = url;
      } else {
        pdfUrl = repair.pdfUrl;
      }

      phone = repair.customer.phone.replace(/\D/g, '');
      pdfName = pdfUrl.split('/').pop() || `${repair.jobId}.pdf`;
      downloadUrl = `/api/repairs/${id}/pdf/download`;

      const statusMessages: Record<string, string> = { RECEIVED: 'We have received your device and it is being logged.', DIAGNOSING: 'Our technician is currently diagnosing your device.', WAITING_FOR_PARTS: 'We are waiting for the required parts to arrive.', IN_REPAIR: 'Your device is currently being repaired.', READY: 'Great news! Your device is repaired and ready for collection. 🎉', DELIVERED: 'Your device has been delivered. Thank you for choosing us!' };
      const lines = [`Hello ${repair.customer.name}! 👋`, ``, `Update on your repair at *${bizName}*:`, ``, `🔧 *Job ID:* ${repair.jobId}`, `📱 *Device:* ${repair.brand} ${repair.model}`, `📌 *Status:* ${repair.status.replace(/_/g, ' ')}`, ``, statusMessages[repair.status] || 'Thank you for choosing us.'];
      if (repair.finalCost) lines.push(``, `💰 *Final Cost:* ${currency}${Number(repair.finalCost).toFixed(2)}`);
      else if (repair.estimatedCost) lines.push(``, `💰 *Estimated Cost:* ${currency}${Number(repair.estimatedCost).toFixed(2)}`);
      lines.push(``, `Please find the job card attached.`);
      if (settings.receipt_footer) lines.push(``, settings.receipt_footer);
      message = lines.join('\n');
    } else {
      throw new ValidationError('Invalid type');
    }

    const cleanPhone = phone.replace(/^\+/, '');
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    const pdfDirectUrl = appUrl ? `${appUrl}${pdfUrl}` : pdfUrl;

    res.json({ pdfUrl: pdfDirectUrl, pdfName, phone, message, whatsappUrl, downloadUrl });
  } catch (e) { next(e); }
});
