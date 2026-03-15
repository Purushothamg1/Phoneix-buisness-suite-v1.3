# Phoneix Business Suite — API Verification Guide

Quick reference for verifying all endpoints after deployment.

## Prerequisites
```bash
BASE=http://localhost
# Get token
TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@phoneix.com","password":"Admin@1234"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "Token: $TOKEN"
AUTH="Authorization: Bearer $TOKEN"
```

## Core Endpoints

```bash
# Health
curl $BASE/health

# Auth
curl -H "$AUTH" $BASE/api/auth/me

# Dashboard
curl -H "$AUTH" $BASE/api/dashboard

# Customers
curl -H "$AUTH" "$BASE/api/customers?page=1&limit=5"

# Products
curl -H "$AUTH" "$BASE/api/products?page=1&limit=5"
curl -H "$AUTH" $BASE/api/products/low-stock
curl -H "$AUTH" $BASE/api/products/categories

# Invoices
curl -H "$AUTH" "$BASE/api/invoices?page=1&limit=5"

# Repairs
curl -H "$AUTH" "$BASE/api/repairs?page=1&limit=5"

# Reports
curl -H "$AUTH" "$BASE/api/reports/sales?from=2024-01-01&to=2024-12-31"
curl -H "$AUTH" $BASE/api/reports/inventory
curl -H "$AUTH" $BASE/api/reports/financial
curl -H "$AUTH" $BASE/api/reports/repairs

# Search
curl -H "$AUTH" "$BASE/api/search?q=apple"

# Settings
curl -H "$AUTH" $BASE/api/settings
```

## Security Checks

```bash
# 1. Unauthenticated request should return 401
curl -s -o /dev/null -w "%{http_code}" $BASE/api/customers
# Expected: 401

# 2. Invalid token should return 401
curl -s -o /dev/null -w "%{http_code}" $BASE/api/customers \
  -H "Authorization: Bearer invalid.token.here"
# Expected: 401

# 3. STAFF role cannot access reports
STAFF_TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@phoneix.com","password":"Staff@1234"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
curl -s -o /dev/null -w "%{http_code}" $BASE/api/reports/sales \
  -H "Authorization: Bearer $STAFF_TOKEN"
# Expected: 403

# 4. Rate limit on login (run 11+ times quickly)
for i in {1..12}; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"x@x.com","password":"wrong"}')
  echo "Attempt $i: $CODE"
done
# Expected: first 10 → 401, then 429
```

## New Endpoints Added in v1.0.0

```bash
# Product categories
curl -H "$AUTH" $BASE/api/products/categories
# Expected: ["Screens", "Batteries", ...]

# Dashboard low-stock items array
curl -H "$AUTH" $BASE/api/dashboard | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('lowStockItems', []))"
# Expected: array of low-stock product objects

# Invoice date range filter
curl -H "$AUTH" "$BASE/api/invoices?from=2024-01-01&to=2024-01-31"

# Payment date range filter + method filter
curl -H "$AUTH" "$BASE/api/payments?method=CASH&from=2024-01-01"
```
