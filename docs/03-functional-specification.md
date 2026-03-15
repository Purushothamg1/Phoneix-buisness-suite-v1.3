# Phoneix Business Suite — Functional Specification

**Version:** 1.0.0

---

## 1. Authentication

### 1.1 Login
**Purpose:** Authenticate a user and issue a session token.  
**Input:** `email` (string), `password` (string)  
**Output:** JWT token + user object (`id`, `email`, `name`, `role`)  
**Logic:**
1. Locate user by email (case-insensitive via `.toLowerCase()`)
2. Run `bcrypt.compare` against stored hash **always** (timing-safe — runs against dummy hash if user not found)
3. On match, sign a JWT with `{ userId, role }` valid for 8 hours
4. Rate limit: 10 failed attempts per IP per 15 minutes

### 1.2 Session Validation
On every protected request, the backend:
1. Extracts the Bearer token from `Authorization` header
2. Verifies JWT signature and expiry
3. Re-fetches the user from the database (ensures role changes take effect immediately)
4. Attaches `req.user = { userId, role, email, name }`

### 1.3 Change Password
**Input:** `currentPassword`, `newPassword`  
**Logic:** Verify current password → enforce strength policy (min 8, uppercase, lowercase, digit) → bcrypt hash → update

### 1.4 Password Policy
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- Enforced at both Joi schema level and service layer

---

## 2. User Management (ADMIN only)

### 2.1 List Users
Returns all user accounts (excluding password hashes). Sorted by creation date.

### 2.2 Create User
**Input:** `name`, `email`, `password`, `role` (ADMIN | MANAGER | STAFF)  
**Logic:** Email normalised to lowercase → uniqueness check → bcrypt hash → create  
**Guards:** ADMIN only

### 2.3 Delete User
**Guards:** ADMIN only, cannot delete own account

---

## 3. Customer Management

### 3.1 List Customers
- Paginated (default 20 per page, max 100)
- Search across `name`, `phone`, `email` (case-insensitive)
- Sorted by creation date descending

### 3.2 Create / Update Customer
**Fields:** `name` (required), `phone` (required, must be unique), `email`, `address`, `notes`  
**Deduplication:** Phone number must be unique across all customers

### 3.3 Delete Customer
**Guards:** ADMIN only  
**Constraint:** Blocked by DB if customer has invoices or repair jobs

### 3.4 Customer History
Returns:
- Last 20 invoices with items and payments
- Last 20 repair jobs
- Outstanding balance (sum of UNPAID + PARTIAL invoices)

---

## 4. Supplier Management

### 4.1 CRUD Operations
**Fields:** `name`, `phone`, `email`, `address`, `paymentTerms`  
**Access:** MANAGER and ADMIN only  
**Search:** Name or phone

---

## 5. Inventory Management

### 5.1 Product Catalogue
**Fields:** `name`, `sku` (unique), `barcode` (unique), `category`, `purchasePrice`, `sellingPrice`, `stockQty`, `minStockLevel`, `imageUrl`

### 5.2 Stock Adjustment
**Input:** `quantity` (non-zero integer), `movementType` (PURCHASE | ADJUSTMENT | RETURN), `note`  
**Logic:** New quantity calculated → negative stock blocked → atomic transaction updates product + creates movement record  
**Access:** MANAGER and ADMIN only

### 5.3 Low Stock Alerts
Returns all products where `stockQty <= minStockLevel`. Uses raw SQL for accurate column-to-column comparison.

### 5.4 Stock Movements
Complete paginated ledger of all stock changes for a product. Movement types:
- `SALE` — invoice line item deduction (quantity stored as negative)
- `PURCHASE` — manual stock addition
- `REPAIR_USAGE` — deducted when repair job created with parts
- `ADJUSTMENT` — manual correction
- `RETURN` — stock restored on invoice cancel or repair delete

### 5.5 Product Import
**Format:** CSV or Excel (.xlsx)  
**Columns:** `sku`, `name`, `category`, `purchasePrice`/`purchase_price`, `sellingPrice`/`selling_price`, `stockQty`/`stock_qty`, `minStockLevel`/`min_stock`  
**Logic:** Upsert by SKU — creates new or updates existing  
**Returns:** `{ imported, skipped, errors[] }`

### 5.6 Product Export
Downloads an Excel workbook with all products. Columns: SKU, Name, Category, Barcode, Purchase Price, Selling Price, Stock Qty, Min Stock Level.

---

## 6. Invoice System

### 6.1 Create Invoice
**Input:**
```json
{
  "customerId": "uuid",
  "discount": 0,
  "items": [
    { "productId": "uuid|null", "description": "string", "qty": 1, "unitPrice": 0.00, "tax": 18 }
  ]
}
```

**Logic:**
1. Validate customer exists
2. For each product item: verify stock availability
3. Generate invoice number inside transaction (race-condition safe)
4. Calculate per-line totals: `lineSubtotal × (1 + tax/100)`
5. Sum tax and compute `totalAmount = subtotal + tax - discount`
6. Reject if `totalAmount < 0`
7. Create invoice + all items atomically
8. For each product item: decrement `stockQty`, create `SALE` movement
9. Generate PDF asynchronously (failure does not fail the invoice)

**Number Format:** `{PREFIX}-{00001}` (e.g. `INV-00001`)

### 6.2 Invoice Status Flow
```
UNPAID ──► PARTIAL ──► PAID
  │
  └──────────────────────► CANCELLED
```
Status is automatically recalculated after each payment or refund.

