/**
 * Dashboard page.
 *
 * Fetches summary data from `GET /dashboard` and renders KPIs, warranty alerts,
 * and recent activity.
 */

import { useEffect, useState } from "react";

import { api } from "../services/api";
import { formatDate, formatIssueType } from "../services/formatters";
import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { Layout } from "../components/Layout";
import { StatsGrid } from "../components/StatsGrid";

/**
 * Shows organization-wide KPIs and recent activity.
 */
export function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        const response = await api.get("/dashboard");
        if (mounted) setData(response);
      } catch (requestError) {
        if (mounted) setError(requestError.message);
      }
    }

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Layout title="Dashboard" subtitle="Operational overview of your asset inventory.">
      {error ? (
        <Card>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        </Card>
      ) : null}

      {!data ? (
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-10 w-56 rounded-xl bg-slate-200" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-28 rounded-3xl bg-slate-100" />
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <StatsGrid
            stats={[
              { label: "Total Assets", value: data.counts.total_assets },
              { label: "Available", value: data.counts.available },
              { label: "Assigned", value: data.counts.assigned },
              { label: "In Repair", value: data.counts.in_repair },
            ]}
          />

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Recent Transactions" subtitle="The latest asset movements and assignments.">
              <DataTable
                columns={[
                  { key: "asset_name", label: "Asset" },
                  { key: "transaction_type", label: "Type" },
                  { key: "to_assignee_name", label: "To" },
                  { key: "action_date", label: "Date", render: (row) => formatDate(row.action_date) },
                ]}
                rows={data.recent_transactions}
              />
            </Card>

            <div className="space-y-6">
              <Card title="Warranty Alerts" subtitle="Assets that will expire soon.">
                <DataTable
                  columns={[
                    { key: "asset_name", label: "Asset" },
                    { key: "serial_number", label: "Serial" },
                    { key: "warranty_end_date", label: "Expires", render: (row) => formatDate(row.warranty_end_date) },
                  ]}
                  rows={data.warranty_alerts}
                />
              </Card>

              <Card title="Recent Maintenance" subtitle="Open and closed repair records.">
                <DataTable
                  columns={[
                    { key: "asset_name", label: "Asset" },
                    { key: "issue_type", label: "Issue", render: (row) => formatIssueType(row.issue_type) },
                    { key: "maintenance_status", label: "Status" },
                  ]}
                  rows={data.recent_maintenance}
                />
              </Card>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}