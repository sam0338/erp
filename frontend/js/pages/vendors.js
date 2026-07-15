const VendorsPage = {
  render: async () => {
    return `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="fas fa-handshake me-2"></i>Vendors</h2>
        </div>
        <div class="col-md-4 text-end">
          <button class="btn btn-outline-success" onclick="VendorModal.exportCSV()">
            <i class="fas fa-file-csv me-2"></i>Export
          </button>
          <button class="btn btn-primary" onclick="VendorModal.show()">
            <i class="fas fa-plus me-2"></i>Add Vendor
          </button>
        </div>
      </div>

      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-hover mb-0" id="vendorsTable">
              <thead class="table-light">
                <tr>
                  <th>Vendor Code</th>
                  <th>Vendor Name</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>GST Number</th>
                  <th>City</th>
                  <th>Rating</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="vendorsList">
                <tr><td colspan="9" class="text-center text-muted py-4">Loading vendors...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Vendor Modal -->
      <div class="modal fade" id="vendorModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="vendorModalTitle">Add Vendor</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="vendorForm" onsubmit="VendorModal.submit(event)">
              <div class="modal-body">
                <input type="hidden" id="vendorId">
                
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Vendor Code</label>
                    <input type="text" class="form-control" id="vendorCode" disabled placeholder="Auto-generated on save">
                    <div class="form-text">Assigned automatically — can't be edited, to avoid duplicate or inconsistent codes.</div>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Vendor Name *</label>
                    <input type="text" class="form-control" id="vendorName" required>
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Contact Person</label>
                    <input type="text" class="form-control" id="contactPerson">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-control" id="vendorEmail">
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Phone</label>
                    <input type="tel" class="form-control" id="vendorPhone">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">City</label>
                    <input type="text" class="form-control" id="vendorCity">
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">GST Number</label>
                    <input type="text" class="form-control" id="gstNumber">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">PAN Number</label>
                    <input type="text" class="form-control" id="panNumber">
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Address</label>
                  <textarea class="form-control" id="vendorAddress" rows="2"></textarea>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Bank Name</label>
                    <input type="text" class="form-control" id="bankName">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Bank Account</label>
                    <input type="text" class="form-control" id="bankAccount">
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">IFSC Code</label>
                    <input type="text" class="form-control" id="ifscCode">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Payment Terms</label>
                    <input type="text" class="form-control" id="paymentTerms" placeholder="e.g., 30 days">
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Notes</label>
                  <textarea class="form-control" id="vendorNotes" rows="2"></textarea>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Vendor</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  init: async () => {
    await VendorModal.loadVendors();
  }
};

const VendorModal = {
  modal: null,
  currentVendors: [],

  exportCSV: () => {
    exportToCSV('vendors', [
      { key: 'vendor_code', label: 'Vendor Code' },
      { key: 'vendor_name', label: 'Vendor Name' },
      { key: 'contact_person', label: 'Contact Person' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'gst_number', label: 'GST Number' },
      { key: 'address', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'rating', label: 'Rating' }
    ], VendorModal.currentVendors);
  },

  show: (vendorId = null) => {
    VendorModal.modal = new bootstrap.Modal(document.getElementById('vendorModal'));
    document.getElementById('vendorForm').reset();
    document.getElementById('vendorId').value = '';
    document.getElementById('vendorModalTitle').textContent = 'Add Vendor';

    if (vendorId) {
      API.getVendor(vendorId).then(vendor => {
        if (!vendor.error) {
          document.getElementById('vendorId').value = vendor.id;
          document.getElementById('vendorCode').value = vendor.vendor_code;
          document.getElementById('vendorName').value = vendor.vendor_name;
          document.getElementById('contactPerson').value = vendor.contact_person || '';
          document.getElementById('vendorEmail').value = vendor.email || '';
          document.getElementById('vendorPhone').value = vendor.phone || '';
          document.getElementById('vendorCity').value = vendor.city || '';
          document.getElementById('gstNumber').value = vendor.gst_number || '';
          document.getElementById('panNumber').value = vendor.pan_number || '';
          document.getElementById('vendorAddress').value = vendor.address || '';
          document.getElementById('bankName').value = vendor.bank_name || '';
          document.getElementById('bankAccount').value = vendor.bank_account || '';
          document.getElementById('ifscCode').value = vendor.ifsc_code || '';
          document.getElementById('paymentTerms').value = vendor.payment_terms || '';
          document.getElementById('vendorNotes').value = vendor.notes || '';
          document.getElementById('vendorModalTitle').textContent = 'Edit Vendor';
        }
      });
    }

    VendorModal.modal.show();
  },

  submit: async (event) => {
    event.preventDefault();
    const vendorId = document.getElementById('vendorId').value;
    const data = {
      vendor_name: document.getElementById('vendorName').value,
      contact_person: document.getElementById('contactPerson').value,
      email: document.getElementById('vendorEmail').value,
      phone: document.getElementById('vendorPhone').value,
      city: document.getElementById('vendorCity').value,
      gst_number: document.getElementById('gstNumber').value,
      pan_number: document.getElementById('panNumber').value,
      address: document.getElementById('vendorAddress').value,
      bank_name: document.getElementById('bankName').value,
      bank_account: document.getElementById('bankAccount').value,
      ifsc_code: document.getElementById('ifscCode').value,
      payment_terms: document.getElementById('paymentTerms').value,
      notes: document.getElementById('vendorNotes').value
    };

    const result = vendorId
      ? await API.updateVendor(vendorId, data)
      : await API.createVendor(data);

    if (result && !result.error) {
      VendorModal.modal.hide();
      await VendorModal.loadVendors();
      alert(result.message || (vendorId ? 'Vendor updated successfully' : 'Vendor created successfully'));
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  loadVendors: async () => {
    try {
      const vendors = await API.getVendors() || [];
      VendorModal.currentVendors = Array.isArray(vendors) ? vendors : [];

      // Handle JSON parsing errors and API errors
      if (!vendors || vendors.error) {
        console.error('Error loading vendors:', vendors?.error);
        document.getElementById('vendorsList').innerHTML = '<tr><td colspan="9" class="text-center text-danger"><i class="fas fa-exclamation-circle"></i> Error loading vendors. Please refresh.</td></tr>';
        return;
      }

      const html = vendors.length > 0
        ? vendors.map(v => `
            <tr>
              <td><strong>${v.vendor_code}</strong></td>
              <td>${v.vendor_name}</td>
              <td>${v.contact_person || '-'}</td>
              <td>${v.email || '-'}</td>
              <td>${v.phone || '-'}</td>
              <td>${v.gst_number || '-'}</td>
              <td>${v.city || '-'}</td>
              <td><span class="badge bg-warning">${(v.rating || 5).toFixed(1)} ⭐</span></td>
              <td>
                <button class="btn btn-sm btn-outline-primary" onclick="VendorModal.show(${v.id})">Edit</button>
                <button class="btn btn-sm btn-outline-danger" onclick="VendorModal.delete(${v.id})">Delete</button>
              </td>
            </tr>
          `).join('')
        : '<tr><td colspan="9" class="text-center text-muted">No vendors found. Click "Add Vendor" to create one.</td></tr>';

      document.getElementById('vendorsList').innerHTML = html;
    } catch (err) {
      console.error('Error loading vendors:', err);
      document.getElementById('vendorsList').innerHTML = '<tr><td colspan="9" class="text-center text-danger"><i class="fas fa-exclamation-circle"></i> Error: ' + err.message + '</td></tr>';
    }
  },

  delete: async (vendorId) => {
    if (confirm('Are you sure you want to deactivate this vendor?')) {
      const result = await API.deleteVendor(vendorId);
      if (!result.error) {
        await VendorModal.loadVendors();
        alert('Vendor deactivated successfully');
      }
    }
  }
};
