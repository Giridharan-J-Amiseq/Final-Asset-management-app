/**
 * Asset detail page.
 *
 * Shows the full asset record (including QR code, transaction history, and
 * maintenance history) and supports edits/retirement where permitted.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { API_BASE_URL, api } from "../services/api";
import { formatCurrency, formatDate, formatDateTime, formatIssueType } from "../services/formatters";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { InputField, SelectField, TextareaField } from "../components/FormField";
import { Layout } from "../components/Layout";
import { assetConditions } from "../app/routeConfig";

/**
 * Shows details for a single asset.
 */
export function AssetDetailPage() {
  const { assetId } = useParams();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({
    asset_name: "",
    category: "",
    brand: "",
    department: "",
    location: "",
    condition_status: "",
    specifications: "",
    warranty_start_date: "",
    warranty_expiry: "",
  });
  const [dropdowns, setDropdowns] = useState({ departments: [], locations: [], categories: [] });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  const [retireLoading, setRetireLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function loadAsset() {
      setLoading(true);
      try {
        const dropdownResponse = await api.get("/assets/meta/dropdowns");
        if (mounted) {
          setDropdowns({
            departments: dropdownResponse?.departments || [],
            locations: dropdownResponse?.locations || [],
            categories: dropdownResponse?.categories || [],
          });
        }
        const response = await api.get(`/assets/${assetId}`);
        if (!mounted) return;
        setData(response);
        setForm({
          asset_name: response.asset.asset_name || "",
          category: response.asset.category || "",
          brand: response.asset.brand || "",
          department: response.asset.department || "",
          location: response.asset.location || "",
          condition_status: response.asset.condition_status || "New",
          specifications: response.asset.specifications || "",
          warranty_start_date: response.asset.warranty_start_date || "",
          warranty_expiry: response.asset.warranty_expiry ?? "",
        });
      } catch (requestError) {
        if (mounted) setError(requestError.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAsset();
    return () => {
      mounted = false;
    };
  }, [assetId]);

  const asset = data?.asset;
  const activity = data?.activity || [];
  const latestTransaction = data?.transactions?.[0] || null;
  const canAssign = asset?.asset_status === "Available";
  const canTransfer = asset?.asset_status === "Assigned";
  const canMaintain = true;
  const currentHolder =
    asset?.asset_status === "Assigned"
      ? {
          userId: latestTransaction?.to_assignee,
          name: latestTransaction?.to_assignee_name,
          assignedOn: latestTransaction?.action_date,
          performedByName: latestTransaction?.performed_by_name,
        }
      : null;

  const saveAsset = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      const payload = {
        ...form,
        warranty_start_date: form.warranty_start_date || null,
        warranty_expiry: form.warranty_expiry ? Number(form.warranty_expiry) : null,
      };
      await api.put(`/assets/${assetId}`, payload);
      setMessage("Asset updated successfully.");
      const updated = await api.get(`/assets/${assetId}`);
      setData(updated);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handlePrintQr = () => {
    const printableId = asset?.formatted_asset_id || asset?.asset_code || assetId;
    if (!asset?.qr_code_image_url) {
      navigate(`/qr-print?assetId=${encodeURIComponent(printableId)}`);
      return;
    }

    // Use in-page printing to avoid popup blockers.
    window.print();
  };

  const retireAsset = async () => {
    setShowRetireConfirm(true);
  };

  const confirmRetireAsset = async () => {
    if (retireLoading) return;
    setRetireLoading(true);
    setError("");
    try {
      await api.patch(`/assets/${assetId}/retire`);
      navigate("/assets");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRetireLoading(false);
      setShowRetireConfirm(false);
    }
  };

  return (
    <Layout title="Asset detail" subtitle="Detailed record, QR code, transactions, and maintenance history.">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .asset-print-label, .asset-print-label * { visibility: visible !important; }
          .asset-print-label {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 16px !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            background: #fff !important;
          }
        }
      `}</style>
      {showRetireConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="text-lg font-semibold text-slate-900">Retire asset</div>
            <p className="mt-2 text-sm text-slate-600">
              This will retire the asset and remove it from the active inventory. You can still view it in history.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowRetireConfirm(false)} disabled={retireLoading}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmRetireAsset} disabled={retireLoading}>
                {retireLoading ? "Retiring..." : "Retire asset"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="text-lg font-semibold text-slate-900">Edit asset</div>
            <p className="mt-2 text-sm text-slate-600">Update the core asset record.</p>
            <form className="mt-5 space-y-4" onSubmit={(event) => { saveAsset(event); setShowEditModal(false); }}>
              <InputField label="Asset name" value={form.asset_name} onChange={(event) => setForm({ ...form, asset_name: event.target.value })} />
              <SelectField label="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                <option value="">Select category</option>
                {dropdowns.categories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </SelectField>
              <InputField label="Brand" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
              <SelectField label="Department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })}>
                <option value="">Select department</option>
                {dropdowns.departments.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </SelectField>
              <SelectField label="Location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })}>
                <option value="">Select location</option>
                {dropdowns.locations.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </SelectField>
              <SelectField label="Condition" value={form.condition_status} onChange={(event) => setForm({ ...form, condition_status: event.target.value })}>
                {assetConditions.map((item) => <option key={item} value={item}>{item}</option>)}
              </SelectField>
              <TextareaField label="Specifications" value={form.specifications} onChange={(event) => setForm({ ...form, specifications: event.target.value })} />
              <InputField label="Warranty start" type="date" value={form.warranty_start_date} onChange={(event) => setForm({ ...form, warranty_start_date: event.target.value })} />
              <InputField label="Warranty expiry (years)" type="number" min="0" max="50" value={form.warranty_expiry} onChange={(event) => setForm({ ...form, warranty_expiry: event.target.value })} />
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
                <Button type="submit">Save changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}
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
            <Button as={Link} to="/assets" variant="secondary">Back to assets</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card
            title={`Asset name: ${asset.asset_name}`}
            action={(
              <div className="flex items-center gap-2">
                <Badge tone={asset.asset_status}>{asset.asset_status}</Badge>
                <Button variant="secondary" onClick={() => setShowEditModal(true)}>Edit</Button>
              </div>
            )}
          >
              <div className="grid min-w-0 gap-6 lg:grid-cols-2">
                <div className="space-y-3 text-sm text-slate-700">
                  <InfoRow label="Asset ID" value={asset.formatted_asset_id || asset.asset_code || "-"} />
                  <InfoRow
                    label="Currently with"
                    value={
                      currentHolder?.name ? (
                        <Link className="font-semibold text-slate-900 hover:underline" to={`/users/${currentHolder.userId}`}>
                          {currentHolder.name}
                        </Link>
                      ) : (
                        "Not assigned"
                      )
                    }
                  />
                  <InfoRow label="Assigned on" value={currentHolder?.assignedOn ? formatDateTime(currentHolder.assignedOn) : "-"} />
                  <InfoRow label="Asset type" value={asset.asset_type} />
                  <InfoRow label="Category" value={asset.category} />
                  <InfoRow label="Condition" value={asset.condition_status} />
                  <InfoRow label="Location" value={asset.location || "-"} />
                  <InfoRow label="Department" value={asset.department || "-"} />
                  <InfoRow label="Brand" value={asset.brand || "-"} />
                  <InfoRow label="Model" value={asset.model || "-"} />
                  <InfoRow label="Purchase date" value={formatDate(asset.purchase_date)} />
                  <InfoRow label="Purchase cost" value={formatCurrency(asset.purchase_cost)} />
                </div>

                <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:rounded-3xl sm:p-5">
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">QR code</div>
                  <div className="mt-4 flex min-h-36 items-center justify-center rounded-2xl bg-white p-3 sm:min-h-40 sm:rounded-3xl sm:p-4">
                    {asset.qr_code_image_url ? (
                      <img className="max-h-32 w-full max-w-32 object-contain sm:max-h-36 sm:max-w-36" src={`${API_BASE_URL}${asset.qr_code_image_url}`} alt="Asset QR code" />
                    ) : (
                      <div className="text-sm text-slate-500">No QR code generated yet.</div>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Button onClick={handlePrintQr} className="px-3 py-2 text-sm">Print QR</Button>
                    <Button as="a" href={`${asset.qr_code_image_url ? `${API_BASE_URL}${asset.qr_code_image_url}` : "#"}`} variant="secondary" className="px-3 py-2 text-sm" target="_blank" rel="noreferrer">
                      Open image
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Warranty start</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{formatDate(asset.warranty_start_date)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Warranty end</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {asset.warranty_expiry !== null && asset.warranty_expiry !== undefined ? `${asset.warranty_expiry} year(s)` : "-"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Serial number</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{asset.serial_number || "-"}</div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Vendor name</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{asset.vendor_name || "-"}</div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Invoice number</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{asset.invoice_number || "-"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:rounded-3xl sm:p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Specifications</div>
                <p className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {asset.specifications || "No specifications provided."}
                </p>
              </div>

              <div className="mt-6 grid max-w-2xl gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm sm:rounded-3xl">
                  <div className="text-slate-500">Created on</div>
                  <div className="mt-1 font-semibold">{formatDateTime(asset.created_on)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm sm:rounded-3xl">
                  <div className="text-slate-500">Retired</div>
                  <div className="mt-1 font-semibold">{asset.is_retired ? "Yes" : "No"}</div>
                </div>
              </div>

              <div className="mt-4 max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 sm:rounded-3xl">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Related activity</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p><span className="font-semibold">Transactions:</span> {data.transactions.length}</p>
                  <p><span className="font-semibold">Maintenance:</span> {data.maintenance.length}</p>
                </div>
              </div>

              {message && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
                <Button as={Link} to="/assets" variant="secondary">Back</Button>
                {canAssign ? (
                  <Button
                    as={Link}
                    to={`/assign?assetId=${encodeURIComponent(asset?.asset_id || assetId)}`}
                    variant="secondary"
                  >
                    Assign
                  </Button>
                ) : (
                  <Button variant="secondary" disabled>Assign</Button>
                )}
                {canTransfer ? (
                  <Button
                    as={Link}
                    to={`/transfer?assetId=${encodeURIComponent(asset?.asset_id || assetId)}`}
                    variant="secondary"
                  >
                    Transfer
                  </Button>
                ) : (
                  <Button variant="secondary" disabled>Transfer</Button>
                )}
                <Button as={Link} to="/maintenance" variant="secondary">Maintenance</Button>
                <Button variant="danger" onClick={retireAsset}>Retire</Button>
              </div>
          </Card>

          <Card title="Transaction log" subtitle="Assignment and transfer history for this asset.">
            <DataTable
              columns={[
                { key: "transaction_type", label: "Action", badge: true },
                { key: "from_employee_name", label: "From", render: (row) => row.from_employee_name || "-" },
                { key: "to_assignee_name", label: "To", render: (row) => row.to_assignee_name || "-" },
                { key: "performed_by_name", label: "Performed by", render: (row) => row.performed_by_name || "-" },
                { key: "action_date", label: "Date", render: (row) => formatDateTime(row.action_date) },
                { key: "remarks", label: "Remarks", render: (row) => row.remarks || "-" },
              ]}
              rows={data.transactions}
              emptyMessage="No transactions recorded for this asset yet."
              getRowKey={(row) => `asset-transaction-${row.transaction_id}`}
            />
          </Card>

          <Card title="Maintenance log" subtitle="Repair, damage, warranty, and resolution history for this asset.">
            <DataTable
              columns={[
                { key: "issue_type", label: "Issue", render: (row) => formatIssueType(row.issue_type) },
                { key: "maintenance_status", label: "Status", render: (row) => <Badge tone={row.maintenance_status}>{row.maintenance_status}</Badge> },
                { key: "warranty_applicable", label: "Warranty", render: (row) => (row.warranty_applicable ? "Yes" : "No") },
                { key: "vendor", label: "Vendor", render: (row) => row.vendor || "-" },
                { key: "created_on", label: "Created", render: (row) => formatDateTime(row.created_on) },
              ]}
              rows={data.maintenance}
              emptyMessage="No maintenance records logged for this asset yet."
              getRowKey={(row) => `asset-maintenance-${row.maintenance_id}`}
            />
          </Card>

          <Card title="Change log" subtitle="Recorded updates and status changes for this asset.">
            <DataTable
              columns={[
                { key: "action", label: "Action", render: (row) => formatActivityAction(row.action) },
                { key: "performed_by_name", label: "Performed by", render: (row) => row.performed_by_name || "-" },
                { key: "created_on", label: "Date", render: (row) => formatDateTime(row.created_on) },
                {
                  key: "details",
                  label: "Details",
                  render: (row) => (
                    <span className="block max-w-[28rem] truncate text-slate-600" title={row.details || ""}>
                      {formatActivityDetails(row.details)}
                    </span>
                  ),
                },
              ]}
              rows={activity}
              emptyMessage="No change log entries recorded yet."
              getRowKey={(row) => `asset-activity-${row.log_id}`}
            />
          </Card>

        </div>
      )}
    </Layout>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-b border-slate-200 py-2 text-sm last:border-b-0 sm:flex sm:items-start sm:justify-between sm:gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="min-w-0 break-words font-semibold text-slate-900 sm:text-right">{value}</span>
    </div>
  );
}

function formatActivityDetails(value) {
  if (!value) return "-";

  const labelMap = {
    asset_name: "Asset name",
    asset_type: "Asset type",
    category: "Category",
    serial_number: "Serial number",
    model: "Model",
    brand: "Brand",
    specifications: "Specifications",
    purchase_date: "Purchase date",
    purchase_cost: "Purchase cost",
    vendor_name: "Vendor name",
    invoice_number: "Invoice number",
    warranty_start_date: "Warranty start",
    warranty_expiry: "Warranty end",
    asset_status: "Status",
    condition_status: "Condition",
    location: "Location",
    department: "Department",
    is_retired: "Retired",
    maintenance_id: "Maintenance ID",
    issue_type: "Issue type",
  };

  const dateFields = new Set(["purchase_date", "warranty_start_date"]);

  const formatValue = (key, rawValue) => {
    if (rawValue === null || rawValue === undefined || rawValue === "") return "-";
    if (typeof rawValue === "boolean") return rawValue ? "Yes" : "No";
    if (dateFields.has(key)) return formatDate(rawValue);
    return String(rawValue);
  };

  try {
    const parsed = JSON.parse(value);
    if (parsed?.changes && typeof parsed.changes === "object") {
      const keys = Object.keys(parsed.changes).filter(Boolean);
      if (!keys.length) return "Updated";
      return keys
        .map((key) => {
          const entry = parsed.changes[key] || {};
          const beforeText = formatValue(key, entry.before);
          const afterText = formatValue(key, entry.after);
          const label = labelMap[key] || key;
          return `${label}: ${beforeText} -> ${afterText}`;
        })
        .join(", ");
    }
    if (parsed && typeof parsed === "object") {
      const keys = Object.keys(parsed).filter(Boolean);
      if (!keys.length) return "Updated";

      if (keys.length === 1 && keys[0] === "maintenance_id") {
        return "Maintenance closed";
      }

      if (parsed.before && parsed.after && typeof parsed.before === "object" && typeof parsed.after === "object") {
        const changedKeys = Array.from(new Set([...Object.keys(parsed.before), ...Object.keys(parsed.after)])).filter(Boolean);
        if (!changedKeys.length) return "Updated";
        return changedKeys
          .map((key) => {
            const label = labelMap[key] || key;
            const beforeText = formatValue(key, parsed.before?.[key]);
            const afterText = formatValue(key, parsed.after?.[key]);
            return `${label}: ${beforeText} -> ${afterText}`;
          })
          .join(", ");
      }

      return keys
        .map((key) => {
          const label = labelMap[key] || key;
          return `${label}: ${formatValue(key, parsed[key])}`;
        })
        .join(", ");
    }
    return typeof parsed === "string" ? parsed : String(parsed);
  } catch {
    return String(value);
  }
}

function formatActivityAction(value) {
  if (!value) return "-";
  const text = String(value).replace(/_/g, " ").trim();
  return text.replace(/\b\w/g, (match) => match.toUpperCase());
}
