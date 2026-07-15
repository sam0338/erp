const App = {
  currentPage: 'dashboard',
  currentPageParams: null,
  licenseStatus: null,

  init: () => {
    if (Auth.isAuthenticated()) {
      App.showApp();
      App.startSession();
    } else {
      App.showLogin();
    }
  },

  // Runs once after the sidebar/shell is up: checks the license before
  // deciding whether to open the dashboard or a blocking "renew your
  // license" screen. Admins always get through (so there's always a way
  // to fix an expired license from inside the app); everyone else is
  // stopped here rather than discovering it piecemeal as every API call
  // starts failing with a 402.
  startSession: async () => {
    const user = Auth.getUser();
    try {
      App.licenseStatus = await API.getLicenseStatus();
    } catch (_) {
      App.licenseStatus = null;
    }
    // The token looked present locally but the server doesn't recognize
    // it (expired, or points at a user that no longer exists — see
    // Round 21). Show a plain, one-click way back to login instead of
    // guessing at a license message that doesn't apply here, and instead
    // of forcing an automatic navigation (that's what caused the reload
    // loop in the first place).
    if (App.licenseStatus && App.licenseStatus._status === 401) {
      App.showSessionEndedScreen();
      return;
    }
    const blocked = App.licenseStatus && !App.licenseStatus.valid && user && user.role !== 'admin';
    if (blocked) {
      App.showLicenseBlockedScreen();
    } else {
      App.showLicenseBannerIfNeeded();
      App.loadPage('dashboard');
    }
  },

  showSessionEndedScreen: () => {
    document.getElementById('content').innerHTML = `
      <div class="d-flex align-items-center justify-content-center" style="min-height:70vh;">
        <div class="text-center" style="max-width:480px;">
          <i class="fas fa-right-from-bracket fa-3x text-muted mb-3"></i>
          <h3>Your session has ended</h3>
          <p class="text-muted">Please log in again to continue.</p>
          <button class="btn btn-primary mt-2" onclick="logout()">Go to Login</button>
        </div>
      </div>
    `;
  },

  showLicenseBlockedScreen: () => {
    const status = App.licenseStatus || {};
    document.getElementById('content').innerHTML = `
      <div class="d-flex align-items-center justify-content-center" style="min-height:70vh;">
        <div class="text-center" style="max-width:480px;">
          <i class="fas fa-key fa-3x text-danger mb-3"></i>
          <h3>License ${status.status || 'Invalid'}</h3>
          <p class="text-muted">This installation's license has ${status.status === 'Expired' ? 'expired' : 'a problem'}. Please contact your administrator to renew it — once activated, log out and back in here.</p>
          <button class="btn btn-outline-secondary mt-2" onclick="logout()">Logout</button>
        </div>
      </div>
    `;
  },

  // A quiet reminder banner for admins only — everyone else either has a
  // valid license or is already stopped by showLicenseBlockedScreen above.
  showLicenseBannerIfNeeded: () => {
    const existing = document.getElementById('licenseBanner');
    if (existing) existing.remove();
    const status = App.licenseStatus;
    const user = Auth.getUser();
    if (!status || user?.role !== 'admin') return;
    let message = null, color = 'warning';
    if (!status.activated) { message = 'No license has been activated on this installation yet.'; }
    else if (status.status === 'Expired') { message = 'This license has expired.'; color = 'danger'; }
    else if (status.status === 'Invalid') { message = 'The activated license key is invalid.'; color = 'danger'; }
    else if (status.days_remaining !== null && status.days_remaining !== undefined && status.days_remaining <= 14) {
      message = `License expires in ${status.days_remaining} day${status.days_remaining === 1 ? '' : 's'}.`;
    }
    if (!message) return;
    const banner = document.createElement('div');
    banner.id = 'licenseBanner';
    banner.className = `alert alert-${color} rounded-0 mb-0 py-2 text-center small`;
    banner.innerHTML = `<i class="fas fa-key me-1"></i>${message} <a href="#" onclick="navigateTo('system-settings')" class="alert-link">Manage License</a>`;
    document.querySelector('.app-main').prepend(banner);
  },

  showLogin: () => {
    document.getElementById('appShell').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('app').innerHTML = `
      <div class="container">
        <div class="row justify-content-center mt-5">
          <div class="col-md-5">
            <div class="card border-0 shadow">
              <div class="card-body p-5">
                <div class="text-center mb-4">
                  <h2><i class="fas fa-industry text-primary"></i></h2>
                  <h3 class="mt-2">SAKAAR ERP</h3>
                  <p class="text-muted">MSME Solutions Platform</p>
                </div>

                <ul class="nav nav-tabs mb-3" id="authTabs">
                  <li class="nav-item flex-fill">
                    <button class="nav-link active w-100" id="loginTab" data-bs-toggle="tab" data-bs-target="#login">Login</button>
                  </li>
                  <li class="nav-item flex-fill">
                    <button class="nav-link w-100" id="registerTab" data-bs-toggle="tab" data-bs-target="#register">Register</button>
                  </li>
                </ul>

                <div class="tab-content">
                  <!-- Login Tab -->
                  <div class="tab-pane fade show active" id="login">
                    <form onsubmit="App.handleLogin(event)">
                      <div class="mb-3">
                        <label class="form-label">Username</label>
                        <input type="text" class="form-control" id="loginUsername" placeholder="admin" required>
                      </div>
                      <div class="mb-3">
                        <label class="form-label">Password</label>
                        <input type="password" class="form-control" id="loginPassword" placeholder="admin123" required>
                      </div>
                      <button type="submit" class="btn btn-primary w-100">Login</button>
                      <div class="mt-3 text-muted small">
                        <p><strong>Demo Credentials:</strong></p>
                        <p>Username: admin<br>Password: admin123</p>
                      </div>
                    </form>
                  </div>

                  <!-- Register Tab -->
                  <div class="tab-pane fade" id="register">
                    <form onsubmit="App.handleRegister(event)">
                      <div class="mb-3">
                        <label class="form-label">Full Name</label>
                        <input type="text" class="form-control" id="registerName" required>
                      </div>
                      <div class="mb-3">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-control" id="registerEmail" required>
                      </div>
                      <div class="mb-3">
                        <label class="form-label">Username</label>
                        <input type="text" class="form-control" id="registerUsername" required>
                      </div>
                      <div class="mb-3">
                        <label class="form-label">Password</label>
                        <input type="password" class="form-control" id="registerPassword" required>
                      </div>
                      <div class="mb-3">
                        <label class="form-label">Department</label>
                        <input type="text" class="form-control" id="registerDept" required>
                      </div>
                      <button type="submit" class="btn btn-primary w-100">Register</button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <p class="text-center text-muted mt-3 small">
              SAKAAR ERP v1.0 | Built for Indian MSMEs
            </p>
          </div>
        </div>
      </div>
    `;
  },

  handleLogin: async (event) => {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
      await Auth.login(username, password);
      App.showApp();
      const user = Auth.getUser();
      document.getElementById('userDisplayName').textContent = user.full_name || user.username;
      App.startSession();
    } catch (error) {
      alert('Login failed: ' + error.message);
    }
  },

  handleRegister: async (event) => {
    event.preventDefault();
    const data = {
      full_name: document.getElementById('registerName').value,
      email: document.getElementById('registerEmail').value,
      username: document.getElementById('registerUsername').value,
      password: document.getElementById('registerPassword').value,
      department: document.getElementById('registerDept').value,
      role: 'user'
    };

    try {
      await Auth.register(data);
      alert('Registration successful! Please login.');
      document.getElementById('loginTab').click();
    } catch (error) {
      alert('Registration failed: ' + error.message);
    }
  },

  showApp: () => {
    document.getElementById('app').style.display = 'none';
    document.getElementById('app').innerHTML = '';
    document.getElementById('appShell').style.display = 'flex';
    const user = Auth.getUser();
    document.getElementById('userDisplayName').textContent = user.full_name || user.username;
    // Admin-only nav item (User Management). Real enforcement happens
    // server-side via requireAdmin; this just avoids showing a link that
    // would 403 for everyone else.
    const adminNavItem = document.getElementById('adminNavItem');
    if (adminNavItem) adminNavItem.style.display = user.role === 'admin' ? '' : 'none';
    document.querySelectorAll('[data-module-nav]').forEach(item => {
      const module = item.getAttribute('data-module-nav');
      item.style.display = Auth.hasModule(module) ? '' : 'none';
    });
    App.loadBranding();
  },

  // Puts the company's name and logo (Company Settings, Admin-only to
  // edit) into the sidebar header, so the app reads as this company's
  // system rather than a generic template. Falls back to the default
  // name/icon quietly if nothing's configured yet or the call fails.
  loadBranding: async () => {
    try {
      const company = await API.getCompanySettings();
      if (!company || company.error) return;
      const nameEl = document.getElementById('sidebarCompanyName');
      if (nameEl && company.company_name) nameEl.textContent = company.company_name;
      const logoImg = document.getElementById('sidebarLogo');
      const logoFallback = document.getElementById('sidebarLogoFallback');
      if (company.logo_data_url && logoImg) {
        logoImg.src = company.logo_data_url;
        logoImg.style.display = 'block';
        if (logoFallback) logoFallback.style.display = 'none';
      }
    } catch (err) {
      console.warn('Could not load company branding:', err);
    }
  },

  // Mobile: slide the sidebar in/out. Desktop ignores this (sidebar is
  // always visible via CSS media query) so it's safe to call unconditionally.
  toggleSidebar: (force) => {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const shouldOpen = force !== undefined ? force : !sidebar.classList.contains('sidebar-open');
    sidebar.classList.toggle('sidebar-open', shouldOpen);
    if (backdrop) backdrop.classList.toggle('show', shouldOpen);
  },

  loadPage: async (page, param = null) => {
    App.currentPage = page;
    App.currentPageParams = param;

    let pageModule = null;

    switch (page) {
      case 'dashboard':
        pageModule = DashboardPage;
        break;
      case 'vendors':
        pageModule = VendorsPage;
        break;
      case 'materials':
        pageModule = MaterialsPage;
        break;
      case 'purchase-orders':
        pageModule = PurchaseOrdersPage;
        break;
      case 'grn':
        pageModule = GRNPage;
        break;
      case 'invoices':
        pageModule = InvoicesPage;
        break;
      case 'indent-employee':
        pageModule = IndentEmployeePage;
        break;
      case 'indent-approver':
        pageModule = IndentApproverPage;
        break;
      case 'indent-purchaser':
        pageModule = IndentPurchaserPage;
        break;
      case 'inventory-dashboard':
        pageModule = InventoryDashboardPage;
        break;
      case 'inventory-stock-in':
        pageModule = StockInPage;
        break;
      case 'inventory-stock-out':
        pageModule = StockOutPage;
        break;
      case 'inventory-transfer':
        pageModule = StockTransferPage;
        break;
      case 'production-planning':
        pageModule = ProductionPlanningPage;
        break;
      case 'production-recipes':
        pageModule = ProductionRecipesPage;
        break;
      case 'sales-dispatch':
        pageModule = SalesDispatchPage;
        break;
      case 'pos':
        pageModule = POSPage;
        break;
      case 'mis-reports':
        pageModule = MISPage;
        break;
      case 'finance':
        pageModule = FinancePage;
        break;
      case 'expense-claims':
        pageModule = ExpenseClaimsPage;
        break;
      case 'accounts':
        pageModule = AccountsPage;
        break;
      case 'users':
        pageModule = UsersPage;
        break;
      case 'quality':
        pageModule = QualityPage;
        break;
      case 'company-settings':
        pageModule = CompanySettingsPage;
        break;
      case 'approval-settings':
        pageModule = ApprovalSettingsPage;
        break;
      case 'system-settings':
        pageModule = SystemSettingsPage;
        break;
      case 'master-data':
        pageModule = MasterDataPage;
        break;
      case 'profile':
        pageModule = {
          render: async () => `
            <div class="row mb-4">
              <div class="col-md-8"><h2><i class="fas fa-user me-2"></i>User Profile</h2></div>
            </div>
            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <div id="profileContent">Loading...</div>
              </div>
            </div>
          `,
          init: async () => {
            const user = Auth.getUser();
            document.getElementById('profileContent').innerHTML = `
              <div class="row">
                <div class="col-md-6">
                  <p><strong>Name:</strong> ${user.full_name}</p>
                  <p><strong>Email:</strong> ${user.email}</p>
                  <p><strong>Username:</strong> ${user.username}</p>
                </div>
                <div class="col-md-6">
                  <p><strong>Role:</strong> <span class="badge bg-primary">${user.role}</span></p>
                  <p><strong>Department:</strong> ${user.department || 'N/A'}</p>
                </div>
              </div>
            `;
          }
        };
        break;
      default:
        pageModule = DashboardPage;
    }

    if (pageModule) {
      try {
        const html = await pageModule.render();
        document.getElementById('content').innerHTML = html;
        if (pageModule.init) {
          await pageModule.init();
        }
      } catch (err) {
        console.error(`Error loading page "${page}":`, err);
        document.getElementById('content').innerHTML = `
          <div class="alert alert-danger m-4">
            <h5><i class="fas fa-exclamation-triangle me-2"></i>Something went wrong loading this page</h5>
            <p class="mb-1"><strong>Page:</strong> ${page}</p>
            <p class="mb-1"><strong>Error:</strong> ${err.message || err}</p>
            <p class="small text-muted mb-0">Open the browser console (F12) for the full stack trace, or check that the server is running the latest code.</p>
          </div>
        `;
      }
    }
  }
};

// Global navigation function
function navigateTo(page, param = null) {
  App.loadPage(page, param);
  // On mobile the sidebar is an overlay — close it after picking a page
  // so the user actually sees the page they just navigated to.
  const sidebar = document.getElementById('sidebar');
  if (sidebar && sidebar.classList.contains('sidebar-open')) App.toggleSidebar(false);
}

// Global logout function
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    Auth.logout();
  }
}

// Global approve PO function
const ApprovePOModal = {
  show: (poId) => {
    if (confirm('Approve this PO?')) {
      API.approvePO(poId).then(result => {
        if (!result.error) {
          alert('PO approved successfully');
          if (App.currentPage === 'dashboard') {
            App.loadPage('dashboard');
          }
        }
      });
    }
  }
};

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', App.init);
