// VEDA Pharmacy - Categories
let currentUser = null;
let categoriesCache = [];

(async function init() {
  currentUser = await initShell({ activeView: 'categories' });
  if (!currentUser) return;

  document.getElementById('addCategoryBtn').addEventListener('click', () => openModal(null));
  document.getElementById('includeInactive').addEventListener('change', loadCategories);

  await loadCategories();
})();

async function loadCategories() {
  const grid = document.getElementById('categoryGrid');
  const includeInactive = document.getElementById('includeInactive').checked;
  try {
    categoriesCache = await api.get('/api/categories' + (includeInactive ? '?include_inactive=1' : ''));
    renderGrid(categoriesCache);
  } catch (e) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`;
  }
}

function renderGrid(categories) {
  const grid = document.getElementById('categoryGrid');
  const emptyState = document.getElementById('categoriesEmpty');
  if (categories.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  grid.innerHTML = categories.map(c => `
    <div class="card" style="padding:20px;${c.is_active ? '' : 'opacity:0.55;'}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-size:28px;">${escapeHtml(c.icon || '🏷️')}</div>
        <div class="row-actions">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="openModal(${c.id})" title="Edit">✏️</button>
          ${c.is_active ? `<button class="btn btn-danger btn-sm btn-icon" onclick="handleDelete(${c.id})" title="Delete">🗑️</button>` : ''}
        </div>
      </div>
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">
        ${escapeHtml(c.name)}${c.is_active ? '' : ' <span class="badge badge-slate">Inactive</span>'}
      </div>
      <div style="color:var(--slate);font-size:12px;margin-bottom:12px;">${escapeHtml(c.description || 'No description')}</div>
      <div style="font-size:12px;color:var(--teal);font-weight:600;">${c.item_count} medicine${c.item_count === 1 ? '' : 's'}</div>
    </div>
  `).join('');
}

function openModal(id) {
  const c = id ? categoriesCache.find(x => x.id === id) || {} : {};
  const isEdit = !!id;

  const modalRoot = document.getElementById('modalRoot');
  modalRoot.innerHTML = `
    <div class="modal-overlay" id="catModalOverlay">
      <div class="modal">
        <div class="modal-header">
          <h3>${isEdit ? 'Edit Category' : 'Add Category'}</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="catForm">
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-field">
                <label>Icon (emoji)</label>
                <input type="text" name="icon" value="${escapeHtml(c.icon || '')}" placeholder="💊" maxlength="4">
              </div>
              <div class="form-field">
                <label>Category Name *</label>
                <input type="text" name="name" required value="${escapeHtml(c.name || '')}" placeholder="e.g. Antibiotic">
              </div>
              <div class="form-field span-2">
                <label>Description</label>
                <input type="text" name="description" value="${escapeHtml(c.description || '')}">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Category'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('catModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'catModalOverlay') closeModal();
  });
  document.getElementById('catForm').addEventListener('submit', (e) => handleSubmit(e, id));
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
      await api.put(`/api/categories/${id}`, data);
      showToast('Category updated');
    } else {
      await api.post('/api/categories', data);
      showToast('Category added');
    }
    closeModal();
    await loadCategories();
  } catch (err) {
    showToast(err.message, true);
    submitBtn.disabled = false;
  }
}

async function handleDelete(id) {
  const c = categoriesCache.find(x => x.id === id);
  if (!c) return;
  if (!confirm(`Remove "${c.name}" from the category list? Items already tagged with it are unaffected.`)) return;

  try {
    await api.del(`/api/categories/${id}`);
    showToast('Category removed');
    await loadCategories();
  } catch (err) {
    showToast(err.message, true);
  }
}
