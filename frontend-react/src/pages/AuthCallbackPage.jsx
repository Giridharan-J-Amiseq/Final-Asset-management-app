/**
 * Microsoft OAuth callback page.
 *
 * Receives the backend-issued JWT via `?token=...`, stores it, fetches `/auth/me`,
 * and redirects to the appropriate landing page.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { api } from "../services/api";
import { clearSession, getHomePath, setSession } from "../services/auth";
import { Button } from "../components/Button";

/**
 * Finalizes Microsoft OAuth login and stores a session.
 */
export function AuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const token = useMemo(() => new URLSearchParams(location.search).get("token"), [location.search]);

  useEffect(() => {
    let mounted = true;

    async function finalizeLogin() {
      if (!token) {
        setError("Missing token. Please try signing in again.");
        return;
      }

      clearSession();
      localStorage.setItem("ws_token", token);

      try {
        const user = await api.get("/auth/me");
        if (!mounted) return;
        setSession({ access_token: token, user });
        navigate(getHomePath(), { replace: true });
      } catch (requestError) {
        if (!mounted) return;
        setError(requestError.message || "Login failed");
      }
    }

    finalizeLogin();

    return () => {
      mounted = false;
    };
  }, [navigate, token]);

  if (!error) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="text-sm font-semibold text-slate-700">Signing you in…</div>
          <div className="mt-2 text-sm text-slate-500">Completing Microsoft authentication.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Sign-in failed</div>
        <div className="mt-2 text-sm text-rose-600">{error}</div>
        <div className="mt-5 flex justify-center">
          <Button as={Link} to="/login" variant="secondary">Back to login</Button>
        </div>
      </div>
    </div>
  );
}
