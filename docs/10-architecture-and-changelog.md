# Architecture & Changelog

## v1.4.0 (2026-03-15) — Production Deployment Release

### Critical Bug Fixes
- **localStorage key mismatch** — All keys standardized to `phoenix_` prefix. Previously `useAuth.tsx` used `phoneix_token` while `downloadFile()` used `phoenix_token` causing silent authentication failures on PDF downloads.
- **express-slow-down v2 API** — Fixed `delayMs` signature. v2 requires function `(used) => number`, the old `(used) => (used - 5) * 200` was technically compatible but documented as the v1 API.
- **PDF absolute path inconsistency** — `pdf.service.ts` was creating files at relative `./uploads/pdfs/` while download routes resolved to absolute `process.cwd()/uploads/pdfs/`. Unified via `resolveUploadDir()` helper and `pdfService.getPdfFilePath()` method.
- **Dynamic imports for pdfService and invoiceService** — Changed to static imports; dynamic imports in hot paths caused unnecessary module re-evaluation.
- **useSWRMutation imported but unused** — Removed stray import from customers page.
- **CORS in development** — Backend now allows all origins in development (NODE_ENV !== 'production') to prevent local dev friction.
- **trust proxy** — Added `app.set('trust proxy', 1)` required for rate limiting and correct IP detection behind Render/Vercel reverse proxies.

### PDF Improvements
- Logo loading from filesystem: `tryGetLogoPath()` handles both `/uploads/logos/file.png` URL format and absolute paths
- SKU shown under item description in invoice PDF
- Multi-page support: column headers redrawn on continuation pages
- Payment history section in invoice PDF
- Repair PDF: parts table with proper column alignment
- Both PDFs: Helvetica-Bold total box, proper footer text from `receipt_footer` setting
- `regenerateInvoicePdf()` and `regenerateRepairPdf()` helper aliases added

### Deployment Infrastructure (New)
- `render.yaml` — one-file Render Blueprint for backend + database
- `frontend/vercel.json` — Vercel config with security headers
- `.github/workflows/ci.yml` — Full CI: lint, type-check, migrate, test, build for both frontend and backend
- `.env.example` files at root, backend, and frontend levels
- `.gitignore` updated to prevent secret commits
- `docs/DEPLOYMENT.md` — step-by-step Supabase + Render + Vercel deployment guide with rollback, backup, monitoring
- `docs/RUNBOOK.md` — operations runbook

### Security Hardening
- `JWT_SECRET` minimum length check (32 chars, warns to use 64+) at server startup
- `prestart` npm script validates required env vars before server launches
- Sentry integration (optional — only if `SENTRY_DSN` is set)
- Upload directories auto-created at startup (no manual mkdir needed)
- All Joi schemas added max value limits to prevent abuse (max price 9,999,999, max qty 9,999, etc.)

### Other Improvements
- `downloadFile()` now async, throws on error (callers can catch and show toast)
- `useAuth.tsx` trim + lowercase email before login
- `/ready` endpoint checks actual DB connectivity
- Backend `prestart` script validates env before node process starts

---

## v1.3.0
- PDF downloads, WhatsApp+download, repair→invoice, collapsible sidebar, payments rebuilt, mobile UI, Phoenix logo.

## v1.2.0
- Request ID, compression, slow-down, audit logging, WhatsApp share preview, Meta API settings, PDF QR codes.

## v1.1.0
- Initial release: invoices, repairs, payments, inventory, customers, suppliers, reports, import/export, Docker.
