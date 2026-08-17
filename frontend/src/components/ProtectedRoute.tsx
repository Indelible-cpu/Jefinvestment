import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  allowedRoles?: Array<'ADMIN' | 'CASHIER' | 'MANAGER'>;
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Enforce password change before accessing any protected routes
  if (user.requiresPasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If they don't have access to this specific route, send them to POS (which both have access to)
    return <Navigate to="/pos" replace />;
  }

  return <Outlet />;
}
