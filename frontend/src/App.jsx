import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import { useSelector } from "react-redux";
import AppShell from "./components/layout/AppShell";
import Login from "./components/auth/Login";
import Signup from "./components/auth/Signup";
import Unauthorized from "./components/auth/Unauthorized";

// Role-based Dashboard imports
import DashboardSelector from "./components/dashboard/Dashboards";
import AdminDashboard from "./components/admin/AdminDashboard";
import AdminUsers from "./components/admin/AdminUsers";
import AdminUserDetail from "./components/admin/AdminUserDetail";
import AdminBidsMonitor from "./components/admin/AdminBidsMonitor";

// VendorNet Components
import VendorList from "./components/vendor/VendorList";
import VendorDetails from "./components/vendor/VendorDetails";
import LandingPage from "./components/landing/LandingPage";
import PurchaseOrders from "./components/procurement/PurchaseOrders";
import Deliveries from "./components/procurement/Deliveries";
import Invoices from "./components/procurement/Invoices";
import PurchaseRequestList from "./components/procurement/PurchaseRequestList";
import PurchaseRequests from "./components/procurement/PurchaseRequests";
import PurchaseRequestDetails from "./components/procurement/PurchaseRequestDetails";
import Approvals from "./components/procurement/Approvals";
import TenderList from "./components/tenders/TenderList";
import CreateTender from "./components/tenders/CreateTender";
import TenderDetail from "./components/tenders/TenderDetail";
import MyBids from "./components/bids/MyBids";

import ProtectedRoute from "./components/admin/ProtectedRoute";
import Profile from "./components/Profile";
import NotificationsPage from "./components/notifications/NotificationsPage";
import VendorPayments from "./components/payment/VendorPayments";
import InvoiceEsewaReturn from "./components/payment/InvoiceEsewaReturn";
import ProcurementPayments from "./components/procurement/ProcurementPayments";

// ============================================
// Role-Based Route Configuration
// ============================================
// This configuration defines which roles can access which routes
// Each route can have: allowedRoles, or if not specified, all authenticated users can access

const ROUTE_ROLES = {
  // Public routes (no authentication required)
  "/login": { allowedRoles: null },
  "/signup": { allowedRoles: null },

  // Protected routes with role restrictions
  "/profile": { allowedRoles: ["admin", "staff", "vendor"] },
  "/notifications": { allowedRoles: ["admin", "staff", "vendor"] },

  // Admin only routes
  "/admin": { allowedRoles: ["admin"] },
  "/admin/users": { allowedRoles: ["admin"] },
  "/admin/users/:id": { allowedRoles: ["admin"] },

  // Vendor management - Admin only
  "/vendors": { allowedRoles: ["admin", "staff"] },
  "/vendors/:id": { allowedRoles: ["admin", "staff"] },
  // Purchase Orders - All roles can view, but different actions
  "/purchase-orders": { allowedRoles: ["admin", "staff", "vendor"] },

  // Deliveries - All roles
  "/deliveries": { allowedRoles: ["admin", "staff", "vendor"] },

  // Invoices - All roles
  "/invoices": { allowedRoles: ["admin", "staff", "vendor"] },
  "/my-payments": { allowedRoles: ["vendor"] },
  "/payments/esewa/success": { allowedRoles: ["admin", "staff", "vendor"] },
  "/payments/esewa/failure": { allowedRoles: ["admin", "staff", "vendor"] },
  "/procurement/payments": { allowedRoles: ["admin", "staff"] },

  // Tenders - Officer/Admin create & manage; Vendor view & bid
  "/tenders": { allowedRoles: ["admin", "staff", "vendor"] },
  "/tenders/create": { allowedRoles: ["admin", "staff"] },
  "/tenders/:id": { allowedRoles: ["admin", "staff", "vendor"] },
  "/bids-monitor": { allowedRoles: ["admin", "staff"] },
  "/my-bids": { allowedRoles: ["vendor"] },
};

// ============================================
// Role-Based Home Page Redirect
// ============================================
/**
 * Home page that redirects users to role-specific dashboard
 * or login based on their authentication status
 */
