## Paropakar VendorNet

Paropakar VendorNet is a digital procurement and vendor management platform tailored for NGOs in Nepal. It helps make procurement transparent, organized, and efficient by connecting NGOs with registered vendors via a centralized web application.

### Tech Stack

- **Frontend**: React (Vite), TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript, JWT auth, RBAC
- **Database**: MongoDB (via Mongoose)

### High-Level Features

- **Authentication & RBAC**: JWT-based login with three roles:
  - **Administrator**
  - **Procurement Officer**
  - **Vendor**
- **Vendor Management**: Registration, profile management, document uploads (metadata), vendor directory.
- **Procurement & Tenders**: Procurement requests, tender publication, vendor quotations/bids, evaluation, and vendor selection.
- **Notifications**: System notifications for tender updates and decisions.
- **Dashboards**: Role-specific dashboards with KPIs and recent activity.
- **Reporting & Analytics**: Basic procurement reports and statistics.

### Project structure

- **`backend/`** – Express API. **Entry:** `backend/src/server.ts` (compiled to `dist/server.js`; `npm start` runs that). Run **`npm run seed`** after `cd backend` to create demo admin/officer users (see script output for passwords).
- **`frontend/`** – React SPA. **Entry:** `frontend/index.html` + `frontend/src/main.jsx`. **Vite config:** `frontend/vite.config.js` (dev proxy `/api` → backend `PORT` / `BACKEND_URL` from `backend/.env`).

From the repo root, run `npm install` once (installs `npm-run-all`), then `npm run dev` runs backend and frontend together. **`npm run verify`** builds both packages (same as CI).

**Deploy (e.g. Render):** use service root directory `backend` or `frontend` per service—the live API is under `backend/src/`. Optional: `backend/Dockerfile` for container hosts.

- **Production env templates:** `backend/.env.example`, `frontend/.env.production.example` (set `VITE_API_BASE_URL` before building the SPA if the API is on another domain).

### Deployment setup (Vercel + Render + MongoDB Atlas)

- Backend (Render):
  - Blueprint is included at `render.yaml` (root).
  - Service root directory is `backend`.
  - **Node.js:** use **20** (see `.nvmrc`, `engines` in `package.json` files, and `NODE_VERSION` in `render.yaml`). On a manually created service, add env var `NODE_VERSION=20`.
  - Build command: `npm install --include=dev && npm run build` (required when `NODE_ENV=production` so TypeScript and types install)
  - Start command: `npm run start`
  - Health check path: `/api/health`

- Frontend (Vercel):
  - Config is included at `frontend/vercel.json`.
  - Project root directory should be `frontend`.
  - Build output directory is `dist`.
  - SPA rewrite is configured (`/* -> /index.html`) so direct route refreshes work.

- Required environment variables:
  - Render backend:
    - `NODE_ENV=production`
    - `MONGO_URI=<atlas-uri>`
    - `JWT_SECRET=<long-random-secret>`
    - `CLIENT_ORIGINS=https://<your-vercel-domain>` (comma-separate every SPA URL you use, e.g. both `*.vercel.app` and a custom domain, or login fails with a “network” error)
    - `BACKEND_URL=https://<your-render-service>.onrender.com`
    - `FRONTEND_URL=https://<your-vercel-domain>`
  - Vercel frontend (add under Project → Settings → Environment Variables → **Production**):
    - `VITE_API_BASE_URL=https://<your-render-service>.onrender.com` (**required**; without it the app calls `/api` on Vercel and nothing responds). See `frontend/.env.production.example`.

- Atlas checklist:
  - Create DB user with password and use `mongodb+srv://...` in `MONGO_URI`.
  - Allow network access for Render (or temporarily `0.0.0.0/0` while testing).

- Optional payments (eSewa):
  - Set `ESEWA_MODE`, `ESEWA_PRODUCT_CODE`, and `ESEWA_SECRET_KEY` on Render.
  - Ensure callback URLs derive from public `BACKEND_URL`/`FRONTEND_URL`.

