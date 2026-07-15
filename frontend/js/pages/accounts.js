const AccountsPage = {
  render: async () => {
    const today = new Date().toISOString().split('T')[0];
    return `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="fas fa-receipt me-2"></i>Accounts — GRN Receipts</h2>
          <p class="text-muted">Every completed GRN sent by Stores/Purchase shows up here. Acknowledge receipt daily.</p>
        </div>
      </div>

      <div class="row mb-3">
        <div class="col-md-3">
          <label class="form-label small">Filter by date</label>
          <input type="date" class="form-control" id="accountsDateFilter" value="${today}" onchange="AccountsActions.load()">
        </div>
        <div class="col-md-3 d-flex align-items-end">
          <button class="btn btn-outline-secondary" onclick="AccountsActions.clearFilter()">Show All</button>
        </div>
      </div>

      <div class="row mb-3">
        <div class="col-md-4">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <p class="text-muted small mb-1">Awaiting Acknowledgment</p>
              <h3 id="pendingAckCount" class="text-warning">-</h3>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <p class="text-muted small mb-1">Acknowledged (selected date)</p>
              <h3 id="ackCount" class="text-success">-</h3>
            </div>
          </div>
        </div>
      </div>

      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>GRN Number</th>
                <th>PO Number</th>
                <th>Vendor</th>
                <th>Amount</th>
                <th>Submitted By</th>
                <th>Submitted On</th>
                <th>Status</th>
                <th>Acknowledged</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="accountsList">
              <tr><td colspan="9" class="text-center text-muted py-4">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Acknowledge Modal -->
      <div class="modal fade" id="ackModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Acknowledge GRN Receipt</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="ackForm" onsubmit="AccountsActions.submitAck(event)">
              <div class="modal-body">
                <input type="hidden" id="ackSubmissionId">
                <p><strong>GRN:</strong> <span id="ackGrnNumber"></span></p>
                <div class="mb-3">
                  <label class="form-label">Remarks (optional)</label>
                  <textarea class="form-control" id="ackRemarks" rows="2" placeholder="e.g. invoice reference verified"></textarea>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-success">Confirm Receipt</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  init: async () => {
    await AccountsActions.load();
  }
};

const AccountsActions = {
  ackModal: null,

  clearFilter: () => {
    document.getElementById('accountsDateFilter').value = '';
    AccountsActions.load();
  },

  load: async () => {
    const date = document.getElementById('accountsDateFilter').value || null;
    const submissions = await API.getAccountsGRNSubmissions(date);
    if (!Array.isArray(submissions)) {
      document.getElementById('accountsList').innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4">${(submissions && submissions.error) || 'Could not load submissions.'}</td></tr>`;
      return;
    }

    document.getElementById('pendingAckCount').textContent = submissions.filter(s => s.status !== 'Acknowledged').length;
    document.getElementById('ackCount').textContent = submissions.filter(s => s.status === 'Acknowledged').length;

    const html = submissions.length > 0
      ? submissions.map(s => `
          <tr>
            <td><strong>${s.grn_number}</strong></td>
            <td>${s.po_number || '-'}</td>
            <td>${s.vendor_name || '-'}</td>
            <td>₹${parseFloat(s.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td>${s.submitted_by_name || '-'}</td>
            <td>${new Date(s.submitted_at).toLocaleString('en-IN')}</td>
            <td><span class="badge bg-${s.status === 'Acknowledged' ? 'success' : 'warning'}">${s.status}</span></td>
            <td>${s.acknowledged_by_name ? `${s.acknowledged_by_name} on ${new Date(s.acknowledged_at).toLocaleDateString('en-IN')}` : '-'}</td>
            <td>${s.status !== 'Acknowledged' ? `<button class="btn btn-sm btn-success" onclick="AccountsActions.openAck(${s.id}, '${s.grn_number}')">Acknowledge</button>` : '<span class="text-muted small">Done</span>'}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="9" class="text-center text-muted py-4">No GRNs submitted for this date</td></tr>';

    document.getElementById('accountsList').innerHTML = html;
  },

  openAck: (id, grnNumber) => {
    document.getElementById('ackForm').reset();
    document.getElementById('ackSubmissionId').value = id;
    document.getElementById('ackGrnNumber').textContent = grnNumber;
    AccountsActions.ackModal = new bootstrap.Modal(document.getElementById('ackModal'));
    AccountsActions.ackModal.show();
  },

  submitAck: async (event) => {
    event.preventDefault();
    const id = document.getElementById('ackSubmissionId').value;
    const remarks = document.getElementById('ackRemarks').value;
    const result = await API.acknowledgeGRNSubmission(id, remarks);
    if (result && !result.error) {
      AccountsActions.ackModal.hide();
      alert(result.message || 'Acknowledged');
      await AccountsActions.load();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};
