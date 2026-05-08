const NAV_LINKS = [
    ["dashboard.html", "dashboard", "Dashboard", ["Admin", "IT Manager"]],
    ["assets.html", "assets", "Assets", ["Admin", "IT Manager", "Viewer"]],
    ["transactions.html", "transactions", "Transactions", ["Admin", "IT Manager"]],
    ["assign.html", "assign", "Assign Asset", ["Admin", "IT Manager"]],
    ["transfer.html", "transfer", "Transfer Asset", ["Admin", "IT Manager"]],
    ["maintenance.html", "maintenance", "Maintenance", ["Admin", "IT Manager"]],
    ["users.html", "users", "Users", ["Admin"]],
    ["qr_print.html", "qr_print", "QR Print", ["Admin", "IT Manager"]],
];

function showToast(message, type = "success") {
    let stack = document.getElementById("ws-toast-stack");
    if (!stack) {
        stack = document.createElement("div");
        stack.id = "ws-toast-stack";
        stack.className = "ws-toast-stack";
        document.body.appendChild(stack);
    }
    const toneClass = type === "error" ? "danger" : type;
    const item = document.createElement("div");
    item.className = `alert alert-${toneClass} ws-toast mb-2`;
    item.textContent = message;
    stack.appendChild(item);
    setTimeout(() => item.remove(), 3500);
}

function setFormBusy(form, isBusy, busyText = "Please wait...") {
    const button = form.querySelector("button[type='submit'], button:not([type])");
    if (!button) return;
    if (!button.dataset.defaultText) {
        button.dataset.defaultText = button.textContent;
    }
    button.disabled = isBusy;
    button.textContent = isBusy ? busyText : button.dataset.defaultText;
}

function statusBadge(status) {
    const map = {
        Available: "ws-badge ws-badge-success",
        Assigned: "ws-badge ws-badge-info",
        "In Repair": "ws-badge ws-badge-warning",
        Retired: "ws-badge ws-badge-neutral",
        Lost: "ws-badge ws-badge-danger",
        Open: "ws-badge ws-badge-danger",
        "In Progress": "ws-badge ws-badge-warning",
        Closed: "ws-badge ws-badge-success",
    };
    return `<span class="${map[status] || "ws-badge ws-badge-neutral"}">${status}</span>`;
}

function viewQRModal(imageUrl, assetId) {
    const qrImage = document.getElementById("qrCodeImage");
    if (qrImage) {
        qrImage.src = imageUrl;
    }
    const modal = new bootstrap.Modal(document.getElementById("qrModal"));
    modal.show();
}

function renderTable(elementId, columns, rows) {
    const container = document.getElementById(elementId);
    if (!container) return;
    if (!rows.length) {
        container.innerHTML = `<div class="ws-empty">No records found.</div>`;
        return;
    }
    container.innerHTML = `
        <div class="table-responsive">
            <table class="table ws-table align-middle">
                <thead>
                    <tr>${columns.map((column) => `<th>${column.label}</th>`).join("")}</tr>
                </thead>
                <tbody>
                    ${rows
                        .map((row) => `
                            <tr>
                                ${columns.map((column) => `<td>${column.render ? column.render(row) : row[column.key] ?? "-"}</td>`).join("")}
                            </tr>
                        `)
                        .join("")}
                </tbody>
            </table>
        </div>
    `;
}

function shellTemplate(pageTitle, pageKey, content) {
    const user = Auth.getUser() || {};
    const links = NAV_LINKS.filter(([, , , roles]) => roles.includes(user.role));
    document.body.className = "ws-body";
    document.body.innerHTML = `
        <div class="ws-layout">
            <aside class="ws-sidebar">
                <div class="ws-brand-block">
                    <div class="ws-logo-square">AT</div>
                    <div>
                        <div class="ws-brand">AssetTrack</div>
                        <div class="ws-brand-sub">Enterprise</div>
                    </div>
                </div>
                <div class="ws-nav-caption">Navigation</div>
                <nav>
                    ${links.map(([href, key, label]) => `<a class="ws-nav-link ${pageKey === key ? "active" : ""}" href="${href}">${label}</a>`).join("")}
                </nav>
            </aside>
            <main class="ws-main">
                <div class="ws-topbar">
                    <div>
                        <div class="ws-title">${pageTitle}</div>
                        <div class="ws-subtitle">Enterprise Asset Management Dashboard</div>
                    </div>
                    <div class="d-flex align-items-center gap-3">
                        <div class="ws-online-pill"><span class="ws-online-dot"></span> SYSTEM ONLINE</div>
                        <div class="text-end">
                            <div data-user-name>${user.user_name || "User"}</div>
                            <div class="text-muted-custom small" data-user-role>${user.role || ""}</div>
                        </div>
                        <button class="btn btn-outline-secondary btn-sm" data-logout>Logout</button>
                    </div>
                </div>
                ${content}
            </main>
        </div>
    `;
    Auth.initProtectedPage();
}

async function initDashboardPage() {
    shellTemplate("Dashboard", "dashboard", `
        <div class="ws-section-grid mb-4" id="dashboard-stats"></div>
        <div class="row g-4">
            <div class="col-lg-7">
                <div class="ws-table-card">
                    <h5 class="mb-3">Recent Transactions</h5>
                    <div id="transactions-table"></div>
                </div>
            </div>
            <div class="col-lg-5">
                <div class="ws-table-card mb-4">
                    <h5 class="mb-3">Warranty Alerts</h5>
                    <div id="warranty-table"></div>
                </div>
                <div class="ws-table-card">
                    <h5 class="mb-3">Recent Maintenance</h5>
                    <div id="maintenance-table"></div>
                </div>
            </div>
        </div>
    `);

    const data = await API.get("/dashboard");
    const stats = [
        ["Total Assets", data.counts.total_assets],
        ["Assigned", data.counts.assigned],
        ["In Repair", data.counts.in_repair],
        ["Retired", data.counts.retired],
    ];
    document.getElementById("dashboard-stats").innerHTML = stats
        .map(([label, value]) => `<div class="ws-stat-card"><div class="ws-stat-label">${label}</div><div class="ws-stat-value">${value}</div></div>`)
        .join("");

    renderTable("transactions-table", [
        { key: "asset_name", label: "Asset" },
        { key: "transaction_type", label: "Type" },
        { key: "to_assignee_name", label: "To" },
    ], data.recent_transactions);

    renderTable("warranty-table", [
        { key: "asset_name", label: "Asset" },
        { key: "warranty_end_date", label: "Expires" },
    ], data.warranty_alerts);

    renderTable("maintenance-table", [
        { key: "asset_name", label: "Asset" },
        { key: "maintenance_status", label: "Status", render: (row) => statusBadge(row.maintenance_status) },
    ], data.recent_maintenance);
}

function renderAssetCards(elementId, items) {
    const container = document.getElementById(elementId);
    if (!container) return;
    if (!items.length) {
        container.innerHTML = `<div class="ws-empty">No assets found.</div>`;
        return;
    }
    container.innerHTML = `<div class="ws-assets-grid">${items.map((asset) => `
        <article class="ws-asset-card">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                    <h5 class="mb-1">${asset.asset_name}</h5>
                    <div class="text-muted-custom small">${asset.asset_code || "Asset ID pending"}</div>
                    <div class="text-muted-custom small">${asset.serial_number}</div>
                </div>
                <a class="btn btn-sm btn-outline-secondary" href="asset_detail.html?id=${asset.asset_id}">View</a>
            </div>
            <div class="d-flex gap-2 mb-3">
                ${statusBadge(asset.asset_status)}
                <span class="ws-chip">${asset.asset_type}</span>
            </div>
            <div class="ws-asset-meta">
                <div><span>Brand</span><strong>${asset.brand || "-"}</strong></div>
                <div><span>Location</span><strong>${asset.location || "-"}</strong></div>
            </div>
            ${asset.qr_code_image_url ? `
                <div class="mt-3 text-center">
                    <img src="${asset.qr_code_image_url}" alt="QR Code" style="width: 60px; height: 60px; cursor: pointer;" 
                         onclick="viewQRModal('${asset.qr_code_image_url}', '${asset.asset_code || "Asset ID pending"}')">
                </div>
            ` : ''}
        </article>
    `).join("")}</div>`;

    // Add click handlers after rendering
    container.querySelectorAll("img[onclick]").forEach(img => {
        img.addEventListener("click", function(e) {
            const url = this.src;
            const id = this.getAttribute("onclick").match(/'([^']*)'/)[1];
            viewQRModal(url, id);
        });
    });
}

async function initAssetsPage() {
    shellTemplate("Assets", "assets", `
        <div class="mb-4 d-flex justify-content-between align-items-center">
            <div>
                <h2 class="h4">Assets</h2>
                <p class="text-muted mb-0">Manage your organization's assets</p>
            </div>
            <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#addAssetModal">
                <i class="bi bi-plus-circle"></i> Add Asset
            </button>
        </div>
        <div class="ws-card mb-4">
            <div class="row g-3">
                <div class="col-md-4"><input class="form-control" id="asset-search" placeholder="Search assets"></div>
                <div class="col-md-3">
                    <select class="form-select" id="status-filter">
                        <option value="">All Status</option>
                        <option>Available</option>
                        <option>Assigned</option>
                        <option>In Repair</option>
                        <option>Retired</option>
                        <option>Lost</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <select class="form-select" id="type-filter">
                        <option value="">All Types</option>
                        <option>Laptop</option><option>Desktop</option><option>Server</option><option>Furniture</option>
                        <option>Printer</option><option>Phone</option><option>Monitor</option><option>UPS</option><option>Other</option>
                    </select>
                </div>
                <div class="col-md-2"><button class="btn btn-secondary w-100" id="filter-btn">Apply</button></div>
            </div>
        </div>
        <div id="assets-grid"></div>
        <div class="ws-pagination mt-3" id="assets-pagination"></div>

        <!-- Add Asset Modal -->
        <div class="modal fade" id="addAssetModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Add New Asset</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="addAssetForm" class="ws-form">
                            <div class="row g-3 mb-4">
                                <h6 class="col-12 text-muted">Asset Information</h6>
                                <div class="col-md-6">
                                    <label class="form-label">Asset Name *</label>
                                    <input type="text" class="form-control" name="asset_name" required>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Asset Type *</label>
                                    <select class="form-select" name="asset_type" required></select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Serial Number *</label>
                                    <input type="text" class="form-control" name="serial_number" required>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Category *</label>
                                    <select class="form-select" name="category" required>
                                        <option value="">Select Category</option>
                                        <option value="IT">IT</option>
                                        <option value="Non-IT">Non-IT</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Model</label>
                                    <input type="text" class="form-control" name="model">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Brand</label>
                                    <input type="text" class="form-control" name="brand">
                                </div>
                                <div class="col-12">
                                    <label class="form-label">Specifications</label>
                                    <textarea class="form-control" name="specifications" rows="2"></textarea>
                                </div>
                            </div>

                            <div class="row g-3 mb-4">
                                <h6 class="col-12 text-muted">Purchase Information</h6>
                                <div class="col-md-6">
                                    <label class="form-label">Purchase Date</label>
                                    <input type="date" class="form-control" name="purchase_date">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Purchase Cost</label>
                                    <input type="number" class="form-control" name="purchase_cost" step="0.01">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Vendor Name</label>
                                    <input type="text" class="form-control" name="vendor_name">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Invoice Number</label>
                                    <input type="text" class="form-control" name="invoice_number">
                                </div>
                            </div>

                            <div class="row g-3 mb-4">
                                <h6 class="col-12 text-muted">Warranty Information</h6>
                                <div class="col-md-6">
                                    <label class="form-label">Warranty Start Date</label>
                                    <input type="date" class="form-control" name="warranty_start_date">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Warranty Expiry (Years)</label>
                                    <input type="number" class="form-control" name="warranty_expiry" min="0">
                                </div>
                            </div>

                            <div class="row g-3">
                                <h6 class="col-12 text-muted">Status & Organization</h6>
                                <div class="col-md-6">
                                    <label class="form-label">Asset Status *</label>
                                    <select class="form-select" name="asset_status" required></select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Condition *</label>
                                    <select class="form-select" name="condition_status" required></select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Location *</label>
                                    <select class="form-select" name="location" required></select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Department *</label>
                                    <select class="form-select" name="department" required></select>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="submitAssetBtn">
                            <i class="bi bi-plus-circle"></i> Create Asset
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- QR Code Modal -->
        <div class="modal fade" id="qrModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Asset QR Code</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center">
                        <img id="qrCodeImage" src="" alt="QR Code" class="img-fluid" style="max-width: 300px;">
                    </div>
                </div>
            </div>
        </div>
    `);

    const state = { page: 1, pageSize: 8, total: 0 };

    const loadAssets = async () => {
        const params = new URLSearchParams();
        params.set("page", String(state.page));
        params.set("page_size", String(state.pageSize));
        const search = document.getElementById("asset-search").value.trim();
        const status = document.getElementById("status-filter").value;
        const type = document.getElementById("type-filter").value;
        if (search) params.set("search", search);
        if (status) params.set("status_filter", status);
        if (type) params.set("type_filter", type);

        const data = await API.get(`/assets?${params.toString()}`);
        state.total = data.total;
        renderAssetCards("assets-grid", data.items);

        const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
        const from = state.total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
        const to = Math.min(state.total, state.page * state.pageSize);
        const pager = document.getElementById("assets-pagination");
        pager.innerHTML = `
            <div class="small text-muted-custom">Showing ${from}-${to} of ${state.total}</div>
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-secondary" id="assets-prev" ${state.page <= 1 ? "disabled" : ""}>Previous</button>
                <button class="btn btn-sm btn-outline-secondary" id="assets-next" ${state.page >= totalPages ? "disabled" : ""}>Next</button>
            </div>
        `;
        document.getElementById("assets-prev")?.addEventListener("click", async () => {
            if (state.page > 1) {
                state.page -= 1;
                await loadAssets();
            }
        });
        document.getElementById("assets-next")?.addEventListener("click", async () => {
            if (state.page < totalPages) {
                state.page += 1;
                await loadAssets();
            }
        });
    };

    document.getElementById("filter-btn").addEventListener("click", async () => {
        state.page = 1;
        try {
            await loadAssets();
        } catch (error) {
            showToast(error.message, "error");
        }
    });
    document.getElementById("asset-search").addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            state.page = 1;
            try {
                await loadAssets();
            } catch (error) {
                showToast(error.message, "error");
            }
        }
    });

    // Load dropdown data
    try {
        const dropdownData = await API.get("/assets/meta/dropdowns");
        
        // Populate asset types
        const assetTypeSelect = document.querySelector('select[name="asset_type"]');
        if (assetTypeSelect) {
            assetTypeSelect.innerHTML = '<option value="">Select Asset Type</option>' + 
                dropdownData.asset_types.map(t => `<option value="${t}">${t}</option>`).join('');
        }
        
        // Populate asset status
        const assetStatusSelect = document.querySelector('select[name="asset_status"]');
        if (assetStatusSelect) {
            assetStatusSelect.innerHTML = '<option value="">Select Status</option>' + 
                dropdownData.asset_statuses.map(s => `<option value="${s}">${s}</option>`).join('');
        }
        
        // Populate condition status
        const conditionSelect = document.querySelector('select[name="condition_status"]');
        if (conditionSelect) {
            conditionSelect.innerHTML = '<option value="">Select Condition</option>' + 
                dropdownData.conditions.map(c => `<option value="${c}">${c}</option>`).join('');
        }
        
        // Populate locations
        const locationSelect = document.querySelector('select[name="location"]');
        if (locationSelect) {
            const locations = Array.isArray(dropdownData.locations)
                ? dropdownData.locations
                : Object.keys(dropdownData.locations || {});
            locationSelect.innerHTML = '<option value="">Select Location</option>' + 
                locations.map(l => `<option value="${l}">${l}</option>`).join('');
        }
        
        // Populate departments
        const departmentSelect = document.querySelector('select[name="department"]');
        if (departmentSelect) {
            const departments = Array.isArray(dropdownData.departments)
                ? dropdownData.departments
                : Object.keys(dropdownData.departments || {});
            departmentSelect.innerHTML = '<option value="">Select Department</option>' + 
                departments.map(d => `<option value="${d}">${d}</option>`).join('');
        }
    } catch (error) {
        showToast("Failed to load form options", "error");
    }

    // Handle Add Asset form submission
    const submitAssetBtn = document.getElementById("submitAssetBtn");
    if (submitAssetBtn) {
        submitAssetBtn.addEventListener("click", async () => {
            const form = document.getElementById("addAssetForm");
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            setFormBusy(form, true, "Creating...");
            
            try {
                const formData = new FormData(form);
                const data = {
                    asset_name: formData.get("asset_name"),
                    asset_type: formData.get("asset_type"),
                    serial_number: formData.get("serial_number"),
                    category: formData.get("category"),
                    model: formData.get("model") || null,
                    brand: formData.get("brand") || null,
                    specifications: formData.get("specifications") || null,
                    purchase_date: formData.get("purchase_date") || null,
                    purchase_cost: formData.get("purchase_cost") ? parseFloat(formData.get("purchase_cost")) : null,
                    vendor_name: formData.get("vendor_name") || null,
                    invoice_number: formData.get("invoice_number") || null,
                    warranty_start_date: formData.get("warranty_start_date") || null,
                    warranty_expiry: formData.get("warranty_expiry") ? parseInt(formData.get("warranty_expiry")) : null,
                    asset_status: formData.get("asset_status"),
                    condition_status: formData.get("condition_status"),
                    location: formData.get("location"),
                    department: formData.get("department"),
                };

                const response = await API.post("/assets", data);
                
                // Show success with custom asset ID
                showToast(`Asset created successfully! (ID: ${response.asset_code || response.asset_id})`, "success");
                
                // Reset form and close modal
                form.reset();
                const modal = bootstrap.Modal.getInstance(document.getElementById("addAssetModal"));
                if (modal) modal.hide();
                
                // Reload assets list
                state.page = 1;
                await loadAssets();
            } catch (error) {
                showToast(error.message || "Failed to create asset", "error");
            } finally {
                setFormBusy(form, false);
            }
        });
    }

    await loadAssets();
}

