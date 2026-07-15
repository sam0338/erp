const IndentApproverPage = {
  render: async () => {
    return `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="fas fa-check-circle me-2"></i>Indent Approvals</h2>
          <p class="text-muted">Review and approve material indents from departments</p>
        </div>
      </div>

      <div class="row">
        <div class="col-md-12">
          <div class="card border-0 shadow-sm mb-3">
            <div class="card-header bg-light">
              <div class="row align-items-center">
                <div class="col-md-8">
                  <h6 class="mb-0"><i class="fas fa-filter me-2"></i>Pending Approvals</h6>
                </div>
                <div class="col-md-4 text-end">
                  <span class="badge bg-danger" id="pendingCount">0</span> pending
                </div>
              </div>
            </div>
            <div class="card-body">
              <div class="table-responsive">
                <table class="table table-hover mb-0" id="approvalTable">
                  <thead class="table-light">
                    <tr>
                      <th>Indent No.</th>
                      <th>Requested By</th>
                      <th>Items</th>
                      <th>Area of Use</th>
                      <th>Priority</th>
                      <th>Required By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody id="pendingIndentsList">
                    <tr><td colspan="7" class="text-center text-muted py-4">Loading pending indents...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Approval Modal -->
      <div class="modal fade" id="approvalModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="approvalTitle">Review Indent</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row mb-3">
                <div class="col-md-6">
                  <div class="card border-0 bg-light">
                    <div class="card-body">
                      <h6 class="text-muted mb-2">Indent Details</h6>
                      <p><strong>Indent No.:</strong> <span id="approvalIndentNo">-</span></p>
                      <p><strong>Requested By:</strong> <span id="approvalRequestedBy">-</span></p>
                      <p><strong>Department:</strong> <span id="approvalDepartment">-</span></p>
                      <p><strong>Date:</strong> <span id="approvalDate">-</span></p>
                    </div>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="card border-0 bg-light">
                    <div class="card-body">
                      <h6 class="text-muted mb-2">Request Details</h6>
                      <p><strong>Priority:</strong> <span id="approvalPriority">-</span></p>
                      <p><strong>Area of Use:</strong> <span id="approvalAreaOfUse">-</span></p>
                      <p><strong>Required By:</strong> <span id="approvalRequiredDate">-</span></p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="card border-0 bg-light mb-3">
                <div class="card-body">
                  <h6 class="text-muted mb-2">Items Requested</h6>
                  <div class="table-responsive">
                    <table class="table table-sm mb-0">
                      <thead><tr><th>Material</th><th>Type</th><th>Qty Required</th><th>Available Stock</th></tr></thead>
                      <tbody id="approvalItemsList"></tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div class="card border-0 bg-light mb-3">
                <div class="card-body">
                  <h6 class="text-muted mb-2">Justification</h6>
                  <p id="approvalJustification">-</p>
                </div>
              </div>

              <div class="form-group mb-3">
                <label class="form-label"><strong>Approval Comments</strong></label>
                <textarea class="form-control" id="approvalComments" rows="3" placeholder="Add approval comments or feedback..."></textarea>
              </div>

              <div class="alert alert-info small">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Stock Check:</strong> The available stock is shown above. If insufficient, consider approval based on pending orders.
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-danger" onclick="ApprovalActions.reject()">
                <i class="fas fa-times me-1"></i>Reject
              </button>
              <button type="button" class="btn btn-success" onclick="ApprovalActions.approve()">
                <i class="fas fa-check me-1"></i>Approve
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  init: async () => {
    await ApprovalActions.loadPendingIndents();
  }
};

const ApprovalActions = {
  currentIndent: null,
  modal: null,

  loadPendingIndents: async () => {
    const indents = await API.getIndentsPending();

    if (!Array.isArray(indents)) {
      console.error('Failed to load pending indents:', indents);
      document.getElementById('pendingIndentsList').innerHTML = '<tr><td colspan="9" class="text-center text-danger py-4">Could not load indents. Please try logging in again.</td></tr>';
      return;
    }

    document.getElementById('pendingCount').textContent = indents.length;

    const html = indents.length > 0
      ? indents.map(i => `
          <tr>
            <td><strong>${i.indent_number}</strong></td>
            <td>${i.requested_by_name}</td>
            <td>${i.item_count} item${i.item_count === 1 ? '' : 's'}<div class="text-muted small">${i.item_summary || ''}</div></td>
            <td>${i.area_of_use}</td>
            <td><span class="badge bg-${i.priority === 'Urgent' ? 'danger' : i.priority === 'High' ? 'warning' : 'info'}">${i.priority}</span></td>
            <td>${i.required_by_date ? new Date(i.required_by_date).toLocaleDateString('en-IN') : '-'}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="ApprovalActions.reviewIndent(${i.id})">Review</button>
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="7" class="text-center text-muted py-4">No pending indents for approval</td></tr>';

    document.getElementById('pendingIndentsList').innerHTML = html;
  },

  reviewIndent: async (indentId) => {
    const indent = await API.getIndent(indentId);

    if (!indent || indent.error) {
      alert('Error loading indent');
      return;
    }

    ApprovalActions.currentIndent = indent;

    // Populate modal
    document.getElementById('approvalIndentNo').textContent = indent.indent_number +
      (indent.required_level > 1 ? ` (Level ${(indent.current_level || 0) + 1} of ${indent.required_level} approval)` : '');
    document.getElementById('approvalRequestedBy').textContent = indent.requested_by_name;
    document.getElementById('approvalDepartment').textContent = indent.requested_from_dept || 'Unknown';
    document.getElementById('approvalDate').textContent = new Date(indent.indent_date).toLocaleDateString('en-IN');
    
    document.getElementById('approvalItemsList').innerHTML = (indent.items || []).map(it => `
      <tr>
        <td>${it.material_name} <span class="text-muted small">(${it.material_code})</span></td>
        <td>${it.material_type}</td>
        <td>${it.quantity_required} ${it.unit_of_measure || it.material_uom || ''}</td>
        <td><span class="badge bg-${parseFloat(it.quantity_available || 0) >= parseFloat(it.quantity_required) ? 'success' : 'warning'}">${it.quantity_available || 0} ${it.unit_of_measure || it.material_uom || ''}</span></td>
      </tr>
    `).join('');

    document.getElementById('approvalPriority').textContent = indent.priority;
    document.getElementById('approvalAreaOfUse').textContent = indent.area_of_use;
    document.getElementById('approvalRequiredDate').textContent = indent.required_by_date ? new Date(indent.required_by_date).toLocaleDateString('en-IN') : 'Not specified';

    document.getElementById('approvalJustification').textContent = indent.justification;
    document.getElementById('approvalComments').value = '';

    ApprovalActions.modal = new bootstrap.Modal(document.getElementById('approvalModal'));
    ApprovalActions.modal.show();
  },

  approve: async () => {
    if (!ApprovalActions.currentIndent) return;

    const comments = document.getElementById('approvalComments').value;
    const result = await API.approveIndent(ApprovalActions.currentIndent.id, true, comments);

    if (result && !result.error) {
      ApprovalActions.modal.hide();
      alert(result.message || 'Indent approved successfully!');
      await ApprovalActions.loadPendingIndents();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  reject: async () => {
    if (!ApprovalActions.currentIndent) return;

    const reason = document.getElementById('approvalComments').value;
    if (!reason) {
      alert('Please provide a rejection reason');
      return;
    }

    const result = await API.rejectIndent(ApprovalActions.currentIndent.id, reason);

    if (result && !result.error) {
      ApprovalActions.modal.hide();
      alert('Indent rejected');
      await ApprovalActions.loadPendingIndents();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};
