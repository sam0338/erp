const DashboardPage = {
  render: async () => {
    const user = Auth.getUser();
    return `
      <div id="dashboardBrandHeader" class="dashboard-brand-header">
        <div class="dashboard-brand-logo-fallback" id="dashBrandLogoFallback"><i class="fas fa-industry"></i></div>
        <img id="dashBrandLogo" src="" alt="Logo" class="dashboard-brand-logo" style="display:none;">
        <div>
          <div class="dashboard-brand-name" id="dashBrandName">SAKAAR ERP</div>
          <div class="dashboard-brand-sub">Welcome back, ${user?.full_name || 'User'} — here's where things stand today.</div>
        </div>
      </div>

      <div class="row">
        <div class="col-md-3 mb-4">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <p class="text-muted mb-2 small">Total Vendors</p>
                  <h3 id="vendorCount" class="mb-0">-</h3>
                </div>
                <i class="fas fa-handshake text-primary fa-2x opacity-50"></i>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-3 mb-4">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <p class="text-muted mb-2 small">Active POs</p>
                  <h3 id="poCount" class="mb-0">-</h3>
                </div>
                <i class="fas fa-file-contract text-success fa-2x opacity-50"></i>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-3 mb-4">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <p class="text-muted mb-2 small">Pending Invoices</p>
                  <h3 id="invoiceCount" class="mb-0">-</h3>
                </div>
                <i class="fas fa-file-invoice text-warning fa-2x opacity-50"></i>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-3 mb-4">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <p class="text-muted mb-2 small">Materials</p>
                  <h3 id="materialCount" class="mb-0">-</h3>
                </div>
                <i class="fas fa-boxes text-info fa-2x opacity-50"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row mt-4">
        <div class="col-md-6">
          <div class="card border-0 shadow-sm">
            <div class="card-header bg-light">
              <h6 class="mb-0"><i class="fas fa-chart-bar me-2"></i>Recent Purchase Orders</h6>
            </div>
            <div class="card-body">
              <div id="recentPOs" class="small">Loading...</div>
            </div>
          </div>
        </div>

        <div class="col-md-6">
          <div class="card border-0 shadow-sm">
            <div class="card-header bg-light">
              <h6 class="mb-0"><i class="fas fa-exclamation-circle me-2"></i>Pending Approvals</h6>
            </div>
            <div class="card-body">
              <div id="pendingApprovals" class="small">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  loadBranding: async () => {
    try {
      const company = await API.getCompanySettings();
      if (!company || company.error) return;
      if (company.company_name) {
        const nameEl = document.getElementById('dashBrandName');
        if (nameEl) nameEl.textContent = company.company_name;
      }
      if (company.logo_data_url) {
        const logo = document.getElementById('dashBrandLogo');
        const fallback = document.getElementById('dashBrandLogoFallback');
        if (logo) { logo.src = company.logo_data_url; logo.style.display = 'block'; }
        if (fallback) fallback.style.display = 'none';
      }
    } catch (err) {
      console.warn('Could not load company branding:', err);
    }
  },

  init: async () => {
    DashboardPage.loadBranding();
    const vendors = await API.getVendors() || [];
    const pos = await API.getPurchaseOrders() || [];
    const invoices = await API.getInvoices() || [];
    const materials = await API.getMaterials() || [];

    document.getElementById('vendorCount').textContent = vendors.length || 0;
    document.getElementById('poCount').textContent = pos.filter(p => ['Draft', 'Pending Approval', 'Approved'].includes(p.status)).length || 0;
    document.getElementById('invoiceCount').textContent = invoices.filter(i => i.status === 'Pending').length || 0;
    document.getElementById('materialCount').textContent = materials.length || 0;

    // Recent POs
    const recentPOs = pos.slice(0, 5);
    const posHtml = recentPOs.length > 0
      ? recentPOs.map(po => `
          <div class="d-flex justify-content-between py-2 border-bottom">
            <span><strong>${po.po_number}</strong><br><small class="text-muted">${po.vendor_name}</small></span>
            <span class="badge bg-${po.status === 'Approved' ? 'success' : 'warning'}">${po.status}</span>
          </div>
        `).join('')
      : '<p class="text-muted">No purchase orders yet</p>';

    document.getElementById('recentPOs').innerHTML = posHtml;

    // Pending approvals
    const pendingPOs = pos.filter(p => p.status === 'Pending Approval');
    const approvalsHtml = pendingPOs.length > 0
      ? pendingPOs.map(po => `
          <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
            <div>
              <strong>${po.po_number}</strong><br>
              <small class="text-muted">₹${parseFloat(po.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</small>
            </div>
            <button class="btn btn-sm btn-success" onclick="ApprovePOModal.show(${po.id})">Approve</button>
          </div>
        `).join('')
      : '<p class="text-muted">No pending approvals</p>';

    document.getElementById('pendingApprovals').innerHTML = approvalsHtml;
  }
};
