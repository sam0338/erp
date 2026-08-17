// VEDA Pharmacy - Reports
let currentUser = null;

const EXPIRY_BADGE = { expired: 'badge-danger', near: 'badge-warn' };
const PAYMENT_BADGE = { Paid: 'badge-ok', Partial: 'badge-warn', Unpaid: 'badge-danger' };
const STATUS_BADGE = { Completed: 'badge-ok', Cancelled: 'badge-danger', Returned: 'badge-neutral' };

(async function init() {
  currentUser = await initShell({ activeView: 'reports' });
  if (!currentUser) return;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';
  ['gstFrom', 'regFrom'].forEach(id => { document.getElementById(id).value = firstOfMonth; });
  ['gstTo', 'regTo'].forEach(id => { document.getElementById(id).value = today; });

  document.getElementById('gstFrom').addEventListener('change', loadGst);
  document.getElementById('gstTo').addEventListener('change', loadGst);
  document.getElementById('gstExportBtn').addEventListener('click', exportGstCsv);

  document.getElementById('expiryDays').addEventListener('change', loadExpiry);
  document.getElementById('expiryExportBtn').addEventListener('click', exportExpiryCsv);

  document.getElementById('lowstockExportBtn').addEventListener('click', exportLowStockCsv);

  document.getElementById('regFrom').addEventListener('change', loadRegister);
  document.getElementById('regTo').addEventListener('change', loadRegister);
  document.getElementById('regExportBtn').addEventListener('click', exportRegisterCsv);

  await loadGst();
})();

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  ['gst', 'expiry', 'lowstock', 'register'].forEach(t => {
    document.getElementById(t + 'Tab').style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'expiry' && !expiryCache) loadExpiry();
  if (tab === 'lowstock' && !lowStockCache) loadLowStock();
  if (tab === 'register' && !registerCache) loadRegister();
}

// ---------------- CSV export ----------------

