// VEDA Pharmacy - Purchases / GRN
let currentUser = null;
let purchasesCache = [];
let distributorsCache = [];
let itemsCache = [];
let rowSeq = 0;

const PAYMENT_BADGE = { Paid: 'badge-green', Partial: 'badge-amber', Unpaid: 'badge-red' };

(async function init() {
  currentUser = await initShell({ activeView: 'purchases' });
  if (!currentUser) return;

  document.getElementById('newGrnBtn').addEventListener('click', openGrnModal);
  document.getElementById('distributorFilter').addEventListener('change', loadPurchases);
  document.getElementById('paymentStatusFilter').addEventListener('change', loadPurchases);

  await loadDistributorFilterOptions();
  await loadPurchases();

  // Dashboard's "+ New Purchase" quick-action links here with ?new=1 so the
  // GRN modal opens immediately instead of landing on a plain list.
  if (new URLSearchParams(location.search).get('new') === '1') {
    openGrnModal();
    history.replaceState(null, '', location.pathname); // don't reopen on refresh
  }
})();

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

async function loadDistributorFilterOptions() {
  try {
    distributorsCache = await api.get('/api/distributors');
    const select = document.getElementById('distributorFilter');
    select.innerHTML = '<option value="">All Distributors</option>' +
      distributorsCache.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
  } catch (e) { /* non-fatal */ }
}

