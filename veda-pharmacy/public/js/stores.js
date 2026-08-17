// VEDA Pharmacy - Stores (Admin only — shell.js hides this page's nav link
// and the store switcher for everyone else; the backend enforces the same
// Admin-only gate independently on every write, so this page being reached
// directly by a non-Admin still can't do anything destructive)
let currentUser = null;
let storesCache = [];

(async function init() {
  currentUser = await initShell({ activeView: 'stores' });
  if (!currentUser) return;

  document.getElementById('addStoreBtn').addEventListener('click', () => openModal(null));
  document.getElementById('includeInactive').addEventListener('change', loadStores);

  await loadStores();
})();

async function loadStores() {
  const tbody = document.getElementById('storesTbody');
  const params = new URLSearchParams();
  if (document.getElementById('includeInactive').checked) params.set('include_inactive', '1');

  try {
    storesCache = await api.get('/api/stores?' + params.toString());
    renderTable(storesCache);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderTable(stores) {
  const tbody = document.getElementById('storesTbody');
  const emptyState = document.getElementById('storesEmpty');
  if (stores.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  tbody.innerHTML = stores.map(s => `
    <tr${s.is_active ? '' : ' style="opacity:0.55;"'}>
      <td>
        <strong>${escapeHtml(s.name)}</strong>
        ${s.id === currentUser.storeId ? '<span class="badge badge-blue" style="margin-left:6px;">Current</span>' : ''}
      </td>
      <td class="mono">${escapeHtml(s.code)}</td>
      <td>${escapeHtml(s.city || '—')}${s.state ? ', ' + escapeHtml(s.state) : ''}</td>
      <td class="mono">${escapeHtml(s.gstin || '—')}</td>
      <td class="mono">${escapeHtml(s.drug_license_no || '—')}</td>
      <td>${s.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-slate">Inactive</span>'}</td>
      <td style="white-space:nowrap;">
        ${s.is_active && s.id !== currentUser.storeId ? `<button class="btn btn-secondary btn-sm" onclick="handleSwitch(${s.id})">Switch to</button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="openModal(${s.id})">Edit</button>
        ${s.is_active ? `<button class="btn btn-danger-outline btn-sm" onclick="handleDelete(${s.id})">Remove</button>` : ''}
      </td>
    </tr>
  `).join('');
}

async function handleSwitch(storeId) {
  try {
    await api.post('/api/stores/switch', { store_id: storeId });
    showToast('Switched store');
    window.location.reload();
  } catch (e) {
    showToast(e.message, true);
  }
}

function openModal(id) {
  const s = id ? storesCache.find(x => x.id === id) || {} : {};
  const isEdit = !!id;

  const modalRoot = document.getElementById('modalRoot');
  modalRoot.innerHTML = `
    <div class="modal-overlay" id="storeModalOverlay">
      <div class="modal">
        <div class="modal-header">
          <h3>${isEdit ? 'Edit Store' : 'Add Store'}</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="storeForm">
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-field span-2">
                <label>Store Name *</label>
                <input type="text" name="name" required value="${escapeHtml(s.name || '')}" placeholder="e.g. Indore Branch">
              </div>
              <div class="form-field">
                <label>Code *</label>
                <input type="text" name="code" required value="${escapeHtml(s.code || '')}" placeholder="e.g. VP-INDORE-01">
                <div class="form-hint">Short, unique identifier — used internally, not shown to customers.</div>
              </div>
              <div class="form-field">
                <label>Phone</label>
                <input type="text" name="phone" value="${escapeHtml(s.phone || '')}">
              </div>
              <div class="form-field span-2">
                <label>Address</label>
                <input type="text" name="address" value="${escapeHtml(s.address || '')}">
              </div>
              <div class="form-field">
                <label>City</label>
                <input type="text" name="city" value="${escapeHtml(s.city || '')}">
              </div>
              <div class="form-field">
                <label>State</label>
                <input type="text" name="state" value="${escapeHtml(s.state || '')}" placeholder="e.g. Madhya Pradesh">
              </div>
              <div class="form-field">
                <label>Pincode</label>
                <input type="text" name="pincode" value="${escapeHtml(s.pincode || '')}">
              </div>
              <div class="form-field">
                <label>GSTIN</label>
                <input type="text" name="gstin" value="${escapeHtml(s.gstin || '')}" placeholder="e.g. 23AAAAA0000A1Z5">
              </div>
              <div class="form-field">
                <label>Drug License No. (Retail)</label>
                <input type="text" name="drug_license_no" value="${escapeHtml(s.drug_license_no || '')}" placeholder="Form 20/21">
              </div>
              <div class="form-field">
                <label>Drug License No. 2 (H1/X)</label>
                <input type="text" name="drug_license_no_2" value="${escapeHtml(s.drug_license_no_2 || '')}">
              </div>
              <div class="form-field span-2">
                <label>Drug License Expiry</label>
                <input type="date" name="drug_license_expiry" value="${s.drug_license_expiry ? s.drug_license_expiry.slice(0, 10) : ''}">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Store'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('storeModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'storeModalOverlay') closeModal();
  });
  document.getElementById('storeForm').addEventListener('submit', (e) => handleSubmit(e, id));
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}

async function handleSubmit(e, id) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    if (id) {
      await api.put(`/api/stores/${id}`, data);
      showToast('Store updated');
    } else {
      await api.post('/api/stores', data);
      showToast('Store added');
    }
    closeModal();
    await loadStores();
  } catch (err) {
    showToast(err.message, true);
    submitBtn.disabled = false;
  }
}

async function handleDelete(id) {
  const s = storesCache.find(x => x.id === id);
  if (!s) return;
  if (!confirm(`Remove "${s.name}"? Its historical data stays intact — this just hides it from the switcher and new staff assignment.`)) return;

  try {
    await api.del(`/api/stores/${id}`);
    showToast('Store removed');
    await loadStores();
  } catch (err) {
    showToast(err.message, true);
  }
}