async function initAddAssetPage() {
    shellTemplate("Add Asset", "add_asset", `
        <div class="ws-card">
            <form id="asset-form" class="row g-3">
                <div class="col-md-6"><input required name="asset_name" class="form-control" placeholder="Asset Name"></div>
                <div class="col-md-3">
                    <select required name="asset_type" class="form-select">
                        <option value="">Asset Type</option>
                        <option>Laptop</option><option>Desktop</option><option>Server</option><option>Furniture</option>
                        <option>Printer</option><option>Phone</option><option>Monitor</option><option>UPS</option><option>Other</option>
                    </select>
                </div>
                <div class="col-md-3"><select required name="category" class="form-select"><option value="">Category</option><option>IT</option><option>Non-IT</option></select></div>
                <div class="col-md-6"><input required name="serial_number" class="form-control" placeholder="Serial Number"></div>
                <div class="col-md-3"><input name="brand" class="form-control" placeholder="Brand"></div>
                <div class="col-md-3"><input name="model" class="form-control" placeholder="Model"></div>
                <div class="col-md-4"><input name="department" class="form-control" placeholder="Department"></div>
                <div class="col-md-4"><input name="location" class="form-control" placeholder="Location"></div>
                <div class="col-md-4"><select name="condition_status" class="form-select"><option>New</option><option>Good</option><option>Damaged</option></select></div>
                <div class="col-md-4"><input name="purchase_date" type="date" class="form-control"></div>
                <div class="col-md-4"><input name="purchase_cost" type="number" step="0.01" class="form-control" placeholder="Purchase Cost"></div>
                <div class="col-md-4"><input name="vendor_name" class="form-control" placeholder="Vendor"></div>
                <div class="col-md-6"><textarea name="specifications" class="form-control" rows="3" placeholder="Specifications"></textarea></div>
                <div class="col-md-3"><input name="warranty_start_date" type="date" class="form-control"></div>
                <div class="col-md-3"><input name="warranty_expiry" type="number" class="form-control" placeholder="Warranty Years"></div>
                <div class="col-12 d-flex justify-content-end"><button class="btn btn-primary">Create Asset</button></div>
            </form>
            <div id="asset-form-message" class="mt-3 text-muted-custom"></div>
        </div>
    `);

    document.getElementById("asset-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        setFormBusy(form, true, "Creating...");
        try {
            const payload = Object.fromEntries(new FormData(form).entries());
            Object.keys(payload).forEach((key) => {
                if (payload[key] === "") delete payload[key];
            });
            if (payload.purchase_cost) payload.purchase_cost = Number(payload.purchase_cost);
            if (payload.warranty_expiry) payload.warranty_expiry = Number(payload.warranty_expiry);
            const result = await API.post("/assets", payload);
            document.getElementById("asset-form-message").textContent = `${result.message}. Asset ID: ${result.asset_code || "Asset ID pending"}`;
            showToast("Asset created successfully.");
            form.reset();
        } catch (error) {
            showToast(error.message, "error");
        } finally {
            setFormBusy(form, false);
        }
    });
}

