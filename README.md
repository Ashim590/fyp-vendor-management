## Paropakar VendorNet

Paropakar VendorNet is a digital procurement and vendor management platform tailored for NGOs in Nepal. It helps make procurement transparent, organized, and efficient by connecting NGOs with registered vendors via a centralized web application.

### Tech Stack

- **Frontend**: React (Vite), TypeScript, Tailwind CSS
- **Backend**: Node.js, Express.js, TypeScript (optional JS), JWT auth, RBAC
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

### Project Structure

- `backend/` – Express API, MongoDB models, auth, RBAC, business logic.
- `frontend/` – React SPA with role-based routes, dashboards, and UI.

Detailed setup instructions will be added after the initial implementation.

