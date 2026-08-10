# Security Features & Policies

The **Jef Investment ERP** enforces a strict security posture across authentication, authorization, database rules, and audit logging.

---

## 1. Authentication & Persistence Security

- **Firebase Authentication:** Secure token-based authentication. Passwords are handled exclusively by Firebase Auth infrastructure.
- **Login Persistence Control:**
  - When **Remember me** is checked: Your email address is stored locally for convenience.
  - When **Remember me** is **unchecked**: No credentials are preserved in local storage. All input fields are explicitly cleared, and browser autofill (`autoComplete="off"`) is enforced.
- **Listener Cleanup on Logout:**
  Logging out executes `unsubscribeAllListeners()`, terminating all active Firestore `onSnapshot` connections *before* revoking auth tokens. This prevents unauthenticated network listener leaks or console error floods.

---

## 2. Password Reset Policy

- **Admin-Initiated Password Reset:** Self-service password resets from the public login screen are disabled.
- **Controlled Access:** Only authenticated **Admins** can issue password resets for staff members from the **Settings → User Management** panel.

---

## 3. Role-Based Access Control (RBAC)

Access is strictly governed by user roles (`ADMIN`, `MANAGER`, `CASHIER`):
- **CASHIER:** Restricted to Point of Sale (POS) operations, viewing products, and decrementing stock during an active sale. Cannot view financial reports, employee records, or system settings.
- **MANAGER:** Can manage inventory, view reports, manage employee attendance, and process expenses.
- **ADMIN:** Full access to all modules, financial ledgers, system configuration, user creation, password resets, and real-time audit logs.

---

## 4. Firestore Security Rules (`firestore.rules`)

- All collection reads and writes require `request.auth != null`.
- `userRole()` verifies user role against `/databases/$(database)/documents/users/$(request.auth.uid)` securely.
- Cashiers are restricted from modifying product details, allowing stock changes *only* via `increment(-qty)` during sales.
- Fallback rule: `match /{document=**} { allow read, write: if false; }` blocks any unauthorized endpoints.

---

## 5. Audit Trails (`auditLogs`)

- Critical administrative actions (user additions, role changes, password resets, sales returns, setting modifications) create immutable entries in the `auditLogs` collection.
- Logs capture the exact action, metadata, user name, and Unix timestamp.
