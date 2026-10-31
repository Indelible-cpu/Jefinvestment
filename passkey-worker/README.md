# MsikaFlo Biometric & Passkey Authentication Engine

This service implements an optional, secure WebAuthn / Passkey authentication layer for MsikaFlo. It allows staff members (Admin, Manager, Cashier) to log in using biometric verification (fingerprint, Face ID) or device screen lock (PIN, pattern) on supported devices.

Password authentication and offline login capabilities remain fully intact and operational as fallbacks.

---

## Architecture Overview

```
                      ┌───────────────────────────────────────────────┐
                      │              Client Browser / App             │
                      │       (Admin / Manager / Cashier Staff)       │
                      └──────────────┬──────────────────┬─────────────┘
                                     │                  │
                1. WebAuthn Options  │                  │  6. Custom Token
                   & Verification    │                  │     Exchange
                                     ▼                  ▼
                    ┌─────────────────────────┐   ┌───────────────────────────┐
                    │    Cloudflare Worker    │   │  Firebase Authentication  │
                    │   (msikaflo-passkeys)   │   │     (Identity Toolkit)    │
                    └───────────┬─────────────┘   └─────────────┬─────────────┘
                                │                               │
                     2. D1 SQL  │                               │ 7. Issue Session
                        Lookup  │                               │    & ID Token
                                ▼                               ▼
                    ┌─────────────────────────┐   ┌───────────────────────────┐
                    │      Cloudflare D1      │   │     Firebase Firestore    │
                    │   (msikaflo-passkeys)   │   │  (users collection doc)   │
                    └─────────────────────────┘   └───────────────────────────┘
```

1. **Client Browser / PWA**:
   - Initiates passkey registration from `Settings > Security` (authenticated state).
   - Initiates passkey authentication from `Login.tsx` (unauthenticated state).
   - Interacts with device platform authenticators via standard W3C WebAuthn APIs (`navigator.credentials.create` and `navigator.credentials.get`).
2. **Dedicated Cloudflare Worker (`msikaflo-passkeys`)**:
   - Edge-computed authentication endpoints with `@simplewebauthn/server` and `jose`.
   - Built-in in-memory rate limiting to protect D1 write quotas and prevent brute force attacks.
   - Origin and RP ID dynamic detection supporting production and isolated local/staging environments.
   - Signs standard Firebase Custom Tokens via JWT using the dedicated Firebase service account.
3. **Dedicated Cloudflare D1 Database (`msikaflo-passkeys`)**:
   - Relational storage for public credentials (`passkeys` table) and short-lived challenges (`challenges` table).
   - Never stores biometrics, raw private keys, or passwords.
4. **Firebase Integration**:
   - Verifies user account status (`isActive`, `isSuspended`) against Firestore `users/{uid}` before token generation.
   - Exchanges custom token with `signInWithCustomToken()`, preserving existing roles, Firestore rules, and session state.

---

## Directory Structure

```
.
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx              # Passkey login option alongside password
│   │   │   └── Settings.tsx           # Passkey management under Security section
│   │   ├── store/
│   │   │   └── authStore.ts           # passkeyLogin() action, status checks & role sync
│   │   └── utils/
│   │       └── passkeys.ts            # Client WebAuthn helper & API connector
│   └── package.json
├── passkey-worker/
│   ├── src/
│   │   └── index.ts                   # Worker endpoints, rate limiter & WebAuthn logic
│   ├── migrations/
│   │   └── 0001_initial.sql           # D1 database schema
│   ├── test-worker.mjs                # Automated unit and security test suite
│   ├── package.json                   # Worker dependencies and npm scripts
│   ├── tsconfig.json                  # Strict TypeScript configuration
│   └── wrangler.jsonc                 # Worker configuration & D1 binding
└── .github/workflows/
    └── passkey-feature-check.yml      # CI check for build, typecheck, and tests
```

---

## Security Specifications

1. **Challenge Lifecycle & Expiration**:
   - Challenges are cryptographically random UUIDs generated with `crypto.randomUUID()`.
   - Valid for maximum 5 minutes (`now() - 300`).
   - Consumed atomically using `DELETE ... RETURNING` to enforce single-use and prevent race conditions.
   - Expired challenges are automatically pruned from D1 during challenge creation.
2. **Rate Limiting & Abuse Prevention**:
   - In-memory token bucket rate limiting at the edge protects D1 database quotas.
   - `/v1/auth/options`: Limited to 20 requests/minute per client IP, and 5 requests/minute per email.
   - `/v1/auth/verify`: Limited to 15 verification attempts/minute per IP.
   - `/v1/register/options`: Limited to 10 requests/minute per authenticated user.
3. **Origin & RP ID Enforcement**:
   - Strict CORS: Only authorized origins receive CORS headers.
   - Untrusted origins are rejected immediately with HTTP 403 `{"error":"Origin not allowed."}`.
   - Dynamic WebAuthn RP resolution:
     - Local dev (`localhost`, `127.0.0.1`) uses `rpId: 'localhost'`.
     - Production uses `rpId: 'jefinvestment-e1fc1.web.app'`.
4. **Account Status Verification**:
   - Before issuing custom tokens, Firestore is queried to confirm `isActive !== false` and `isSuspended !== true`.
   - Deactivated or suspended accounts are rejected with HTTP 403.
5. **No Biometric Data Transmission**:
   - Biometric authentication (fingerprint/face) occurs entirely within the device's Secure Enclave / TEE.
   - Only standard public cryptographic signatures and public keys are transmitted.

---

## Free-Plan Compatibility

* **Cloudflare Free Plan**:
  - Worker execution: Free up to 100,000 requests/day.
  - D1 database: Free up to 5,000,000 reads/day and 100,000 writes/day.
  - In-memory rate limiting stops volumetric floods before hitting D1 writes.
* **Firebase Spark Plan (Free)**:
  - Custom token generation is performed via local cryptographic RSA-SHA256 signing inside the Worker using `jose` without hitting paid APIs.
  - `signInWithCustomToken()` on the client is completely free on the Firebase Spark tier.
  - Firestore reads for user verification use standard free document read allowances.

---

## Build, Test, and Verification Commands

### Passkey Worker
```sh
cd passkey-worker

# Run automated unit & security test suite (7 tests)
npm test

# Run strict TypeScript typecheck
npm run typecheck
```

### Frontend Application
```sh
cd frontend

# Verify full production build
npm run build
```

---

## Staging & Local Testing Instructions

1. Start the Worker locally:
   ```sh
   cd passkey-worker
   npx wrangler dev
   ```
2. Start the Frontend locally:
   ```sh
   cd frontend
   npm run dev
   ```
   Set `VITE_PASSKEY_API_URL=http://localhost:8787` in your local `.env.local`.
3. Open `http://localhost:5173`:
   - Sign in with existing password.
   - Navigate to **Settings > Security**.
   - Click **Add this device** to register your passkey / fingerprint.
   - Sign out, and test signing in using **Sign in with Passkey / Biometrics**.

---

## Rollback Procedures

If any issue arises:
1. **Instant Client-Side Killswitch**:
   - Set `VITE_PASSKEY_API_URL=""` (empty) in the frontend environment.
   - The frontend automatically disables the passkey UI, hiding the button on the login screen and showing an informative fallback notice in Settings. Password authentication remains 100% functional.
2. **Worker Rollback**:
   - Cloudflare Workers dashboard allows instant 1-click rollback to any previous deployment version.
3. **Database Integrity**:
   - The D1 database is completely isolated. Even if dropped or cleared, the core MsikaFlo Firestore database and user passwords are unaffected.
