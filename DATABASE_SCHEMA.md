# Database Schema Documentation — Firestore Collections

The **Jef Investment ERP** uses Google Cloud Firestore as a real-time NoSQL document database. Below are the core collections, field definitions, and subcollection structures.

---

## 1. `users` (Collection)
Stores user accounts and permissions.
- **Document ID:** Firebase Auth UID
- **Fields:**
  - `username` (string): User email address.
  - `name` (string): Full display name.
  - `role` (string): `'ADMIN'` | `'MANAGER'` | `'CASHIER'`
  - `branchId` (string | null): Assigned branch ID.
  - `branchName` (string, optional): Branch name.
  - `profilePic` (string, optional): Profile image URL.
  - `isActive` (boolean): Account status.

### Subcollection: `users/{userId}/heldCarts`
Stores held POS carts for cross-device synchronization.
- `id` (string): Cart ID.
- `customerName` (string): Customer reference.
- `items` (array): Array of cart items.
- `timestamp` (number): Creation timestamp.

---

## 2. `products` (Collection)
Inventory goods and services catalog.
- **Document ID:** Product ID (auto-generated)
- **Fields:**
  - `name` (string): Product name.
  - `sku` (string): Stock Keeping Unit code.
  - `category` (string): Product category name.
  - `costPrice` (number): Wholesale / purchase cost.
  - `sellingPrice` (number): Retail selling price.
  - `stock` (number): Current quantity available.
  - `reorderLevel` (number): Minimum stock alert threshold.
  - `isService` (boolean): `true` if non-physical service (prevents stock deduction).
  - `unit` (string): Measurement unit (e.g. `'pcs'`, `'reams'`, `'box'`).

---

## 3. `sales` (Collection)
Logs all completed transactions, cash sales, mobile money payments, and credit orders.
- **Document ID:** Sale ID (auto-generated)
- **Fields:**
  - `invoiceNumber` (string): Unique invoice code.
  - `createdAt` (number): Unix timestamp.
  - `date` (string): `YYYY-MM-DD`
  - `cashier` (string): Cashier display name.
  - `items` (array): List of purchased items with pricing.
  - `subtotal` (number): Subtotal amount.
  - `discount` (number): Applied discount.
  - `total` (number): Grand total.
  - `paymentMethod` (string): `'CASH'` | `'AIRTEL_MONEY'` | `'MPAMBA'` | `'NBS_BANK'` | `'NBM_BANK'` | `'CREDIT'`
  - `customerName` (string, optional): Customer name for credit sales.
  - `customerPhone` (string, optional): Customer phone.
  - `isCredit` (boolean): `true` if customer credit balance created.
  - `creditPaid` (number, optional): Amount repaid toward credit.
  - `dueDate` (string, optional): Credit repayment due date.
  - `status` (string): `'completed'` | `'returned'` | `'voided'`

---

## 4. `expenses` (Collection)
Tracks operational company expenses.
- **Document ID:** Expense ID
- **Fields:**
  - `category` (string): `'Rent'` | `'Utilities'` | `'Fuel'` | `'Transport'` | etc.
  - `description` (string): Expense details.
  - `amount` (number): Total cost.
  - `loggedBy` (string): User who recorded the expense.
  - `date` (string): `YYYY-MM-DD`
  - `createdAt` (number): Timestamp.

---

## 5. `stationeryServices` (Collection)
Defines unit-costing parameters for stationery and print shop tasks.
- **Document ID:** Service ID
- **Fields:**
  - `serviceName` (string): Service title (e.g. A4 Binding).
  - `sellingPrice` (number): Price charged to customer.
  - `laborCost` (number): Labor expense per unit.
  - `electricityCost` (number): Power overhead per unit.
  - `otherOverheadCost` (number): Miscellaneous overhead.
  - `materialsUsed` (array): List of `{ productId, quantityUsed }` raw materials deducted from inventory.

---

## 6. `employees` (Collection)
Staff directory and payroll tracking.
- **Document ID:** Employee ID
- **Fields:**
  - `firstName` (string): First name.
  - `lastName` (string): Last name.
  - `phone` (string): Contact phone.
  - `email` (string, optional): Email address.
  - `role` (string): Job title.
  - `salary` (number): Monthly salary.
  - `status` (string): `'PRESENT'` | `'ABSENT'` | `'LEAVE'`.
  - `advancePay` (number): Total advance payments issued.
  - `photoUrl` (string, optional): Firebase Storage URL for employee portrait image.
  - `idCardUrl` (string, optional): Firebase Storage URL for employee National ID card / passport scan.
  - `idNumber` (string, optional): National ID / NIN / Passport number.
  - `nextOfKinName` (string, optional): Name of primary emergency / next of kin contact.
  - `nextOfKinRelationship` (string, optional): Relationship (Spouse, Parent, Sibling, Child, etc.).
  - `nextOfKinPhone` (string, optional): Contact phone number of next of kin.
  - `nextOfKinAddress` (string, optional): Address or notes for next of kin.
  - `address` (string, optional): Employee residential address.
  - `dateOfBirth` (string, optional): Date of birth (YYYY-MM-DD).
  - `dateJoined` (string, optional): Date joined (YYYY-MM-DD).
  - `branchId` (string, optional): Branch identifier.
  - `createdAt` (number): Creation timestamp.

---

## 7. `settings` (Document: `settings/global`)
Global ERP configuration.
- **Fields:**
  - `companyName` (string): Business title.
  - `address` (string): Physical location.
  - `phone` (string): Contact phone.
  - `email` (string): Business email.
  - `taxNumber` (string): TPIN code.
  - `currency` (string): Currency code (`MWK`).
  - `airtelNumber`, `mpambaNumber`, `nbsDetails`, `nbmDetails` (string): Payment account info.
  - `autoLockEnabled` (boolean), `workTimeStart`, `workTimeEnd`, `idleLockMinutes` (number): Security lock configurations.

---

## 8. `auditLogs` (Collection)
System audit trail.
- **Fields:**
  - `action` (string): Operation name.
  - `details` (string): Operation metadata.
  - `user` (string): User name.
  - `timestamp` (number): Unix timestamp.
