# Phoneix Business Suite — Setup & Deployment Guide

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| Docker | ≥ 24 |
| Docker Compose | ≥ 2 |
| PostgreSQL (local dev) | ≥ 15 |
| Git | any |

---

## Quick Start (Docker — Recommended)

```bash
# 1. Clone
git clone <your-repo-url> phoneix
cd phoneix

# 2. Configure environment
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD and JWT_SECRET

# 3. Launch
docker-compose up -d

# 4. Run migrations + seed
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run prisma:seed

# 5. Open
# Frontend:  http://localhost:3000
# Backend:   http://localhost:5000
# Via NGINX: http://localhost:80
```

**Default login:** `admin@phoneix.com` / `Admin@1234`

---

## Local Development Setup

### Backend

```bash
cd backend

# Install
npm install

# Configure
cp .env.example .env
# Fill in: DATABASE_URL, JWT_SECRET

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed database
npm run prisma:seed

# Start dev server (hot reload)
npm run dev
# → http://localhost:5000
```

### Frontend

```bash
cd frontend

# Install
npm install

# Configure
echo "NEXT_PUBLIC_API_URL=http://localhost:5000" > .env.local

# Start dev server
npm run dev
# → http://localhost:3000
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | Secret for signing JWTs (min 32 chars) |
| `JWT_EXPIRES_IN` | | `8h` | JWT token expiry |
| `PORT` | | `5000` | API server port |
| `NODE_ENV` | | `development` | Environment |
| `UPLOAD_DIR` | | `./uploads` | Upload directory path |
| `MAX_FILE_SIZE` | | `5242880` | Max upload size in bytes (5MB) |
| `FRONTEND_URL` | | `http://localhost:3000` | CORS allowed origin |
| `RATE_LIMIT_WINDOW_MS` | | `900000` | Rate limit window (15min) |
| `RATE_LIMIT_MAX` | | `100` | Max requests per window |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API base URL |

---

## Running Tests

```bash
cd backend

# Run all tests
npm test

# With coverage report
npm run test:coverage

# Watch mode (dev)
npx jest --watch
```

Test database requires a separate PostgreSQL DB. Set `DATABASE_URL` to a test DB before running.

---

## Role Permissions

| Feature | ADMIN | MANAGER | STAFF |
|---------|-------|---------|-------|
| Dashboard | ✅ | ✅ | ✅ |
| Customers | ✅ | ✅ | ✅ |
| Invoices | ✅ | ✅ | ✅ |
| Repairs | ✅ | ✅ | ✅ |
| Search | ✅ | ✅ | ✅ |
| Inventory | ✅ | ✅ | ❌ |
| Suppliers | ✅ | ✅ | ❌ |
| Payments | ✅ | ✅ | ❌ |
| Reports | ✅ | ✅ | ❌ |
| Import/Export | ✅ | ✅ | ❌ |
| Settings | ✅ | ❌ | ❌ |
| Delete records | ✅ | ❌ | ❌ |

---

## API Reference

### Base URL
```
http://localhost:5000/api
```

### Authentication
All routes (except `/api/auth/login`) require:
```
Authorization: Bearer <jwt_token>
```

### Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | Login |
| `GET` | `/auth/me` | Current user |
| `GET` | `/customers` | List customers (paginated) |
| `POST` | `/customers` | Create customer |
| `GET` | `/customers/:id/history` | Purchase + repair history |
| `GET` | `/suppliers` | List suppliers |
| `POST` | `/suppliers` | Create supplier |
| `GET` | `/products` | List products |
| `GET` | `/products/low-stock` | Low stock alerts |
| `POST` | `/products/:id/adjust-stock` | Manual stock adjustment |
| `GET` | `/invoices` | List invoices |
| `POST` | `/invoices` | Create invoice (auto-reduces stock) |
| `POST` | `/invoices/:id/cancel` | Cancel invoice (restores stock) |
| `POST` | `/payments` | Record payment |
| `POST` | `/payments/refund` | Refund payment |
| `GET` | `/repairs` | List repair jobs |
| `POST` | `/repairs` | Create repair job |
| `PUT` | `/repairs/:id` | Update repair status |
| `GET` | `/reports/sales` | Sales report |
| `GET` | `/reports/inventory` | Inventory report |
| `GET` | `/reports/repairs` | Repair report |
| `GET` | `/reports/financial` | Financial report |
| `GET` | `/dashboard` | Dashboard widgets |
| `GET` | `/settings` | Get all settings |
| `PUT` | `/settings` | Update settings (ADMIN) |
| `GET` | `/search?q=` | Global search |
| `POST` | `/upload/logo` | Upload business logo |
| `POST` | `/upload/product-image/:id` | Upload product image |
| `POST` | `/import-export/products/import` | Import products (CSV/XLSX) |
| `GET` | `/import-export/products/export` | Export products (XLSX) |
| `GET` | `/import-export/reports/sales/export` | Export sales (XLSX) |
| `POST` | `/import-export/prepare-send` | WhatsApp share link |

---

## Product Import Format

