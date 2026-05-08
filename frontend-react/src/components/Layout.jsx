/**
 * App layout shell.
 *
 * Provides:
 * - responsive sidebar + mobile drawer navigation
 * - top header with current user and logout
 * - consistent page padding/background
 */

import { useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Menu, LogOut, Shield, X } from "lucide-react";

import { navigationItems } from "../app/routeConfig";
import { clearSession, getStoredUser } from "../services/auth";
import { Button } from "./Button";

export function Layout({ title, subtitle, children, centerTitle = false, titleClassName = "", subtitleClassName = "" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const user = getStoredUser();
  const navigate = useNavigate();
  const location = useLocation();

  const visibleNavItems = useMemo(
    () => navigationItems.filter((item) => item.roles.includes(user?.role)),
    [user?.role],
  );

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-brand-teal/15 via-ink-50 to-brand-green/20 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 border-r border-ink-700/60 bg-gradient-to-b from-ink-900 via-ink-800 to-ink-700 px-5 py-6 text-slate-100 xl:block 2xl:w-72">
          <Brand tone="dark" />
          <NavList tone="dark" items={visibleNavItems} currentPath={location.pathname} />
        </aside>

        {menuOpen && (
          <div className="fixed inset-0 z-40 bg-slate-950/45 xl:hidden" onClick={() => setMenuOpen(false)}>
            <aside
              className="h-full w-[86vw] max-w-xs overflow-y-auto bg-gradient-to-b from-ink-900 via-ink-800 to-ink-700 px-4 py-5 text-slate-100 shadow-2xl sm:px-5 sm:py-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-center justify-between">
                <Brand compact tone="dark" />
                <Button variant="ghost" className="h-10 w-10 p-0 text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => setMenuOpen(false)} aria-label="Close menu">
                  <X size={18} />
                </Button>
              </div>
              <NavList tone="dark" items={visibleNavItems} currentPath={location.pathname} onNavigate={() => setMenuOpen(false)} />
            </aside>
          </div>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-ink-700/60 bg-gradient-to-r from-ink-900 via-ink-800 to-ink-700 text-slate-100">
            <div className={`flex flex-col gap-4 px-3 py-3 sm:px-4 md:px-6 xl:flex-row xl:items-center xl:justify-between xl:px-8 xl:py-4 ${centerTitle ? "relative" : ""}`}>
              <div className={`flex min-w-0 items-start gap-3 sm:items-center ${centerTitle ? "flex-1" : ""}`}>
                <Button variant="ghost" className="h-10 w-10 shrink-0 p-0 text-slate-200 hover:bg-white/10 hover:text-white xl:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
                  <Menu size={18} />
                </Button>
                <div className={`min-w-0 ${centerTitle ? "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center" : ""}`}>
                  <div className={`flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-100/85 sm:text-xs sm:tracking-[0.24em] ${centerTitle ? "justify-center" : ""}`}>
                    <Shield size={14} />
                    <span className="bg-gradient-to-r from-brand-green to-brand-teal bg-clip-text text-transparent">AMISEQ</span>
                  </div>
                  <h1 className={`break-words font-display text-xl font-semibold tracking-tight text-white sm:text-2xl md:text-3xl ${titleClassName}`}>{title}</h1>
                  {subtitle && <p className={`mt-1 text-sm text-slate-100/80 ${subtitleClassName}`}>{subtitle}</p>}
                </div>
              </div>

              <div className={`flex items-center justify-between gap-3 sm:justify-end ${centerTitle ? "flex-1" : ""}`}>
                <div className="hidden text-right sm:block">
                  <div className="text-sm font-semibold text-white">{user?.user_name || "User"}</div>
                  <div className="text-xs text-slate-100/75">{user?.role || ""}</div>
                </div>
                <Button variant="secondary" onClick={handleLogout} className="shrink-0">
                  <LogOut size={16} />
                  <span>Logout</span>
                </Button>
              </div>
            </div>
          </header>

          <div className="min-w-0 flex-1 px-3 py-4 sm:px-4 md:px-6 md:py-6 xl:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Brand({ compact = false, tone = "light" }) {
  const muted = tone === "dark" ? "text-slate-100/80" : "text-slate-500";
  const subMuted = tone === "dark" ? "text-slate-100/90" : "text-slate-600";

  return (
    <Link to="/dashboard" className="flex min-w-0 items-center gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-green via-brand-teal to-ink-600 font-display text-base font-bold text-white shadow-glow sm:h-12 sm:w-12 sm:text-lg">
        WS
      </div>
      {!compact && (
        <div className="min-w-0">
          <div className="font-display text-xl font-semibold leading-tight">
            <span className="bg-gradient-to-r from-brand-green to-brand-teal bg-clip-text text-transparent">AMISEQ</span>
          </div>
          <div className={`text-[0.7rem] font-semibold uppercase tracking-[0.28em] ${muted}`}>Your Tech Partner</div>
          <div className={`mt-1 text-xs font-semibold ${subMuted}`}>WorkSphere Asset Management</div>
        </div>
      )}
    </Link>
  );
}

function NavList({ items, currentPath, onNavigate, tone = "light" }) {
  const isDark = tone === "dark";
  return (
    <nav className="mt-8 space-y-1">
      {items.map((item) => {
        const active = currentPath === item.path || (item.path === "/assets" && currentPath.startsWith("/assets"));

        const activeClasses = isDark
          ? "bg-gradient-to-r from-brand-teal/25 via-brand-green/15 to-transparent text-white ring-1 ring-white/15"
          : "bg-gradient-to-r from-brand-teal/15 via-brand-green/10 to-transparent text-ink-900 ring-1 ring-brand-teal/20";

        const inactiveClasses = isDark
          ? "text-slate-100/85 hover:bg-white/10 hover:text-white"
          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900";

        return (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={`relative block rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              active ? activeClasses : inactiveClasses
            }`}
          >
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
