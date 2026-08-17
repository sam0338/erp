// VEDA Pharmacy - Distributors
let currentUser = null;
let distributorsCache = [];

(async function init() {
  currentUser = await initShell({ activeView: 'distributors' });
  if (!currentUser) return;

  document.getElementById('addDistributorBtn').addEventListener('click', () => openModal(null));
  document.getElementById('searchInput').addEventListener('input', debounce(loadDistributors, 250));
  document.getElementById('includeInactive').addEventListener('change', loadDistributors);

  await loadDistributors();
})();

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function loadDistributors() {
  const tbody = document.getElementById('distributorsTbody');
  const q = document.getElementById('searchInput').value.trim();
  const includeInactive = document.getElementById('includeInactive').checked;

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (includeInactive) params.set('include_inactive', '1');

  try {
    distributorsCache = await api.get('/api/distributors?' + params.toString());
    renderTable(distributorsCache);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderTable(distributors) {
  const tbody = document.getElementById('distributorsTbody');
  if (distributors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No distributors found. Add one to start recording purchases.</td></tr>';
    return;
  }

  tbody.innerHTML = distributors.map(d => {
    const outstandingBadge = d.outstanding_balance > 0
      ? `<span class="badge badge-warn">${fmtMoney(d.outstanding_balance)}</span>`
      : `<span class="badge badge-ok">${fmtMoney(0)}</span>`;
    return `
      <tr${d.is_active ? '' : ' style="opacity:0.55;"'}>
        <td>
          <strong>${escapeHtml(d.name)}</strong>
          ${d.city ? `<div class="muted" style="font-size:11.5px;">${escapeHtml(d.city)}${d.state ? ', ' + escapeHtml(d.state) : ''}</div>` : ''}
          ${d.is_active ? '' : '<span class="badge badge-neutral" style="margin-top:4px;">Inactive</span>'}
        </td>
        <td>
          ${escapeHtml(d.contact_person || '—')}
          ${d.phone ? `<div class="muted" style="font-size:11.5px;">${escapeHtml(d.phone)}</div>` : ''}
        </td>
        <td class="mono">${escapeHtml(d.gstin || '—')}</td>
        <td class="mono">${escapeHtml(d.drug_license_no || '—')}</td>
        <td>${fmtMoney(d.lifetime_purchases)}</td>
        <td>${outstandingBadge}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-outline btn-sm" onclick="openModal(${d.id})">Edit</button>
          ${d.is_active ? `<button class="btn btn-danger-outline btn-sm" onclick="handleDelete(${d.id})">Remove</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

function openModal(id) {
  const d = id ? distributorsCache.find(x => x.id === id) || {} : {};
  const isEdit = !!id;

  const modalRoot = document.getElementById('modalRoot');
  modalRoot.innerHTML = `
    <div class="modal-overlay" id="distModalOverlay">
      <div class="modal">
        <div class="modal-header">
          <h3>${isEdit ? 'Edit Distributor' : 'Add Distributor'}</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="distForm">
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-field span-2">
                <label>Distributor Name *</label>
                <input type="text" name="name" required value="${escapeHtml(d.name || '')}" placeholder="e.g. Sharma Pharma Distributors">
              </div>
              <div class="form-field">
                <label>Contact Person</label>
                <input type="text" name="contact_person" value="${escapeHtml(d.contact_person || '')}">
              </div>
              <div class="form-field">
                <label>Phone</label>
                <input type="text" name="phone" value="${escapeHtml(d.phone || '')}">
              </div>
              <div class="form-field">
                <label>Email</label>
                <input type="email" name="email" value="${escapeHtml(d.email || '')}">
              </div>
              <div class="form-field">
                <label>GSTIN</label>
                <input type="text" name="gstin" value="${escapeHtml(d.gstin || '')}" placeholder="e.g. 23AAAAA0000A1Z5">
              </div>
              <div class="form-field">
                <label>Drug License No.</label>
                <input type="text" name="drug_license_no" value="${escapeHtml(d.drug_license_no || '')}" placeholder="Form 20B/21B">
              </div>
              <div class="form-field">
                <label>Opening Balance (₹)</label>
                <input type="number" name="opening_balance" step="0.01" value="${d.opening_balance !== undefined ? d.opening_balance : 0}">
                <div class="form-hint">Positive = you owe this distributor, carried in from before this system was used.</div>
              </div>
              <div class="form-field span-2">
                <label>Address</label>
                <input type="text" name="address" value="${escapeHtml(d.address || '')}">
              </div>
              <div class="form-field">
                <label>City</label>
                <input type="text" name="city" value="${escapeHtml(d.city || '')}">
              </div>
              <div class="form-field">
                <label>State</label>
                <input type="text" name="state" value="${escapeHtml(d.state || '')}" placeholder="e.g. Madhya Pradesh">
                <div class="form-hint">Used to work out CGST+SGST vs IGST on purchases from this distributor.</div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Distributor'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('distModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'distModalOverlay') closeModal();
  });
  document.getElementById('distForm').addEventListener('submit', (e) => handleSubmit(e, id));
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}

async function handleSubmit(e, id) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  data.opening_balance = parseFloat(data.opening_balance) || 0;

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    if (id) {
      await api.put(`/api/distributors/${id}`, data);
      showToast('Distributor updated');
    } else {
      await api.post('/api/distributors', data);
      showToast('Distributor added');
    }
    closeModal();
    await loadDistributors();
  } catch (err) {
    showToast(err.message, true);
    submitBtn.disabled = false;
  }
}

async function handleDelete(id) {
  const d = distributorsCache.find(x => x.id === id);
  if (!d) return;
  if (!confirm(`Remove "${d.name}" from your distributor list?`)) return;

  try {
    await api.del(`/api/distributors/${id}`);
    showToast('Distributor removed');
    await loadDistributors();
  } catch (err) {
    showToast(err.message, true);
  }
}