async function initAssetDetailPage() {
    shellTemplate("Asset Detail", "assets", `
        <div class="row g-4">
            <div class="col-lg-7"><div class="ws-card" id="asset-detail"></div></div>
            <div class="col-lg-5">
                <div class="ws-table-card mb-4"><h5 class="mb-3">Transaction History</h5><div id="asset-transactions"></div></div>
                <div class="ws-table-card"><h5 class="mb-3">Maintenance History</h5><div id="asset-maintenance"></div></div>
            </div>
        </div>
    `);

    const assetId = new URLSearchParams(window.location.search).get("id");
    if (!assetId) {
        document.getElementById("asset-detail").innerHTML = `<div class="ws-empty">Missing asset id.</div>`;
        return;
    }

    const data = await API.get(`/assets/${assetId}`);
    const asset = data.asset;
    const canEdit = Auth.hasRole(["Admin", "IT Manager"]);

    const fullAssetFields = [
        ["asset_code", "Asset ID"],
        ["asset_id", "Record ID"],
        ["asset_name", "Asset Name"],
        ["asset_type", "Asset Type"],
        ["category", "Category"],
        ["serial_number", "Serial Number"],
        ["qr_code_value", "QR Code Value"],
        ["qr_code_image_url", "QR Code Image URL"],
        ["model", "Model"],
        ["brand", "Brand"],
        ["specifications", "Specifications"],
        ["purchase_date", "Purchase Date"],
        ["purchase_cost", "Purchase Cost"],
        ["vendor_name", "Vendor Name"],
        ["invoice_number", "Invoice Number"],
        ["warranty_start_date", "Warranty Start Date"],
        ["warranty_expiry", "Warranty Expiry (Years)"],
        ["asset_status", "Asset Status"],
        ["condition_status", "Condition Status"],
        ["location", "Location"],
        ["department", "Department"],
        ["is_retired", "Is Retired"],
        ["created_on", "Created On"],
        ["modified_on", "Modified On"],
        ["created_by", "Created By"],
        ["modified_by", "Modified By"],
    ];

    const renderAssetFieldValue = (key, value) => {
        if (value === null || value === undefined || value === "") return "-";
        if (typeof value === "boolean") return value ? "Yes" : "No";
        if (key === "is_retired") return String(value) === "1" ? "Yes" : "No";
        if (key === "purchase_cost") {
            const amount = Number(value);
            return Number.isFinite(amount) ? amount.toFixed(2) : value;
        }
        return value;
    };

    document.getElementById("asset-detail").innerHTML = `
        <div class="d-flex justify-content-between align-items-start mb-3">
            <div>
                <h4 class="mb-1">${asset.asset_name}</h4>
                <div class="text-muted-custom">${asset.asset_code || "Asset ID pending"} | ${asset.brand || "-"} ${asset.model || ""}</div>
            </div>
            ${statusBadge(asset.asset_status)}
        </div>
        <div class="row g-3 mb-3">
            <div class="col-md-6"><strong>Type:</strong> ${asset.asset_type}</div>
            <div class="col-md-6"><strong>Serial:</strong> ${asset.serial_number}</div>
            <div class="col-md-6"><strong>Department:</strong> ${asset.department || "-"}</div>
            <div class="col-md-6"><strong>Location:</strong> ${asset.location || "-"}</div>
            <div class="col-md-6"><strong>Condition:</strong> ${asset.condition_status}</div>
            <div class="col-md-6"><strong>QR Value:</strong> ${asset.qr_code_value ?? "-"}</div>
            <div class="col-12"><strong>Specifications:</strong><br>${asset.specifications || "-"}</div>
        </div>
        <div class="ws-card ws-card-inner mb-3">
            <h6 class="mb-3">Asset Master Data</h6>
            <div class="row g-2">
                ${fullAssetFields
                    .map(([key, label]) => `
                        <div class="col-md-6">
                            <div class="border rounded p-2 h-100 bg-light-subtle">
                                <div class="small text-muted-custom">${label}</div>
                                <div class="fw-semibold text-break">${renderAssetFieldValue(key, asset[key])}</div>
                            </div>
                        </div>
                    `)
                    .join("")}
            </div>
            ${asset.qr_code_image_url ? `<div class="mt-3"><a class="btn btn-sm btn-outline-secondary" href="${API.baseUrl}${asset.qr_code_image_url}" target="_blank">Open Current QR Image</a></div>` : ""}
        </div>
        ${canEdit ? `
            <div class="ws-card ws-card-inner mb-3">
                <h6 class="mb-3">Edit Asset</h6>
                <form id="asset-edit-form" class="row g-2">
                    <div class="col-md-6"><input class="form-control" name="asset_name" value="${asset.asset_name || ""}" placeholder="Asset Name"></div>
                    <div class="col-md-6"><input class="form-control" name="department" value="${asset.department || ""}" placeholder="Department"></div>
                    <div class="col-md-6"><input class="form-control" name="location" value="${asset.location || ""}" placeholder="Location"></div>
                    <div class="col-md-6">
                        <select name="condition_status" class="form-select">
                            <option ${asset.condition_status === "New" ? "selected" : ""}>New</option>
                            <option ${asset.condition_status === "Good" ? "selected" : ""}>Good</option>
                            <option ${asset.condition_status === "Damaged" ? "selected" : ""}>Damaged</option>
                        </select>
                    </div>
                    <div class="col-12 d-flex justify-content-end"><button class="btn btn-primary" type="submit">Save Changes</button></div>
                </form>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-secondary" id="generate-qr-btn">Generate QR</button>
                ${Auth.hasRole(["Admin"]) ? `<button class="btn btn-outline-danger" id="retire-btn">Retire Asset</button>` : ""}
            </div>
        ` : ""}
        <div class="mt-3" id="asset-detail-message"></div>
    `;

    document.getElementById("asset-edit-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        setFormBusy(form, true, "Saving...");
        try {
            const payload = Object.fromEntries(new FormData(form).entries());
            await API.put(`/assets/${assetId}`, payload);
            showToast("Asset updated successfully.");
            window.location.reload();
        } catch (error) {
            showToast(error.message, "error");
        } finally {
            setFormBusy(form, false);
        }
    });

    document.getElementById("generate-qr-btn")?.addEventListener("click", async () => {
        try {
            const result = await API.post(`/assets/${assetId}/qr`, {});
            document.getElementById("asset-detail-message").innerHTML = `<a class="btn btn-sm btn-outline-secondary" href="${API.baseUrl}${result.qr_code_image_url}" target="_blank">Open QR Image</a>`;
            showToast("QR generated.");
        } catch (error) {
            showToast(error.message, "error");
        }
    });

    document.getElementById("retire-btn")?.addEventListener("click", async () => {
        try {
            await API.patch(`/assets/${assetId}/retire`);
            showToast("Asset retired successfully.");
            window.location.reload();
        } catch (error) {
            showToast(error.message, "error");
        }
    });

    renderTable("asset-transactions", [
        { key: "transaction_type", label: "Type" },
        { key: "from_employee_name", label: "From" },
        { key: "to_assignee_name", label: "To" },
    ], data.transactions);
    renderTable("asset-maintenance", [
        { key: "issue_type", label: "Issue" },
        { key: "maintenance_status", label: "Status", render: (row) => statusBadge(row.maintenance_status) },
        { key: "vendor", label: "Vendor" },
    ], data.maintenance);
}

