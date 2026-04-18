import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import { useSelector } from "react-redux";
import AppShell from "./components/layout/AppShell";
import Login from "./components/auth/Login";
import Signup from "./components/auth/Signup";
// Role-based Dashboard imports
import DashboardSelector from "./components/dashboard/Dashboards";
import AdminDashboard from "./components/admin/AdminDashboard";
import AdminUsers from "./components/admin/AdminUsers";
import AdminUserDetail from "./components/admin/AdminUserDetail";
import AdminBidsMonitor from "./components/admin/AdminBidsMonitor";

// VendorNet Components
import VendorList from "./components/vendor/VendorList";
import VendorDetails from "./components/vendor/VendorDetails";
import LandingHome from "./components/landing/LandingHome";
import LandingAbout from "./components/landing/LandingAbout";
import LandingFeatures from "./components/landing/LandingFeatures";
import LandingHowItWorks from "./components/landing/LandingHowItWorks";
import LandingContact from "./components/landing/LandingContact";
import PurchaseOrders from "./components/procurement/PurchaseOrders";
import Deliveries from "./components/procurement/Deliveries";
import DeliveryAuditMap from "./components/procurement/DeliveryAuditMap";
import InvoicesEntry from "./components/procurement/InvoicesEntry";
import VendorInvoices from "./components/procurement/VendorInvoices";
import PurchaseRequestList from "./components/procurement/PurchaseRequestList";
import PurchaseRequests from "./components/procurement/PurchaseRequests";
import PurchaseRequestDetails from "./components/procurement/PurchaseRequestDetails";
import Approvals from "./components/procurement/Approvals";
import TenderList from "./components/tenders/TenderList";
import CreateTender from "./components/tenders/CreateTender";
import TenderDetail from "./components/tenders/TenderDetail";
import MyBids from "./components/bids/MyBids";

import ProtectedRoute from "./components/admin/ProtectedRoute";
import { SESSION_ROLE } from "@/constants/userRoles";
import Profile from "./components/Profile";
import NotificationsPage from "./components/notifications/NotificationsPage";
import VendorPayments from "./components/payment/VendorPayments";
import InvoiceEsewaReturn from "./components/payment/InvoiceEsewaReturn";
import ProcurementPayments from "./components/procurement/ProcurementPayments";

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
    case SESSION_ROLE.ADMIN:
      return <AdminDashboard />;
    case SESSION_ROLE.PROCUREMENT_OFFICER:
      return <DashboardSelector />;
    case SESSION_ROLE.VENDOR:
      return <DashboardSelector />;
    default:
      return <GenericDashboard />;
  }
};

// Public marketing routes (multi-page)
const GenericDashboard = () => <LandingHome />;

// ============================================
// Route Wrappers with Role Protection
// ============================================

// Vendor Routes Wrapper - Admin and Staff only
const VendorsRoute = ({ component: Component }) => (
  <ProtectedRoute
    allowedRoles={[SESSION_ROLE.ADMIN, SESSION_ROLE.PROCUREMENT_OFFICER]}
  >
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
      { path: "about", element: <LandingAbout /> },
      { path: "features", element: <LandingFeatures /> },
      { path: "how-it-works", element: <LandingHowItWorks /> },
      { path: "contact", element: <LandingContact /> },
      { path: "login", element: <Login /> },
      { path: "signup", element: <Signup /> },
      { path: "unauthorized", element: <Navigate to="/" replace /> },
      {
        path: "admin",
        element: (
          <ProtectedRoute allowedRoles={[SESSION_ROLE.ADMIN]}>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/users",
        element: (
          <ProtectedRoute allowedRoles={[SESSION_ROLE.ADMIN]}>
            <AdminUsers />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/users/:id",
        element: (
          <ProtectedRoute allowedRoles={[SESSION_ROLE.ADMIN]}>
            <AdminUserDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "bids-monitor",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
            ]}
          >
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
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
              SESSION_ROLE.VENDOR,
            ]}
          >
            <Profile />
          </ProtectedRoute>
        ),
      },
      {
        path: "notifications",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
              SESSION_ROLE.VENDOR,
            ]}
          >
            <NotificationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "vendors",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
            ]}
          >
            <VendorList />
          </ProtectedRoute>
        ),
      },
      {
        path: "vendors/:id",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
            ]}
          >
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
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
              SESSION_ROLE.VENDOR,
            ]}
          >
            <PurchaseOrders />
          </ProtectedRoute>
        ),
      },
      {
        path: "purchase-requests",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
            ]}
          >
            <PurchaseRequestList />
          </ProtectedRoute>
        ),
      },
      {
        path: "purchase-requests/new",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
            ]}
          >
            <PurchaseRequests />
          </ProtectedRoute>
        ),
      },
      {
        path: "purchase-requests/:id/edit",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
            ]}
          >
            <PurchaseRequests />
          </ProtectedRoute>
        ),
      },
      {
        path: "procurement/requests/:id",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
            ]}
          >
            <PurchaseRequestDetails />
          </ProtectedRoute>
        ),
      },
      {
        path: "procurement/payments",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
            ]}
          >
            <ProcurementPayments />
          </ProtectedRoute>
        ),
      },
      {
        path: "approvals",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
            ]}
          >
            <Approvals />
          </ProtectedRoute>
        ),
      },
      {
        path: "deliveries",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
              SESSION_ROLE.VENDOR,
            ]}
          >
            <Deliveries />
          </ProtectedRoute>
        ),
      },
      {
        path: "deliveries/audit",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
            ]}
          >
            <DeliveryAuditMap />
          </ProtectedRoute>
        ),
      },
      {
        path: "invoices",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
              SESSION_ROLE.VENDOR,
            ]}
          >
            <InvoicesEntry />
          </ProtectedRoute>
        ),
      },
      {
        path: "my-invoices",
        element: (
          <ProtectedRoute allowedRoles={[SESSION_ROLE.VENDOR]}>
            <VendorInvoices />
          </ProtectedRoute>
        ),
      },
      {
        path: "my-payments",
        element: (
          <ProtectedRoute allowedRoles={[SESSION_ROLE.VENDOR]}>
            <VendorPayments />
          </ProtectedRoute>
        ),
      },
      {
        path: "payments/esewa/success",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
              SESSION_ROLE.VENDOR,
            ]}
          >
            <InvoiceEsewaReturn />
          </ProtectedRoute>
        ),
      },
      {
        path: "payments/esewa/failure",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
              SESSION_ROLE.VENDOR,
            ]}
          >
            <InvoiceEsewaReturn />
          </ProtectedRoute>
        ),
      },
      {
        path: "tenders",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
              SESSION_ROLE.VENDOR,
            ]}
          >
            <TenderList />
          </ProtectedRoute>
        ),
      },
      {
        path: "tenders/create",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
            ]}
          >
            <CreateTender />
          </ProtectedRoute>
        ),
      },
      {
        path: "tenders/:id",
        element: (
          <ProtectedRoute
            allowedRoles={[
              SESSION_ROLE.ADMIN,
              SESSION_ROLE.PROCUREMENT_OFFICER,
              SESSION_ROLE.VENDOR,
            ]}
          >
            <TenderDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "my-bids",
        element: (
          <ProtectedRoute allowedRoles={[SESSION_ROLE.VENDOR]}>
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
