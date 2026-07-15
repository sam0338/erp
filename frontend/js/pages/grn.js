const GRNPage = {
  render: async () => {
    return `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="fas fa-boxes me-2"></i>Goods Receipt Notes</h2>
        </div>
        <div class="col-md-4 text-end">
          <button class="btn btn-primary" onclick="GRNModal.show()">
            <i class="fas fa-plus me-2"></i>Create GRN
          </button>
        </div>
      </div>

      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th>GRN Number</th>
                  <th>PO Number</th>
                  <th>Vendor</th>
                  <th>GRN Date</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Accounts</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="grnList">
                <tr><td colspan="8" class="text-center text-muted py-4">Loading GRNs...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- GRN Modal -->
      <div class="modal fade" id="grnModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Create Goods Receipt Note</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="grnForm" onsubmit="GRNModal.submit(event)">
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label">Purchase Order *</label>
                  <select class="form-control" id="grnPOSelect" required onchange="GRNModal.loadPOItems()">
                    <option value="">Select PO</option>
                  </select>
                </div>

                <div class="mb-3">
                  <h6>Received Items</h6>
                  <div id="grnItemsContainer"></div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Notes</label>
                  <textarea class="form-control" id="grnNotes" rows="2"></textarea>
                </div>

                <div class="border-top pt-3">
                  <div class="row">
                    <div class="col-md-8 text-end">
                      <h6>Total Amount:</h6>
                    </div>
                    <div class="col-md-4">
                      <h6 id="grnTotal">₹0.00</h6>
                    </div>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Create GRN</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  init: async () => {
    await GRNModal.loadGRNs();
    await GRNModal.loadPOs();
  }
};

const GRNModal = {
  modal: null,
  currentPO: null,

  show: () => {
    GRNModal.modal = new bootstrap.Modal(document.getElementById('grnModal'));
    document.getElementById('grnForm').reset();
    document.getElementById('grnItemsContainer').innerHTML = '';
    GRNModal.modal.show();
  },

  loadPOs: async () => {
    const pos = await API.getPurchaseOrders() || [];
    const approvedPOs = pos.filter(p => p.status === 'Approved');
    const select = document.getElementById('grnPOSelect');
    if (select) {
      select.innerHTML = '<option value="">Select PO</option>' + approvedPOs.map(po => 
        `<option value="${po.id}">${po.po_number} - ${po.vendor_name}</option>`
      ).join('');
    }
  },

  loadPOItems: async () => {
    const poId = document.getElementById('grnPOSelect').value;
    if (!poId) {
      document.getElementById('grnItemsContainer').innerHTML = '';
      return;
    }

    const po = await API.getPurchaseOrder(poId);
    GRNModal.currentPO = po;

    const itemsHtml = po.items.map((item, idx) => `
      <div class="card mb-2 grn-item">
        <div class="card-body">
          <div class="row">
            <div class="col-md-4">
              <label class="form-label">Material</label>
              <input type="text" class="form-control" value="${item.material_name}" disabled>
              <input type="hidden" class="po-item-id" value="${item.id}">
            </div>
            <div class="col-md-2">
              <label class="form-label">PO Qty</label>
              <input type="number" class="form-control" value="${item.quantity}" disabled>
            </div>
            <div class="col-md-2">
              <label class="form-label">Received Qty</label>
              <input type="number" class="form-control grn-qty" step="0.01" value="${item.quantity}">
            </div>
            <div class="col-md-2">
              <label class="form-label">Rejected Qty</label>
              <input type="number" class="form-control grn-rejected" step="0.01" value="0">
            </div>
            <div class="col-md-2">
              <label class="form-label">Batch No.</label>
              <input type="text" class="form-control grn-batch">
            </div>
          </div>
          <div class="row mt-2">
            <div class="col-md-4">
              <label class="form-label">Heat Number</label>
              <input type="text" class="form-control grn-heat" placeholder="For metals/coils">
            </div>
            <div class="col-md-4">
              <label class="form-label">Coil Number</label>
              <input type="text" class="form-control grn-coil">
            </div>
            <div class="col-md-4">
              <label class="form-label">Serial Number</label>
              <input type="text" class="form-control grn-serial">
            </div>
          </div>
          <div class="row mt-2">
            <div class="col-md-6">
              <label class="form-label">Expiry Date</label>
              <input type="date" class="form-control grn-expiry">
            </div>
            <div class="col-md-6">
              <label class="form-label">Notes</label>
              <input type="text" class="form-control grn-item-notes">
            </div>
          </div>
        </div>
      </div>
    `).join('');

    document.getElementById('grnItemsContainer').innerHTML = itemsHtml;
  },

  submit: async (event) => {
    event.preventDefault();
    const poId = document.getElementById('grnPOSelect').value;
    if (!poId) {
      alert('Please select a PO');
      return;
    }

    const items = [];
    document.querySelectorAll('.grn-item').forEach(item => {
      const poItemId = item.querySelector('.po-item-id').value;
      const receivedQty = item.querySelector('.grn-qty').value;
      const rejectedQty = item.querySelector('.grn-rejected').value;
      const batch = item.querySelector('.grn-batch').value;
      const heat = item.querySelector('.grn-heat').value;
      const coil = item.querySelector('.grn-coil').value;
      const serial = item.querySelector('.grn-serial').value;
      const expiry = item.querySelector('.grn-expiry').value;
      const notes = item.querySelector('.grn-item-notes').value;

      items.push({
        po_item_id: parseInt(poItemId),
        received_quantity: parseFloat(receivedQty) || 0,
        rejected_quantity: parseFloat(rejectedQty) || 0,
        batch_number: batch,
        heat_number: heat,
        coil_number: coil,
        serial_number: serial,
        expiry_date: expiry,
        notes: notes
      });
    });

    const data = {
      po_id: parseInt(poId),
      items: items,
      notes: document.getElementById('grnNotes').value
    };

    const result = await API.createGRN(data);
    if (result && !result.error) {
      GRNModal.modal.hide();
      await GRNModal.loadGRNs();
      alert(result.message || `GRN created successfully: ${result.grn_number}`);
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  loadGRNs: async () => {
    const grns = await API.getGRNs() || [];
    const html = grns.length > 0
      ? grns.map(grn => {
          const accountsBadge = grn.accounts_status === 'Acknowledged'
            ? `<span class="badge bg-success" title="Acknowledged by ${grn.accounts_acknowledged_by_name || ''} on ${grn.accounts_acknowledged_at ? new Date(grn.accounts_acknowledged_at).toLocaleDateString('en-IN') : ''}">Acknowledged</span>`
            : grn.accounts_status === 'Submitted'
              ? `<span class="badge bg-warning text-dark">Awaiting Ack.</span>`
              : `<span class="badge bg-secondary">Not Sent</span>`;

          return `
          <tr>
            <td><strong>${grn.grn_number}</strong></td>
            <td>${grn.po_number}</td>
            <td>${grn.vendor_name}</td>
            <td>${new Date(grn.grn_date).toLocaleDateString('en-IN')}</td>
            <td>₹${parseFloat(grn.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td><span class="badge bg-${grn.status === 'Pending' ? 'warning' : 'success'}">${grn.status}</span></td>
            <td>${accountsBadge}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="GRNActions.printGRN(${grn.id})"><i class="fas fa-print me-1"></i>Print</button>
              ${!grn.accounts_status ? `<button class="btn btn-sm btn-outline-success" onclick="GRNActions.submitToAccounts(${grn.id})"><i class="fas fa-paper-plane me-1"></i>Send to Accounts</button>` : ''}
            </td>
          </tr>
        `;
        }).join('')
      : '<tr><td colspan="8" class="text-center text-muted">No GRNs found</td></tr>';

    document.getElementById('grnList').innerHTML = html;
  }
};

const GRNActions = {
  submitToAccounts: async (grnId) => {
    const remarks = prompt('Optional note for Accounts (e.g. invoice reference):') || '';
    const result = await API.submitGRNToAccounts(grnId, remarks);
    if (result && !result.error) {
      alert(result.message || 'Submitted to Accounts');
      await GRNModal.loadGRNs();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  printGRN: async (grnId) => {
    const grn = await API.getGRNDetail(grnId);
    if (!grn || grn.error) {
      alert('Could not load this GRN: ' + ((grn && grn.error) || 'unknown error'));
      return;
    }
    const company = await API.getCompanySettings() || {};

    const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const dt = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '-';
    const dtTime = (d) => d ? new Date(d).toLocaleString('en-IN') : '-';

    // Renders every level of a multi-level approval chain (Level 1, Level 2,
    // ...) rather than just a single "approved by" line, so a hierarchy
    // with several sign-offs shows its full trail on the print.
    const historyRows = (history) => (history || []).map(h =>
      `<tr><td>Level ${h.level} — ${h.action}</td><td>${h.approved_by_name || '-'} on ${dtTime(h.created_at)}${h.comments ? ' — ' + h.comments : ''}</td></tr>`
    ).join('');

    const qcBadge = (status) => {
      if (!status) return '<span class="qc-tag qc-pending">Pending</span>';
      if (status === 'Completed') return '<span class="qc-tag qc-pass">Cleared</span>';
      return '<span class="qc-tag qc-partial">Partial</span>';
    };

    const traceCode = (item) => [item.batch_number, item.heat_number && `Heat: ${item.heat_number}`, item.coil_number && `Coil: ${item.coil_number}`, item.serial_number && `Sr: ${item.serial_number}`].filter(Boolean).join(' / ') || '-';
    const itemRows = (grn.items || []).map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${item.material_name || '-'} <span class="muted">(${item.material_code || ''})</span></td>
        <td class="right">${item.received_quantity} ${item.unit_of_measure || ''}</td>
        <td class="right">${item.rejected_quantity || 0}</td>
        <td class="right">${item.quantity_passed ?? 0}</td>
        <td class="right">${item.quantity_hold ?? 0}</td>
        <td class="right">${item.quantity_rejected ?? 0}</td>
        <td class="center">${qcBadge(item.qc_status)}</td>
        <td class="small">${traceCode(item)}</td>
      </tr>
    `).join('');

    const totalReceived = (grn.items || []).reduce((s, i) => s + (parseFloat(i.received_quantity) || 0), 0);
    const totalPassed = (grn.items || []).reduce((s, i) => s + (parseFloat(i.quantity_passed) || 0), 0);

    // Three approval stamps: Indent (if this PO originated from one), PO, and QC.
    // Each is rendered as a signed-off box so the printed sheet reads as a
    // single audit trail of the whole cycle, not just the receipt itself.
    const indentBlock = grn.indent ? `
      <div class="approval-box">
        <div class="approval-title">1. Indent Approval ${grn.indent.required_level > 1 ? `(Level ${grn.indent.current_level || 0} of ${grn.indent.required_level})` : ''}</div>
        <table class="kv">
          <tr><td>Indent No.</td><td>${grn.indent.indent_number}</td></tr>
          <tr><td>Raised By</td><td>${grn.indent.requested_by_name || '-'}</td></tr>
          <tr><td>Area of Use</td><td>${grn.indent.area_of_use || '-'}</td></tr>
          <tr><td>Status</td><td>${grn.indent.status}</td></tr>
          ${grn.indent.approval_comments ? `<tr><td>Comments</td><td>${grn.indent.approval_comments}</td></tr>` : ''}
        </table>
        ${(grn.indent.approval_history || []).length > 0 ? `<table class="kv" style="margin-top:4px">${historyRows(grn.indent.approval_history)}</table>` : ''}
      </div>
    ` : `
      <div class="approval-box muted-box">
        <div class="approval-title">1. Indent Approval</div>
        <p class="muted">This PO was not raised from an indent (created directly).</p>
      </div>
    `;

    const poBlock = `
      <div class="approval-box">
        <div class="approval-title">2. Purchase Order Approval ${grn.po?.required_level > 1 ? `(Level ${grn.po?.current_level || 0} of ${grn.po?.required_level})` : ''}</div>
        <table class="kv">
          <tr><td>PO No.</td><td>${grn.po?.po_number || '-'}</td></tr>
          <tr><td>Vendor</td><td>${grn.po?.vendor_name || '-'} ${grn.po?.gst_number ? '(GST: ' + grn.po.gst_number + ')' : ''}</td></tr>
          <tr><td>PO Date</td><td>${dt(grn.po?.po_date)}</td></tr>
          <tr><td>Created By</td><td>${grn.po?.created_by_name || '-'}</td></tr>
          <tr><td>Status</td><td>${grn.po?.status || '-'}</td></tr>
          <tr><td>PO Value</td><td>${fmt(grn.po?.grand_total)}</td></tr>
        </table>
        ${(grn.po?.approval_history || []).length > 0 ? `<table class="kv" style="margin-top:4px">${historyRows(grn.po.approval_history)}</table>` : ''}
      </div>
    `;

    const allQCComplete = (grn.items || []).length > 0 && (grn.items || []).every(i => i.qc_status === 'Completed');
    const anyQC = (grn.items || []).some(i => i.qc_status);
    const qcBlock = `
      <div class="approval-box">
        <div class="approval-title">3. Quality Inspection</div>
        <table class="kv">
          <tr><td>Overall Status</td><td>${!anyQC ? 'Not yet inspected' : (allQCComplete ? 'All items cleared' : 'In progress / partially cleared')}</td></tr>
          <tr><td>Total Received</td><td>${totalReceived}</td></tr>
          <tr><td>Total Passed (Accepted Stock)</td><td>${totalPassed}</td></tr>
        </table>
        <p class="muted small">See item-wise QC result in the table below. Items not requiring QC (per material setting) are marked Cleared automatically.</p>
      </div>
    `;

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${grn.grn_number}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 12px; margin: 0; }
          h1 { font-size: 18px; margin: 0 0 2px 0; }
          .muted { color: #666; }
          .small { font-size: 11px; }
          .center { text-align: center; }
          .right { text-align: right; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #222; padding-bottom: 10px; margin-bottom: 14px; }
          .header .tag { display:inline-block; background:#222; color:#fff; padding:2px 8px; border-radius:3px; font-size:11px; }
          .letterhead { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid #1a4d8f; padding-bottom: 8px; margin-bottom: 10px; }
          .letterhead img { height: 45px; max-width: 110px; object-fit: contain; }
          .company-name { font-size: 16px; font-weight: bold; color: #1a4d8f; }
          .company-sub { font-size: 10px; color: #555; }
          .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
          .approval-box { border: 1px solid #bbb; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; break-inside: avoid; }
          .muted-box { background: #f7f7f7; }
          .approval-title { font-weight: bold; font-size: 12.5px; margin-bottom: 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
          table.kv { width: 100%; border-collapse: collapse; }
          table.kv td { padding: 2px 4px; vertical-align: top; font-size: 11.5px; }
          table.kv td:first-child { width: 38%; color: #555; }
          table.items { width: 100%; border-collapse: collapse; margin-top: 6px; }
          table.items th, table.items td { border: 1px solid #ccc; padding: 5px 6px; font-size: 11px; }
          table.items th { background: #f0f0f0; text-align: left; }
          .qc-tag { padding: 1px 7px; border-radius: 10px; font-size: 10px; color: #fff; }
          .qc-pass { background: #1e8e3e; }
          .qc-partial { background: #b8860b; }
          .qc-pending { background: #888; }
          .sign-row { display: flex; justify-content: space-between; margin-top: 40px; }
          .sign-box { width: 30%; border-top: 1px solid #333; text-align: center; padding-top: 4px; font-size: 11px; }
          .footer-note { margin-top: 16px; font-size: 10px; color: #888; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="letterhead">
          ${company.logo_data_url ? `<img src="${company.logo_data_url}">` : ''}
          <div>
            <div class="company-name">${company.company_name || 'Your Company Name'}</div>
            <div class="company-sub">${[company.address, company.city, company.state, company.postal_code].filter(Boolean).join(', ')}</div>
            <div class="company-sub">${[company.gstin && 'GSTIN: ' + company.gstin, company.phone, company.email].filter(Boolean).join(' | ')}</div>
          </div>
        </div>

        <div class="header">
          <div>
            <h1>GOODS RECEIPT NOTE</h1>
            <div class="muted">Complete cycle record: Indent → PO → GRN → Quality → Accepted Stock</div>
          </div>
          <div style="text-align:right">
            <div><strong>${grn.grn_number}</strong></div>
            <div class="muted small">Received: ${dt(grn.grn_date)}</div>
            <div class="muted small">Warehouse: ${grn.warehouse?.warehouse_name || '-'}</div>
            <div class="muted small">Prepared by: ${grn.created_by_name || '-'}</div>
          </div>
        </div>

        ${indentBlock}
        ${poBlock}
        ${qcBlock}

        <div class="approval-title" style="margin-top:14px">Items Received</div>
        <table class="items">
          <thead>
            <tr>
              <th>#</th><th>Material</th><th>Received</th><th>Rejected at Dock</th>
              <th>QC Passed</th><th>QC Hold</th><th>QC Rejected</th><th>QC Status</th><th>Batch / Heat / Coil / Serial</th>
            </tr>
          </thead>
          <tbody>${itemRows || '<tr><td colspan="9" class="center">No items</td></tr>'}</tbody>
        </table>

        ${grn.notes ? `<p class="small"><strong>GRN Notes:</strong> ${grn.notes}</p>` : ''}

        <div class="sign-row">
          <div class="sign-box">Store Keeper</div>
          <div class="sign-box">Quality Inspector</div>
          <div class="sign-box">Authorized Signatory</div>
        </div>

        <div class="footer-note">Printed ${new Date().toLocaleString('en-IN')} — SAKAAR ERP</div>

        <script>window.onload = () => { window.print(); };</script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print this GRN.');
      return;
    }
    printWindow.document.write(printHtml);
    printWindow.document.close();
  }
};
