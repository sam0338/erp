const InventoryDashboardPage = {
  render: async () => `
    <div class="row mb-4">
      <div class="col-md-8">
        <h2><i class="fas fa-warehouse me-2"></i>Inventory Management</h2>
      </div>
      <div class="col-md-4 text-end">
        <button class="btn btn-sm btn-outline-success" onclick="InventoryDashboardActions.exportCSV()">
          <i class="fas fa-file-csv me-1"></i>Export Stock List
        </button>
        <button class="btn btn-sm btn-primary" onclick="navigateTo('inventory-stock-in')">
          <i class="fas fa-arrow-down me-1"></i>Stock In
        </button>
        <button class="btn btn-sm btn-warning" onclick="navigateTo('inventory-stock-out')">
          <i class="fas fa-arrow-up me-1"></i>Stock Out
        </button>
        <button class="btn btn-sm btn-info" onclick="navigateTo('inventory-transfer')">
          <i class="fas fa-exchange me-1"></i>Transfer
        </button>
      </div>
    </div>

    <div class="row">
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <p class="text-muted small">Total Materials</p>
            <h3 id="totalMaterials">-</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <p class="text-muted small">Low Stock Items</p>
            <h3 id="lowStockCount" class="text-warning">-</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <p class="text-muted small">Stock Value</p>
            <h3 id="stockValue">-</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <p class="text-muted small">Warehouses</p>
            <h3 id="warehouseCount">-</h3>
          </div>
        </div>
      </div>
    </div>

    <div class="row mt-4">
      <div class="col-md-12">
        <ul class="nav nav-tabs mb-3">
          <li class="nav-item">
            <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#byCategory">Stock by Category</button>
          </li>
          <li class="nav-item">
            <button class="nav-link" data-bs-toggle="tab" data-bs-target="#ledger">Stock Ledger (by Warehouse)</button>
          </li>
          <li class="nav-item">
            <button class="nav-link" data-bs-toggle="tab" data-bs-target="#lowstock">Low Stock Alerts</button>
          </li>
          <li class="nav-item">
            <button class="nav-link" data-bs-toggle="tab" data-bs-target="#batches">Batch / Heat / Coil / Serial</button>
          </li>
          <li class="nav-item">
            <button class="nav-link" data-bs-toggle="tab" data-bs-target="#aging">Aging &amp; Slow-Moving</button>
          </li>
        </ul>

        <div class="tab-content">
          <!-- Category-wise complete stock view -->
          <div class="tab-pane fade show active" id="byCategory">
            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <div class="row mb-3">
                  <div class="col-md-4">
                    <select class="form-control" id="categoryFilter" onchange="InventoryDashboardActions.renderByCategory()">
                      <option value="">All Categories</option>
                    </select>
                  </div>
                </div>
                <div id="stockByCategory">Loading...</div>
              </div>
            </div>
          </div>

          <div class="tab-pane fade" id="ledger">
            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <table class="table table-hover mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>Category</th>
                      <th>Material</th>
                      <th>Warehouse</th>
                      <th>Balance</th>
                      <th>Reorder Level</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody id="ledgerBody">
                    <tr><td colspan="6" class="text-center text-muted">Loading...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="tab-pane fade" id="lowstock">
            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <table class="table table-hover mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>Category</th>
                      <th>Material</th>
                      <th>Current Stock (all warehouses)</th>
                      <th>Reorder Level</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody id="lowStockBody">
                    <tr><td colspan="5" class="text-center text-muted">Loading...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="tab-pane fade" id="batches">
            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <p class="text-muted small">Every batch of stock currently on hand, with its full traceability code.</p>
                <table class="table table-hover mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>Material</th><th>Warehouse</th><th>Batch No.</th><th>Heat No.</th><th>Coil No.</th><th>Serial No.</th>
                      <th>Qty Remaining</th><th>Received</th><th>Source</th>
                    </tr>
                  </thead>
                  <tbody id="batchesBody">
                    <tr><td colspan="9" class="text-center text-muted">Loading...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="tab-pane fade" id="aging">
            <div class="row mb-3">
              <div class="col-md-4">
                <label class="form-label small">Flag as slow-moving/dead if no outward movement in:</label>
                <select class="form-control form-control-sm" id="movementDaysFilter" onchange="InventoryDashboardActions.renderMovementReport()">
                  <option value="90">90 days (Slow-Moving)</option>
                  <option value="180">180 days (Dead Stock)</option>
                </select>
              </div>
            </div>

            <div class="card border-0 shadow-sm mb-3">
              <div class="card-body">
                <h6>Stock Aging (batches on hand)</h6>
                <table class="table table-sm">
                  <thead><tr><th>Material</th><th>Warehouse</th><th>Batch</th><th>Qty</th><th>Age</th><th>Bucket</th></tr></thead>
                  <tbody id="agingBody"><tr><td colspan="6" class="text-center text-muted">Loading...</td></tr></tbody>
                </table>
              </div>
            </div>

            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <h6 id="movementReportTitle">Slow-Moving / Dead Stock</h6>
                <table class="table table-sm">
                  <thead><tr><th>Material</th><th>Current Stock</th><th>Last Movement</th><th>Days Since</th></tr></thead>
                  <tbody id="movementReportBody"><tr><td colspan="4" class="text-center text-muted">Loading...</td></tr></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  init: async () => {
    await InventoryDashboardActions.load();
  }
};

const InventoryDashboardActions = {
  stockSummary: [],
  ledger: [],
  lowStock: [],

  exportCSV: () => {
    exportToCSV('stock-list', [
      { key: 'material_code', label: 'Material Code' },
      { key: 'material_name', label: 'Material Name' },
      { key: 'category', label: 'Category' },
      { key: 'unit_of_measure', label: 'Unit' },
      { key: 'available_quantity', label: 'Available Qty' },
      { key: 'qc_pending_quantity', label: 'QC Pending Qty' },
      { key: 'qc_hold_quantity', label: 'QC Hold Qty' },
      { key: 'reorder_level', label: 'Reorder Level' }
    ], InventoryDashboardActions.stockSummary);
  },

  load: async () => {
    const [ledger, lowStock, summary, valuation] = await Promise.all([
      API.request('GET', '/inventory/ledger'),
      API.request('GET', '/inventory/ledger/low-stock'),
      API.getStockSummary(),
      API.request('GET', '/inventory/valuation')
    ]);

    InventoryDashboardActions.ledger = Array.isArray(ledger) ? ledger : [];
    InventoryDashboardActions.lowStock = Array.isArray(lowStock) ? lowStock : [];
    InventoryDashboardActions.stockSummary = Array.isArray(summary) ? summary : [];

    document.getElementById('totalMaterials').textContent = InventoryDashboardActions.stockSummary.length;
    document.getElementById('lowStockCount').textContent = InventoryDashboardActions.lowStock.length;
    document.getElementById('warehouseCount').textContent = new Set(InventoryDashboardActions.ledger.map(l => l.warehouse_id)).size;
    // BUG FIX: this card existed in the markup but nothing ever set its
    // text — it just showed "-" forever. Wired up to the valuation endpoint.
    const totalValue = Array.isArray(valuation) ? valuation.reduce((s, v) => s + (parseFloat(v.total_value) || 0), 0) : 0;
    document.getElementById('stockValue').textContent = `₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

    // Populate category filter
    const categories = [...new Set(InventoryDashboardActions.stockSummary.map(s => s.category))].sort();
    document.getElementById('categoryFilter').innerHTML =
      '<option value="">All Categories</option>' + categories.map(c => `<option value="${c}">${c}</option>`).join('');

    InventoryDashboardActions.renderByCategory();
    InventoryDashboardActions.renderLedger();
    InventoryDashboardActions.renderLowStock();
    await Promise.all([
      InventoryDashboardActions.renderBatches(),
      InventoryDashboardActions.renderAging(),
      InventoryDashboardActions.renderMovementReport()
    ]);
  },

  renderBatches: async () => {
    const batches = await API.getStockBatches();
    const tbody = document.getElementById('batchesBody');
    if (!Array.isArray(batches)) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">${(batches && batches.error) || 'Could not load.'}</td></tr>`;
      return;
    }
    tbody.innerHTML = batches.map(b => `
      <tr>
        <td>${b.material_name} <span class="text-muted small">(${b.material_code})</span></td>
        <td>${b.warehouse_name}</td>
        <td>${b.batch_number || '-'}</td>
        <td>${b.heat_number || '-'}</td>
        <td>${b.coil_number || '-'}</td>
        <td>${b.serial_number || '-'}</td>
        <td>${b.quantity_remaining} ${b.unit_of_measure || ''}</td>
        <td>${new Date(b.received_date).toLocaleDateString('en-IN')}</td>
        <td class="small text-muted">${b.source || '-'} ${b.source_reference ? `(${b.source_reference})` : ''}</td>
      </tr>
    `).join('') || '<tr><td colspan="9" class="text-center text-muted">No batch-tracked stock yet</td></tr>';
  },

  renderAging: async () => {
    const rows = await API.getStockAging();
    const tbody = document.getElementById('agingBody');
    if (!Array.isArray(rows)) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${(rows && rows.error) || 'Could not load.'}</td></tr>`;
      return;
    }
    const bucketColor = { '0-30 days': 'success', '31-60 days': 'info', '61-90 days': 'warning', '90+ days': 'danger' };
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.material_name}</td>
        <td>${r.warehouse_name}</td>
        <td>${r.batch_number || '-'}</td>
        <td>${r.quantity_remaining} ${r.unit_of_measure || ''}</td>
        <td>${r.age_days} days</td>
        <td><span class="badge bg-${bucketColor[r.age_bucket]}">${r.age_bucket}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="text-center text-muted">No batch-tracked stock yet</td></tr>';
  },

  renderMovementReport: async () => {
    const days = document.getElementById('movementDaysFilter')?.value || 90;
    document.getElementById('movementReportTitle').textContent = days == 180 ? 'Dead Stock (180+ days no movement)' : 'Slow-Moving Stock (90+ days no movement)';
    const rows = await API.getMovementReport(days);
    const tbody = document.getElementById('movementReportBody');
    if (!Array.isArray(rows)) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${(rows && rows.error) || 'Could not load.'}</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr class="table-warning">
        <td>${r.material_name} <span class="text-muted small">(${r.material_code})</span></td>
        <td>${r.current_stock} ${r.unit_of_measure || ''}</td>
        <td>${r.last_movement_date ? new Date(r.last_movement_date).toLocaleDateString('en-IN') : 'Never moved'}</td>
        <td>${r.days_since_movement !== null ? r.days_since_movement + ' days' : '-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="4" class="text-center text-muted">Nothing flagged — all stock has moved recently</td></tr>';
  },

  renderByCategory: () => {
    const filter = document.getElementById('categoryFilter').value;
    const items = filter
      ? InventoryDashboardActions.stockSummary.filter(s => s.category === filter)
      : InventoryDashboardActions.stockSummary;

    // Group by category
    const groups = {};
    items.forEach(i => {
      if (!groups[i.category]) groups[i.category] = [];
      groups[i.category].push(i);
    });

    const categoryNames = Object.keys(groups).sort();
    if (categoryNames.length === 0) {
      document.getElementById('stockByCategory').innerHTML = '<p class="text-muted text-center py-4">No stock data</p>';
      return;
    }

    const html = categoryNames.map(cat => {
      const catItems = groups[cat];
      const catTotal = catItems.reduce((s, i) => s + parseFloat(i.available_quantity || 0), 0);
      const rows = catItems.map(i => {
        const isLow = parseFloat(i.available_quantity) < parseFloat(i.reorder_level);
        return `
          <tr class="${isLow ? 'table-danger' : ''}">
            <td>${i.material_name} <span class="text-muted small">(${i.material_code})</span></td>
            <td class="text-end">${i.available_quantity} ${i.unit_of_measure || ''}</td>
            <td class="text-end">${parseFloat(i.qc_pending_quantity) > 0 ? `<span class="badge bg-secondary">${i.qc_pending_quantity} pending</span>` : '-'}</td>
            <td class="text-end">${parseFloat(i.qc_hold_quantity) > 0 ? `<span class="badge bg-warning text-dark">${i.qc_hold_quantity} on hold</span>` : '-'}</td>
            <td class="text-end">${i.reorder_level}</td>
            <td>${isLow ? '<span class="badge bg-danger">LOW</span>' : '<span class="badge bg-success">OK</span>'}</td>
          </tr>
        `;
      }).join('');

      return `
        <div class="mb-4">
          <h6 class="border-bottom pb-2">
            ${cat} <span class="text-muted small">(${catItems.length} item${catItems.length !== 1 ? 's' : ''}, total ${catTotal})</span>
          </h6>
          <table class="table table-sm mb-0">
            <thead>
              <tr>
                <th>Material</th><th class="text-end">Usable Stock</th><th class="text-end">In QC</th>
                <th class="text-end">On Hold</th><th class="text-end">Reorder Level</th><th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }).join('');

    document.getElementById('stockByCategory').innerHTML = html;
  },

  renderLedger: () => {
    const html = InventoryDashboardActions.ledger.length > 0
      ? InventoryDashboardActions.ledger.map(l => {
          const isLow = parseFloat(l.quantity) <= parseFloat(l.reorder_level);
          return `
            <tr>
              <td>${l.category || 'Uncategorized'}</td>
              <td><strong>${l.material_name}</strong></td>
              <td>${l.warehouse_name}</td>
              <td>${l.quantity} ${l.unit_of_measure || ''}</td>
              <td>${l.reorder_level || 0}</td>
              <td><span class="badge bg-${isLow ? 'danger' : 'success'}">${isLow ? 'LOW' : 'OK'}</span></td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="6" class="text-center text-muted">No stock data</td></tr>';

    document.getElementById('ledgerBody').innerHTML = html;
  },

  renderLowStock: () => {
    // BUG FIX: this whole tab used to read l.current_balance / l.reorder_point,
    // fields the backend never actually returned (it returns `quantity` and
    // `reorder_level`), so every row silently rendered as blank/"undefined"
    // and the OK/LOW comparison was always false. Now uses the real fields,
    // and the backend itself now totals a material across all warehouses
    // before comparing to reorder level (see server-side note).
    const html = InventoryDashboardActions.lowStock.length > 0
      ? InventoryDashboardActions.lowStock.map(l => `
          <tr class="table-danger">
            <td>${l.category || 'Uncategorized'}</td>
            <td><strong>${l.material_name}</strong></td>
            <td>${l.total_quantity} ${l.unit_of_measure || ''}</td>
            <td>${l.reorder_level}</td>
            <td><button class="btn btn-sm btn-primary" onclick="navigateTo('indent-employee')">Raise Indent</button></td>
          </tr>
        `).join('')
      : '<tr><td colspan="5" class="text-center text-muted">All stock levels OK</td></tr>';

    document.getElementById('lowStockBody').innerHTML = html;
  }
};
