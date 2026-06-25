import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Spinner from "../components/common/Spinner";

// Public
import HomePage from "../pages/public/HomePage";

// Auth
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import VerifyEmailPage from "../pages/auth/VerifyEmailPage";

// Owner
import OwnerDashboard from "../pages/owner/OwnerDashboard";
import BranchManagement from "../pages/owner/BranchManagement";
import UserManagement from "../pages/owner/UserManagement";
import AllBookings from "../pages/owner/AllBookings";
import AllTransactions from "../pages/owner/AllTransactions";
import ForcastingPage from "../pages/owner/ForcastingPage";
import WorkforcePage from "../pages/owner/WorkforcePage";
import AuditLogPage from "../pages/owner/AuditLogPage";
import CentralizedReports from "../pages/owner/CentralizedReports";

// Manager
import ManagerDashboard from "../pages/manager/ManagerDashboard";
import BranchBookings from "../pages/manager/BranchBookings";
import BranchTransactions from "../pages/manager/BranchTransactions";
import BranchInventory from "../pages/manager/BranchInventory";
import StaffMonitoring from "../pages/manager/StaffMonitoring";
import ManagerCustomerFeedback from "../pages/manager/CustomerFeedback";
import BranchReports from "../pages/manager/BranchReports";

// Staff
import StaffDashboard from "../pages/staff/StaffDashboard";
import BookService from "../pages/staff/BookService";
import BookingHistory from "../pages/staff/BookingHistory";
import SubmitFeedback from "../pages/staff/SubmitFeedback";

// Customer
import CustomerDashboard from "../pages/customer/CustomerDashboard";
import CustomerBookAppointment from "../pages/customer/CustomerBookAppointment";
import CustomerBookingHistory from "../pages/customer/CustomerBookingHistory";
import CustomerFeedback from "../pages/customer/CustomerFeedback";

const ROLE_ROUTES = {
  owner: "/owner/dashboard",
  manager: "/manager/dashboard",
  staff: "/staff/dashboard",
  customer: "/customer/dashboard",
};

function CenteredSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8E5EE" }}>
      <Spinner size="lg" />
    </div>
  );
}

function GuestRoute({ children }) {
  const { isAuthenticated, currentUser, loading } = useAuth();
  if (loading) return <CenteredSpinner />;
  if (isAuthenticated) {
    const redirect = ROLE_ROUTES[currentUser?.role] || "/";
    return <Navigate to={redirect} replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated, currentUser, loading } = useAuth();
  if (loading) return <CenteredSpinner />;
  if (isAuthenticated) {
    const redirect = ROLE_ROUTES[currentUser?.role] || "/";
    return <Navigate to={redirect} replace />;
  }
  return children;
}

