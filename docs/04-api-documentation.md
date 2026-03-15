# Phoneix Business Suite — API Documentation

**Base URL:** `http://your-domain/api`  
**Authentication:** All endpoints except `POST /auth/login` require `Authorization: Bearer <token>`  
**Content-Type:** `application/json` for all requests  
**Rate Limit:** 200 requests / 15 min (general); 10 attempts / 15 min on login (skips successes)

---

## Authentication

### POST /auth/login
Authenticate and receive a JWT token.

**Request:**
```json
{ "email": "admin@phoneix.com", "password": "Admin@1234" }
```
**Response 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "uuid", "email": "admin@phoneix.com", "name": "System Admin", "role": "ADMIN" }
}
```
**Errors:** `400` validation | `401` invalid credentials | `429` rate limited

---

### GET /auth/me
Get the authenticated user's profile.

**Response 200:**
```json
{ "id": "uuid", "email": "admin@phoneix.com", "name": "System Admin", "role": "ADMIN", "createdAt": "2024-01-01T00:00:00.000Z" }
```

---

### POST /auth/change-password
**Request:**
```json
{ "currentPassword": "OldPass@1", "newPassword": "NewPass@2" }
```
**Response 200:** `{ "message": "Password changed successfully" }`  
**Errors:** `400` current password wrong | `400` same as current | `400` strength policy

---

## User Management (ADMIN only)

### GET /auth/users
List all users.
**Response 200:**
```json
[{ "id": "uuid", "name": "Staff User", "email": "staff@example.com", "role": "STAFF", "createdAt": "..." }]
```

### POST /auth/users
**Request:**
```json
{ "name": "Jane Smith", "email": "jane@example.com", "password": "Secure@123", "role": "MANAGER" }
```
**Response 201:** User object (no password)  
**Errors:** `409` email already exists

### DELETE /auth/users/:id
**Response 204** No Content  
**Errors:** `400` cannot delete own account | `404` user not found

---

## Customers

### GET /customers
**Query:** `page`, `limit`, `search`  
**Response 200:**
```json
{
  "data": [{ "id": "uuid", "name": "Ravi Kumar", "phone": "9876543210", "email": "ravi@example.com", "address": null, "notes": null, "createdAt": "..." }],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1, "hasNext": false, "hasPrev": false }
}
```

### POST /customers
**Request:**
```json
{ "name": "Ravi Kumar", "phone": "9876543210", "email": "ravi@example.com", "address": "Chennai", "notes": "VIP customer" }
```
**Response 201:** Customer object  
**Errors:** `409` phone already exists

### GET /customers/:id
**Response 200:** Single customer object

### PUT /customers/:id
Same body as POST. **Response 200:** Updated customer

### DELETE /customers/:id
**(ADMIN only)** **Response 204**  
**Errors:** `400` has related invoices or repairs

### GET /customers/:id/history
**Response 200:**
```json
{
  "invoices": [...],
  "repairs": [...],
  "outstandingBalance": 2500.00
}
```

---

## Suppliers

### GET /suppliers
**Query:** `page`, `limit`, `search`  
**Access:** MANAGER, ADMIN

### POST /suppliers
```json
{ "name": "Tech Parts Ltd", "phone": "9000000001", "email": "parts@techparts.com", "address": "Mumbai", "paymentTerms": "Net 30" }
```
**Response 201:** Supplier object

### GET /suppliers/:id | PUT /suppliers/:id | DELETE /suppliers/:id
Standard CRUD. DELETE is ADMIN only.

---

## Products

### GET /products
**Query:** `page`, `limit`, `search`, `category`

### GET /products/low-stock
Returns products where `stockQty <= minStockLevel`. No pagination.

### GET /products/categories
Returns an array of distinct category strings.

### POST /products
**(MANAGER / ADMIN)**
```json
{
  "name": "iPhone 15 Screen", "sku": "SCREEN-IP15", "barcode": "1234567890123",
  "category": "Screens", "purchasePrice": 4500, "sellingPrice": 6500,
  "stockQty": 10, "minStockLevel": 3
}
```
**Errors:** `409` SKU or barcode already exists

### GET /products/:id | PUT /products/:id | DELETE /products/:id
Standard CRUD. DELETE is ADMIN only.

### POST /products/:id/adjust-stock
**(MANAGER / ADMIN)**
```json
{ "quantity": 20, "movementType": "PURCHASE", "note": "Restock from supplier" }
```
`quantity` must be non-zero. Positive = add, negative = remove (with negative stock guard).  
**Response 200:** Updated product

### GET /products/:id/movements
**Query:** `page`, `limit`  
**Response 200:** Paginated stock movement ledger

---

## Invoices

### GET /invoices
**Query:** `page`, `limit`, `search`, `status` (PAID|UNPAID|PARTIAL|CANCELLED), `customerId`, `from`, `to`

### POST /invoices
```json
{
  "customerId": "uuid",
  "discount": 100,
  "items": [
    { "productId": "uuid", "description": "iPhone 15 Screen", "qty": 1, "unitPrice": 6500, "tax": 18 },
    { "productId": null, "description": "Labour charge", "qty": 1, "unitPrice": 500, "tax": 0 }
  ]
}
```
**Response 201:** Full invoice with items, customer, payments, pdfUrl

### GET /invoices/:id
Full invoice with line items (product SKU included), all payments (with refund flag).

### PUT /invoices/:id
**(MANAGER / ADMIN)** Update `discount` or `status`. Cannot update CANCELLED invoices.

### POST /invoices/:id/cancel
**(MANAGER / ADMIN)** Atomically: set CANCELLED, restore stock, refund payments.  
**Response 200:** Updated invoice

---

## Repairs

### GET /repairs
**Query:** `page`, `limit`, `search`, `status`, `customerId`, `technicianId`, `from`, `to`

### POST /repairs
```json
{
  "customerId": "uuid",
  "deviceType": "Smartphone",
  "brand": "Samsung",
  "model": "Galaxy S24",
  "serialNumber": "SN123456",
  "issueDescription": "Cracked screen, charging port issue",
  "technicianId": "uuid",
  "estimatedCost": 3500,
  "parts": [
    { "productId": "uuid", "qty": 1, "cost": 2800 }
  ]
}
```
**Response 201:** Full job with parts, customer, technician, pdfUrl

### GET /repairs/:id
Full repair with parts (product name, SKU), customer, technician.

### PUT /repairs/:id
```json
{ "status": "IN_REPAIR", "repairNotes": "Screen replaced. Testing charging port.", "finalCost": 3200, "technicianId": "uuid" }
```
**Status guard:** Cannot revert DELIVERED status.

### DELETE /repairs/:id
**(ADMIN only)** Only RECEIVED or DIAGNOSING. Restores parts stock.  
**Response 204**

---

## Payments

### GET /payments
**Query:** `page`, `limit`, `invoiceId`, `method`, `from`, `to`

### POST /payments
**(MANAGER / ADMIN)**
```json
{ "invoiceId": "uuid", "amount": 3000, "method": "UPI" }
```
**Errors:** `400` cancelled | `400` already paid | `400` overpayment

### POST /payments/refund
**(MANAGER / ADMIN)**
```json
{ "paymentId": "uuid" }
```
**Errors:** `400` already refunded | `400` on cancelled invoice

---

## Reports (MANAGER / ADMIN)

### GET /reports/sales
**Query:** `from`, `to`  
**Response:** `{ invoices[], totalRevenue, paidCount, unpaidCount, partialCount, from, to }`

### GET /reports/inventory
**Response:** `{ products[], lowStockCount, lowStockItems[], inventoryValue, retailValue, potentialProfit }`

### GET /reports/repairs
**Query:** `from`, `to`  
**Response:** `{ repairs[], byStatus[], totalRevenue, from, to }`

### GET /reports/financial
**Query:** `from`, `to`  
**Response:** `{ revenue: { total, tax, discount }, collected, byMethod[], refunds: { total, count }, from, to }`

---

## Dashboard

### GET /dashboard
**Response:**
```json
{
  "todaySales": { "amount": 15000.00, "count": 3 },
  "monthlyRevenue": { "amount": 245000.00, "count": 48 },
  "activeRepairs": 12,
  "lowStockAlerts": 4,
  "lowStockItems": [{ "name": "...", "stockQty": 1, "minStockLevel": 3 }],
  "recentInvoices": [...],
  "recentRepairs": [...],
  "salesByDay": [{ "date": "2024-01-15", "total": 8500.00 }]
}
```

---

## Settings

### GET /settings
**Response:** `{ "business_name": "My Shop", "default_tax": "18", ... }`

### PUT /settings
**(ADMIN only)**
```json
{ "business_name": "Phoneix Repairs", "default_tax": 18, "invoice_prefix": "INV", "gst_number": "27AABCU9603R1ZX" }
```
Only whitelisted keys are accepted. Unknown keys are silently ignored.

---

## Search

### GET /search?q={query}
Minimum 2 characters.  
**Response:**
```json
{
  "query": "apple",
  "customers": [...],
  "products": [...],
  "invoices": [...],
  "repairs": [...]
}
```
Up to 5 results per category.

---

## Upload

### POST /upload/product-image/:productId
**(MANAGER / ADMIN)** `multipart/form-data`, field `image`. Accepted: JPEG, PNG, WebP. Max 5 MB.  
**Response:** `{ "imageUrl": "/uploads/products/...", "product": {...} }`

### POST /upload/logo
**(ADMIN only)** `multipart/form-data`, field `logo`.  
**Response:** `{ "logoUrl": "/uploads/logos/..." }`

---

## Import / Export

### POST /import-export/products/import
**(MANAGER / ADMIN)** `multipart/form-data`, field `file`. CSV or XLSX.  
**Response:** `{ "imported": 45, "skipped": 2, "errors": ["Row missing SKU"] }`

### GET /import-export/products/export
**(MANAGER / ADMIN)** Downloads `products-export.xlsx`.

### GET /import-export/reports/sales/export
**(MANAGER / ADMIN)** Query: `from`, `to`. Downloads `sales-report.xlsx`.

### POST /import-export/prepare-send
**Request:** `{ "type": "invoice" | "repair", "id": "uuid" }`  
**Response:** `{ "pdfUrl": "/uploads/pdfs/invoice-INV-00001.pdf", "whatsappUrl": "https://wa.me/919876543210", "phone": "919876543210" }`

---

## Health Check

### GET /health
No authentication required.  
**Response 200:**
```json
{ "status": "ok", "timestamp": "2024-01-15T10:30:00.000Z", "uptime": 86400, "environment": "production" }
```

---

## Error Response Format

All errors follow this structure:
```json
{ "error": "Human-readable error message" }
```
Validation errors include a `details` array:
```json
{ "error": "Validation failed", "details": ["name is required", "phone must be at least 7 characters"] }
```

## HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Created |
| `204` | Deleted (no content) |
| `400` | Validation error / business rule violation |
| `401` | Unauthenticated (no/invalid token) |
| `403` | Forbidden (insufficient role) |
| `404` | Resource not found |
| `409` | Conflict (duplicate) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |
