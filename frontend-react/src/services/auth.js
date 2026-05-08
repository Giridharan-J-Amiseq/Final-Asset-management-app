/**
 * Client-side session helpers.
 *
 * The backend issues JWT bearer tokens; the frontend stores them in localStorage
 * along with a minimal user profile for role-gated navigation.
 */

const USER_KEY = "ws_user";
const TOKEN_KEY = "ws_token";

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSession(payload) {
  localStorage.setItem(TOKEN_KEY, payload.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isLoggedIn() {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}

export function hasRole(roles) {
  const user = getStoredUser();
  return Boolean(user && roles.includes(user.role));
}

export function getHomePath() {
  const user = getStoredUser();
  return user?.role === "Viewer" ? "/assets" : "/dashboard";
}

export function canAccess(pathname) {
  const user = getStoredUser();
  if (!user) return false;

  const accessMap = {
    "/dashboard": ["Admin"],
    "/assets": ["Admin", "Viewer"],
    "/assets/new": ["Admin"],
    "/assets/:id": ["Admin", "Viewer"],
    "/transactions": ["Admin"],
    "/assign": ["Admin"],
    "/transfer": ["Admin"],
    "/maintenance": ["Admin"],
    "/users": ["Admin"],
    "/users/:id": ["Admin"],
    "/qr-print": ["Admin"],
  };

  const match = Object.entries(accessMap).find(([pattern]) => {
    if (pattern.includes(":id")) {
      if (pattern.startsWith("/assets/")) {
        return pathname.startsWith("/assets/") && pathname !== "/assets/new";
      }

      if (pattern.startsWith("/users/")) {
        return pathname.startsWith("/users/") && pathname !== "/users";
      }

      return false;
    }
    return pattern === pathname;
  });

  return match ? match[1].includes(user.role) : true;
}