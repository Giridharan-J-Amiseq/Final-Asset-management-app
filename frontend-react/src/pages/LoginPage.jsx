/**
 * Login page.
 *
 * Supports:
 * - local username/password login (`POST /auth/login`)
 * - optional Microsoft OAuth login (redirect to `/auth/microsoft/login`)
 */

import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { API_BASE_URL, api } from "../services/api";
import { getHomePath, isLoggedIn, setSession } from "../services/auth";
import { Button } from "../components/Button";
import { InputField } from "../components/FormField";

/**
 * Authenticates a user and creates a local session.
 */
export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (isLoggedIn()) {
    return <Navigate to={getHomePath()} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await api.post("/auth/login", { username, password });
      setSession(result);
      navigate(getHomePath(), { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/microsoft/login`;
  };

  return (
    <div className="grid min-h-screen place-items-center overflow-x-hidden bg-gradient-to-b from-ink-50 via-white to-emerald-50 px-3 py-6 sm:px-4 sm:py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-white/60 bg-white shadow-glow sm:rounded-[2rem] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden bg-gradient-to-br from-brand-teal via-ink-700 to-brand-green px-5 py-8 text-white sm:px-8 sm:py-10 lg:px-12 lg:py-14">
          <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-white/5 to-transparent" />
          <div className="relative">
            <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink-200 sm:text-xs sm:tracking-[0.24em]">
              WorkSphere Asset Management
            </div>
            <div className="mt-6">
              <div className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                <span className="bg-gradient-to-r from-brand-green to-white bg-clip-text text-transparent">AMISEQ</span>
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Your Tech Partner</div>
            </div>
            <h1 className="mt-6 max-w-xl font-display text-3xl font-semibold tracking-tight sm:mt-8 sm:text-4xl lg:text-6xl">
              Modern asset control for enterprise teams.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300 lg:text-lg">
              Track assets, assign devices, manage repairs, and keep your inventory organized across every department.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {[
                ["Role-based access", "Users only see the tools they are allowed to use."],
                ["Responsive layout", "Works cleanly on desktops, tablets, and phones."],
                ["QR workflows", "Generate and print QR codes for asset tracking."],
                ["Audit-friendly", "Transactions and maintenance history stay visible."],
              ].map(([title, text]) => (
                <article key={title} className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <h2 className="font-semibold text-white">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-14">
          <div className="mx-auto max-w-md lg:mx-0">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-ink-700">Sign in</div>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Use your company account to enter the app.</p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <InputField label="Username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
              <InputField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />

              {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

              <Button className="w-full py-3 text-base" type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Login"}
              </Button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold text-slate-400">OR</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <Button className="w-full py-3 text-base" type="button" variant="secondary" onClick={handleMicrosoftLogin}>
                Continue with Microsoft
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
