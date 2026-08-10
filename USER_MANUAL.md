# User Manual — Jef Investment ERP

Welcome to the **Jef Investment ERP** official user guide. This system handles Point of Sale (POS), inventory management, stationery costing, staff management, financial tracking, and security controls across all company branches.

---

## Table of Contents
1. [Logging In & Security](#1-logging-in--security)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Point of Sale (POS)](#3-point-of-sale-pos)
4. [Stationery & Print Shop Services](#4-stationery--print-shop-services)
5. [Inventory & Stock Management](#5-inventory--stock-management)
6. [Expenses & Credit Management](#6-expenses--credit-management)
7. [Staff & HR Management](#7-staff--hr-management)
8. [Settings, Security & User Management](#8-settings-security--user-management)
9. [Offline Mode & Auto-Sync](#9-offline-mode--auto-sync)

---

## 1. Logging In & Security

### Logging In
1. Open the ERP web application on your desktop or mobile device.
2. Enter your registered **Email Address** and **Password**.
3. **Remember Me Option:**
   - **Checked:** Your email address is securely remembered in local browser storage for quick login next time.
   - **Unchecked:** All login credentials are removed upon logout. The input fields will be completely empty for maximum privacy and security on shared devices.
4. Click **Sign In**. Cashiers are automatically taken to the **POS**, while Managers and Admins land on the **Dashboard**.

### Forgot Password Policy
- For maximum security in an internal POS environment, client-side self-service password reset requests are disabled on the login screen.
- If an employee forgets their password, they must contact the **Admin**.
- The Admin can securely issue a password reset directly from **Settings → Security & Access Control → User Management**.

---

## 2. Dashboard Overview

The **Dashboard** provides real-time business metrics:
- **Today's Revenue & Sales:** Track total sales processed today.
- **Expenses & Net Profit:** Live calculation of daily expenses vs. income.
- **Pending Syncs Counter:** Displays any offline transactions queued for background sync.
- **Low Stock Alerts:** Highlights inventory items that have fallen below their reorder thresholds.
- **Quick Action Bar:** Fast shortcuts for New Sale, Add Product, Print Service, and Tech Service.

---

## 3. Point of Sale (POS)

### Processing a Sale
1. **Select Items:** Tap any product card or use the search bar to add items to the active cart.
2. **Adjust Quantities:** Use `+` or `-` buttons next to items in the cart panel.
3. **Apply Discounts:** Enter an item-specific discount or apply an overall cart discount percentage/amount.
4. **Payment Options:** Select the customer's payment method:
   - **Cash**
   - **Mobile Money:** Airtel Money / Mpamba (account details displayed on screen).
   - **Bank Transfer:** NBS Bank / National Bank of Malawi (NBM).
   - **Credit / Pay Later:** Logs the transaction as an outstanding credit balance assigned to the customer.
5. **Complete & Print:** Tap **Complete Sale**. A printable receipt is generated automatically.

### Held Carts
- If a customer needs to pause their order, tap **Hold Cart**.
- Held carts are synchronized across all devices and can be recalled at any POS counter.

---

## 4. Stationery & Print Shop Services

The Stationery module handles custom pricing for services like printing, photocopying, scanning, binding, and laminating:
- **Unit Costing:** Includes itemized calculations for labor, electricity, and overhead costs.
- **Material Tracking:** Automatically deducts raw paper or laminate stock from inventory when a stationery service is completed.
- **Standardized Pricing:** Ensures consistent pricing across all cashiers and branches.

---

## 5. Inventory & Stock Management

- **Product Catalog:** View all physical goods, SKUs, cost prices, selling prices, and current stock levels.
- **Stock Decrements:** Stock levels are automatically updated when sales are completed. Cashiers can only decrement stock during valid sales.
- **Reorder Warnings:** Products marked below reorder level appear with visual warnings to prompt restocking.
- **Service Items:** Non-physical services can be flagged as `isService` to prevent inventory deduction.

---

## 6. Expenses & Credit Management

### Logging Expenses
1. Navigate to **Expenses**.
2. Tap **Add Expense**, enter the Category (e.g. Utilities, Fuel, Transport, Rent), Description, Amount, and Payer.
3. Saved expenses immediately update the net profit calculations on the Dashboard.

### Credit Management & Repayments
- View all outstanding customer credit balances under **Credits**.
- When a customer makes a partial or full payment, tap **Record Repayment**, enter the amount paid, and the system automatically updates their balance and status (`PENDING`, `OVERDUE`, or `FULLY_PAID`).

---

## 7. Staff & HR Management

Accessible to Admins and Managers:
- **Employee Directory:** Track employee contact details, roles, and base salaries.
- **Attendance Status:** Mark employees as `PRESENT`, `ABSENT`, or `ON LEAVE`.
- **Salary Advance Tracking:** Log salary advances given to staff members and clear them when settled during payroll.

---

## 8. Settings, Security & User Management

Accessible to **Admins**:
- **Company Branding:** Update business name, address, phone, email, TPIN tax number, and payment account numbers (Airtel, Mpamba, NBS, NBM).
- **Security Controls:**
  - **Automatic System Lock:** Enable business-hours system lockouts.
  - **Idle System Lock:** Automatically lock the system after a specified period of inactivity (e.g., 10 minutes).
- **User Management:** Create new user accounts (Cashier, Manager, Admin), update roles, toggle active status, or issue password resets.
- **Audit Logs:** Full system audit trail tracking all critical actions, logins, deletions, and administrative changes with exact timestamps.

---

## 9. Offline Mode & Auto-Sync

- **Uninterrupted Operations:** If the internet connection drops, the POS remains 100% operational. Sales are safely stored locally in browser storage.
- **Auto-Sync:** As soon as connectivity is restored, all queued transactions automatically upload to the cloud database in the background.
- **Clean Logout:** Logging out automatically cleans up all active database listeners, preventing network errors or security leaks on shared computers.
