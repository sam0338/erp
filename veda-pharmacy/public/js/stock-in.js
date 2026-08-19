// VEDA Pharmacy - Stock In (Direct / Opening Stock + Bulk Excel Import)
let currentUser = null;

(async function init() {
  currentUser = await initShell({ activeView: 'stock-in' });
  if (!currentUser) return;

  try {
    const [items, distributors] = await Promise.all([
      api.get('/api/items'),
      api.get('/api/distributors')
    ]);
    document.getElementById('si-item').innerHTML = '<option value="">-- Select Medicine --</option>' +
      items.map(i => `<option value="${i.id}">${escapeHtml(i.name)}${i.unit ? ' (' + escapeHtml(i.unit) + ')' : ''}</option>`).join('');
    document.getElementById('si-distributor').innerHTML = '<option value="">-- None / Unknown --</option>' +
      distributors.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
  } catch (e) { showToast(e.message, true); }

  document.getElementById('stockInForm').addEventListener('submit', handleManualSubmit);
  document.getElementById('bulkImportForm').addEventListener('submit', handleBulkImport);

  await loadRecentStockIn();
})();

async function handleManualSubmit(e) {
  e.preventDefault();
  const payload = {
    item_id: document.getElementById('si-item').value,
    batch_no: document.getElementById('si-batch').value.trim(),
    mfg_date: document.getElementById('si-mfg').value || null,
    expiry_date: document.getElementById('si-expiry').value,
    quantity: document.getElementById('si-qty').value,
    purchase_rate: document.getElementById('si-purchase').value,
    mrp: document.getElementById('si-mrp').value,
    distributor_id: document.getElementById('si-distributor').value || null,
    supplier_name: document.getElementById('si-supplier').value.trim() || null,
    reference_no: document.getElementById('si-reference').value.trim() || null,
    notes: document.getElementById('si-notes').value.trim() || null
  };

  if (!payload.item_id) { showToast('Select a medicine', true); return; }
  if (!payload.batch_no) { showToast('Enter a batch number', true); return; }
  if (!payload.expiry_date) { showToast('Enter an expiry date', true); return; }
  if (!payload.quantity || parseInt(payload.quantity, 10) <= 0) { showToast('Enter a valid quantity', true); return; }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const result = await api.post('/api/stock-in', payload);
    showToast(`Stock updated: +${result.quantity} units added`);
    e.target.reset();
    await loadRecentStockIn();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
}

// Multipart upload — api.js's helper always sends JSON, so this bypasses it
// with a plain fetch instead of stretching that helper to cover both.
async function handleBulkImport(e) {
  e.preventDefault();
  const fileInput = document.getElementById('bulk-file');
  const resultBox = document.getElementById('bulkImportResult');
  if (!fileInput.files || fileInput.files.length === 0) {
    showToast('Choose a filled-in .xlsx file first', true);
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  const btn = document.getElementById('bulkImportBtn');
  btn.disabled = true;
  resultBox.innerHTML = '<p class="muted" style="font-size:12.5px;">Importing…</p>';

  try {
    const res = await fetch('/api/stock-in/bulk', { method: 'POST', body: formData });
    let data = null;
    try { data = await res.json(); } catch (err) { /* no body */ }
    if (!res.ok) throw new Error((data && data.error) || `Import failed (${res.status})`);

    const parts = [`<div class="alert alert-success">✅ Imported <strong>${data.imported}</strong> stock-in row(s)`];
    if (data.itemsCreated > 0) parts.push(`, creating <strong>${data.itemsCreated}</strong> new medicine(s) in your Item Master`);
    parts.push('.</div>');
    let html = parts.join('');

    if (data.errors && data.errors.length > 0) {
      html += `<div class="alert alert-warning">⚠️ ${data.errors.length} row(s) were skipped:</div>`;
      html += '<table style="width:100%;font-size:12px;"><thead><tr><th style="text-align:left;">Row</th><th style="text-align:left;">Medicine</th><th style="text-align:left;">Problem</th></tr></thead><tbody>' +
        data.errors.map(err => `<tr><td>${err.row}</td><td>${escapeHtml(err.medicine || '—')}</td><td>${escapeHtml(err.message)}</td></tr>`).join('') +
        '</tbody></table>';
    }
    resultBox.innerHTML = html;
    fileInput.value = '';
    showToast(`Bulk import complete — ${data.imported} row(s) added`);
    await loadRecentStockIn();
  } catch (err) {
    resultBox.innerHTML = `<div class="alert alert-danger">❌ ${escapeHtml(err.message)}</div>`;
    showToast(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

async function loadRecentStockIn() {
  const tbody = document.getElementById('recentStockInTbody');
  try {
    const rows = await api.get('/api/stock-in?limit=25');
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No stock-in records yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td style="font-size:11px;">${fmtDate(r.created_at)}</td>
        <td>${escapeHtml(r.item_name)}</td>
        <td><span class="badge badge-green">+${r.quantity}</span></td>
        <td class="mono" style="font-size:11px;">${escapeHtml(r.batch_no)}</td>
        <td style="font-size:11px;">${r.source === 'Bulk Excel Import' ? '📊 Bulk' : '✍️ Manual'}</td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
  }
}
