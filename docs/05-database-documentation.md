# Phoneix Business Suite — Database Documentation

**Database:** PostgreSQL 16  
**ORM:** Prisma 5  
**Migration:** `prisma/migrations/0001_init/migration.sql`

---

## Enumerations

### Role
`ADMIN` | `MANAGER` | `STAFF`

### InvoiceStatus
`PAID` | `UNPAID` | `PARTIAL` | `CANCELLED`

### RepairStatus
`RECEIVED` | `DIAGNOSING` | `WAITING_FOR_PARTS` | `IN_REPAIR` | `READY` | `DELIVERED`

### MovementType
`SALE` | `PURCHASE` | `ADJUSTMENT` | `REPAIR_USAGE` | `RETURN`

### PaymentMethod
`CASH` | `UPI` | `CARD` | `BANK_TRANSFER`

---

## Tables

### User

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, UUID default | Internal identifier |
| `email` | TEXT | UNIQUE, NOT NULL | Login email (normalised to lowercase) |
| `password` | TEXT | NOT NULL | bcrypt hash (cost 12) |
| `name` | TEXT | NOT NULL | Display name |
| `role` | Role enum | NOT NULL, default STAFF | Access level |
| `createdAt` | TIMESTAMP | NOT NULL, default now() | Creation timestamp |

**Indexes:** `email`  
**Relations:** → `RepairJob` (as technician), → `AuditLog`

---

### Customer

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, UUID | Internal identifier |
| `name` | TEXT | NOT NULL | Full name |
| `phone` | TEXT | NOT NULL | Contact number (must be unique) |
| `email` | TEXT | nullable | Email address |
| `address` | TEXT | nullable | Physical address |
| `notes` | TEXT | nullable | Internal notes |
| `createdAt` | TIMESTAMP | NOT NULL, default now() | |

**Indexes:** `phone`, `name`  
**Relations:** → `Invoice`, → `RepairJob`  
**Constraint:** DELETE blocked if customer has invoices or repairs (RESTRICT)

---

### Supplier

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, UUID | |
| `name` | TEXT | NOT NULL | Company / person name |
| `phone` | TEXT | NOT NULL | Contact number |
| `email` | TEXT | nullable | |
| `address` | TEXT | nullable | |
| `paymentTerms` | TEXT | nullable | e.g. "Net 30" |
| `createdAt` | TIMESTAMP | NOT NULL, default now() | |

**Indexes:** `name`

---

### Product

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, UUID | |
| `name` | TEXT | NOT NULL | Product display name |
| `sku` | TEXT | UNIQUE, NOT NULL | Stock keeping unit |
| `barcode` | TEXT | UNIQUE, nullable | EAN / UPC barcode |
| `category` | TEXT | nullable | Product category |
| `imageUrl` | TEXT | nullable | Path to uploaded image |
| `purchasePrice` | DECIMAL(12,2) | NOT NULL | Cost price |
| `sellingPrice` | DECIMAL(12,2) | NOT NULL | Retail price |
| `stockQty` | INT | NOT NULL, default 0 | Current stock count |
| `minStockLevel` | INT | NOT NULL, default 5 | Alert threshold |
| `createdAt` | TIMESTAMP | NOT NULL, default now() | |

**Indexes:** `sku`, `barcode`, `name`, `category`  
**Relations:** → `StockMovement`, → `InvoiceItem`, → `RepairPart`  
**Note:** Low-stock query uses raw SQL `WHERE "stockQty" <= "minStockLevel"` for accurate column comparison

---

### StockMovement

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, UUID | |
| `productId` | TEXT | NOT NULL, FK → Product | |
| `movementType` | MovementType enum | NOT NULL | SALE / PURCHASE / ADJUSTMENT / REPAIR_USAGE / RETURN |
| `quantity` | INT | NOT NULL | Positive = in, Negative = out (SALE / REPAIR_USAGE stored as negative) |
| `note` | TEXT | nullable | Context (e.g. "Invoice INV-00001") |
| `createdAt` | TIMESTAMP | NOT NULL, default now() | |

**Indexes:** `productId`, `createdAt`  
**Delete policy:** RESTRICT (preserve audit trail)

---

### Invoice

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, UUID | |
| `number` | TEXT | UNIQUE, NOT NULL | e.g. "INV-00001" |
| `prefix` | TEXT | NOT NULL, default "INV" | Prefix at time of creation |
| `customerId` | TEXT | NOT NULL, FK → Customer | |
| `status` | InvoiceStatus enum | NOT NULL, default UNPAID | Auto-managed by payment logic |
| `taxAmount` | DECIMAL(12,2) | NOT NULL, default 0 | Total tax across all items |
| `discount` | DECIMAL(12,2) | NOT NULL, default 0 | Flat discount amount |
| `totalAmount` | DECIMAL(12,2) | NOT NULL | `subtotal + tax - discount` |
| `pdfUrl` | TEXT | nullable | Path to generated PDF |
| `createdAt` | TIMESTAMP | NOT NULL, default now() | |

