import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

/** Wraps the application Layout. Redirects to /login when unauthenticated. */
export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  // Still checking session
  if (user === null) {
    return (
      <div
        data-testid="auth-loading"
        className="min-h-screen flex items-center justify-center bg-[#FDFDF9] text-[#7A726D] text-sm"
      >
        Verificando sessão...
      </div>
    );
  }

  if (user === false) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
