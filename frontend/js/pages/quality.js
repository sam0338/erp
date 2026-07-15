const QualityPage = {
  render: async () => {
    return `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="fas fa-magnifying-glass-chart me-2"></i>Incoming Quality Inspection</h2>
          <p class="text-muted">Goods received via GRN wait here until inspected. Only "Passed" quantity becomes usable stock.</p>
        </div>
      </div>

      <ul class="nav nav-tabs mb-3" id="qcTabs">
        <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#qcPendingTab">Pending Inspection</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#qcHoldTab">On Hold (Rework/CAPA)</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#qcHistoryTab">Inspection History</button></li>
      </ul>

      <div class="tab-content">
        <div class="tab-pane fade show active" id="qcPendingTab">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>GRN</th><th>PO</th><th>Vendor</th><th>Material</th>
                    <th>Received</th><th>Passed</th><th>Hold</th><th>Rejected</th><th>Remaining</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody id="qcPendingList"><tr><td colspan="11" class="text-center text-muted py-4">Loading...</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="tab-pane fade" id="qcHoldTab">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <p class="text-muted small">Material inspected and put on hold. Resolve each with a rework/CAPA outcome below.</p>
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr><th>Material</th><th>Warehouse</th><th>Quantity on Hold</th><th>Actions</th></tr>
                </thead>
                <tbody id="qcHoldList"><tr><td colspan="4" class="text-center text-muted py-4">Loading...</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="tab-pane fade" id="qcHistoryTab">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr><th>GRN</th><th>Material</th><th>Received</th><th>Passed</th><th>Hold</th><th>Rejected</th><th>Status</th><th>Inspected By</th><th>Date</th></tr>
                </thead>
                <tbody id="qcHistoryList"><tr><td colspan="9" class="text-center text-muted py-4">Loading...</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Record Result Modal -->
      <div class="modal fade" id="qcResultModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Record Inspection Result</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="qcResultForm" onsubmit="QCActions.submitResult(event)">
              <div class="modal-body">
                <input type="hidden" id="qcInspectionId">
                <p><strong>Material:</strong> <span id="qcResultMaterial"></span></p>
                <p><strong>Remaining to inspect:</strong> <span id="qcResultRemaining"></span></p>
                <div class="row">
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Pass</label>
                    <input type="number" class="form-control" id="qcQtyPassed" step="0.01" value="0" min="0">
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Hold</label>
                    <input type="number" class="form-control" id="qcQtyHold" step="0.01" value="0" min="0">
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Reject</label>
                    <input type="number" class="form-control" id="qcQtyRejected" step="0.01" value="0" min="0">
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Remarks</label>
                  <textarea class="form-control" id="qcRemarks" rows="2" placeholder="Inspection notes, defect description, etc."></textarea>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Result</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Release Hold Modal -->
      <div class="modal fade" id="qcReleaseModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Release Hold</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="qcReleaseForm" onsubmit="QCActions.submitRelease(event)">
              <div class="modal-body">
                <input type="hidden" id="qcReleaseMaterialId">
                <input type="hidden" id="qcReleaseWarehouseId">
                <p><strong>Material:</strong> <span id="qcReleaseMaterial"></span></p>
                <p><strong>Available on hold:</strong> <span id="qcReleaseAvailable"></span></p>
                <div class="mb-3">
                  <label class="form-label">Quantity to Release</label>
                  <input type="number" class="form-control" id="qcReleaseQty" step="0.01" min="0.01" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Disposition</label>
                  <select class="form-control" id="qcReleaseDisposition" required>
                    <option value="pass">Pass after rework (add to usable stock)</option>
                    <option value="reject">Reject / scrap (write off)</option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">Remarks</label>
                  <textarea class="form-control" id="qcReleaseRemarks" rows="2" placeholder="Rework/CAPA outcome notes"></textarea>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  init: async () => {
    await Promise.all([QCActions.loadPending(), QCActions.loadHold(), QCActions.loadHistory()]);
  }
};

const QCActions = {
  resultModal: null,
  releaseModal: null,
  pendingInspections: [],

  loadPending: async () => {
    const inspections = await API.getPendingInspections();
    if (!Array.isArray(inspections)) {
      document.getElementById('qcPendingList').innerHTML = '<tr><td colspan="11" class="text-center text-danger py-4">Could not load inspections.</td></tr>';
      return;
    }
    QCActions.pendingInspections = inspections;

    const html = inspections.length > 0
      ? inspections.map(i => {
          const remaining = i.quantity_received - i.quantity_passed - i.quantity_hold - i.quantity_rejected;
          return `
            <tr>
              <td>${i.grn_number}</td>
              <td>${i.po_number || '-'}</td>
              <td>${i.vendor_name || '-'}</td>
              <td>${i.material_name} <span class="text-muted small">(${i.unit_of_measure || ''})</span></td>
              <td>${i.quantity_received}</td>
              <td>${i.quantity_passed}</td>
              <td>${i.quantity_hold}</td>
              <td>${i.quantity_rejected}</td>
              <td><strong>${remaining}</strong></td>
              <td><span class="badge bg-${i.status === 'Partial' ? 'warning' : 'secondary'}">${i.status}</span></td>
              <td><button class="btn btn-sm btn-primary" onclick="QCActions.openResult(${i.id})">Inspect</button></td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="11" class="text-center text-muted py-4">Nothing waiting on inspection</td></tr>';

    document.getElementById('qcPendingList').innerHTML = html;
  },

  openResult: (inspectionId) => {
    const inspection = QCActions.pendingInspections.find(i => i.id === inspectionId);
    if (!inspection) return;
    const remaining = inspection.quantity_received - inspection.quantity_passed - inspection.quantity_hold - inspection.quantity_rejected;

    document.getElementById('qcResultForm').reset();
    document.getElementById('qcInspectionId').value = inspectionId;
    document.getElementById('qcResultMaterial').textContent = `${inspection.material_name} (GRN ${inspection.grn_number})`;
    document.getElementById('qcResultRemaining').textContent = `${remaining} ${inspection.unit_of_measure || ''}`;
    document.getElementById('qcQtyPassed').max = remaining;
    document.getElementById('qcQtyHold').max = remaining;
    document.getElementById('qcQtyRejected').max = remaining;

    QCActions.resultModal = new bootstrap.Modal(document.getElementById('qcResultModal'));
    QCActions.resultModal.show();
  },

  submitResult: async (event) => {
    event.preventDefault();
    const id = document.getElementById('qcInspectionId').value;
    const data = {
      quantity_passed: parseFloat(document.getElementById('qcQtyPassed').value) || 0,
      quantity_hold: parseFloat(document.getElementById('qcQtyHold').value) || 0,
      quantity_rejected: parseFloat(document.getElementById('qcQtyRejected').value) || 0,
      remarks: document.getElementById('qcRemarks').value
    };

    const result = await API.submitInspectionResult(id, data);
    if (result && !result.error) {
      QCActions.resultModal.hide();
      alert(result.message || 'Inspection result saved');
      await Promise.all([QCActions.loadPending(), QCActions.loadHold(), QCActions.loadHistory()]);
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  loadHold: async () => {
    const holds = await API.getQCHold();
    if (!Array.isArray(holds)) {
      document.getElementById('qcHoldList').innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">Could not load hold stock.</td></tr>';
      return;
    }

    const html = holds.length > 0
      ? holds.map(h => `
          <tr>
            <td>${h.material_name}</td>
            <td>${h.warehouse_name}</td>
            <td>${h.quantity} ${h.unit_of_measure || ''}</td>
            <td><button class="btn btn-sm btn-outline-primary" onclick="QCActions.openRelease(${h.material_id}, ${h.warehouse_id}, '${(h.material_name || '').replace(/'/g, "\\'")}', ${h.quantity})">Release</button></td>
          </tr>
        `).join('')
      : '<tr><td colspan="4" class="text-center text-muted py-4">Nothing on hold</td></tr>';

    document.getElementById('qcHoldList').innerHTML = html;
  },

  openRelease: (materialId, warehouseId, materialName, availableQty) => {
    document.getElementById('qcReleaseForm').reset();
    document.getElementById('qcReleaseMaterialId').value = materialId;
    document.getElementById('qcReleaseWarehouseId').value = warehouseId;
    document.getElementById('qcReleaseMaterial').textContent = materialName;
    document.getElementById('qcReleaseAvailable').textContent = availableQty;
    document.getElementById('qcReleaseQty').max = availableQty;

    QCActions.releaseModal = new bootstrap.Modal(document.getElementById('qcReleaseModal'));
    QCActions.releaseModal.show();
  },

  submitRelease: async (event) => {
    event.preventDefault();
    const materialId = document.getElementById('qcReleaseMaterialId').value;
    const warehouseId = document.getElementById('qcReleaseWarehouseId').value;
    const data = {
      quantity: parseFloat(document.getElementById('qcReleaseQty').value),
      disposition: document.getElementById('qcReleaseDisposition').value,
      remarks: document.getElementById('qcReleaseRemarks').value
    };

    const result = await API.releaseHold(materialId, warehouseId, data);
    if (result && !result.error) {
      QCActions.releaseModal.hide();
      alert(result.message || 'Hold released');
      await Promise.all([QCActions.loadHold(), QCActions.loadHistory()]);
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  loadHistory: async () => {
    const history = await API.getInspectionHistory();
    if (!Array.isArray(history)) {
      document.getElementById('qcHistoryList').innerHTML = '<tr><td colspan="9" class="text-center text-danger py-4">Could not load history.</td></tr>';
      return;
    }

    const html = history.length > 0
      ? history.map(i => `
          <tr>
            <td>${i.grn_number}</td>
            <td>${i.material_name}</td>
            <td>${i.quantity_received}</td>
            <td>${i.quantity_passed}</td>
            <td>${i.quantity_hold}</td>
            <td>${i.quantity_rejected}</td>
            <td><span class="badge bg-${i.status === 'Completed' ? 'success' : i.status === 'Partial' ? 'warning' : 'secondary'}">${i.status}</span></td>
            <td>${i.inspected_by_name || '-'}</td>
            <td>${i.inspection_date ? new Date(i.inspection_date).toLocaleDateString('en-IN') : '-'}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="9" class="text-center text-muted py-4">No inspections recorded yet</td></tr>';

    document.getElementById('qcHistoryList').innerHTML = html;
  }
};
