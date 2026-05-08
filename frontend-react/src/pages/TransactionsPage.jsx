/**
 * Transactions (audit trail) page.
 *
 * Displays assignment and transfer history for operational visibility.
 */

import { useEffect, useState } from "react";

import { api } from "../services/api";
import { formatDateTime } from "../services/formatters";
import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { InputField } from "../components/FormField";
import { Layout } from "../components/Layout";

/**
 * Renders the transactions audit table.
 */
export function TransactionsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());

      api.get(`/transactions${params.toString() ? `?${params.toString()}` : ""}`)
        .then((data) => {
          if (mounted) setRows(data || []);
        })
        .catch((requestError) => {
          if (mounted) setError(requestError.message);
        });
    }, 200);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <Layout title="Asset Transaction" subtitle="Asset movement history across the organization.">
      <Card>
        <div className="mb-4">
          <InputField
            label="Search"
            labelClassName="block text-center"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Asset name, asset ID, or username"
          />
        </div>
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : (
          <DataTable
            columns={[
              { key: "asset_name", label: "Asset" },
              { key: "transaction_type", label: "Type" },
              { key: "from_employee_name", label: "From" },
              { key: "to_assignee_name", label: "To" },
              { key: "action_date", label: "Date", render: (row) => formatDateTime(row.action_date) },
            ]}
            rows={rows}
            getRowKey={(row) => `transaction-${row.transaction_id}`}
          />
        )}
      </Card>
    </Layout>
  );
}
