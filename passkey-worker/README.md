# MsikaFlo Passkey Worker (isolated feature branch)

This service is intentionally separate from Firebase Hosting and the existing MsikaFlo application backend. It stores WebAuthn public credentials and short-lived challenges in Cloudflare D1. It does not store fingerprints, face data, device PINs, Firebase passwords, or private passkey material.

## Current status

- WebAuthn registration and authentication API routes are implemented in this branch.
- Firebase ID tokens are required to register, list, or remove credentials.
- Account active/suspended state is checked against Firestore before registration and again before issuing a Firebase custom token.
- Authentication challenges expire after five minutes and are consumed once.
- The RP ID and origin are exact-match configuration values.
- The React login and Settings UI are not connected yet.
- This service has not been deployed or tested against the live Firebase project.

Do not deploy until the verification checklist below has passed.

## Required Cloudflare resources

Create a D1 database named `msikaflo-passkeys`, then update `database_id` in `wrangler.jsonc` with its actual ID. Apply the schema:

```sh
npx wrangler d1 migrations apply msikaflo-passkeys --remote
```

Configure the following Worker secret in Cloudflare (never commit it or paste it into chat):

- `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete service-account JSON for the Firebase project `jefinvestment-e1fc1`. Use a dedicated service account with only the permissions needed to read the `users` documents and mint Firebase custom tokens. Keep the key private and rotate it if it is ever exposed.

The non-secret Worker variables are in `wrangler.jsonc`:
- `RP_ID`: `jefinvestment-e1fc1.web.app`
- `EXPECTED_ORIGIN`: `https://jefinvestment-e1fc1.web.app`
- `FIREBASE_PROJECT_ID`: `jefinvestment-e1fc1`

## Local development

Use local-only overrides in `.dev.vars` (ignored by Git) and a local D1 database. For local browser testing, set `RP_ID=localhost` and `EXPECTED_ORIGIN=http://localhost:5173`; never reuse those values for production. A WebAuthn RP ID must match the browser origin's host rules.

```sh
npm install
npx wrangler d1 migrations apply msikaflo-passkeys --local
npm run dev
```

## API

All JSON endpoints are under `/v1`.

- `POST /register/options` — Firebase ID token required.
- `POST /register/verify` — Firebase ID token required; body: `{ "challengeId": "...", "credential": {...}, "deviceName": "..." }`.
- `POST /auth/options` — body: `{ "email": "staff@example.com" }`.
- `POST /auth/verify` — body: `{ "challengeId": "...", "credential": {...} }`; returns a Firebase custom token only after WebAuthn verification and an active-account check.
- `GET /credentials` — Firebase ID token required.
- `DELETE /credentials/:credentialId` — Firebase ID token required; only the owner can remove a credential.

The browser client must exchange the returned custom token with Firebase Auth's `signInWithCustomToken()`, then load the existing Firestore profile and apply the same role/session logic as password login.

## Security review required before deployment

1. Test with separate Admin, Manager, and Cashier accounts, including inactive and suspended accounts.
2. Test registration, repeated registration, invalid challenge, expired challenge, replay, wrong origin, wrong RP ID, unknown credential, and counter update.
3. Verify the service account has least privilege and is stored only as a Cloudflare secret.
4. Add request throttling at the edge for authentication options and verification; do not expose detailed account lookup results publicly in the final UI.
5. Test on Android Chrome and supported desktop browsers; confirm passkey availability is feature-detected.
6. Confirm password login and offline fallback are unchanged.
7. Only then connect the React UI and consider a separate staging deployment. Do not merge or deploy production without explicit approval.

## Important operational notes

- Existing Firebase Hosting, Firestore rules, Firestore data, and shop operations are not modified by this Worker.
- A passkey is an additional login method, not a replacement for the existing password or offline flow.
- A passkey registered on one device may sync through the user's platform account depending on the authenticator. MsikaFlo never receives biometric templates.
- Removing a passkey removes only its public credential record from MsikaFlo; it does not delete the device's local passkey.
