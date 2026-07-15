const MaterialsPage = {
  render: async () => {
    return `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="fas fa-boxes me-2"></i>Materials</h2>
        </div>
        <div class="col-md-4 text-end">
          <button class="btn btn-outline-success" onclick="MaterialModal.exportCSV()">
            <i class="fas fa-file-csv me-2"></i>Export
          </button>
          <button class="btn btn-primary" onclick="MaterialModal.show()">
            <i class="fas fa-plus me-2"></i>Add Material
          </button>
        </div>
      </div>

      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-hover mb-0" id="materialsTable">
              <thead class="table-light">
                <tr>
                  <th>Material Code</th>
                  <th>Material Name</th>
                  <th>Item Type</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>HSN Code</th>
                  <th>GST Rate</th>
                  <th>Reorder Level</th>
                  <th>QC</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="materialsList">
                <tr><td colspan="10" class="text-center text-muted py-4">Loading materials...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Material Modal -->
      <div class="modal fade" id="materialModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Add Material</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="materialForm" onsubmit="MaterialModal.submit(event)">
              <div class="modal-body">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Material Code</label>
                    <input type="text" class="form-control" id="materialCode" disabled placeholder="Auto-generated on save">
                    <div class="form-text">Assigned automatically — can't be edited.</div>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Material Name *</label>
                    <input type="text" class="form-control" id="materialName" required>
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Item Type *</label>
                    <select class="form-control" id="itemType">
                      <option value="Raw Material">Raw Material</option>
                      <option value="Semi-Finished">Semi-Finished</option>
                      <option value="Finished Good">Finished Good</option>
                      <option value="Consumable">Consumable</option>
                      <option value="By-Product">By-Product</option>
                    </select>
                    <div class="form-text">Finished/Semi-Finished/By-Product items can be linked as a BOM's output so Production Receipt can post real stock.</div>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Category</label>
                    <select class="form-control" id="materialCategory">
                      <option value="">Select Category</option>
                    </select>
                    <div class="form-text">From <a href="#" onclick="navigateTo('master-data')">Master Data → Item Groups</a></div>
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Material Grade</label>
                    <select class="form-control" id="materialGrade">
                      <option value="">Select Grade</option>
                    </select>
                    <div class="form-text">From <a href="#" onclick="navigateTo('master-data')">Master Data → Grades</a></div>
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Unit of Measure</label>
                    <select class="form-control" id="unitOfMeasure">
                      <option value="">Select UOM</option>
                    </select>
                    <div class="form-text">From <a href="#" onclick="navigateTo('master-data')">Master Data → UOM</a></div>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Description</label>
                  <textarea class="form-control" id="materialDescription" rows="2"></textarea>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">HSN Code</label>
                    <input type="text" class="form-control" id="hsnCode">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">GST Rate (%)</label>
                    <select class="form-control" id="gstRate">
                      <option>5</option>
                      <option>12</option>
                      <option selected>18</option>
                      <option>28</option>
                    </select>
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Barcode</label>
                    <input type="text" class="form-control" id="materialBarcode" placeholder="Scan or type — used by POS counter billing">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Default Sale Price</label>
                    <input type="number" class="form-control" id="defaultSalePrice" step="0.01" value="0" placeholder="Pre-fills at the POS counter">
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Reorder Level (Min)</label>
                    <input type="number" class="form-control" id="reorderLevel" step="0.01" value="0">
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Reorder Quantity</label>
                    <input type="number" class="form-control" id="reorderQuantity" step="0.01" value="0">
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Max Stock Level</label>
                    <input type="number" class="form-control" id="maxStockLevel" step="0.01" placeholder="Optional">
                  </div>
                </div>

                <div class="mb-3 form-check">
                  <input type="checkbox" class="form-check-input" id="qcRequired" checked>
                  <label class="form-check-label" for="qcRequired">Requires Quality Inspection on receipt</label>
                  <div class="form-text">If unchecked, stock received against this material skips QC and goes straight into usable stock.</div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Material</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  init: async () => {
    await MaterialModal.loadMaterials();
  }
};

const MaterialModal = {
  modal: null,
  editingId: null,

  exportCSV: () => {
    exportToCSV('materials', [
      { key: 'material_code', label: 'Material Code' },
      { key: 'material_name', label: 'Material Name' },
      { key: 'item_type', label: 'Item Type' },
      { key: 'category', label: 'Category' },
      { key: 'material_grade', label: 'Grade' },
      { key: 'unit_of_measure', label: 'Unit' },
      { key: 'hsn_code', label: 'HSN Code' },
      { key: 'gst_rate', label: 'GST Rate' },
      { key: 'barcode', label: 'Barcode' },
      { key: 'default_sale_price', label: 'Default Sale Price' },
      { key: 'reorder_level', label: 'Reorder Level' },
      { key: 'reorder_quantity', label: 'Reorder Quantity' }
    ], Object.values(MaterialModal._cache || {}));
  },

  show: async () => {
    MaterialModal.editingId = null;
    MaterialModal.modal = new bootstrap.Modal(document.getElementById('materialModal'));
    document.getElementById('materialForm').reset();
    document.getElementById('materialCode').value = '';
    document.querySelector('#materialModal .modal-title').textContent = 'Add Material';
    await MaterialModal.loadDropdowns();
    MaterialModal.modal.show();
  },

  loadDropdowns: async () => {
    const [groups, grades, uoms] = await Promise.all([
      API.getSimpleMasters('item_group'),
      API.getSimpleMasters('grade'),
      API.getSimpleMasters('uom')
    ]);
    const fill = (elId, rows) => {
      const el = document.getElementById(elId);
      if (!el || !Array.isArray(rows)) return;
      const current = el.value;
      el.innerHTML = el.querySelector('option[value=""]').outerHTML + rows.map(r => `<option value="${r.name}">${r.name} (${r.code})</option>`).join('');
      el.value = current;
    };
    fill('materialCategory', groups);
    fill('materialGrade', grades);
    fill('unitOfMeasure', uoms);
  },

  submit: async (event) => {
    event.preventDefault();
    const data = {
      material_name: document.getElementById('materialName').value,
      item_type: document.getElementById('itemType').value,
      category: document.getElementById('materialCategory').value,
      material_grade: document.getElementById('materialGrade').value,
      unit_of_measure: document.getElementById('unitOfMeasure').value,
      description: document.getElementById('materialDescription').value,
      hsn_code: document.getElementById('hsnCode').value,
      barcode: document.getElementById('materialBarcode').value,
      default_sale_price: parseFloat(document.getElementById('defaultSalePrice').value) || 0,
      gst_rate: parseFloat(document.getElementById('gstRate').value),
      reorder_level: parseFloat(document.getElementById('reorderLevel').value),
      reorder_quantity: parseFloat(document.getElementById('reorderQuantity').value),
      max_stock_level: document.getElementById('maxStockLevel').value ? parseFloat(document.getElementById('maxStockLevel').value) : null,
      qc_required: document.getElementById('qcRequired').checked
    };

    const result = MaterialModal.editingId
      ? await API.updateMaterial(MaterialModal.editingId, data)
      : await API.createMaterial(data);
    if (!result || result.error) {
      alert('Error: ' + (result?.error || 'Failed to save material'));
      return;
    }
    MaterialModal.modal.hide();
    await MaterialModal.loadMaterials();
    alert(result.message || 'Material saved successfully');
  },

  loadMaterials: async () => {
    const materials = await API.getMaterials() || [];
    MaterialModal._cache = {};
    materials.forEach(m => { MaterialModal._cache[m.id] = m; });
    const html = materials.length > 0
      ? materials.map(m => `
          <tr>
            <td><strong>${m.material_code}</strong></td>
            <td>${m.material_name}</td>
            <td><span class="badge bg-${m.item_type === 'Raw Material' || !m.item_type ? 'light text-dark' : 'primary'}">${m.item_type || 'Raw Material'}</span></td>
            <td>${m.category || '-'}</td>
            <td>${m.unit_of_measure}</td>
            <td>${m.hsn_code || '-'}</td>
            <td>${m.gst_rate}%</td>
            <td>${m.reorder_level}</td>
            <td>${m.qc_required ? '<span class="badge bg-warning text-dark">Required</span>' : '<span class="badge bg-secondary">Skip</span>'}</td>
            <td><span class="badge bg-success">Active</span></td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="MaterialModal.edit(${m.id})">Edit</button>
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="11" class="text-center text-muted">No materials found</td></tr>';

    document.getElementById('materialsList').innerHTML = html;
  },

  edit: async (materialId) => {
    const m = MaterialModal._cache && MaterialModal._cache[materialId] ? MaterialModal._cache[materialId] : await API.getMaterial(materialId);
    if (!m || m.error) { alert('Could not load this material'); return; }
    MaterialModal.editingId = materialId;
    MaterialModal.modal = new bootstrap.Modal(document.getElementById('materialModal'));
    document.getElementById('materialForm').reset();
    await MaterialModal.loadDropdowns();
    document.querySelector('#materialModal .modal-title').textContent = `Edit Material — ${m.material_code}`;
    document.getElementById('materialCode').value = m.material_code;
    document.getElementById('materialName').value = m.material_name;
    document.getElementById('itemType').value = m.item_type || 'Raw Material';
    document.getElementById('materialCategory').value = m.category || '';
    document.getElementById('materialGrade').value = m.material_grade || '';
    document.getElementById('unitOfMeasure').value = m.unit_of_measure || '';
    document.getElementById('materialDescription').value = m.description || '';
    document.getElementById('hsnCode').value = m.hsn_code || '';
    document.getElementById('gstRate').value = m.gst_rate || 18;
    document.getElementById('materialBarcode').value = m.barcode || '';
    document.getElementById('defaultSalePrice').value = m.default_sale_price || 0;
    document.getElementById('reorderLevel').value = m.reorder_level || 0;
    document.getElementById('reorderQuantity').value = m.reorder_quantity || 0;
    document.getElementById('maxStockLevel').value = m.max_stock_level || '';
    document.getElementById('qcRequired').checked = !!m.qc_required;
    MaterialModal.modal.show();
  }
};