const HomePage = () => {
  const { user } = useSelector((store) => store.auth);

  // If no user, show generic dashboard (will redirect to login)
  if (!user) {
    return <GenericDashboard />;
  }

  // Redirect to role-specific dashboard
  switch (user.role) {
    case "admin":
      return <AdminDashboard />;
    case "staff":
      return <DashboardSelector />;
    case "vendor":
      return <DashboardSelector />;
    default:
      return <GenericDashboard />;
  }
};

// Public landing page: Home | About | Features | How It Works | Contact + Login & Vendor Registration
const GenericDashboard = () => <LandingPage />;

// ============================================
// Route Wrappers with Role Protection
// ============================================

// Vendor Routes Wrapper - Admin and Staff only
const VendorsRoute = ({ component: Component }) => (
  <ProtectedRoute allowedRoles={["admin", "staff"]}>
    <Component />
  </ProtectedRoute>
);

// ============================================
// Router Configuration (shared AppShell: Navbar + main + Footer)
// ============================================
const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "login", element: <Login /> },
      { path: "signup", element: <Signup /> },
      { path: "unauthorized", element: <Unauthorized /> },
      {
        path: "admin",
        element: (
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/users",
        element: (
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminUsers />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/users/:id",
        element: (
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminUserDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "bids-monitor",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff"]}>
            <AdminBidsMonitor />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/bids",
        element: <Navigate to="/bids-monitor" replace />,
      },
      {
        path: "profile",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff", "vendor"]}>
            <Profile />
          </ProtectedRoute>
        ),
      },
      {
        path: "notifications",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff", "vendor"]}>
            <NotificationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "vendors",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff"]}>
            <VendorList />
          </ProtectedRoute>
        ),
      },
      {
        path: "vendors/:id",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff"]}>
            <VendorDetails />
          </ProtectedRoute>
        ),
      },
      {
        path: "vendor-profile",
        element: <Navigate to="/signup" replace />,
      },
      {
        path: "purchase-orders",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff", "vendor"]}>
            <PurchaseOrders />
          </ProtectedRoute>
        ),
      },
      {
        path: "purchase-requests",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff"]}>
            <PurchaseRequestList />
          </ProtectedRoute>
        ),
      },
      {
        path: "purchase-requests/new",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff"]}>
            <PurchaseRequests />
          </ProtectedRoute>
        ),
      },
      {
        path: "purchase-requests/:id/edit",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff"]}>
            <PurchaseRequests />
          </ProtectedRoute>
        ),
      },
      {
        path: "procurement/requests/:id",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff"]}>
            <PurchaseRequestDetails />
          </ProtectedRoute>
        ),
      },
      {
        path: "procurement/payments",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff"]}>
            <ProcurementPayments />
          </ProtectedRoute>
        ),
      },
      {
        path: "approvals",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff"]}>
            <Approvals />
          </ProtectedRoute>
        ),
      },
      {
        path: "deliveries",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff", "vendor"]}>
            <Deliveries />
          </ProtectedRoute>
        ),
      },
      {
        path: "invoices",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff", "vendor"]}>
            <Invoices />
          </ProtectedRoute>
        ),
      },
      {
        path: "my-payments",
        element: (
          <ProtectedRoute allowedRoles={["vendor"]}>
            <VendorPayments />
          </ProtectedRoute>
        ),
      },
      {
        path: "payments/esewa/success",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff", "vendor"]}>
            <InvoiceEsewaReturn />
          </ProtectedRoute>
        ),
      },
      {
        path: "payments/esewa/failure",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff", "vendor"]}>
            <InvoiceEsewaReturn />
          </ProtectedRoute>
        ),
      },
      {
        path: "tenders",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff", "vendor"]}>
            <TenderList />
          </ProtectedRoute>
        ),
      },
      {
        path: "tenders/create",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff"]}>
            <CreateTender />
          </ProtectedRoute>
        ),
      },
      {
        path: "tenders/:id",
        element: (
          <ProtectedRoute allowedRoles={["admin", "staff", "vendor"]}>
            <TenderDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "my-bids",
        element: (
          <ProtectedRoute allowedRoles={["vendor"]}>
            <MyBids />
          </ProtectedRoute>
        ),
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

function App() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RouterProvider router={appRouter} />
    </div>
  );
}

export default App;