async function initTransactionsPage() {
    shellTemplate("Transactions", "transactions", `<div class="ws-table-card"><div id="transactions-list"></div></div>`);
    const rows = await API.get("/transactions");
    renderTable("transactions-list", [
        { key: "asset_name", label: "Asset" },
        { key: "transaction_type", label: "Type" },
        { key: "from_employee_name", label: "From" },
        { key: "to_assignee_name", label: "To" },
        { key: "action_date", label: "Date" },
    ], rows);
}

async function loadUsersForSelect(selectId) {
    const rows = await API.get("/users/assignable");
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = `<option value="">Select User</option>` + rows
        .filter((row) => row.is_active)
        .map((row) => `<option value="${row.user_id}">${row.user_name} (${row.role})</option>`)
        .join("");
}

async function loadAssetsForSelect(selectId, status) {
    const rows = await API.get(`/assets?status_filter=${encodeURIComponent(status)}&page_size=100`);
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = `<option value="">Select Asset</option>` + rows.items
        .map((row) => `<option value="${row.asset_id}">${row.asset_name} - ${row.serial_number}</option>`)
        .join("");
}

async function initAssignPage() {
    shellTemplate("Assign Asset", "assign", `
        <div class="ws-card">
            <form id="assign-form" class="row g-3">
                <div class="col-md-6"><select id="assign-asset" class="form-select" required></select></div>
                <div class="col-md-6"><select id="assign-user" class="form-select" required></select></div>
                <div class="col-12"><textarea id="assign-remarks" class="form-control" rows="3" placeholder="Remarks"></textarea></div>
                <div class="col-12 d-flex justify-content-end"><button class="btn btn-primary">Assign</button></div>
            </form>
            <div id="assign-message" class="mt-3 text-muted-custom"></div>
        </div>
    `);
    await loadAssetsForSelect("assign-asset", "Available");
    await loadUsersForSelect("assign-user");
    document.getElementById("assign-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        setFormBusy(form, true, "Assigning...");
        try {
            const result = await API.post("/transactions/assign", {
                asset_id: Number(document.getElementById("assign-asset").value),
                to_assignee: Number(document.getElementById("assign-user").value),
                remarks: document.getElementById("assign-remarks").value,
            });
            document.getElementById("assign-message").textContent = result.message;
            showToast("Asset assigned.");
            form.reset();
            await loadAssetsForSelect("assign-asset", "Available");
            await loadUsersForSelect("assign-user");
        } catch (error) {
            showToast(error.message, "error");
        } finally {
            setFormBusy(form, false);
        }
    });
}

