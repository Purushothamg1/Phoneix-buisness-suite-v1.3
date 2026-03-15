# Phoneix Business Suite — System Overview

**Version:** 1.0.0 — Production Release  
**License:** MIT  
**Target Market:** Mobile repair shops, electronics retailers, service-based SMBs

---

## 1. Purpose

Phoneix Business Suite is a **full-stack, production-grade business operations platform** designed for mobile repair shops, electronics retailers, and service-based small-to-medium businesses. It consolidates every operational workflow — customer management, inventory tracking, invoicing, repair job lifecycle, payments, and multi-dimensional reporting — into a single, role-aware web application.

The platform eliminates fragmented tooling (spreadsheets for stock, WhatsApp for job cards, paper invoices). All data is centralised, searchable, audit-logged, and accessible to the right users based on role.

---

## 2. System Capabilities

| Capability | Description |
|---|---|
| **Authentication & RBAC** | JWT-based login with three role tiers: ADMIN, MANAGER, STAFF |
| **Customer Management** | Full CRM with history view — invoices, repairs, outstanding balance |
| **Supplier Management** | Supplier directory with contact details and payment terms |
| **Inventory Management** | Product catalogue with real-time stock tracking, low-stock alerts, barcode support, stock movement ledger |
| **Invoice System** | Multi-line invoices with per-item tax, discounts, PDF generation, cancellation with stock restore |
| **Repair Job Tracking** | Complete job lifecycle from intake to delivery with status workflow, technician assignment, parts tracking |
| **Payments** | Multi-method payment recording (Cash, UPI, Card, Bank Transfer), refunds, automatic status transitions |
| **Reports** | Sales, inventory, repair, and financial reports with date range filters and Excel export |
| **Dashboard** | Real-time KPI cards, daily sales bar chart, active repairs feed, low-stock alerts |
| **Import / Export** | CSV/Excel product import with upsert, Excel export, sales report export, WhatsApp PDF sharing |
| **Global Search** | Live debounced search across customers, products, invoices, and repair jobs |
| **Settings** | Business profile, GST number, invoice prefix, default tax rate, logo upload |
| **PDF Generation** | Professional invoice PDFs with QR code placeholder and repair job cards with signature lines |
| **File Uploads** | Product images and business logo with MIME validation |
| **User Management** | Admin-managed user accounts with role assignment and password policies |

---

## 3. Architecture Summary

```
┌──────────────────────────────────────────────────────────────────┐
│                       NGINX Reverse Proxy                         │
│       Rate limiting · Gzip · Security headers · Static files     │
└───────────────────────┬──────────────────────────────────────────┘
                        │
         ┌──────────────┴──────────────┐
         │                             │
  ┌──────▼──────┐               ┌──────▼──────┐
  │  Next.js 14  │               │  Express.js  │
  │  Frontend    │◄─── REST ────►│  Backend API │
  │  (Port 3000) │               │  (Port 5000) │
  └─────────────┘               └──────┬──────┘
                                        │  Prisma ORM
                                 ┌──────▼──────┐
                                 │ PostgreSQL 16│
                                 └─────────────┘
```

All three tiers run as Docker containers orchestrated by Docker Compose.

---

## 4. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend Framework | Next.js 14 (App Router) | SSR-capable React framework |
| Frontend Language | TypeScript 5 | Type safety |
| UI Styling | Tailwind CSS 3 | Utility-first CSS |
| Data Fetching | SWR 2 | Stale-while-revalidate cache |
| Charts | Recharts 2 | Sales & report visualisations |
| HTTP Client | Axios | API communication |
| Form Validation | Zod + react-hook-form | Client-side validation |
| Backend Framework | Express.js 4 | REST API server |
| Backend Language | TypeScript 5 | Type safety |
| ORM | Prisma 5 | Database access + migrations |
| Database | PostgreSQL 16 | Primary data store |
| Auth | JWT (jsonwebtoken 9) | Stateless authentication |
| Hashing | bcrypt 5 (cost 12) | Password hashing |
| Validation | Joi + Celebrate | Schema-based request validation |
| PDF | PDFKit 0.15 | Invoice & job card generation |
| Files | Multer 1 | File upload handling |
| Spreadsheets | SheetJS (xlsx) | Import / export |
| Logging | Winston 3 | Structured JSON logging |
| Security | Helmet · cors · rate-limit | HTTP hardening |
| Containerisation | Docker + Docker Compose 24 | Environment isolation |
| Reverse Proxy | NGINX 1.25 | Load distribution, SSL, caching |

---

## 5. Role Permissions Matrix

| Feature | ADMIN | MANAGER | STAFF |
|---|---|---|---|
| Login | ✅ | ✅ | ✅ |
| Dashboard | ✅ | ✅ | ✅ |
| Customers — View / Create / Edit | ✅ | ✅ | ✅ |
| Customers — Delete | ✅ | ❌ | ❌ |
| Customer History | ✅ | ✅ | ✅ |
| Suppliers — Full CRUD | ✅ | ✅ | ❌ |
| Products — View | ✅ | ✅ | ✅ |
| Products — Create / Edit | ✅ | ✅ | ❌ |
| Products — Delete | ✅ | ❌ | ❌ |
| Stock Adjustment | ✅ | ✅ | ❌ |
| Invoices — View / Create | ✅ | ✅ | ✅ |
| Invoices — Cancel | ✅ | ✅ | ❌ |
| Repairs — View / Create | ✅ | ✅ | ✅ |
| Repairs — Update Status | ✅ | ✅ | ✅ |
| Repairs — Delete | ✅ | ❌ | ❌ |
| Payments — Record | ✅ | ✅ | ❌ |
| Payments — Refund | ✅ | ✅ | ❌ |
| Reports | ✅ | ✅ | ❌ |
| Import / Export | ✅ | ✅ | ❌ |
| Global Search | ✅ | ✅ | ✅ |
| Settings | ✅ | ❌ | ❌ |
| User Management | ✅ | ❌ | ❌ |

---

## 6. Security Posture

- All routes protected with JWT bearer token authentication
- Login rate-limited to **10 attempts / 15 minutes** per IP (brute-force guard)
- Timing-attack-resistant login (bcrypt always runs against a dummy hash)
- Passwords hashed with bcrypt cost factor 12
- Password policy: min 8 chars, must include uppercase, lowercase, and digit
- Helmet security headers on all responses
- CORS restricted to configured `FRONTEND_URL` origins
- Settings endpoint key-whitelisted to prevent arbitrary key injection
- Sensitive fields (passwords, tokens) redacted from structured request logs
- File uploads validated by MIME type (JPEG, PNG, WebP only; 5 MB limit)
- Prisma parameterised queries prevent SQL injection by design

---

## 7. Data Integrity Guarantees

- All stock mutations (deductions, adjustments, restorations) run inside Prisma `$transaction`
- Invoice cancellation atomically restores stock AND marks all payments as refunded
- Overpayment blocked — remaining balance checked before recording payment
- Invoice numbers generated inside transaction with collision detection
- Repair job deletion only permitted in early statuses (RECEIVED / DIAGNOSING), parts stock restored
- Foreign key violations return descriptive 400 errors, not raw 500s
- Negative stock blocked at both API validation and service layer
