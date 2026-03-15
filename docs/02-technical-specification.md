# Phoneix Business Suite — Technical Specification

**Version:** 1.0.0  
**Document Type:** Technical Reference

---

## 1. Backend Architecture

### 1.1 Framework & Runtime

The backend is an **Express.js 4** application written in **TypeScript 5**, running on **Node.js 20 LTS**. The entry point `src/server.ts` connects to PostgreSQL via Prisma, then starts the HTTP server with graceful `SIGTERM` shutdown.

### 1.2 Module Structure

```
backend/src/
├── app.ts                          # Express app: middleware + route registration
├── server.ts                       # Process entry point, DB connect, graceful shutdown
├── config/
│   ├── database.ts                 # Prisma client singleton
│   └── seed.ts                     # Database seed (admin user + default settings)
├── modules/
│   ├── auth/
│   │   ├── auth.routes.ts          # POST /login, GET /me, POST /change-password
│   │   ├── auth.controller.ts      # Request handlers
│   │   ├── auth.service.ts         # Business logic, timing-safe login, bcrypt
│   │   └── user.routes.ts          # Admin: list / create / delete users
│   ├── customers/
│   │   ├── customer.routes.ts      # CRUD + GET /:id/history
│   │   ├── customer.controller.ts
│   │   └── customer.service.ts     # Phone dedup, paginated list, history aggregation
│   ├── suppliers/
│   │   └── supplier.routes.ts      # CRUD, MANAGER+ only
│   ├── inventory/
│   │   ├── product.routes.ts       # CRUD + /low-stock + /categories + /:id/adjust-stock + /:id/movements
│   │   ├── product.controller.ts
│   │   └── product.service.ts      # Raw SQL for column comparison (stockQty <= minStockLevel)
│   ├── invoices/
│   │   ├── invoice.routes.ts       # CRUD + /:id/cancel
│   │   └── invoice.service.ts      # Transactional create, stock deduct, number generation, cancel
│   ├── repairs/
│   │   ├── repair.routes.ts        # CRUD, status update
│   │   └── repair.service.ts       # Job ID generation, parts stock deduct, delete guard
│   ├── payments/
│   │   └── payment.routes.ts       # POST / (record), POST /refund, GET / (paginated)
│   ├── pdf/
│   │   └── pdf.service.ts          # PDFKit invoice PDF + repair job card
│   ├── reports/
│   │   └── report.routes.ts        # GET /sales, /inventory, /repairs, /financial
│   ├── dashboard/
│   │   └── dashboard.routes.ts     # Aggregated KPIs + sales-by-day chart data
│   ├── settings/
│   │   └── settings.routes.ts      # GET / (all), PUT / (whitelisted keys, ADMIN)
│   ├── search/
│   │   └── search.routes.ts        # GET /?q= (parallel search, min 2 chars)
│   ├── upload/
│   │   └── upload.routes.ts        # POST /product-image/:id, POST /logo
│   └── import-export/
│       └── importExport.routes.ts  # Product import, product/sales export, WhatsApp
└── shared/
    ├── errors/
    │   └── AppError.ts             # AppError hierarchy: Not Found, Validation, Auth, Conflict
    ├── middleware/
    │   ├── auth.middleware.ts       # authenticate (JWT), authorize(...roles) RBAC
    │   ├── errorHandler.ts         # Global: Celebrate, Prisma P2002/P2003/P2025, AppError
    │   └── requestLogger.ts        # Winston structured logging, sensitive field redaction
    └── utils/
        ├── logger.ts               # Winston logger (console + file in production)
        └── pagination.ts           # getPaginationParams, buildPaginatedResult
```

### 1.3 Middleware Stack (in order)

1. `helmet()` — HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)
2. `cors()` — Origin whitelist from `FRONTEND_URL` env var
3. `express-rate-limit` (general: 200 req / 15 min on `/api/`)
4. `express-rate-limit` (auth: 10 req / 15 min on `/api/auth/login`, skip successes)
5. `express.json({ limit: '10mb' })` — body parsing
6. `express.static` — serve `/uploads` directory
7. `requestLogger` — structured per-request logging
8. Route handlers
9. `errorHandler` — global error handling

### 1.4 Authentication Flow

```
Client → POST /api/auth/login { email, password }
       → authLimiter (10/15min, skip successes)
       → Joi validation
       → prisma.user.findUnique({ email })
       → bcrypt.compare(password, hash || dummyHash)  ← timing-safe
       → jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '8h' })
       → { token, user: { id, email, name, role } }
```

All subsequent requests attach `Authorization: Bearer <token>`. The `authenticate` middleware verifies the JWT, re-fetches the user from the database (prevents stale roles), and attaches `req.user`.

---

## 2. Frontend Architecture

### 2.1 Framework

**Next.js 14** with the App Router. All pages are `'use client'` components (no SSR needed — the app requires authentication). The `AppShell` wrapper handles auth guard and layout.

### 2.2 File Structure

