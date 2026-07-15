const CompanySettingsPage = {
  render: async () => {
    return `
      <div class="row mb-4">
        <div class="col-md-12">
          <h2><i class="fas fa-building me-2"></i>Company Settings</h2>
          <p class="text-muted">These details appear as the letterhead on printed Purchase Orders and GRNs.</p>
        </div>
      </div>

      <div class="row">
        <div class="col-md-7">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <form id="companyForm" onsubmit="CompanySettingsActions.submit(event)">
                <div class="mb-3">
                  <label class="form-label">Company Logo</label>
                  <input type="file" class="form-control" id="companyLogoFile" accept="image/*" onchange="CompanySettingsActions.handleLogoUpload(event)">
                  <div class="form-text">PNG or JPG, small file size recommended. Stored with your other settings.</div>
                  <input type="hidden" id="companyLogoDataUrl">
                </div>
                <div class="mb-3">
                  <label class="form-label">Company Name *</label>
                  <input type="text" class="form-control" id="companyName" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Address</label>
                  <textarea class="form-control" id="companyAddress" rows="2"></textarea>
                </div>
                <div class="row">
                  <div class="col-md-4 mb-3">
                    <label class="form-label">City</label>
                    <input type="text" class="form-control" id="companyCity">
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">State</label>
                    <input type="text" class="form-control" id="companyState">
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Postal Code</label>
                    <input type="text" class="form-control" id="companyPostalCode">
                  </div>
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">GSTIN</label>
                    <input type="text" class="form-control" id="companyGstin">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Phone</label>
                    <input type="text" class="form-control" id="companyPhone">
                  </div>
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-control" id="companyEmail">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Website</label>
                    <input type="text" class="form-control" id="companyWebsite">
                  </div>
                </div>
                <button type="submit" class="btn btn-primary">Save Company Settings</button>
              </form>
            </div>
          </div>
        </div>

        <div class="col-md-5">
          <p class="text-muted small mb-2">Live Preview (as it appears on prints)</p>
          <div id="letterheadPreview" style="border:1px solid #ccc; border-radius:4px; padding:14px; background:#fff;"></div>
        </div>
      </div>
    `;
  },

  init: async () => {
    const currentUser = Auth.getUser();
    if (!currentUser || currentUser.role !== 'admin') {
      document.getElementById('content').innerHTML = `<div class="alert alert-danger">You don't have permission to view this page.</div>`;
      return;
    }
    await CompanySettingsActions.load();
  }
};

const CompanySettingsActions = {
  handleLogoUpload: (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('companyLogoDataUrl').value = e.target.result;
      CompanySettingsActions.renderPreview();
    };
    reader.readAsDataURL(file);
  },

  load: async () => {
    const company = await API.getCompanySettings();
    if (company && !company.error) {
      document.getElementById('companyName').value = company.company_name || '';
      document.getElementById('companyAddress').value = company.address || '';
      document.getElementById('companyCity').value = company.city || '';
      document.getElementById('companyState').value = company.state || '';
      document.getElementById('companyPostalCode').value = company.postal_code || '';
      document.getElementById('companyGstin').value = company.gstin || '';
      document.getElementById('companyPhone').value = company.phone || '';
      document.getElementById('companyEmail').value = company.email || '';
      document.getElementById('companyWebsite').value = company.website || '';
      document.getElementById('companyLogoDataUrl').value = company.logo_data_url || '';
    }
    CompanySettingsActions.renderPreview();
  },

  renderPreview: () => {
    const logo = document.getElementById('companyLogoDataUrl').value;
    const name = document.getElementById('companyName').value || 'Your Company Name';
    const address = document.getElementById('companyAddress').value || '';
    const city = document.getElementById('companyCity').value || '';
    const state = document.getElementById('companyState').value || '';
    const postal = document.getElementById('companyPostalCode').value || '';
    const gstin = document.getElementById('companyGstin').value || '';
    const phone = document.getElementById('companyPhone').value || '';
    const email = document.getElementById('companyEmail').value || '';

    document.getElementById('letterheadPreview').innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; border-bottom:2px solid #222; padding-bottom:10px;">
        ${logo ? `<img src="${logo}" style="height:50px; max-width:120px; object-fit:contain">` : ''}
        <div>
          <div style="font-size:18px; font-weight:bold; color:#1a4d8f;">${name}</div>
          <div style="font-size:11px; color:#555;">${[address, city, state, postal].filter(Boolean).join(', ')}</div>
          <div style="font-size:11px; color:#555;">${[gstin && 'GSTIN: ' + gstin, phone, email].filter(Boolean).join(' | ')}</div>
        </div>
      </div>
    `;
  },

  submit: async (event) => {
    event.preventDefault();
    const data = {
      company_name: document.getElementById('companyName').value,
      address: document.getElementById('companyAddress').value,
      city: document.getElementById('companyCity').value,
      state: document.getElementById('companyState').value,
      postal_code: document.getElementById('companyPostalCode').value,
      gstin: document.getElementById('companyGstin').value,
      phone: document.getElementById('companyPhone').value,
      email: document.getElementById('companyEmail').value,
      website: document.getElementById('companyWebsite').value,
      logo_data_url: document.getElementById('companyLogoDataUrl').value
    };

    const result = await API.updateCompanySettings(data);
    if (result && !result.error) {
      alert('Company settings saved. New prints will use this letterhead.');
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};

// Bind live-preview to every input on this form as the user types.
document.addEventListener('input', (e) => {
  if (e.target.closest && e.target.closest('#companyForm')) {
    CompanySettingsActions.renderPreview();
  }
});
