# Security Features & Policies — MsikaFlo

The **MsikaFlo** platform enforces a strict, multi-layered security posture across authentication, authorization, offline credential protection, database rules, and audit logging.

Built and maintained by **Indelible Technologies**.

> **Developer:** Indelible Technologies — [indelibletechnologiesmw@gmail.com](mailto:indelibletechnologiesmw@gmail.com)  
> **Jurisdiction:** Republic of Malawi  
> **Last updated:** 13 October 2026

---

## 1. Authentication & Persistence Security

- **Firebase Authentication:** Secure token-based authentication. All passwords are handled exclusively by Firebase Auth infrastructure — no plain-text passwords are ever stored in the application or Firestore.
- **Login Persistence Control:**
  - When **Remember Me** is checked: `browserLocalPersistence` is set — the user email is stored locally, and the Firebase session survives browser restarts.
  - When **Remember Me** is **unchecked**: `browserSessionPersistence` is set — the session ends when the browser closes. All input fields are explicitly cleared and browser autofill (`autoComplete="off"`) is enforced for maximum privacy on shared devices.
- **Listener Cleanup on Logout:**
  Logging out executes `unsubscribeAllListeners()`, terminating all active Firestore `onSnapshot` connections *before* revoking auth tokens. This prevents unauthenticated network listener leaks or console error floods on shared workstations.

---

## 2. Offline Credential Caching (Secure)

MsikaFlo supports full login functionality even when the device has no internet connection:

- **SHA-256 Password Hashing:** Passwords are salted and hashed using `crypto.subtle.digest('SHA-256')` with a static application salt before being stored in `localStorage` under the key `jef-offline-credential-cache`.
- **No Plain-Text Storage:** The raw password is **never** written to disk. Only the hash is stored.
- **Match-Only Verification:** On login, the entered password is hashed and compared to the stored hash. If they match, the cached user profile is loaded.
- **Cache Invalidation:** When a password is changed via the admin-initiated password reset flow, `refreshOfflineCachePassword()` updates the stored hash immediately so offline logins use the new password hash.

---

## 3. Self-Service Password Reset

- **Firebase Email Recovery:** Users who have forgotten their password can enter their email on the login screen and tap **Forgot password?** to receive a Firebase-generated password reset link by email.
- **Admin-Initiated Password Reset:** Authenticated **Admins** can also issue direct password resets for any staff member from **Settings → User Management** without requiring the user to have access to their email.
- **Password Change Requests:** Users can submit a formal password change request from the **Change Password** page. An Admin must approve the request from Settings before Firebase applies the new password.

---

## 4. Role-Based Access Control (RBAC)

Access is strictly governed by user roles (`ADMIN`, `MANAGER`, `CASHIER`):

- **CASHIER:** Restricted to Point of Sale (POS) operations, viewing the product catalog, and decrementing stock during an active sale. Cannot access financial reports, employee records, branch data, or system settings.
- **MANAGER:** Can manage inventory, view sales reports, manage employee attendance, and process expenses.
- **ADMIN:** Full access to all modules — financial ledgers, system configuration, user creation, password resets, branch management, online orders, push notification management, and real-time audit logs.

---

## 5. Firestore Security Rules (`firestore.rules`)

- All collection reads and writes require `request.auth != null`.
- `userRole()` helper verifies user role securely against `/databases/$(database)/documents/users/$(request.auth.uid)`.
- Cashiers are restricted from modifying product details, only allowed to apply `increment(-qty)` during a valid sale.
- A global fallback rule `match /{document=**} { allow read, write: if false; }` blocks any unauthorized access to undeclared paths.

---

## 6. Audit Trails (`auditLogs`)

- Critical administrative actions (user additions, role changes, password resets, sales returns, setting modifications, employee record changes) create immutable entries in the `auditLogs` Firestore collection.
- Each log entry captures:
  - `action` — Operation name.
  - `details` — Full operation metadata.
  - `user` — Logged-in user name.
  - `timestamp` — Exact Unix millisecond timestamp.
- The most recent 100 audit log entries are visible to Admins in real time from the **Settings → Audit Logs** panel.

---

## 7. PWA System Security

- **Transparent Status Bar:** The MsikaFlo PWA uses `viewport-fit=cover` and `apple-mobile-web-app-status-bar-style: black-translucent` to extend the dark cosmic UI behind the Android/iOS status bar without exposing system UI elements inappropriately.
- **Safe Area Insets:** Login interactive elements are protected by CSS `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` padding, ensuring content is never obscured by system bars.
- **Asset Integrity:** All static assets are precached by the Workbox PWA service worker and served from the local CacheStorage, eliminating network-related supply chain risks on each load.
