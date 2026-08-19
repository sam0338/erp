// VEDA Pharmacy - Stock Out / Returns
// MediPro's Stock Out page picks a product and deducts from its flat stock
// count. VEDA tracks stock per batch/lot (for FEFO + expiry), so this page
// picks a medicine, then cascades to which specific batch the write-off
// comes out of — same POST /api/batches/adjustments the Batches & Stock
// page's per-row "Adjust" action already uses, just entered from a
// dedicated top-level page matching MediPro's layout.
let currentUser = null;
let itemsCache = [];
let batchesForItem = [];

(async function init() {
  currentUser = await initShell({ activeView: 'stock-out' });
  if (!currentUser) return;

  try {
    itemsCache = await api.get('/api/items');
  } catch (e) { showToast(e.message, true); }

  const itemSelect = document.getElementById('so-item');
  itemSelect.innerHTML = '<option value="">-- Select Medicine --</option>' +
    itemsCache.map(i => `<option value="${i.id}">${escapeHtml(i.name)}${i.unit ? ' (' + escapeHtml(i.unit) + ')' : ''}</option>`).join('');
  itemSelect.addEventListener('change', loadBatchesForItem);

  document.getElementById('stockOutForm').addEventListener('submit', handleSubmit);

  await loadRecentStockOut();
})();

async function loadBatchesForItem() {
  const itemId = document.getElementById('so-item').value;
  const batchSelect = document.getElementById('so-batch');
  const hint = document.getElementById('so-batch-hint');

  if (!itemId) {
    batchSelect.innerHTML = '<option value="">-- Select medicine first --</option>';
    batchSelect.disabled = true;
    hint.textContent = '';
    return;
  }

  try {
    batchesForItem = await api.get(`/api/batches?item_id=${itemId}`);
  } catch (e) {
    showToast(e.message, true);
    return;
  }

  if (batchesForItem.length === 0) {
    batchSelect.innerHTML = '<option value="">No stock available</option>';
    batchSelect.disabled = true;
    hint.textContent = 'This medicine has no in-stock batches at this store.';
    return;
  }

  batchSelect.disabled = false;
  batchSelect.innerHTML = batchesForItem.map(b =>
    `<option value="${b.id}">${escapeHtml(b.batch_no)} — ${b.quantity} in stock, exp. ${fmtDate(b.expiry_date)}</option>`
  ).join('');
  updateBatchHint();
  batchSelect.onchange = updateBatchHint;
}

function updateBatchHint() {
  const batchId = parseInt(document.getElementById('so-batch').value, 10);
  const batch = batchesForItem.find(b => b.id === batchId);
  const hint = document.getElementById('so-batch-hint');
  const qtyInput = document.getElementById('so-qty');
  if (batch) {
    hint.textContent = `Max ${batch.quantity} ${batch.unit} available in this batch.`;
    qtyInput.max = batch.quantity;
  } else {
    hint.textContent = '';
    qtyInput.removeAttribute('max');
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  const batchId = document.getElementById('so-batch').value;
  const adjustment_type = document.getElementById('so-type').value;
  const quantity = document.getElementById('so-qty').value;
  const reason = document.getElementById('so-reason').value.trim();

  if (!batchId) { showToast('Select a medicine and batch', true); return; }
  if (!quantity || parseInt(quantity, 10) <= 0) { showToast('Enter a valid quantity', true); return; }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    await api.post('/api/batches/adjustments', { batch_id: batchId, adjustment_type, quantity, reason: reason || null });
    showToast(`Stock reduced: -${quantity} units`);
    document.getElementById('stockOutForm').reset();
    document.getElementById('so-batch').innerHTML = '<option value="">-- Select medicine first --</option>';
    document.getElementById('so-batch').disabled = true;
    document.getElementById('so-batch-hint').textContent = '';
    await loadRecentStockOut();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
}

async function loadRecentStockOut() {
  const tbody = document.getElementById('recentStockOutTbody');
  try {
    const rows = await api.get('/api/movements?type=Adjustment&limit=20');
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No stock-out records yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td style="font-size:11px;">${fmtDate(r.date)}</td>
        <td>${escapeHtml(r.item_name)}</td>
        <td><span class="badge badge-red">${r.quantity}</span></td>
        <td style="font-size:12px;">${escapeHtml(r.reference)}</td>
        <td class="muted" style="font-size:11px;">${escapeHtml((r.note || '').slice(0, 40))}</td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
  }
}
