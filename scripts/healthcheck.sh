#!/bin/bash
# ============================================================
# Phoneix Business Suite — Smoke Test Script
# Verifies the deployment is working correctly
# Usage: ./scripts/healthcheck.sh [base-url]
# ============================================================

BASE_URL="${1:-http://localhost}"
API="$BASE_URL/api"
PASS=0
FAIL=0
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

check() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"
  local actual_status

  actual_status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
  
  if [ "$actual_status" = "$expected_status" ]; then
    echo -e "${GREEN}✓${NC} $name (HTTP $actual_status)"
    PASS=$((PASS+1))
  else
    echo -e "${RED}✗${NC} $name (expected $expected_status, got $actual_status)"
    FAIL=$((FAIL+1))
  fi
}

echo "========================================="
echo " Phoneix Smoke Test — $BASE_URL"
echo "========================================="
echo ""

# Infrastructure
check "NGINX health"              "$BASE_URL"                200
check "API health endpoint"       "$API/health"              200
check "API 404 handler"           "$API/nonexistent-route"   404

# Auth
check "Login (no body = 400)"     "$API/auth/login"          400
check "Protected route (no auth)" "$API/customers"           401
check "Protected route (no auth)" "$API/products"            401
check "Protected route (no auth)" "$API/dashboard"           401

echo ""
echo "========================================="
echo " Results: $PASS passed, $FAIL failed"
echo "========================================="

if [ $FAIL -gt 0 ]; then
  exit 1
fi
