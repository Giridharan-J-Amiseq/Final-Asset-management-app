/**
 * Transfer workflow page.
 *
 * Transfers an "Assigned" asset to another active user by calling
 * `POST /transactions/transfer`.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";

import { api } from "../services/api";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { TextareaField } from "../components/FormField";
import { Layout } from "../components/Layout";

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
  // Custom searchable select used by assignment/transfer.
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
 * Transfers an assigned asset between users.
 */
export function TransferPage() {
  const [searchParams] = useSearchParams();
  const assetIdParam = searchParams.get("assetId")?.trim() || "";
  const prefillRef = useRef(false);
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ asset_id: "", to_assignee: "", remarks: "" });
  const [assetQuery, setAssetQuery] = useState("");
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.get("/assets?status_filter=Assigned&page_size=100"), api.get("/users/assignable")])
      .then(([assetResponse, userResponse]) => {
        setAssets(assetResponse.items || []);
        setUsers(userResponse || []);
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => {
    if (!assetIdParam || prefillRef.current) return;
    let cancelled = false;

    api
      .get(`/assets/${assetIdParam}`)
      .then((response) => {
        if (cancelled) return;
        const asset = response?.asset;
        if (!asset) return;

        if (asset.asset_status !== "Assigned") {
          setError("This asset is not assigned, so it cannot be transferred.");
          prefillRef.current = true;
          return;
        }

        setForm((previous) => ({ ...previous, asset_id: String(asset.asset_id) }));
        setAssets((previous) => {
          const exists = previous.some((item) => String(item.asset_id) === String(asset.asset_id));
          return exists ? previous : [asset, ...previous];
        });
        prefillRef.current = true;
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError.message);
        prefillRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, [assetIdParam]);

  const normalizedAssetQuery = assetQuery.trim().toLowerCase();
  const normalizedAssigneeQuery = assigneeQuery.trim().toLowerCase();

  const filteredAssets = normalizedAssetQuery
    ? assets.filter((asset) => {
      const idValue = String(asset.asset_id ?? "").toLowerCase();
      const codeValue = String(asset.formatted_asset_id ?? asset.asset_code ?? "").toLowerCase();
      return idValue.includes(normalizedAssetQuery) || codeValue.includes(normalizedAssetQuery);
    })
    : assets;

  const filteredUsers = normalizedAssigneeQuery
    ? users.filter((user) => `${user.user_name ?? ""}`.toLowerCase().includes(normalizedAssigneeQuery))
    : users;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!form.asset_id || !form.to_assignee) {
      setError("Please select an asset and a new assignee.");
      return;
    }

    try {
      const result = await api.post("/transactions/transfer", {
        asset_id: form.asset_id,
        to_assignee: Number(form.to_assignee),
        remarks: form.remarks || null,
      });
      setMessage(result.message);
      setForm({ asset_id: "", to_assignee: "", remarks: "" });
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <Layout title="Transfer asset">
      <Card>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <GroupedSearchSelect
            label="Asset"
            query={assetQuery}
            onQueryChange={setAssetQuery}
            queryPlaceholder="Search by Asset ID"
            value={form.asset_id}
            onValueChange={(value) => setForm({ ...form, asset_id: value })}
            options={filteredAssets}
            allOptions={assets}
            getOptionValue={(asset) => asset.asset_id}
            getOptionLabel={(asset) => `${asset.asset_name} - ${asset.serial_number}`}
            emptyLabel="No matching assets"
          />
          <GroupedSearchSelect
            label="New assignee"
            query={assigneeQuery}
            onQueryChange={setAssigneeQuery}
            queryPlaceholder="Search by user name"
            value={form.to_assignee}
            onValueChange={(value) => setForm({ ...form, to_assignee: value })}
            options={filteredUsers}
            allOptions={users}
            getOptionValue={(user) => user.user_id}
            getOptionLabel={(user) => `${user.user_name} (${user.role})`}
            emptyLabel="No matching users"
          />
          <TextareaField className="md:col-span-2" label="Remarks" value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} />
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit">Transfer asset</Button>
          </div>
        </form>

        {message && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
        {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      </Card>
    </Layout>
  );
}