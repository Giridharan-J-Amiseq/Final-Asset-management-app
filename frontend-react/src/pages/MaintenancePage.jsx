/**
 * Maintenance workflow page.
 *
 * - Log issue: `POST /maintenance` (moves asset to "In Repair")
 * - Close issue: `PATCH /maintenance/{id}/close` (moves asset back to "Available")
 */

import { useEffect, useMemo, useState } from "react";

import { maintenanceIssueTypes } from "../app/routeConfig";
import { api } from "../services/api";
import { formatDate, formatDateTime, formatIssueType } from "../services/formatters";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { InputField, SelectField, TextareaField } from "../components/FormField";
import { Layout } from "../components/Layout";
import { DataTable } from "../components/DataTable";

function computeWarrantyApplicable(asset) {
  // Warranty expiry is stored as "years" in the asset record.
  const startValue = asset?.warranty_start_date;
  const yearsValue = asset?.warranty_expiry;
  const years = yearsValue === null || yearsValue === undefined || yearsValue === "" ? null : Number(yearsValue);

  if (!startValue || !Number.isFinite(years) || years <= 0) return false;

  const start = new Date(startValue);
  if (Number.isNaN(start.getTime())) return false;

  const end = new Date(start);
  end.setFullYear(end.getFullYear() + years);
  return new Date() <= end;
}

/**
 * Logs and closes maintenance records.
 */
export function MaintenancePage() {
  const [assets, setAssets] = useState([]);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({ asset_id: "", issue_type: "", issue_description: "", vendor: "", resolution_notes: "", warranty_applicable: false });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedAsset = useMemo(() => {
    if (!form.asset_id) return null;
    const selectedValue = String(form.asset_id);
    return assets.find((asset) => String(asset.asset_id) === selectedValue) || null;
  }, [assets, form.asset_id]);

  useEffect(() => {
    const nextApplicable = form.asset_id ? computeWarrantyApplicable(selectedAsset) : false;
    setForm((current) => (current.warranty_applicable === nextApplicable ? current : { ...current, warranty_applicable: nextApplicable }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.asset_id, selectedAsset]);

  const loadMaintenanceData = async () => {
    const [assetResponse, maintenanceResponse] = await Promise.all([
      api.get("/assets?page_size=100"),
      api.get("/maintenance"),
    ]);
    setAssets(assetResponse.items || []);
    setRecords(maintenanceResponse || []);
  };

  useEffect(() => {
    loadMaintenanceData().catch((requestError) => setError(requestError.message));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    try {
      await api.post("/maintenance", {
        asset_id: form.asset_id,
        issue_type: form.issue_type,
        issue_description: form.issue_description,
        vendor: form.vendor || null,
        resolution_notes: form.resolution_notes || null,
        warranty_applicable: Boolean(form.warranty_applicable),
      });
      setMessage("Maintenance issue logged successfully.");
      setForm({ asset_id: "", issue_type: "", issue_description: "", vendor: "", resolution_notes: "", warranty_applicable: false });
      await loadMaintenanceData();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const closeMaintenance = async (maintenanceId) => {
    if (!window.confirm("Close this maintenance record and mark the asset available?")) return;
    setMessage("");
    setError("");

    try {
      const result = await api.patch(`/maintenance/${maintenanceId}/close`);
      setMessage(result.message || "Maintenance closed and asset marked available.");
      await loadMaintenanceData();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <Layout title="Maintenance">
      <div className="grid gap-6 2xl:grid-cols-[0.9fr_1.1fr]">
        <Card title="Log maintenance issue" subtitle="Use this form when an asset needs attention.">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <SelectField
              label="Asset"
              value={form.asset_id}
              onChange={(event) => {
                const nextAssetId = event.target.value;
                const nextAsset = assets.find((asset) => String(asset.asset_id) === String(nextAssetId)) || null;
                setForm((current) => ({
                  ...current,
                  asset_id: nextAssetId,
                  warranty_applicable: nextAssetId ? computeWarrantyApplicable(nextAsset) : false,
                }));
              }}
              required
            >
              <option value="">Select asset</option>
              {assets.map((asset) => <option key={asset.asset_id} value={asset.asset_id}>{asset.asset_name} - {asset.serial_number}</option>)}
            </SelectField>

            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                label="Warranty start"
                value={selectedAsset?.warranty_start_date ? formatDate(selectedAsset.warranty_start_date) : "-"}
                disabled
              />
              <InputField
                label="Warranty expiry (years)"
                value={selectedAsset?.warranty_expiry !== null && selectedAsset?.warranty_expiry !== undefined && selectedAsset?.warranty_expiry !== "" ? String(selectedAsset.warranty_expiry) : "-"}
                disabled
              />
            </div>
            <SelectField label="Issue type" value={form.issue_type} onChange={(event) => setForm({ ...form, issue_type: event.target.value })} required>
              <option value="">Select issue type</option>
              {maintenanceIssueTypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </SelectField>
            <TextareaField label="Issue description" value={form.issue_description} onChange={(event) => setForm({ ...form, issue_description: event.target.value })} />
            <InputField label="Vendor" value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} />
            <TextareaField label="Resolution notes" value={form.resolution_notes} onChange={(event) => setForm({ ...form, resolution_notes: event.target.value })} />

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" checked={form.warranty_applicable} disabled />
              Warranty applicable (auto)
            </label>

            <Button type="submit" className="w-full">Log issue</Button>
          </form>

          {message && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
          {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        </Card>

        <Card title="Maintenance records" subtitle="Recent maintenance work in the system.">
          <DataTable
            columns={[
              { key: "asset_name", label: "Asset" },
              { key: "issue_type", label: "Issue", render: (row) => formatIssueType(row.issue_type) },
              { key: "asset_status", label: "Asset status", badge: true },
              { key: "maintenance_status", label: "Status", render: (row) => <Badge tone={row.maintenance_status}>{row.maintenance_status}</Badge> },
              { key: "created_on", label: "Created", render: (row) => formatDateTime(row.created_on) },
              {
                key: "maintenance_id",
                label: "Action",
                render: (row) => row.maintenance_status === "Closed" ? (
                  "-"
                ) : (
                  <Button variant="secondary" onClick={() => closeMaintenance(row.maintenance_id)}>
                    Close repair
                  </Button>
                ),
              },
            ]}
            rows={records}
          />
        </Card>
      </div>
    </Layout>
  );
}
