/**
 * Bulk QR label printing page.
 *
 * Pages through assets so the user can select multiple labels for printing.
 * Uses an on-page print area to avoid popup blockers.
 */

import { useEffect, useMemo, useState } from "react";

import { assetStatuses, assetTypes } from "../app/routeConfig";
import { API_BASE_URL, api } from "../services/api";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { InputField, SelectField } from "../components/FormField";
import { Layout } from "../components/Layout";

/**
 * Lets users select and print multiple QR labels.
 */
export function QrPrintPage() {
  const [assets, setAssets] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [assigneeByAssetId, setAssigneeByAssetId] = useState({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [qrFilter, setQrFilter] = useState("with");
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const selectedAssets = useMemo(() => {
    const selectedIds = selected;
    return assets.filter((asset) => selectedIds.has(asset.asset_id) && asset.qr_code_image_url);
  }, [assets, selected]);

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedAssignee = assigneeQuery.trim().toLowerCase();

    return assets.filter((asset) => {
      const hasQr = Boolean(asset.qr_code_image_url);

      if (qrFilter === "with" && !hasQr) return false;
      if (qrFilter === "without" && hasQr) return false;

      if (statusFilter && asset.asset_status !== statusFilter) return false;
      if (typeFilter && asset.asset_type !== typeFilter) return false;
      if (locationFilter && asset.location !== locationFilter) return false;
      if (departmentFilter && asset.department !== departmentFilter) return false;

      if (normalizedAssignee) {
        if (asset.asset_status !== "Assigned") return false;
        const resolvedAssignee = assigneeByAssetId[asset.asset_id] || asset.current_assignee_name || "";
        const assigneeName = `${resolvedAssignee}`.toLowerCase();
        if (!assigneeName.includes(normalizedAssignee)) return false;
      }

      if (!normalizedQuery) return true;
      const haystack = `${asset.asset_id ?? ""} ${asset.asset_name ?? ""} ${asset.serial_number ?? ""} ${asset.asset_code ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [assets, assigneeByAssetId, assigneeQuery, departmentFilter, locationFilter, query, qrFilter, statusFilter, typeFilter]);

  const locationOptions = useMemo(() => {
    const values = new Set();
    assets.forEach((asset) => {
      if (asset.location) values.add(asset.location);
    });
    return Array.from(values).sort();
  }, [assets]);

  const departmentOptions = useMemo(() => {
    const values = new Set();
    assets.forEach((asset) => {
      if (asset.department) values.add(asset.department);
    });
    return Array.from(values).sort();
  }, [assets]);

  useEffect(() => {
    let mounted = true;

    api.get("/transactions")
      .then((rows) => {
        if (!mounted) return;
        const nextMap = {};
        (rows || []).forEach((row) => {
          if (!row?.asset_id || !row?.to_assignee_name) return;
          const existing = nextMap[row.asset_id];
          const existingDate = existing?.action_date ? new Date(existing.action_date) : null;
          const currentDate = row.action_date ? new Date(row.action_date) : null;

          if (!existing) {
            nextMap[row.asset_id] = { name: row.to_assignee_name, action_date: row.action_date, transaction_id: row.transaction_id };
            return;
          }

          if (currentDate && existingDate) {
            if (currentDate > existingDate) {
              nextMap[row.asset_id] = { name: row.to_assignee_name, action_date: row.action_date, transaction_id: row.transaction_id };
              return;
            }
            if (currentDate.getTime() === existingDate.getTime() && row.transaction_id > existing.transaction_id) {
              nextMap[row.asset_id] = { name: row.to_assignee_name, action_date: row.action_date, transaction_id: row.transaction_id };
            }
          }
        });

        const flattened = {};
        Object.entries(nextMap).forEach(([assetId, entry]) => {
          flattened[assetId] = entry.name;
        });
        setAssigneeByAssetId(flattened);
      })
      .catch(() => {
        if (mounted) setAssigneeByAssetId({});
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selectableAssets = useMemo(
    () => filteredAssets.filter((asset) => Boolean(asset.qr_code_image_url)),
    [filteredAssets]
  );

  const allSelected = useMemo(
    () => selectableAssets.length > 0 && selectableAssets.every((asset) => selected.has(asset.asset_id)),
    [selectableAssets, selected]
  );

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      async function loadAllAssets() {
        setLoading(true);
        setError("");
        try {
          const pageSize = 100;
          let page = 1;
          let total = 0;
          const all = [];

          // Page through assets so we can render all QR labels.
          // Endpoint already returns non-retired assets.
          while (true) {
            const response = await api.get(`/assets?page=${page}&page_size=${pageSize}`);
            const items = Array.isArray(response?.items) ? response.items : [];
            total = Number(response?.total || 0);
            all.push(...items);
            if (all.length >= total || items.length === 0) break;
            page += 1;
          }

          if (!mounted) return;
          setAssets(all);
        } catch (requestError) {
          if (mounted) setError(requestError.message);
        } finally {
          if (mounted) setLoading(false);
        }
      }

      loadAllAssets();
    }, 250);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [assigneeQuery]);

  const toggleAsset = (asset) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(asset.asset_id)) {
        next.delete(asset.asset_id);
      } else {
        next.add(asset.asset_id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (allSelected) {
        selectableAssets.forEach((asset) => next.delete(asset.asset_id));
        return next;
      }
      selectableAssets.forEach((asset) => next.add(asset.asset_id));
      return next;
    });
  };

  const handlePrint = () => {
    if (!selectedAssets.length) return;
    // Use in-page printing to avoid popup blockers.
    window.print();
  };

  return (
    <Layout title="QR Print" centerTitle>
      <style>{`
        .qr-bulk-print-area { display: none; }

        @media print {
          body * { visibility: hidden !important; }
          .qr-bulk-print-area, .qr-bulk-print-area * { visibility: visible !important; }
          .qr-bulk-print-area { display: block; position: absolute; left: 0; top: 0; width: 100%; padding: 16px; box-sizing: border-box; background: #fff; }
          .qr-label { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="space-y-6">
        <Card title="Print QR labels" subtitle="Check the assets you want to print.">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] xl:hidden">
            <InputField
              label="Search"
              labelClassName="block text-center"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search assets"
              className="min-h-10 py-2 text-center text-xs sm:text-sm"
            />
            <div className="flex items-end justify-center">
              <Button variant="secondary" className="w-full" onClick={() => setShowFilters((value) => !value)}>
                {showFilters ? "Hide filters" : "Filters"}
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:hidden">
              <InputField
                label="Assignee"
                labelClassName="block text-center"
                value={assigneeQuery}
                onChange={(event) => setAssigneeQuery(event.target.value)}
                placeholder="Search by user name"
                className="min-h-10 py-2 text-center text-xs sm:text-sm"
              />
              <SelectField label="Status" labelClassName="block text-center" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-10 py-2 text-center text-xs sm:text-sm">
                <option value="">All statuses</option>
                {assetStatuses.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </SelectField>
              <SelectField label="Type" labelClassName="block text-center" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="min-h-10 py-2 text-center text-xs sm:text-sm">
                <option value="">All types</option>
                {assetTypes.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </SelectField>
              <SelectField label="Location" labelClassName="block text-center" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="min-h-10 py-2 text-center text-xs sm:text-sm">
                <option value="">All locations</option>
                {locationOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </SelectField>
              <SelectField label="Department" labelClassName="block text-center" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="min-h-10 py-2 text-center text-xs sm:text-sm">
                <option value="">All departments</option>
                {departmentOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </SelectField>
              <SelectField label="QR" labelClassName="block text-center" value={qrFilter} onChange={(event) => setQrFilter(event.target.value)} className="min-h-10 py-2 text-center text-xs sm:text-sm">
                <option value="with">With QR</option>
                <option value="without">Without QR</option>
                <option value="all">All</option>
              </SelectField>
            </div>
          )}

          <div className="hidden gap-3 xl:grid xl:grid-cols-7">
            <InputField
              label="Search"
              labelClassName="block text-center"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Asset ID, name, serial, code"
              className="min-h-10 py-2 text-center text-xs sm:text-sm"
            />
            <InputField
              label="Assignee"
              labelClassName="block text-center"
              value={assigneeQuery}
              onChange={(event) => setAssigneeQuery(event.target.value)}
              placeholder="Search by user name"
              className="min-h-10 py-2 text-center text-xs sm:text-sm"
            />
            <SelectField label="Status" labelClassName="block text-center" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-10 py-2 text-center text-xs sm:text-sm">
              <option value="">All statuses</option>
              {assetStatuses.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </SelectField>
            <SelectField label="Type" labelClassName="block text-center" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="min-h-10 py-2 text-center text-xs sm:text-sm">
              <option value="">All types</option>
              {assetTypes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </SelectField>
            <SelectField label="Location" labelClassName="block text-center" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="min-h-10 py-2 text-center text-xs sm:text-sm">
              <option value="">All locations</option>
              {locationOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </SelectField>
            <SelectField label="Department" labelClassName="block text-center" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="min-h-10 py-2 text-center text-xs sm:text-sm">
              <option value="">All departments</option>
              {departmentOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </SelectField>
            <SelectField label="QR" labelClassName="block text-center" value={qrFilter} onChange={(event) => setQrFilter(event.target.value)} className="min-h-10 py-2 text-center text-xs sm:text-sm">
              <option value="with">With QR</option>
              <option value="without">Without QR</option>
              <option value="all">All</option>
            </SelectField>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              {loading ? "Loading assets..." : `${filteredAssets.length} assets loaded`}
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button variant="secondary" onClick={handleSelectAll} disabled={!selectableAssets.length}>
                {allSelected ? "Clear all" : "Select all"}
              </Button>
              <Button onClick={handlePrint} disabled={!selectedAssets.length}>Print selected</Button>
            </div>
          </div>
          {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

          {loading ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
              <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
            </div>
          ) : filteredAssets.length ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {filteredAssets.map((asset) => {
                const hasQr = Boolean(asset.qr_code_image_url);
                const isChecked = selected.has(asset.asset_id);

                return (
                  <div key={`qr-label-${asset.asset_id}`} className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-2 h-4 w-4 rounded border-slate-300"
                        checked={isChecked}
                        disabled={!hasQr}
                        onChange={() => toggleAsset(asset)}
                        aria-label={`Select ${asset.formatted_asset_id || asset.asset_code || asset.asset_id}`}
                      />
                        <div className={`w-full rounded-2xl border-2 border-black bg-white p-4 ${!hasQr ? "opacity-60" : ""}`}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-2">
                            <div className="text-base font-extrabold text-slate-900">
                              Asset ID:{asset.formatted_asset_id || asset.asset_code || "-"}
                            </div>
                            <div className="text-sm text-slate-700">
                              <span className="font-semibold">S/N:</span> {asset.serial_number || "-"}
                            </div>
                            {!hasQr && <div className="text-xs text-rose-600">No QR generated for this asset.</div>}
                          </div>
                          {hasQr ? (
                            <img
                              className="h-24 w-24 object-contain sm:h-28 sm:w-28"
                              src={`${API_BASE_URL}${asset.qr_code_image_url}`}
                              alt="Asset QR code"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-24 w-24 rounded-2xl border border-dashed border-slate-200 bg-slate-50 sm:h-28 sm:w-28" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              No assets found.
            </div>
          )}
        </Card>

        <div className="qr-bulk-print-area" aria-hidden="true">
          <div className="space-y-4">
            {selectedAssets.map((asset) => (
              <div
                key={`print-label-${asset.asset_id}`}
                className="qr-label"
                style={{ border: "2px solid #000", padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px" }}
              >
                <div style={{ display: "grid", gap: "8px" }}>
                  <div style={{ fontSize: "16px", lineHeight: 1.2, fontWeight: 800 }}>
                    Asset ID:<span style={{ fontWeight: 700, marginLeft: 6 }}>{asset.formatted_asset_id || asset.asset_code || "-"}</span>
                  </div>
                  <div style={{ fontSize: "14px", lineHeight: 1.2 }}>
                    <strong>S/N:</strong> {asset.serial_number || "-"}
                  </div>
                </div>
                <img
                  src={`${API_BASE_URL}${asset.qr_code_image_url}`}
                  alt="Asset QR"
                  style={{ width: 150, height: 150, objectFit: "contain" }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
