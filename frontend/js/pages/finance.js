const FinancePage = {
  render: async () => `
    <div class="row mb-4">
      <div class="col-md-8">
        <h2><i class="fas fa-coins me-2"></i>Finance &amp; Commercial Controls</h2>
        <p class="text-muted mb-0">Transaction-linked payable/receivable summaries, expense capture, margin visibility, and a Tally/Busy export staging area — not a full accounting engine.</p>
      </div>
    </div>

    <div class="row" id="financeKpis">
      <div class="col-md-3 mb-3"><div class="card border-0 shadow-sm"><div class="card-body"><p class="text-muted small mb-1">Total Payable</p><h4 id="kpiPayable" class="text-danger">-</h4></div></div></div>
      <div class="col-md-3 mb-3"><div class="card border-0 shadow-sm"><div class="card-body"><p class="text-muted small mb-1">Total Receivable</p><h4 id="kpiReceivable" class="text-success">-</h4></div></div></div>
      <div class="col-md-3 mb-3"><div class="card border-0 shadow-sm"><div class="card-body"><p class="text-muted small mb-1">Net GST Payable</p><h4 id="kpiGst">-</h4></div></div></div>
      <div class="col-md-3 mb-3"><div class="card border-0 shadow-sm"><div class="card-body"><p class="text-muted small mb-1">Margin (recent orders)</p><h4 id="kpiMargin">-</h4></div></div></div>
    </div>

    <ul class="nav nav-tabs mb-3" id="financeTabs">
      <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#fPayables">Payables (AP)</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#fReceivables">Receivables (AR)</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#fExpenses">Expenses</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#fMargin">Cost &amp; Margin</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#fGst">GST Summary</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#fStaging">Tally / Busy Export</button></li>
    </ul>

    <div class="tab-content">
      <!-- PAYABLES -->
      <div class="tab-pane fade show active" id="fPayables">
        <div class="row">
          <div class="col-md-4 mb-3">
            <div class="card border-0 shadow-sm">
              <div class="card-header fw-bold">Aging</div>
              <div class="card-body" id="payablesAging"><div class="text-muted small">Loading...</div></div>
            </div>
          </div>
          <div class="col-md-8 mb-3">
            <div class="card border-0 shadow-sm">
              <div class="card-header fw-bold">Outstanding by Vendor</div>
              <div class="card-body table-responsive">
                <table class="table table-sm table-hover mb-0">
                  <thead class="table-light"><tr><th>Vendor</th><th>Open Invoices</th><th>Outstanding</th></tr></thead>
                  <tbody id="payablesByVendor"><tr><td colspan="3" class="text-center text-muted">Loading...</td></tr></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div class="card border-0 shadow-sm">
          <div class="card-header fw-bold">Vendor Invoice Detail</div>
          <div class="card-body table-responsive">
            <table class="table table-sm table-hover mb-0">
              <thead class="table-light"><tr><th>Invoice</th><th>Vendor</th><th>PO</th><th>Due Date</th><th>Grand Total</th><th>Paid</th><th>Outstanding</th><th>Aging</th></tr></thead>
              <tbody id="vendorOutstandingBody"><tr><td colspan="8" class="text-center text-muted">Loading...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- RECEIVABLES -->
      <div class="tab-pane fade" id="fReceivables">
        <div class="row">
          <div class="col-md-4 mb-3">
            <div class="card border-0 shadow-sm">
              <div class="card-header fw-bold">Aging</div>
              <div class="card-body" id="receivablesAging"><div class="text-muted small">Loading...</div></div>
            </div>
          </div>
          <div class="col-md-8 mb-3">
            <div class="card border-0 shadow-sm">
              <div class="card-header fw-bold">Outstanding by Customer</div>
              <div class="card-body table-responsive">
                <table class="table table-sm table-hover mb-0">
                  <thead class="table-light"><tr><th>Customer</th><th>Open Invoices</th><th>Outstanding</th></tr></thead>
                  <tbody id="receivablesByCustomer"><tr><td colspan="3" class="text-center text-muted">Loading...</td></tr></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div class="alert alert-info d-flex justify-content-between align-items-center">
          <div>
            <strong>Dispatched, Awaiting Invoice</strong>
            <div class="small text-muted">Goods already shipped to customers but not yet pulled onto a tax invoice — a real amount owed, kept separate from formally invoiced receivables below.</div>
          </div>
          <h4 class="mb-0" id="dispatchedAwaitingInvoiceTotal">-</h4>
        </div>
        <div class="card border-0 shadow-sm mb-3">
          <div class="card-body table-responsive">
            <table class="table table-sm table-hover mb-0">
              <thead class="table-light"><tr><th>Customer</th><th>Orders Involved</th><th>Accrued Value</th><th>Action</th></tr></thead>
              <tbody id="dispatchedAwaitingInvoiceBody"><tr><td colspan="4" class="text-center text-muted">Loading...</td></tr></tbody>
            </table>
          </div>
        </div>
        <div class="card border-0 shadow-sm">
          <div class="card-header fw-bold">Customer Invoice Detail</div>
          <div class="card-body table-responsive">
            <table class="table table-sm table-hover mb-0">
              <thead class="table-light"><tr><th>Invoice</th><th>Customer</th><th>SO</th><th>Due Date</th><th>Grand Total</th><th>Paid</th><th>Outstanding</th><th>Aging</th></tr></thead>
              <tbody id="customerOutstandingBody"><tr><td colspan="8" class="text-center text-muted">Loading...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- EXPENSES -->
      <div class="tab-pane fade" id="fExpenses">
        <div class="d-flex justify-content-between mb-2">
          <p class="text-muted small mb-0">Generic expense capture (rent, freight, professional fees, utilities...) — not tied to a purchase order.</p>
          <button class="btn btn-sm btn-primary" onclick="ExpenseModal.show()"><i class="fas fa-plus me-1"></i>Record Expense</button>
        </div>
        <div class="card border-0 shadow-sm">
          <div class="card-body table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light"><tr><th>Expense No</th><th>Date</th><th>Category</th><th>Vendor</th><th>Taxable Value</th><th>Tax</th><th>Grand Total</th><th>Paid</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody id="expensesBody"><tr><td colspan="10" class="text-center text-muted">Loading...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- MARGIN -->
      <div class="tab-pane fade" id="fMargin">
        <div class="alert alert-warning small">
          Cost is an <strong>estimate</strong>: for items with a linked BOM, it's raw material priced at each material's current weighted-average stock cost plus the BOM's Expenses/Unit; for items with no BOM, it falls back to that item's own average stock cost. This is a standard-cost-style approximation, not a statutory actual-cost figure.
        </div>
        <div class="card border-0 shadow-sm">
          <div class="card-body table-responsive">
            <table class="table table-sm table-hover mb-0">
              <thead class="table-light"><tr><th>SO No</th><th>Customer</th><th>Date</th><th>Revenue</th><th>Est. Cost</th><th>Margin</th><th>Margin %</th></tr></thead>
              <tbody id="marginBody"><tr><td colspan="7" class="text-center text-muted">Loading...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- GST -->
      <div class="tab-pane fade" id="fGst">
        <div class="row mb-3">
          <div class="col-md-3"><input type="date" class="form-control form-control-sm" id="gstFrom"></div>
          <div class="col-md-3"><input type="date" class="form-control form-control-sm" id="gstTo"></div>
          <div class="col-md-3"><button class="btn btn-sm btn-primary" onclick="FinancePage.loadGst()">Apply</button> <button class="btn btn-sm btn-outline-secondary" onclick="document.getElementById('gstFrom').value='';document.getElementById('gstTo').value='';FinancePage.loadGst()">All Time</button></div>
        </div>
        <div id="gstSummaryContainer"><div class="text-center text-muted py-4">Loading...</div></div>
      </div>

      <!-- STAGING -->
      <div class="tab-pane fade" id="fStaging">
        <div class="d-flex justify-content-between mb-2">
          <p class="text-muted small mb-0">Stages a flat voucher row per transaction (Purchase/Sales/Payment/Receipt/Expense), ready for CSV export into Tally/Busy/other accounting software. This app does not talk to Tally/Busy directly.</p>
          <div>
            <button class="btn btn-sm btn-outline-primary" onclick="FinancePage.syncStaging()"><i class="fas fa-sync me-1"></i>Sync New Transactions</button>
            <button class="btn btn-sm btn-success" onclick="FinancePage.exportStaging()"><i class="fas fa-file-csv me-1"></i>Export Pending as CSV</button>
          </div>
        </div>
        <div class="card border-0 shadow-sm">
          <div class="card-body table-responsive">
            <table class="table table-sm table-hover mb-0">
              <thead class="table-light"><tr><th>Staging No</th><th>Type</th><th>Date</th><th>Reference</th><th>Party</th><th>Taxable</th><th>Tax</th><th>Grand Total</th><th>Status</th></tr></thead>
              <tbody id="stagingBody"><tr><td colspan="9" class="text-center text-muted">Loading...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    ${FinancePage.modalsHtml()}
  `,

  modalsHtml: () => `
    <!-- Expense Modal -->
    <div class="modal fade" id="expenseModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Record Expense</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="ExpenseModal.submit(event)">
          <div class="modal-body">
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Date</label><input type="date" class="form-control" id="expDate"></div>
              <div class="col-md-6 mb-2"><label class="form-label">Category *</label><input type="text" class="form-control" id="expCategory" required placeholder="e.g. Freight, Rent, Professional Fees"></div>
            </div>
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Vendor (optional)</label><select class="form-control" id="expVendor"><option value="">— None —</option></select></div>
              <div class="col-md-6 mb-2"><label class="form-label">Department</label><input type="text" class="form-control" id="expDepartment"></div>
            </div>
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Taxable Value *</label><input type="number" class="form-control" id="expTaxable" step="0.01" required oninput="ExpenseModal.recalc()"></div>
              <div class="col-md-6 mb-2"><label class="form-label">Tax Amount</label><input type="number" class="form-control" id="expTax" step="0.01" value="0" oninput="ExpenseModal.recalc()"></div>
            </div>
            <div class="text-end small mb-2" id="expTotalPreview">Grand Total: ₹0.00</div>
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">HSN/SAC Code</label><input type="text" class="form-control" id="expHsn"></div>
              <div class="col-md-6 mb-2"><label class="form-label">GST Class</label>
                <select class="form-control" id="expGstClass"><option value="">— None —</option><option>Goods</option><option>Services</option><option>Exempt</option><option>Nil-rated</option></select>
              </div>
            </div>
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Paid Through (leave blank if unpaid)</label>
                <select class="form-control" id="expPaidThrough"><option value="">— Unpaid / Recorded only —</option><option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>UPI</option><option>Card</option></select>
              </div>
              <div class="col-md-6 mb-2"><label class="form-label">Payment Reference</label><input type="text" class="form-control" id="expPaymentRef"></div>
            </div>
            <div class="mb-2"><label class="form-label">Remarks</label><textarea class="form-control" id="expRemarks" rows="2"></textarea></div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Save Expense</button></div>
        </form>
      </div></div>
    </div>

    <!-- Expense Payment Modal -->
    <div class="modal fade" id="expensePaymentModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Record Payment Against Expense</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="ExpensePaymentModal.submit(event)">
          <div class="modal-body">
            <input type="hidden" id="expPayId">
            <div class="mb-2"><label class="form-label">Amount *</label><input type="number" class="form-control" id="expPayAmount" step="0.01" required></div>
            <div class="mb-2"><label class="form-label">Paid Through</label>
              <select class="form-control" id="expPayThrough"><option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>UPI</option><option>Card</option></select>
            </div>
            <div class="mb-2"><label class="form-label">Payment Reference</label><input type="text" class="form-control" id="expPayReference"></div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Record Payment</button></div>
        </form>
      </div></div>
    </div>
  `,

  fmt: (n) => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
  vendors: [],

  // Renders mapped rows, a clear error message if the API call failed, or
  // an empty-state message — so a broken API call never looks identical
  // to "there's just nothing here yet" (same helper pattern used in the
  // Sales & Dispatch page, kept local here so this page has no runtime
  // dependency on another page's script having loaded first).
  rowsOrMessage: (rows, colspan, emptyMsg, mapFn) => {
    if (!Array.isArray(rows)) {
      const errMsg = (rows && rows.error) ? rows.error : 'Could not load this data — check the server is running and the browser console for details.';
      return `<tr><td colspan="${colspan}" class="text-center text-danger py-3"><i class="fas fa-triangle-exclamation me-1"></i>${errMsg}</td></tr>`;
    }
    if (rows.length === 0) return `<tr><td colspan="${colspan}" class="text-center text-muted">${emptyMsg}</td></tr>`;
    return rows.map(mapFn).join('');
  },

  init: async () => {
    FinancePage.vendors = await API.getVendors();
    if (!Array.isArray(FinancePage.vendors)) FinancePage.vendors = [];
    await Promise.all([
      FinancePage.loadPayables(),
      FinancePage.loadReceivables(),
      FinancePage.loadExpenses(),
      FinancePage.loadMargin(),
      FinancePage.loadGst(),
      FinancePage.loadStaging()
    ]);
  },

  agingTable: (aging) => `
    <table class="table table-sm mb-0">
      <tbody>
        <tr><td>0-30 days</td><td class="text-end">${FinancePage.fmt(aging['0-30'])}</td></tr>
        <tr><td>31-60 days</td><td class="text-end">${FinancePage.fmt(aging['31-60'])}</td></tr>
        <tr><td>61-90 days</td><td class="text-end">${FinancePage.fmt(aging['61-90'])}</td></tr>
        <tr class="table-danger"><td>90+ days</td><td class="text-end">${FinancePage.fmt(aging['90+'])}</td></tr>
      </tbody>
    </table>`,

  loadPayables: async () => {
    const summary = await API.getPayablesSummary();
    if (!summary || summary.error) {
      document.getElementById('payablesAging').innerHTML = `<div class="text-danger small">${(summary && summary.error) || 'Could not load'}</div>`;
      return;
    }
    document.getElementById('kpiPayable').textContent = FinancePage.fmt(summary.total_outstanding);
    document.getElementById('payablesAging').innerHTML = FinancePage.agingTable(summary.aging);
    document.getElementById('payablesByVendor').innerHTML = summary.by_vendor.length ? summary.by_vendor.map(v => `
      <tr><td>${v.vendor_name || 'Unknown'}</td><td>${v.invoice_count}</td><td class="text-end">${FinancePage.fmt(v.outstanding)}</td></tr>
    `).join('') : '<tr><td colspan="3" class="text-center text-muted">Nothing outstanding</td></tr>';

    const detail = await API.getVendorOutstanding();
    document.getElementById('vendorOutstandingBody').innerHTML = FinancePage.rowsOrMessage(detail, 8, 'Nothing outstanding', i => `
      <tr><td>${i.invoice_number}</td><td>${i.vendor_name || '-'}</td><td>${i.po_number || '-'}</td>
      <td>${i.due_date ? new Date(i.due_date).toLocaleDateString('en-IN') : '-'}</td><td>${FinancePage.fmt(i.grand_total)}</td>
      <td>${FinancePage.fmt(i.paid_amount)}</td><td>${FinancePage.fmt(i.outstanding)}</td>
      <td><span class="badge bg-${i.aging_bucket === '90+' ? 'danger' : i.aging_bucket === '61-90' ? 'warning' : 'secondary'}">${i.aging_bucket}</span></td></tr>
    `);
  },

  loadReceivables: async () => {
    const summary = await API.getReceivablesSummary();
    if (!summary || summary.error) {
      document.getElementById('receivablesAging').innerHTML = `<div class="text-danger small">${(summary && summary.error) || 'Could not load'}</div>`;
      return;
    }
    document.getElementById('kpiReceivable').textContent = FinancePage.fmt(summary.total_outstanding);
    document.getElementById('receivablesAging').innerHTML = FinancePage.agingTable(summary.aging);
    document.getElementById('receivablesByCustomer').innerHTML = summary.by_customer.length ? summary.by_customer.map(c => `
      <tr><td>${c.customer_name}</td><td>${c.invoice_count}</td><td class="text-end">${FinancePage.fmt(c.outstanding)}</td></tr>
    `).join('') : '<tr><td colspan="3" class="text-center text-muted">Nothing outstanding</td></tr>';

    const dai = summary.dispatched_awaiting_invoice || { total: 0, by_customer: [] };
    document.getElementById('dispatchedAwaitingInvoiceTotal').textContent = FinancePage.fmt(dai.total);
    document.getElementById('dispatchedAwaitingInvoiceBody').innerHTML = dai.by_customer.length ? dai.by_customer.map(c => `
      <tr>
        <td>${c.customer_name}</td>
        <td class="small text-muted">${c.orders.map(o => o.so_number).join(', ')}</td>
        <td>${FinancePage.fmt(c.accrued_value)}</td>
        <td><button class="btn btn-sm btn-outline-primary" onclick="navigateTo('sales-dispatch')">Go Invoice</button></td>
      </tr>
    `).join('') : '<tr><td colspan="4" class="text-center text-muted">Nothing dispatched is awaiting invoicing</td></tr>';

    const detail = await API.getCustomerOutstanding();
    document.getElementById('customerOutstandingBody').innerHTML = FinancePage.rowsOrMessage(detail, 8, 'Nothing outstanding', i => `
      <tr><td>${i.invoice_number}</td><td>${i.customer_name}</td><td>${i.so_number || '-'}</td>
      <td>${i.due_date ? new Date(i.due_date).toLocaleDateString('en-IN') : '-'}</td><td>${FinancePage.fmt(i.grand_total)}</td>
      <td>${FinancePage.fmt(i.paid_amount)}</td><td>${FinancePage.fmt(i.outstanding)}</td>
      <td><span class="badge bg-${i.aging_bucket === '90+' ? 'danger' : i.aging_bucket === '61-90' ? 'warning' : 'secondary'}">${i.aging_bucket}</span></td></tr>
    `);
  },

  loadExpenses: async () => {
    const rows = await API.getExpenses();
    document.getElementById('expensesBody').innerHTML = FinancePage.rowsOrMessage(rows, 10, 'No expenses recorded yet', e => `
      <tr>
        <td>${e.expense_number}</td><td>${new Date(e.expense_date).toLocaleDateString('en-IN')}</td><td>${e.category}</td><td>${e.vendor_name || '-'}</td>
        <td>${FinancePage.fmt(e.taxable_value)}</td><td>${FinancePage.fmt(e.tax_amount)}</td><td>${FinancePage.fmt(e.grand_total)}</td><td>${FinancePage.fmt(e.paid_amount)}</td>
        <td><span class="badge bg-${e.status === 'Paid' ? 'success' : e.status === 'Partially Paid' ? 'warning' : 'secondary'}">${e.status}</span></td>
        <td>${e.status !== 'Paid' ? `<button class="btn btn-sm btn-outline-primary" onclick="ExpensePaymentModal.show(${e.id})">Record Payment</button>` : '-'}</td>
      </tr>
    `);
  },

  loadMargin: async () => {
    const data = await API.getMarginReport();
    if (!data || data.error) {
      document.getElementById('marginBody').innerHTML = `<tr><td colspan="7" class="text-center text-danger">${(data && data.error) || 'Could not load'}</td></tr>`;
      return;
    }
    document.getElementById('kpiMargin').textContent = data.totals.margin_percent !== null ? `${data.totals.margin_percent}%` : '-';
    document.getElementById('marginBody').innerHTML = data.orders.length ? data.orders.map(o => `
      <tr class="${o.margin_percent !== null && o.margin_percent < 10 ? 'table-danger' : ''}">
        <td>${o.so_number}</td><td>${o.customer_name || '-'}</td><td>${new Date(o.order_date).toLocaleDateString('en-IN')}</td>
        <td>${FinancePage.fmt(o.revenue)}</td><td>${FinancePage.fmt(o.estimated_cost)}</td><td>${FinancePage.fmt(o.margin)}</td>
        <td>${o.margin_percent !== null ? o.margin_percent + '%' : '-'}</td>
      </tr>
    `).join('') : '<tr><td colspan="7" class="text-center text-muted">No confirmed orders yet</td></tr>';
  },

  loadGst: async () => {
    const from = document.getElementById('gstFrom') ? document.getElementById('gstFrom').value : '';
    const to = document.getElementById('gstTo') ? document.getElementById('gstTo').value : '';
    const data = await API.getGstSummary(from, to);
    const container = document.getElementById('gstSummaryContainer');
    if (!data || data.error) { container.innerHTML = `<div class="text-danger">${(data && data.error) || 'Could not load GST summary'}</div>`; return; }
    document.getElementById('kpiGst').textContent = FinancePage.fmt(data.net_gst_payable);
    container.innerHTML = `
      <div class="row">
        <div class="col-md-6 mb-3">
          <div class="card border-0 shadow-sm h-100"><div class="card-header fw-bold bg-success bg-opacity-25">Output Tax (Sales)</div>
            <div class="card-body">
              <p>Taxable Value: <strong>${FinancePage.fmt(data.output_tax.taxable_value)}</strong></p>
              <p>Tax Collected: <strong>${FinancePage.fmt(data.output_tax.tax_collected)}</strong></p>
            </div>
          </div>
        </div>
        <div class="col-md-6 mb-3">
          <div class="card border-0 shadow-sm h-100"><div class="card-header fw-bold bg-warning bg-opacity-25">Input Tax (Purchases + Expenses)</div>
            <div class="card-body">
              <p>Taxable Value: <strong>${FinancePage.fmt(data.input_tax.taxable_value)}</strong></p>
              <p>Tax Paid: <strong>${FinancePage.fmt(data.input_tax.tax_paid)}</strong> (Purchases: ${FinancePage.fmt(data.input_tax.from_purchases)}, Expenses: ${FinancePage.fmt(data.input_tax.from_expenses)})</p>
            </div>
          </div>
        </div>
      </div>
      <div class="alert alert-info">Net GST Payable (Output − Input): <strong>${FinancePage.fmt(data.net_gst_payable)}</strong></div>
      <div class="text-muted small">This is a transaction-linked GST summary for visibility — not a filed return. Verify against your GSTR working before filing.</div>
    `;
  },

  loadStaging: async () => {
    const rows = await API.getAccountingStaging();
    document.getElementById('stagingBody').innerHTML = FinancePage.rowsOrMessage(rows, 9, 'Nothing staged yet — click "Sync New Transactions"', s => `
      <tr>
        <td>${s.staging_number}</td><td>${s.voucher_type}</td><td>${new Date(s.voucher_date).toLocaleDateString('en-IN')}</td>
        <td>${s.reference_number || '-'}</td><td>${s.party_name || '-'}</td>
        <td>${FinancePage.fmt(s.taxable_value)}</td><td>${FinancePage.fmt(s.tax_amount)}</td><td>${FinancePage.fmt(s.grand_total)}</td>
        <td><span class="badge bg-${s.export_status === 'Exported' ? 'success' : 'secondary'}">${s.export_status}</span></td>
      </tr>
    `);
  },

  syncStaging: async () => {
    const result = await API.syncAccountingStaging();
    if (result && !result.error) { alert(result.message); await FinancePage.loadStaging(); }
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  },

  exportStaging: async () => {
    try {
      await API.exportAccountingStaging();
      await FinancePage.loadStaging();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }
};

const ExpenseModal = {
  modal: null,
  show: () => {
    document.getElementById('expVendor').innerHTML = '<option value="">— None —</option>' + FinancePage.vendors.map(v => `<option value="${v.id}">${v.vendor_name}</option>`).join('');
    document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
    ['expCategory', 'expDepartment', 'expHsn', 'expPaymentRef', 'expRemarks'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('expTaxable').value = '';
    document.getElementById('expTax').value = 0;
    document.getElementById('expGstClass').value = '';
    document.getElementById('expPaidThrough').value = '';
    ExpenseModal.recalc();
    ExpenseModal.modal = new bootstrap.Modal(document.getElementById('expenseModal'));
    ExpenseModal.modal.show();
  },
  recalc: () => {
    const taxable = parseFloat(document.getElementById('expTaxable').value) || 0;
    const tax = parseFloat(document.getElementById('expTax').value) || 0;
    document.getElementById('expTotalPreview').textContent = `Grand Total: ${FinancePage.fmt(taxable + tax)}`;
  },
  submit: async (event) => {
    event.preventDefault();
    const data = {
      expense_date: document.getElementById('expDate').value,
      category: document.getElementById('expCategory').value,
      vendor_id: document.getElementById('expVendor').value || null,
      department: document.getElementById('expDepartment').value,
      taxable_value: parseFloat(document.getElementById('expTaxable').value) || 0,
      tax_amount: parseFloat(document.getElementById('expTax').value) || 0,
      hsn_sac_code: document.getElementById('expHsn').value,
      gst_class: document.getElementById('expGstClass').value,
      paid_through: document.getElementById('expPaidThrough').value,
      payment_reference: document.getElementById('expPaymentRef').value,
      remarks: document.getElementById('expRemarks').value
    };
    const result = await API.createExpense(data);
    if (result && !result.error) { ExpenseModal.modal.hide(); alert(result.message || 'Expense recorded'); await FinancePage.loadExpenses(); await FinancePage.loadPayables(); }
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  }
};

const ExpensePaymentModal = {
  modal: null,
  show: (expenseId) => {
    document.getElementById('expPayId').value = expenseId;
    document.getElementById('expPayAmount').value = '';
    document.getElementById('expPayReference').value = '';
    ExpensePaymentModal.modal = new bootstrap.Modal(document.getElementById('expensePaymentModal'));
    ExpensePaymentModal.modal.show();
  },
  submit: async (event) => {
    event.preventDefault();
    const id = document.getElementById('expPayId').value;
    const data = {
      amount: parseFloat(document.getElementById('expPayAmount').value) || 0,
      paid_through: document.getElementById('expPayThrough').value,
      payment_reference: document.getElementById('expPayReference').value
    };
    const result = await API.recordExpensePayment(id, data);
    if (result && !result.error) { ExpensePaymentModal.modal.hide(); alert(result.message || 'Payment recorded'); await FinancePage.loadExpenses(); await FinancePage.loadPayables(); }
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  }
};
