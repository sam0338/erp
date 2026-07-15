const PurchaseOrdersPage = {
  render: async () => {
    return `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="fas fa-file-contract me-2"></i>Purchase Orders</h2>
        </div>
        <div class="col-md-4 text-end">
          <button class="btn btn-primary" onclick="POModal.show()">
            <i class="fas fa-plus me-2"></i>Create PO
          </button>
        </div>
      </div>

      <div class="card border-0 shadow-sm mb-3" id="poRequestsCard" style="display:none">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0"><i class="fas fa-unlock-keyhole me-2"></i>PO Edit/Delete Requests</h6>
            <button class="btn btn-sm btn-outline-secondary" onclick="POModal.loadChangeRequests()">Refresh</button>
          </div>
          <div class="table-responsive">
            <table class="table table-sm mb-0">
              <thead class="table-light">
                <tr><th>PO</th><th>Request</th><th>By</th><th>Reason</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody id="poChangeRequestsList">
                <tr><td colspan="6" class="text-muted text-center">Loading requests...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th>PO Number</th>
                  <th>Vendor</th>
                  <th>PO Date</th>
                  <th>Expected Delivery</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="posList">
                <tr><td colspan="7" class="text-center text-muted py-4">Loading purchase orders...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- PO Modal -->
      <div class="modal fade" id="poModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="poModalTitle">Create Purchase Order</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="poForm" onsubmit="POModal.submit(event)">
              <div class="modal-body">
                <div class="row mb-3">
                  <div class="col-md-6">
                    <label class="form-label">Vendor *</label>
                    <select class="form-control" id="vendorSelect" required>
                      <option value="">Select Vendor</option>
                    </select>
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Expected Delivery Date</label>
                    <input type="date" class="form-control" id="expectedDelivery">
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Category</label>
                    <input type="text" class="form-control" id="poCategory" placeholder="e.g. HE">
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Notes</label>
                  <textarea class="form-control" id="poNotes" rows="2"></textarea>
                </div>

                <div class="card mb-3">
                  <div class="card-header py-2"><strong><i class="fas fa-clipboard-list me-1"></i>Commercial Terms</strong></div>
                  <div class="card-body py-2">
                    <div class="row">
                      <div class="col-md-3 mb-2">
                        <label class="form-label small mb-0">Our Rates</label>
                        <input type="text" class="form-control form-control-sm" id="termOurRates" placeholder="e.g. FOR">
                      </div>
                      <div class="col-md-3 mb-2">
                        <label class="form-label small mb-0">Inspection</label>
                        <input type="text" class="form-control form-control-sm" id="termInspection" placeholder="e.g. Buyer">
                      </div>
                      <div class="col-md-3 mb-2">
                        <label class="form-label small mb-0">P &amp; F</label>
                        <input type="text" class="form-control form-control-sm" id="termPackingForwarding" placeholder="e.g. Inclusive">
                      </div>
                      <div class="col-md-3 mb-2">
                        <label class="form-label small mb-0">Payment Term</label>
                        <input type="text" class="form-control form-control-sm" id="termPaymentTerm" placeholder="e.g. 100% against PO">
                      </div>
                      <div class="col-md-3 mb-2">
                        <label class="form-label small mb-0">Insurance</label>
                        <input type="text" class="form-control form-control-sm" id="termInsurance" placeholder="e.g. Buyer">
                      </div>
                      <div class="col-md-3 mb-2">
                        <label class="form-label small mb-0">Freight</label>
                        <input type="text" class="form-control form-control-sm" id="termFreight" placeholder="e.g. Paid">
                      </div>
                      <div class="col-md-3 mb-2">
                        <label class="form-label small mb-0">Destination</label>
                        <input type="text" class="form-control form-control-sm" id="termDestination">
                      </div>
                      <div class="col-md-3 mb-2">
                        <label class="form-label small mb-0">Transporter</label>
                        <input type="text" class="form-control form-control-sm" id="termTransporter" placeholder="e.g. Any Reliable">
                      </div>
                    </div>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Special Remarks</label>
                  <textarea class="form-control" id="poSpecialRemarks" rows="3" placeholder="Any product-specific notes, standards referenced, warranty terms, etc. — printed on the PO."></textarea>
                </div>

                <div class="mb-3">
                  <h6>PO Items</h6>
                  <div id="poItemsContainer"></div>
                  <button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick="POModal.addItem()">
                    <i class="fas fa-plus me-1"></i>Add Item
                  </button>
                </div>

                <div class="border-top pt-3">
                  <div class="row">
                    <div class="col-md-8 text-end">
                      <h6>Total Amount:</h6>
                    </div>
                    <div class="col-md-4">
                      <h6 id="totalAmount">₹0.00</h6>
                    </div>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <input type="hidden" id="poId">
                <button type="submit" class="btn btn-primary" id="poSubmitButton">Create PO</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- PO Details Modal -->
      <div class="modal fade" id="poDetailsModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="poDetailsTitle">PO Details</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div id="poDetailsContent">Loading...</div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
              <button type="button" class="btn btn-primary" onclick="POModal.printPO()">
                <i class="fas fa-print me-1"></i>Print
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  init: async () => {
    await POModal.loadVendors();
    await POModal.loadChangeRequests();
    await POModal.loadPOs();
  }
};

const POModal = {
  modal: null,
  poItemCount: 0,
  materials: [],
  currentPO: null,
  changeRequests: [],

  show: () => {
    POModal.modal = new bootstrap.Modal(document.getElementById('poModal'));
    document.getElementById('poForm').reset();
    document.getElementById('poId').value = '';
    document.getElementById('poModalTitle').textContent = 'Create Purchase Order';
    document.getElementById('poSubmitButton').textContent = 'Create PO';
    document.getElementById('poItemsContainer').innerHTML = '';
    POModal.poItemCount = 0;
    POModal.addItem();
    POModal.modal.show();
  },

  loadVendors: async () => {
    try {
      const vendors = await API.getVendors() || [];
      POModal.materials = await API.getMaterials() || [];
      
      const select = document.getElementById('vendorSelect');
      if (!select) {
        console.warn('Vendor select not found');
        return;
      }

      // Handle errors in API response
      if (vendors.error || !Array.isArray(vendors)) {
        console.error('Error loading vendors:', vendors?.error);
        select.innerHTML = '<option value="">Error loading vendors. Please refresh.</option>';
        return;
      }

      if (vendors.length === 0) {
        select.innerHTML = '<option value="">No vendors found. Please add a vendor first.</option>';
      } else {
        select.innerHTML = '<option value="">Select Vendor</option>' + vendors.map(v => 
          `<option value="${v.id}">${v.vendor_name} (${v.vendor_code})</option>`
        ).join('');
      }
    } catch (err) {
      console.error('Error in loadVendors:', err);
      const select = document.getElementById('vendorSelect');
      if (select) {
        select.innerHTML = '<option value="">Error loading vendors</option>';
      }
    }
  },

  addItem: (itemData = null) => {
    POModal.poItemCount++;
    const itemHtml = `
      <div class="card mb-2 po-item" id="poItem${POModal.poItemCount}">
        <div class="card-body">
          <div class="row">
            <div class="col-md-4">
              <label class="form-label">Material</label>
              <select class="form-control material-select" onchange="POModal.calculateTotal()" data-item="${POModal.poItemCount}">
                <option value="">Select Material</option>
                ${POModal.materials.map(m => `<option value="${m.id}" data-gst="${m.gst_rate}" ${itemData && parseInt(itemData.material_id) === parseInt(m.id) ? 'selected' : ''}>${m.material_name}</option>`).join('')}
              </select>
            </div>
            <div class="col-md-2">
              <label class="form-label">Qty</label>
              <input type="number" class="form-control qty-input" step="0.01" value="${itemData ? itemData.quantity : 1}" onchange="POModal.calculateTotal()" data-item="${POModal.poItemCount}">
            </div>
            <div class="col-md-2">
              <label class="form-label">Unit Price</label>
              <input type="number" class="form-control price-input" step="0.01" value="${itemData ? itemData.unit_price : 0}" onchange="POModal.calculateTotal()" data-item="${POModal.poItemCount}">
            </div>
            <div class="col-md-2">
              <label class="form-label">Tax %</label>
              <input type="number" class="form-control tax-input" step="0.01" value="${itemData ? (itemData.tax_rate || 0) : 0}" onchange="POModal.calculateTotal()" data-item="${POModal.poItemCount}">
            </div>
            <div class="col-md-2">
              <label class="form-label">&nbsp;</label>
              <button type="button" class="btn btn-sm btn-danger w-100" onclick="POModal.removeItem(${POModal.poItemCount})">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    // BUG FIX: `innerHTML +=` forces the browser to serialize the ENTIRE
    // container back to an HTML string (including every row already
    // filled in), then re-parse the whole thing as brand-new DOM nodes.
    // A <select>'s live selection and an <input>'s live typed value only
    // exist as attributes in that serialized string if they matched the
    // ORIGINAL markup — anything the user picked/typed interactively
    // afterward isn't reflected in the attribute, so it got silently
    // reset the moment a second item was added. insertAdjacentHTML only
    // parses the NEW fragment and appends it, leaving every existing row's
    // live DOM state completely untouched.
    document.getElementById('poItemsContainer').insertAdjacentHTML('beforeend', itemHtml);
    POModal.calculateTotal();
  },

  removeItem: (itemNum) => {
    document.getElementById(`poItem${itemNum}`).remove();
    POModal.calculateTotal();
  },

  calculateTotal: () => {
    let total = 0;
    document.querySelectorAll('.po-item').forEach(item => {
      const qty = item.querySelector('.qty-input').value || 0;
      const price = item.querySelector('.price-input').value || 0;
      total += parseFloat(qty) * parseFloat(price);
    });
    document.getElementById('totalAmount').textContent = '₹' + total.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  },

  submit: async (event) => {
    event.preventDefault();
    const vendorId = document.getElementById('vendorSelect').value;
    if (!vendorId) {
      alert('Please select a vendor');
      return;
    }

    // BUG FIX: the item rows built by addItem()/calculateTotal() were never
    // read back out of the DOM before submitting, so every PO was created
    // with zero items (and the backend had no items table wiring for them
    // either, so this is a two-sided fix). Collect them here.
    const items = [];
    document.querySelectorAll('.po-item').forEach(item => {
      const materialId = item.querySelector('.material-select').value;
      const qty = parseFloat(item.querySelector('.qty-input').value) || 0;
      const price = parseFloat(item.querySelector('.price-input').value) || 0;
      const taxRate = parseFloat(item.querySelector('.tax-input').value) || 0;
      if (materialId && qty > 0) {
        items.push({ material_id: parseInt(materialId), quantity: qty, unit_price: price, tax_rate: taxRate });
      }
    });

    if (items.length === 0) {
      alert('Please add at least one item with a material and quantity');
      return;
    }

    const data = {
      vendor_id: parseInt(vendorId),
      po_date: new Date().toISOString().split('T')[0],
      expected_delivery_date: document.getElementById('expectedDelivery').value,
      status: 'Draft',
      notes: document.getElementById('poNotes').value,
      category: document.getElementById('poCategory').value,
      our_rates: document.getElementById('termOurRates').value,
      inspection_terms: document.getElementById('termInspection').value,
      packing_forwarding: document.getElementById('termPackingForwarding').value,
      payment_term: document.getElementById('termPaymentTerm').value,
      insurance: document.getElementById('termInsurance').value,
      freight: document.getElementById('termFreight').value,
      destination: document.getElementById('termDestination').value,
      transporter: document.getElementById('termTransporter').value,
      special_remarks: document.getElementById('poSpecialRemarks').value,
      items
    };

    const poId = document.getElementById('poId').value;
    const result = poId ? await API.updatePurchaseOrder(poId, data) : await API.createPurchaseOrder(data);
    if (!result || result.error) {
      alert('Error: ' + (result?.error || 'Failed to save PO'));
      return;
    }
    
    POModal.modal.hide();
    await POModal.loadPOs();
    await POModal.loadChangeRequests();
    alert(poId ? 'PO updated successfully' : `PO created successfully: ${result.po_number}`);
  },

  loadPOs: async () => {
    const pos = await API.getPurchaseOrders() || [];
    const currentUser = Auth.getUser();
    const html = pos.length > 0
      ? pos.map(po => {
          const isAdmin = currentUser && currentUser.role === 'admin';
          const isCreatorDraft = currentUser && po.status === 'Draft' && parseInt(po.created_by) === parseInt(currentUser.id);
          const editGrant = POModal.changeRequests.some(r => parseInt(r.po_id) === parseInt(po.id) && r.request_type === 'edit' && r.status === 'Approved' && !r.used_at && parseInt(r.requested_by) === parseInt(currentUser?.id));
          const deleteGrant = POModal.changeRequests.some(r => parseInt(r.po_id) === parseInt(po.id) && r.request_type === 'delete' && r.status === 'Approved' && !r.used_at && parseInt(r.requested_by) === parseInt(currentUser?.id));
          const canEdit = isAdmin || isCreatorDraft || editGrant;
          const canDelete = isAdmin || isCreatorDraft || deleteGrant;
          const locked = ['Submitted', 'Approved'].includes(po.status);
          return `
          <tr>
            <td><strong>${po.po_number}</strong></td>
            <td>${po.vendor_name}</td>
            <td>${new Date(po.po_date).toLocaleDateString('en-IN')}</td>
            <td>${po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString('en-IN') : '-'}</td>
            <td>₹${parseFloat(po.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td>
              <span class="badge bg-${po.status === 'Approved' ? 'success' : po.status === 'Draft' ? 'secondary' : 'warning'}">${po.status}</span>
              ${po.status === 'Submitted' && po.required_level > 1 ? `<span class="badge bg-light text-dark border ms-1">Level ${po.current_level || 0}/${po.required_level}</span>` : ''}
            </td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="POModal.viewDetails(${po.id})">View</button>
              <button class="btn btn-sm btn-outline-secondary" onclick="POModal.printPO(${po.id})">Print</button>
              ${canEdit ? `<button class="btn btn-sm btn-outline-primary" onclick="POModal.edit(${po.id})">Edit</button>` : ''}
              ${canDelete ? `<button class="btn btn-sm btn-outline-danger" onclick="POModal.deletePO(${po.id})">Delete</button>` : ''}
              ${locked && !isAdmin && !editGrant ? `<button class="btn btn-sm btn-outline-primary" onclick="POModal.requestChange(${po.id}, 'edit')">Request Edit</button>` : ''}
              ${locked && !isAdmin && !deleteGrant ? `<button class="btn btn-sm btn-outline-danger" onclick="POModal.requestChange(${po.id}, 'delete')">Request Delete</button>` : ''}
              ${po.status === 'Draft' ? `<button class="btn btn-sm btn-outline-success" onclick="POModal.updateStatus(${po.id}, 'Submitted')">Submit</button>` : ''}
              ${po.status === 'Submitted' ? `<button class="btn btn-sm btn-outline-success" onclick="POModal.updateStatus(${po.id}, 'Approved')">Approve</button>` : ''}
              ${po.status === 'Approved' ? `<button class="btn btn-sm btn-outline-info" onclick="navigateTo('grn', ${po.id})">GRN</button>` : ''}
            </td>
          </tr>
        `;
        }).join('')
      : '<tr><td colspan="7" class="text-center text-muted">No purchase orders found</td></tr>';

    document.getElementById('posList').innerHTML = html;
  },

  viewDetails: async (poId) => {
    const po = await API.getPurchaseOrder(poId);
    if (po && !po.error) {
      POModal.currentPO = po;
      const items = po.items || [];
      const itemsHtml = items.map(item => `
        <tr>
          <td>${item.material_name}</td>
          <td>${item.quantity}</td>
          <td>₹${parseFloat(item.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td>₹${parseFloat(item.line_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td>${item.received_quantity || 0}</td>
        </tr>
      `).join('');

      const content = `
        <div class="row mb-3">
          <div class="col-md-6">
            <p><strong>PO Number:</strong> ${po.po_number}</p>
            <p><strong>Vendor:</strong> ${po.vendor_name}</p>
          </div>
          <div class="col-md-6">
            <p><strong>Status:</strong> <span class="badge bg-primary">${po.status}</span></p>
            <p><strong>Date:</strong> ${new Date(po.po_date).toLocaleDateString('en-IN')}</p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead class="table-light">
              <tr><th>Material</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Received</th></tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
        </div>
        <div class="row border-top pt-2">
          <div class="col-md-8 text-end"><strong>Grand Total:</strong></div>
          <div class="col-md-4"><strong>₹${parseFloat(po.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
        </div>
      `;

      document.getElementById('poDetailsContent').innerHTML = content;
      new bootstrap.Modal(document.getElementById('poDetailsModal')).show();
    }
  },

  edit: async (poId) => {
    const po = await API.getPurchaseOrder(poId);
    if (!po || po.error) {
      alert('Could not load this PO for editing.');
      return;
    }
    POModal.currentPO = po;
    POModal.modal = new bootstrap.Modal(document.getElementById('poModal'));
    document.getElementById('poForm').reset();
    document.getElementById('poId').value = po.id;
    document.getElementById('poModalTitle').textContent = `Edit ${po.po_number}`;
    document.getElementById('poSubmitButton').textContent = 'Save Changes';
    document.getElementById('vendorSelect').value = po.vendor_id;
    document.getElementById('expectedDelivery').value = po.expected_delivery_date ? po.expected_delivery_date.split('T')[0] : '';
    document.getElementById('poNotes').value = po.notes || '';
    document.getElementById('poCategory').value = po.category || '';
    document.getElementById('termOurRates').value = po.our_rates || '';
    document.getElementById('termInspection').value = po.inspection_terms || '';
    document.getElementById('termPackingForwarding').value = po.packing_forwarding || '';
    document.getElementById('termPaymentTerm').value = po.payment_term || '';
    document.getElementById('termInsurance').value = po.insurance || '';
    document.getElementById('termFreight').value = po.freight || '';
    document.getElementById('termDestination').value = po.destination || '';
    document.getElementById('termTransporter').value = po.transporter || '';
    document.getElementById('poSpecialRemarks').value = po.special_remarks || '';
    document.getElementById('poItemsContainer').innerHTML = '';
    POModal.poItemCount = 0;
    (po.items || []).forEach(item => POModal.addItem(item));
    if (!(po.items || []).length) POModal.addItem();
    POModal.calculateTotal();
    POModal.modal.show();
  },

  deletePO: async (poId) => {
    if (!confirm('Delete this PO? This cannot be undone.')) return;
    const result = await API.deletePurchaseOrder(poId);
    if (result && !result.error) {
      await POModal.loadPOs();
      await POModal.loadChangeRequests();
      alert(result.message || 'PO deleted successfully');
    } else {
      alert('Error: ' + ((result && result.error) || 'Could not delete PO'));
    }
  },

  requestChange: async (poId, requestType) => {
    const reason = prompt(`Why do you need to ${requestType} this PO?`);
    if (reason === null) return;
    const result = await API.requestPOChange(poId, { request_type: requestType, reason });
    if (result && !result.error) {
      await POModal.loadChangeRequests();
      await POModal.loadPOs();
      alert(result.message || 'Request sent');
    } else {
      alert('Error: ' + ((result && result.error) || 'Could not send request'));
    }
  },

  loadChangeRequests: async () => {
    const card = document.getElementById('poRequestsCard');
    const list = document.getElementById('poChangeRequestsList');
    if (!card || !list) return;
    const requests = await API.getPOChangeRequests();
    if (!Array.isArray(requests)) {
      card.style.display = 'none';
      return;
    }
    POModal.changeRequests = requests;
    const currentUser = Auth.getUser();
    const relevant = requests.filter(r => currentUser && (currentUser.role === 'admin' || r.requested_by === currentUser.id || r.status === 'Pending'));
    card.style.display = relevant.length ? '' : 'none';
    list.innerHTML = relevant.length ? relevant.map(r => {
      const canDecide = currentUser && (currentUser.role === 'admin' || (r.status === 'Pending' && parseInt(r.requested_by) !== parseInt(currentUser.id)));
      return `
        <tr>
          <td>${r.po_number}</td>
          <td><span class="badge bg-${r.request_type === 'edit' ? 'primary' : 'danger'}">${r.request_type}</span></td>
          <td>${r.requested_by_name || '-'}</td>
          <td>${r.reason || '-'}</td>
          <td><span class="badge bg-${r.status === 'Approved' ? 'success' : r.status === 'Rejected' ? 'danger' : 'warning'}">${r.status}</span></td>
          <td>
            ${canDecide && r.status === 'Pending' ? `
              <button class="btn btn-sm btn-outline-success" onclick="POModal.decideChangeRequest(${r.id}, 'Approved')">Approve</button>
              <button class="btn btn-sm btn-outline-danger" onclick="POModal.decideChangeRequest(${r.id}, 'Rejected')">Reject</button>
            ` : r.used_at ? '<span class="text-muted small">Used</span>' : '-'}
          </td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="6" class="text-center text-muted">No requests</td></tr>';
  },

  decideChangeRequest: async (requestId, status) => {
    const comments = prompt(`${status} this request? Add comments if needed:`);
    if (comments === null) return;
    const result = await API.decidePOChangeRequest(requestId, { status, comments });
    if (result && !result.error) {
      await POModal.loadChangeRequests();
      await POModal.loadPOs();
      alert(result.message || 'Request updated');
    } else {
      alert('Error: ' + ((result && result.error) || 'Could not update request'));
    }
  },

  // Feature added: there was previously no way to print a PO at all.
  // Can be called with an id (from the list "Print" button, in which case
  // it fetches fresh) or with no arguments (from inside the details modal,
  // reusing the already-loaded PO to avoid a second round trip).
  printPO: async (poId) => {
    const po = poId ? await API.getPurchaseOrder(poId) : POModal.currentPO;
    if (!po || po.error) {
      alert('Could not load this PO to print.');
      return;
    }
    const company = await API.getCompanySettings() || {};

    const items = po.items || [];
    const itemsHtml = items.map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${item.material_name || ''}</td>
        <td style="text-align:center">${item.material_grade || '-'}</td>
        <td style="text-align:right">${item.quantity}</td>
        <td style="text-align:right">₹${parseFloat(item.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right">${item.tax_rate || 0}%</td>
        <td style="text-align:right">₹${parseFloat(item.line_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    const companyAddressLine = [company.address, company.city, company.state, company.postal_code].filter(Boolean).join(', ');
    const companyContactLine = [company.phone, company.email].filter(Boolean).join(' | ');
    const approvalNote = po.required_level > 1
      ? `${po.status === 'Approved' ? 'Fully approved' : `Approval in progress: Level ${po.current_level || 0} of ${po.required_level}`}`
      : po.status;

    const vendorAddressLine = [po.vendor_address, po.vendor_city, po.vendor_state, po.vendor_postal_code].filter(Boolean).join(', ');
    const shipToAddressLine = [company.address, company.city, company.state, company.postal_code].filter(Boolean).join(', ');

    const termRow = (label, value) => `<div class="term-box"><strong>${label}</strong>${value || '-'}</div>`;

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${po.po_number}</title>
        <meta charset="utf-8">
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: Arial, Helvetica, sans-serif; color: #222; margin: 0; font-size: 12px; }
          .letterhead { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; border-bottom: 3px solid #1a4d8f; padding-bottom: 10px; margin-bottom: 10px; }
          .letterhead img { height: 90px; max-width: 220px; object-fit: contain; }
          .company-block { text-align: right; }
          .company-name { font-size: 20px; font-weight: bold; color: #1a4d8f; }
          .company-sub { font-size: 11px; color: #555; }
          h1 { font-size: 16px; margin: 14px 0 4px 0; letter-spacing: 1px; }
          .muted { color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ccc; padding: 7px 8px; font-size: 12px; }
          th { background: #f2f2f2; text-align: left; }
          .meta-row { display: flex; justify-content: space-between; background: #f7f9fc; border: 1px solid #dde3ee; border-radius: 4px; padding: 8px 12px; margin: 10px 0; font-size: 11.5px; }
          .meta-row div strong { display: block; color: #1a4d8f; font-size: 10px; text-transform: uppercase; }
          .header-grid { display: flex; justify-content: space-between; gap: 12px; margin-top: 10px; }
          .header-grid .box { flex: 1; border: 1px solid #dde3ee; border-radius: 4px; padding: 8px 12px; }
          .header-grid .box strong { display: block; color: #1a4d8f; font-size: 11px; margin-bottom: 3px; }
          .terms-box { border: 1px solid #dde3ee; border-radius: 4px; padding: 10px 12px; margin-top: 12px; }
          .terms-title { font-weight: bold; color: #1a4d8f; font-size: 12px; margin-bottom: 8px; }
          .terms-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
          .term-box strong { display: block; font-size: 10px; text-transform: uppercase; color: #555; }
          .remarks-box { border: 1px solid #dde3ee; border-radius: 4px; padding: 10px 12px; margin-top: 12px; font-size: 11.5px; white-space: pre-wrap; }
          .remarks-title { font-weight: bold; color: #1a4d8f; font-size: 12px; margin-bottom: 4px; }
          .totals { margin-top: 16px; width: 300px; margin-left: auto; }
          .totals td { border: none; padding: 4px 8px; }
          .totals tr.grand td { font-weight: bold; border-top: 2px solid #222; }
          .accepted-line { text-align: center; font-weight: bold; margin-top: 20px; }
          .sign-row { display: flex; justify-content: space-between; margin-top: 40px; }
          .sign-box { width: 30%; border-top: 1px solid #333; text-align: center; padding-top: 4px; font-size: 11px; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="letterhead">
          ${company.logo_data_url ? `<img src="${company.logo_data_url}">` : '<div></div>'}
          <div class="company-block">
            <div class="company-name">${company.company_name || 'Your Company Name'}</div>
            <div class="company-sub">${companyAddressLine}</div>
            <div class="company-sub">${company.gstin ? `GSTIN: ${company.gstin}` : ''}${companyContactLine ? ' | ' + companyContactLine : ''}</div>
          </div>
        </div>

        <h1>PURCHASE ORDER</h1>

        <div class="meta-row">
          <div><strong>PO Number</strong>${po.po_number}</div>
          <div><strong>Date</strong>${po.po_date ? new Date(po.po_date).toLocaleDateString('en-IN') : '-'}</div>
          <div><strong>Delivery Date</strong>${po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString('en-IN') : '-'}</div>
          <div><strong>Category</strong>${po.category || '-'}</div>
          <div><strong>Status</strong>${approvalNote}</div>
        </div>

        <div class="header-grid">
          <div class="box">
            <strong>Vendor (Supplier)</strong>
            ${po.vendor_name || '-'}<br>
            ${vendorAddressLine}<br>
            ${po.vendor_gstin ? `GSTIN: ${po.vendor_gstin}<br>` : ''}
            ${po.vendor_phone ? `Phone: ${po.vendor_phone}` : ''}
          </div>
          <div class="box">
            <strong>Deliver To (Ship To)</strong>
            ${company.company_name || '-'}<br>
            ${shipToAddressLine}<br>
            ${company.phone ? `Phone: ${company.phone}` : ''}
          </div>
        </div>

        <div class="terms-box">
          <div class="terms-title"><i>📋</i> COMMERCIAL TERMS</div>
          <div class="terms-grid">
            ${termRow('Our Rates', po.our_rates)}
            ${termRow('Inspection', po.inspection_terms)}
            ${termRow('P &amp; F', po.packing_forwarding)}
            ${termRow('Payment Term', po.payment_term)}
            ${termRow('Insurance', po.insurance)}
            ${termRow('Freight', po.freight)}
            ${termRow('Destination', po.destination)}
            ${termRow('Transporter', po.transporter)}
          </div>
        </div>

        <table>
          <thead>
            <tr><th>#</th><th>Description</th><th>Grade</th><th>Qty</th><th>Unit Price</th><th>Tax</th><th>Line Total</th></tr>
          </thead>
          <tbody>${itemsHtml || '<tr><td colspan="7" style="text-align:center">No items</td></tr>'}</tbody>
        </table>

        <table class="totals">
          <tr><td>Subtotal</td><td style="text-align:right">₹${parseFloat(po.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
          <tr><td>Tax</td><td style="text-align:right">₹${parseFloat(po.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
          <tr class="grand"><td>Grand Total</td><td style="text-align:right">₹${parseFloat(po.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
        </table>

        ${po.special_remarks ? `
          <div class="remarks-box">
            <div class="remarks-title">Special Remarks</div>
            ${po.special_remarks}
          </div>
        ` : ''}
        ${po.notes ? `<p class="muted" style="margin-top:8px"><strong>Notes:</strong> ${po.notes}</p>` : ''}

        <div class="accepted-line">This order is technically reviewed and accepted.</div>

        <div class="sign-row">
          <div class="sign-box">Prepared By${po.created_by_name ? `<br><strong>${po.created_by_name}</strong>` : ''}</div>
          <div class="sign-box">Approved By${po.approved_by_name ? `<br><strong>${po.approved_by_name}</strong>` : '<br><span class="muted">Pending approval</span>'}</div>
        </div>

        <script>window.onload = () => { window.print(); };</script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print this PO.');
      return;
    }
    printWindow.document.write(printHtml);
    printWindow.document.close();
  },

  updateStatus: async (poId, status) => {
    const result = await API.updatePOStatus(poId, status);
    if (result && !result.error) {
      await POModal.loadPOs();
      alert(result.message || `PO status updated to ${status}`);
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};