async function initTransferPage() {
    shellTemplate("Transfer Asset", "transfer", `
        <div class="ws-card">
            <form id="transfer-form" class="row g-3">
                <div class="col-md-6"><select id="transfer-asset" class="form-select" required></select></div>
                <div class="col-md-6"><select id="transfer-user" class="form-select" required></select></div>
                <div class="col-12"><textarea id="transfer-remarks" class="form-control" rows="3" placeholder="Remarks"></textarea></div>
                <div class="col-12 d-flex justify-content-end"><button class="btn btn-primary">Transfer</button></div>
            </form>
            <div id="transfer-message" class="mt-3 text-muted-custom"></div>
        </div>
    `);
    await loadAssetsForSelect("transfer-asset", "Assigned");
    await loadUsersForSelect("transfer-user");
    document.getElementById("transfer-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        setFormBusy(form, true, "Transferring...");
        try {
            const result = await API.post("/transactions/transfer", {
                asset_id: Number(document.getElementById("transfer-asset").value),
                to_assignee: Number(document.getElementById("transfer-user").value),
                remarks: document.getElementById("transfer-remarks").value,
            });
            document.getElementById("transfer-message").textContent = result.message;
            showToast("Asset transferred.");
            form.reset();
            await loadAssetsForSelect("transfer-asset", "Assigned");
            await loadUsersForSelect("transfer-user");
        } catch (error) {
            showToast(error.message, "error");
        } finally {
            setFormBusy(form, false);
        }
    });
}

async function initMaintenancePage() {
    shellTemplate("Maintenance", "maintenance", `
        <div class="row g-4">
            <div class="col-lg-5">
                <div class="ws-card">
                    <form id="maintenance-form" class="row g-3">
                        <div class="col-12"><select id="maintenance-asset" class="form-select" required></select></div>
                        <div class="col-md-6"><select id="issue-type" class="form-select" required><option value="">Issue Type</option><option>Repair</option><option>Physical Damage</option><option>Theft</option><option>Software Issue</option></select></div>
                        <div class="col-md-6"><input id="maintenance-vendor" class="form-control" placeholder="Vendor"></div>
                        <div class="col-12"><textarea id="issue-description" class="form-control" rows="3" placeholder="Issue Description"></textarea></div>
                        <div class="col-12"><textarea id="resolution-notes" class="form-control" rows="3" placeholder="Resolution Notes"></textarea></div>
                        <div class="col-12 form-check"><input class="form-check-input" type="checkbox" id="warranty-applicable"><label class="form-check-label" for="warranty-applicable">Warranty Applicable</label></div>
                        <div class="col-12 d-flex justify-content-end"><button class="btn btn-primary">Log Issue</button></div>
                    </form>
                </div>
            </div>
            <div class="col-lg-7"><div class="ws-table-card"><h5 class="mb-3">Maintenance Records</h5><div id="maintenance-list"></div></div></div>
        </div>
    `);
    await loadAssetsForSelect("maintenance-asset", "Assigned");
    const rows = await API.get("/maintenance");
    renderTable("maintenance-list", [
        { key: "asset_name", label: "Asset" },
        { key: "issue_type", label: "Issue" },
        { key: "vendor", label: "Vendor" },
        { key: "maintenance_status", label: "Status", render: (row) => statusBadge(row.maintenance_status) },
    ], rows);

    document.getElementById("maintenance-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        setFormBusy(form, true, "Saving...");
        try {
            await API.post("/maintenance", {
                asset_id: Number(document.getElementById("maintenance-asset").value),
                issue_description: document.getElementById("issue-description").value,
                issue_type: document.getElementById("issue-type").value,
                vendor: document.getElementById("maintenance-vendor").value,
                resolution_notes: document.getElementById("resolution-notes").value,
                warranty_applicable: document.getElementById("warranty-applicable").checked,
            });
            showToast("Maintenance issue logged.");
            window.location.reload();
        } catch (error) {
            showToast(error.message, "error");
        } finally {
            setFormBusy(form, false);
        }
    });
}

