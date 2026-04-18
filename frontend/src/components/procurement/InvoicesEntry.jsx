import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { SESSION_ROLE } from "@/constants/userRoles";
import Invoices from "./Invoices";

/**
 * Staff use the full invoice management table; vendors are redirected to the card-based view.
 */
export default function InvoicesEntry() {
  const { user } = useSelector((store) => store.auth);
  if (user?.role === SESSION_ROLE.VENDOR) {
    return <Navigate to="/my-invoices" replace />;
  }
  return <Invoices />;
}
