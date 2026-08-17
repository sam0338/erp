// VEDA Pharmacy - Item Master
let currentUser = null;
let itemsCache = [];
let categoriesCache = [];

const SCHEDULE_BADGE = { OTC: 'badge-schedule-OTC', H: 'badge-schedule-H', H1: 'badge-schedule-H1', X: 'badge-schedule-X' };
const SCHEDULE_LABEL = { OTC: 'OTC', H: 'Sch. H', H1: 'Sch. H1', X: 'Sch. X' };
const DRUG_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Cream', 'Powder', 'Inhaler', 'Other'];
const UNITS = ['Strip', 'Box', 'Bottle', 'Tube', 'Vial', 'Piece'];
const GST_RATES = [0, 5, 12, 18, 28];

(async function init() {
  currentUser = await initShell({ activeView: 'items' });
  if (!currentUser) return;

  document.getElementById('addItemBtn').addEventListener('click', () => openModal(null));
  document.getElementById('searchInput').addEventListener('input', debounce(loadItems, 250));
  document.getElementById('scheduleFilter').addEventListener('change', loadItems);
  document.getElementById('categoryFilter').addEventListener('change', loadItems);
  document.getElementById('includeInactive').addEventListener('change', loadItems);

  await loadCategories();
  await loadItems();
})();

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function loadCategories() {
  try {
    categoriesCache = await api.get('/api/items/categories');
    const select = document.getElementById('categoryFilter');
    const current = select.value;
    select.innerHTML = '<option value="">All Categories</option>' +
      categoriesCache.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    select.value = current;
  } catch (e) { /* non-fatal */ }
}

