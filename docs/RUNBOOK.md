# Phoenix Business Suite — Operations Runbook

## Quick Reference

| Action | Command |
|--------|---------|
| Start backend (dev) | `cd backend && npm run dev` |
| Start frontend (dev) | `cd frontend && npm run dev` |
| Run migrations | `cd backend && npx prisma migrate deploy` |
| Seed data | `cd backend && npm run prisma:seed` |
| Build backend | `cd backend && npm run build` |
| Build frontend | `cd frontend && npm run build` |
| Health check | `curl http://localhost:5000/health` |
| DB check | `curl http://localhost:5000/ready` |

## First-Time Setup (Local)

```bash
git clone https://github.com/yourname/phoenix-business-suite.git
cd phoenix-business-suite

# Backend
cd backend
cp .env.example .env
# Edit .env — fill in DATABASE_URL and JWT_SECRET
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev       # starts on :5000

# Frontend (new terminal)
cd ../frontend
cp .env.example .env
# Edit .env — set NEXT_PUBLIC_API_URL=http://localhost:5000
npm install
npm run dev       # starts on :3000
```

## Adding a New Migration

```bash
cd backend
# Edit prisma/schema.prisma
npx prisma migrate dev --name "describe_your_change"
# Commit the new migration file in prisma/migrations/
```

## Applying Migrations in Production

```bash
# Render: runs automatically in start command
# Manual: in Render Shell
cd backend && npx prisma migrate deploy
```

## Changing the Admin Password

Login at /settings → Change password, OR:
```bash
# Via API
curl -X POST https://your-api.com/api/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"Admin@1234","newPassword":"YourNewSecure@Password1"}'
```

## Rotating JWT Secret

1. Generate new secret: `openssl rand -hex 64`
2. Update `JWT_SECRET` in Render env vars
3. Render redeploys automatically
4. All existing sessions are invalidated — users must re-login

## Viewing Logs

```bash
# Render: Dashboard → Service → Logs tab
# Local: logs/ directory
tail -f backend/logs/combined.log
tail -f backend/logs/error.log
```

## Adding New Settings Key

1. Add key to `ALLOWED_KEYS` set in `backend/src/modules/settings/settings.routes.ts`
2. Add Joi validator to `settingsUpdateSchema`
3. Add to seed: `backend/src/config/seed.ts`
4. Add UI field in `frontend/src/app/settings/page.tsx`
5. Create and run migration if storing in DB column (currently all in Setting table)

## Hotfix Process

```bash
git checkout main
git pull
git checkout -b hotfix/describe-fix
# Make minimal targeted change
git commit -m "fix: describe the fix"
git push origin hotfix/describe-fix
# Create PR → merge → Render/Vercel auto-deploys
```

## PDF Generation Troubleshooting

```bash
# Check UPLOAD_DIR is writable
ls -la $UPLOAD_DIR/pdfs/

# Test PDF generation directly
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/invoices/INVOICE_ID/pdf/download \
  -o test.pdf && echo "PDF OK" || echo "PDF FAILED"

# Regenerate a specific PDF
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/invoices/INVOICE_ID/regenerate-pdf
```

## Database Connection Issues

```bash
# Test DB connectivity
cd backend && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$connect().then(() => { console.log('DB OK'); p.\$disconnect(); }).catch(e => console.error(e));
"

# Check connection string format
# PostgreSQL: postgresql://user:pass@host:5432/dbname
# Supabase with pgBouncer: postgresql://...@host:6543/dbname?pgbouncer=true
```
