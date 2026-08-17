// VEDA Pharmacy - Purchase Orders
let currentUser = null;
let poCache = [];
let distributorsCache = [];
let itemsCache = [];
let currentTab = '';
let rowSeq = 0;

const STATUS_BADGE = { Draft: 'badge-slate', Sent: 'badge-amber', Cancelled: 'badge-red' };
const GRN_STATUS_BADGE = { Pending: 'badge-slate', 'Partial GRN': 'badge-amber', 'Fully Received': 'badge-green' };

(async function init() {
  currentUser = await initShell({ activeView: 'purchase-orders' });
  if (!currentUser) return;

  document.getElementById('newPoBtn').addEventListener('click', openPoModal);
  document.querySelectorAll('#statusTabs .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#statusTabs .tab').forEach(b => b.classList.toggle('active', b === btn));
      currentTab = btn.dataset.tab;
      loadPos();
    });
  });

  await loadPos();
})();

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

async function loadPos() {
  const tbody = document.getElementById('poTbody');
  const params = new URLSearchParams();
  // "Draft"/"Sent"/"Cancelled" are the stored status column; the other tabs
  // filter on the derived grn_status the backend computes per PO (see the
  // note on computeGrnStatus in routes/purchase-orders.js).
  if (['Draft', 'Sent', 'Cancelled'].includes(currentTab)) params.set('status', currentTab);
  else if (currentTab) params.set('grn_status', currentTab);

  try {
    poCache = await api.get('/api/purchase-orders?' + params.toString());
    renderTable(poCache);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderTable(pos) {
  const tbody = document.getElementById('poTbody');
  const emptyState = document.getElementById('poEmpty');
  if (pos.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  tbody.innerHTML = pos.map(po => `
    <tr>
      <td class="mono">${escapeHtml(po.po_no)}</td>
      <td>${escapeHtml(po.distributor_name)}</td>
      <td>${fmtDate(po.po_date)}</td>
      <td>${po.expected_date ? fmtDate(po.expected_date) : '—'}</td>
      <td>${po.item_count}</td>
      <td>${fmtMoney(po.total_amount)}</td>
      <td><span class="badge ${STATUS_BADGE[po.status] || 'badge-slate'}">${escapeHtml(po.status)}</span></td>
      <td><span class="badge ${GRN_STATUS_BADGE[po.grn_status] || 'badge-slate'}">${escapeHtml(po.grn_status)}</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="openDetailModal(${po.id})">View</button></td>
    </tr>
  `).join('');
}

// ---------------- New / Edit PO modal ----------------

async function openPoModal(editId) {
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
    showToast('Add at least one item in the Item Master before raising a PO', true);
    return;
  }
  if (distributorsCache.length === 0) {
    showToast('Add at least one distributor before raising a PO', true);
    return;
  }

  let editingPo = null;
  if (editId) {
    try {
      editingPo = await api.get(`/api/purchase-orders/${editId}`);
    } catch (e) {
      showToast(e.message, true);
      return;
    }
  }

  const modalRoot = document.getElementById('modalRoot');
  modalRoot.innerHTML = `
    <div class="modal-overlay grn-modal" id="poModalOverlay">
      <div class="modal">
        <div class="modal-header">
          <h3>${editingPo ? `Edit ${escapeHtml(editingPo.po_no)}` : 'New Purchase Order'}</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="poForm">
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-field">
                <label>Distributor *</label>
                <select name="distributor_id" required>
                  <option value="">Select distributor…</option>
                  ${distributorsCache.map(d => `<option value="${d.id}" ${editingPo && editingPo.distributor_id === d.id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}
                </select>
              </div>
              <div class="form-field">
                <label>Expected Date</label>
                <input type="date" name="expected_date" value="${editingPo && editingPo.expected_date ? editingPo.expected_date : ''}">
              </div>
              <div class="form-field span-2">
                <label>Notes</label>
                <input type="text" name="notes" value="${escapeHtml(editingPo && editingPo.notes || '')}" placeholder="Optional">
              </div>
            </div>

            <div class="divider"></div>

            <table class="line-table">
              <thead>
                <tr>
                  <th style="width:34%;">Item</th>
                  <th style="width:14%;">Qty Ordered</th>
                  <th style="width:16%;">Rate</th>
                  <th style="width:12%;">GST%</th>
                  <th style="width:16%;">Line Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="poLinesBody"></tbody>
            </table>
            <button type="button" class="btn btn-outline btn-sm" id="addPoLineBtn">+ Add Line</button>

            <div class="divider"></div>

            <div class="grn-totals">
              <table>
                <tr><td>Taxable Amount</td><td id="poTtlTaxable">₹0.00</td></tr>
                <tr><td>Tax (GST)</td><td id="poTtlTax">₹0.00</td></tr>
                <tr class="grand"><td>Total (est.)</td><td id="poTtlGrand">₹0.00</td></tr>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">${editingPo ? 'Save Changes' : 'Save as Draft'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('poModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'poModalOverlay') closeModal();
  });
  document.getElementById('addPoLineBtn').addEventListener('click', () => addPoLineRow());
  document.getElementById('poForm').addEventListener('submit', (e) => handlePoSubmit(e, editId));

  if (editingPo && editingPo.items.length > 0) {
    editingPo.items.forEach(l => addPoLineRow({ item_id: l.item_id, quantity_ordered: l.quantity_ordered, rate: l.rate, gst_rate: l.gst_rate }));
  } else {
    addPoLineRow();
  }
}

