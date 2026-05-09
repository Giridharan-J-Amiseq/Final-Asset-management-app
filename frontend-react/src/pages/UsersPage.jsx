/**
 * Admin-only user management page.
 *
 * Supports creating users and (optionally) importing users from Microsoft Graph.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../services/api";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Layout } from "../components/Layout";
import { DataTable } from "../components/DataTable";
import { ConfirmButton } from "../components/ConfirmButton";

/**
 * Creates users and lists current accounts.
 */
export function UsersPage() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const loadUsers = async () => {
    const response = await api.get("/users");
    setRows(response || []);
  };

  useEffect(() => {
    loadUsers().catch((requestError) => setError(requestError.message));
  }, []);

  const syncMicrosoftUsers = async () => {
    setError("");
    setMessage("");
    setIsSyncing(true);

    try {
      const result = await api.post("/auth/microsoft/import-users?top=200", {});
      const imported = result?.imported ?? 0;
      const skipped = result?.skipped ?? 0;
      setMessage(`Microsoft import complete. Imported ${imported}, skipped ${skipped}.`);
      await loadUsers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const deactivateUser = async (userId) => {
    try {
      await api.patch(`/users/${userId}/deactivate`);
      await loadUsers();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <Layout title="Users" >
      <Card title="User directory" subtitle="Active and inactive accounts.">
        <div className="mb-4 flex justify-end">
          <Button type="button" onClick={syncMicrosoftUsers} disabled={isSyncing}>
            {isSyncing ? "Syncing..." : "Sync from Microsoft"}
          </Button>
        </div>
        {message && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
        {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        <DataTable
          columns={[
            {
              key: "user_name",
              label: "Name",
              render: (row) => (
                <Link className="font-medium text-slate-900 hover:underline" to={`/users/${row.user_id}`}>
                  {row.user_name}
                </Link>
              ),
            },
            { key: "username", label: "Username" },
            { key: "role", label: "Role" },
            { key: "is_active", label: "Status", render: (row) => (row.is_active ? "Active" : "Inactive") },
            {
              key: "user_id",
              label: "Action",
              render: (row) => (
                row.is_active ? (
                  <ConfirmButton confirmText="Deactivate this user and return assigned assets to Available?" danger onConfirm={() => deactivateUser(row.user_id)}>
                    Deactivate
                  </ConfirmButton>
                ) : (
                  "-"
                )
              ),
            },
          ]}
          rows={rows}
        />
      </Card>
    </Layout>
  );
}
