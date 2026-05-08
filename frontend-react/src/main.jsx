/**
 * React application bootstrap.
 *
 * The app can be hosted in two modes:
 * - Vite dev server at `/`
 * - Served by FastAPI under `/app/`
 *
 * We compute a router basename from the current path so client-side routing
 * works in both deployments.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./app/App.jsx";
import "./styles/tailwind.css";

const routerBasename = window.location.pathname.startsWith("/app") ? "/app" : "/";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