```
frontend/src/
├── app/
│   ├── layout.tsx                  # Root: AuthProvider + Toaster
│   ├── page.tsx                    # Redirect → /dashboard
│   ├── login/page.tsx
│   ├── dashboard/page.tsx
│   ├── customers/page.tsx
│   ├── products/page.tsx
│   ├── suppliers/page.tsx
│   ├── invoices/
│   │   ├── page.tsx                # Invoice list with cancel action
│   │   ├── new/page.tsx            # Invoice create form
│   │   └── [id]/page.tsx           # Invoice detail view
│   ├── repairs/
│   │   ├── page.tsx                # Repair list with status update
│   │   ├── new/page.tsx            # Repair create form
│   │   └── [id]/page.tsx           # Repair detail view
│   ├── payments/page.tsx
│   ├── reports/page.tsx
│   ├── settings/page.tsx
│   ├── import-export/page.tsx
│   ├── search/page.tsx
│   └── users/page.tsx
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             # Dark sidebar, role-filtered nav, active states
│   │   └── AppShell.tsx            # Auth guard + layout wrapper
│   ├── tables/
│   │   └── DataTable.tsx           # Generic typed table with built-in pagination
│   └── ui/
│       ├── components.tsx          # Modal, ConfirmDialog, StatCard, Badge, Input,
│       │                           # Select, Textarea, Pagination, TableSkeleton,
│       │                           # EmptyState, PageHeader, FormField, Spinner, StatusBadge
│       └── index.tsx               # Re-exports all UI components
├── hooks/
│   └── useAuth.tsx                 # AuthContext, AuthProvider, useAuth hook
└── lib/
    ├── api.ts                      # Axios instance, JWT interceptor, 401 redirect
    └── utils.ts                    # formatCurrency, formatDate, cn, STATUS_COLORS, getErrorMessage
```

### 2.3 State Management

- **Server state:** SWR with automatic revalidation (60s interval on dashboard)
- **Auth state:** React Context (`AuthProvider`) — re-fetches `/auth/me` on mount to ensure fresh role
- **Form state:** Local `useState`
- **Toast notifications:** `react-hot-toast`

### 2.4 API Communication

`src/lib/api.ts` creates an Axios instance with:
- `baseURL: NEXT_PUBLIC_API_URL + '/api'`
- 30s timeout
- Request interceptor: attaches `Authorization: Bearer <token>` from localStorage
- Response interceptor: on 401, clears storage and redirects to `/login`

---

## 3. Database Design

### 3.1 Schema Summary

13 models organised across three functional domains:

**Identity:** `User`  
**CRM:** `Customer`, `Supplier`  
**Inventory:** `Product`, `StockMovement`  
**Commerce:** `Invoice`, `InvoiceItem`, `RepairJob`, `RepairPart`, `Payment`  
**System:** `Setting`, `AuditLog`

### 3.2 Key Design Decisions

| Decision | Rationale |
|---|---|
| `Decimal(12,2)` for money | Avoids float precision errors on financial figures |
| `stockQty` on Product, not aggregated | Performance — no recalculating from movements |
| `StockMovement` as ledger | Full audit trail; movements never deleted |
| `InvoiceItem.productId` nullable | Supports custom (non-product) line items |
| `RepairPart` separate table | Flexible multi-part tracking with per-part cost |
| `Setting` as key-value | Runtime-configurable without schema migration |
| `AuditLog` table | Foundation for full action audit trail |

### 3.3 All Indexes

Every foreign key column is indexed. Additional compound indexes:
- `Customer`: `phone`, `name`
- `Product`: `sku` (unique), `barcode` (unique), `name`, `category`
- `Invoice`: `customerId`, `status`, `createdAt`, `number` (unique)
- `RepairJob`: `customerId`, `status`, `jobId` (unique), `createdAt`
- `Payment`: `invoiceId`, `createdAt`
- `StockMovement`: `productId`, `createdAt`

---

## 4. Infrastructure

### 4.1 Docker Containers

| Container | Image | Port | Purpose |
|---|---|---|---|
| `db` | postgres:16-alpine | 5432 (internal) | PostgreSQL database |
| `backend` | Custom (Node 20 alpine, multi-stage) | 5000 (internal) | Express API |
| `frontend` | Custom (Node 20 alpine, standalone) | 3000 (internal) | Next.js app |
| `nginx` | nginx:1.25-alpine | 80 (host) | Reverse proxy |

### 4.2 NGINX Configuration

- `location /api/` → proxy to backend:5000
- `location /uploads/` → proxy to backend:5000 (static files)
- `location /` → proxy to frontend:3000
- Rate limits: API 20 req/s, auth 5 req/min (per zone)
- Gzip enabled for JS, CSS, JSON
- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`

### 4.3 Volumes

- `postgres_data` — persistent database storage
- `uploads_data` — uploaded files (product images, logos, PDFs) shared between backend and nginx

### 4.4 Health Checks

- `db`: `pg_isready` every 10s
- `backend`: `GET /health` every 30s
- `frontend`: `GET /api/health` (Next.js default) every 30s

---

## 5. Environment Variables

### Root `.env`

| Variable | Example | Description |
|---|---|---|
| `NODE_ENV` | `production` | Environment |
| `POSTGRES_DB` | `phoneix` | Database name |
| `POSTGRES_USER` | `phoneix` | Database user |
| `POSTGRES_PASSWORD` | `s3cur3pass` | Database password (**set a strong value**) |
| `JWT_SECRET` | `64-char-random` | JWT signing secret (**generate with `openssl rand -hex 32`**) |
| `JWT_EXPIRES_IN` | `8h` | JWT expiry |
| `FRONTEND_URL` | `https://yourdomain.com` | Allowed CORS origin |
| `NEXT_PUBLIC_API_URL` | `https://yourdomain.com` | API base URL for frontend |

### Backend-only (in `backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | Prisma connection string |
| `PORT` | `5000` | Backend port |
| `UPLOAD_DIR` | `./uploads` | File upload directory |
| `MAX_FILE_SIZE` | `5242880` | Max upload size (bytes) |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX` | `200` | Max requests per window |
