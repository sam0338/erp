const IndentEmployeePage = {
  render: async () => {
    return `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="fas fa-file-alt me-2"></i>Raise Indent</h2>
          <p class="text-muted">Request material from store for procurement — one indent can cover several items.</p>
        </div>
        <div class="col-md-4 text-end">
          <button class="btn btn-primary" onclick="IndentModal.show()">
            <i class="fas fa-plus me-2"></i>New Indent
          </button>
        </div>
      </div>

      <div class="row">
        <div class="col-md-12">
          <ul class="nav nav-tabs mb-3" id="indentTabs">
            <li class="nav-item">
              <button class="nav-link active" id="draftTab" data-bs-toggle="tab" data-bs-target="#draft">
                <i class="fas fa-file-invoice me-1"></i>Draft (${0})
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link" id="pendingTab" data-bs-toggle="tab" data-bs-target="#pending">
                <i class="fas fa-clock me-1"></i>Pending Approval (${0})
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link" id="approvedTab" data-bs-toggle="tab" data-bs-target="#approved">
                <i class="fas fa-check me-1"></i>Approved (${0})
              </button>
            </li>
          </ul>

          <div class="tab-content">
            <!-- Draft Indents -->
            <div class="tab-pane fade show active" id="draft">
              <div class="card border-0 shadow-sm">
                <div class="card-body">
                  <table class="table table-hover mb-0" id="draftIndentsTable">
                    <thead class="table-light">
                      <tr>
                        <th>Indent No.</th>
                        <th>Items</th>
                        <th>Area of Use</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody id="draftIndents">
                      <tr><td colspan="6" class="text-center text-muted py-4">No draft indents</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Pending Indents -->
            <div class="tab-pane fade" id="pending">
              <div class="card border-0 shadow-sm">
                <div class="card-body">
                  <table class="table table-hover mb-0" id="pendingIndentsTable">
                    <thead class="table-light">
                      <tr>
                        <th>Indent No.</th>
                        <th>Items</th>
                        <th>Area of Use</th>
                        <th>Priority</th>
                        <th>Submitted On</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody id="pendingIndents">
                      <tr><td colspan="6" class="text-center text-muted py-4">No pending indents</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Approved Indents -->
            <div class="tab-pane fade" id="approved">
              <div class="card border-0 shadow-sm">
                <div class="card-body">
                  <table class="table table-hover mb-0" id="approvedIndentsTable">
                    <thead class="table-light">
                      <tr>
                        <th>Indent No.</th>
                        <th>Items</th>
                        <th>Area of Use</th>
                        <th>Approved By</th>
                        <th>Approved On</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody id="approvedIndents">
                      <tr><td colspan="6" class="text-center text-muted py-4">No approved indents</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Indent Modal -->
      <div class="modal fade" id="indentModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="indentModalTitle">Raise Material Indent</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="indentForm" onsubmit="IndentModal.submit(event)">
              <div class="modal-body">
                <div class="row">
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Area of Use *</label>
                    <input type="text" class="form-control" id="indentArea" placeholder="e.g., Production Floor, Assembly" required>
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Priority *</label>
                    <select class="form-control" id="indentPriority" required>
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Required By Date</label>
                    <input type="date" class="form-control" id="indentRequiredDate">
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Justification *</label>
                  <textarea class="form-control" id="indentJustification" rows="2" placeholder="Why do you need this material?" required></textarea>
                </div>

                <hr>
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <label class="form-label mb-0">Items *</label>
                  <button type="button" class="btn btn-sm btn-outline-primary" onclick="IndentModal.addItem()"><i class="fas fa-plus me-1"></i>Add Item</button>
                </div>
                <div id="indentItemsContainer"></div>

                <div class="alert alert-info small mt-2">
                  <i class="fas fa-info-circle me-2"></i>
                  <strong>Note:</strong> One indent can cover several materials — add as many item rows as you need. Complete indents are submitted for the approver's review before procurement.
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-outline-primary" onclick="IndentModal.saveDraft()">Save as Draft</button>
                <button type="submit" class="btn btn-primary" id="indentSubmitBtn">Submit for Approval</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  init: async () => {
    await IndentModal.loadMaterials();
    await IndentModal.loadMyIndents();
  }
};

const IndentModal = {
  modal: null,
  materials: [],
  itemCount: 0,
  editingIndentId: null, // null = creating new; set = editing an existing Draft

  show: () => {
    IndentModal.editingIndentId = null;
    document.getElementById('indentModalTitle').textContent = 'Raise Material Indent';
    document.getElementById('indentSubmitBtn').textContent = 'Submit for Approval';
    document.getElementById('indentForm').reset();
    document.getElementById('indentItemsContainer').innerHTML = '';
    IndentModal.itemCount = 0;
    IndentModal.addItem();
    IndentModal.modal = new bootstrap.Modal(document.getElementById('indentModal'));
    IndentModal.modal.show();
  },

  loadMaterials: async () => {
    const materials = await API.getMaterials();
    IndentModal.materials = Array.isArray(materials) ? materials : [];
  },

  materialOptions: (selectedId) => {
    return '<option value="">Select Material</option>' + IndentModal.materials.map(m =>
      `<option value="${m.id}" data-uom="${m.unit_of_measure}" ${selectedId && parseInt(selectedId) === parseInt(m.id) ? 'selected' : ''}>${m.material_name} (${m.material_code})</option>`
    ).join('');
  },

  // Uses insertAdjacentHTML — NOT `innerHTML +=`, which would re-serialize
  // and re-parse every row already on screen, silently wiping out whatever
  // material/qty had already been picked in them the moment a new row was
  // added (the exact bug just fixed on the Purchase Order form).
  addItem: (itemData = null) => {
    IndentModal.itemCount++;
    const n = IndentModal.itemCount;
    const rowHtml = `
      <div class="row align-items-end mb-2 indent-item" id="indentItem${n}" data-item-id="${itemData ? itemData.id : ''}">
        <div class="col-md-4">
          <label class="form-label small">Material</label>
          <select class="form-control material-select" data-item="${n}" onchange="IndentModal.onItemMaterialChange(${n})" required>
            ${IndentModal.materialOptions(itemData ? itemData.material_id : null)}
          </select>
        </div>
        <div class="col-md-2">
          <label class="form-label small">Quantity</label>
          <input type="number" class="form-control qty-input" data-item="${n}" step="0.01" min="0.01" value="${itemData ? itemData.quantity_required : ''}" required>
        </div>
        <div class="col-md-2">
          <label class="form-label small">Unit</label>
          <input type="text" class="form-control unit-input" data-item="${n}" value="${itemData ? (itemData.unit_of_measure || '') : ''}" readonly>
        </div>
        <div class="col-md-2">
          <label class="form-label small">Type</label>
          <select class="form-control type-select" data-item="${n}" required>
            <option value="Raw Material" ${itemData && itemData.material_type === 'Raw Material' ? 'selected' : ''}>Raw Material</option>
            <option value="Component" ${itemData && itemData.material_type === 'Component' ? 'selected' : ''}>Component</option>
            <option value="Consumable" ${itemData && itemData.material_type === 'Consumable' ? 'selected' : ''}>Consumable</option>
            <option value="Tool" ${itemData && itemData.material_type === 'Tool' ? 'selected' : ''}>Tool</option>
            <option value="Spare Part" ${itemData && itemData.material_type === 'Spare Part' ? 'selected' : ''}>Spare Part</option>
          </select>
        </div>
        <div class="col-md-1">
          <label class="form-label small">Avail.</label>
          <div class="form-control-plaintext small text-muted available-qty" data-item="${n}">-</div>
        </div>
        <div class="col-md-1">
          <button type="button" class="btn btn-sm btn-outline-danger" onclick="IndentModal.removeItem(${n})"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `;
    document.getElementById('indentItemsContainer').insertAdjacentHTML('beforeend', rowHtml);
    if (itemData) IndentModal.refreshAvailability(n, itemData.material_id);
  },

  removeItem: (n) => {
    const row = document.getElementById(`indentItem${n}`);
    if (row) row.remove();
    if (!document.querySelectorAll('.indent-item').length) IndentModal.addItem();
  },

  onItemMaterialChange: (n) => {
    const select = document.querySelector(`.material-select[data-item="${n}"]`);
    const option = select.options[select.selectedIndex];
    const uom = option ? (option.dataset.uom || '') : '';
    document.querySelector(`.unit-input[data-item="${n}"]`).value = uom;
    IndentModal.refreshAvailability(n, select.value);
  },

  refreshAvailability: async (n, materialId) => {
    const el = document.querySelector(`.available-qty[data-item="${n}"]`);
    if (!materialId || !el) return;
    const inv = await API.getMaterialAvailability(materialId);
    if (inv && !inv.error) el.textContent = inv.quantity_available || 0;
  },

  collectItems: () => {
    const items = [];
    document.querySelectorAll('.indent-item').forEach(row => {
      const n = row.id.replace('indentItem', '');
      const materialId = row.querySelector('.material-select').value;
      const qty = row.querySelector('.qty-input').value;
      if (!materialId || !qty) return;
      items.push({
        material_id: parseInt(materialId),
        quantity_required: parseFloat(qty),
        unit_of_measure: row.querySelector('.unit-input').value,
        material_type: row.querySelector('.type-select').value
      });
    });
    return items;
  },

  collectHeader: () => ({
    area_of_use: document.getElementById('indentArea').value,
    priority: document.getElementById('indentPriority').value,
    required_by_date: document.getElementById('indentRequiredDate').value,
    justification: document.getElementById('indentJustification').value
  }),

  loadMyIndents: async () => {
    const indents = await API.getMyIndents();
    if (!Array.isArray(indents)) {
      console.error('Failed to load indents:', indents);
      document.getElementById('draftIndents').innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Could not load indents. Please try logging in again.</td></tr>';
      return;
    }

    const draftIndents = indents.filter(i => i.status === 'Draft');
    const pendingIndents = indents.filter(i => i.status === 'Pending');
    const approvedIndents = indents.filter(i => i.status === 'Approved');

    const itemsLabel = (i) => `${i.item_count} item${i.item_count === 1 ? '' : 's'}<div class="text-muted small">${i.item_summary || ''}</div>`;

    const draftHtml = draftIndents.length > 0
      ? draftIndents.map(i => `
          <tr>
            <td><strong>${i.indent_number}</strong></td>
            <td>${itemsLabel(i)}</td>
            <td>${i.area_of_use}</td>
            <td><span class="badge bg-secondary">${i.priority}</span></td>
            <td><span class="badge bg-warning">Draft</span></td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="IndentModal.edit(${i.id})">Edit</button>
              <button class="btn btn-sm btn-outline-success" onclick="IndentModal.submitDraft(${i.id})">Submit</button>
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="6" class="text-center text-muted">No draft indents</td></tr>';

    const pendingHtml = pendingIndents.length > 0
      ? pendingIndents.map(i => `
          <tr>
            <td><strong>${i.indent_number}</strong></td>
            <td>${itemsLabel(i)}</td>
            <td>${i.area_of_use}</td>
            <td><span class="badge bg-${i.priority === 'Urgent' ? 'danger' : i.priority === 'High' ? 'warning' : 'info'}">${i.priority}</span></td>
            <td>${new Date(i.created_at).toLocaleDateString('en-IN')}</td>
            <td>
              <button class="btn btn-sm btn-outline-info" onclick="IndentModal.viewDetails(${i.id})">View</button>
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="6" class="text-center text-muted">No pending indents</td></tr>';

    const approvedHtml = approvedIndents.length > 0
      ? approvedIndents.map(i => `
          <tr>
            <td><strong>${i.indent_number}</strong></td>
            <td>${itemsLabel(i)}</td>
            <td>${i.area_of_use}</td>
            <td>${i.approved_by_name || 'System'}</td>
            <td>${new Date(i.approval_date).toLocaleDateString('en-IN')}</td>
            <td><span class="badge bg-success">Approved</span></td>
          </tr>
        `).join('')
      : '<tr><td colspan="6" class="text-center text-muted">No approved indents</td></tr>';

    document.getElementById('draftIndents').innerHTML = draftHtml;
    document.getElementById('pendingIndents').innerHTML = pendingHtml;
    document.getElementById('approvedIndents').innerHTML = approvedHtml;

    document.getElementById('draftTab').innerHTML = `<i class="fas fa-file-invoice me-1"></i>Draft (${draftIndents.length})`;
    document.getElementById('pendingTab').innerHTML = `<i class="fas fa-clock me-1"></i>Pending Approval (${pendingIndents.length})`;
    document.getElementById('approvedTab').innerHTML = `<i class="fas fa-check me-1"></i>Approved (${approvedIndents.length})`;
  },

  // This is the fix for "Draft indents can't be edited" — the button
  // existed before but called a function that was never actually written.
  // Loads the indent's header + every item back into the same modal used
  // to create one, and switches submit to update it in place instead of
  // creating a new one.
  edit: async (indentId) => {
    const indent = await API.getIndent(indentId);
    if (!indent || indent.error) { alert('Error: ' + ((indent && indent.error) || 'Could not load this indent')); return; }
    if (indent.status !== 'Draft') { alert('Only Draft indents can be edited.'); return; }

    IndentModal.editingIndentId = indentId;
    document.getElementById('indentModalTitle').textContent = `Edit Indent ${indent.indent_number}`;
    document.getElementById('indentSubmitBtn').textContent = 'Save & Submit for Approval';
    document.getElementById('indentArea').value = indent.area_of_use || '';
    document.getElementById('indentPriority').value = indent.priority || 'Normal';
    document.getElementById('indentRequiredDate').value = indent.required_by_date ? indent.required_by_date.split('T')[0] : '';
    document.getElementById('indentJustification').value = indent.justification || '';

    document.getElementById('indentItemsContainer').innerHTML = '';
    IndentModal.itemCount = 0;
    (indent.items || []).forEach(it => IndentModal.addItem(it));
    if (!(indent.items || []).length) IndentModal.addItem();

    IndentModal.modal = new bootstrap.Modal(document.getElementById('indentModal'));
    IndentModal.modal.show();
  },

  submitDraft: async (indentId) => {
    const result = await API.submitIndent(indentId);
    if (result && !result.error) {
      alert(result.message || 'Indent submitted for approval');
      await IndentModal.loadMyIndents();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  // Shared by both "Save as Draft" and "Submit for Approval" — the only
  // difference is whether a submit call follows the save.
  saveOrUpdate: async () => {
    const items = IndentModal.collectItems();
    if (!items.length) { alert('Add at least one item with a material and quantity'); return null; }
    const data = { ...IndentModal.collectHeader(), items };

    if (IndentModal.editingIndentId) {
      const result = await API.updateIndent(IndentModal.editingIndentId, data);
      if (result && !result.error) return { id: IndentModal.editingIndentId };
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
      return null;
    } else {
      const result = await API.raiseIndent(data);
      if (result && !result.error) return { id: result.indent_id };
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
      return null;
    }
  },

  submit: async (event) => {
    event.preventDefault();
    const saved = await IndentModal.saveOrUpdate();
    if (!saved) return;
    const submitResult = await API.submitIndent(saved.id);
    IndentModal.modal.hide();
    if (submitResult && submitResult.error) {
      alert('Indent saved, but could not be submitted for approval: ' + submitResult.error);
    } else {
      alert(IndentModal.editingIndentId ? 'Indent updated and submitted for approval' : 'Indent created and submitted for approval');
    }
    await IndentModal.loadMyIndents();
  },

  saveDraft: async () => {
    const saved = await IndentModal.saveOrUpdate();
    if (!saved) return;
    IndentModal.modal.hide();
    alert('Indent saved as draft');
    await IndentModal.loadMyIndents();
  },

  viewDetails: async (indentId) => {
    const indent = await API.getIndent(indentId);
    if (!indent || indent.error) { alert('Error: ' + ((indent && indent.error) || 'Could not load this indent')); return; }
    const itemLines = (indent.items || []).map(it => `  • ${it.material_name} — ${it.quantity_required} ${it.unit_of_measure || ''}`).join('\n');
    alert(`Indent: ${indent.indent_number}\nStatus: ${indent.status}\nArea: ${indent.area_of_use}\nPriority: ${indent.priority}\n\nItems:\n${itemLines}`);
  }
};
