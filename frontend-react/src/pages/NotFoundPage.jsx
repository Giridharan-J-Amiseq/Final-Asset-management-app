/**
 * Fallback route when a path does not match any known page.
 */

import { Link } from "react-router-dom";

import { Button } from "../components/Button";
import { Card } from "../components/Card";

/**
 * 404 page.
 */
export function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 px-4 py-10 text-white">
      <Card className="max-w-xl bg-white text-slate-900">
        <h1 className="font-display text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm text-slate-500">The requested route does not exist in the new React frontend.</p>
        <div className="mt-6">
          <Button as={Link} to="/dashboard">Go to dashboard</Button>
        </div>
      </Card>
    </div>
  );
}