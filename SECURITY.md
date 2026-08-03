# Security Features

The Jef Investment ERP implements multiple layers of security to protect sensitive financial and personal data:

1. **Authentication:** 
   Uses JWT (JSON Web Tokens) with expirations. Passwords are cryptographically hashed using `bcrypt` with a 10-round salt.

2. **Authorization:** 
   Strict Role-Based Access Control (RBAC). A user must be explicitly granted the `Super Admin` or `Admin` role to access sensitive endpoints (like modifying inventory, viewing gross ledgers, or approving expenses).

3. **HTTP Security:** 
   The backend uses `helmet` to set secure HTTP headers, preventing clickjacking, sniffing, and other common web vulnerabilities.

4. **Data Validation:** 
   All incoming requests are strictly validated using `zod` to prevent injection attacks and ensure data integrity.

5. **Prisma ORM:** 
   Prisma automatically protects against SQL Injection by using prepared statements under the hood.

6. **Audit Trails:** 
   Critical actions (e.g., voiding sales, adjusting stock, modifying roles) log to an `AuditLog` table, tracking the exact user, action, and timestamp.
