/**
 * Minimal fetch wrapper used by all pages.
 *
 * - Resolves API base URL from VITE_API_URL or current origin (prod).
 * - Attaches JWT bearer token from localStorage when present.
 * - On 401, clears session and redirects to the login route.
 */

const DEFAULT_LOCAL_API = "http://localhost:8001";

function getErrorMessage(error) {
  if (typeof error.detail === "string") {
    return error.detail;
  }

  if (Array.isArray(error.detail)) {
    return error.detail
      .map((item) => {
        const field = Array.isArray(item.loc) ? item.loc.filter((part) => part !== "body").join(".") : "";
        return field ? `${field}: ${item.msg}` : item.msg;
      })
      .join("; ");
  }

  return error.message || "Request failed";
}

function getAppPrefix() {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/app") ? "/app" : "";
}

function resolveApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;

  if (typeof window === "undefined") return DEFAULT_LOCAL_API;

  const { hostname, port, origin } = window.location;
  const isLocalhost = hostname === "127.0.0.1" || hostname === "localhost";
  // In local dev, the API runs on 8001 and the frontend runs on some other port
  // (3000 by default, but it may change if the port is in use).
  if (isLocalhost && port && port !== "8001") {
    return DEFAULT_LOCAL_API;
  }

  return origin;
}

export const API_BASE_URL = resolveApiBaseUrl();

export async function request(path, options = {}) {
  /**
   * Perform an HTTP request against the backend API.
   * @param {string} path API path starting with `/`.
   * @param {RequestInit & { headers?: Record<string, string> }} options fetch options.
   */

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = localStorage.getItem("ws_token");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem("ws_token");
    localStorage.removeItem("ws_user");
    window.location.href = `${getAppPrefix()}/login`;
    return null;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(getErrorMessage(error));
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body = {}) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),
};
