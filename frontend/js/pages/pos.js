const POSPage = {
  cart: [],
  warehouses: [],
  customers: [],
  selectedCustomerId: null,
  paymentMode: 'Cash',
  searchTimer: null,

  render: async () => `
    <div class="row mb-3 align-items-center">
      <div class="col-md-6">
        <h2 class="mb-0"><i class="fas fa-cash-register me-2"></i>POS Billing</h2>
      </div>
      <div class="col-md-6 text-end">
        <select class="form-control d-inline-block w-auto" id="posWarehouse" onchange="POSPage.onWarehouseChange()"></select>
      </div>
    </div>

    <ul class="nav nav-tabs mb-3" id="posTabs">
      <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#posNewSaleTab">New Sale</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#posHistoryTab" onclick="POSPage.loadHistory()">Bill History</button></li>
    </ul>

    <div class="tab-content">
    <div class="tab-pane fade show active" id="posNewSaleTab">
    <div class="row mb-3" id="posSummaryStrip">
      <div class="col-md-3 mb-2"><div class="card border-0 shadow-sm"><div class="card-body py-2"><div class="text-muted small">Bills Today</div><h4 class="mb-0" id="posSummaryBills">-</h4></div></div></div>
      <div class="col-md-3 mb-2"><div class="card border-0 shadow-sm"><div class="card-body py-2"><div class="text-muted small">Revenue Today</div><h4 class="mb-0" id="posSummaryRevenue">-</h4></div></div></div>
      <div class="col-md-6 mb-2"><div class="card border-0 shadow-sm"><div class="card-body py-2"><div class="text-muted small">By Payment Mode</div><div id="posSummaryByMode" class="small">-</div></div></div></div>
    </div>

    <div class="row">
      <!-- LEFT: search + cart -->
      <div class="col-md-8">
        <div class="card border-0 shadow-sm mb-3">
          <div class="card-body">
            <label class="form-label">Scan barcode or search by name / code</label>
            <input type="text" class="form-control form-control-lg" id="posSearchInput" placeholder="Scan or type, then Enter..." autocomplete="off"
              oninput="POSPage.onSearchInput()" onkeydown="POSPage.onSearchKeydown(event)">
            <div id="posSearchResults" class="list-group mt-1" style="position:relative; z-index:5;"></div>
          </div>
        </div>

        <div class="card border-0 shadow-sm">
          <div class="card-body table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light"><tr><th>Item</th><th style="width:100px">Qty</th><th style="width:110px">Price</th><th style="width:100px">Discount</th><th style="width:70px">Tax%</th><th style="width:110px">Line Total</th><th></th></tr></thead>
              <tbody id="posCartBody"><tr><td colspan="7" class="text-center text-muted py-4">Cart is empty — scan or search an item above</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- RIGHT: customer, totals, payment -->
      <div class="col-md-4">
        <div class="card border-0 shadow-sm mb-3">
          <div class="card-body">
            <label class="form-label">Customer</label>
            <select class="form-control mb-2" id="posCustomer" onchange="POSPage.onCustomerChange()"><option value="">Walk-in Customer</option></select>
            <label class="form-label">Customer Mobile (optional)</label>
            <input type="text" class="form-control mb-2" id="posCustomerMobile" placeholder="For sales history & repeat customers" maxlength="15">
            <label class="form-label">Bill Discount (₹)</label>
            <input type="number" class="form-control" id="posBillDiscount" step="0.01" value="0" oninput="POSPage.recalcTotals()">
          </div>
        </div>

        <div class="card border-0 shadow-sm mb-3">
          <div class="card-body">
            <table class="table table-sm mb-0">
              <tr><td>Subtotal</td><td class="text-end" id="posSubtotal">₹0.00</td></tr>
              <tr><td>Discount</td><td class="text-end" id="posDiscountTotal">₹0.00</td></tr>
              <tr id="posCgstRow"><td>CGST</td><td class="text-end" id="posCgst">₹0.00</td></tr>
              <tr id="posSgstRow"><td>SGST</td><td class="text-end" id="posSgst">₹0.00</td></tr>
              <tr id="posIgstRow" style="display:none"><td>IGST</td><td class="text-end" id="posIgst">₹0.00</td></tr>
              <tr class="fw-bold fs-5"><td>Grand Total</td><td class="text-end" id="posGrandTotal">₹0.00</td></tr>
            </table>
          </div>
        </div>

        <div class="card border-0 shadow-sm mb-3">
          <div class="card-body">
            <label class="form-label">Payment Mode</label>
            <div class="btn-group w-100" role="group">
              <button type="button" class="btn btn-outline-primary pos-pay-btn active" data-mode="Cash" onclick="POSPage.setPaymentMode('Cash')">Cash</button>
              <button type="button" class="btn btn-outline-primary pos-pay-btn" data-mode="UPI" onclick="POSPage.setPaymentMode('UPI')">UPI</button>
              <button type="button" class="btn btn-outline-primary pos-pay-btn" data-mode="Card" onclick="POSPage.setPaymentMode('Card')">Card</button>
              <button type="button" class="btn btn-outline-primary pos-pay-btn" data-mode="Credit" onclick="POSPage.setPaymentMode('Credit')">Credit</button>
            </div>
            <div id="posCreditNote" class="form-text text-warning" style="display:none">Credit sales need a real customer selected above, not Walk-in.</div>
          </div>
        </div>

        <button class="btn btn-success btn-lg w-100" onclick="POSPage.completeSale()"><i class="fas fa-check-circle me-2"></i>Complete Sale</button>
        <button class="btn btn-outline-secondary w-100 mt-2" onclick="POSPage.clearCart()">Clear Cart</button>
      </div>
    </div>
    </div>

    <div class="tab-pane fade" id="posHistoryTab">
      <div class="card border-0 shadow-sm mb-3">
        <div class="card-body">
          <div class="row g-2 align-items-end">
            <div class="col-md-3"><label class="form-label small">From</label><input type="date" class="form-control" id="posHistFrom"></div>
            <div class="col-md-3"><label class="form-label small">To</label><input type="date" class="form-control" id="posHistTo"></div>
            <div class="col-md-4"><label class="form-label small">Search (bill no / customer / mobile)</label><input type="text" class="form-control" id="posHistSearch" placeholder="e.g. 98765..."></div>
            <div class="col-md-2"><button class="btn btn-primary w-100" onclick="POSPage.loadHistory()">Search</button></div>
          </div>
        </div>
      </div>
      <div class="card border-0 shadow-sm">
        <div class="card-body table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-light"><tr><th>Bill No</th><th>Date</th><th>Customer</th><th>Mobile</th><th>Outlet</th><th>Payment</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
            <tbody id="posHistoryBody"><tr><td colspan="9" class="text-center text-muted py-4">Loading...</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
    </div>
  `,

  init: async () => {
    const warehouses = await API.getWarehouses();
    POSPage.warehouses = Array.isArray(warehouses) ? warehouses : [];
    document.getElementById('posWarehouse').innerHTML = POSPage.warehouses.map(w => `<option value="${w.id}">${w.warehouse_name}</option>`).join('');

    const customers = await API.getCustomers();
    POSPage.customers = Array.isArray(customers) ? customers : [];
    document.getElementById('posCustomer').innerHTML = '<option value="">Walk-in Customer</option>' +
      POSPage.customers.map(c => `<option value="${c.id}">${c.customer_name}</option>`).join('');

    POSPage.cart = [];
    POSPage.selectedCustomerId = null;
    POSPage.paymentMode = 'Cash';
    POSPage.renderCart();
    await POSPage.loadSummary();
    document.getElementById('posSearchInput').focus();
  },

  onWarehouseChange: () => { POSPage.loadSummary(); },

  loadSummary: async () => {
    const warehouseId = document.getElementById('posWarehouse').value;
    const summary = await API.posTodaySummary(warehouseId);
    if (!summary || summary.error) return;
    document.getElementById('posSummaryBills').textContent = summary.bill_count;
    document.getElementById('posSummaryRevenue').textContent = POSPage.fmt(summary.total_revenue);
    const modes = Object.entries(summary.by_payment_mode || {});
    document.getElementById('posSummaryByMode').innerHTML = modes.length
      ? modes.map(([m, v]) => `<span class="badge bg-light text-dark border me-1">${m}: ${POSPage.fmt(v)}</span>`).join('')
      : '<span class="text-muted">No sales yet</span>';
  },

  fmt: (n) => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),

  // ---- Search ----
  onSearchInput: () => {
    clearTimeout(POSPage.searchTimer);
    const query = document.getElementById('posSearchInput').value.trim();
    if (!query) { document.getElementById('posSearchResults').innerHTML = ''; return; }
    POSPage.searchTimer = setTimeout(() => POSPage.runSearch(query), 200);
  },

  runSearch: async (query) => {
    const warehouseId = document.getElementById('posWarehouse').value;
    const results = await API.posSearch(query, warehouseId);
    const container = document.getElementById('posSearchResults');
    if (!Array.isArray(results) || !results.length) {
      container.innerHTML = '<div class="list-group-item text-muted small">No matching item</div>';
      return;
    }
    POSPage._lastResults = results;
    container.innerHTML = results.map((r, i) => `
      <button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onclick="POSPage.addToCart(${i})">
        <span><strong>${r.material_name}</strong> <span class="text-muted small">(${r.material_code}${r.barcode ? ' · ' + r.barcode : ''})</span></span>
        <span class="small">${r.stock_available !== null ? `Stock: ${r.stock_available}` : ''} · ${POSPage.fmt(r.default_sale_price)}</span>
      </button>
    `).join('');
  },

  // Enter key: if there's exactly one result (typical for a barcode scan
  // that returns one exact hit), add it straight to the cart without
  // requiring a click — keeps the scan-scan-scan workflow fast.
  onSearchKeydown: (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (POSPage._lastResults && POSPage._lastResults.length >= 1) {
      POSPage.addToCart(0);
    }
  },

  addToCart: (index) => {
    const item = POSPage._lastResults[index];
    if (!item) return;
    const existing = POSPage.cart.find(c => c.material_id === item.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      POSPage.cart.push({
        material_id: item.id, material_name: item.material_name, hsn_code: item.hsn_code,
        unit_of_measure: item.unit_of_measure, quantity: 1,
        unit_price: parseFloat(item.default_sale_price) || 0, discount_amount: 0,
        tax_rate: parseFloat(item.gst_rate) || 0, stock_available: item.stock_available
      });
    }
    document.getElementById('posSearchInput').value = '';
    document.getElementById('posSearchResults').innerHTML = '';
    document.getElementById('posSearchInput').focus();
    POSPage.renderCart();
  },

  removeFromCart: (index) => {
    POSPage.cart.splice(index, 1);
    POSPage.renderCart();
  },

  updateCartField: (index, field, value) => {
    POSPage.cart[index][field] = parseFloat(value) || 0;
    POSPage.recalcTotals();
  },

  renderCart: () => {
    const body = document.getElementById('posCartBody');
    if (!POSPage.cart.length) {
      body.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Cart is empty — scan or search an item above</td></tr>';
    } else {
      body.innerHTML = POSPage.cart.map((c, i) => {
        const lineBase = Math.max(0, c.quantity * c.unit_price - c.discount_amount);
        const lineTax = lineBase * (c.tax_rate / 100);
        return `
        <tr>
          <td>${c.material_name}${c.stock_available !== null && c.stock_available !== undefined ? `<div class="text-muted small">Stock: ${c.stock_available}</div>` : ''}</td>
          <td><input type="number" class="form-control form-control-sm" value="${c.quantity}" step="0.001" min="0.001" onchange="POSPage.updateCartField(${i}, 'quantity', this.value)"></td>
          <td><input type="number" class="form-control form-control-sm" value="${c.unit_price}" step="0.01" onchange="POSPage.updateCartField(${i}, 'unit_price', this.value)"></td>
          <td><input type="number" class="form-control form-control-sm" value="${c.discount_amount}" step="0.01" onchange="POSPage.updateCartField(${i}, 'discount_amount', this.value)"></td>
          <td class="text-muted small align-middle">${c.tax_rate}%</td>
          <td class="align-middle">${POSPage.fmt(lineBase + lineTax)}</td>
          <td><button class="btn btn-sm btn-outline-danger" onclick="POSPage.removeFromCart(${i})"><i class="fas fa-trash"></i></button></td>
        </tr>`;
      }).join('');
    }
    POSPage.recalcTotals();
  },

  // Client-side preview only — mirrors the server's line-discount +
  // prorated-bill-discount + CGST/SGST/IGST math so the cashier sees the
  // real total before completing the sale. The server recomputes
  // authoritatively on submit; this never writes anything.
  recalcTotals: () => {
    const billDiscount = parseFloat(document.getElementById('posBillDiscount').value) || 0;
    const customer = POSPage.customers.find(c => c.id == POSPage.selectedCustomerId);
    const isInterstate = !!(POSPage.companyState && customer && customer.state && customer.state.trim().toLowerCase() !== POSPage.companyState.trim().toLowerCase());

    const lines = POSPage.cart.map(c => ({ ...c, netBase: Math.max(0, c.quantity * c.unit_price - c.discount_amount) }));
    const subtotal = lines.reduce((s, l) => s + l.netBase, 0);
    const billDiscountAmt = Math.min(Math.max(0, billDiscount), subtotal);

    let taxable = 0, cgst = 0, sgst = 0, igst = 0;
    lines.forEach(l => {
      const share = subtotal > 0 ? l.netBase / subtotal : 0;
      const prorated = billDiscountAmt * share;
      const finalTaxable = Math.max(0, l.netBase - prorated);
      taxable += finalTaxable;
      if (isInterstate) igst += finalTaxable * l.tax_rate / 100;
      else { cgst += finalTaxable * l.tax_rate / 200; sgst += finalTaxable * l.tax_rate / 200; }
    });

    document.getElementById('posSubtotal').textContent = POSPage.fmt(POSPage.cart.reduce((s, c) => s + c.quantity * c.unit_price, 0));
    document.getElementById('posDiscountTotal').textContent = POSPage.fmt(POSPage.cart.reduce((s, c) => s + c.discount_amount, 0) + billDiscountAmt);
    document.getElementById('posCgst').textContent = POSPage.fmt(cgst);
    document.getElementById('posSgst').textContent = POSPage.fmt(sgst);
    document.getElementById('posIgst').textContent = POSPage.fmt(igst);
    document.getElementById('posCgstRow').style.display = isInterstate ? 'none' : '';
    document.getElementById('posSgstRow').style.display = isInterstate ? 'none' : '';
    document.getElementById('posIgstRow').style.display = isInterstate ? '' : 'none';
    document.getElementById('posGrandTotal').textContent = POSPage.fmt(taxable + cgst + sgst + igst);
  },

  onCustomerChange: () => {
    POSPage.selectedCustomerId = document.getElementById('posCustomer').value || null;
    POSPage.recalcTotals();
  },

  setPaymentMode: (mode) => {
    POSPage.paymentMode = mode;
    document.querySelectorAll('.pos-pay-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    document.getElementById('posCreditNote').style.display = (mode === 'Credit' && !POSPage.selectedCustomerId) ? 'block' : 'none';
  },

  clearCart: () => {
    POSPage.cart = [];
    document.getElementById('posBillDiscount').value = 0;
    POSPage.renderCart();
  },

  completeSale: async () => {
    if (!POSPage.cart.length) { alert('Cart is empty'); return; }
    if (POSPage.paymentMode === 'Credit' && !POSPage.selectedCustomerId) {
      alert('Credit sales need a real customer selected, not Walk-in.');
      return;
    }
    const data = {
      warehouse_id: document.getElementById('posWarehouse').value,
      customer_id: POSPage.selectedCustomerId || null,
      customer_mobile: document.getElementById('posCustomerMobile').value.trim() || null,
      payment_mode: POSPage.paymentMode,
      discount_amount: parseFloat(document.getElementById('posBillDiscount').value) || 0,
      items: POSPage.cart.map(c => ({
        material_id: c.material_id, quantity: c.quantity, unit_price: c.unit_price,
        discount_amount: c.discount_amount, tax_rate: c.tax_rate
      }))
    };
    const result = await API.posCompleteSale(data);
    if (result && !result.error) {
      await POSReceipt.print(result.id);
      POSPage.clearCart();
      document.getElementById('posCustomer').value = '';
      document.getElementById('posCustomerMobile').value = '';
      POSPage.selectedCustomerId = null;
      POSPage.setPaymentMode('Cash');
      await POSPage.loadSummary();
      document.getElementById('posSearchInput').focus();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  // ---- Bill History (reprint an old bill) ----
  loadHistory: async () => {
    const body = document.getElementById('posHistoryBody');
    body.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">Loading...</td></tr>';
    const params = {
      from: document.getElementById('posHistFrom').value,
      to: document.getElementById('posHistTo').value,
      search: document.getElementById('posHistSearch').value,
      warehouse_id: document.getElementById('posWarehouse').value
    };
    const rows = await API.posSalesHistory(params);
    if (!Array.isArray(rows)) {
      body.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-3">${(rows && rows.error) || 'Could not load bill history'}</td></tr>`;
      return;
    }
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No bills found for these filters</td></tr>';
      return;
    }
    body.innerHTML = rows.map(r => `
      <tr>
        <td>${r.invoice_number}</td>
        <td>${new Date(r.invoice_date).toLocaleDateString('en-IN')}</td>
        <td>${r.customer_name || 'Walk-in'}</td>
        <td>${r.customer_mobile || '-'}</td>
        <td>${r.warehouse_name || '-'}</td>
        <td>${r.payment_mode || '-'}</td>
        <td>${POSPage.fmt(r.grand_total)}</td>
        <td><span class="badge bg-${r.status === 'Paid' ? 'success' : 'warning'}">${r.status}</span></td>
        <td><button class="btn btn-sm btn-outline-primary" onclick="POSReceipt.print(${r.id})"><i class="fas fa-print me-1"></i>Print</button></td>
      </tr>
    `).join('');
  }
};

// Fetches the company's own state once, for client-side CGST/SGST vs IGST
// preview (the actual charge is always computed authoritatively server-side).
(async () => {
  try {
    const company = await API.getCompanySettings();
    if (company && company.state) POSPage.companyState = company.state;
  } catch (_) { /* preview just defaults to intra-state until this resolves */ }
})();

// Compact, thermal-receipt-style print — deliberately narrower and
// simpler than the full A4 tax invoice, but still GST-compliant (HSN, tax
// breakup) since a retailer's counter bill often IS their only invoice.
const POSReceipt = {
  print: async (invoiceId) => {
    const inv = await API.posGetInvoice(invoiceId);
    if (!inv || inv.error) { alert('Sale completed, but could not load the receipt to print.'); return; }
    const company = await API.getCompanySettings() || {};
    const itemsHtml = (inv.items || []).map(it => `
      <tr>
        <td>${it.description || it.material_name}</td>
        <td style="text-align:right">${it.quantity}</td>
        <td style="text-align:right">${it.line_total.toFixed(2)}</td>
      </tr>`).join('');
    const printHtml = `
      <!DOCTYPE html><html><head><title>${inv.invoice_number}</title><meta charset="utf-8">
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 72mm; }
        h3 { text-align: center; margin: 2px 0; }
        .center { text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        th, td { padding: 2px 0; font-size: 11px; }
        th { border-bottom: 1px dashed #000; text-align: left; }
        .totals td { padding-top: 2px; }
        .line { border-top: 1px dashed #000; margin: 6px 0; }
      </style></head><body>
        <h3>${company.company_name || 'Company'}</h3>
        <div class="center">${[company.address, company.city].filter(Boolean).join(', ')}</div>
        ${company.gstin ? `<div class="center">GSTIN: ${company.gstin}</div>` : ''}
        <div class="line"></div>
        <div>Bill: ${inv.invoice_number} &nbsp; ${new Date(inv.invoice_date).toLocaleDateString('en-IN')}</div>
        <div>Customer: ${inv.customer_name || 'Walk-in'}</div>
        <div>Payment: ${inv.payment_mode || '-'}</div>
        <div class="line"></div>
        <table>
          <thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Amt</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div class="line"></div>
        <table class="totals">
          <tr><td>Taxable</td><td style="text-align:right">${parseFloat(inv.taxable_value).toFixed(2)}</td></tr>
          ${parseFloat(inv.discount_amount) > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${parseFloat(inv.discount_amount).toFixed(2)}</td></tr>` : ''}
          ${inv.is_interstate
            ? `<tr><td>IGST</td><td style="text-align:right">${parseFloat(inv.igst_total).toFixed(2)}</td></tr>`
            : `<tr><td>CGST</td><td style="text-align:right">${parseFloat(inv.cgst_total).toFixed(2)}</td></tr><tr><td>SGST</td><td style="text-align:right">${parseFloat(inv.sgst_total).toFixed(2)}</td></tr>`}
          <tr style="font-weight:bold"><td>TOTAL</td><td style="text-align:right">₹${parseFloat(inv.grand_total).toFixed(2)}</td></tr>
        </table>
        <div class="line"></div>
        <div class="center">Thank you — visit again!</div>
        <script>window.onload = () => window.print();</script>
      </body></html>`;
    const w = window.open('', '_blank', 'width=380,height=600');
    if (!w) { alert('Sale completed. Please allow pop-ups to print the receipt.'); return; }
    w.document.write(printHtml);
    w.document.close();
  }
};