async function loadPurchases() {
  const tbody = document.getElementById('purchasesTbody');
  const params = new URLSearchParams();
  const distributorId = document.getElementById('distributorFilter').value;
  const paymentStatus = document.getElementById('paymentStatusFilter').value;
  if (distributorId) params.set('distributor_id', distributorId);
  if (paymentStatus) params.set('payment_status', paymentStatus);

  try {
    purchasesCache = await api.get('/api/purchases?' + params.toString());
    renderPurchasesTable(purchasesCache);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderPurchasesTable(purchases) {
  const tbody = document.getElementById('purchasesTbody');
  const emptyState = document.getElementById('purchasesEmpty');
  if (purchases.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  tbody.innerHTML = purchases.map(p => `
    <tr>
      <td class="mono">${escapeHtml(p.grn_no || '—')}</td>
      <td>${escapeHtml(p.distributor_name)}</td>
      <td>${escapeHtml(p.invoice_no)}</td>
      <td>${fmtDate(p.invoice_date)}</td>
      <td>${p.item_count}</td>
      <td>${fmtMoney(p.total_amount)}</td>
      <td><span class="badge ${PAYMENT_BADGE[p.payment_status] || 'badge-slate'}">${escapeHtml(p.payment_status)}</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="openDetailModal(${p.id})">View</button></td>
    </tr>
  `).join('');
}

// ---------------- New GRN modal ----------------

async function openGrnModal() {
  try {
    [distributorsCache, itemsCache] = await Promise.all([
      api.get('/api/distributors'),
      api.get('/api/items')
    ]);
  } catch (e) {
    showToast(e.message, true);
    return;
  }
  if (itemsCache.length === 0) {
    showToast('Add at least one item in the Item Master before recording a purchase', true);
    return;
  }
  if (distributorsCache.length === 0) {
    showToast('Add at least one distributor before recording a purchase', true);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const modalRoot = document.getElementById('modalRoot');
  modalRoot.innerHTML = `
    <div class="modal-overlay grn-modal" id="grnModalOverlay">
      <div class="modal">
        <div class="modal-header">
          <h3>New GRN — Receive Stock</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="grnForm">
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-field">
                <label>Distributor *</label>
                <select name="distributor_id" required>
                  <option value="">Select distributor…</option>
                  ${distributorsCache.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')}
                </select>
              </div>
              <div class="form-field">
                <label>Invoice No. *</label>
                <input type="text" name="invoice_no" required placeholder="Distributor's bill number">
              </div>
              <div class="form-field">
                <label>Invoice Date *</label>
                <input type="date" name="invoice_date" required value="${today}">
              </div>
              <div class="form-field">
                <label>Extra Discount (₹)</label>
                <input type="number" name="discount_amount" step="0.01" min="0" value="0">
              </div>
              <div class="form-field span-2">
                <label>Notes</label>
                <input type="text" name="notes" placeholder="Optional">
              </div>
            </div>

            <div class="divider"></div>

            <table class="line-table">
              <thead>
                <tr>
                  <th style="width:18%;">Item</th>
                  <th style="width:10%;">Batch No.</th>
                  <th style="width:9%;">Mfg</th>
                  <th style="width:9%;">Expiry *</th>
                  <th style="width:6%;">Qty</th>
                  <th style="width:6%;">Free</th>
                  <th style="width:8%;">Rate</th>
                  <th style="width:8%;">MRP</th>
                  <th style="width:6%;">Disc%</th>
                  <th style="width:6%;">GST%</th>
                  <th style="width:10%;">Line Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="grnLinesBody"></tbody>
            </table>
            <button type="button" class="btn btn-outline btn-sm" id="addLineBtn">+ Add Line</button>

            <div class="divider"></div>

            <div class="grn-totals">
              <table>
                <tr><td>Taxable Amount</td><td id="ttlTaxable">₹0.00</td></tr>
                <tr><td>Tax (GST)</td><td id="ttlTax">₹0.00</td></tr>
                <tr><td>Discount</td><td id="ttlDiscount">₹0.00</td></tr>
                <tr class="grand"><td>Total (est.)</td><td id="ttlGrand">₹0.00</td></tr>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save GRN</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('grnModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'grnModalOverlay') closeModal();
  });
  document.getElementById('addLineBtn').addEventListener('click', () => addLineRow());
  document.getElementById('grnForm').querySelector('[name="discount_amount"]').addEventListener('input', recalcTotals);
  document.getElementById('grnForm').addEventListener('submit', handleGrnSubmit);

  addLineRow();
}

function addLineRow() {
  const id = 'row' + (++rowSeq);
  const tbody = document.getElementById('grnLinesBody');
  const tr = document.createElement('tr');
  tr.id = id;
  tr.innerHTML = `
    <td>
      <select class="f-item" required>
        <option value="">Select…</option>
        ${itemsCache.map(i => `<option value="${i.id}" data-gst="${i.gst_rate}">${escapeHtml(i.name)}</option>`).join('')}
      </select>
    </td>
    <td><input type="text" class="f-batch" required></td>
    <td><input type="date" class="f-mfg"></td>
    <td><input type="date" class="f-expiry" required></td>
    <td><input type="number" class="f-qty" min="1" step="1" value="1"></td>
    <td><input type="number" class="f-free" min="0" step="1" value="0"></td>
    <td><input type="number" class="f-rate" min="0" step="0.01" value="0"></td>
    <td><input type="number" class="f-mrp" min="0" step="0.01" value="0"></td>
    <td><input type="number" class="f-disc" min="0" max="100" step="0.01" value="0"></td>
    <td><input type="number" class="f-gst" min="0" step="0.01" value="0"></td>
    <td class="line-readout f-total">₹0.00</td>
    <td><button type="button" class="rm-row-btn" title="Remove line">&times;</button></td>
  `;
  tbody.appendChild(tr);

  tr.querySelector('.f-item').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    tr.querySelector('.f-gst').value = opt ? (opt.dataset.gst || 0) : 0;
    recalcRow(tr);
  });
  tr.querySelectorAll('.f-qty, .f-rate, .f-disc, .f-gst, .f-free').forEach(el => {
    el.addEventListener('input', () => recalcRow(tr));
  });
  tr.querySelector('.rm-row-btn').addEventListener('click', () => {
    tr.remove();
    recalcTotals();
  });

  recalcRow(tr);
}

function recalcRow(tr) {
  const qty = parseFloat(tr.querySelector('.f-qty').value) || 0;
  const rate = parseFloat(tr.querySelector('.f-rate').value) || 0;
  const disc = parseFloat(tr.querySelector('.f-disc').value) || 0;
  const gst = parseFloat(tr.querySelector('.f-gst').value) || 0;

  const taxable = round2(qty * rate * (1 - disc / 100));
  const tax = round2(taxable * gst / 100);
  const total = round2(taxable + tax);

  tr.dataset.taxable = taxable;
  tr.dataset.tax = tax;
  tr.querySelector('.f-total').textContent = fmtMoney(total);
  recalcTotals();
}

function recalcTotals() {
  const rows = document.querySelectorAll('#grnLinesBody tr');
  let taxable = 0, tax = 0;
  rows.forEach(tr => {
    taxable += parseFloat(tr.dataset.taxable) || 0;
    tax += parseFloat(tr.dataset.tax) || 0;
  });
  const discountInput = document.querySelector('#grnForm [name="discount_amount"]');
  const discount = discountInput ? (parseFloat(discountInput.value) || 0) : 0;
  const grand = Math.round(taxable + tax - discount);

  document.getElementById('ttlTaxable').textContent = fmtMoney(taxable);
  document.getElementById('ttlTax').textContent = fmtMoney(tax);
  document.getElementById('ttlDiscount').textContent = fmtMoney(discount);
  document.getElementById('ttlGrand').textContent = fmtMoney(grand);
}

async function handleGrnSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const rows = document.querySelectorAll('#grnLinesBody tr');
  if (rows.length === 0) {
    showToast('Add at least one line item', true);
    return;
  }

  const items = Array.from(rows).map(tr => ({
    item_id: tr.querySelector('.f-item').value,
    batch_no: tr.querySelector('.f-batch').value,
    mfg_date: tr.querySelector('.f-mfg').value || null,
    expiry_date: tr.querySelector('.f-expiry').value,
    quantity: tr.querySelector('.f-qty').value,
    free_quantity: tr.querySelector('.f-free').value,
    purchase_rate: tr.querySelector('.f-rate').value,
    mrp: tr.querySelector('.f-mrp').value,
    discount_pct: tr.querySelector('.f-disc').value,
    gst_rate: tr.querySelector('.f-gst').value
  }));

  if (items.some(l => !l.item_id)) {
    showToast('Every line needs an item selected', true);
    return;
  }

  const formData = Object.fromEntries(new FormData(form).entries());
  const payload = {
    distributor_id: formData.distributor_id,
    invoice_no: formData.invoice_no,
    invoice_date: formData.invoice_date,
    discount_amount: formData.discount_amount,
    notes: formData.notes,
    items
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const result = await api.post('/api/purchases', payload);
    showToast(`GRN saved — total ${fmtMoney(result.total_amount)}`);
    closeModal();
    await loadPurchases();
  } catch (err) {
    showToast(err.message, true);
    submitBtn.disabled = false;
  }
}

// ---------------- GRN detail / payment modal ----------------

async function openDetailModal(id) {
  let purchase;
  try {
    purchase = await api.get(`/api/purchases/${id}`);
  } catch (e) {
    showToast(e.message, true);
    return;
  }

  const modalRoot = document.getElementById('modalRoot');
  modalRoot.innerHTML = `
    <div class="modal-overlay grn-modal" id="detailModalOverlay">
      <div class="modal">
        <div class="modal-header">
          <h3>GRN ${escapeHtml(purchase.grn_no || '')}</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-grid" style="margin-bottom:6px;">
            <div><div class="muted" style="font-size:11px;">Distributor</div><strong>${escapeHtml(purchase.distributor_name)}</strong></div>
            <div><div class="muted" style="font-size:11px;">Invoice No.</div><strong>${escapeHtml(purchase.invoice_no)}</strong></div>
            <div><div class="muted" style="font-size:11px;">Invoice Date</div><strong>${fmtDate(purchase.invoice_date)}</strong></div>
            <div><div class="muted" style="font-size:11px;">GRN Date</div><strong>${fmtDate(purchase.grn_date)}</strong></div>
          </div>

          <table class="line-table">
            <thead>
              <tr><th>Item</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>Free</th><th>Rate</th><th>MRP</th><th>GST%</th><th>Line Total</th></tr>
            </thead>
            <tbody>
              ${purchase.items.map(l => `
                <tr>
                  <td>${escapeHtml(l.item_name)}</td>
                  <td class="mono">${escapeHtml(l.batch_no)}</td>
                  <td>${fmtDate(l.expiry_date)}</td>
                  <td>${l.quantity} ${escapeHtml(l.unit)}</td>
                  <td>${l.free_quantity}</td>
                  <td>${fmtMoney(l.purchase_rate)}</td>
                  <td>${fmtMoney(l.mrp)}</td>
                  <td>${l.gst_rate}%</td>
                  <td>${fmtMoney(l.line_total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="grn-totals">
            <table>
              <tr><td>Taxable Amount</td><td>${fmtMoney(purchase.taxable_amount)}</td></tr>
              <tr><td>CGST</td><td>${fmtMoney(purchase.cgst_amount)}</td></tr>
              <tr><td>SGST</td><td>${fmtMoney(purchase.sgst_amount)}</td></tr>
              <tr><td>IGST</td><td>${fmtMoney(purchase.igst_amount)}</td></tr>
              <tr><td>Discount</td><td>-${fmtMoney(purchase.discount_amount)}</td></tr>
              <tr><td>Round Off</td><td>${fmtMoney(purchase.round_off)}</td></tr>
              <tr class="grand"><td>Total</td><td>${fmtMoney(purchase.total_amount)}</td></tr>
            </table>
          </div>

          <div class="divider"></div>

          <div class="flex-between">
            <div>
              <div class="muted" style="font-size:11px;">Payment Status</div>
              <span class="badge ${PAYMENT_BADGE[purchase.payment_status] || 'badge-slate'}">${escapeHtml(purchase.payment_status)}</span>
              <span class="muted" style="font-size:12px;margin-left:8px;">Paid ${fmtMoney(purchase.amount_paid)} of ${fmtMoney(purchase.total_amount)}</span>
            </div>
            <form id="paymentForm" style="display:flex;gap:8px;align-items:center;">
              <input type="number" name="amount_paid" step="0.01" min="0" style="width:120px;padding:7px 9px;border:1px solid var(--line);border-radius:6px;" value="${purchase.amount_paid}">
              <button type="submit" class="btn btn-accent btn-sm">Record Payment</button>
            </form>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="closeModal()">Close</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('detailModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'detailModalOverlay') closeModal();
  });
  document.getElementById('paymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amountPaid = new FormData(e.target).get('amount_paid');
    try {
      await api.put(`/api/purchases/${id}/payment`, { amount_paid: amountPaid });
      showToast('Payment recorded');
      closeModal();
      await loadPurchases();
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}
