const ExpenseClaimsPage = {
  render: async () => {
    const isFinanceRole = Auth.hasRole(['admin', 'accounts']);
    return `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="fas fa-money-check-dollar me-2"></i>Advance &amp; Expense Claims</h2>
          <p class="text-muted mb-0">Travel advances and expense bills — customer visits, complaint visits, fuel/commute, tours. Submit → Reporting Manager approves → Accounts settles.</p>
        </div>
      </div>

      <ul class="nav nav-tabs mb-3" id="claimsTabs">
        <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#ecMyClaims">My Claims</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#ecApprove">Approve Claims <span id="pendingApprovalBadge"></span></button></li>
        ${isFinanceRole ? `
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#ecSettlement">Settlement Queue</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#ecReports">Reports (Employee / Department)</button></li>
        ` : ''}
      </ul>

      <div class="tab-content">
        <!-- MY CLAIMS -->
        <div class="tab-pane fade show active" id="ecMyClaims">
          <div class="d-flex justify-content-between mb-2">
            <p class="text-muted small mb-0">Every claim you submit, and where it currently stands.</p>
            <button class="btn btn-sm btn-primary" onclick="ClaimModal.show()"><i class="fas fa-plus me-1"></i>New Advance / Expense Claim</button>
          </div>
          <div class="card border-0 shadow-sm">
            <div class="card-body table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light"><tr><th>Claim No</th><th>Type</th><th>Category</th><th>Purpose</th><th>Amount</th><th>Status</th><th>Manager</th><th>Actions</th></tr></thead>
                <tbody id="myClaimsBody"><tr><td colspan="8" class="text-center text-muted">Loading...</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- APPROVE -->
        <div class="tab-pane fade" id="ecApprove">
          <p class="text-muted small">Claims submitted by people who report to you.</p>
          <div class="card border-0 shadow-sm">
            <div class="card-body table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light"><tr><th>Claim No</th><th>Employee</th><th>Type</th><th>Category</th><th>Purpose</th><th>Amount</th><th>Submitted</th><th>Actions</th></tr></thead>
                <tbody id="approveClaimsBody"><tr><td colspan="8" class="text-center text-muted">Loading...</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>

        ${isFinanceRole ? `
        <!-- SETTLEMENT -->
        <div class="tab-pane fade" id="ecSettlement">
          <p class="text-muted small">Manager-approved claims waiting on payment / settlement.</p>
          <div class="card border-0 shadow-sm">
            <div class="card-body table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light"><tr><th>Claim No</th><th>Employee</th><th>Dept</th><th>Type</th><th>Amount</th><th>Approved By</th><th>Approved On</th><th>Actions</th></tr></thead>
                <tbody id="settlementBody"><tr><td colspan="8" class="text-center text-muted">Loading...</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- REPORTS -->
        <div class="tab-pane fade" id="ecReports">
          <div class="row">
            <div class="col-md-6 mb-3">
              <div class="card border-0 shadow-sm">
                <div class="card-header fw-bold">Employee-wise</div>
                <div class="card-body table-responsive">
                  <table class="table table-sm table-hover mb-0">
                    <thead class="table-light"><tr><th>Employee</th><th>Dept</th><th>Claims</th><th>Total</th><th>Settled</th><th>Outstanding</th></tr></thead>
                    <tbody id="employeeSummaryBody"><tr><td colspan="6" class="text-center text-muted">Loading...</td></tr></tbody>
                  </table>
                </div>
              </div>
            </div>
            <div class="col-md-6 mb-3">
              <div class="card border-0 shadow-sm">
                <div class="card-header fw-bold">Department-wise</div>
                <div class="card-body table-responsive">
                  <table class="table table-sm table-hover mb-0">
                    <thead class="table-light"><tr><th>Department</th><th>Claims</th><th>Total</th><th>Settled</th><th>Outstanding</th></tr></thead>
                    <tbody id="departmentSummaryBody"><tr><td colspan="5" class="text-center text-muted">Loading...</td></tr></tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div class="card border-0 shadow-sm">
            <div class="card-header fw-bold">All Claims</div>
            <div class="card-body table-responsive">
              <table class="table table-sm table-hover mb-0">
                <thead class="table-light"><tr><th>Claim No</th><th>Employee</th><th>Dept</th><th>Type</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody id="allClaimsBody"><tr><td colspan="7" class="text-center text-muted">Loading...</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
        ` : ''}
      </div>

      ${ExpenseClaimsPage.modalsHtml()}
    `;
  },

  modalsHtml: () => `
    <!-- New Claim Modal -->
    <div class="modal fade" id="claimModal" tabindex="-1">
      <div class="modal-dialog modal-lg"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">New Advance / Expense Claim</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="ClaimModal.submit(event)">
          <div class="modal-body">
            <div class="row">
              <div class="col-md-6 mb-2">
                <label class="form-label">Claim Type *</label>
                <select class="form-control" id="claimType" required onchange="ClaimModal.onTypeChange()">
                  <option value="Advance">Advance (money requested before a trip/visit)</option>
                  <option value="Expense Bill">Expense Bill (actuals spent, itemized)</option>
                </select>
              </div>
              <div class="col-md-6 mb-2">
                <label class="form-label">Category *</label>
                <select class="form-control" id="claimCategory" required>
                  <option>Customer Visit</option>
                  <option>Complaint Visit</option>
                  <option>Tour</option>
                  <option>Fuel / Daily Commute</option>
                  <option>Travel</option>
                  <option>Other</option>
                </select>
              </div>
            </div>
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Customer (optional)</label><select class="form-control" id="claimCustomer"><option value="">— None —</option></select></div>
              <div class="col-md-3 mb-2"><label class="form-label">From Date</label><input type="date" class="form-control" id="claimFromDate"></div>
              <div class="col-md-3 mb-2"><label class="form-label">To Date</label><input type="date" class="form-control" id="claimToDate"></div>
            </div>
            <div class="mb-2"><label class="form-label">Purpose / Details *</label><textarea class="form-control" id="claimPurpose" rows="2" required placeholder="e.g. Visit to ABC Steels for annual rate discussion + complaint on last dispatch"></textarea></div>

            <div id="advanceAmountBlock" class="mb-2">
              <label class="form-label">Amount Requested *</label>
              <input type="number" class="form-control" id="claimAdvanceAmount" step="0.01">
            </div>

            <div id="expenseItemsBlock" style="display:none">
              <label class="form-label fw-bold">Expense Items</label>
              <div id="claimItemsContainer"></div>
              <button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick="ClaimModal.addItem()"><i class="fas fa-plus me-1"></i>Add Item</button>
              <div class="text-end small mt-2" id="claimItemsTotal">Total: ₹0.00</div>
              <div class="mb-2 mt-2">
                <label class="form-label">Adjust Against Prior Advance (optional)</label>
                <select class="form-control" id="claimLinkedAdvance"><option value="">— None —</option></select>
              </div>
            </div>

            <div class="mb-2"><label class="form-label">Remarks</label><textarea class="form-control" id="claimRemarks" rows="2"></textarea></div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Submit to Reporting Manager</button></div>
        </form>
      </div></div>
    </div>

    <!-- Manager Decision Modal -->
    <div class="modal fade" id="decisionModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Review Claim</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="DecisionModal.submit(event)">
          <div class="modal-body">
            <input type="hidden" id="decisionClaimId">
            <div id="decisionClaimSummary" class="mb-3"></div>
            <div class="mb-2"><label class="form-label">Comments</label><textarea class="form-control" id="decisionComments" rows="2"></textarea></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" onclick="DecisionModal.submit(event, 'Rejected')">Reject</button>
            <button type="button" class="btn btn-success" onclick="DecisionModal.submit(event, 'Approved')">Approve</button>
          </div>
        </form>
      </div></div>
    </div>

    <!-- Settle Modal -->
    <div class="modal fade" id="settleModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Settle Claim</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="SettleModal.submit(event)">
          <div class="modal-body">
            <input type="hidden" id="settleClaimId">
            <div class="mb-2"><label class="form-label">Settlement Mode</label>
              <select class="form-control" id="settleMode"><option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>UPI</option><option>Adjusted Against Advance</option></select>
            </div>
            <div class="mb-2"><label class="form-label">Reference Number</label><input type="text" class="form-control" id="settleReference"></div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Mark Settled</button></div>
        </form>
      </div></div>
    </div>
  `,

  fmt: (n) => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
  isFinanceRole: false,

  rowsOrMessage: (rows, colspan, emptyMsg, mapFn) => {
    if (!Array.isArray(rows)) {
      const errMsg = (rows && rows.error) ? rows.error : 'Could not load this data.';
      return `<tr><td colspan="${colspan}" class="text-center text-danger py-3"><i class="fas fa-triangle-exclamation me-1"></i>${errMsg}</td></tr>`;
    }
    if (rows.length === 0) return `<tr><td colspan="${colspan}" class="text-center text-muted">${emptyMsg}</td></tr>`;
    return rows.map(mapFn).join('');
  },

  statusBadge: (status) => {
    const map = { 'Pending Approval': 'warning', Approved: 'primary', Rejected: 'danger', Settled: 'success' };
    return `<span class="badge bg-${map[status] || 'secondary'}">${status}</span>`;
  },

  init: async () => {
    ExpenseClaimsPage.isFinanceRole = Auth.hasRole(['admin', 'accounts']);
    await Promise.all([
      ExpenseClaimsPage.loadMyClaims(),
      ExpenseClaimsPage.loadPendingApproval(),
      ExpenseClaimsPage.isFinanceRole ? ExpenseClaimsPage.loadSettlement() : Promise.resolve(),
      ExpenseClaimsPage.isFinanceRole ? ExpenseClaimsPage.loadReports() : Promise.resolve()
    ]);
  },

  loadMyClaims: async () => {
    const rows = await API.getMyExpenseClaims();
    document.getElementById('myClaimsBody').innerHTML = ExpenseClaimsPage.rowsOrMessage(rows, 8, 'No claims submitted yet', c => `
      <tr>
        <td>${c.claim_number}</td><td>${c.claim_type}</td><td>${c.category}</td><td>${c.purpose || '-'}</td>
        <td>${ExpenseClaimsPage.fmt(c.amount)}</td><td>${ExpenseClaimsPage.statusBadge(c.status)}</td><td>${c.manager_name || '-'}</td>
        <td><button class="btn btn-sm btn-outline-secondary" onclick="ClaimPrint.print(${c.id})">Print</button></td>
      </tr>
    `);
  },

  loadPendingApproval: async () => {
    const rows = await API.getClaimsPendingMyApproval();
    const badge = document.getElementById('pendingApprovalBadge');
    if (badge) badge.innerHTML = Array.isArray(rows) && rows.length ? `<span class="badge bg-danger">${rows.length}</span>` : '';
    document.getElementById('approveClaimsBody').innerHTML = ExpenseClaimsPage.rowsOrMessage(rows, 8, 'Nothing waiting on your approval', c => `
      <tr>
        <td>${c.claim_number}</td><td>${c.employee_name}</td><td>${c.claim_type}</td><td>${c.category}</td><td>${c.purpose || '-'}</td>
        <td>${ExpenseClaimsPage.fmt(c.amount)}</td><td>${new Date(c.created_at).toLocaleDateString('en-IN')}</td>
        <td><button class="btn btn-sm btn-primary" onclick="DecisionModal.show(${c.id})">Review</button></td>
      </tr>
    `);
  },

  loadSettlement: async () => {
    const rows = await API.getClaimsForSettlement();
    document.getElementById('settlementBody').innerHTML = ExpenseClaimsPage.rowsOrMessage(rows, 8, 'Nothing waiting on settlement', c => `
      <tr>
        <td>${c.claim_number}</td><td>${c.employee_name}</td><td>${c.department || '-'}</td><td>${c.claim_type}</td>
        <td>${ExpenseClaimsPage.fmt(c.amount)}</td><td>${c.manager_name || '-'}</td>
        <td>${c.manager_action_at ? new Date(c.manager_action_at).toLocaleDateString('en-IN') : '-'}</td>
        <td><button class="btn btn-sm btn-success" onclick="SettleModal.show(${c.id})">Settle</button> <button class="btn btn-sm btn-outline-secondary" onclick="ClaimPrint.print(${c.id})">Print</button></td>
      </tr>
    `);
  },

  loadReports: async () => {
    const summary = await API.getExpenseClaimsSummary();
    if (summary && !summary.error) {
      document.getElementById('employeeSummaryBody').innerHTML = ExpenseClaimsPage.rowsOrMessage(summary.by_employee, 6, 'No claims yet', e => `
        <tr><td>${e.employee_name}</td><td>${e.department || '-'}</td><td>${e.claim_count}</td>
        <td>${ExpenseClaimsPage.fmt(e.total_amount)}</td><td>${ExpenseClaimsPage.fmt(e.settled_amount)}</td><td>${ExpenseClaimsPage.fmt(e.outstanding_amount)}</td></tr>
      `);
      document.getElementById('departmentSummaryBody').innerHTML = ExpenseClaimsPage.rowsOrMessage(summary.by_department, 5, 'No claims yet', d => `
        <tr><td>${d.department}</td><td>${d.claim_count}</td><td>${ExpenseClaimsPage.fmt(d.total_amount)}</td>
        <td>${ExpenseClaimsPage.fmt(d.settled_amount)}</td><td>${ExpenseClaimsPage.fmt(d.outstanding_amount)}</td></tr>
      `);
    }
    const all = await API.getAllExpenseClaims();
    document.getElementById('allClaimsBody').innerHTML = ExpenseClaimsPage.rowsOrMessage(all, 7, 'No claims yet', c => `
      <tr><td>${c.claim_number}</td><td>${c.employee_name}</td><td>${c.department || '-'}</td><td>${c.claim_type}</td>
      <td>${ExpenseClaimsPage.fmt(c.amount)}</td><td>${ExpenseClaimsPage.statusBadge(c.status)}</td>
      <td><button class="btn btn-sm btn-outline-secondary" onclick="ClaimPrint.print(${c.id})">Print</button></td></tr>
    `);
  }
};

