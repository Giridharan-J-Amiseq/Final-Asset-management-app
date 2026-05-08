/**
 * Application route table.
 *
 * ProtectedRoute enforces:
 * - user must be authenticated
 * - user must have permission to access the requested page
 */

import { Navigate, Route, Routes } from "react-router-dom";

import { canAccess, getHomePath, isLoggedIn } from "../services/auth";
import { LoginPage } from "../pages/LoginPage";
import { AuthCallbackPage } from "../pages/AuthCallbackPage";
import { DashboardPage } from "../pages/DashboardPage";
import { AssetsPage } from "../pages/AssetsPage";
import { AssetDetailPage } from "../pages/AssetDetailPage";
import { TransactionsPage } from "../pages/TransactionsPage";
import { AssignPage } from "../pages/AssignPage";
import { TransferPage } from "../pages/TransferPage";
import { MaintenancePage } from "../pages/MaintenancePage";
import { UsersPage } from "../pages/UsersPage";
import { UserDetailPage } from "../pages/UserDetailPage";
import { QrPrintPage } from "../pages/QrPrintPage";
import { NotFoundPage } from "../pages/NotFoundPage";

function ProtectedRoute({ children, pathname }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccess(pathname)) {
    return <Navigate to={getHomePath()} replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={isLoggedIn() ? getHomePath() : "/login"} replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/dashboard" element={<ProtectedRoute pathname="/dashboard"><DashboardPage /></ProtectedRoute>} />
      <Route path="/assets" element={<ProtectedRoute pathname="/assets"><AssetsPage /></ProtectedRoute>} />
      <Route path="/assets/new" element={<ProtectedRoute pathname="/assets/new"><AssetsPage /></ProtectedRoute>} />
      <Route path="/assets/:assetId" element={<ProtectedRoute pathname="/assets/:id"><AssetDetailPage /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute pathname="/transactions"><TransactionsPage /></ProtectedRoute>} />
      <Route path="/assign" element={<ProtectedRoute pathname="/assign"><AssignPage /></ProtectedRoute>} />
      <Route path="/transfer" element={<ProtectedRoute pathname="/transfer"><TransferPage /></ProtectedRoute>} />
      <Route path="/maintenance" element={<ProtectedRoute pathname="/maintenance"><MaintenancePage /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute pathname="/users"><UsersPage /></ProtectedRoute>} />
      <Route path="/users/:userId" element={<ProtectedRoute pathname="/users/:id"><UserDetailPage /></ProtectedRoute>} />
      <Route path="/qr-print" element={<ProtectedRoute pathname="/qr-print"><QrPrintPage /></ProtectedRoute>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}