function addPoLineRow(prefill) {
  const id = 'porow' + (++rowSeq);
  const tbody = document.getElementById('poLinesBody');
  const tr = document.createElement('tr');
  tr.id = id;
  tr.innerHTML = `
    <td>
      <select class="f-item" required>
        <option value="">Select…</option>
        ${itemsCache.map(i => `<option value="${i.id}" data-gst="${i.gst_rate}" ${prefill && String(prefill.item_id) === String(i.id) ? 'selected' : ''}>${escapeHtml(i.name)}</option>`).join('')}
      </select>
    </td>
    <td><input type="number" class="f-qty" min="1" step="1" value="${prefill ? prefill.quantity_ordered : 1}"></td>
    <td><input type="number" class="f-rate" min="0" step="0.01" value="${prefill ? prefill.rate : 0}"></td>
    <td><input type="number" class="f-gst" min="0" step="0.01" value="${prefill ? prefill.gst_rate : 0}"></td>
    <td class="line-readout f-total">₹0.00</td>
    <td><button type="button" class="rm-row-btn" title="Remove line">&times;</button></td>
  `;
  tbody.appendChild(tr);

  tr.querySelector('.f-item').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    tr.querySelector('.f-gst').value = opt ? (opt.dataset.gst || 0) : 0;
    recalcPoRow(tr);
  });
  tr.querySelectorAll('.f-qty, .f-rate, .f-gst').forEach(el => el.addEventListener('input', () => recalcPoRow(tr)));
  tr.querySelector('.rm-row-btn').addEventListener('click', () => { tr.remove(); recalcPoTotals(); });

  recalcPoRow(tr);
}

function recalcPoRow(tr) {
  const qty = parseFloat(tr.querySelector('.f-qty').value) || 0;
  const rate = parseFloat(tr.querySelector('.f-rate').value) || 0;
  const gst = parseFloat(tr.querySelector('.f-gst').value) || 0;

  const taxable = round2(qty * rate);
  const tax = round2(taxable * gst / 100);

  tr.dataset.taxable = taxable;
  tr.dataset.tax = tax;
  tr.querySelector('.f-total').textContent = fmtMoney(taxable + tax);
  recalcPoTotals();
}

function recalcPoTotals() {
  const rows = document.querySelectorAll('#poLinesBody tr');
  let taxable = 0, tax = 0;
  rows.forEach(tr => {
    taxable += parseFloat(tr.dataset.taxable) || 0;
    tax += parseFloat(tr.dataset.tax) || 0;
  });
  document.getElementById('poTtlTaxable').textContent = fmtMoney(taxable);
  document.getElementById('poTtlTax').textContent = fmtMoney(tax);
  document.getElementById('poTtlGrand').textContent = fmtMoney(taxable + tax);
}

async function handlePoSubmit(e, editId) {
  e.preventDefault();
  const form = e.target;
  const rows = document.querySelectorAll('#poLinesBody tr');
  if (rows.length === 0) {
    showToast('Add at least one line item', true);
    return;
  }

  const items = Array.from(rows).map(tr => ({
    item_id: tr.querySelector('.f-item').value,
    quantity_ordered: tr.querySelector('.f-qty').value,
    rate: tr.querySelector('.f-rate').value,
    gst_rate: tr.querySelector('.f-gst').value
  }));
  if (items.some(l => !l.item_id)) {
    showToast('Every line needs an item selected', true);
    return;
  }

  const formData = Object.fromEntries(new FormData(form).entries());
  const payload = {
    distributor_id: formData.distributor_id,
    expected_date: formData.expected_date || null,
    notes: formData.notes,
    items
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    if (editId) {
      await api.put(`/api/purchase-orders/${editId}`, payload);
      showToast('Purchase order updated');
    } else {
      const result = await api.post('/api/purchase-orders', payload);
      showToast(`Purchase order saved — total ${fmtMoney(result.total_amount)}`);
    }
    closeModal();
    await loadPos();
  } catch (err) {
    showToast(err.message, true);
    submitBtn.disabled = false;
  }
}

