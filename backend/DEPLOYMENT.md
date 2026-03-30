# Paropakar VendorNet Deployment (Production Baseline)

## Required environment variables
Create a `.env` file next to `server.ts` (copy from `.env.example`):

- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: secret used to sign/verify JWTs
- `PORT`: API port (default `5000`)
- `CLIENT_ORIGINS`: comma-separated list of allowed frontend origins for CORS

## Start the backend
From `backend/`:

```bash
npm install
npm run build
npm run start
```

## Bootstrap the initial admin account
This project includes a temporary bootstrap endpoint to create the first admin:

- `GET /api/auth/bootstrap-admin`

It returns a default admin email and password:

- `admin@paropakar.org` / `Admin@123`

## Core API contracts (used by the current frontend)

Auth:
- `POST /api/auth/login`
- `POST /api/auth/register`

Vendors:
- `POST /api/v1/vendor/register` (vendor creates/updates their vendor profile; starts as `pending`)
- `GET  /api/v1/vendor/:id`
- `PUT  /api/v1/vendor/:id/approve` (admin)
- `PUT  /api/v1/vendor/:id/reject` (admin)
- `GET  /api/v1/vendor/me`

Admin vendor approvals widget:
- `GET  /api/admin/vendors?status=pending|verified|approved`
- `PATCH /api/admin/vendors/:id/verify` (expects `{ isVerified: true|false }`)

Tenders & bids:
- `GET  /api/v1/tenders`
- `POST /api/v1/tenders` (procurement officer/admin)
- `PATCH /api/v1/tenders/:id/publish`
- `PATCH /api/v1/tenders/:id/close`
- `GET  /api/v1/bids/my`
- `POST /api/v1/bids` (vendor)
- `PATCH /api/v1/bids/:id/accept` / `PATCH /api/v1/bids/:id/reject`

Notifications:
- `GET  /api/v1/notifications` returns `{ notifications, unreadCount }`
- `PATCH /api/v1/notifications/:id/read`
- `PATCH /api/v1/notifications/read-all`

Audit logs:
- `GET /api/v1/audit-log/my` (authenticated user)
- `GET /api/v1/audit-log` (admin; optional filters)
- `GET /api/v1/audit-log/stats` (admin)

Reports:
- `GET /api/v1/reports/summary`
- `GET /api/v1/reports/tenders-per-month`
- `GET /api/v1/reports/vendor-participation`

## Migration notes (legacy JS -> unified TypeScript)
This repo now uses TypeScript models/collections for the core VendorNet system:

1. `Vendor` schema was aligned to match the legacy `vendors` fields used by the current UI.
2. `Tender`, `Bid`, and `Notification` are stored in the unified TypeScript collections.
3. Legacy `User` data differs in field names. For full migrations, you should:
   - create new TS `User` documents (hash passwords again or migrate hashes),
   - map legacy `vendorProfile` links by linking the TS `User` to the correct `Vendor` `_id`,
   - verify role mappings:
     - `admin` -> `ADMIN`
     - `staff` -> `PROCUREMENT_OFFICER`
     - `vendor` -> `VENDOR`

For a production-grade migration, implement a dedicated one-time migration script and run it in staging first.

## One-time user migration script

If you already have legacy users created via the JS backend auth (fields like `fullname` and role values `admin|staff|vendor`),
run:

```bash
cd backend
node scripts/migrate-legacy-users-to-ts.js --dry-run
node scripts/migrate-legacy-users-to-ts.js
```

This updates the existing `users` collection in-place:
- sets `name` from `fullname`
- maps `role` to `ADMIN|PROCUREMENT_OFFICER|VENDOR`
- lowercases `email`
- ensures `isActive` exists

## Security checklist (recommended next steps)
- Add input validation (e.g. Zod / express-validator) for all request bodies.
- Add `helmet` + strict security headers.
- Implement refresh tokens / token revocation (blacklist or rotating JWTs).
- Move file uploads (logo/documents) to object storage (S3/R2) instead of in-memory/base64 for large files.
- Add audit logging for all admin actions (vendor verify, bid accept/reject, tender publish/close).

