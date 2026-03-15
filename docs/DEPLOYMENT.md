# Phoenix Business Suite v1.4 — Production Deployment Guide

## Platform Choice

| Layer    | Platform  | Why                                                            |
|----------|-----------|----------------------------------------------------------------|
| Frontend | Vercel    | Best Next.js support, edge CDN, auto-deploys from GitHub, free tier |
| Backend  | Render    | Node.js native, persistent disk for uploads/PDFs, health checks, free tier |
| Database | Supabase  | Managed PostgreSQL, point-in-time recovery, connection pooling, pgBouncer |

---

## Prerequisites

- GitHub account (repo must be public OR you're on paid Vercel/Render)
- Vercel account: https://vercel.com/signup
- Render account: https://render.com/register
- Supabase account: https://supabase.com

---

## Step 1 — Set Up Database (Supabase)

1. Go to https://supabase.com → **New project**
2. Name: `phoenix-business-suite`, region: choose closest, set a strong DB password
3. Wait ~2 minutes for provisioning
4. Go to **Settings → Database → Connection String → URI**
5. Copy the `postgresql://...` URI — replace `[YOUR-PASSWORD]` with your DB password
6. Save this as `DATABASE_URL`

**Enable pgBouncer (recommended for production):**
- Settings → Database → Connection Pooling → Enable
- Copy the **Connection pooling** URI instead (port 6543)
- Add `?pgbouncer=true` to the end: `postgresql://...?pgbouncer=true`

**Supabase automatic backups:**
- Free tier: 1 day retention
- Pro tier ($25/mo): 7 days point-in-time recovery
- Manual backup: Project Settings → Database → Download backup

---

## Step 2 — Deploy Backend (Render)

### Option A — Using render.yaml (recommended)

1. Push your code to GitHub
2. Go to Render Dashboard → **New → Blueprint**
3. Connect your GitHub repo
4. Render detects `render.yaml` automatically
5. Set these env vars manually (Render can't auto-generate secrets):
   - `FRONTEND_URL` = `https://your-app.vercel.app` (set after Step 3)
   - `DATABASE_URL` = your Supabase connection string
6. Click **Apply**

### Option B — Manual Service Setup

1. Render Dashboard → **New → Web Service**
2. Connect your GitHub repo
3. Settings:
   - **Name:** `phoenix-api`
   - **Region:** Oregon (or closest)
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm ci && npx prisma generate && npm run build`
   - **Start Command:** `npx prisma migrate deploy && node dist/server.js`
   - **Plan:** Free (or Starter $7/mo for production)
4. Add a **Disk** (for PDF/image storage):
   - Name: `uploads`
   - Mount Path: `/opt/render/project/src/uploads`
   - Size: 1GB
5. Add environment variables (Environment tab):
   ```
   NODE_ENV=production
   PORT=5000
   DATABASE_URL=<supabase connection string>
   JWT_SECRET=<openssl rand -hex 64>
   JWT_EXPIRES_IN=8h
   FRONTEND_URL=https://your-app.vercel.app
   APP_URL=https://phoenix-api.onrender.com
   UPLOAD_DIR=/opt/render/project/src/uploads
   RATE_LIMIT_MAX=300
   ```
6. Click **Create Web Service**

### Database Migration (Render)

Migrations run automatically in the Start Command:
```
npx prisma migrate deploy && node dist/server.js
```

To run manually via Render Shell:
```bash
cd backend && npx prisma migrate deploy
```

### Seed Initial Data

In Render Shell (one time only):
```bash
cd backend && npm run prisma:seed
```

Default credentials created:
- Email: `admin@phoenix.com`
- Password: `Admin@1234`
- **CHANGE THIS IMMEDIATELY after first login**

---

## Step 3 — Deploy Frontend (Vercel)

1. Go to https://vercel.com → **Add New → Project**
2. Import your GitHub repository
3. Settings:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm ci`
4. Environment Variables:
   ```
   NEXT_PUBLIC_API_URL = https://phoenix-api.onrender.com
   ```
5. Click **Deploy**

### After Deploy

1. Copy your Vercel URL (e.g. `https://phoenix-suite.vercel.app`)
2. Go back to Render → your service → Environment
3. Update `FRONTEND_URL` to your Vercel URL
4. Render auto-redeploys

---

## Step 4 — Custom Domain (Optional)

### Vercel Custom Domain
1. Vercel Dashboard → Project → Settings → Domains
2. Add domain: `app.yourdomain.com`
3. Add CNAME record: `app.yourdomain.com → cname.vercel-dns.com`
4. Vercel auto-provisions SSL via Let's Encrypt

### Render Custom Domain
1. Render Dashboard → Service → Settings → Custom Domains
2. Add domain: `api.yourdomain.com`
3. Add CNAME: `api.yourdomain.com → your-service.onrender.com`
4. Render auto-provisions SSL

---

## Environment Variables Reference

### Backend (Render)
| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `NODE_ENV` | Yes | `production` | |
| `DATABASE_URL` | Yes | `postgresql://...` | Supabase connection string |
| `JWT_SECRET` | Yes | `<64 random chars>` | `openssl rand -hex 64` |
| `JWT_EXPIRES_IN` | No | `8h` | Token expiry |
| `FRONTEND_URL` | Yes | `https://app.vercel.app` | Comma-separated for multiple origins |
| `APP_URL` | Yes | `https://api.onrender.com` | Used in PDF QR codes |
| `UPLOAD_DIR` | Yes | `/opt/render/.../uploads` | Must be on persistent disk |
| `PORT` | No | `5000` | Render sets this automatically |
| `RATE_LIMIT_MAX` | No | `300` | Requests per 15 min per IP |
| `SENTRY_DSN` | No | `https://...@sentry.io/...` | Error monitoring |

### Frontend (Vercel)
| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `NEXT_PUBLIC_API_URL` | Yes | `https://api.onrender.com` | Backend URL, no trailing slash |
| `NEXT_PUBLIC_SENTRY_DSN` | No | `https://...@sentry.io/...` | Frontend error monitoring |

---

## One-Line Build Commands

```bash
# Reproduce backend build locally
cd backend && npm ci && npx prisma generate && npm run build

# Reproduce frontend build locally
cd frontend && npm ci && npm run build

# Run migrations
cd backend && npx prisma migrate deploy

# Seed data
cd backend && npm run prisma:seed

# Start backend production
cd backend && node dist/server.js

# Start frontend production
cd frontend && npm run start
```

---

## Health Check & Smoke Tests

```bash
# 1. Check backend health
curl https://your-api.onrender.com/health
# Expected: {"status":"ok","version":"1.4.0",...}

# 2. Check DB connectivity
curl https://your-api.onrender.com/ready
# Expected: {"status":"ready","db":"ok"}

# 3. Test login
curl -X POST https://your-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@phoenix.com","password":"Admin@1234"}'
# Expected: {"token":"...","user":{...}}

# 4. Check frontend
curl -I https://your-app.vercel.app
# Expected: HTTP/2 200

# 5. Test CORS (from browser or curl)
curl -H "Origin: https://your-app.vercel.app" \
     https://your-api.onrender.com/health
# Response headers must include: Access-Control-Allow-Origin: https://your-app.vercel.app
```

---

## Rollback Procedure

### Render (Backend)
1. Render Dashboard → Service → **Deploys** tab
2. Find the last working deploy
3. Click **•••** → **Rollback to this deploy**
4. Render redeploys immediately (< 2 minutes)

If the rollback requires a DB schema rollback:
```bash
# In Render Shell — revert last migration
cd backend && npx prisma migrate resolve --rolled-back <migration_name>
```

### Vercel (Frontend)
1. Vercel Dashboard → Project → **Deployments** tab
2. Find the last working deployment
3. Click **•••** → **Promote to Production**

---

## Database Backup & Restore

### Supabase Automatic Backups
- Free tier: daily backups, 1-day retention
- Pro tier: point-in-time recovery, 7-day retention
- Restore: Supabase Dashboard → Settings → Database → Restore

### Manual Backup (pg_dump)
```bash
# Backup
pg_dump "$DATABASE_URL" --no-owner --no-privileges -F c -f backup_$(date +%Y%m%d_%H%M).dump

# Restore to a new database
pg_restore --no-owner --no-privileges -d "$TARGET_DATABASE_URL" backup_20260315_1430.dump

# Plain SQL dump (human-readable)
pg_dump "$DATABASE_URL" --no-owner -f backup_$(date +%Y%m%d).sql
```

### Scheduled Backup Script
```bash
#!/bin/bash
# Add to cron: 0 3 * * * /path/to/backup.sh
pg_dump "$DATABASE_URL" --no-owner -F c \
  -f "/backups/phoenix_$(date +%Y%m%d_%H%M).dump"
# Keep last 30 days
find /backups -name "phoenix_*.dump" -mtime +30 -delete
```

---

## Troubleshooting

### Backend not starting
```bash
# Check logs in Render Dashboard → Service → Logs
# Common errors:
# [FATAL] Missing DATABASE_URL → add env var in Render
# [FATAL] JWT_SECRET too short → use openssl rand -hex 64
# PrismaClientInitializationError → check DATABASE_URL format
```

### PDF downloads not working
```bash
# Check UPLOAD_DIR is set to the persistent disk mount path
# Render free tier: no persistent disk — PDFs are ephemeral
# Fix: add a Disk in Render (see Step 2 above)

# Test PDF generation
curl -H "Authorization: Bearer $TOKEN" \
  https://your-api.onrender.com/api/invoices/INVOICE_ID/pdf/download \
  -o test.pdf
```

### CORS errors in browser
```bash
# Check FRONTEND_URL in backend env vars matches exactly
# Must include protocol: https://your-app.vercel.app
# No trailing slash
# For multiple origins, comma-separate: https://app.com,http://localhost:3000
```

### Login returns 429 (rate limited)
```bash
# Wait 15 minutes, or increase RATE_LIMIT_MAX env var
# If behind a proxy: trust proxy header must be set (done in app.ts)
```

### WhatsApp links not opening
```bash
# Ensure phone numbers include country code without +
# e.g., 919876543210 not +919876543210
# Check the prepare-send endpoint returns a valid whatsappUrl
```

---

## Post-Deploy Security Checklist

- [ ] Change default admin password (`Admin@1234`)
- [ ] Rotate `JWT_SECRET` (existing sessions will expire — users must re-login)
- [ ] Review `FRONTEND_URL` — must be exact origin, no wildcards
- [ ] Enable Supabase Row Level Security for extra DB protection
- [ ] Set up Sentry for error monitoring
- [ ] Review Render and Vercel access permissions
- [ ] Enable 2FA on Supabase, Render, and Vercel accounts
- [ ] Test PDF generation end-to-end
- [ ] Verify WhatsApp share flow works on mobile
- [ ] Set up database backup automation

---

## Monitoring

### Sentry Setup
1. Create account at https://sentry.io
2. New Project → Node.js (backend) + Next.js (frontend)
3. Copy DSN values
4. Add to Render env: `SENTRY_DSN=https://...`
5. Add to Vercel env: `NEXT_PUBLIC_SENTRY_DSN=https://...`

### Render Built-in Metrics
- CPU/Memory usage visible in Render Dashboard → Service → Metrics
- Set up alerts: Dashboard → Alerts

### Uptime Monitoring (free)
- https://uptimerobot.com → Monitor → HTTP(s)
- URL: `https://your-api.onrender.com/health`
- Alert on status change
