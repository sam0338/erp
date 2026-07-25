const RequisitionStorePage = {
  render: async () => {
    return `
      <div class="row mb-4">
        <div class="col-md-12">
          <h2><i class="fas fa-warehouse me-2"></i>Store Requisition Review</h2>
          <p class="text-muted">Check physical stock against each request — issue what's on the shelf, send the rest to procurement.</p>
        </div>
      </div>

      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr><th>Requisition No.</th><th>Requested By</th><th>Items</th><th>Area of Use</th><th>Priority</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody id="reqReviewList"><tr><td colspan="7" class="text-center text-muted py-4">Loading requisitions...</td></tr></tbody>
          </table>
        </div>
      </div>

      <!-- Review Modal -->
      <div class="modal fade" id="reqReviewModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Review Requisition — <span id="reqReviewNo">-</span></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row mb-3">
                <div class="col-md-6"><strong>Requested by:</strong> <span id="reqReviewRequester">-</span></div>
                <div class="col-md-6"><strong>Area of use:</strong> <span id="reqReviewArea">-</span></div>
              </div>
              <div class="row mb-3">
                <div class="col-md-6">
                  <label class="form-label">Issue From Warehouse *</label>
                  <select class="form-control" id="reqReviewWarehouse"></select>
                </div>
              </div>

              <table class="table table-sm">
                <thead class="table-light">
                  <tr><th>Material</th><th>Requested</th><th>Already Issued</th><th>System Stock</th><th style="width:150px">Issue Now</th><th>Status</th></tr>
                </thead>
                <tbody id="reqReviewItemsBody"></tbody>
              </table>

              <div class="alert alert-warning small" id="reqReviewShortfallNote" style="display:none">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Some items still have an outstanding shortfall after issuing. Use "Convert Shortfall to Indent" below to send just that shortfall into procurement.
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              <button type="button" class="btn btn-warning" onclick="RequisitionReview.convertToIndent()"><i class="fas fa-arrow-right me-1"></i>Convert Shortfall to Indent</button>
              <button type="button" class="btn btn-success" onclick="RequisitionReview.issueSelected()"><i class="fas fa-check me-1"></i>Issue Now</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  init: async () => {
    await RequisitionReview.load();
  }
};

const RequisitionReview = {
  modal: null,
  currentRequisition: null,

  load: async () => {
    const requisitions = await API.getRequisitionsPendingReview();
    const body = document.getElementById('reqReviewList');
    if (!Array.isArray(requisitions)) {
      body.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">Could not load requisitions. Please try logging in again.</td></tr>';
      return;
    }
    body.innerHTML = requisitions.length ? requisitions.map(r => `
      <tr>
        <td><strong>${r.requisition_number}</strong></td>
        <td>${r.requested_by_name}</td>
        <td>${r.item_count} item${r.item_count === 1 ? '' : 's'}<div class="text-muted small">${r.item_summary || ''}</div></td>
        <td>${r.area_of_use}</td>
        <td><span class="badge bg-${r.priority === 'Urgent' ? 'danger' : r.priority === 'High' ? 'warning' : 'info'}">${r.priority}</span></td>
        <td><span class="badge bg-${r.status === 'Processing' ? 'warning' : 'primary'}">${r.status}</span></td>
        <td><button class="btn btn-sm btn-outline-primary" onclick="RequisitionReview.open(${r.id})">Review</button></td>
      </tr>
    `).join('') : '<tr><td colspan="7" class="text-center text-muted py-4">Nothing waiting on the store right now</td></tr>';
  },

  open: async (requisitionId) => {
    const requisition = await API.getRequisition(requisitionId);
    if (!requisition || requisition.error) { alert('Error: ' + ((requisition && requisition.error) || 'Could not load this requisition')); return; }
    RequisitionReview.currentRequisition = requisition;

    document.getElementById('reqReviewNo').textContent = requisition.requisition_number;
    document.getElementById('reqReviewRequester').textContent = requisition.requested_by_name;
    document.getElementById('reqReviewArea').textContent = requisition.area_of_use;

    const warehouses = await API.getWarehouses();
    document.getElementById('reqReviewWarehouse').innerHTML = (Array.isArray(warehouses) ? warehouses : []).map(w =>
      `<option value="${w.id}">${w.warehouse_name}</option>`
    ).join('');

    RequisitionReview.renderItems();

    RequisitionReview.modal = new bootstrap.Modal(document.getElementById('reqReviewModal'));
    RequisitionReview.modal.show();
  },

  renderItems: () => {
    const items = RequisitionReview.currentRequisition.items || [];
    let anyShortfall = false;
    document.getElementById('reqReviewItemsBody').innerHTML = items.map(it => {
      const outstanding = Number((it.quantity_requested - it.quantity_issued).toFixed(2));
      const isDone = it.status === 'Issued' || it.status === 'Sent to Indent';
      if (outstanding > 0.001 && !isDone) anyShortfall = true;
      const suggestedIssue = Math.max(0, Math.min(outstanding, parseFloat(it.quantity_available) || 0));
      return `
        <tr class="req-review-item" data-item-id="${it.id}" data-outstanding="${outstanding}">
          <td>${it.material_name} <span class="text-muted small">(${it.material_code})</span></td>
          <td>${it.quantity_requested} ${it.unit_of_measure || it.material_uom || ''}</td>
          <td>${it.quantity_issued}</td>
          <td><span class="badge bg-${parseFloat(it.quantity_available) >= outstanding ? 'success' : 'warning'}">${it.quantity_available}</span></td>
          <td>${isDone ? '—' : `<input type="number" class="form-control form-control-sm issue-qty-input" step="0.01" min="0" max="${outstanding}" value="${suggestedIssue}">`}</td>
          <td><span class="badge bg-${it.status === 'Issued' ? 'success' : it.status === 'Sent to Indent' ? 'secondary' : it.status === 'Partially Issued' ? 'warning' : 'light text-dark'}">${it.status}</span></td>
        </tr>
      `;
    }).join('');
    document.getElementById('reqReviewShortfallNote').style.display = anyShortfall ? 'block' : 'none';
  },

  issueSelected: async () => {
    const warehouseId = document.getElementById('reqReviewWarehouse').value;
    if (!warehouseId) { alert('Select which warehouse this is being issued from'); return; }

    const items = [];
    document.querySelectorAll('.req-review-item').forEach(row => {
      const input = row.querySelector('.issue-qty-input');
      if (!input) return;
      const qty = parseFloat(input.value) || 0;
      if (qty > 0) items.push({ requisition_item_id: parseInt(row.dataset.itemId), quantity_issue: qty });
    });
    if (!items.length) { alert('Enter a quantity to issue for at least one item'); return; }

    const result = await API.issueRequisitionItems(RequisitionReview.currentRequisition.id, { warehouse_id: warehouseId, items });
    if (result && !result.error) {
      alert(result.message || 'Stock issued');
      const refreshed = await API.getRequisition(RequisitionReview.currentRequisition.id);
      if (refreshed && !refreshed.error) {
        RequisitionReview.currentRequisition = refreshed;
        RequisitionReview.renderItems();
      }
      await RequisitionReview.load();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  convertToIndent: async () => {
    if (!confirm('Send the outstanding shortfall on this requisition to a new Indent for procurement?')) return;
    const result = await API.convertRequisitionToIndent(RequisitionReview.currentRequisition.id);
    if (result && !result.error) {
      alert(result.message || 'Indent created for the shortfall');
      RequisitionReview.modal.hide();
      await RequisitionReview.load();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};