// ---------------- Detail modal ----------------

async function openDetailModal(id) {
  let po;
  try {
    po = await api.get(`/api/purchase-orders/${id}`);
  } catch (e) {
    showToast(e.message, true);
    return;
  }

  const modalRoot = document.getElementById('modalRoot');
  modalRoot.innerHTML = `
    <div class="modal-overlay grn-modal" id="poDetailOverlay">
      <div class="modal">
        <div class="modal-header">
          <h3>${escapeHtml(po.po_no)}
            <span class="badge ${STATUS_BADGE[po.status] || 'badge-slate'}" style="margin-left:8px;">${escapeHtml(po.status)}</span>
            <span class="badge ${GRN_STATUS_BADGE[po.grn_status] || 'badge-slate'}">${escapeHtml(po.grn_status)}</span>
          </h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-grid" style="margin-bottom:6px;">
            <div><div class="muted" style="font-size:11px;">Distributor</div><strong>${escapeHtml(po.distributor_name)}</strong></div>
            <div><div class="muted" style="font-size:11px;">PO Date</div><strong>${fmtDate(po.po_date)}</strong></div>
            <div><div class="muted" style="font-size:11px;">Expected Date</div><strong>${po.expected_date ? fmtDate(po.expected_date) : '—'}</strong></div>
            <div><div class="muted" style="font-size:11px;">Notes</div><strong>${escapeHtml(po.notes || '—')}</strong></div>
          </div>

          <table class="line-table">
            <thead>
              <tr><th>Item</th><th>Ordered</th><th>Received</th><th>Pending</th><th>Rate</th><th>GST%</th><th>Line Total</th></tr>
            </thead>
            <tbody>
              ${po.items.map(l => `
                <tr>
                  <td>${escapeHtml(l.item_name)}</td>
                  <td>${l.quantity_ordered} ${escapeHtml(l.unit)}</td>
                  <td>${Math.min(l.quantity_received, l.quantity_ordered)}</td>
                  <td>${l.quantity_pending}</td>
                  <td>${fmtMoney(l.rate)}</td>
                  <td>${l.gst_rate}%</td>
                  <td>${fmtMoney(l.line_total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="grn-totals">
            <table>
              <tr><td>Taxable Amount</td><td>${fmtMoney(po.taxable_amount)}</td></tr>
              <tr><td>Tax (GST)</td><td>${fmtMoney(po.tax_amount)}</td></tr>
              <tr class="grand"><td>Total</td><td>${fmtMoney(po.total_amount)}</td></tr>
            </table>
          </div>

          ${po.grns.length > 0 ? `
            <div class="divider"></div>
            <div class="muted" style="font-size:11px;margin-bottom:6px;">GRNs received against this PO</div>
            <table class="line-table">
              <thead><tr><th>GRN No.</th><th>Date</th><th>Amount</th></tr></thead>
              <tbody>
                ${po.grns.map(g => `<tr><td class="mono">${escapeHtml(g.grn_no)}</td><td>${fmtDate(g.grn_date)}</td><td>${fmtMoney(g.total_amount)}</td></tr>`).join('')}
              </tbody>
            </table>
          ` : ''}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="closeModal()">Close</button>
          ${po.status === 'Draft' ? `<button type="button" class="btn btn-secondary" onclick="closeModal();openPoModal(${po.id})">Edit</button>` : ''}
          ${po.status === 'Draft' ? `<button type="button" class="btn btn-accent" onclick="changePoStatus(${po.id}, 'Sent')">Mark as Sent</button>` : ''}
          ${po.status !== 'Cancelled' ? `<button type="button" class="btn btn-danger-outline" onclick="changePoStatus(${po.id}, 'Cancelled')">Cancel PO</button>` : ''}
          ${po.status !== 'Cancelled' && po.grn_status !== 'Fully Received' ? `<button type="button" class="btn btn-primary" onclick="window.location.href='/purchases.html?po=${po.id}'">Receive as GRN</button>` : ''}
        </div>
      </div>
    </div>
  `;

  document.getElementById('poDetailOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'poDetailOverlay') closeModal();
  });
}

async function changePoStatus(id, status) {
  if (status === 'Cancelled' && !confirm('Cancel this purchase order? Anything already received against it stays on record — only the still-outstanding quantity is written off.')) return;
  try {
    await api.put(`/api/purchase-orders/${id}/status`, { status });
    showToast(`Purchase order marked ${status}`);
    closeModal();
    await loadPos();
  } catch (e) {
    showToast(e.message, true);
  }
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}
