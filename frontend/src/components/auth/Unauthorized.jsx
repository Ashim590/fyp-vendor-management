import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { ShieldX, Home, LogIn } from "lucide-react";
import { useSelector } from "react-redux";

/**
 * Unauthorized Access Page
 *
 * Displayed when a user tries to access a route they don't have permission for.
 * Shows appropriate message based on their login status.
 */
const Unauthorized = () => {
  const { user } = useSelector((store) => store.auth);
  const navigate = useNavigate();

  return (
    <div className="flex w-full flex-1 items-center justify-center bg-gray-50 py-12">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="bg-red-100 p-4 rounded-full">
            <ShieldX className="h-16 w-16 text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          {user ? (
            <>
              You don't have permission to access this page. Your current role
              is <strong>{user.role}</strong>.
              <br />
              Please contact the administrator if you believe this is an error.
            </>
          ) : (
            <>
              You must be logged in to access this page.
              <br />
              Please login with appropriate credentials.
            </>
          )}
        </p>

        {/* Role-based actions */}
        <div className="flex flex-col gap-3">
          {user ? (
            <>
              <Button
                onClick={() => navigate(-1)}
                variant="outline"
                className="w-full"
              >
                <Home className="mr-2 h-4 w-4" />
                Go Back
              </Button>
              <Button
                onClick={() => navigate("/")}
                className="w-full bg-[#F83002] hover:bg-[#d62802]"
              >
                <Home className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => navigate("/login")}
                className="w-full bg-[#F83002] hover:bg-[#d62802]"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Button>
              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="w-full"
              >
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            </>
          )}
        </div>

        {/* Role info for logged in users */}
        {user && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">
              <strong>Your Role:</strong> {user.role}
            </p>
            <div className="text-xs text-gray-500 text-left">
              <p className="font-medium mb-1">Available roles:</p>
              <ul className="list-disc list-inside">
                <li>Admin - Full system access</li>
                <li>Staff - Procurement management</li>
                <li>Vendor - Submit quotations</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Unauthorized;