**Indexes:** `customerId`, `status`, `createdAt`, `number`  
**Relations:** → `InvoiceItem` (cascade delete), → `Payment`

---

### InvoiceItem

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, UUID | |
| `invoiceId` | TEXT | NOT NULL, FK → Invoice (CASCADE DELETE) | |
| `productId` | TEXT | nullable, FK → Product (SET NULL on delete) | null for custom items |
| `description` | TEXT | NOT NULL | Line item label |
| `qty` | INT | NOT NULL | Quantity |
| `unitPrice` | DECIMAL(12,2) | NOT NULL | Price per unit (excl. tax) |
| `tax` | DECIMAL(5,2) | NOT NULL, default 0 | Tax percentage for this line |
| `total` | DECIMAL(12,2) | NOT NULL | `qty × unitPrice × (1 + tax/100)` |

**Indexes:** `invoiceId`

---

### RepairJob

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, UUID | |
| `jobId` | TEXT | UNIQUE, NOT NULL | e.g. "JOB-00001" |
| `customerId` | TEXT | NOT NULL, FK → Customer | |
| `deviceType` | TEXT | NOT NULL | Smartphone / Tablet / etc. |
| `brand` | TEXT | NOT NULL | Device manufacturer |
| `model` | TEXT | NOT NULL | Device model name |
| `serialNumber` | TEXT | nullable | IMEI / serial |
| `issueDescription` | TEXT | NOT NULL | Reported fault |
| `repairNotes` | TEXT | nullable | Technician's work notes |
| `technicianId` | TEXT | nullable, FK → User (SET NULL) | Assigned technician |
| `status` | RepairStatus enum | NOT NULL, default RECEIVED | |
| `estimatedCost` | DECIMAL(12,2) | nullable | Quote given to customer |
| `finalCost` | DECIMAL(12,2) | nullable | Charged on completion |
| `pdfUrl` | TEXT | nullable | Job card PDF path |
| `createdAt` | TIMESTAMP | NOT NULL, default now() | |
| `updatedAt` | TIMESTAMP | NOT NULL, auto-updated | |

**Indexes:** `customerId`, `status`, `jobId`, `createdAt`  
**Relations:** → `RepairPart` (cascade delete)

---

### RepairPart

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, UUID | |
| `repairJobId` | TEXT | NOT NULL, FK → RepairJob (CASCADE DELETE) | |
| `productId` | TEXT | NOT NULL, FK → Product (RESTRICT) | |
| `qty` | INT | NOT NULL | Quantity used |
| `cost` | DECIMAL(12,2) | NOT NULL | Unit cost at time of repair |

**Indexes:** `repairJobId`

---

### Payment

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, UUID | |
| `invoiceId` | TEXT | NOT NULL, FK → Invoice (RESTRICT) | |
| `amount` | DECIMAL(12,2) | NOT NULL | Payment amount |
| `method` | PaymentMethod enum | NOT NULL | CASH / UPI / CARD / BANK_TRANSFER |
| `refunded` | BOOLEAN | NOT NULL, default false | Set to true on refund or invoice cancel |
| `createdAt` | TIMESTAMP | NOT NULL, default now() | |

**Indexes:** `invoiceId`, `createdAt`

---

### Setting

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, UUID | |
| `key` | TEXT | UNIQUE, NOT NULL | Setting identifier (whitelisted at API level) |
| `value` | TEXT | NOT NULL | Setting value (always stored as string) |

**Indexes:** `key`  
**Note:** Seeded with 9 default settings on first run

---

### AuditLog

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, UUID | |
| `userId` | TEXT | NOT NULL, FK → User | Who performed the action |
| `action` | TEXT | NOT NULL | Action identifier |
| `metadata` | JSONB | nullable | Action context (entity IDs, changes) |
| `createdAt` | TIMESTAMP | NOT NULL, default now() | |

**Indexes:** `userId`, `createdAt`

---

## Relationship Diagram (text)

```
User ──────────────────────────────────── AuditLog
  │ (technician)
  │
  └──► RepairJob ──► RepairPart ──► Product ──► StockMovement
         │
Customer ─┤
         │
         └──► Invoice ──► InvoiceItem ──► Product
                │
                └──► Payment

Supplier (standalone — no FK to other tables)
Setting  (standalone key-value store)
```

---

## Migration Strategy

A single migration file `0001_init` creates the entire schema. To apply:

```bash
# Development
npx prisma migrate dev

# Production
npx prisma migrate deploy
```

For schema changes, create a new numbered migration directory following the same naming convention.
