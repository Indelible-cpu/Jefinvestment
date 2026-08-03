# Database Schema Documentation

The Jef Investment ERP database schema is built with Prisma ORM for PostgreSQL. Below is an overview of the core tables, relationships, and constraints.

## User & Access Control
- **User:** `id`, `username` (unique), `email` (unique), `passwordHash`, `roleId` (FK Role), `branchId` (FK Branch), `isActive`, `lastLogin`
- **Role:** `id`, `name` (unique), `description`
- **Permission:** `id`, `action` (unique), `description`
- **AuditLog:** `id`, `userId` (FK User), `action`, `entity`, `entityId`, `details`, `createdAt`

## Multi-Branch & Inventory
- **Branch:** `id`, `name` (unique), `address`, `phone`
- **ProductCategory:** `id`, `name` (unique), `description`
- **Product:** `id`, `name`, `categoryId` (FK ProductCategory), `sku` (unique), `barcode` (unique), `description`, `unit`, `costPrice`, `sellingPrice`, `reorderLevel`, `isService`
- **ProductBranch:** `id`, `productId` (FK Product), `branchId` (FK Branch), `quantity`
- **ProductVariant:** `id`, `productId` (FK Product), `name`, `skuSuffix`, `priceAdj`
- **InventoryTransaction:** `id`, `productId`, `branchId`, `type` ("IN", "OUT", "ADJUSTMENT", "TRANSFER"), `quantity`, `reference`, `notes`

## POS & Sales
- **Sale:** `id`, `invoiceNumber` (unique), `branchId` (FK Branch), `userId` (FK User), `customerName` (optional), `customerPhone` (optional), `subtotal`, `discount`, `total`, `status`, `syncId` (unique client ID for offline sync)
- **SaleItem:** `id`, `saleId` (FK Sale), `productId` (FK Product), `quantity`, `unitPrice`, `discount`, `subtotal`
- **Payment:** `id`, `saleId` (FK Sale), `method` ("CASH", "BANK_TRANSFER", "OTHER"), `amount`, `reference`

## Services (Stationery & Phone Tech Solutions)
- **ServiceCategory:** `id`, `name` (unique)
- **ServiceTransaction:** `id`, `categoryId` (FK ServiceCategory), `serviceName`, `quantity`, `unitPrice`, `total`, `operatorId` (FK User), `notes`, `syncId` (unique client ID)

## Expenses
- **ExpenseCategory:** `id`, `name` (unique)
- **Expense:** `id`, `categoryId` (FK ExpenseCategory), `amount`, `description`, `userId` (FK User), `branchId` (FK Branch), `status` ("PENDING", "APPROVED", "REJECTED"), `receiptUrl`, `syncId` (unique client ID)

## HR & Accounting
- **Employee:** `id`, `firstName`, `lastName`, `phone`, `role`, `salary`
- **Attendance:** `id`, `employeeId` (FK Employee), `date`, `status`
- **Account:** `id`, `code` (unique), `name`, `type` ("ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE")
- **JournalEntry:** `id`, `accountId` (FK Account), `date`, `description`, `debit`, `credit`, `reference`

## System & Sync
- **SyncQueue:** `id`, `clientId`, `operation`, `payload`, `status`, `errorMsg`
- **Settings:** `id`, `key` (unique), `value`
- **Notification:** `id`, `title`, `message`, `isRead`
