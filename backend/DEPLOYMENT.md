# Paropakar VendorNet Deployment (Production Baseline)

## Required environment variables
Create a `.env` file in `backend/` (copy from `.env.example`), or set the same keys in Render:

- `NODE_ENV`: use `production` when hosted
- `MONGO_URI`: MongoDB connection string (Atlas `mongodb+srv://...` in production)
- `JWT_SECRET`: secret used to sign/verify JWTs (**required** in production — process exits if unset)
- `CLIENT_ORIGINS`: comma-separated **exact** frontend origins (`https://your-app.vercel.app`). List every Vercel URL you use (production + alternate names); missing origins cause browser “Network Error” on login.
- `BACKEND_URL` / `FRONTEND_URL`: public base URLs (no trailing slash) for callbacks and redirects
- `PORT`: optional on Render (platform sets `PORT`); default `5000` locally

## Start the backend
From `backend/`:

```bash
npm install
npm run build
npm run start
```

**Render (or any host with `NODE_ENV=production` during install):** npm omits `devDependencies`, so `tsc` and `@types/*` are missing and `npm run build` fails. Use:

```bash
npm install --include=dev && npm run build
```

Set that as the **Build Command** in the Render dashboard if you are not using `render.yaml`.

## Optional: seed demo users (local / fresh DB)

```bash
cd backend
npm run seed
```

Creates `admin@paropakar.org` and `staff@paropakar.org` if missing (passwords printed in the console). For production, prefer controlled onboarding instead of default passwords.

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
- `GET  /api/v1/notifications` returns `{ notifications, unreadCount, unreadByType, nextCursor, hasMore }`
- `PATCH /api/v1/notifications/:id/read`
- `PATCH /api/v1/notifications/read-all`
- `DELETE /api/v1/notifications/:id` (dismiss for current user)

Audit logs:
- `GET /api/v1/audit-log/my` (authenticated user)
- `GET /api/v1/audit-log` (admin; optional filters)
- `GET /api/v1/audit-log/stats` (admin)

Reports:
- `GET /api/v1/reports/summary`
- `GET /api/v1/reports/tenders-per-month`
- `GET /api/v1/reports/vendor-participation`

## Migration notes (legacy JS → TypeScript)
The old duplicate Express app (`backend/index.js`, `controllers/`, `routes/*.js`, `models/*.js`, etc.) has been removed. The only API surface is **`backend/src/`** (built to `dist/`).

This repo uses TypeScript models/collections for the core VendorNet system:

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