CSV/Excel columns (header row required):

```
sku | name | category | purchasePrice | sellingPrice | stockQty | minStockLevel
```

Example:
```csv
sku,name,category,purchasePrice,sellingPrice,stockQty,minStockLevel
IPHONE15-SCR,iPhone 15 Screen,Screens,2500,4200,10,3
SAM-BATT-S22,Samsung S22 Battery,Batteries,800,1500,15,5
```

---

## Production Deployment

### 1. Set secrets

```bash
cp .env.example .env
# Set strong values for:
# POSTGRES_PASSWORD
# JWT_SECRET (use: openssl rand -base64 64)
```

### 2. Deploy

```bash
docker-compose up -d --build
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run prisma:seed
```

### 3. SSL (Optional)

Place SSL certificates in `nginx/ssl/`:
- `nginx/ssl/cert.pem`
- `nginx/ssl/key.pem`

Then update `nginx/nginx.conf` to listen on port 443.

### 4. CI/CD (GitHub Actions)

Set these secrets in your GitHub repository:
- `DOCKER_USERNAME` — Docker Hub username
- `DOCKER_PASSWORD` — Docker Hub password/token
- `DEPLOY_HOST` — Production server IP
- `DEPLOY_USER` — SSH username
- `DEPLOY_KEY` — SSH private key

---

## Project Structure

```
phoneix/
├── backend/
│   ├── src/
│   │   ├── app.ts                    # Express app + middleware
│   │   ├── server.ts                 # Entry point
│   │   ├── config/
│   │   │   ├── database.ts           # Prisma singleton
│   │   │   └── seed.ts               # DB seeder
│   │   ├── modules/
│   │   │   ├── auth/                 # JWT auth
│   │   │   ├── customers/            # Customer CRUD
│   │   │   ├── suppliers/            # Supplier CRUD
│   │   │   ├── inventory/            # Products + stock
│   │   │   ├── invoices/             # Billing + stock deduction
│   │   │   ├── repairs/              # Repair job management
│   │   │   ├── payments/             # Payments + refunds
│   │   │   ├── reports/              # All report endpoints
│   │   │   ├── dashboard/            # Dashboard widgets
│   │   │   ├── settings/             # Business settings
│   │   │   ├── search/               # Global search
│   │   │   ├── upload/               # File uploads
│   │   │   ├── pdf/                  # PDF generation
│   │   │   └── import-export/        # CSV/Excel + WhatsApp
│   │   └── shared/
│   │       ├── middleware/           # Auth, RBAC, error, logger
│   │       ├── errors/               # AppError classes
│   │       └── utils/                # Pagination, logger
│   ├── prisma/
│   │   ├── schema.prisma             # DB schema
│   │   └── migrations/               # SQL migrations
│   └── tests/
│       ├── setup.ts                  # Test helpers
│       └── api/                      # API test suites
├── frontend/
│   └── src/
│       ├── app/                      # Next.js pages
│       │   ├── dashboard/
│       │   ├── customers/
│       │   ├── products/
│       │   ├── suppliers/
│       │   ├── invoices/
│       │   ├── repairs/
│       │   ├── payments/
│       │   ├── reports/
│       │   ├── settings/
│       │   ├── import-export/
│       │   ├── search/
│       │   └── login/
│       ├── components/
│       │   ├── layout/               # AppShell, Sidebar
│       │   ├── ui/                   # Shared UI components
│       │   └── tables/               # DataTable
│       ├── hooks/                    # useAuth
│       └── lib/                      # api.ts, utils.ts
├── nginx/
│   └── nginx.conf
├── .github/
│   └── workflows/
│       └── ci.yml
├── docker-compose.yml
├── docker-compose.dev.yml
└── SETUP.md
```

---

## Verification Report

| REQ ID | Feature | Status |
|--------|---------|--------|
| REQ-001 | Authentication (JWT + bcrypt) | ✅ COMPLETE |
| REQ-002 | Customer management | ✅ COMPLETE |
| REQ-003 | Supplier management | ✅ COMPLETE |
| REQ-004 | Inventory / Product tracking | ✅ COMPLETE |
| REQ-005 | Invoice / Billing system | ✅ COMPLETE |
| REQ-006 | Repair job management | ✅ COMPLETE |
| REQ-007 | Payment tracking | ✅ COMPLETE |
| REQ-008 | Reporting system | ✅ COMPLETE |
| REQ-009 | Dashboard analytics | ✅ COMPLETE |
| REQ-010 | Import / Export system | ✅ COMPLETE |
| REQ-011 | PDF generator (PDFKit) | ✅ COMPLETE |
| REQ-012 | File upload system (Multer) | ✅ COMPLETE |
| REQ-013 | Global search | ✅ COMPLETE |
| REQ-014 | Global settings | ✅ COMPLETE |
| REQ-015 | Role-based access control | ✅ COMPLETE |
| REQ-016 | Logging and monitoring | ✅ COMPLETE |
| REQ-017 | Infrastructure setup | ✅ COMPLETE |

**All 17 requirements: COMPLETED ✅**
