# PHONEIX BUSINESS SUITE — REQUIREMENT & TASK TRACKER

## REQUIREMENT LIST

| REQ ID | Feature |
|--------|---------|
| REQ-001 | Authentication system |
| REQ-002 | Customer management |
| REQ-003 | Supplier management |
| REQ-004 | Inventory / Product tracking |
| REQ-005 | Invoice / Billing system |
| REQ-006 | Repair job management |
| REQ-007 | Payment tracking |
| REQ-008 | Reporting system |
| REQ-009 | Dashboard analytics |
| REQ-010 | Import / Export system |
| REQ-011 | PDF generator |
| REQ-012 | File upload system |
| REQ-013 | Global search |
| REQ-014 | Global settings |
| REQ-015 | Role-based access control |
| REQ-016 | Logging and monitoring |
| REQ-017 | Infrastructure setup |

---

## DEVELOPMENT TRACKER

| REQ ID | MODULE | TASK | STATUS |
|--------|--------|------|--------|
| REQ-001 | AUTH | User Prisma model | COMPLETED |
| REQ-001 | AUTH | bcrypt password hashing | COMPLETED |
| REQ-001 | AUTH | JWT token generation | COMPLETED |
| REQ-001 | AUTH | Login endpoint | COMPLETED |
| REQ-001 | AUTH | Auth middleware | COMPLETED |
| REQ-002 | CUSTOMER | Prisma model | COMPLETED |
| REQ-002 | CUSTOMER | CRUD API endpoints | COMPLETED |
| REQ-002 | CUSTOMER | Customer service layer | COMPLETED |
| REQ-002 | CUSTOMER | Purchase/repair history | COMPLETED |
| REQ-003 | SUPPLIER | Prisma model | COMPLETED |
| REQ-003 | SUPPLIER | CRUD API endpoints | COMPLETED |
| REQ-004 | INVENTORY | Product Prisma model | COMPLETED |
| REQ-004 | INVENTORY | StockMovement model | COMPLETED |
| REQ-004 | INVENTORY | CRUD API endpoints | COMPLETED |
| REQ-004 | INVENTORY | Low stock alerts | COMPLETED |
| REQ-004 | INVENTORY | Barcode support | COMPLETED |
| REQ-005 | INVOICE | Invoice/InvoiceItem models | COMPLETED |
| REQ-005 | INVOICE | CRUD API endpoints | COMPLETED |
| REQ-005 | INVOICE | Tax calculation logic | COMPLETED |
| REQ-005 | INVOICE | Stock reduction on sale | COMPLETED |
| REQ-006 | REPAIR | RepairJob/RepairPart models | COMPLETED |
| REQ-006 | REPAIR | CRUD API endpoints | COMPLETED |
| REQ-006 | REPAIR | Status workflow | COMPLETED |
| REQ-007 | PAYMENT | Payment model | COMPLETED |
| REQ-007 | PAYMENT | Payment endpoint | COMPLETED |
| REQ-007 | PAYMENT | Refund endpoint | COMPLETED |
| REQ-007 | PAYMENT | Invoice auto-status update | COMPLETED |
| REQ-008 | REPORTS | Sales reports endpoint | COMPLETED |
| REQ-008 | REPORTS | Inventory reports | COMPLETED |
| REQ-008 | REPORTS | Repair reports | COMPLETED |
| REQ-008 | REPORTS | Financial reports | COMPLETED |
| REQ-009 | DASHBOARD | Today sales widget | COMPLETED |
| REQ-009 | DASHBOARD | Monthly revenue widget | COMPLETED |
| REQ-009 | DASHBOARD | Active repairs widget | COMPLETED |
| REQ-009 | DASHBOARD | Low stock widget | COMPLETED |
| REQ-010 | IMPORT/EXPORT | CSV product import | COMPLETED |
| REQ-010 | IMPORT/EXPORT | Excel product export | COMPLETED |
| REQ-010 | IMPORT/EXPORT | Excel report export | COMPLETED |
| REQ-011 | PDF | Invoice PDF generation | COMPLETED |
| REQ-011 | PDF | Repair job card PDF | COMPLETED |
| REQ-011 | PDF | WhatsApp share endpoint | COMPLETED |
| REQ-012 | UPLOAD | Multer file upload | COMPLETED |
| REQ-012 | UPLOAD | Product image upload | COMPLETED |
| REQ-012 | UPLOAD | Logo upload | COMPLETED |
| REQ-013 | SEARCH | Global search endpoint | COMPLETED |
| REQ-014 | SETTINGS | Settings model | COMPLETED |
| REQ-014 | SETTINGS | Settings CRUD | COMPLETED |
| REQ-015 | RBAC | Role middleware | COMPLETED |
| REQ-015 | RBAC | Admin/Manager/Staff roles | COMPLETED |
| REQ-016 | LOGGING | Winston logger | COMPLETED |
| REQ-016 | LOGGING | Audit log model | COMPLETED |
| REQ-017 | INFRA | Dockerfile (backend) | COMPLETED |
| REQ-017 | INFRA | Dockerfile (frontend) | COMPLETED |
| REQ-017 | INFRA | docker-compose | COMPLETED |
| REQ-017 | INFRA | NGINX config | COMPLETED |
| REQ-017 | INFRA | GitHub Actions CI/CD | COMPLETED |
