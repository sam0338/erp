const RequisitionEmployeePage = {
  render: async () => {
    return `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="fas fa-dolly me-2"></i>Store Requisition</h2>
          <p class="text-muted">Ask the store for material already in stock — one requisition can cover several items.</p>
        </div>
        <div class="col-md-4 text-end">
          <button class="btn btn-primary" onclick="RequisitionModal.show()">
            <i class="fas fa-plus me-2"></i>New Requisition
          </button>
        </div>
      </div>

      <ul class="nav nav-tabs mb-3" id="requisitionTabs">
        <li class="nav-item"><button class="nav-link active" id="reqDraftTab" data-bs-toggle="tab" data-bs-target="#reqDraft">Draft (0)</button></li>
        <li class="nav-item"><button class="nav-link" id="reqOpenTab" data-bs-toggle="tab" data-bs-target="#reqOpen">With Store (0)</button></li>
        <li class="nav-item"><button class="nav-link" id="reqDoneTab" data-bs-toggle="tab" data-bs-target="#reqDone">Completed (0)</button></li>
      </ul>

      <div class="tab-content">
        <div class="tab-pane fade show active" id="reqDraft">
          <div class="card border-0 shadow-sm"><div class="card-body">
            <table class="table table-hover mb-0">
              <thead class="table-light"><tr><th>Requisition No.</th><th>Items</th><th>Area of Use</th><th>Priority</th><th>Actions</th></tr></thead>
              <tbody id="reqDraftBody"><tr><td colspan="5" class="text-center text-muted py-4">No draft requisitions</td></tr></tbody>
            </table>
          </div></div>
        </div>

        <div class="tab-pane fade" id="reqOpen">
          <div class="card border-0 shadow-sm"><div class="card-body">
            <table class="table table-hover mb-0">
              <thead class="table-light"><tr><th>Requisition No.</th><th>Items</th><th>Area of Use</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead>
              <tbody id="reqOpenBody"><tr><td colspan="6" class="text-center text-muted py-4">Nothing with the store right now</td></tr></tbody>
            </table>
          </div></div>
        </div>

        <div class="tab-pane fade" id="reqDone">
          <div class="card border-0 shadow-sm"><div class="card-body">
            <table class="table table-hover mb-0">
              <thead class="table-light"><tr><th>Requisition No.</th><th>Items</th><th>Area of Use</th><th>Reviewed By</th><th>Actions</th></tr></thead>
              <tbody id="reqDoneBody"><tr><td colspan="5" class="text-center text-muted py-4">No completed requisitions yet</td></tr></tbody>
            </table>
          </div></div>
        </div>
      </div>

      <!-- Requisition Modal -->
      <div class="modal fade" id="requisitionModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="requisitionModalTitle">Raise Store Requisition</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="requisitionForm" onsubmit="RequisitionModal.submit(event)">
              <div class="modal-body">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Area of Use *</label>
                    <input type="text" class="form-control" id="reqArea" placeholder="e.g., Assembly Line, Packing" required>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Priority *</label>
                    <select class="form-control" id="reqPriority" required>
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Notes</label>
                  <textarea class="form-control" id="reqNotes" rows="2" placeholder="Anything the store should know"></textarea>
                </div>

                <hr>
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <label class="form-label mb-0">Items *</label>
                  <button type="button" class="btn btn-sm btn-outline-primary" onclick="RequisitionModal.addItem()"><i class="fas fa-plus me-1"></i>Add Item</button>
                </div>
                <div id="reqItemsContainer"></div>

                <div class="alert alert-info small mt-2">
                  <i class="fas fa-info-circle me-2"></i>
                  Current stock is shown next to each item as you pick it. This goes straight to the store to check physically — if something's short, they'll raise an indent for just the shortfall.
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-outline-primary" onclick="RequisitionModal.saveDraft()">Save as Draft</button>
                <button type="submit" class="btn btn-primary" id="reqSubmitBtn">Submit to Store</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  init: async () => {
    await RequisitionModal.loadMaterials();
    await RequisitionModal.loadMyRequisitions();
  }
};

const RequisitionModal = {
  modal: null,
  materials: [],
  itemCount: 0,
  editingRequisitionId: null,

  show: () => {
    RequisitionModal.editingRequisitionId = null;
    document.getElementById('requisitionModalTitle').textContent = 'Raise Store Requisition';
    document.getElementById('reqSubmitBtn').textContent = 'Submit to Store';
    document.getElementById('requisitionForm').reset();
    document.getElementById('reqItemsContainer').innerHTML = '';
    RequisitionModal.itemCount = 0;
    RequisitionModal.addItem();
    RequisitionModal.modal = new bootstrap.Modal(document.getElementById('requisitionModal'));
    RequisitionModal.modal.show();
  },

  loadMaterials: async () => {
    const materials = await API.getMaterialsLookup();
    RequisitionModal.materials = Array.isArray(materials) ? materials : [];
  },

  materialOptions: (selectedId) => {
    return '<option value="">Select Material</option>' + RequisitionModal.materials.map(m =>
      `<option value="${m.id}" data-uom="${m.unit_of_measure}" ${selectedId && parseInt(selectedId) === parseInt(m.id) ? 'selected' : ''}>${m.material_name} (${m.material_code})</option>`
    ).join('');
  },

  // insertAdjacentHTML, not `innerHTML +=` — appending with += would
  // re-serialize and re-parse every row already on screen, silently
  // wiping out whatever material/qty had already been picked in them.
  addItem: (itemData = null) => {
    RequisitionModal.itemCount++;
    const n = RequisitionModal.itemCount;
    const rowHtml = `
      <div class="row align-items-end mb-2 req-item" id="reqItem${n}">
        <div class="col-md-5">
          <label class="form-label small">Material</label>
          <select class="form-control material-select" data-item="${n}" onchange="RequisitionModal.onItemMaterialChange(${n})" required>
            ${RequisitionModal.materialOptions(itemData ? itemData.material_id : null)}
          </select>
        </div>
        <div class="col-md-2">
          <label class="form-label small">Quantity Needed</label>
          <input type="number" class="form-control qty-input" data-item="${n}" step="0.01" min="0.01" value="${itemData ? itemData.quantity_requested : ''}" required>
        </div>
        <div class="col-md-2">
          <label class="form-label small">Unit</label>
          <input type="text" class="form-control unit-input" data-item="${n}" value="${itemData ? (itemData.unit_of_measure || '') : ''}" readonly>
        </div>
        <div class="col-md-2">
          <label class="form-label small">Current Stock</label>
          <div class="form-control-plaintext fw-bold available-qty" data-item="${n}">-</div>
        </div>
        <div class="col-md-1">
          <button type="button" class="btn btn-sm btn-outline-danger" onclick="RequisitionModal.removeItem(${n})"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `;
    document.getElementById('reqItemsContainer').insertAdjacentHTML('beforeend', rowHtml);
    if (itemData) RequisitionModal.refreshAvailability(n, itemData.material_id);
  },

  removeItem: (n) => {
    const row = document.getElementById(`reqItem${n}`);
    if (row) row.remove();
    if (!document.querySelectorAll('.req-item').length) RequisitionModal.addItem();
  },

  onItemMaterialChange: (n) => {
    const select = document.querySelector(`.material-select[data-item="${n}"]`);
    const option = select.options[select.selectedIndex];
    const uom = option ? (option.dataset.uom || '') : '';
    document.querySelector(`.unit-input[data-item="${n}"]`).value = uom;
    RequisitionModal.refreshAvailability(n, select.value);
  },

  // This is the "current available stock shown next to the item" the
  // requester needs to see while building the request — same live lookup
  // the store itself will check against.
  refreshAvailability: async (n, materialId) => {
    const el = document.querySelector(`.available-qty[data-item="${n}"]`);
    if (!materialId || !el) return;
    el.textContent = '...';
    const inv = await API.getRequisitionMaterialAvailability(materialId);
    if (inv && !inv.error) {
      const qty = parseFloat(inv.quantity_available) || 0;
      el.innerHTML = `<span class="badge bg-${qty > 0 ? 'success' : 'secondary'}">${qty}</span>`;
    }
  },

  collectItems: () => {
    const items = [];
    document.querySelectorAll('.req-item').forEach(row => {
      const materialId = row.querySelector('.material-select').value;
      const qty = row.querySelector('.qty-input').value;
      if (!materialId || !qty) return;
      items.push({
        material_id: parseInt(materialId),
        quantity_requested: parseFloat(qty),
        unit_of_measure: row.querySelector('.unit-input').value
      });
    });
    return items;
  },

  collectHeader: () => ({
    area_of_use: document.getElementById('reqArea').value,
    priority: document.getElementById('reqPriority').value,
    notes: document.getElementById('reqNotes').value
  }),

  loadMyRequisitions: async () => {
    const requisitions = await API.getMyRequisitions();
    if (!Array.isArray(requisitions)) {
      console.error('Failed to load requisitions:', requisitions);
      document.getElementById('reqDraftBody').innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Could not load requisitions. Please try logging in again.</td></tr>';
      return;
    }

    const draft = requisitions.filter(r => r.status === 'Draft');
    const open = requisitions.filter(r => ['Submitted', 'Processing'].includes(r.status));
    const done = requisitions.filter(r => r.status === 'Completed');

    const itemsLabel = (r) => `${r.item_count} item${r.item_count === 1 ? '' : 's'}<div class="text-muted small">${r.item_summary || ''}</div>`;

    document.getElementById('reqDraftBody').innerHTML = draft.length ? draft.map(r => `
      <tr>
        <td><strong>${r.requisition_number}</strong></td>
        <td>${itemsLabel(r)}</td>
        <td>${r.area_of_use}</td>
        <td><span class="badge bg-secondary">${r.priority}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-primary" onclick="RequisitionModal.edit(${r.id})">Edit</button>
          <button class="btn btn-sm btn-outline-success" onclick="RequisitionModal.submitDraft(${r.id})">Submit</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="text-center text-muted">No draft requisitions</td></tr>';

    document.getElementById('reqOpenBody').innerHTML = open.length ? open.map(r => `
      <tr>
        <td><strong>${r.requisition_number}</strong></td>
        <td>${itemsLabel(r)}</td>
        <td>${r.area_of_use}</td>
        <td><span class="badge bg-${r.status === 'Processing' ? 'warning' : 'info'}">${r.status}</span></td>
        <td>${new Date(r.created_at).toLocaleDateString('en-IN')}</td>
        <td><button class="btn btn-sm btn-outline-info" onclick="RequisitionModal.viewDetails(${r.id})">View</button></td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="text-center text-muted">Nothing with the store right now</td></tr>';

    document.getElementById('reqDoneBody').innerHTML = done.length ? done.map(r => `
      <tr>
        <td><strong>${r.requisition_number}</strong></td>
        <td>${itemsLabel(r)}</td>
        <td>${r.area_of_use}</td>
        <td>${r.reviewed_by_name || '-'}</td>
        <td><button class="btn btn-sm btn-outline-info" onclick="RequisitionModal.viewDetails(${r.id})">View</button></td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="text-center text-muted">No completed requisitions yet</td></tr>';

    document.getElementById('reqDraftTab').textContent = `Draft (${draft.length})`;
    document.getElementById('reqOpenTab').textContent = `With Store (${open.length})`;
    document.getElementById('reqDoneTab').textContent = `Completed (${done.length})`;
  },

  edit: async (requisitionId) => {
    const requisition = await API.getRequisition(requisitionId);
    if (!requisition || requisition.error) { alert('Error: ' + ((requisition && requisition.error) || 'Could not load this requisition')); return; }
    if (requisition.status !== 'Draft') { alert('Only Draft requisitions can be edited.'); return; }

    RequisitionModal.editingRequisitionId = requisitionId;
    document.getElementById('requisitionModalTitle').textContent = `Edit Requisition ${requisition.requisition_number}`;
    document.getElementById('reqSubmitBtn').textContent = 'Save & Submit to Store';
    document.getElementById('reqArea').value = requisition.area_of_use || '';
    document.getElementById('reqPriority').value = requisition.priority || 'Normal';
    document.getElementById('reqNotes').value = requisition.notes || '';

    document.getElementById('reqItemsContainer').innerHTML = '';
    RequisitionModal.itemCount = 0;
    (requisition.items || []).forEach(it => RequisitionModal.addItem(it));
    if (!(requisition.items || []).length) RequisitionModal.addItem();

    RequisitionModal.modal = new bootstrap.Modal(document.getElementById('requisitionModal'));
    RequisitionModal.modal.show();
  },

  submitDraft: async (requisitionId) => {
    const result = await API.submitRequisition(requisitionId);
    if (result && !result.error) {
      alert(result.message || 'Requisition submitted to the store');
      await RequisitionModal.loadMyRequisitions();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  saveOrUpdate: async () => {
    const items = RequisitionModal.collectItems();
    if (!items.length) { alert('Add at least one item with a material and quantity'); return null; }
    const data = { ...RequisitionModal.collectHeader(), items };

    if (RequisitionModal.editingRequisitionId) {
      const result = await API.updateRequisition(RequisitionModal.editingRequisitionId, data);
      if (result && !result.error) return { id: RequisitionModal.editingRequisitionId };
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
      return null;
    } else {
      const result = await API.raiseRequisition(data);
      if (result && !result.error) return { id: result.id };
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
      return null;
    }
  },

  submit: async (event) => {
    event.preventDefault();
    const saved = await RequisitionModal.saveOrUpdate();
    if (!saved) return;
    const submitResult = await API.submitRequisition(saved.id);
    RequisitionModal.modal.hide();
    if (submitResult && submitResult.error) {
      alert('Requisition saved, but could not be submitted: ' + submitResult.error);
    } else {
      alert(RequisitionModal.editingRequisitionId ? 'Requisition updated and submitted to the store' : 'Requisition created and submitted to the store');
    }
    await RequisitionModal.loadMyRequisitions();
  },

  saveDraft: async () => {
    const saved = await RequisitionModal.saveOrUpdate();
    if (!saved) return;
    RequisitionModal.modal.hide();
    alert('Requisition saved as draft');
    await RequisitionModal.loadMyRequisitions();
  },

  viewDetails: async (requisitionId) => {
    const requisition = await API.getRequisition(requisitionId);
    if (!requisition || requisition.error) { alert('Error: ' + ((requisition && requisition.error) || 'Could not load this requisition')); return; }
    const itemLines = (requisition.items || []).map(it =>
      `  • ${it.material_name} — needed ${it.quantity_requested}, issued ${it.quantity_issued} [${it.status}]`
    ).join('\n');
    alert(`Requisition: ${requisition.requisition_number}\nStatus: ${requisition.status}\nArea: ${requisition.area_of_use}\n\nItems:\n${itemLines}`);
  }
};
