/**
 * Maintenance workflow page.
 *
 * - Log issue: `POST /maintenance` (moves asset to "In Repair")
 * - Close issue: `PATCH /maintenance/{id}/close` (moves asset back to "Available")
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { maintenanceIssueTypes } from "../app/routeConfig";
import { api } from "../services/api";
import { formatDateTime, formatIssueType } from "../services/formatters";
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

function GroupedSearchSelect({
  label,
  query,
  onQueryChange,
  queryPlaceholder,
  value,
  onValueChange,
  options,
  allOptions,
  getOptionValue,
  getOptionLabel,
  emptyLabel = "No matching results",
  maxItems = 50,
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);
  const pointerSelected = useRef(false);

  const selectedOption = useMemo(() => {
    if (!value) return null;
    const selectedValue = String(value);
    return (allOptions || []).find((option) => String(getOptionValue(option)) === selectedValue) || null;
  }, [allOptions, getOptionValue, value]);

  const visibleOptions = useMemo(() => {
    const trimmed = query.trim();
    const source = trimmed ? options : allOptions;
    return (source || []).slice(0, maxItems);
  }, [allOptions, maxItems, options, query]);

  useEffect(() => {
    if (query.trim()) setOpen(true);
  }, [query]);

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  return (
    <div className="min-w-0 space-y-2">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-ink-200 focus-within:border-brand-teal focus-within:ring-4 focus-within:ring-ink-100">
        <input
          className="min-h-12 w-full min-w-0 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-slate-400"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={queryPlaceholder}
          onFocus={() => {
            cancelClose();
            if (query.trim()) setOpen(true);
          }}
          onBlur={scheduleClose}
        />
        <div className="h-px w-full bg-slate-200" />
        <button
          type="button"
          className="flex min-h-12 w-full min-w-0 items-center justify-between gap-3 bg-transparent px-4 py-3 text-left text-sm outline-none"
          onPointerDown={(event) => {
            event.preventDefault();
            cancelClose();
          }}
          onClick={() => setOpen((current) => !current)}
        >
          <span className={selectedOption ? "text-slate-900" : "text-slate-500"}>
            {selectedOption ? getOptionLabel(selectedOption) : "Select"}
          </span>
          <ChevronDown size={18} className={`shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="border-t border-slate-200 bg-white/95">
            <div className="max-h-64 overflow-auto py-1">
              {visibleOptions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-500">{emptyLabel}</div>
              ) : (
                visibleOptions.map((option) => {
                  const optionValue = String(getOptionValue(option));
                  const active = value && String(value) === optionValue;
                  return (
                    <button
                      key={optionValue}
                      type="button"
                      className={`flex w-full items-start px-4 py-2 text-left text-sm transition ${
                        active ? "bg-brand-teal/10 text-slate-900" : "text-slate-700 hover:bg-ink-50/60"
                      }`}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        cancelClose();
                        pointerSelected.current = true;
                        onValueChange(optionValue);
                        setOpen(false);
                      }}
                      onClick={() => {
                        if (pointerSelected.current) {
                          pointerSelected.current = false;
                          return;
                        }

                        onValueChange(optionValue);
                        setOpen(false);
                      }}
                    >
                      {getOptionLabel(option)}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Logs and closes maintenance records.
 */
export function MaintenancePage() {
  const [assets, setAssets] = useState([]);
  const [records, setRecords] = useState([]);
  const [assetQuery, setAssetQuery] = useState("");
  const [form, setForm] = useState({
    asset_id: "",
    issue_type: "",
    issue_description: "",
    vendor: "",
    resolution_notes: "",
    warranty_applicable: false,
    warranty_extension_start_date: "",
    warranty_extension_end_date: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedAsset = useMemo(() => {
    if (!form.asset_id) return null;
    const selectedValue = String(form.asset_id);
    return assets.find((asset) => String(asset.asset_id) === selectedValue) || null;
  }, [assets, form.asset_id]);

  const filteredAssets = useMemo(() => {
    const trimmed = assetQuery.trim().toLowerCase();
    if (!trimmed) return assets;
    return assets.filter((asset) => {
      const name = String(asset.asset_name || "").toLowerCase();
      const serial = String(asset.serial_number || "").toLowerCase();
      const assetId = String(asset.asset_id || "").toLowerCase();
      return name.includes(trimmed) || serial.includes(trimmed) || assetId.includes(trimmed);
    });
  }, [assetQuery, assets]);

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
    setError("");

    if (form.issue_type === "Extend Warranty") {
      if (!form.warranty_extension_start_date || !form.warranty_extension_end_date) {
        setError("Warranty extension start and end dates are required.");
        return;
      }
      if (form.warranty_extension_end_date < form.warranty_extension_start_date) {
        setError("Warranty extension end date cannot be before the start date.");
        return;
      }
    }

    try {
      await api.post("/maintenance", {
        asset_id: form.asset_id,
        issue_type: form.issue_type,
        issue_description: form.issue_description,
        vendor: form.vendor || null,
        resolution_notes: form.resolution_notes || null,
        warranty_applicable: Boolean(form.warranty_applicable),
        warranty_extension_start_date: form.issue_type === "Extend Warranty" ? form.warranty_extension_start_date : null,
        warranty_extension_end_date: form.issue_type === "Extend Warranty" ? form.warranty_extension_end_date : null,
      });
      setMessage("Maintenance issue logged successfully.");
      setForm({
        asset_id: "",
        issue_type: "",
        issue_description: "",
        vendor: "",
        resolution_notes: "",
        warranty_applicable: false,
        warranty_extension_start_date: "",
        warranty_extension_end_date: "",
      });
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
            <GroupedSearchSelect
              label="Asset"
              query={assetQuery}
              onQueryChange={setAssetQuery}
              queryPlaceholder="Search by asset name, ID, or serial"
              value={form.asset_id}
              onValueChange={(nextAssetId) => {
                const nextAsset = assets.find((asset) => String(asset.asset_id) === String(nextAssetId)) || null;
                setForm((current) => ({
                  ...current,
                  asset_id: nextAssetId,
                  warranty_applicable: nextAssetId ? computeWarrantyApplicable(nextAsset) : false,
                }));
              }}
              options={filteredAssets}
              allOptions={assets}
              getOptionValue={(asset) => asset.asset_id}
              getOptionLabel={(asset) => `${asset.asset_name} - ${asset.serial_number}`}
            />

            <SelectField
              label="Issue type"
              value={form.issue_type}
              onChange={(event) => {
                const nextType = event.target.value;
                setForm((current) => ({
                  ...current,
                  issue_type: nextType,
                  warranty_extension_start_date: nextType === "Extend Warranty" ? current.warranty_extension_start_date : "",
                  warranty_extension_end_date: nextType === "Extend Warranty" ? current.warranty_extension_end_date : "",
                }));
              }}
              required
            >
              <option value="">Select issue type</option>
              {maintenanceIssueTypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </SelectField>
            {form.issue_type === "Extend Warranty" && (
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Warranty extension start"
                  type="date"
                  value={form.warranty_extension_start_date}
                  onChange={(event) => setForm({ ...form, warranty_extension_start_date: event.target.value })}
                  required
                />
                <InputField
                  label="Warranty extension end"
                  type="date"
                  value={form.warranty_extension_end_date}
                  onChange={(event) => setForm({ ...form, warranty_extension_end_date: event.target.value })}
                  required
                />
              </div>
            )}
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
