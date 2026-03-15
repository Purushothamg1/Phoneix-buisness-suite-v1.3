# Phoenix Business Suite v1.4.0

Production-grade, full-stack SaaS business management platform for service-based retail shops.

## Quick Start (Local Dev)

```bash
# 1. Clone and configure
cp .env.example .env          # root (optional)
cp backend/.env.example backend/.env      # fill DATABASE_URL + JWT_SECRET
cp frontend/.env.example frontend/.env   # fill NEXT_PUBLIC_API_URL

# 2. Backend
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev              # :5000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev              # :3000
```

Login: `admin@phoenix.com` / `Admin@1234` — **change immediately**

## Docker (Production)

```bash
cp .env.example .env     # fill JWT_SECRET, DATABASE_URL, FRONTEND_URL, APP_URL
docker compose up -d
docker compose exec backend npm run prisma:seed
```

## Deploy to Cloud (Render + Vercel + Supabase)

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the complete step-by-step guide.

**Summary:**
1. Create database on Supabase → copy connection string
2. Deploy backend on Render → paste `render.yaml` Blueprint
3. Deploy frontend on Vercel → set `NEXT_PUBLIC_API_URL`

## Project Structure

```
phoenix-business-suite/
├── backend/           Express + Prisma + TypeScript API
├── frontend/          Next.js 14 + Tailwind CSS
├── nginx/             Reverse proxy config
├── docs/              DEPLOYMENT.md, RUNBOOK.md, API docs
├── render.yaml        One-click Render deployment
├── docker-compose.yml Local/self-hosted production stack
└── .github/workflows/ CI: lint + type-check + test + build
```

## Environment Variables

| Variable | Where | Required | Description |
|----------|-------|----------|-------------|
| `DATABASE_URL` | Backend | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | Backend | ✅ | Min 32 chars (`openssl rand -hex 64`) |
| `FRONTEND_URL` | Backend | ✅ | CORS allowed origins (comma-separated) |
| `APP_URL` | Backend | ✅ | Backend public URL (for PDF QR codes) |
| `NEXT_PUBLIC_API_URL` | Frontend | ✅ | Backend URL from browser |
| `UPLOAD_DIR` | Backend | No | Path for PDFs/images (default: `./uploads`) |
| `SENTRY_DSN` | Backend | No | Error monitoring |

## What's in v1.4

- **Critical bug fixes:** localStorage key mismatch, PDF path inconsistency, dynamic imports, slow-down v2 API
- **Deployment ready:** `render.yaml`, `vercel.json`, full CI, `.env.example`, `Dockerfile`s
- **PDF overhaul:** absolute path resolution, logo loading from uploads, async generation (non-blocking), multi-page support, payment history section
- **Security:** `trust proxy`, JWT length validation, Sentry integration (optional)
- **All `downloadFile()` calls** are now `await`-ed with error handling and user-facing toast feedback

## Modules

Dashboard · Customers · Inventory · Suppliers · Invoices · Repairs · Payments · Reports · Import/Export · Users · Audit Log · Settings

## Roles

| Role | Access |
|------|--------|
| STAFF | Customers, Invoices, Repairs, Search |
| MANAGER | + Inventory, Suppliers, Payments, Reports, Import/Export |
| ADMIN | Full access + Users, Audit Log, Settings |
