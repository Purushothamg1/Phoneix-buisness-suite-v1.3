# Phoneix Business Suite — Deployment Guide

> **Version 1.1.0** | Production Deployment

---

## Table of Contents

1. [Server Requirements](#server-requirements)
2. [Production Deployment (Docker)](#production-deployment-docker)
3. [HTTPS / SSL Configuration](#https--ssl-configuration)
4. [Environment Hardening](#environment-hardening)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Scaling Considerations](#scaling-considerations)
7. [Updates & Rollback](#updates--rollback)
8. [Monitoring](#monitoring)

---

## Server Requirements

### Minimum (single shop, < 5 concurrent users)

| Resource | Minimum |
|----------|---------|
| CPU | 1 vCPU |
| RAM | 2 GB |
| Storage | 20 GB SSD |
| OS | Ubuntu 22.04 LTS |
| Docker | 24.x |

### Recommended (active shop, 5–20 concurrent users)

| Resource | Recommended |
|----------|-------------|
| CPU | 2 vCPU |
| RAM | 4 GB |
| Storage | 50 GB SSD |

### Cloud Suggestions

- **DigitalOcean Droplet** — $12/mo (2 vCPU, 2 GB) is sufficient for most shops
- **Hetzner CX21** — excellent value
- **AWS t3.small** — reliable managed option

---

## Production Deployment (Docker)

### Step 1 — Prepare the Server

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
sudo apt install docker-compose-plugin -y
sudo mkdir -p /opt/phoneix && sudo chown $USER:$USER /opt/phoneix
cd /opt/phoneix
```

### Step 2 — Deploy Application

```bash
git clone https://github.com/your-org/phoneix-business-suite.git .
cp .env.example .env
```

Edit `.env` — minimum required changes:

```env
NODE_ENV=production
POSTGRES_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -hex 48)
FRONTEND_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com
```

### Step 3 — Start the Stack

```bash
docker compose up -d
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run prisma:seed
```

### Step 4 — Verify

```bash
curl http://localhost/health
# → {"status":"ok","uptime":...}
```

Open browser: `https://yourdomain.com`  
Login: `admin@phoneix.com` / `Admin@1234` — **change immediately.**

---

## HTTPS / SSL Configuration

### Option A — Let's Encrypt (Free)

```bash
sudo apt install certbot -y
docker compose stop nginx

sudo certbot certonly --standalone -d yourdomain.com

mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem  nginx/ssl/key.pem
sudo chmod 644 nginx/ssl/cert.pem nginx/ssl/key.pem
```

Update `nginx/nginx.conf` to add HTTPS server block, then update `docker-compose.yml`:

```yaml
nginx:
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./nginx/ssl:/etc/nginx/ssl:ro
```

Auto-renew (monthly cron):

```bash
0 3 1 * * certbot renew --quiet && \
  cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/phoneix/nginx/ssl/cert.pem && \
  cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/phoneix/nginx/ssl/key.pem && \
  docker compose -f /opt/phoneix/docker-compose.yml restart nginx
```

### Option B — Cloudflare Proxy (Easiest)

1. Point DNS A record to server IP, enable orange cloud (proxied)
2. Set SSL/TLS to **Full (strict)** in Cloudflare dashboard
3. No local certificate management needed

---

## Environment Hardening

### Firewall

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw deny 5000/tcp  # Block direct backend access from internet
sudo ufw deny 5432/tcp  # Block direct DB access
sudo ufw enable
```

### SSH Hardening

```bash
# /etc/ssh/sshd_config
PasswordAuthentication no
PermitRootLogin no
```

### Verify DB Not Exposed

```bash
netstat -tlnp | grep 5432
# Should NOT show 0.0.0.0:5432
```

---

## CI/CD Pipeline

The included `.github/workflows/ci.yml` automates: **Test → Build → Push to GHCR → SSH Deploy**.

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `DEPLOY_HOST` | Server IP |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_SSH_KEY` | Private SSH key contents |
| `NEXT_PUBLIC_API_URL` | `https://yourdomain.com` |

### Manual Deploy

```bash
cd /opt/phoneix && ./scripts/deploy.sh
```

---

## Scaling Considerations

The default deployment handles:
- Up to 20 concurrent users
- Tens of thousands of records
- Product catalogues up to 10,000 items

**Vertical scaling** (bigger server) handles most growth.

For **horizontal scaling** (multiple backend instances):
- Rate limiter: swap in-memory store for Redis-backed store
- File uploads: move to S3 / Cloudflare R2
- Database: managed PostgreSQL with PgBouncer connection pooling

---

## Updates & Rollback

### Apply Update

```bash
cd /opt/phoneix
git pull origin main
docker compose up -d --build
docker compose exec backend npx prisma migrate deploy
```

### Zero-Downtime Update

```bash
docker compose up -d --no-deps --build backend
```

(nginx and DB remain running while backend restarts)

### Rollback

```bash
git checkout <previous-tag-or-commit>
docker compose up -d --build backend frontend
```

---

## Monitoring

### Health Endpoint

`GET /health` — returns `{"status":"ok"}`. Compatible with all uptime monitoring tools.

### Container Metrics

```bash
docker stats
docker compose logs -f backend
docker compose logs backend | grep '"level":"error"'
```

### Recommended Alerting

- Health endpoint down > 1 min → Critical
- Disk > 80% → Warning
- Memory > 90% → Critical
- Response time > 3s → Warning
