/**
 * Asset inventory page.
 *
 * Provides list + filters + create form.
 * Key calls:
 * - `GET /assets/meta/dropdowns`
 * - `GET /assets` (paged)
 * - `POST /assets` (create)
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { assetConditions, assetStatuses, assetTypes } from "../app/routeConfig";
import { api } from "../services/api";
import { formatCurrency, formatDate } from "../services/formatters";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { InputField, SelectField, TextareaField } from "../components/FormField";
import { Layout } from "../components/Layout";
import { ConfirmButton } from "../components/ConfirmButton";

const defaultForm = {
  asset_name: "",
  asset_type: "",
  category: "IT",
  serial_number: "",
  model: "",
  brand: "",
  specifications: "",
  purchase_date: "",
  purchase_cost: "",
  vendor_name: "",
  invoice_number: "",
  warranty_start_date: "",
  warranty_expiry: "",
  asset_status: "Available",
  condition_status: "New",
  location: "",
  department: "",
};

const today = new Date().toISOString().slice(0, 10);

/**
 * Lists assets and provides creation and quick actions.
 */
export function AssetsPage() {
  const [assetsData, setAssetsData] = useState(null);
  const [dropdowns, setDropdowns] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pageSize = 8;

  useEffect(() => {
    async function loadDropdowns() {
      const response = await api.get("/assets/meta/dropdowns");
      setDropdowns(response);
    }

    loadDropdowns().catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadAssets() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
        if (query.trim()) params.set("search", query.trim());
        if (statusFilter) params.set("status_filter", statusFilter);
        if (typeFilter) params.set("type_filter", typeFilter);
        if (locationFilter) params.set("location", locationFilter);
        if (departmentFilter) params.set("department", departmentFilter);
        const response = await api.get(`/assets?${params.toString()}`);
        if (mounted) setAssetsData(response);
      } catch (requestError) {
        if (mounted) setError(requestError.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAssets();
    return () => {
      mounted = false;
    };
  }, [page, pageSize, query, statusFilter, typeFilter, locationFilter, departmentFilter]);

  const locations = useMemo(() => dropdowns?.locations || [], [dropdowns]);
  const departments = useMemo(() => dropdowns?.departments || [], [dropdowns]);

  const totalPages = Math.max(1, Math.ceil((assetsData?.total || 0) / pageSize));

  const fetchAssets = async ({
    pageValue = page,
    queryValue = query,
    statusValue = statusFilter,
    typeValue = typeFilter,
    locationValue = locationFilter,
    departmentValue = departmentFilter,
  } = {}) => {
    const params = new URLSearchParams({ page: String(pageValue), page_size: String(pageSize) });
    if (queryValue.trim()) params.set("search", queryValue.trim());
    if (statusValue) params.set("status_filter", statusValue);
    if (typeValue) params.set("type_filter", typeValue);
    if (locationValue) params.set("location", locationValue);
    if (departmentValue) params.set("department", departmentValue);
    return api.get(`/assets?${params.toString()}`);
  };

  const handleCreateAsset = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        ...form,
        purchase_date: form.purchase_date || null,
        warranty_start_date: form.warranty_start_date || null,
        purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : null,
        warranty_expiry: form.warranty_expiry ? Number(form.warranty_expiry) : null,
      };
      const response = await api.post("/assets", payload);
      const refreshedAssets = await fetchAssets({ pageValue: 1, queryValue: "", statusValue: "", typeValue: "" });
      setMessage(`Asset created successfully. Asset ID: ${response.formatted_asset_id || response.asset_code}`);
      setShowForm(false);
      setForm(defaultForm);
      setQuery("");
      setStatusFilter("");
      setTypeFilter("");
      setLocationFilter("");
      setDepartmentFilter("");
      setPage(1);
      setAssetsData(refreshedAssets);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const markAvailable = async (assetId) => {
    setMessage("");
    setError("");
    try {
      await api.patch(`/assets/${assetId}/available`);
      const refreshed = await fetchAssets();
      setAssetsData(refreshed);
      setMessage("Asset marked available.");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <Layout title="Manage Asset">
      <div className="space-y-6">
        <Card
          title="Manage asset inventory"
          subtitle="Search and filter the asset catalog without leaving the page."
          action={<Button onClick={() => setShowForm((value) => !value)}>{showForm ? "Close form" : "Add asset"}</Button>}
        >
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            <InputField label="Search" labelClassName="block text-center" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Asset ID, name, code, employee" />
            <SelectField label="Status" labelClassName="block text-center" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              {assetStatuses.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </SelectField>
            <SelectField label="Type" labelClassName="block text-center" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">All types</option>
              {assetTypes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </SelectField>
            <SelectField label="Location" labelClassName="block text-center" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
              <option value="">All locations</option>
              {locations.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </SelectField>
            <SelectField label="Department" labelClassName="block text-center" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
              <option value="">All departments</option>
              {departments.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </SelectField>
          </div>
        </Card>

        {showForm && (
          <Card title="Create asset" subtitle="Register a new asset in the system.">
            <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleCreateAsset}>
              <InputField label="Asset name" value={form.asset_name} onChange={(e) => setForm({ ...form, asset_name: e.target.value })} required />
              <SelectField label="Asset type" value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value })} required>
                <option value="">Select type</option>
                {assetTypes.map((item) => <option key={item} value={item}>{item}</option>)}
              </SelectField>
              <SelectField label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="IT">IT</option>
                <option value="Non-IT">Non-IT</option>
              </SelectField>
              <InputField label="Serial number" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} required />
              <InputField label="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              <InputField label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              <TextareaField className="md:col-span-2 xl:col-span-3" label="Specifications" value={form.specifications} onChange={(e) => setForm({ ...form, specifications: e.target.value })} />
              <InputField label="Purchase date" type="date" max={today} value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} required />
              <InputField label="Purchase cost" type="number" min="0" max="99999999.99" step="0.01" value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })} />
              <InputField label="Vendor name" value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} />
              <InputField label="Invoice number" value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} />
              <InputField label="Warranty start" type="date" max={today} value={form.warranty_start_date} onChange={(e) => setForm({ ...form, warranty_start_date: e.target.value })} required />
              <InputField label="Warranty expiry (years)" type="number" min="0" max="50" value={form.warranty_expiry} onChange={(e) => setForm({ ...form, warranty_expiry: e.target.value })} />
              <SelectField label="Status" value={form.asset_status} onChange={(e) => setForm({ ...form, asset_status: e.target.value })}>
                {assetStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </SelectField>
              <SelectField label="Condition" value={form.condition_status} onChange={(e) => setForm({ ...form, condition_status: e.target.value })}>
                {assetConditions.map((item) => <option key={item} value={item}>{item}</option>)}
              </SelectField>
              <SelectField label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required>
                <option value="">Select location</option>
                {locations.map((item) => <option key={item} value={item}>{item}</option>)}
              </SelectField>
              <SelectField label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required>
                <option value="">Select department</option>
                {departments.map((item) => <option key={item} value={item}>{item}</option>)}
              </SelectField>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:flex-wrap sm:justify-end md:col-span-2 xl:col-span-3">
                <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" className="w-full sm:w-auto" disabled={loading}>Create asset</Button>
              </div>
            </form>
          </Card>
        )}

        {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
        {error && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {(assetsData?.items || []).map((asset) => (
            <article key={asset.asset_id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:rounded-3xl sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-semibold text-slate-900">{asset.asset_name}</h3>
                  <p className="mt-1 break-words text-xs uppercase tracking-[0.12em] text-slate-500 sm:tracking-[0.18em]">{asset.formatted_asset_id || asset.asset_code || `Asset #${asset.asset_id}`}</p>
                </div>
                <Badge tone={asset.asset_status}>{asset.asset_status}</Badge>
              </div>

              <div className="mt-4 space-y-2 break-words text-sm text-slate-600">
                <div><span className="font-medium text-slate-900">Serial:</span> {asset.serial_number}</div>
                <div><span className="font-medium text-slate-900">Type:</span> {asset.asset_type}</div>
                <div><span className="font-medium text-slate-900">Location:</span> {asset.location || "-"}</div>
                <div><span className="font-medium text-slate-900">Brand:</span> {asset.brand || "-"}</div>
                <div><span className="font-medium text-slate-900">Purchase:</span> {formatDate(asset.purchase_date)}</div>
                <div><span className="font-medium text-slate-900">Cost:</span> {formatCurrency(asset.purchase_cost)}</div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button as={Link} to={`/assets/${asset.asset_id}`} variant="secondary">View</Button>
                <Button as={Link} to="/qr-print" variant="ghost" className="border border-slate-200">QR</Button>
              </div>

              {asset.asset_status !== "Available" && asset.asset_status !== "Retired" && (
                <div className="mt-3">
                  <ConfirmButton
                    confirmText="Mark this asset as Available?"
                    onConfirm={() => markAvailable(asset.asset_id)}
                  >
                    Mark available
                  </ConfirmButton>
                </div>
              )}
            </article>
          ))}
        </div>

        <Card>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-500">
              Showing {assetsData?.items?.length || 0} of {assetsData?.total || 0} assets
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:gap-3">
              <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
              <span className="text-center text-sm font-medium text-slate-600">Page {page} of {totalPages}</span>
              <Button variant="secondary" disabled={page >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</Button>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
