# Database Schema — Firestore Collections

**MsikaFlo** uses Google Cloud Firestore as its real-time NoSQL document database. All data is organised into the collections and subcollections listed below.

> **Jurisdiction:** Republic of Malawi  
> **Developer:** Indelible Technologies — [indelibletechnologiesmw@gmail.com](mailto:indelibletechnologiesmw@gmail.com)  
> **Last updated:** 13 October 2026

---

## 1. `users` (Collection)

Stores user accounts, roles, and branch assignments.

- **Document ID:** Firebase Authentication UID
- **Fields:**

| Field | Type | Description |
|---|---|---|
| `username` | string | User email address (login identifier) |
| `name` | string | Full display name |
| `role` | string | `'ADMIN'` \| `'MANAGER'` \| `'CASHIER'` |
| `branchId` | string \| null | Assigned branch document ID |
| `branchName` | string _(optional)_ | Branch display name (denormalised) |
| `profilePic` | string _(optional)_ | Firebase Storage URL for profile photo |
| `isActive` | boolean | Account active status |
| `createdAt` | number | Unix timestamp of account creation |

### Subcollection: `users/{userId}/heldCarts`

Held POS carts — cross-device synchronisation of paused transactions.

| Field | Type | Description |
|---|---|---|
| `id` | string | Cart document ID |
| `customerName` | string | Customer label for the held cart |
| `items` | array | Array of `{ productId, name, qty, price, total }` |
| `timestamp` | number | Creation timestamp |

---

## 2. `products` (Collection)

Inventory goods and services catalogue.

- **Document ID:** Auto-generated product ID
- **Fields:**

| Field | Type | Description |
|---|---|---|
| `name` | string | Product name |
| `sku` | string | Stock Keeping Unit code |
| `category` | string | Product category |
| `costPrice` | number | Wholesale / purchase cost |
| `sellingPrice` | number | Retail selling price |
| `stock` | number | Current stock quantity |
| `reorderLevel` | number | Low-stock alert threshold |
| `isService` | boolean | `true` = non-physical service (no stock deduction) |
| `unit` | string | Measurement unit (e.g. `'pcs'`, `'box'`, `'reams'`) |
| `imageUrl` | string _(optional)_ | Firebase Storage URL for product photo |
| `barcode` | string _(optional)_ | Barcode value for scanner lookup |

---

## 3. `sales` (Collection)

Logs every completed transaction — cash, mobile money, bank, and credit.

| Field | Type | Description |
|---|---|---|
| `invoiceNumber` | string | Unique invoice code |
| `createdAt` | number | Unix timestamp |
| `date` | string | `YYYY-MM-DD` |
| `cashier` | string | Cashier display name |
| `branchId` | string _(optional)_ | Source branch ID |
| `branchName` | string _(optional)_ | Source branch name |
| `items` | array | `{ productId, name, qty, price, discount, total }` |
| `subtotal` | number | Pre-discount subtotal |
| `discount` | number | Applied discount amount |
| `total` | number | Grand total |
| `paymentMethod` | string | `'CASH'` \| `'AIRTEL_MONEY'` \| `'MPAMBA'` \| `'NBS_BANK'` \| `'NBM_BANK'` \| `'CREDIT'` |
| `customerName` | string _(optional)_ | Customer name for credit sales |
| `customerPhone` | string _(optional)_ | Customer phone number |
| `isCredit` | boolean | `true` if a credit balance was created |
| `creditPaid` | number _(optional)_ | Amount repaid against outstanding credit |
| `dueDate` | string _(optional)_ | Credit repayment due date (`YYYY-MM-DD`) |
| `status` | string | `'completed'` \| `'returned'` \| `'voided'` |

---

## 4. `expenses` (Collection)

Tracks operational business expenses.

| Field | Type | Description |
|---|---|---|
| `category` | string | `'Rent'` \| `'Utilities'` \| `'Fuel'` \| `'Transport'` \| `'Other'` |
| `description` | string | Expense details |
| `amount` | number | Total cost (MWK) |
| `loggedBy` | string | User who recorded the expense |
| `branchId` | string _(optional)_ | Branch this expense belongs to |
| `date` | string | `YYYY-MM-DD` |
| `createdAt` | number | Unix timestamp |

---

## 5. `stationeryServices` (Collection)

Defines unit-costing parameters for print shop and stationery services.

| Field | Type | Description |
|---|---|---|
| `serviceName` | string | Service title (e.g. `'A4 Binding'`) |
| `sellingPrice` | number | Price charged to customer (MWK) |
| `laborCost` | number | Labor overhead per unit |
| `electricityCost` | number | Power overhead per unit |
| `otherOverheadCost` | number | Miscellaneous overhead |
| `materialsUsed` | array | `{ productId, quantityUsed }` — raw materials deducted from inventory |

---

## 6. `employees` (Collection)

Staff directory, payroll, and HR records.