async function initUsersPage() {
    shellTemplate("Users", "users", `
        <div class="row g-4">
            <div class="col-lg-4">
                <div class="ws-card">
                    <form id="user-form" class="row g-3">
                        <div class="col-12"><input name="user_name" class="form-control" placeholder="Full Name" required></div>
                        <div class="col-12"><input name="username" class="form-control" placeholder="Username" required></div>
                        <div class="col-12"><input name="email" type="email" class="form-control" placeholder="Email" required></div>
                        <div class="col-12"><input name="password" type="password" class="form-control" placeholder="Password" required></div>
                        <div class="col-12"><select name="role" class="form-select" required><option value="">Role</option><option>Admin</option><option>IT Manager</option><option>Viewer</option></select></div>
                        <div class="col-12 d-flex justify-content-end"><button class="btn btn-primary">Create User</button></div>
                    </form>
                </div>
            </div>
            <div class="col-lg-8"><div class="ws-table-card"><div id="users-list"></div></div></div>
        </div>
    `);

    const rows = await API.get("/users");
    renderTable("users-list", [
        { key: "user_name", label: "Name" },
        { key: "username", label: "Username" },
        { key: "role", label: "Role" },
        { key: "is_active", label: "Status", render: (row) => row.is_active ? "Active" : "Inactive" },
        { key: "user_id", label: "Action", render: (row) => row.is_active ? `<button class="btn btn-sm btn-outline-danger" data-action="deactivate-user" data-user-id="${row.user_id}">Deactivate</button>` : "-" },
    ], rows);

    document.getElementById("user-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        setFormBusy(form, true, "Creating...");
        try {
            const payload = Object.fromEntries(new FormData(form).entries());
            await API.post("/users", payload);
            showToast("User created.");
            window.location.reload();
        } catch (error) {
            showToast(error.message, "error");
        } finally {
            setFormBusy(form, false);
        }
    });

    document.getElementById("users-list").addEventListener("click", async (event) => {
        const button = event.target.closest("[data-action='deactivate-user']");
        if (!button) return;
        try {
            await API.patch(`/users/${Number(button.dataset.userId)}/deactivate`);
            showToast("User deactivated.");
            window.location.reload();
        } catch (error) {
            showToast(error.message, "error");
        }
    });
}

async function initQrPage() {
    shellTemplate("QR Print", "qr_print", `
        <div class="ws-card">
            <form id="qr-form" class="row g-3">
                <div class="col-md-9"><input class="form-control" id="qr-asset-id" placeholder="Enter asset id" required></div>
                <div class="col-md-3"><button class="btn btn-primary w-100">Generate</button></div>
            </form>
            <div id="qr-result" class="mt-4"></div>
        </div>
    `);
    document.getElementById("qr-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        setFormBusy(form, true, "Generating...");
        try {
            const result = await API.post(`/assets/${document.getElementById("qr-asset-id").value}/qr`, {});
            document.getElementById("qr-result").innerHTML = `
                <div class="text-center">
                    <img class="img-fluid mb-3" src="${API.baseUrl}${result.qr_code_image_url}" alt="QR Code">
                    <div class="mb-3">${result.qr_code_value}</div>
                    <button class="btn btn-outline-secondary" onclick="window.print()">Print QR</button>
                </div>
            `;
            showToast("QR code generated.");
        } catch (error) {
            showToast(error.message, "error");
        } finally {
            setFormBusy(form, false);
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const page = document.body.dataset.page;
    Auth.requireAuth();
    if (page && !Auth.canAccessPage(page)) {
        showToast("Access denied for your role.", "error");
        setTimeout(() => {
            window.location.href = Auth.roleHomePage();
        }, 700);
        return;
    }

    try {
        switch (page) {
            case "dashboard":
                await initDashboardPage();
                break;
            case "assets":
                await initAssetsPage();
                break;
            case "add_asset":
                await initAddAssetPage();
                break;
            case "asset_detail":
                await initAssetDetailPage();
                break;
            case "transactions":
                await initTransactionsPage();
                break;
            case "assign":
                await initAssignPage();
                break;
            case "transfer":
                await initTransferPage();
                break;
            case "maintenance":
                await initMaintenancePage();
                break;
            case "users":
                await initUsersPage();
                break;
            case "qr_print":
                await initQrPage();
                break;
            default:
                break;
        }
    } catch (error) {
        showToast(error.message, "error");
    }
});
