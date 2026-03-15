# Phoneix Business Suite — Admin Guide

> **Version 1.1.0** | For ADMIN users and System Administrators

---

## Table of Contents

1. [Admin Responsibilities](#admin-responsibilities)
2. [First-Time Setup Checklist](#first-time-setup-checklist)
3. [User Management](#user-management)
4. [System Settings](#system-settings)
5. [Data Management](#data-management)
6. [Security Management](#security-management)
7. [Backup & Recovery](#backup--recovery)
8. [Monitoring & Logs](#monitoring--logs)
9. [Troubleshooting](#troubleshooting)

---

## Admin Responsibilities

The **ADMIN** role has full system access. As an admin you are responsible for:

- Creating and managing user accounts
- Configuring business settings (name, tax, invoice prefix)
- Maintaining data integrity (deleting invalid records)
- Monitoring system health
- Running backups
- Managing deployments and updates

---

## First-Time Setup Checklist

After deploying Phoneix Business Suite, complete the following before handing the system to your team:

- [ ] **Change the default admin password** — navigate to Settings → Change Password
- [ ] **Configure business information** — name, address, phone, email, GST
- [ ] **Set invoice prefix** — e.g., `INV`, `PBS-2025`
- [ ] **Set default tax rate** — e.g., `18` for 18% GST
- [ ] **Set currency symbol** — e.g., `₹` for Indian Rupee
- [ ] **Upload business logo** — used on PDF invoices
- [ ] **Create staff accounts** — see User Management below
- [ ] **Import initial product catalogue** — use Import/Export → Import Products
- [ ] **Test invoice creation** — create a test invoice and verify the PDF

---

## User Management

Navigate to **Users** from the Admin sidebar menu.

### Creating a User

1. Click **New User**
2. Fill in:
   - **Name** — full display name
   - **Email** — unique, used as login
   - **Password** — minimum 8 characters, must include uppercase, lowercase, and a number
   - **Role** — STAFF, MANAGER, or ADMIN
3. Click **Create**

Share the credentials with the user and instruct them to change their password on first login.

### Roles Overview

| Role | Intended For |
|------|-------------|
| **STAFF** | Front-desk / counter staff. Can create customers, invoices, and repairs. Cannot manage finances. |
| **MANAGER** | Senior staff / floor managers. Full operational access including payments, suppliers, and reports. Cannot change settings or manage users. |
| **ADMIN** | Business owner / system administrator. Full access to everything. |

### Deleting a User

1. Click the **trash icon** next to a user
2. Confirm deletion

> ⚠️ You cannot delete your own account. To remove the last admin, first create another admin account.

> ⚠️ Deleting a user does not delete their associated data (audit logs, assigned repairs). Historical data is preserved.

### Password Reset

There is no self-serve password reset link. To reset a user's password:

1. As ADMIN, you cannot reset other users' passwords from the UI
2. **Method 1 (UI):** Delete the user and recreate them (data is preserved via foreign keys, but audit logs will reference the old user ID)
3. **Method 2 (Direct DB):** Run the seed-style command:

```bash
docker compose exec backend npx ts-node -e "
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
bcrypt.hash('NewPassword123', 12).then(hash => 
  prisma.user.update({ where: { email: 'user@example.com' }, data: { password: hash } })
    .then(() => { console.log('Done'); prisma.\$disconnect(); })
);"
```

---

## System Settings

Navigate to **Settings** to configure the system. Only ADMIN users can save changes.

### Allowed Setting Keys

| Key | Description | Example |
|-----|-------------|---------|
| `business_name` | Shown on PDFs and UI | `Phoneix Repairs` |
| `business_address` | Printed on invoices | `123 Main St, Mumbai` |
| `business_phone` | On PDF footer | `+91 9876543210` |
| `business_email` | On PDF footer | `info@shop.com` |
| `gst_number` | Tax registration | `27AABCU9603R1ZX` |
| `invoice_prefix` | Prefix for invoice numbers | `INV` (alphanumeric only) |
| `default_tax` | Default tax % per line | `18` |
| `currency` | ISO currency code | `INR` |
| `currency_symbol` | Display symbol | `₹` |
| `receipt_footer` | PDF footer text | `Thank you for your business!` |
| `timezone` | For display purposes | `Asia/Kolkata` |
| `logo_url` | Auto-set on logo upload | (managed automatically) |

> ⚠️ Only the above keys are accepted. Any other keys submitted to the API are rejected.

---

## Data Management

### Bulk Product Import

Use the Import/Export feature to load large product catalogues. See the User Guide for format details.

Best practices:
- Always **export first** before importing to have a backup
- Use SKU as the unique identifier — existing SKUs are updated, not duplicated
- Run imports during off-peak hours on large catalogues (1000+ items)

### Data Retention

The system does not automatically archive or delete old records. All historical data is preserved indefinitely.

For compliance or storage management, consult your DBA to archive old `AuditLog` and `StockMovement` records periodically.

### Cancelling Records Safely

- **Cancel invoices** instead of deleting them — stock is restored and the audit trail is preserved
- **Do not delete products** that have been sold — this will cause foreign key errors
- **Delete repair jobs** only in `RECEIVED` or `DIAGNOSING` status — the system blocks deletion of in-progress jobs

---

## Security Management

### JWT Tokens

Tokens expire after 8 hours by default (configurable via `JWT_EXPIRES_IN`). Users are automatically logged out when their token expires.

### Login Rate Limiting

The system applies strict rate limiting on login attempts:
- **10 attempts per IP address per 15 minutes**
- Only failed attempts are counted
- After 10 failures, the IP is blocked for 15 minutes

If a legitimate user is blocked, they must wait 15 minutes. To bypass in emergency, restart the backend container (rate limit state is in-memory):

```bash
docker compose restart backend
```

### API Rate Limits

General API endpoints: **200 requests per IP per 15 minutes**.

### Uploaded File Security

- Only JPEG, PNG, WebP images are accepted
- Maximum file size: 5 MB
- Files are stored in `/uploads` with randomized filenames
- No executable files can be uploaded

### Regular Security Tasks

- [ ] Change default admin password immediately after deployment
- [ ] Rotate `JWT_SECRET` quarterly (requires all users to re-login)
- [ ] Review audit logs monthly for unusual activity
- [ ] Keep the server OS and Docker updated
- [ ] Ensure HTTPS is configured on the nginx proxy in production

---

## Backup & Recovery

### Automated Backup Script

A backup script is included at `scripts/backup.sh`.

```bash
# Run a manual backup
./scripts/backup.sh

# Set up automated daily backup (add to crontab)
0 2 * * * /opt/phoneix/scripts/backup.sh >> /var/log/phoneix-backup.log 2>&1
```

The script:
1. Creates a PostgreSQL dump via `pg_dump`
2. Compresses it to a `.tar.gz` archive
3. Stores it in `./backups/` with a timestamp
4. Deletes backups older than 30 days

### Manual Database Backup

```bash
# Full database dump
docker compose exec postgres pg_dump -U phoneix phoneix_db > backup-$(date +%Y%m%d).sql

# Compress it
gzip backup-$(date +%Y%m%d).sql
```

### Restoring from Backup

```bash
# Stop backend to prevent writes during restore
docker compose stop backend

# Restore
gunzip -c backup-20250115.sql.gz | docker compose exec -T postgres psql -U phoneix phoneix_db

# Restart
docker compose start backend
```

### Backup Checklist

- [ ] Database dump (PostgreSQL)
- [ ] Uploaded files (`/uploads` directory — product images, logos, PDFs)
- [ ] `.env` file (contains secrets — store separately and securely)

---

## Monitoring & Logs

### Health Check Endpoint

```
GET /health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": 86400,
  "environment": "production"
}
```

Use this in your monitoring tool (e.g., UptimeRobot, Nagios, Grafana).

### Application Logs

Logs are written by Winston to `stdout` in JSON format in production, making them compatible with log aggregation tools (ELK, Datadog, CloudWatch).

```bash
# View live logs
docker compose logs -f backend

# View last 100 lines
docker compose logs --tail=100 backend

# Save logs to file
docker compose logs backend > phoneix-backend-$(date +%Y%m%d).log
```

### Log Levels

| Level | When Used |
|-------|-----------|
| `info` | Normal operations (requests, startup, DB connect) |
| `warn` | Client errors (4xx responses) |
| `error` | Server errors (5xx responses, unhandled exceptions) |

### What Is Logged

- Every HTTP request: method, path, status code, duration, IP
- Request body (with sensitive fields like passwords **redacted**)
- Database connection events
- Unhandled errors with full stack traces
- Server startup and shutdown events

### Audit Logs (Database)

Every data-modifying action by a logged-in user is recorded in the `AuditLog` table:

```sql
SELECT al.action, u.name, al.metadata, al.created_at
FROM "AuditLog" al
JOIN "User" u ON al.user_id = u.id
ORDER BY al.created_at DESC
LIMIT 50;
```

---

## Troubleshooting

### Backend won't start

```bash
docker compose logs backend
```

Common causes:
- `DATABASE_URL` is incorrect → check `.env`
- Database not yet ready → `docker compose restart backend`
- `JWT_SECRET` not set → check `.env`

### "Too many requests" error

The rate limiter has been triggered. Options:
1. Wait 15 minutes
2. Restart the backend: `docker compose restart backend`
3. Increase `RATE_LIMIT_MAX` in `.env` (not recommended for production)

### PDF generation failing

- Check that the `uploads/pdfs` directory is writable
- Check backend logs for specific errors
- Invoices/repairs still work; PDFs are non-critical and fail silently

### Database migration errors

```bash
docker compose exec backend npx prisma migrate deploy
```

If this fails, check that `DATABASE_URL` in the backend container environment matches the running PostgreSQL instance.

### Import fails with "Row missing SKU"

Every row in the import file must have a `sku` column with a non-empty value. Other fields are optional.

### "Cannot delete: this record has related data"

You are trying to delete a record that has dependent records (e.g., deleting a customer who has invoices). Either:
- Delete or reassign the dependent records first
- Or cancel/void instead of deleting (preferred)

### Reset Everything (Development Only)

> ⚠️ DESTRUCTIVE — never run on production

```bash
docker compose exec backend npx prisma migrate reset --force
docker compose exec backend npm run prisma:seed
```
