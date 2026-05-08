/**
 * User detail page.
 *
 * Shows profile and activity for a single user.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../services/api";
import { formatDateTime } from "../services/formatters";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { ConfirmButton } from "../components/ConfirmButton";
import { Layout } from "../components/Layout";

/**
 * Shows details and activity for a single user.
 */
export function UserDetailPage() {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadUserDetail() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get(`/users/${userId}`);
        if (mounted) setData(response);
      } catch (requestError) {
        if (mounted) setError(requestError.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadUserDetail();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const user = data?.user;
  const assets = useMemo(() => data?.assets || [], [data]);
  const transactions = useMemo(() => data?.transactions || [], [data]);

  const markAvailable = async (assetId) => {
    setError("");
    try {
      await api.patch(`/assets/${assetId}/available`);
      const refreshed = await api.get(`/users/${userId}`);
      setData(refreshed);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <Layout title="User detail" subtitle="View the user profile and currently assigned assets.">
      {loading ? (
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-72 rounded-xl bg-slate-200" />
            <div className="h-40 rounded-3xl bg-slate-100" />
          </div>
        </Card>
      ) : error ? (
        <Card>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          <div className="mt-4">
            <Button as={Link} to="/users" variant="secondary">Back to users</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card
            title={user.user_name}
            subtitle={`${user.username} • ${user.email}`}
            action={<Badge tone={user.is_active ? "Active" : "Inactive"}>{user.is_active ? "Active" : "Inactive"}</Badge>}
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3 text-sm text-slate-700">
                <InfoRow label="Role" value={user.role} />
                <InfoRow label="Username" value={user.username} />
                <InfoRow label="Email" value={user.email} />
                <InfoRow label="Status" value={user.is_active ? "Active" : "Inactive"} />
              </div>
              <div className="space-y-3 text-sm text-slate-700">
                <InfoRow label="User id" value={user.user_id} />
                <InfoRow label="Created on" value={formatDateTime(user.created_on)} />
                <InfoRow label="Modified on" value={formatDateTime(user.modified_on)} />
                <InfoRow label="Assigned assets" value={assets.length} />
              </div>
            </div>

            <div className="mt-6">
              <Button as={Link} to="/users" variant="secondary">Back</Button>
            </div>
          </Card>

          <Card title="Assigned assets" subtitle="Assets currently assigned to this user.">
            <DataTable
              columns={[
                {
                  key: "formatted_asset_id",
                  label: "Asset ID",
                  render: (row) => (
                    <Link className="font-medium text-slate-900 hover:underline" to={`/assets/${row.asset_id}`}>
                      {row.formatted_asset_id || row.asset_code || `Asset #${row.asset_id}`}
                    </Link>
                  ),
                },
                { key: "asset_name", label: "Name" },
                { key: "serial_number", label: "Serial" },
                { key: "asset_type", label: "Type" },
                { key: "asset_status", label: "Status", badge: true },
                { key: "assigned_on", label: "Assigned on", render: (row) => formatDateTime(row.assigned_on) },
                {
                  key: "asset_id",
                  label: "Action",
                  render: (row) => (
                    <ConfirmButton confirmText="Mark this asset as Available?" onConfirm={() => markAvailable(row.asset_id)}>
                      Mark available
                    </ConfirmButton>
                  ),
                },
              ]}
              rows={assets}
              emptyMessage="No assets are currently assigned to this user."
              getRowKey={(row) => `user-asset-${row.asset_id}`}
            />
          </Card>

          <Card title="Asset history" subtitle="Assignment and transfer history involving this user.">
            <DataTable
              columns={[
                { key: "transaction_type", label: "Action", badge: true },
                { key: "asset_name", label: "Asset" },
                {
                  key: "asset_id",
                  label: "Asset ID",
                  render: (row) => (
                    <Link className="font-medium text-slate-900 hover:underline" to={`/assets/${row.asset_id}`}>
                      {row.asset_code || `Asset #${row.asset_id}`}
                    </Link>
                  ),
                },
                { key: "from_employee_name", label: "From", render: (row) => row.from_employee_name || "-" },
                { key: "to_assignee_name", label: "To", render: (row) => row.to_assignee_name || "-" },
                { key: "performed_by_name", label: "Performed by", render: (row) => row.performed_by_name || "-" },
                { key: "action_date", label: "Date", render: (row) => formatDateTime(row.action_date) },
              ]}
              rows={transactions}
              emptyMessage="No transaction history recorded for this user yet."
              getRowKey={(row) => `user-tx-${row.transaction_id}`}
            />
          </Card>
        </div>
      )}
    </Layout>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-slate-500">{label}</div>
      <div className="text-right font-semibold text-slate-900">{value ?? "-"}</div>
    </div>
  );
}