const ClaimModal = {
  modal: null,
  itemCount: 0,
  show: async () => {
    document.getElementById('claimType').value = 'Advance';
    document.getElementById('claimCategory').value = 'Customer Visit';
    document.getElementById('claimFromDate').value = '';
    document.getElementById('claimToDate').value = '';
    document.getElementById('claimPurpose').value = '';
    document.getElementById('claimRemarks').value = '';
    document.getElementById('claimAdvanceAmount').value = '';
    document.getElementById('claimItemsContainer').innerHTML = '';
    ClaimModal.itemCount = 0;

    const customers = await API.getCustomers();
    document.getElementById('claimCustomer').innerHTML = '<option value="">— None —</option>' + (Array.isArray(customers) ? customers : []).map(c => `<option value="${c.id}">${c.customer_name}</option>`).join('');

    const myClaims = await API.getMyExpenseClaims();
    const advances = (Array.isArray(myClaims) ? myClaims : []).filter(c => c.claim_type === 'Advance' && c.status !== 'Rejected');
    document.getElementById('claimLinkedAdvance').innerHTML = '<option value="">— None —</option>' + advances.map(a => `<option value="${a.id}">${a.claim_number} (${ExpenseClaimsPage.fmt(a.amount)}, ${a.status})</option>`).join('');

    ClaimModal.onTypeChange();
    ClaimModal.modal = new bootstrap.Modal(document.getElementById('claimModal'));
    ClaimModal.modal.show();
  },

  onTypeChange: () => {
    const isExpenseBill = document.getElementById('claimType').value === 'Expense Bill';
    document.getElementById('advanceAmountBlock').style.display = isExpenseBill ? 'none' : 'block';
    document.getElementById('expenseItemsBlock').style.display = isExpenseBill ? 'block' : 'none';
    if (isExpenseBill && ClaimModal.itemCount === 0) ClaimModal.addItem();
  },

  addItem: () => {
    const div = document.createElement('div');
    div.className = 'row mb-2 claim-item align-items-center';
    div.innerHTML = `
      <div class="col-md-3"><input type="date" class="form-control form-control-sm item-date"></div>
      <div class="col-md-3">
        <select class="form-control form-control-sm item-category">
          <option>Fuel</option><option>Toll / Parking</option><option>Food</option><option>Lodging</option><option>Local Conveyance</option><option>Other</option>
        </select>
      </div>
      <div class="col-md-3"><input type="text" class="form-control form-control-sm item-desc" placeholder="Description"></div>
      <div class="col-md-2"><input type="number" class="form-control form-control-sm item-amount" placeholder="Amount" step="0.01" oninput="ClaimModal.recalcTotal()"></div>
      <div class="col-md-1"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.claim-item').remove(); ClaimModal.recalcTotal()"><i class="fas fa-trash"></i></button></div>
    `;
    document.getElementById('claimItemsContainer').appendChild(div);
  },

  recalcTotal: () => {
    let total = 0;
    document.querySelectorAll('.claim-item').forEach(row => { total += parseFloat(row.querySelector('.item-amount').value) || 0; });
    document.getElementById('claimItemsTotal').textContent = `Total: ${ExpenseClaimsPage.fmt(total)}`;
  },

  submit: async (event) => {
    event.preventDefault();
    const claimType = document.getElementById('claimType').value;
    const items = [];
    if (claimType === 'Expense Bill') {
      document.querySelectorAll('.claim-item').forEach(row => {
        const amount = parseFloat(row.querySelector('.item-amount').value) || 0;
        if (amount > 0) items.push({ item_date: row.querySelector('.item-date').value, category: row.querySelector('.item-category').value, description: row.querySelector('.item-desc').value, amount });
      });
      if (!items.length) { alert('Add at least one expense item'); return; }
    }
    const data = {
      claim_type: claimType,
      category: document.getElementById('claimCategory').value,
      customer_id: document.getElementById('claimCustomer').value || null,
      from_date: document.getElementById('claimFromDate').value,
      to_date: document.getElementById('claimToDate').value,
      purpose: document.getElementById('claimPurpose').value,
      amount: parseFloat(document.getElementById('claimAdvanceAmount').value) || 0,
      items,
      linked_advance_claim_id: document.getElementById('claimLinkedAdvance').value || null,
      remarks: document.getElementById('claimRemarks').value
    };
    const result = await API.createExpenseClaim(data);
    if (result && !result.error) {
      ClaimModal.modal.hide();
      alert(result.message || 'Claim submitted');
      await ExpenseClaimsPage.loadMyClaims();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};

const DecisionModal = {
  modal: null,
  show: async (claimId) => {
    const claim = await API.getExpenseClaim(claimId);
    if (!claim || claim.error) { alert('Could not load this claim'); return; }
    document.getElementById('decisionClaimId').value = claimId;
    document.getElementById('decisionComments').value = '';
    document.getElementById('decisionClaimSummary').innerHTML = `
      <table class="table table-sm">
        <tr><td class="text-muted">Employee</td><td>${claim.employee_name} (${claim.department || '-'})</td></tr>
        <tr><td class="text-muted">Type / Category</td><td>${claim.claim_type} / ${claim.category}</td></tr>
        <tr><td class="text-muted">Purpose</td><td>${claim.purpose || '-'}</td></tr>
        <tr><td class="text-muted">Amount</td><td><strong>${ExpenseClaimsPage.fmt(claim.amount)}</strong></td></tr>
        ${claim.items && claim.items.length ? `<tr><td class="text-muted">Items</td><td>${claim.items.map(i => `${i.category}: ${ExpenseClaimsPage.fmt(i.amount)}`).join(', ')}</td></tr>` : ''}
      </table>
    `;
    DecisionModal.modal = new bootstrap.Modal(document.getElementById('decisionModal'));
    DecisionModal.modal.show();
  },
  submit: async (event, decision) => {
    event.preventDefault();
    if (!decision) return; // form's default submit (Enter key) shouldn't silently approve/reject
    const id = document.getElementById('decisionClaimId').value;
    const comments = document.getElementById('decisionComments').value;
    const result = await API.decideExpenseClaim(id, decision, comments);
    if (result && !result.error) {
      DecisionModal.modal.hide();
      alert(result.message || `Claim ${decision.toLowerCase()}`);
      await ExpenseClaimsPage.loadPendingApproval();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};

const SettleModal = {
  modal: null,
  show: (claimId) => {
    document.getElementById('settleClaimId').value = claimId;
    document.getElementById('settleReference').value = '';
    SettleModal.modal = new bootstrap.Modal(document.getElementById('settleModal'));
    SettleModal.modal.show();
  },
  submit: async (event) => {
    event.preventDefault();
    const id = document.getElementById('settleClaimId').value;
    const data = { settlement_mode: document.getElementById('settleMode').value, settlement_reference: document.getElementById('settleReference').value };
    const result = await API.settleExpenseClaim(id, data);
    if (result && !result.error) {
      SettleModal.modal.hide();
      alert(result.message || 'Claim settled');
      await ExpenseClaimsPage.loadSettlement();
      await ExpenseClaimsPage.loadReports();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};

// Printable voucher — carries the full approval trail (submission,
// manager decision, settlement) for physical record keeping, matching
// the print style used elsewhere in the app (job card, dispatch note).
const ClaimPrint = {
  print: async (claimId) => {
    const claim = await API.getExpenseClaim(claimId);
    if (!claim || claim.error) { alert('Could not load this claim'); return; }
    const company = await API.getCompanySettings() || {};
    const itemsHtml = (claim.items || []).length
      ? `<table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
         <tbody>${claim.items.map(i => `<tr><td>${i.item_date ? new Date(i.item_date).toLocaleDateString('en-IN') : '-'}</td><td>${i.category || '-'}</td><td>${i.description || '-'}</td><td style="text-align:right">${ExpenseClaimsPage.fmt(i.amount)}</td></tr>`).join('')}</tbody></table>`
      : '';

    const printHtml = `
      <!DOCTYPE html><html><head><title>${claim.claim_number}</title><meta charset="utf-8">
      <style>
        @page { size: A4; margin: 15mm; } body { font-family: Arial, Helvetica, sans-serif; color:#222; font-size:12px; }
        h2 { color:#1a4d8f; margin-bottom:0; } h3 { margin-top: 4px; }
        table { width:100%; border-collapse: collapse; margin-top:8px; }
        th, td { border:1px solid #ccc; padding:6px 8px; text-align:left; font-size:11px; } th { background:#f0f4fa; }
        .meta { display:flex; justify-content:space-between; background:#f7f9fc; border:1px solid #ddd; padding:8px; margin:10px 0; }
        .trail { margin-top:16px; }
        .trail-step { border:1px solid #ddd; border-left:4px solid #1a4d8f; padding:8px 10px; margin-bottom:8px; }
        .trail-step.rejected { border-left-color:#c0392b; }
        .amount-box { font-size:16px; font-weight:bold; text-align:right; margin-top:8px; }
        .sign { display:flex; justify-content:space-between; margin-top:50px; } .sign div { border-top:1px solid #333; width:30%; text-align:center; padding-top:4px; }
      </style></head><body>
        <h2>${company.company_name || 'Company'}</h2>
        <div class="small text-muted">${[company.address, company.city, company.state].filter(Boolean).join(', ')}</div>
        <h3>${claim.claim_type === 'Advance' ? 'ADVANCE REQUEST VOUCHER' : 'EXPENSE CLAIM VOUCHER'}</h3>
        <div class="meta">
          <div><strong>Claim No:</strong> ${claim.claim_number}<br><strong>Date:</strong> ${new Date(claim.created_at).toLocaleDateString('en-IN')}<br><strong>Status:</strong> ${claim.status}</div>
          <div><strong>Employee:</strong> ${claim.employee_name}<br><strong>Department:</strong> ${claim.department || '-'}</div>
          <div><strong>Category:</strong> ${claim.category}<br>${claim.customer_name ? `<strong>Customer:</strong> ${claim.customer_name}` : ''}${claim.from_date ? `<br><strong>Period:</strong> ${new Date(claim.from_date).toLocaleDateString('en-IN')} - ${claim.to_date ? new Date(claim.to_date).toLocaleDateString('en-IN') : '-'}` : ''}</div>
        </div>
        <p><strong>Purpose:</strong> ${claim.purpose || '-'}</p>
        ${itemsHtml}
        <div class="amount-box">Total Amount: ${ExpenseClaimsPage.fmt(claim.amount)}</div>
        ${claim.linked_advance_number ? `<p class="small text-muted">Adjusted against advance: ${claim.linked_advance_number}</p>` : ''}

        <div class="trail">
          <strong>Approval Trail</strong>
          <div class="trail-step">1. Submitted by <strong>${claim.employee_name}</strong> on ${new Date(claim.created_at).toLocaleDateString('en-IN')}${claim.remarks ? ` — "${claim.remarks}"` : ''}</div>
          ${claim.manager_action_by_name ? `
          <div class="trail-step ${claim.status === 'Rejected' ? 'rejected' : ''}">2. ${claim.status === 'Rejected' ? 'Rejected' : 'Approved'} by <strong>${claim.manager_action_by_name}</strong> (Reporting Manager) on ${new Date(claim.manager_action_at).toLocaleDateString('en-IN')}${claim.manager_comments ? ` — "${claim.manager_comments}"` : ''}</div>
          ` : `<div class="trail-step">2. Awaiting Reporting Manager (${claim.manager_name || '-'}) approval</div>`}
          ${claim.settled_by_name ? `
          <div class="trail-step">3. Settled by <strong>${claim.settled_by_name}</strong> (Accounts) on ${new Date(claim.settled_at).toLocaleDateString('en-IN')} — ${claim.settlement_mode || ''}${claim.settlement_reference ? ` Ref: ${claim.settlement_reference}` : ''}</div>
          ` : (claim.status === 'Approved' ? '<div class="trail-step">3. Awaiting settlement by Accounts</div>' : '')}
        </div>

        <div class="sign"><div>Employee Signature</div><div>Reporting Manager Signature</div><div>Accounts Signature</div></div>
        <script>window.onload = () => window.print();</script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Please allow pop-ups to print the voucher.'); return; }
    w.document.write(printHtml);
    w.document.close();
  }
};