| Field | Type | Description |
|---|---|---|
| `firstName` | string | First name |
| `lastName` | string | Last name |
| `phone` | string | Contact phone |
| `email` | string _(optional)_ | Email address |
| `role` | string | Job title |
| `salary` | number | Monthly salary (MWK) |
| `status` | string | `'PRESENT'` \| `'ABSENT'` \| `'LEAVE'` |
| `advancePay` | number | Total advance payments issued |
| `photoUrl` | string _(optional)_ | Firebase Storage URL — employee portrait |
| `idCardUrl` | string _(optional)_ | Firebase Storage URL — National ID or passport scan |
| `idNumber` | string _(optional)_ | National ID / NIN / Passport number |
| `nextOfKinName` | string _(optional)_ | Next of kin full name |
| `nextOfKinRelationship` | string _(optional)_ | Relationship (Spouse, Parent, Sibling, Child…) |
| `nextOfKinPhone` | string _(optional)_ | Next of kin contact number |
| `nextOfKinAddress` | string _(optional)_ | Next of kin address or notes |
| `address` | string _(optional)_ | Employee residential address |
| `dateOfBirth` | string _(optional)_ | `YYYY-MM-DD` |
| `dateJoined` | string _(optional)_ | `YYYY-MM-DD` |
| `branchId` | string _(optional)_ | Assigned branch ID |
| `createdAt` | number | Unix creation timestamp |

### Subcollection: `employees/{employeeId}/payslips`

Monthly payslip records per employee.

| Field | Type | Description |
|---|---|---|
| `month` | string | `YYYY-MM` |
| `basicSalary` | number | Base salary for the period |
| `deductions` | number | Total deductions |
| `netPay` | number | Net salary issued |
| `issuedAt` | number | Unix timestamp of issue |
| `issuedBy` | string | Admin or Manager who issued the payslip |

---

## 7. `branches` (Collection)

Multi-branch business location registry.

| Field | Type | Description |
|---|---|---|
| `name` | string | Branch display name |
| `location` | string | Physical address or area |
| `phone` | string _(optional)_ | Branch contact number |
| `managerId` | string _(optional)_ | UID of the assigned manager |
| `isActive` | boolean | Branch operational status |
| `createdAt` | number | Unix creation timestamp |

---

## 8. `onlineOrders` (Collection)

Orders submitted by customers through the public Online Storefront (`/store`).

| Field | Type | Description |
|---|---|---|
| `customerName` | string | Customer full name |
| `customerPhone` | string | Contact phone number |
| `customerEmail` | string _(optional)_ | Customer email |
| `items` | array | `{ productId, name, qty, price, total }` |
| `subtotal` | number | Pre-discount subtotal |
| `discount` | number | Applied discount |
| `total` | number | Grand total (MWK) |
| `paymentMethod` | string | Preferred payment method |
| `status` | string | `'pending'` \| `'processing'` \| `'completed'` \| `'cancelled'` |
| `notes` | string _(optional)_ | Customer delivery notes |
| `createdAt` | number | Unix timestamp |

---

## 9. `passwordRequests` (Collection)

Admin-initiated password reset requests raised by users who cannot use self-service.

| Field | Type | Description |
|---|---|---|
| `userId` | string | UID of the requesting user |
| `userName` | string | Display name of the requesting user |
| `userEmail` | string | Email of the requesting user |
| `reason` | string | Brief explanation from the user |
| `status` | string | `'pending'` \| `'approved'` \| `'rejected'` |
| `requestedAt` | number | Unix timestamp of request |
| `resolvedAt` | number _(optional)_ | Unix timestamp of resolution |
| `resolvedBy` | string _(optional)_ | Admin who actioned the request |

---

## 10. `settings` (Document: `settings/global`)

Global system configuration.

| Field | Type | Description |
|---|---|---|
| `companyName` | string | Business trading name |
| `address` | string | Physical business address |
| `phone` | string | Business contact phone |
| `email` | string | Business contact email |
| `taxNumber` | string | TPIN / tax registration number |
| `currency` | string | Currency code (`'MWK'`) |
| `airtelNumber` | string | Airtel Money payment number |
| `mpambaNumber` | string | Mpamba payment number |
| `nbsDetails` | string | NBS Bank account details |
| `nbmDetails` | string | NBM Bank account details |
| `autoLockEnabled` | boolean | Auto screen-lock feature toggle |
| `workTimeStart` | string | Auto-lock work start time |
| `workTimeEnd` | string | Auto-lock work end time |
| `idleLockMinutes` | number | Minutes of inactivity before lock |

---

## 11. `auditLogs` (Collection)

System-wide audit trail for critical operations.

| Field | Type | Description |
|---|---|---|
| `action` | string | Operation name (e.g. `'VOID_SALE'`, `'DELETE_PRODUCT'`) |
| `details` | string | Operation metadata and context |
| `user` | string | Display name of the user who performed the action |
| `userId` | string _(optional)_ | UID of the acting user |
| `timestamp` | number | Unix timestamp |

---

## Firestore Security Model

All collections are protected by Firestore Security Rules (`firestore.rules`):

- **Unauthenticated users** — read/write denied for all collections except `onlineOrders` (write-only, for storefront submissions).
- **CASHIER role** — read products, write sales and held carts.
- **MANAGER role** — all Cashier permissions plus expenses, employees read, and reports.
- **ADMIN role** — full read/write access to all collections including user management, settings, and branch management.
- **`users` collection** — users can read their own document only; Admins read all.