function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(cell => {
    const s = String(cell === null || cell === undefined ? '' : cell);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------- GST Summary ----------------

let gstCache = null;

async function loadGst() {
  const cardsEl = document.getElementById('gstCards');
  const from = document.getElementById('gstFrom').value;
  const to = document.getElementById('gstTo').value;

  try {
    gstCache = await api.get(`/api/reports/gst-summary?from=${from}&to=${to}`);
    renderGst(gstCache);
  } catch (e) {
    cardsEl.innerHTML = `<div class="card empty-state" style="grid-column:1/-1;">${escapeHtml(e.message)}</div>`;
  }
}

function renderGst(d) {
  const cardsEl = document.getElementById('gstCards');
  const netClass = d.net_tax_payable_estimate < 0 ? 'negative' : '';
  cardsEl.innerHTML = `
    <div class="gst-card">
      <h4>Output Tax — Sales (${d.output.count})</h4>
      <table>
        <tr><td>Taxable</td><td>${fmtMoney(d.output.taxable_amount)}</td></tr>
        <tr><td>CGST</td><td>${fmtMoney(d.output.cgst_amount)}</td></tr>
        <tr><td>SGST</td><td>${fmtMoney(d.output.sgst_amount)}</td></tr>
        <tr><td>IGST</td><td>${fmtMoney(d.output.igst_amount)}</td></tr>
        <tr><td>Total</td><td>${fmtMoney(d.output.total_amount)}</td></tr>
      </table>
    </div>
    <div class="gst-card">
      <h4>Input Tax — Purchases (${d.input.count})</h4>
      <table>
        <tr><td>Taxable</td><td>${fmtMoney(d.input.taxable_amount)}</td></tr>
        <tr><td>CGST</td><td>${fmtMoney(d.input.cgst_amount)}</td></tr>
        <tr><td>SGST</td><td>${fmtMoney(d.input.sgst_amount)}</td></tr>
        <tr><td>IGST</td><td>${fmtMoney(d.input.igst_amount)}</td></tr>
        <tr><td>Total</td><td>${fmtMoney(d.input.total_amount)}</td></tr>
      </table>
    </div>
    <div class="gst-card net">
      <h4>Net Tax Payable (est.)</h4>
      <div class="value ${netClass}">${fmtMoney(d.net_tax_payable_estimate)}</div>
      <div class="muted" style="font-size:11.5px;margin-top:6px;">${d.net_tax_payable_estimate < 0 ? 'Input exceeds output — likely a credit position.' : 'Output exceeds input.'}</div>
    </div>
  `;
}

function exportGstCsv() {
  if (!gstCache) return;
  const d = gstCache;
  downloadCsv(`gst-summary-${d.from}-to-${d.to}.csv`, [
    ['Section', 'Count', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'],
    ['Output (Sales)', d.output.count, d.output.taxable_amount, d.output.cgst_amount, d.output.sgst_amount, d.output.igst_amount, d.output.total_amount],
    ['Input (Purchases)', d.input.count, d.input.taxable_amount, d.input.cgst_amount, d.input.sgst_amount, d.input.igst_amount, d.input.total_amount],
    [],
    ['Net Tax Payable (estimate)', d.net_tax_payable_estimate]
  ]);
}

// ---------------- Expiry Report ----------------

let expiryCache = null;

async function loadExpiry() {
  const tbody = document.getElementById('expiryTbody');
  const days = document.getElementById('expiryDays').value;
  try {
    expiryCache = await api.get(`/api/reports/expiry?days=${days}`);
    renderExpiry(expiryCache);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderExpiry(d) {
  const tbody = document.getElementById('expiryTbody');
  const tfoot = document.getElementById('expiryTfoot');
  if (d.batches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nothing expired or expiring in this window.</td></tr>';
    tfoot.innerHTML = '';
    return;
  }
  tbody.innerHTML = d.batches.map(b => `
    <tr>
      <td>${escapeHtml(b.item_name)}</td>
      <td class="mono">${escapeHtml(b.batch_no)}</td>
      <td>${fmtDate(b.expiry_date)}</td>
      <td><span class="badge ${EXPIRY_BADGE[b.expiry_status]}">${b.expiry_status === 'expired' ? 'Expired' : 'Expiring Soon'}</span></td>
      <td>${b.quantity} ${escapeHtml(b.unit)}</td>
      <td>${fmtMoney(b.value_at_cost)}</td>
      <td>${fmtMoney(b.value_at_mrp)}</td>
    </tr>
  `).join('');
  tfoot.innerHTML = `
    <tr>
      <td colspan="4">Total</td>
      <td>${d.totals.quantity}</td>
      <td>${fmtMoney(d.totals.value_at_cost)}</td>
      <td>${fmtMoney(d.totals.value_at_mrp)}</td>
    </tr>
  `;
}

function exportExpiryCsv() {
  if (!expiryCache) return;
  const rows = [['Item', 'Batch No.', 'Expiry', 'Status', 'Qty', 'Value (Cost)', 'Value (MRP)']];
  expiryCache.batches.forEach(b => rows.push([b.item_name, b.batch_no, b.expiry_date, b.expiry_status, b.quantity, b.value_at_cost, b.value_at_mrp]));
  rows.push([]);
  rows.push(['Total', '', '', '', expiryCache.totals.quantity, expiryCache.totals.value_at_cost, expiryCache.totals.value_at_mrp]);
  downloadCsv(`expiry-report-${expiryCache.days}days.csv`, rows);
}

// ---------------- Low Stock ----------------

let lowStockCache = null;

async function loadLowStock() {
  const tbody = document.getElementById('lowstockTbody');
  try {
    lowStockCache = await api.get('/api/reports/low-stock');
    renderLowStock(lowStockCache);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderLowStock(d) {
  const tbody = document.getElementById('lowstockTbody');
  if (d.items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nothing is at or below its reorder level right now.</td></tr>';
    return;
  }
  tbody.innerHTML = d.items.map(i => `
    <tr>
      <td><strong>${escapeHtml(i.name)}</strong>${i.generic_name ? `<div class="muted" style="font-size:11.5px;">${escapeHtml(i.generic_name)}</div>` : ''}</td>
      <td>${escapeHtml(i.category || '—')}</td>
      <td>${i.total_stock === 0 ? '<span class="badge badge-danger">0</span>' : `<span class="badge badge-warn">${i.total_stock}</span>`} ${escapeHtml(i.unit)}</td>
      <td>${i.reorder_level} ${escapeHtml(i.unit)}</td>
      <td>${i.qty_to_reorder_level} ${escapeHtml(i.unit)}</td>
    </tr>
  `).join('');
}

function exportLowStockCsv() {
  if (!lowStockCache) return;
  const rows = [['Item', 'Category', 'Current Stock', 'Reorder Level', 'Qty to Reorder Level']];
  lowStockCache.items.forEach(i => rows.push([i.name, i.category || '', i.total_stock, i.reorder_level, i.qty_to_reorder_level]));
  downloadCsv('low-stock-report.csv', rows);
}

// ---------------- Sales Register ----------------

let registerCache = null;

async function loadRegister() {
  const tbody = document.getElementById('registerTbody');
  const from = document.getElementById('regFrom').value;
  const to = document.getElementById('regTo').value;
  try {
    registerCache = await api.get(`/api/reports/sales-register?from=${from}&to=${to}`);
    renderRegister(registerCache);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderRegister(d) {
  const summaryEl = document.getElementById('regSummary');
  const paymentBreakdown = Object.entries(d.totals.by_payment_mode)
    .map(([mode, amt]) => `${mode}: ${fmtMoney(amt)}`).join(' · ') || '—';

  summaryEl.innerHTML = `
    <div class="stat-card"><div class="label">Completed Sales</div><div class="value">${d.completed_count}</div></div>
    <div class="stat-card"><div class="label">Cancelled</div><div class="value">${d.cancelled_count}</div></div>
    <div class="stat-card"><div class="label">Net Total</div><div class="value accent">${fmtMoney(d.totals.total_amount)}</div></div>
    <div class="stat-card"><div class="label">By Payment Mode</div><div class="hint" style="font-size:12px;margin-top:8px;">${paymentBreakdown}</div></div>
  `;

  const tbody = document.getElementById('registerTbody');
  if (d.sales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No sales in this date range.</td></tr>';
    return;
  }
  tbody.innerHTML = d.sales.map(s => `
    <tr${s.status === 'Cancelled' ? ' style="opacity:0.55;"' : ''}>
      <td class="mono">${escapeHtml(s.invoice_no)}</td>
      <td>${fmtDate(s.sale_date)}</td>
      <td>${escapeHtml(s.customer_name || '—')}</td>
      <td>${s.item_count}</td>
      <td>${fmtMoney(s.total_amount)}</td>
      <td><span class="badge ${PAYMENT_BADGE[s.payment_status] || 'badge-neutral'}">${escapeHtml(s.payment_mode)}</span></td>
      <td><span class="badge ${STATUS_BADGE[s.status] || 'badge-neutral'}">${escapeHtml(s.status)}</span></td>
    </tr>
  `).join('');
}

function exportRegisterCsv() {
  if (!registerCache) return;
  const rows = [['Invoice', 'Date', 'Customer', 'Items', 'Total', 'Payment Mode', 'Status']];
  registerCache.sales.forEach(s => rows.push([s.invoice_no, s.sale_date, s.customer_name || '', s.item_count, s.total_amount, s.payment_mode, s.status]));
  rows.push([]);
  rows.push(['Completed', registerCache.completed_count]);
  rows.push(['Cancelled', registerCache.cancelled_count]);
  rows.push(['Net Total', registerCache.totals.total_amount]);
  downloadCsv(`sales-register-${registerCache.from}-to-${registerCache.to}.csv`, rows);
}