function PrivateRoute({ children, allowedRoles }) {
  const { isAuthenticated, currentUser, loading } = useAuth();
  if (loading) return <CenteredSpinner />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(currentUser?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return children;
}

function UnauthorizedPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: "#F8E5EE", fontFamily: "'Poppins', sans-serif" }}
    >
      <h1 className="text-3xl font-bold" style={{ color: "#C85B95" }}>Access Denied</h1>
      <p style={{ color: "#6B3F5D" }}>You don't have permission to view this page.</p>
      <a
        href="/login"
        className="px-6 py-2 rounded-xl text-white text-sm font-medium"
        style={{ background: "#C85B95" }}
      >
        Back to Login
      </a>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<PublicRoute><HomePage /></PublicRoute>} />

      {/* Auth */}
      <Route path="/login"        element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register"     element={<GuestRoute><RegisterPage /></GuestRoute>} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* Owner */}
      <Route path="/owner/dashboard"  element={<PrivateRoute allowedRoles={["owner"]}><OwnerDashboard /></PrivateRoute>} />
      <Route path="/owner/branches"   element={<PrivateRoute allowedRoles={["owner"]}><BranchManagement /></PrivateRoute>} />
      <Route path="/owner/users"      element={<PrivateRoute allowedRoles={["owner"]}><UserManagement /></PrivateRoute>} />
      <Route path="/owner/bookings"   element={<PrivateRoute allowedRoles={["owner"]}><AllBookings /></PrivateRoute>} />
      <Route path="/owner/transactions" element={<PrivateRoute allowedRoles={["owner"]}><AllTransactions /></PrivateRoute>} />
      <Route path="/owner/forecasting" element={<PrivateRoute allowedRoles={["owner"]}><ForcastingPage /></PrivateRoute>} />
      <Route path="/owner/workforce"  element={<PrivateRoute allowedRoles={["owner"]}><WorkforcePage /></PrivateRoute>} />
      <Route path="/owner/audit-logs" element={<PrivateRoute allowedRoles={["owner"]}><AuditLogPage /></PrivateRoute>} />
      <Route path="/owner/reports"    element={<PrivateRoute allowedRoles={["owner"]}><CentralizedReports /></PrivateRoute>} />

      {/* Manager */}
      <Route path="/manager/dashboard"    element={<PrivateRoute allowedRoles={["manager"]}><ManagerDashboard /></PrivateRoute>} />
      <Route path="/manager/bookings"     element={<PrivateRoute allowedRoles={["manager"]}><BranchBookings /></PrivateRoute>} />
      <Route path="/manager/transactions" element={<PrivateRoute allowedRoles={["manager"]}><BranchTransactions /></PrivateRoute>} />
      <Route path="/manager/inventory"    element={<PrivateRoute allowedRoles={["manager"]}><BranchInventory /></PrivateRoute>} />
      <Route path="/manager/staff"        element={<PrivateRoute allowedRoles={["manager"]}><StaffMonitoring /></PrivateRoute>} />
      <Route path="/manager/feedback"     element={<PrivateRoute allowedRoles={["manager"]}><ManagerCustomerFeedback /></PrivateRoute>} />
      <Route path="/manager/reports"      element={<PrivateRoute allowedRoles={["manager"]}><BranchReports /></PrivateRoute>} />

      {/* Staff */}
      <Route path="/staff/dashboard" element={<PrivateRoute allowedRoles={["staff"]}><StaffDashboard /></PrivateRoute>} />
      <Route path="/staff/bookings"  element={<PrivateRoute allowedRoles={["staff"]}><BookService /></PrivateRoute>} />
      <Route path="/staff/transactions" element={<PrivateRoute allowedRoles={["staff"]}><BookingHistory /></PrivateRoute>} />
      <Route path="/staff/feedback"  element={<PrivateRoute allowedRoles={["staff"]}><SubmitFeedback /></PrivateRoute>} />
      <Route path="/staff/book"      element={<PrivateRoute allowedRoles={["staff"]}><BookService /></PrivateRoute>} />
      <Route path="/staff/history"   element={<PrivateRoute allowedRoles={["staff"]}><BookingHistory /></PrivateRoute>} />

      {/* Customer */}
      <Route
        path="/customer/dashboard"
        element={
          <PrivateRoute allowedRoles={["customer"]}>
            <CustomerDashboard />
          </PrivateRoute>
        }
      />

      <Route
        path="/customer/book"
        element={
          <PrivateRoute allowedRoles={["customer"]}>
            <CustomerBookAppointment />
          </PrivateRoute>
        }
      />

      <Route
        path="/customer/history"
        element={
          <PrivateRoute allowedRoles={["customer"]}>
            <CustomerBookingHistory />
          </PrivateRoute>
        }
      />

      <Route
        path="/customer/feedback"
        element={
          <PrivateRoute allowedRoles={["customer"]}>
            <CustomerFeedback />
          </PrivateRoute>
        }
      />

      <Route
        path="/bookings/new"
        element={
          <PrivateRoute allowedRoles={["customer"]}>
            <CustomerBookAppointment />
          </PrivateRoute>
        }
      />

      <Route
        path="/history"
        element={
          <PrivateRoute allowedRoles={["customer"]}>
            <CustomerBookingHistory />
          </PrivateRoute>
        }
      />

      <Route
        path="/feedback"
        element={
          <PrivateRoute allowedRoles={["customer"]}>
            <CustomerFeedback />
          </PrivateRoute>
        }
      />

      {/* Utility */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*"             element={<Navigate to="/" replace />} />
    </Routes>
  );
}