async function loadItems() {
  const tbody = document.getElementById('itemsTbody');
  const q = document.getElementById('searchInput').value.trim();
  const schedule = document.getElementById('scheduleFilter').value;
  const category = document.getElementById('categoryFilter').value;
  const includeInactive = document.getElementById('includeInactive').checked;

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (schedule) params.set('schedule', schedule);
  if (category) params.set('category', category);
  if (includeInactive) params.set('include_inactive', '1');

  try {
    itemsCache = await api.get('/api/items?' + params.toString());
    renderTable(itemsCache);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderTable(items) {
  const tbody = document.getElementById('itemsTbody');
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No items found. Try adjusting your search or filters, or add a new item.</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(item => {
    const lowStock = Number(item.total_stock) <= Number(item.reorder_level);
    const stockBadge = item.total_stock == 0
      ? '<span class="badge badge-danger">Out of stock</span>'
      : (lowStock ? `<span class="badge badge-warn">${item.total_stock} low</span>` : `<span class="badge badge-ok">${item.total_stock}</span>`);
    return `
      <tr${item.is_active ? '' : ' style="opacity:0.55;"'}>
        <td>
          <strong>${escapeHtml(item.name)}</strong>
          ${item.manufacturer ? `<div class="muted" style="font-size:11.5px;">${escapeHtml(item.manufacturer)}</div>` : ''}
          ${item.is_active ? '' : '<span class="badge badge-neutral" style="margin-top:4px;">Inactive</span>'}
        </td>
        <td>${escapeHtml(item.generic_name || '—')}</td>
        <td><span class="badge ${SCHEDULE_BADGE[item.schedule] || 'badge-neutral'}">${SCHEDULE_LABEL[item.schedule] || item.schedule}</span></td>
        <td class="mono">${escapeHtml(item.hsn_code || '—')}</td>
        <td>${item.gst_rate}%</td>
        <td>${escapeHtml(item.pack_size || '—')} <span class="muted">/ ${escapeHtml(item.unit)}</span></td>
        <td>${stockBadge}</td>
        <td>${escapeHtml(item.rack_location || '—')}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-outline btn-sm" onclick="openModal(${item.id})">Edit</button>
          ${item.is_active ? `<button class="btn btn-danger-outline btn-sm" onclick="handleDelete(${item.id})">Remove</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

function openModal(id) {
  const item = id ? itemsCache.find(i => i.id === id) || {} : {};
  const isEdit = !!id;

  const modalRoot = document.getElementById('modalRoot');
  modalRoot.innerHTML = `
    <div class="modal-overlay" id="itemModalOverlay">
      <div class="modal">
        <div class="modal-header">
          <h3>${isEdit ? 'Edit Item' : 'Add Item'}</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="itemForm">
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-field span-2">
                <label>Item Name *</label>
                <input type="text" name="name" required value="${escapeHtml(item.name || '')}" placeholder="e.g. Paracetamol 500mg">
              </div>
              <div class="form-field">
                <label>Generic Name</label>
                <input type="text" name="generic_name" value="${escapeHtml(item.generic_name || '')}" placeholder="e.g. Paracetamol">
              </div>
              <div class="form-field">
                <label>Manufacturer</label>
                <input type="text" name="manufacturer" value="${escapeHtml(item.manufacturer || '')}">
              </div>
              <div class="form-field">
                <label>HSN Code</label>
                <input type="text" name="hsn_code" value="${escapeHtml(item.hsn_code || '')}" placeholder="e.g. 3004">
              </div>
              <div class="form-field">
                <label>GST %</label>
                <input type="number" name="gst_rate" step="0.01" min="0" list="gstRates" value="${item.gst_rate !== undefined ? item.gst_rate : 12}">
                <datalist id="gstRates">${GST_RATES.map(r => `<option value="${r}">`).join('')}</datalist>
              </div>
              <div class="form-field">
                <label>Schedule *</label>
                <select name="schedule">
                  <option value="OTC" ${item.schedule === 'OTC' || !item.schedule ? 'selected' : ''}>OTC (no Rx required)</option>
                  <option value="H" ${item.schedule === 'H' ? 'selected' : ''}>Schedule H</option>
                  <option value="H1" ${item.schedule === 'H1' ? 'selected' : ''}>Schedule H1 (Rx + register)</option>
                  <option value="X" ${item.schedule === 'X' ? 'selected' : ''}>Schedule X (Rx + register)</option>
                </select>
                <div class="form-hint">H1/X items will require a prescription at time of sale.</div>
              </div>
              <div class="form-field">
                <label>Drug Form</label>
                <input type="text" name="drug_form" list="drugForms" value="${escapeHtml(item.drug_form || '')}">
                <datalist id="drugForms">${DRUG_FORMS.map(f => `<option value="${f}">`).join('')}</datalist>
              </div>
              <div class="form-field">
                <label>Pack Size</label>
                <input type="text" name="pack_size" value="${escapeHtml(item.pack_size || '')}" placeholder="e.g. 1x10, 100ml">
              </div>
              <div class="form-field">
                <label>Unit</label>
                <select name="unit">
                  ${UNITS.map(u => `<option value="${u}" ${item.unit === u ? 'selected' : (!item.unit && u === 'Strip' ? 'selected' : '')}>${u}</option>`).join('')}
                </select>
              </div>
              <div class="form-field">
                <label>Category</label>
                <input type="text" name="category" list="categoryList" value="${escapeHtml(item.category || '')}" placeholder="e.g. Analgesic">
                <datalist id="categoryList">${categoriesCache.map(c => `<option value="${escapeHtml(c)}">`).join('')}</datalist>
              </div>
              <div class="form-field">
                <label>Rack Location</label>
                <input type="text" name="rack_location" value="${escapeHtml(item.rack_location || '')}" placeholder="e.g. A1-03">
              </div>
              <div class="form-field">
                <label>Reorder Level</label>
                <input type="number" name="reorder_level" min="0" value="${item.reorder_level !== undefined ? item.reorder_level : 0}">
                <div class="form-hint">Flagged low-stock when total stock across batches drops to this or below.</div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Item'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('itemModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'itemModalOverlay') closeModal();
  });
  document.getElementById('itemForm').addEventListener('submit', (e) => handleSubmit(e, id));
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}

async function handleSubmit(e, id) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  data.gst_rate = parseFloat(data.gst_rate);
  data.reorder_level = parseInt(data.reorder_level, 10) || 0;

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    if (id) {
      await api.put(`/api/items/${id}`, data);
      showToast('Item updated');
    } else {
      await api.post('/api/items', data);
      showToast('Item added');
    }
    closeModal();
    await loadCategories();
    await loadItems();
  } catch (err) {
    showToast(err.message, true);
    submitBtn.disabled = false;
  }
}

async function handleDelete(id) {
  const item = itemsCache.find(i => i.id === id);
  if (!item) return;
  if (!confirm(`Remove "${item.name}" from the item master? This can be undone by re-editing it later, but it will be hidden from normal use.`)) return;

  try {
    await api.del(`/api/items/${id}`);
    showToast('Item removed');
    await loadItems();
  } catch (err) {
    showToast(err.message, true);
  }
}