### 6.3 Cancel Invoice
**Guards:** MANAGER or ADMIN only  
**Effects (atomic):**
1. Set status to `CANCELLED`
2. Restore `stockQty` for all product items
3. Create `RETURN` stock movements
4. Mark all non-refunded payments as `refunded: true`

### 6.4 Invoice Detail View
Returns full invoice with: customer info, all line items (with product SKU), all payments (with refund flag).

---

## 7. Repair Job Management

### 7.1 Create Repair Job
**Input:**
```json
{
  "customerId": "uuid",
  "deviceType": "Smartphone",
  "brand": "Apple",
  "model": "iPhone 15",
  "serialNumber": "optional",
  "issueDescription": "string",
  "technicianId": "uuid|null",
  "estimatedCost": 0.00,
  "parts": [{ "productId": "uuid", "qty": 1, "cost": 0.00 }]
}
```
**Logic:**
1. Validate customer and each part's stock
2. Generate job ID inside transaction (race-safe): `JOB-00001`
3. Create job + parts atomically
4. Deduct stock for each part, create `REPAIR_USAGE` movements
5. Generate job card PDF asynchronously

### 7.2 Status Workflow
```
RECEIVED → DIAGNOSING → WAITING_FOR_PARTS → IN_REPAIR → READY → DELIVERED
```
- Status can only advance (DELIVERED cannot be reverted)
- Update also sets `repairNotes`, `finalCost`, `technicianId`

### 7.3 Delete Repair Job
**Guards:** ADMIN only; only `RECEIVED` or `DIAGNOSING` status permitted  
**Effects:** Parts stock restored, `RETURN` movements created

---

## 8. Payments

### 8.1 Record Payment
**Input:** `invoiceId`, `amount` (positive), `method` (CASH | UPI | CARD | BANK_TRANSFER)  
**Guards:** MANAGER or ADMIN only  
**Logic:**
1. Verify invoice exists and is not CANCELLED or PAID
2. Check remaining balance — block overpayment
3. Create payment record
4. Recalculate and update invoice status (UNPAID → PARTIAL → PAID)

### 8.2 Refund Payment
**Input:** `paymentId`  
**Logic:** Mark payment `refunded: true` → recalculate invoice status  
**Guards:** Cannot refund a payment on a CANCELLED invoice individually

### 8.3 Payment List
Paginated list with optional filters: `invoiceId`, `method`, date range (`from`, `to`).

---

## 9. Reports

All reports accept optional `from` / `to` date filters. Default range: current calendar month.  
**Access:** MANAGER and ADMIN only.

### 9.1 Sales Report
Returns: all non-cancelled invoices in range, total revenue (PAID invoices), counts by status (paid, unpaid, partial).

### 9.2 Inventory Report
Returns: all products, low-stock items, inventory value at cost, retail value, potential profit.

### 9.3 Repair Report
Returns: all repairs in range, grouped by status, total final-cost revenue.

### 9.4 Financial Report
Returns: total invoiced amount, tax collected, discounts given, payments collected, refund totals, breakdown by payment method.

---

## 10. Dashboard

Refreshes every 60 seconds via SWR.

**KPI Cards:**
- Today's sales (amount + invoice count)
- Monthly revenue (amount + invoice count)
- Active repairs (all non-DELIVERED)
- Low stock alerts (count of items at or below min level)

**Charts:**
- Daily sales bar chart for current month

**Feeds:**
- 5 most recent invoices
- 5 most recent active repairs

---

## 11. Settings

**Access:** ADMIN only for writes; any authenticated user can read.

**Configurable Keys:**
| Key | Description |
|---|---|
| `business_name` | Business display name (used in PDFs) |
| `business_address` | Business address (used in PDFs) |
| `business_phone` | Contact number |
| `business_email` | Contact email |
| `gst_number` | GST/VAT registration number |
| `invoice_prefix` | Prefix for invoice numbers (e.g. `INV`) |
| `default_tax` | Default tax percentage for new invoice items |
| `currency` | Currency code (e.g. `INR`) |
| `currency_symbol` | Currency symbol (e.g. `₹`) |
| `logo_url` | Uploaded logo path |
| `receipt_footer` | Custom text at bottom of PDFs |
| `timezone` | Business timezone |

---

## 12. PDF Generation

### 12.1 Invoice PDF
Sections: Business header (name, address, phone, GST) → Invoice metadata (number, date, status) → Customer billing info → Itemised table (description, qty, unit price, tax %, total) → Totals block (subtotal, tax, discount, grand total)

### 12.2 Repair Job Card PDF
Sections: Business header → Job ID, date, status → Customer info → Device info (type, brand, model, serial) → Issue description → Parts used table → Estimated cost → Signature lines (customer + technician)

---

## 13. WhatsApp Sharing

**Endpoint:** `POST /api/import-export/prepare-send`  
**Input:** `{ type: 'invoice' | 'repair', id: 'uuid' }`  
**Output:** `{ pdfUrl, whatsappUrl, phone }`  
**Logic:** Constructs `https://wa.me/{phone}` with digits only from stored phone number. Frontend opens this URL in a new tab, triggering WhatsApp Web / app.

---

## 14. Global Search

**Endpoint:** `GET /api/search?q={query}` (min 2 chars)  
**Searches:** Customers (name, phone, email), Products (name, SKU, barcode), Invoices (number, customer name), Repairs (jobId, brand, model, customer name)  
**Returns:** Up to 5 results per category  
**Frontend:** Debounced 350ms, navigates directly to detail page on click
