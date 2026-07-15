// A catalog-driven report hub: each entry describes how to fetch its data
// and how to render its columns. New reports can be added here without
// touching the rendering logic at all.
const MIS_REPORT_CATALOG = {
  masters: {
    label: 'Masters',
    icon: 'fa-database',
    reports: [
      {
        key: 'vendor-list', title: 'Vendor List', dateFiltered: false,
        fetch: async () => { const r = await API.getVendors(); return Array.isArray(r) ? r : []; },
        columns: [
          { key: 'vendor_code', label: 'Vendor Code' }, { key: 'vendor_name', label: 'Vendor Name' },
          { key: 'contact_person', label: 'Contact' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' },
          { key: 'gst_number', label: 'GST Number' }, { key: 'city', label: 'City' }, { key: 'state', label: 'State' },
          { key: 'rating', label: 'Rating' }
        ]
      },
      {
        key: 'material-list', title: 'Material List', dateFiltered: false,
        fetch: async () => { const r = await API.getMaterials(); return Array.isArray(r) ? r : []; },
        columns: [
          { key: 'material_code', label: 'Material Code' }, { key: 'material_name', label: 'Material Name' },
          { key: 'item_type', label: 'Item Type' }, { key: 'category', label: 'Category' }, { key: 'unit_of_measure', label: 'Unit' },
          { key: 'hsn_code', label: 'HSN Code' }, { key: 'gst_rate', label: 'GST Rate' }, { key: 'barcode', label: 'Barcode' },
          { key: 'reorder_level', label: 'Reorder Level' }
        ]
      }
    ]
  },
  purchase: {
    label: 'Purchase',
    icon: 'fa-cart-shopping',
    reports: [
      {
        key: 'purchase-register', title: 'Purchase Order Register', dateFiltered: true,
        fetch: (f) => API.misReport('purchase-register', f),
        columns: [
          { key: 'po_number', label: 'PO No' }, { key: 'order_date', label: 'Date', date: true },
          { key: 'vendor_name', label: 'Vendor' }, { key: 'item_count', label: 'Items' },
          { key: 'status', label: 'Status' }, { key: 'grand_total', label: 'Value', money: true }
        ]
      },
      {
        key: 'vendor-purchase-summary', title: 'Vendor-wise Purchase Summary', dateFiltered: true,
        fetch: (f) => API.misReport('vendor-purchase-summary', f),
        columns: [
          { key: 'vendor_name', label: 'Vendor' }, { key: 'po_count', label: 'POs' },
          { key: 'total_value', label: 'Total Value', money: true }
        ]
      }
    ]
  },
  inventory: {
    label: 'Inventory',
    icon: 'fa-warehouse',
    reports: [
      {
        key: 'stock-valuation', title: 'Stock Valuation', dateFiltered: false,
        fetch: () => API.getStockValuation(),
        columns: [
          { key: 'material_name', label: 'Material' }, { key: 'warehouse_name', label: 'Warehouse' },
          { key: 'quantity', label: 'Qty' }, { key: 'avg_unit_cost', label: 'Avg Cost', money: true },
          { key: 'total_value', label: 'Total Value', money: true }
        ]
      },
      {
        key: 'stock-summary', title: 'Stock Summary (All Materials)', dateFiltered: false,
        fetch: () => API.getStockSummary(),
        columns: [
          { key: 'material_name', label: 'Material' }, { key: 'unit_of_measure', label: 'Unit' },
          { key: 'available_quantity', label: 'Available Qty' }, { key: 'reorder_level', label: 'Reorder Level' }
        ]
      },
      {
        key: 'stock-aging', title: 'Stock Aging', dateFiltered: false,
        fetch: () => API.getStockAging(),
        columns: [
          { key: 'material_name', label: 'Material' }, { key: 'warehouse_name', label: 'Warehouse' },
          { key: 'batch_number', label: 'Batch' }, { key: 'age_days', label: 'Age (days)' },
          { key: 'quantity_remaining', label: 'Qty Remaining' }
        ]
      }
    ]
  },
  production: {
    label: 'Production',
    icon: 'fa-industry',
    reports: [
      {
        key: 'production-register', title: 'Production Order Register', dateFiltered: true,
        fetch: (f) => API.misReport('production-register', f),
        columns: [
          { key: 'po_number', label: 'PO No' }, { key: 'product_name', label: 'Product' },
          { key: 'start_date', label: 'Start', date: true }, { key: 'status', label: 'Status' },
          { key: 'planned_output', label: 'Planned' }, { key: 'actual_output_quantity', label: 'Actual' },
          { key: 'total_scrap_quantity', label: 'Scrap' }, { key: 'total_rejection_quantity', label: 'Rejection' }
        ]
      },
      {
        key: 'variance', title: 'Production Variance (vs BOM)', dateFiltered: false,
        fetch: async () => { const r = await API.getVarianceReports(); return Array.isArray(r) ? r : []; },
        columns: [
          { key: 'po_number', label: 'PO No' }, { key: 'product_name', label: 'Product' },
          { key: 'planned_output', label: 'Planned Output' }, { key: 'actual_output', label: 'Actual Output' },
          { key: 'yield_percent', label: 'Yield %' }, { key: 'total_scrap', label: 'Scrap' }
        ]
      }
    ]
  },
  quality: {
    label: 'Quality',
    icon: 'fa-magnifying-glass-chart',
    reports: [
      {
        key: 'quality-summary', title: 'Inspection Summary', dateFiltered: true,
        fetch: async (f) => { const r = await API.misReport('quality-summary', f); return (r && r.rows) || []; },
        columns: [
          { key: 'inspection_number', label: 'Inspection No' }, { key: 'material_name', label: 'Material' },
          { key: 'warehouse_name', label: 'Warehouse' }, { key: 'quantity_received', label: 'Received' },
          { key: 'quantity_passed', label: 'Passed' }, { key: 'quantity_hold', label: 'Hold' },
          { key: 'quantity_rejected', label: 'Rejected' }, { key: 'status', label: 'Status' }
        ]
      }
    ]
  },
  sales: {
    label: 'Sales & Dispatch',
    icon: 'fa-truck-loading',
    reports: [
      {
        key: 'sales-register', title: 'Sales Register (All Channels)', dateFiltered: true,
        fetch: (f) => API.misReport('sales-register', f),
        columns: [
          { key: 'invoice_number', label: 'Invoice No' }, { key: 'invoice_date', label: 'Date', date: true },
          { key: 'channel', label: 'Channel' }, { key: 'customer_name', label: 'Customer' },
          { key: 'taxable_value', label: 'Taxable', money: true }, { key: 'tax_amount', label: 'Tax', money: true },
          { key: 'grand_total', label: 'Total', money: true }, { key: 'status', label: 'Status' }
        ]
      },
      {
        key: 'customer-sales-summary', title: 'Customer-wise Sales Summary', dateFiltered: true,
        fetch: (f) => API.misReport('customer-sales-summary', f),
        columns: [
          { key: 'customer_name', label: 'Customer' }, { key: 'invoice_count', label: 'Invoices' },
          { key: 'total_value', label: 'Total Value', money: true }
        ]
      }
    ]
  },
  finance: {
    label: 'Finance',
    icon: 'fa-coins',
    reports: [
      {
        key: 'payables', title: 'Vendor Outstanding (Payables)', dateFiltered: false,
        fetch: async () => { const r = await API.getPayablesSummary(); return (r && r.by_vendor) || []; },
        columns: [{ key: 'vendor_name', label: 'Vendor' }, { key: 'invoice_count', label: 'Invoices' }, { key: 'outstanding', label: 'Outstanding', money: true }]
      },
      {
        key: 'receivables', title: 'Customer Outstanding (Receivables)', dateFiltered: false,
        fetch: async () => { const r = await API.getReceivablesSummary(); return (r && r.by_customer) || []; },
        columns: [{ key: 'customer_name', label: 'Customer' }, { key: 'invoice_count', label: 'Invoices' }, { key: 'outstanding', label: 'Outstanding', money: true }]
      },
      {
        key: 'margin', title: 'Cost & Margin Report', dateFiltered: false,
        fetch: async () => { const r = await API.getMarginReport(); return (r && r.orders) || []; },
        columns: [
          { key: 'so_number', label: 'SO No' }, { key: 'customer_name', label: 'Customer' },
          { key: 'revenue', label: 'Revenue', money: true }, { key: 'estimated_cost', label: 'Est. Cost', money: true },
          { key: 'margin', label: 'Margin', money: true }, { key: 'margin_percent', label: 'Margin %' }
        ]
      }
    ]
  },
  expenses: {
    label: 'Expense Claims',
    icon: 'fa-money-check-dollar',
    reports: [
      {
        key: 'expense-by-employee', title: 'Expense Claims by Employee', dateFiltered: false,
        fetch: async () => { const r = await API.getExpenseClaimsSummary(); return (r && r.by_employee) || []; },
        columns: [
          { key: 'employee_name', label: 'Employee' }, { key: 'department', label: 'Department' },
          { key: 'claim_count', label: 'Claims' }, { key: 'total_amount', label: 'Total', money: true },
          { key: 'settled_amount', label: 'Settled', money: true }, { key: 'outstanding_amount', label: 'Outstanding', money: true }
        ]
      },
      {
        key: 'expense-by-department', title: 'Expense Claims by Department', dateFiltered: false,
        fetch: async () => { const r = await API.getExpenseClaimsSummary(); return (r && r.by_department) || []; },
        columns: [
          { key: 'department', label: 'Department' }, { key: 'claim_count', label: 'Claims' },
          { key: 'total_amount', label: 'Total', money: true }, { key: 'settled_amount', label: 'Settled', money: true },
          { key: 'outstanding_amount', label: 'Outstanding', money: true }
        ]
      }
    ]
  },
  pos: {
    label: 'POS Billing',
    icon: 'fa-cash-register',
    reports: [
      {
        key: 'pos-sales', title: 'POS Bill History', dateFiltered: true,
        fetch: (f) => API.posSalesHistory(f),
        columns: [
          { key: 'invoice_number', label: 'Bill No' }, { key: 'invoice_date', label: 'Date', date: true },
          { key: 'customer_name', label: 'Customer' }, { key: 'customer_mobile', label: 'Mobile' },
          { key: 'warehouse_name', label: 'Outlet' }, { key: 'payment_mode', label: 'Payment' },
          { key: 'grand_total', label: 'Amount', money: true }, { key: 'status', label: 'Status' }
        ]
      }
    ]
  }
};

const MISPage = {
  currentReport: null,
  currentRows: [],

  render: async () => `
    <div class="row mb-4">
      <div class="col-md-12">
        <h2><i class="fas fa-chart-column me-2"></i>MIS Reports</h2>
        <p class="text-muted mb-0">Every module's reports, in one place.</p>
      </div>
    </div>
    <div class="row">
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body" id="misCatalog"></div>
        </div>
      </div>
      <div class="col-md-9">
        <div id="misReportArea">
          <div class="card border-0 shadow-sm">
            <div class="card-body text-center text-muted py-5">
              <i class="fas fa-arrow-left me-2"></i>Pick a report from the left to get started.
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  init: async () => {
    const container = document.getElementById('misCatalog');
    container.innerHTML = Object.entries(MIS_REPORT_CATALOG).map(([groupKey, group]) => `
      <div class="mb-3">
        <div class="fw-bold small text-muted mb-1"><i class="fas ${group.icon} me-1"></i>${group.label}</div>
        ${group.reports.map(r => `
          <button class="btn btn-sm btn-outline-secondary w-100 text-start mb-1 mis-report-btn" data-group="${groupKey}" data-report="${r.key}" onclick="MISPage.selectReport('${groupKey}', '${r.key}')">
            ${r.title}
          </button>
        `).join('')}
      </div>
    `).join('');
  },

  selectReport: async (groupKey, reportKey) => {
    document.querySelectorAll('.mis-report-btn').forEach(b => b.classList.toggle('active', b.dataset.group === groupKey && b.dataset.report === reportKey));
    const report = MIS_REPORT_CATALOG[groupKey].reports.find(r => r.key === reportKey);
    if (!report) return;
    MISPage.currentReport = report;

    const area = document.getElementById('misReportArea');
    area.innerHTML = `
      <div class="card border-0 shadow-sm mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start flex-wrap">
            <h5 class="mb-2">${report.title}</h5>
            <button class="btn btn-sm btn-outline-success" onclick="MISPage.exportCSV()"><i class="fas fa-file-csv me-1"></i>Export CSV</button>
          </div>
          ${report.dateFiltered ? `
          <div class="row g-2 align-items-end mt-1">
            <div class="col-md-3"><label class="form-label small">From</label><input type="date" class="form-control form-control-sm" id="misFrom"></div>
            <div class="col-md-3"><label class="form-label small">To</label><input type="date" class="form-control form-control-sm" id="misTo"></div>
            <div class="col-md-2"><button class="btn btn-sm btn-primary w-100" onclick="MISPage.runReport()">Apply</button></div>
          </div>` : ''}
        </div>
      </div>
      <div class="card border-0 shadow-sm">
        <div class="card-body table-responsive">
          <table class="table table-sm table-hover mb-0">
            <thead class="table-light"><tr>${report.columns.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>
            <tbody id="misReportBody"><tr><td colspan="${report.columns.length}" class="text-center text-muted py-4">Loading...</td></tr></tbody>
          </table>
        </div>
      </div>
    `;
    await MISPage.runReport();
  },

  runReport: async () => {
    const report = MISPage.currentReport;
    if (!report) return;
    const body = document.getElementById('misReportBody');
    body.innerHTML = `<tr><td colspan="${report.columns.length}" class="text-center text-muted py-4">Loading...</td></tr>`;
    const filters = report.dateFiltered
      ? { from: document.getElementById('misFrom') ? document.getElementById('misFrom').value : '', to: document.getElementById('misTo') ? document.getElementById('misTo').value : '' }
      : {};
    const rows = await report.fetch(filters);
    if (!Array.isArray(rows)) {
      body.innerHTML = `<tr><td colspan="${report.columns.length}" class="text-center text-danger py-3">${(rows && rows.error) || 'Could not load this report'}</td></tr>`;
      MISPage.currentRows = [];
      return;
    }
    MISPage.currentRows = rows;
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="${report.columns.length}" class="text-center text-muted py-4">No data for this report/filter</td></tr>`;
      return;
    }
    body.innerHTML = rows.map(row => `
      <tr>${report.columns.map(c => `<td>${MISPage.formatCell(row[c.key], c)}</td>`).join('')}</tr>
    `).join('');
  },

  formatCell: (value, col) => {
    if (value === null || value === undefined) return '-';
    if (col.money) return '₹' + (parseFloat(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    if (col.date) return new Date(value).toLocaleDateString('en-IN');
    return value;
  },

  exportCSV: () => {
    const report = MISPage.currentReport;
    if (!report) { alert('Pick a report first.'); return; }
    exportToCSV(report.key, report.columns, MISPage.currentRows);
  }
};
