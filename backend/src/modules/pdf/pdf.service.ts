import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors/AppError';
import { logger } from '../../shared/utils/logger';

// ── Resolve upload directory to absolute path ─────────────────────────
function resolveUploadDir(): string {
  const raw = process.env.UPLOAD_DIR || './uploads';
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function getPdfDir(): string {
  return path.join(resolveUploadDir(), 'pdfs');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Sanitize a string for safe use as a filename fragment */
function safeName(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 30)
    .replace(/^_+|_+$/g, '');
}

async function getBusinessSettings(): Promise<Record<string, string>> {
  try {
    const settings = await prisma.setting.findMany();
    return settings.reduce((acc: Record<string, string>, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

async function generateQrDataUrl(text: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(text, { width: 80, margin: 1, color: { dark: '#1e293b', light: '#ffffff' } });
  } catch {
    return null;
  }
}

// ── Try to load logo from filesystem ──────────────────────────────────
function tryGetLogoPath(logoUrl: string | undefined): string | null {
  if (!logoUrl) return null;
  try {
    // logoUrl might be '/uploads/logos/filename.png' — resolve to absolute filesystem path
    const uploadDir = resolveUploadDir();
    // Strip leading /uploads/ prefix if present
    const relative = logoUrl.replace(/^\/uploads\//, '');
    const absPath = path.join(uploadDir, relative);
    if (fs.existsSync(absPath)) return absPath;
    // Fallback: try as-is
    if (path.isAbsolute(logoUrl) && fs.existsSync(logoUrl)) return logoUrl;
  } catch {
    // ignore
  }
  return null;
}

const C_BLUE = '#2563eb';
const C_SLATE = '#1e293b';
const C_GRAY = '#64748b';
const C_LIGHT = '#f1f5f9';

/**
 * PDFKit's built-in fonts (Helvetica/Times) only cover Latin-1.
 * The ₹ symbol (U+20B9) is outside that range and renders as '¹'.
 * Convert to an ASCII-safe equivalent for PDF output only.
 */
function pdfSafeCurrency(symbol: string): string {
  return symbol === '₹' ? 'Rs.' : symbol;
}

function drawHeader(doc: PDFDocument, settings: Record<string, string>): void {
  const businessName = settings.business_name || 'Business';
  const logoPath = tryGetLogoPath(settings.logo_url);

  let textX = 50;
  if (logoPath) {
    try {
      doc.image(logoPath, 50, 40, { height: 48, fit: [80, 48] });
      textX = 140;
    } catch {
      // logo failed to load, use text only
    }
  }

  doc.fontSize(19).font('Helvetica-Bold').fillColor(C_SLATE)
    .text(businessName, textX, 45);
  doc.fontSize(8.5).font('Helvetica').fillColor(C_GRAY);
  let infoY = 68;
  if (settings.business_address) { doc.text(settings.business_address, textX, infoY); infoY += 11; }
  if (settings.business_phone)   { doc.text(`Phone: ${settings.business_phone}`, textX, infoY); infoY += 11; }
  if (settings.business_email)   { doc.text(`Email: ${settings.business_email}`, textX, infoY); infoY += 11; }
  if (settings.gst_number)       { doc.text(`GST: ${settings.gst_number}`, textX, infoY); }
}

function drawDivider(doc: PDFDocument, y: number, color = '#e2e8f0'): void {
  doc.moveTo(50, y).lineTo(545, y).strokeColor(color).lineWidth(0.5).stroke();
}

export const pdfService = {
  /**
   * Generate invoice PDF.
   * Returns public URL path: /uploads/pdfs/<filename>
   */
  async generateInvoicePdf(invoiceId: string): Promise<string> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        items: { include: { product: { select: { name: true, sku: true } } } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!invoice) throw new NotFoundError('Invoice');

    const settings = await getBusinessSettings();
    const pdfDir = getPdfDir();
    ensureDir(pdfDir);

    const filename = `${safeName(invoice.customer.name)}-${invoice.number}.pdf`;
    const filepath = path.join(pdfDir, filename);
    const currency = pdfSafeCurrency(settings.currency_symbol || '₹');
    const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
    const qrText = appUrl ? `${appUrl}/invoices/${invoice.id}` : `Invoice: ${invoice.number}`;
    const qrDataUrl = await generateQrDataUrl(qrText);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4', margin: 50,
        info: {
          Title: `Invoice ${invoice.number}`,
          Author: settings.business_name || 'Phoenix Business Suite',
          Subject: `Invoice for ${invoice.customer.name}`,
        },
      });
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // ── Header ─────────────────────────────────────────────────────
      drawHeader(doc, settings);

      // ── Invoice Title (right) ──────────────────────────────────────
      doc.fontSize(26).font('Helvetica-Bold').fillColor(C_BLUE)
        .text('INVOICE', 0, 45, { align: 'right' });

      const statusColor = invoice.status === 'PAID' ? '#16a34a'
        : invoice.status === 'PARTIAL' ? '#d97706' : '#dc2626';
      doc.fontSize(9).font('Helvetica').fillColor(C_GRAY)
        .text(`Invoice #: ${invoice.number}`, 0, 80, { align: 'right' })
        .text(`Date: ${invoice.createdAt.toLocaleDateString('en-IN')}`, { align: 'right' });
      doc.fontSize(10).font('Helvetica-Bold').fillColor(statusColor)
        .text(invoice.status, 0, 102, { align: 'right' });

      drawDivider(doc, 128);

      // ── Bill To ────────────────────────────────────────────────────
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C_GRAY)
        .text('BILL TO', 50, 142);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(C_SLATE)
        .text(invoice.customer.name, 50, 155);
      doc.fontSize(9).font('Helvetica').fillColor(C_GRAY);
      let custY = 170;
      doc.text(invoice.customer.phone, 50, custY); custY += 13;
      if (invoice.customer.email) { doc.text(invoice.customer.email, 50, custY); custY += 13; }
      if (invoice.customer.address) { doc.text(invoice.customer.address, 50, custY); }

      // ── Items Table ────────────────────────────────────────────────
      const tableTop = 235;
      doc.rect(50, tableTop, 495, 20).fill(C_LIGHT);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C_SLATE);
      doc.text('#', 55, tableTop + 6);
      doc.text('Description', 72, tableTop + 6);
      doc.text('Qty', 295, tableTop + 6, { width: 40, align: 'right' });
      doc.text('Unit Price', 340, tableTop + 6, { width: 70, align: 'right' });
      doc.text('Tax%', 415, tableTop + 6, { width: 40, align: 'right' });
      doc.text('Total', 460, tableTop + 6, { width: 80, align: 'right' });

      let y = tableTop + 25;
      doc.font('Helvetica').fontSize(9).fillColor(C_SLATE);

      invoice.items.forEach((item, idx) => {
        if (y > 680) {
          doc.addPage();
          y = 50;
          // Redraw header on new page
          doc.rect(50, y, 495, 20).fill(C_LIGHT);
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C_SLATE);
          doc.text('#', 55, y + 6); doc.text('Description', 72, y + 6);
          doc.text('Qty', 295, y + 6, { width: 40, align: 'right' });
          doc.text('Unit Price', 340, y + 6, { width: 70, align: 'right' });
          doc.text('Tax%', 415, y + 6, { width: 40, align: 'right' });
          doc.text('Total', 460, y + 6, { width: 80, align: 'right' });
          y += 25;
          doc.font('Helvetica').fontSize(9).fillColor(C_SLATE);
        }
        if (idx % 2 === 1) doc.rect(50, y - 3, 495, 18).fill('#f8fafc');
        doc.fillColor(C_SLATE);
        doc.text(String(idx + 1), 55, y);
        const desc = item.description.substring(0, 40);
        doc.text(desc, 72, y);
        if (item.product) {
          doc.fontSize(7.5).fillColor(C_GRAY).text(`SKU: ${item.product.sku}`, 72, y + 10);
          doc.fontSize(9).fillColor(C_SLATE);
          y += 5;
        }
        doc.text(String(item.qty), 295, y, { width: 40, align: 'right' });
        doc.text(`${currency}${Number(item.unitPrice).toFixed(2)}`, 340, y, { width: 70, align: 'right' });
        doc.text(`${Number(item.tax)}%`, 415, y, { width: 40, align: 'right' });
        doc.text(`${currency}${Number(item.total).toFixed(2)}`, 460, y, { width: 80, align: 'right' });
        y += 20;
      });

      drawDivider(doc, y + 4);
      y += 16;

      // ── Totals ─────────────────────────────────────────────────────
      const subtotal = Number(invoice.totalAmount) - Number(invoice.taxAmount) + Number(invoice.discount);
      doc.font('Helvetica').fontSize(9).fillColor(C_GRAY);
      doc.text('Subtotal:', 360, y);
      doc.text(`${currency}${subtotal.toFixed(2)}`, 460, y, { width: 80, align: 'right' }); y += 14;
      doc.text('Tax:', 360, y);
      doc.text(`${currency}${Number(invoice.taxAmount).toFixed(2)}`, 460, y, { width: 80, align: 'right' }); y += 14;
      if (Number(invoice.discount) > 0) {
        doc.fillColor('#16a34a');
        doc.text('Discount:', 360, y);
        doc.text(`-${currency}${Number(invoice.discount).toFixed(2)}`, 460, y, { width: 80, align: 'right' }); y += 14;
      }
      // Total box
      doc.rect(355, y + 2, 185, 22).fill(C_BLUE);
      doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('TOTAL:', 362, y + 7);
      doc.text(`${currency}${Number(invoice.totalAmount).toFixed(2)}`, 460, y + 7, { width: 75, align: 'right' });
      y += 32;

      // ── Payment Summary ────────────────────────────────────────────
      const paidPayments = (invoice.payments ?? []).filter((p) => !p.refunded);
      const paidAmt = paidPayments.reduce((s, p) => s + Number(p.amount), 0);
      const outstanding = Math.max(0, Number(invoice.totalAmount) - paidAmt);

      if (paidAmt > 0) {
        doc.fontSize(9).font('Helvetica').fillColor('#16a34a')
          .text(`Amount Paid: ${currency}${paidAmt.toFixed(2)}`, 360, y, { width: 180, align: 'right' }); y += 14;
        if (outstanding > 0.01) {
          doc.fillColor('#dc2626').font('Helvetica-Bold')
            .text(`Outstanding: ${currency}${outstanding.toFixed(2)}`, 360, y, { width: 180, align: 'right' }); y += 14;
        } else {
          doc.fillColor('#16a34a').font('Helvetica-Bold')
            .text('FULLY PAID', 360, y, { width: 180, align: 'right' }); y += 14;
        }
      }

      // ── Payment History ────────────────────────────────────────────
      if (paidPayments.length > 0) {
        y += 10;
        doc.fontSize(8).font('Helvetica-Bold').fillColor(C_GRAY).text('PAYMENT HISTORY', 50, y); y += 13;
        paidPayments.forEach((p) => {
          doc.font('Helvetica').fontSize(8.5).fillColor(C_SLATE)
            .text(`${p.method.replace('_', ' ')} — ${currency}${Number(p.amount).toFixed(2)} on ${p.createdAt.toLocaleDateString('en-IN')}`, 55, y);
          y += 13;
        });
      }

      // ── QR Code ────────────────────────────────────────────────────
      if (qrDataUrl) {
        try {
          const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
          const qrY = Math.max(y + 15, 645);
          doc.image(qrBuffer, 50, qrY, { width: 68 });
          doc.fontSize(7).fillColor(C_GRAY).text('Scan to view', 50, qrY + 72, { width: 68, align: 'center' });
        } catch { /* ignore QR failure */ }
      }

      // ── Footer ─────────────────────────────────────────────────────
      const footerY = 765;
      drawDivider(doc, footerY - 6);
      doc.fontSize(8).font('Helvetica').fillColor(C_GRAY);
      const footer = settings.receipt_footer || 'Thank you for your business!';
      doc.text(footer, 50, footerY, { align: 'center', width: 495 });
      doc.fontSize(7).text('Phoenix Business Suite v1.4.0', 50, footerY + 13, { align: 'center', width: 495 });

      doc.end();
      stream.on('finish', () => {
        logger.info(`PDF generated: ${filename}`);
        resolve(`/uploads/pdfs/${filename}`);
      });
      stream.on('error', (err) => {
        logger.error(`PDF generation error: ${filename}`, err);
        reject(err);
      });
    });
  },

  /**
   * Generate repair job card PDF.
   */
  async generateRepairPdf(repairId: string): Promise<string> {
    const repair = await prisma.repairJob.findUnique({
      where: { id: repairId },
      include: {
        customer: true,
        technician: { select: { id: true, name: true } },
        parts: { include: { product: { select: { name: true, sku: true } } } },
      },
    });
    if (!repair) throw new NotFoundError('Repair job');

    const settings = await getBusinessSettings();
    const pdfDir = getPdfDir();
    ensureDir(pdfDir);

    const filename = `${safeName(repair.customer.name)}-${repair.jobId}.pdf`;
    const filepath = path.join(pdfDir, filename);
    const currency = pdfSafeCurrency(settings.currency_symbol || '₹');
    const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
    const qrText = appUrl ? `${appUrl}/repairs/${repair.id}` : `Repair: ${repair.jobId}`;
    const qrDataUrl = await generateQrDataUrl(qrText);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4', margin: 50,
        info: {
          Title: `Repair Job Card ${repair.jobId}`,
          Author: settings.business_name || 'Phoenix Business Suite',
          Subject: `Repair for ${repair.customer.name}`,
        },
      });
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // ── Header ─────────────────────────────────────────────────────
      drawHeader(doc, settings);

      // ── Title ──────────────────────────────────────────────────────
      doc.fontSize(24).font('Helvetica-Bold').fillColor('#7c3aed')
        .text('JOB CARD', 0, 45, { align: 'right' });
      const sColor = repair.status === 'DELIVERED' ? '#16a34a'
        : repair.status === 'READY' ? C_BLUE
        : repair.status === 'IN_REPAIR' ? '#7c3aed' : '#d97706';
      doc.fontSize(9).font('Helvetica').fillColor(C_GRAY)
        .text(`Job ID: ${repair.jobId}`, 0, 80, { align: 'right' })
        .text(`Date: ${repair.createdAt.toLocaleDateString('en-IN')}`, { align: 'right' });
      doc.fontSize(9).font('Helvetica-Bold').fillColor(sColor)
        .text(repair.status.replace(/_/g, ' '), 0, 102, { align: 'right' });

      drawDivider(doc, 128);

      // ── Customer & Device ──────────────────────────────────────────
      let y = 142;
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C_GRAY)
        .text('CUSTOMER', 50, y).text('DEVICE', 310, y);
      y += 13;

      doc.fontSize(11).font('Helvetica-Bold').fillColor(C_SLATE)
        .text(repair.customer.name, 50, y)
        .text(`${repair.brand} ${repair.model}`, 310, y);
      y += 15;

      doc.fontSize(9).font('Helvetica').fillColor(C_GRAY)
        .text(repair.customer.phone, 50, y)
        .text(repair.deviceType, 310, y);
      y += 13;

      if (repair.customer.email) {
        doc.text(repair.customer.email, 50, y);
      }
      doc.text(`Serial: ${repair.serialNumber || 'N/A'}`, 310, y);
      y += 20;

      drawDivider(doc, y); y += 14;

      // ── Issue ──────────────────────────────────────────────────────
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C_GRAY).text('REPORTED ISSUE', 50, y); y += 13;
      const issueLines = repair.issueDescription.match(/.{1,90}/g) || [repair.issueDescription];
      doc.fontSize(9).font('Helvetica').fillColor(C_SLATE);
      issueLines.forEach((line) => { doc.text(line, 55, y); y += 13; });
      y += 5;

      // ── Repair Notes ───────────────────────────────────────────────
      if (repair.repairNotes) {
        drawDivider(doc, y); y += 14;
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C_GRAY).text('REPAIR NOTES', 50, y); y += 13;
        const noteLines = repair.repairNotes.match(/.{1,90}/g) || [repair.repairNotes];
        doc.fontSize(9).font('Helvetica').fillColor(C_SLATE);
        noteLines.forEach((line) => { doc.text(line, 55, y); y += 13; });
        y += 5;
      }

      // ── Parts ──────────────────────────────────────────────────────
      if (repair.parts.length > 0) {
        drawDivider(doc, y); y += 14;
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C_GRAY).text('PARTS USED', 50, y); y += 13;

        doc.rect(50, y, 495, 18).fill(C_LIGHT);
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C_SLATE);
        doc.text('Part', 55, y + 5); doc.text('SKU', 240, y + 5);
        doc.text('Qty', 330, y + 5, { width: 40, align: 'right' });
        doc.text('Cost', 375, y + 5, { width: 65, align: 'right' });
        doc.text('Subtotal', 445, y + 5, { width: 95, align: 'right' });
        y += 22;

        let partsTotal = 0;
        repair.parts.forEach((p, idx) => {
          const sub = p.qty * Number(p.cost);
          partsTotal += sub;
          if (idx % 2 === 1) doc.rect(50, y - 3, 495, 16).fill('#f8fafc');
          doc.font('Helvetica').fontSize(8.5).fillColor(C_SLATE);
          doc.text(p.product.name.substring(0, 26), 55, y);
          doc.text(p.product.sku, 240, y);
          doc.text(String(p.qty), 330, y, { width: 40, align: 'right' });
          doc.text(`${currency}${Number(p.cost).toFixed(2)}`, 375, y, { width: 65, align: 'right' });
          doc.text(`${currency}${sub.toFixed(2)}`, 445, y, { width: 95, align: 'right' });
          y += 16;
        });
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C_SLATE)
          .text(`Parts Total: ${currency}${partsTotal.toFixed(2)}`, 375, y, { width: 165, align: 'right' });
        y += 20;
      }

      // ── Cost ───────────────────────────────────────────────────────
      if (repair.estimatedCost || repair.finalCost) {
        drawDivider(doc, y); y += 14;
        if (repair.estimatedCost && !repair.finalCost) {
          doc.fontSize(9).font('Helvetica').fillColor(C_GRAY)
            .text(`Estimated Cost: ${currency}${Number(repair.estimatedCost).toFixed(2)}`, 50, y);
          y += 18;
        }
        if (repair.finalCost) {
          doc.rect(50, y, 200, 22).fill('#7c3aed');
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff')
            .text(`Final Cost: ${currency}${Number(repair.finalCost).toFixed(2)}`, 55, y + 6);
          y += 30;
        }
      }

      // ── Technician ─────────────────────────────────────────────────
      if (repair.technician) {
        y += 5;
        doc.fontSize(9).font('Helvetica').fillColor(C_GRAY)
          .text(`Assigned Technician: ${repair.technician.name}`, 50, y);
        y += 20;
      }

      // ── QR Code ────────────────────────────────────────────────────
      if (qrDataUrl) {
        try {
          const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
          const qrY = Math.max(y + 10, 640);
          doc.image(qrBuffer, 50, qrY, { width: 68 });
          doc.fontSize(7).fillColor(C_GRAY).text('Scan to view', 50, qrY + 72, { width: 68, align: 'center' });
        } catch { /* ignore */ }
      }

      // ── Signatures ─────────────────────────────────────────────────
      drawDivider(doc, 724); 
      doc.fontSize(8.5).font('Helvetica').fillColor(C_GRAY)
        .text('Customer Signature: ___________________________', 50, 732)
        .text('Technician Signature: ___________________________', 300, 732);

      // ── Footer ─────────────────────────────────────────────────────
      drawDivider(doc, 762);
      const footer = settings.receipt_footer || 'Thank you for choosing us!';
      doc.fontSize(8).text(footer, 50, 767, { align: 'center', width: 495 });
      doc.fontSize(7).text('Phoenix Business Suite v1.4.0', 50, 780, { align: 'center', width: 495 });

      doc.end();
      stream.on('finish', () => {
        logger.info(`PDF generated: ${filename}`);
        resolve(`/uploads/pdfs/${filename}`);
      });
      stream.on('error', (err) => {
        logger.error(`PDF generation error: ${filename}`, err);
        reject(err);
      });
    });
  },

  async regenerateInvoicePdf(invoiceId: string): Promise<string> {
    return this.generateInvoicePdf(invoiceId);
  },
  async regenerateRepairPdf(repairId: string): Promise<string> {
    return this.generateRepairPdf(repairId);
  },

  /** Returns the absolute filesystem path for a pdf URL stored in DB */
  getPdfFilePath(pdfUrl: string): string {
    return path.join(getPdfDir(), path.basename(pdfUrl));
  },
};
