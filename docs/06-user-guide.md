# Phoneix Business Suite — User Guide

> **Version 1.1.0** | For STAFF, MANAGER, and ADMIN users

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard](#dashboard)
3. [Customers](#customers)
4. [Products & Inventory](#products--inventory)
5. [Invoices](#invoices)
6. [Repair Jobs](#repair-jobs)
7. [Payments](#payments)
8. [Suppliers](#suppliers)
9. [Reports](#reports)
10. [Global Search](#global-search)
11. [Import & Export](#import--export)
12. [Settings](#settings)
13. [Role Permissions Reference](#role-permissions-reference)

---

## Getting Started

### Logging In

1. Open your browser and navigate to the app URL (e.g., `http://yourdomain.com`)
2. Enter your **email address** and **password**
3. Click **Sign In**

Default admin credentials (change immediately after first login):
- Email: `admin@phoneix.com`
- Password: `Admin@1234`

### First-Time Setup

After logging in as Admin, navigate to **Settings** and configure:
- Business name, address, and phone number
- GST/Tax number
- Invoice prefix (e.g., `INV`, `PBS`, `2024`)
- Default tax rate
- Currency symbol
- Upload your business logo

### Changing Your Password

1. Click your profile icon (top-right of sidebar)
2. Select **Change Password**
3. Enter your current password, then your new password
4. New password must be at least 8 characters and contain uppercase, lowercase, and a number

---

## Dashboard

The Dashboard gives you a real-time overview of your business.

### Stat Cards

| Card | Description |
|------|-------------|
| **Today's Sales** | Total invoice value created today (excluding cancelled) |
| **Monthly Revenue** | Total invoice value for the current calendar month |
| **Active Repairs** | Number of repair jobs not yet delivered |
| **Low Stock Alerts** | Count of products at or below their minimum stock level |

### Sales Chart

The bar chart shows daily sales totals for the current month. Hover over any bar to see the exact amount.

### Recent Repairs

Shows the 5 most recent open repair jobs with their current status. Click **View All** or navigate to Repairs to see more.

### Recent Invoices

Shows the last 5 invoices with status indicators. Click an invoice number to open the detail view.

> 💡 **Tip:** The dashboard auto-refreshes every 60 seconds. No need to manually reload.

---

## Customers

### Viewing Customers

Navigate to **Customers** from the sidebar. The table shows all customers sorted by most recently added.

- Use the **search bar** to filter by name, phone, or email
- Pagination controls at the bottom let you navigate through pages

### Adding a Customer

1. Click **New Customer** (top right)
2. Fill in the form:
   - **Name** (required) — customer's full name
   - **Phone** (required) — must be unique across all customers
   - **Email** (optional)
   - **Address** (optional)
   - **Notes** (optional) — internal notes about the customer
3. Click **Save**

### Editing a Customer

1. Find the customer in the table
2. Click the **pencil icon** (✏️) in the Actions column
3. Modify any fields and click **Save**

> ⚠️ Phone numbers must be unique. You will see an error if the phone is already registered to another customer.

### Viewing Customer History

Click the **eye icon** (👁) to view a customer's complete history:
- All invoices with totals and statuses
- All repair jobs
- **Outstanding balance** — total unpaid/partially-paid invoice amounts

### Deleting a Customer

> 🔒 **ADMIN only.** Click the **trash icon** and confirm the deletion.

> ⚠️ Customers with existing invoices or repair jobs cannot be deleted.

---

## Products & Inventory

### Viewing Products

Navigate to **Products** from the sidebar. Filter by:
- Search bar (name, SKU, or barcode)
- Category dropdown

Products with stock at or below the minimum level are highlighted with a warning badge.

### Adding a Product

1. Click **New Product**
2. Fill in the fields:
   - **Name** (required)
   - **SKU** (required, must be unique) — stock keeping unit code
   - **Barcode** (optional) — for scanning
   - **Category** (optional) — group products (e.g., "Screens", "Batteries")
   - **Purchase Price** — what you pay per unit
   - **Selling Price** — what you charge customers
   - **Opening Stock** — initial quantity
   - **Min Stock Level** — triggers low-stock alert when reached
3. Click **Save**

### Editing a Product

Click the **pencil icon** to edit any product details, including prices and minimum stock levels.

### Adjusting Stock

Use this for purchase arrivals, manual corrections, or returns (not sales — those are handled automatically by invoices).

1. Click the **stock icon** on a product row
2. Select movement type:
   - **PURCHASE** — goods received from supplier
   - **ADJUSTMENT** — manual correction
   - **RETURN** — customer returned goods
3. Enter the **quantity** (positive to add, negative to remove)
4. Add an optional note
5. Click **Adjust**

> ℹ️ Stock is automatically deducted when you create an invoice or repair job, and restored when you cancel them.

### Stock Movement History

Click the **history icon** on any product to see a chronological log of all stock changes with reasons.

### Low Stock View

Click **Low Stock** tab to see only products that need restocking.

---

## Invoices

### Viewing Invoices

Navigate to **Invoices** to see all invoices. Filter by:
- Search (invoice number or customer name)
- Status (All, Paid, Unpaid, Partial, Cancelled)

Status colours:
- 🟢 **PAID** — fully paid
- 🔴 **UNPAID** — no payment received
- 🟡 **PARTIAL** — some payment received
- ⚫ **CANCELLED** — cancelled, stock restored

### Creating an Invoice

1. Click **New Invoice**
2. **Select Customer** — type in the search box to find a customer
3. **Add Line Items:**
   - Select a product from the dropdown (auto-fills description and price), or leave blank for a custom item
   - Set quantity, unit price, and tax percentage for each line
   - Add more lines with **+ Add Item**
4. Set **Discount** (optional) — applies to the whole invoice
5. Review the **Summary** panel on the right showing subtotal, tax, discount, and grand total
6. Click **Create Invoice**

A PDF is generated automatically and can be downloaded or shared via WhatsApp.

### Viewing an Invoice

Click the **eye icon** or invoice number to open the full detail view, showing:
- Customer information
- All line items with individual tax calculations
- Payment summary and outstanding balance
- Payment history

### Downloading the PDF

On the invoice detail page or in the list, click the **PDF icon** (⬇) to download the invoice PDF.

### Sharing via WhatsApp

Click the **WhatsApp icon** (➤) to open WhatsApp with the customer's number pre-filled. Send the PDF link manually.

### Cancelling an Invoice

> 🔒 **ADMIN / MANAGER only.**

1. From the invoice list, click the **cancel icon** (✕) on the invoice row
2. Or from the invoice detail page, click **Cancel Invoice**
3. Confirm the action

Cancellation will:
- Mark all line-item products' stock as restored
- Mark all payments as refunded
- Set status to **CANCELLED**

> ⚠️ Cancellation is permanent and cannot be undone.

---

## Repair Jobs

### Viewing Repairs

Navigate to **Repairs** to see all repair jobs. Filter by:
- Search (Job ID, brand, model, or customer name)
- Status filter

### Creating a Repair Job

1. Click **New Repair**
2. **Select Customer**
3. Fill in **Device Information:**
   - Device Type, Brand, Model
   - Serial Number (optional)
   - Issue Description — be detailed here
4. **Add Parts** (optional):
   - Select products from inventory that will be used
   - Set quantity and cost per part
   - Stock is deducted automatically
5. **Assign Technician** (optional)
6. Set **Estimated Cost** (optional)
7. Click **Create Repair Job**

A unique Job ID (e.g., `JOB-00001`) is assigned automatically. A job card PDF is generated.

### Job Status Workflow

```
RECEIVED → DIAGNOSING → WAITING_FOR_PARTS → IN_REPAIR → READY → DELIVERED
```

Update the status as the repair progresses.

### Updating a Repair

1. Click the **pencil icon** on the repair in the list
2. Or open the repair detail and click **Update Status**
3. Update:
   - **Status** — current stage of the repair
   - **Repair Notes** — what was found/done
   - **Final Cost** — actual cost to charge the customer
4. Click **Update**

> ⚠️ A **DELIVERED** repair cannot be moved back to an earlier status.

### Viewing Repair Detail

Click the **eye icon** to open the full repair detail page, showing:
- Device information
- Issue description and repair notes
- Parts used with costs
- Customer and technician details
- Current status

### Sharing via WhatsApp

Click the **WhatsApp icon** on any repair to open WhatsApp with the customer's number pre-filled.

---

## Payments

### Viewing Payments

Navigate to **Payments** to see all payment records. Filter by date range, payment method, or invoice.

### Recording a Payment

> 🔒 **ADMIN / MANAGER only.**

1. Click **Record Payment**
2. Select the **Invoice** (filtered to unpaid/partial invoices)
3. Enter the **Amount** — cannot exceed the outstanding balance
4. Select **Payment Method**: Cash, UPI, Card, or Bank Transfer
5. Click **Record**

The invoice status updates automatically:
- Full payment → **PAID**
- Partial payment → **PARTIAL**

### Refunding a Payment

> 🔒 **ADMIN only.**

1. Find the payment in the payments list
2. Click **Refund**
3. Confirm

The invoice status recalculates automatically.

---

## Suppliers

### Managing Suppliers

Navigate to **Suppliers** to manage your product vendors.

> 🔒 **ADMIN / MANAGER only.**

Actions:
- **Add** — create a new supplier record
- **Edit** — update supplier details
- **Delete** — remove (ADMIN only)

Supplier fields: Name, Phone, Email, Address, Payment Terms.

---

## Reports

> 🔒 **ADMIN / MANAGER only.**

Navigate to **Reports** and select a tab:

### Sales Report

Shows all invoices in a date range with:
- Total revenue collected
- Invoice count by status (Paid, Unpaid, Partial)

Set a date range using the **From** and **To** date pickers.

### Inventory Report

Shows:
- All products with current stock levels
- Low stock count
- Total inventory value (at purchase price)
- Total retail value (at selling price)
- Potential profit margin

### Repair Report

Shows:
- All repair jobs in a date range
- Job breakdown by status
- Total repair revenue (from final costs)

### Financial Report

Shows:
- Gross invoice value, total tax, total discounts
- Amount actually collected via payments
- Payment method breakdown (Cash, UPI, Card, Bank Transfer)
- Refund totals

### Exporting Reports

Click **Export to Excel** on any report to download the data as an `.xlsx` file.

---

## Global Search

Click the **search icon** in the sidebar or navigate to **Search**.

Type at least **2 characters** to search across:
- Customers (by name, phone, email)
- Products (by name, SKU, barcode)
- Invoices (by invoice number or customer name)
- Repairs (by Job ID, brand, model, or customer name)

Click any result to navigate directly to that record's detail page.

> 💡 The search is debounced — results appear 350ms after you stop typing to avoid excessive API calls.

---

## Import & Export

Navigate to **Import / Export**.

> 🔒 **ADMIN / MANAGER only.**

### Importing Products

1. Click **Download Template** to get a sample Excel file showing the correct column format
2. Fill in your product data
3. Drag and drop (or click to upload) your CSV or Excel file
4. Review the import results showing how many records were imported or skipped

**Required column:** `sku`  
**Other columns:** `name`, `category`, `purchasePrice`, `sellingPrice`, `stockQty`, `minStockLevel`

> ℹ️ If a product with the same SKU already exists, it will be **updated** (upsert). New SKUs will be **created**.

### Exporting Products

Click **Export Products** to download all current products as an Excel file.

### Exporting Sales Report

Select a date range and click **Export Sales Report** to download an Excel file of all invoices in that period.

---

## Settings

> 🔒 **ADMIN only.**

Navigate to **Settings** to configure your business profile.

### Business Information

| Field | Description |
|-------|-------------|
| Business Name | Appears on invoices and PDFs |
| Address | Printed on invoice PDFs |
| Phone | Contact number for invoices |
| Email | Business email on invoices |
| GST Number | Tax registration number |

### Invoice Settings

| Field | Description |
|-------|-------------|
| Invoice Prefix | Prefix for invoice numbers (e.g., `INV` → `INV-00001`) |
| Default Tax (%) | Pre-filled tax on new invoice lines |
| Currency | 3-letter code, e.g., `INR`, `USD` |
| Currency Symbol | Displayed on amounts, e.g., `₹`, `$` |
| Receipt Footer | Text at bottom of PDF invoices |

### Logo Upload

Click **Upload Logo** to upload your business logo. It will appear on generated PDFs.  
Accepted formats: JPEG, PNG, WebP. Max size: 5 MB.

---

## Role Permissions Reference

| Feature | STAFF | MANAGER | ADMIN |
|---------|-------|---------|-------|
| View Dashboard | ✅ | ✅ | ✅ |
| View/Create Customers | ✅ | ✅ | ✅ |
| Edit Customers | ✅ | ✅ | ✅ |
| Delete Customers | ❌ | ❌ | ✅ |
| View Products | ✅ | ✅ | ✅ |
| Create/Edit Products | ❌ | ✅ | ✅ |
| Delete Products | ❌ | ❌ | ✅ |
| Adjust Stock | ❌ | ✅ | ✅ |
| View/Create Invoices | ✅ | ✅ | ✅ |
| Cancel Invoices | ❌ | ✅ | ✅ |
| View/Create Repairs | ✅ | ✅ | ✅ |
| Update Repair Status | ✅ | ✅ | ✅ |
| Delete Repairs | ❌ | ❌ | ✅ |
| Record Payments | ❌ | ✅ | ✅ |
| Refund Payments | ❌ | ❌ | ✅ |
| View/Create Suppliers | ❌ | ✅ | ✅ |
| Delete Suppliers | ❌ | ❌ | ✅ |
| View Reports | ❌ | ✅ | ✅ |
| Import/Export Data | ❌ | ✅ | ✅ |
| Global Search | ✅ | ✅ | ✅ |
| Manage Settings | ❌ | ❌ | ✅ |
| Manage Users | ❌ | ❌ | ✅ |
| Upload Logo | ❌ | ❌ | ✅ |
