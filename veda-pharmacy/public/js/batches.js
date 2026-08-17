// VEDA Pharmacy - Batches & Stock
let currentUser = null;
let batchesCache = [];

const EXPIRY_BADGE = { expired: 'badge-danger', near: 'badge-warn', ok: 'badge-ok' };
const ADJUSTMENT_TYPES = ['Expired', 'Damaged', 'Lost', 'Correction'];

(async function init() {
  currentUser = await initShell({ activeView: 'batches' });
  if (!currentUser) return;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.getElementById('searchInput').addEventListener('input', debounce(loadBatches, 250));
  document.getElementById('expiryFilter').addEventListener('change', loadBatches);
  document.getElementById('includeExhausted').addEventListener('change', loadBatches);

  await loadBatches();
})();

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('batchesTab').style.display = tab === 'batches' ? 'block' : 'none';
  document.getElementById('adjustmentsTab').style.display = tab === 'adjustments' ? 'block' : 'none';
  if (tab === 'adjustments') loadAdjustments();
}

function daysUntil(dateStr) {
  const ms = new Date(dateStr + 'T00:00:00') - new Date(new Date().toDateString());
  return Math.round(ms / 86400000);
}

async function loadBatches() {
  const tbody = document.getElementById('batchesTbody');
  const q = document.getElementById('searchInput').value.trim();
  const expiry = document.getElementById('expiryFilter').value;
  const includeExhausted = document.getElementById('includeExhausted').checked;

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (expiry) params.set('expiry', expiry);
  if (includeExhausted) params.set('include_exhausted', '1');

  try {
    batchesCache = await api.get('/api/batches?' + params.toString());
    renderBatchesTable(batchesCache);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderBatchesTable(batches) {
  const tbody = document.getElementById('batchesTbody');
  if (batches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No batches found. Receive a GRN under Purchases to bring stock in.</td></tr>';
    return;
  }

  tbody.innerHTML = batches.map(b => {
    const days = daysUntil(b.expiry_date);
    let expiryLabel;
    if (b.expiry_status === 'expired') expiryLabel = `Expired ${Math.abs(days)}d ago`;
    else if (b.expiry_status === 'near') expiryLabel = `${days}d left`;
    else expiryLabel = fmtDate(b.expiry_date);

    return `
      <tr${b.quantity <= 0 ? ' style="opacity:0.55;"' : ''}>
        <td>
          <strong>${escapeHtml(b.item_name)}</strong>
          <div class="muted" style="font-size:11.5px;">${escapeHtml(b.unit)}${b.schedule !== 'OTC' ? ' · ' + escapeHtml(b.schedule) : ''}</div>
        </td>
        <td class="mono">${escapeHtml(b.batch_no)}</td>
        <td>${fmtDate(b.mfg_date)}</td>
        <td><span class="badge ${EXPIRY_BADGE[b.expiry_status] || 'badge-neutral'}">${expiryLabel}</span></td>
        <td>${b.quantity}</td>
        <td>${fmtMoney(b.purchase_rate)}</td>
        <td>${fmtMoney(b.mrp)}</td>
        <td>${escapeHtml(b.distributor_name || '—')}</td>
        <td>${b.quantity > 0 ? `<button class="btn btn-outline btn-sm" onclick="openAdjustModal(${b.id})">Adjust</button>` : ''}</td>
      </tr>
    `;
  }).join('');
}

async function loadAdjustments() {
  const tbody = document.getElementById('adjustmentsTbody');
  try {
    const rows = await api.get('/api/batches/adjustments');
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No stock adjustments recorded yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(a => `
      <tr>
        <td>${fmtDate(a.created_at)}</td>
        <td>${escapeHtml(a.item_name)}</td>
        <td class="mono">${escapeHtml(a.batch_no)}</td>
        <td><span class="badge badge-neutral">${escapeHtml(a.adjustment_type)}</span></td>
        <td>${a.quantity} ${escapeHtml(a.unit)}</td>
        <td>${escapeHtml(a.reason || '—')}</td>
        <td>${escapeHtml(a.created_by_name || '—')}</td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
  }
}

function openAdjustModal(batchId) {
  const b = batchesCache.find(x => x.id === batchId);
  if (!b) return;

  const modalRoot = document.getElementById('modalRoot');
  modalRoot.innerHTML = `
    <div class="modal-overlay" id="adjModalOverlay">
      <div class="modal">
        <div class="modal-header">
          <h3>Adjust Stock</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="adjForm">
          <div class="modal-body">
            <p class="muted" style="margin-bottom:14px;">
              <strong>${escapeHtml(b.item_name)}</strong> — batch <span class="mono">${escapeHtml(b.batch_no)}</span>,
              ${b.quantity} ${escapeHtml(b.unit)} currently in stock.
            </p>
            <div class="form-field">
              <label>Adjustment Type *</label>
              <select name="adjustment_type" required>
                ${ADJUSTMENT_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
              </select>
            </div>
            <div class="form-field">
              <label>Quantity *</label>
              <input type="number" name="quantity" min="1" max="${b.quantity}" required value="1">
              <div class="form-hint">Max ${b.quantity} ${escapeHtml(b.unit)} available in this batch.</div>
            </div>
            <div class="form-field">
              <label>Reason</label>
              <input type="text" name="reason" placeholder="Optional note">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-danger-outline">Write Off Stock</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('adjModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'adjModalOverlay') closeModal();
  });
  document.getElementById('adjForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    data.batch_id = batchId;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await api.post('/api/batches/adjustments', data);
      showToast('Stock adjusted');
      closeModal();
      await loadBatches();
    } catch (err) {
      showToast(err.message, true);
      submitBtn.disabled = false;
    }
  });
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}
