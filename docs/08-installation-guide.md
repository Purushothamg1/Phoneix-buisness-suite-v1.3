# Phoneix Business Suite — Installation Guide

> **Version 1.1.0**

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Docker — Recommended)](#quick-start-docker--recommended)
3. [Manual Installation (Development)](#manual-installation-development)
4. [Environment Variables Reference](#environment-variables-reference)
5. [Database Setup](#database-setup)
6. [Verifying the Installation](#verifying-the-installation)
7. [Running Tests](#running-tests)

---

## Prerequisites

### For Docker Deployment (Recommended)

| Tool | Minimum Version | Check |
|------|----------------|-------|
| Docker | 24.x | `docker --version` |
| Docker Compose | 2.x (plugin) | `docker compose version` |
| 2 GB RAM available | — | — |
| Ports 80, 5432, 3000, 5000 free | — | — |

### For Manual Development Setup

| Tool | Minimum Version | Check |
|------|----------------|-------|
| Node.js | 18.x LTS | `node --version` |
| npm | 9.x | `npm --version` |
| PostgreSQL | 15.x | `psql --version` |
| Git | 2.x | `git --version` |

---

## Quick Start (Docker — Recommended)

This is the fastest way to get the system running. Everything runs in containers.

### Step 1 — Clone & Configure

```bash
# Clone the repository
git clone https://github.com/your-org/phoneix-business-suite.git
cd phoneix-business-suite

# Create your environment file from the template
cp .env.example .env
```

Open `.env` and set the required values:

```bash
# Minimum required changes:
POSTGRES_PASSWORD=your_secure_db_password_here
JWT_SECRET=your_very_long_random_secret_here_minimum_32_chars
FRONTEND_URL=http://localhost:3000
```

Generate a strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Step 2 — Start All Services

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** on port 5432
- **Backend API** on port 5000
- **Frontend** on port 3000
- **NGINX proxy** on port 80

Wait approximately 30 seconds for all services to become healthy:

```bash
# Monitor startup
docker compose ps
docker compose logs -f
```

All services should show `healthy` or `running`.

### Step 3 — Initialize the Database

```bash
# Run database migrations
docker compose exec backend npx prisma migrate deploy

# Seed default admin user and settings
docker compose exec backend npm run prisma:seed
```

### Step 4 — Access the Application

Open your browser and navigate to:

```
http://localhost
```

Login with the default credentials:
- **Email:** `admin@phoneix.com`
- **Password:** `Admin@1234`

> 🔐 **Change the default password immediately** before using in production.

---

## Manual Installation (Development)

Use this approach for local development with hot reload and debugging.

### Step 1 — Database Setup

Install PostgreSQL and create a database:

```bash
# macOS (with Homebrew)
brew install postgresql@16
brew services start postgresql@16

# Ubuntu/Debian
sudo apt install postgresql-16
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE USER phoneix WITH PASSWORD 'phoneix_dev_password';
CREATE DATABASE phoneix_db OWNER phoneix;
GRANT ALL PRIVILEGES ON DATABASE phoneix_db TO phoneix;
EOF
```

### Step 2 — Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

Edit `backend/.env`:
```env
DATABASE_URL=postgresql://phoneix:phoneix_dev_password@localhost:5432/phoneix_db
JWT_SECRET=dev_secret_change_in_production_minimum_32_chars
JWT_EXPIRES_IN=8h
PORT=5000
NODE_ENV=development
UPLOAD_DIR=./uploads
FRONTEND_URL=http://localhost:3000
```

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed the database
npm run prisma:seed

# Start development server (hot reload)
npm run dev
```

Backend will be available at `http://localhost:5000`

### Step 3 — Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

Edit `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

```bash
# Start development server
npm run dev
```

Frontend will be available at `http://localhost:3000`

### Step 4 — Development with Docker Compose

Alternatively, use the dev compose file which mounts source code for hot reload:

```bash
docker compose -f docker-compose.dev.yml up -d
```

---

## Environment Variables Reference

### Root `.env` (Docker Compose)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_DB` | Yes | `phoneix_db` | PostgreSQL database name |
| `POSTGRES_USER` | Yes | `phoneix` | PostgreSQL username |
| `POSTGRES_PASSWORD` | **Yes** | — | PostgreSQL password (set a strong value) |
| `JWT_SECRET` | **Yes** | — | JWT signing secret (min 32 chars) |
| `JWT_EXPIRES_IN` | No | `8h` | Token lifetime |
| `FRONTEND_URL` | Yes | `http://localhost:3000` | Allowed CORS origin |
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:5000` | API base URL for frontend |
| `NODE_ENV` | No | `production` | Environment mode |

### Backend `.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | Full PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Must match root `.env` |
| `JWT_EXPIRES_IN` | No | `8h` | JWT expiry |
| `PORT` | No | `5000` | Backend port |
| `UPLOAD_DIR` | No | `./uploads` | Directory for uploaded files |
| `MAX_FILE_SIZE` | No | `5242880` | Max upload size in bytes (5 MB) |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX` | No | `200` | Max requests per window |

### Frontend `.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL (must be reachable from browser) |

---

## Database Setup

### Initial Migration

Creates all tables, indexes, and foreign keys:

```bash
npx prisma migrate deploy
```

### Seeding

Seeds the default admin user and system settings:

```bash
npm run prisma:seed
```

**Default credentials created by seed:**
- Email: `admin@phoneix.com`
- Password: `Admin@1234`

**Default settings created by seed:**

| Key | Value |
|-----|-------|
| `business_name` | `Phoneix Business Suite` |
| `invoice_prefix` | `INV` |
| `default_tax` | `18` |
| `currency` | `INR` |
| `currency_symbol` | `₹` |

### Viewing the Schema

```bash
# Open Prisma Studio (visual DB browser)
npx prisma studio
```

### Resetting (Development Only)

> ⚠️ **Destroys all data**

```bash
npx prisma migrate reset --force
npm run prisma:seed
```

---

## Verifying the Installation

### Health Check

```bash
curl http://localhost:5000/health
# Expected: {"status":"ok","timestamp":"...","uptime":...,"environment":"..."}
```

### API Login Test

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@phoneix.com","password":"Admin@1234"}'
# Expected: {"token":"eyJ...","user":{"id":"...","email":"admin@phoneix.com",...}}
```

### Docker Service Status

```bash
docker compose ps
# All services should show: Up (healthy)
```

---

## Running Tests

Tests require a separate test database. Configure it in `backend/.env.test`:

```env
DATABASE_URL=postgresql://phoneix:phoneix_dev_password@localhost:5432/phoneix_test
JWT_SECRET=test_secret_minimum_32_chars_here
NODE_ENV=test
```

```bash
cd backend

# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific test file
npx jest tests/api/invoices.test.ts

# Run only integration tests
npx jest tests/integration/
```

### Test Database Setup

The test setup file (`tests/setup.ts`) automatically:
1. Connects to the test database
2. Cleans all tables before each test suite
3. Creates test fixtures as needed

> ℹ️ Tests use the same database schema as production, applied via `prisma migrate deploy`.

### CI/CD

Tests run automatically on every push via GitHub Actions (`.github/workflows/ci.yml`).

Required GitHub Secrets:
- `DEPLOY_HOST` — production server IP
- `DEPLOY_USER` — SSH username
- `DEPLOY_SSH_KEY` — private SSH key
- `NEXT_PUBLIC_API_URL` — for frontend build
