const InvoicesPage = {
  render: async () => {
    return `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="fas fa-file-invoice me-2"></i>Vendor Invoices & Payments</h2>
          <p class="text-muted">Invoices are recorded automatically when a GRN is completed. Process payments here.</p>
        </div>
        <div class="col-md-4 text-end">
          <button class="btn btn-outline-primary" onclick="InvoiceModal.show()">
            <i class="fas fa-plus me-2"></i>Manual Invoice
          </button>
        </div>
      </div>

      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th>Invoice Number</th>
                  <th>PO Number</th>
                  <th>Vendor</th>
                  <th>Invoice Date</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="invoicesList">
                <tr><td colspan="10" class="text-center text-muted py-4">Loading invoices...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Manual Invoice Modal -->
      <div class="modal fade" id="invoiceModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Create Vendor Invoice</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="invoiceForm" onsubmit="InvoiceModal.submit(event)">
              <div class="modal-body">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Purchase Order *</label>
                    <select class="form-control" id="invoicePOSelect" required onchange="InvoiceModal.loadPOInfo()">
                      <option value="">Select PO</option>
                    </select>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Vendor *</label>
                    <input type="text" class="form-control" id="invoiceVendor" disabled>
                    <input type="hidden" id="invoiceVendorId">
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Invoice Date *</label>
                    <input type="date" class="form-control" id="invoiceDate" required>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Due Date</label>
                    <input type="date" class="form-control" id="dueDate">
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Amount</label>
                    <input type="number" class="form-control" id="invoiceAmount" step="0.01" onchange="InvoiceModal.calculateTotal()">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Tax Amount</label>
                    <input type="number" class="form-control" id="invoiceTax" step="0.01" value="0" onchange="InvoiceModal.calculateTotal()">
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Total Amount</label>
                  <input type="number" class="form-control" id="invoiceTotal" step="0.01" disabled>
                </div>

                <div class="mb-3">
                  <label class="form-label">Notes</label>
                  <textarea class="form-control" id="invoiceNotes" rows="2"></textarea>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Create Invoice</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Payment Voucher Modal -->
      <div class="modal fade" id="voucherModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Process Payment Voucher</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="voucherForm" onsubmit="InvoiceModal.submitVoucher(event)">
              <div class="modal-body">
                <input type="hidden" id="voucherInvoiceId">
                <p><strong>Invoice:</strong> <span id="voucherInvoiceNumber"></span></p>
                <p><strong>Outstanding Balance:</strong> <span id="voucherBalance"></span></p>

                <div class="mb-3">
                  <label class="form-label">Payment Amount *</label>
                  <input type="number" class="form-control" id="voucherAmount" step="0.01" min="0.01" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Payment Date *</label>
                  <input type="date" class="form-control" id="voucherDate" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Payment Mode *</label>
                  <select class="form-control" id="voucherMode" required>
                    <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">Reference / Transaction No.</label>
                  <input type="text" class="form-control" id="voucherReference">
                </div>
                <div class="mb-3">
                  <label class="form-label">Remarks</label>
                  <textarea class="form-control" id="voucherRemarks" rows="2"></textarea>
                </div>

                <div id="voucherHistory"></div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  init: async () => {
    await InvoiceModal.loadInvoices();
    await InvoiceModal.loadPOs();
  }
};

const InvoiceModal = {
  modal: null,
  voucherModal: null,

  show: () => {
    InvoiceModal.modal = new bootstrap.Modal(document.getElementById('invoiceModal'));
    document.getElementById('invoiceForm').reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('invoiceDate').value = today;
    InvoiceModal.modal.show();
  },

  loadPOs: async () => {
    const pos = await API.getPurchaseOrders() || [];
    const eligible = pos.filter(p => ['Approved', 'Partially Received', 'Received'].includes(p.status));
    const select = document.getElementById('invoicePOSelect');
    if (select) {
      select.innerHTML = '<option value="">Select PO</option>' + eligible.map(po =>
        `<option value="${po.id}" data-vendor-id="${po.vendor_id}" data-vendor="${po.vendor_name}" data-amount="${po.grand_total}">${po.po_number} - ${po.vendor_name}</option>`
      ).join('');
    }
  },

  loadPOInfo: () => {
    const select = document.getElementById('invoicePOSelect');
    const option = select.options[select.selectedIndex];
    if (option.value) {
      document.getElementById('invoiceVendor').value = option.dataset.vendor;
      document.getElementById('invoiceVendorId').value = option.dataset.vendorId;
      document.getElementById('invoiceAmount').value = parseFloat(option.dataset.amount);
      InvoiceModal.calculateTotal();
    }
  },

  calculateTotal: () => {
    const amount = parseFloat(document.getElementById('invoiceAmount').value) || 0;
    const tax = parseFloat(document.getElementById('invoiceTax').value) || 0;
    document.getElementById('invoiceTotal').value = (amount + tax).toFixed(2);
  },

  submit: async (event) => {
    event.preventDefault();
    const poId = document.getElementById('invoicePOSelect').value;
    if (!poId) {
      alert('Please select a PO');
      return;
    }

    const data = {
      po_id: parseInt(poId),
      vendor_id: parseInt(document.getElementById('invoiceVendorId').value),
      invoice_date: document.getElementById('invoiceDate').value,
      due_date: document.getElementById('dueDate').value,
      total_amount: parseFloat(document.getElementById('invoiceAmount').value) || 0,
      tax_amount: parseFloat(document.getElementById('invoiceTax').value) || 0,
      grand_total: parseFloat(document.getElementById('invoiceTotal').value) || 0,
      notes: document.getElementById('invoiceNotes').value
    };

    const result = await API.createInvoice(data);
    if (result && !result.error) {
      InvoiceModal.modal.hide();
      await InvoiceModal.loadInvoices();
      alert('Invoice created successfully');
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  loadInvoices: async () => {
    const invoices = await API.getInvoices();
    if (!Array.isArray(invoices)) {
      document.getElementById('invoicesList').innerHTML = '<tr><td colspan="10" class="text-center text-danger py-4">Could not load invoices.</td></tr>';
      return;
    }

    const html = invoices.length > 0
      ? invoices.map(inv => {
          const balance = parseFloat(inv.grand_total) - parseFloat(inv.paid_amount || 0);
          const statusColor = inv.status === 'Paid' ? 'success' : inv.status === 'Partially Paid' ? 'info' : 'warning';
          return `
            <tr>
              <td><strong>${inv.invoice_number}</strong></td>
              <td>${inv.po_number || '-'}</td>
              <td>${inv.vendor_name || '-'}</td>
              <td>${new Date(inv.invoice_date).toLocaleDateString('en-IN')}</td>
              <td>${inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN') : '-'}</td>
              <td>₹${parseFloat(inv.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td>₹${parseFloat(inv.paid_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td>₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td><span class="badge bg-${statusColor}">${inv.status}</span></td>
              <td>
                ${inv.status !== 'Paid' ? `<button class="btn btn-sm btn-primary" onclick="InvoiceModal.openVoucher(${inv.id})">Process Payment</button>` : '<span class="text-muted small">Settled</span>'}
              </td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="10" class="text-center text-muted">No invoices yet — they appear automatically once a GRN is completed</td></tr>';

    document.getElementById('invoicesList').innerHTML = html;
  },

  openVoucher: async (invoiceId) => {
    const invoice = await API.getInvoiceDetail(invoiceId);
    if (!invoice || invoice.error) {
      alert('Could not load this invoice');
      return;
    }

    const balance = parseFloat(invoice.grand_total) - parseFloat(invoice.paid_amount || 0);
    document.getElementById('voucherForm').reset();
    document.getElementById('voucherInvoiceId').value = invoiceId;
    document.getElementById('voucherInvoiceNumber').textContent = `${invoice.invoice_number} (${invoice.vendor_name})`;
    document.getElementById('voucherBalance').textContent = `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    document.getElementById('voucherAmount').max = balance;
    document.getElementById('voucherAmount').value = balance;
    document.getElementById('voucherDate').value = new Date().toISOString().split('T')[0];

    const vouchers = invoice.vouchers || [];
    document.getElementById('voucherHistory').innerHTML = vouchers.length > 0
      ? `<hr><p class="small text-muted mb-1">Previous payments</p>` + vouchers.map(v => `
          <div class="small border-bottom py-1">
            ${v.voucher_number} — ₹${parseFloat(v.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            via ${v.payment_mode} on ${new Date(v.payment_date).toLocaleDateString('en-IN')}
            ${v.reference_number ? `(Ref: ${v.reference_number})` : ''}
          </div>
        `).join('')
      : '';

    InvoiceModal.voucherModal = new bootstrap.Modal(document.getElementById('voucherModal'));
    InvoiceModal.voucherModal.show();
  },

  submitVoucher: async (event) => {
    event.preventDefault();
    const invoiceId = document.getElementById('voucherInvoiceId').value;
    const data = {
      amount: parseFloat(document.getElementById('voucherAmount').value),
      payment_date: document.getElementById('voucherDate').value,
      payment_mode: document.getElementById('voucherMode').value,
      reference_number: document.getElementById('voucherReference').value,
      remarks: document.getElementById('voucherRemarks').value
    };

    const result = await API.createPaymentVoucher(invoiceId, data);
    if (result && !result.error) {
      InvoiceModal.voucherModal.hide();
      alert(result.message || 'Payment recorded');
      await InvoiceModal.loadInvoices();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};
