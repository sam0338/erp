const SystemSettingsPage = {
  render: async () => {
    return `
      <div class="row mb-4">
        <div class="col-md-12">
          <h2><i class="fas fa-cogs me-2"></i>System Settings</h2>
          <p class="text-muted">Number series, branches, financial year locking, audit trail, notification templates, and backup/restore.</p>
        </div>
      </div>

      <ul class="nav nav-tabs mb-3">
        <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#numberSeriesTab">Number Series</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#branchesTab">Branches</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#fyTab">Financial Year</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#auditTab">Audit Log</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#notifTab">Notification Templates</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#backupTab">Backup &amp; Restore</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#licenseTab">License</button></li>
      </ul>

      <div class="tab-content">

        <!-- NUMBER SERIES -->
        <div class="tab-pane fade show active" id="numberSeriesTab">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <p class="text-muted small">Controls the prefix, zero-padding, and next number for every auto-generated document number in the system.</p>
              <table class="table table-sm">
                <thead><tr><th>Document Type</th><th>Prefix</th><th>Padding</th><th>Next Number</th><th>Preview</th><th></th></tr></thead>
                <tbody id="numberSeriesList"><tr><td colspan="6" class="text-center text-muted">Loading...</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- BRANCHES -->
        <div class="tab-pane fade" id="branchesTab">
          <div class="row mb-3">
            <div class="col-md-8"><p class="text-muted small mb-0">Branch/location master used on company documents where relevant.</p></div>
            <div class="col-md-4 text-end"><button class="btn btn-primary btn-sm" onclick="BranchModal.show()"><i class="fas fa-plus me-1"></i>New Branch</button></div>
          </div>
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <table class="table table-sm">
                <thead><tr><th>Code</th><th>Name</th><th>City</th><th>GSTIN</th><th>Head Office</th><th>Status</th><th></th></tr></thead>
                <tbody id="branchesList"><tr><td colspan="7" class="text-center text-muted">Loading...</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- FINANCIAL YEAR -->
        <div class="tab-pane fade" id="fyTab">
          <div class="row mb-3">
            <div class="col-md-8"><p class="text-muted small mb-0">Lock a period once its books are closed — no PO can be dated/backdated into a locked period.</p></div>
            <div class="col-md-4 text-end"><button class="btn btn-primary btn-sm" onclick="FYModal.show()"><i class="fas fa-plus me-1"></i>New Financial Year</button></div>
          </div>
          <div id="fyList"></div>
        </div>

        <!-- AUDIT LOG -->
        <div class="tab-pane fade" id="auditTab">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="row mb-3">
                <div class="col-md-3">
                  <select class="form-control form-control-sm" id="auditModuleFilter" onchange="AuditActions.load()">
                    <option value="">All Modules</option>
                    <option value="po">Purchase Orders</option>
                    <option value="user">Users</option>
                    <option value="indent">Indents</option>
                    <option value="vendor">Vendors</option>
                  </select>
                </div>
                <div class="col-md-3">
                  <input type="date" class="form-control form-control-sm" id="auditFromDate" onchange="AuditActions.load()">
                </div>
                <div class="col-md-3">
                  <input type="date" class="form-control form-control-sm" id="auditToDate" onchange="AuditActions.load()">
                </div>
              </div>
              <table class="table table-sm">
                <thead><tr><th>When</th><th>User</th><th>Action</th><th>Module</th><th>Record</th><th>Details</th></tr></thead>
                <tbody id="auditLogList"><tr><td colspan="6" class="text-center text-muted">Loading...</td></tr></tbody>
              </table>
              <p class="text-muted small">Showing the most recent 500 entries. Currently logged: PO creation, PO approval steps, and user creation — ask if you want more event types added to the trail.</p>
            </div>
          </div>
        </div>

        <!-- NOTIFICATION TEMPLATES -->
        <div class="tab-pane fade" id="notifTab">
          <div class="alert alert-warning small">
            <strong>Heads up:</strong> these are message templates only. There's no email/SMS sending configured in
            this app yet, so nothing is dispatched automatically when these events happen — editing a template just
            changes what text would be used if/when that's wired up.
          </div>
          <div id="notifList"></div>
        </div>

        <!-- BACKUP & RESTORE -->
        <div class="tab-pane fade" id="backupTab">
          <div class="row">
            <div class="col-md-6 mb-3">
              <div class="card border-0 shadow-sm h-100">
                <div class="card-body">
                  <h5><i class="fas fa-download me-2"></i>Backup to This Computer</h5>
                  <p class="text-muted small">Downloads a complete, consistent copy of the live database file through your browser.</p>
                  <button class="btn btn-primary" onclick="BackupActions.download()">Download Backup Now</button>
                  <hr>
                  <p class="text-muted small mb-1">Or save it directly to a folder the server can reach — no browser download dialog, useful when running as a background service:</p>
                  <div class="input-group">
                    <input type="text" class="form-control" id="localBackupPath" placeholder="e.g. D:\Backups\SakaarERP or /home/user/backups">
                    <button class="btn btn-outline-primary" onclick="BackupActions.backupToPath()">Save Here</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-md-6 mb-3">
              <div class="card border-0 shadow-sm h-100">
                <div class="card-body">
                  <h5 class="text-danger"><i class="fas fa-upload me-2"></i>Restore From File</h5>
                  <p class="text-muted small">
                    <strong>Destructive.</strong> Replaces the entire live database with the uploaded file.
                    A safety copy of the current database is taken automatically first, but do this only if you're sure.
                    The server process will restart itself immediately after — everyone will be logged out.
                  </p>
                  <input type="file" class="form-control mb-2" id="restoreFile" accept=".db">
                  <input type="text" class="form-control mb-2" id="restoreConfirm" placeholder="Type RESTORE to confirm">
                  <button class="btn btn-danger" onclick="BackupActions.restore()">Restore From File</button>
                </div>
              </div>
            </div>
          </div>

          <div class="card border-0 shadow-sm mb-3">
            <div class="card-body">
              <h5><i class="fab fa-google-drive me-2"></i>Google Drive Backup</h5>
              <div id="gdriveStatus" class="mb-2 text-muted small">Loading...</div>
              <div id="gdriveConfigureBlock" class="row" style="display:none">
                <div class="col-md-5 mb-2"><input type="text" class="form-control" id="gdriveClientId" placeholder="Google OAuth Client ID"></div>
                <div class="col-md-5 mb-2"><input type="text" class="form-control" id="gdriveClientSecret" placeholder="Google OAuth Client Secret"></div>
                <div class="col-md-2 mb-2"><button class="btn btn-outline-primary w-100" onclick="BackupActions.saveGdriveCredentials()">Save</button></div>
                <div class="form-text">From your own Google Cloud Console → APIs &amp; Services → Credentials (OAuth Client ID, type "Web application"). Add this exact Authorized redirect URI: <code id="gdriveRedirectUriHint"></code></div>
              </div>
              <div id="gdriveActionsBlock" style="display:none">
                <button class="btn btn-primary btn-sm" onclick="BackupActions.connectGdrive()">Connect Google Drive</button>
                <button class="btn btn-success btn-sm" onclick="BackupActions.backupToGdriveNow()" id="gdriveBackupNowBtn" style="display:none">Backup to Google Drive Now</button>
                <button class="btn btn-outline-secondary btn-sm" onclick="BackupActions.loadGdriveBackups()" id="gdriveListBtn" style="display:none">View Backups on Drive</button>
                <button class="btn btn-outline-danger btn-sm" onclick="BackupActions.disconnectGdrive()" id="gdriveDisconnectBtn" style="display:none">Disconnect</button>
              </div>
              <div id="gdriveBackupsList" class="mt-2"></div>
            </div>
          </div>

          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <h5><i class="fas fa-clock me-2"></i>Auto-Backup Schedule</h5>
              <p class="text-muted small">Runs automatically once a day at whatever time you set below — the server just needs to be running at that time.</p>
              <div class="row align-items-end">
                <div class="col-md-2 mb-2">
                  <label class="form-label">Enabled</label>
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="scheduleEnabled" style="transform:scale(1.4)">
                  </div>
                </div>
                <div class="col-md-2 mb-2"><label class="form-label">Time of Day</label><input type="time" class="form-control" id="scheduleTime"></div>
                <div class="col-md-3 mb-2">
                  <label class="form-label">Destination</label>
                  <select class="form-control" id="scheduleDestination">
                    <option value="local">Local Folder</option>
                    <option value="gdrive">Google Drive</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div class="col-md-3 mb-2"><label class="form-label">Local Folder Path</label><input type="text" class="form-control" id="scheduleLocalPath" placeholder="D:\Backups\SakaarERP"></div>
                <div class="col-md-2 mb-2"><button class="btn btn-primary w-100" onclick="BackupActions.saveSchedule()">Save Schedule</button></div>
              </div>
              <div id="scheduleLastRun" class="text-muted small mt-2"></div>
            </div>
          </div>
        </div>

        <!-- LICENSE -->
        <div class="tab-pane fade" id="licenseTab">
          <div class="row">
            <div class="col-md-5 mb-3">
              <div class="card border-0 shadow-sm h-100">
                <div class="card-body">
                  <h5><i class="fas fa-key me-2"></i>Current License</h5>
                  <div id="licenseStatusBlock"><div class="text-muted small">Loading...</div></div>
                </div>
              </div>
            </div>
            <div class="col-md-7 mb-3">
              <div class="card border-0 shadow-sm h-100">
                <div class="card-body">
                  <h5>Activate a License Key</h5>
                  <p class="text-muted small">Paste the license key your vendor provided.</p>
                  <textarea class="form-control mb-2" id="licenseKeyInput" rows="3" placeholder="Paste license key here"></textarea>
                  <button class="btn btn-primary" onclick="LicenseActions.activate()">Activate</button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Branch Modal -->
      <div class="modal fade" id="branchModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title" id="branchModalTitle">New Branch</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
            <form id="branchForm" onsubmit="BranchModal.submit(event)">
              <div class="modal-body">
                <input type="hidden" id="branchId">
                <div class="row">
                  <div class="col-md-6 mb-2"><label class="form-label">Branch Code *</label><input type="text" class="form-control" id="branchCode" required></div>
                  <div class="col-md-6 mb-2"><label class="form-label">Branch Name *</label><input type="text" class="form-control" id="branchName" required></div>
                </div>
                <div class="mb-2"><label class="form-label">Address</label><textarea class="form-control" id="branchAddress" rows="2"></textarea></div>
                <div class="row">
                  <div class="col-md-4 mb-2"><label class="form-label">City</label><input type="text" class="form-control" id="branchCity"></div>
                  <div class="col-md-4 mb-2"><label class="form-label">State</label><input type="text" class="form-control" id="branchState"></div>
                  <div class="col-md-4 mb-2"><label class="form-label">Postal Code</label><input type="text" class="form-control" id="branchPostalCode"></div>
                </div>
                <div class="row">
                  <div class="col-md-6 mb-2"><label class="form-label">GSTIN</label><input type="text" class="form-control" id="branchGstin"></div>
                  <div class="col-md-6 mb-2"><label class="form-label">Phone</label><input type="text" class="form-control" id="branchPhone"></div>
                </div>
                <div class="form-check">
                  <input type="checkbox" class="form-check-input" id="branchIsHO">
                  <label class="form-check-label" for="branchIsHO">Head Office (only one at a time)</label>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Branch</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Financial Year Modal -->
      <div class="modal fade" id="fyModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">New Financial Year</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
            <form id="fyForm" onsubmit="FYModal.submit(event)">
              <div class="modal-body">
                <div class="mb-2"><label class="form-label">Label (e.g. 2026-27) *</label><input type="text" class="form-control" id="fyLabel" required></div>
                <div class="row">
                  <div class="col-md-6 mb-2"><label class="form-label">Start Date *</label><input type="date" class="form-control" id="fyStart" required></div>
                  <div class="col-md-6 mb-2"><label class="form-label">End Date *</label><input type="date" class="form-control" id="fyEnd" required></div>
                </div>
                <div class="form-check">
                  <input type="checkbox" class="form-check-input" id="fyMakeCurrent" checked>
                  <label class="form-check-label" for="fyMakeCurrent">Make this the current financial year</label>
                </div>
                <p class="text-muted small mt-2">12 monthly periods will be generated automatically, all unlocked.</p>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
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
    await Promise.all([
      NumberSeriesActions.load(),
      BranchModal.loadBranches(),
      FYModal.loadYears(),
      AuditActions.load(),
      NotifActions.load(),
      BackupActions.loadGdriveStatus(),
      BackupActions.loadSchedule(),
      LicenseActions.load()
    ]);
    document.getElementById('gdriveRedirectUriHint').textContent = `${window.location.origin}/api/settings/gdrive/callback`;
  }
};

// ===== NUMBER SERIES =====
const NumberSeriesActions = {
  load: async () => {
    const series = await API.getNumberSeries();
    if (!Array.isArray(series)) {
      document.getElementById('numberSeriesList').innerHTML = `<tr><td colspan="6" class="text-center text-danger">${(series && series.error) || 'Could not load.'}</td></tr>`;
      return;
    }
    document.getElementById('numberSeriesList').innerHTML = series.map(s => `
      <tr>
        <td class="text-capitalize">${s.entity.replace(/_/g, ' ')}</td>
        <td><input type="text" class="form-control form-control-sm" style="width:90px" id="prefix-${s.entity}" value="${s.prefix}"></td>
        <td><input type="number" class="form-control form-control-sm" style="width:70px" id="pad-${s.entity}" value="${s.pad_length}" min="1" max="8"></td>
        <td><input type="number" class="form-control form-control-sm" style="width:90px" id="next-${s.entity}" value="${s.next_number}" min="1"></td>
        <td class="text-muted">${s.prefix}-${String(s.next_number).padStart(s.pad_length, '0')}</td>
        <td><button class="btn btn-sm btn-outline-primary" onclick="NumberSeriesActions.save('${s.entity}')">Save</button></td>
      </tr>
    `).join('');
  },

  save: async (entity) => {
    const data = {
      prefix: document.getElementById(`prefix-${entity}`).value,
      pad_length: document.getElementById(`pad-${entity}`).value,
      next_number: document.getElementById(`next-${entity}`).value
    };
    const result = await API.updateNumberSeries(entity, data);
    if (result && !result.error) {
      alert(result.message || 'Saved');
      await NumberSeriesActions.load();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};

// ===== BRANCHES =====
const BranchModal = {
  modal: null,

  show: () => {
    document.getElementById('branchForm').reset();
    document.getElementById('branchId').value = '';
    document.getElementById('branchModalTitle').textContent = 'New Branch';
    BranchModal.modal = new bootstrap.Modal(document.getElementById('branchModal'));
    BranchModal.modal.show();
  },

  edit: (branch) => {
    document.getElementById('branchForm').reset();
    document.getElementById('branchId').value = branch.id;
    document.getElementById('branchModalTitle').textContent = `Edit — ${branch.branch_name}`;
    document.getElementById('branchCode').value = branch.branch_code;
    document.getElementById('branchName').value = branch.branch_name;
    document.getElementById('branchAddress').value = branch.address || '';
    document.getElementById('branchCity').value = branch.city || '';
    document.getElementById('branchState').value = branch.state || '';
    document.getElementById('branchPostalCode').value = branch.postal_code || '';
    document.getElementById('branchGstin').value = branch.gstin || '';
    document.getElementById('branchPhone').value = branch.phone || '';
    document.getElementById('branchIsHO').checked = !!branch.is_head_office;
    BranchModal.modal = new bootstrap.Modal(document.getElementById('branchModal'));
    BranchModal.modal.show();
  },

  submit: async (event) => {
    event.preventDefault();
    const id = document.getElementById('branchId').value;
    const data = {
      branch_code: document.getElementById('branchCode').value,
      branch_name: document.getElementById('branchName').value,
      address: document.getElementById('branchAddress').value,
      city: document.getElementById('branchCity').value,
      state: document.getElementById('branchState').value,
      postal_code: document.getElementById('branchPostalCode').value,
      gstin: document.getElementById('branchGstin').value,
      phone: document.getElementById('branchPhone').value,
      is_head_office: document.getElementById('branchIsHO').checked
    };
    const result = id ? await API.updateBranch(id, data) : await API.createBranch(data);
    if (result && !result.error) {
      BranchModal.modal.hide();
      await BranchModal.loadBranches();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  loadBranches: async () => {
    const branches = await API.getBranches();
    if (!Array.isArray(branches)) {
      document.getElementById('branchesList').innerHTML = `<tr><td colspan="7" class="text-center text-danger">${(branches && branches.error) || 'Could not load.'}</td></tr>`;
      return;
    }
    document.getElementById('branchesList').innerHTML = branches.map(b => `
      <tr>
        <td>${b.branch_code}</td>
        <td>${b.branch_name}</td>
        <td>${b.city || '-'}</td>
        <td>${b.gstin || '-'}</td>
        <td>${b.is_head_office ? '<span class="badge bg-primary">HO</span>' : ''}</td>
        <td><span class="badge bg-success">Active</span></td>
        <td><button class="btn btn-sm btn-outline-primary" onclick='BranchModal.edit(${JSON.stringify(b).replace(/'/g, "&apos;")})'>Edit</button></td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="text-center text-muted">No branches yet</td></tr>';
  }
};

// ===== FINANCIAL YEAR & PERIODS =====
const FYModal = {
  modal: null,

  show: () => {
    document.getElementById('fyForm').reset();
    FYModal.modal = new bootstrap.Modal(document.getElementById('fyModal'));
    FYModal.modal.show();
  },

  submit: async (event) => {
    event.preventDefault();
    const data = {
      fy_label: document.getElementById('fyLabel').value,
      start_date: document.getElementById('fyStart').value,
      end_date: document.getElementById('fyEnd').value,
      make_current: document.getElementById('fyMakeCurrent').checked
    };
    const result = await API.createFinancialYear(data);
    if (result && !result.error) {
      FYModal.modal.hide();
      await FYModal.loadYears();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  loadYears: async () => {
    const years = await API.getFinancialYears();
    if (!Array.isArray(years)) {
      document.getElementById('fyList').innerHTML = `<div class="text-danger">${(years && years.error) || 'Could not load.'}</div>`;
      return;
    }
    document.getElementById('fyList').innerHTML = years.map(fy => `
      <div class="card border-0 shadow-sm mb-3">
        <div class="card-body">
          <h6>${fy.fy_label} ${fy.is_current ? '<span class="badge bg-primary">Current</span>' : ''} <span class="text-muted small">${fy.start_date} to ${fy.end_date}</span></h6>
          <div class="d-flex flex-wrap gap-2 mt-2">
            ${(fy.periods || []).map(p => `
              <div class="border rounded px-2 py-1 small ${p.is_locked ? 'bg-light' : ''}">
                ${p.period_label}
                ${p.is_locked
                  ? `<span class="badge bg-danger ms-1">Locked</span> <button class="btn btn-sm btn-link p-0 ms-1" onclick="FYModal.unlock(${p.id})">Unlock</button>`
                  : `<button class="btn btn-sm btn-link p-0 ms-1" onclick="FYModal.lock(${p.id})">Lock</button>`}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `).join('') || '<p class="text-muted">No financial years yet</p>';
  },

  lock: async (id) => {
    if (!confirm('Lock this period? No PO can be dated within it afterward.')) return;
    const result = await API.lockPeriod(id);
    if (result && !result.error) await FYModal.loadYears();
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  },

  unlock: async (id) => {
    const result = await API.unlockPeriod(id);
    if (result && !result.error) await FYModal.loadYears();
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  }
};

// ===== AUDIT LOG =====
const AuditActions = {
  load: async () => {
    const filters = {};
    const module = document.getElementById('auditModuleFilter')?.value;
    const from = document.getElementById('auditFromDate')?.value;
    const to = document.getElementById('auditToDate')?.value;
    if (module) filters.module = module;
    if (from) filters.from_date = from;
    if (to) filters.to_date = to;

    const logs = await API.getAuditLog(filters);
    if (!Array.isArray(logs)) {
      document.getElementById('auditLogList').innerHTML = `<tr><td colspan="6" class="text-center text-danger">${(logs && logs.error) || 'Could not load.'}</td></tr>`;
      return;
    }
    document.getElementById('auditLogList').innerHTML = logs.map(l => `
      <tr>
        <td>${new Date(l.timestamp).toLocaleString('en-IN')}</td>
        <td>${l.user_name || 'System'}</td>
        <td>${l.action}</td>
        <td class="text-capitalize">${l.module}</td>
        <td>#${l.record_id || '-'}</td>
        <td class="small text-muted">${l.new_value ? l.new_value.slice(0, 80) : '-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="text-center text-muted">No log entries yet</td></tr>';
  }
};

// ===== NOTIFICATION TEMPLATES =====
const NotifActions = {
  load: async () => {
    const templates = await API.getNotificationTemplates();
    if (!Array.isArray(templates)) {
      document.getElementById('notifList').innerHTML = `<div class="text-danger">${(templates && templates.error) || 'Could not load.'}</div>`;
      return;
    }
    document.getElementById('notifList').innerHTML = templates.map(t => `
      <div class="card border-0 shadow-sm mb-3">
        <div class="card-body">
          <h6>${t.title}</h6>
          <div class="mb-2">
            <label class="form-label small">Subject</label>
            <input type="text" class="form-control form-control-sm" id="notifSubject-${t.id}" value="${t.subject || ''}">
          </div>
          <div class="mb-2">
            <label class="form-label small">Body <span class="text-muted">(use {placeholders} as shown)</span></label>
            <textarea class="form-control form-control-sm" id="notifBody-${t.id}" rows="4">${t.body}</textarea>
          </div>
          <div class="form-check form-check-inline">
            <input type="checkbox" class="form-check-input" id="notifActive-${t.id}" ${t.is_active ? 'checked' : ''}>
            <label class="form-check-label small" for="notifActive-${t.id}">Active</label>
          </div>
          <button class="btn btn-sm btn-outline-primary" onclick="NotifActions.save(${t.id})">Save</button>
        </div>
      </div>
    `).join('');
  },

  save: async (id) => {
    const data = {
      subject: document.getElementById(`notifSubject-${id}`).value,
      body: document.getElementById(`notifBody-${id}`).value,
      is_active: document.getElementById(`notifActive-${id}`).checked
    };
    const result = await API.updateNotificationTemplate(id, data);
    if (result && !result.error) {
      alert('Template saved');
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};

// ===== BACKUP & RESTORE =====
const BackupActions = {
  download: async () => {
    try {
      await API.downloadBackup();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  restore: () => {
    const fileInput = document.getElementById('restoreFile');
    const confirm_ = document.getElementById('restoreConfirm').value;
    const file = fileInput.files[0];
    if (!file) {
      alert('Choose a .db backup file first');
      return;
    }
    if (confirm_ !== 'RESTORE') {
      alert('Type RESTORE in the confirmation box to proceed');
      return;
    }
    if (!confirm('This will permanently replace the live database. A safety copy is taken automatically, but this cannot be casually undone. Continue?')) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = await API.restoreBackup(e.target.result, confirm_);
      if (result && !result.error) {
        alert((result.message || 'Restored') + '\n\nYou will be logged out now.');
        localStorage.clear();
        window.location.href = '/';
      } else {
        alert('Error: ' + ((result && result.error) || 'Something went wrong'));
      }
    };
    reader.readAsDataURL(file);
  },

  backupToPath: async () => {
    const targetPath = document.getElementById('localBackupPath').value.trim();
    if (!targetPath) { alert('Enter a folder path first'); return; }
    const result = await API.backupToLocalPath(targetPath);
    if (result && !result.error) alert(result.message || 'Backup saved');
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  },

  // ---- Google Drive ----
  loadGdriveStatus: async () => {
    const status = await API.getGdriveStatus();
    const statusEl = document.getElementById('gdriveStatus');
    const configureBlock = document.getElementById('gdriveConfigureBlock');
    const actionsBlock = document.getElementById('gdriveActionsBlock');
    if (!status || status.error) {
      statusEl.innerHTML = `<span class="text-danger">${(status && status.error) || 'Could not check status'}</span>`;
      return;
    }
    if (status.connected) {
      statusEl.innerHTML = `<span class="text-success"><i class="fas fa-check-circle me-1"></i>Connected as <strong>${status.connected_email}</strong></span>`;
      configureBlock.style.display = 'none';
      actionsBlock.style.display = 'block';
      document.getElementById('gdriveBackupNowBtn').style.display = 'inline-block';
      document.getElementById('gdriveListBtn').style.display = 'inline-block';
      document.getElementById('gdriveDisconnectBtn').style.display = 'inline-block';
      document.querySelector('#gdriveActionsBlock button[onclick="BackupActions.connectGdrive()"]').style.display = 'none';
    } else if (status.configured) {
      statusEl.innerHTML = `<span class="text-warning"><i class="fas fa-exclamation-circle me-1"></i>Credentials saved, not connected yet.</span>`;
      configureBlock.style.display = 'none';
      actionsBlock.style.display = 'block';
      document.getElementById('gdriveBackupNowBtn').style.display = 'none';
      document.getElementById('gdriveListBtn').style.display = 'none';
      document.getElementById('gdriveDisconnectBtn').style.display = 'none';
    } else {
      statusEl.innerHTML = `<span class="text-muted">Not configured yet. Enter your Google OAuth credentials below.</span>`;
      configureBlock.style.display = 'flex';
      actionsBlock.style.display = 'none';
    }
  },

  saveGdriveCredentials: async () => {
    const client_id = document.getElementById('gdriveClientId').value.trim();
    const client_secret = document.getElementById('gdriveClientSecret').value.trim();
    if (!client_id || !client_secret) { alert('Enter both Client ID and Client Secret'); return; }
    const result = await API.configureGdrive(client_id, client_secret);
    if (result && !result.error) { alert(result.message || 'Saved'); await BackupActions.loadGdriveStatus(); }
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  },

  connectGdrive: async () => {
    const result = await API.getGdriveAuthUrl();
    if (result && result.url) {
      window.open(result.url, '_blank', 'width=520,height=650');
      alert('Complete the Google sign-in in the new tab, then come back and click this Backup & Restore tab again to refresh the connection status.');
    } else {
      alert('Error: ' + ((result && result.error) || 'Could not start Google sign-in'));
    }
  },

  backupToGdriveNow: async () => {
    const result = await API.backupToGdriveNow();
    if (result && !result.error) alert(result.message || 'Backed up to Google Drive');
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  },

  loadGdriveBackups: async () => {
    const container = document.getElementById('gdriveBackupsList');
    container.innerHTML = '<div class="text-muted small">Loading...</div>';
    const backups = await API.getGdriveBackups();
    if (!Array.isArray(backups)) {
      container.innerHTML = `<div class="text-danger small">${(backups && backups.error) || 'Could not load backups'}</div>`;
      return;
    }
    if (!backups.length) { container.innerHTML = '<div class="text-muted small">No backups on Drive yet.</div>'; return; }
    container.innerHTML = `
      <table class="table table-sm mb-0">
        <thead class="table-light"><tr><th>File</th><th>Created</th><th>Size</th><th>Action</th></tr></thead>
        <tbody>${backups.map(b => `
          <tr><td>${b.name}</td><td>${new Date(b.createdTime).toLocaleString('en-IN')}</td>
          <td>${b.size ? (parseInt(b.size) / 1024 / 1024).toFixed(2) + ' MB' : '-'}</td>
          <td><button class="btn btn-sm btn-outline-danger" onclick="BackupActions.restoreFromGdrive('${b.id}')">Restore This</button></td></tr>
        `).join('')}</tbody>
      </table>`;
  },

  restoreFromGdrive: async (fileId) => {
    const confirm_ = prompt('This will permanently replace the live database with this Drive backup. A safety copy is taken automatically first. Type RESTORE to proceed:');
    if (confirm_ !== 'RESTORE') return;
    const result = await API.restoreFromGdrive(fileId, confirm_);
    if (result && !result.error) {
      alert((result.message || 'Restored') + '\n\nYou will be logged out now.');
      localStorage.clear();
      window.location.href = '/';
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  disconnectGdrive: async () => {
    if (!confirm('Disconnect Google Drive? Scheduled backups to Drive will stop until you reconnect.')) return;
    const result = await API.disconnectGdrive();
    if (result && !result.error) { alert(result.message || 'Disconnected'); await BackupActions.loadGdriveStatus(); }
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  },

  // ---- Auto-backup schedule ----
  loadSchedule: async () => {
    const sched = await API.getBackupSchedule();
    if (!sched || sched.error) return;
    document.getElementById('scheduleEnabled').checked = !!sched.enabled;
    document.getElementById('scheduleTime').value = sched.time_of_day || '02:00';
    document.getElementById('scheduleDestination').value = sched.destination || 'local';
    document.getElementById('scheduleLocalPath').value = sched.local_path || '';
    const lastRun = document.getElementById('scheduleLastRun');
    lastRun.textContent = sched.last_run_at
      ? `Last run: ${new Date(sched.last_run_at).toLocaleString('en-IN')} — ${sched.last_run_status || ''} ${sched.last_run_message ? '(' + sched.last_run_message + ')' : ''}`
      : 'Never run yet.';
  },

  saveSchedule: async () => {
    const data = {
      enabled: document.getElementById('scheduleEnabled').checked,
      time_of_day: document.getElementById('scheduleTime').value || '02:00',
      destination: document.getElementById('scheduleDestination').value,
      local_path: document.getElementById('scheduleLocalPath').value.trim()
    };
    const result = await API.saveBackupSchedule(data);
    if (result && !result.error) alert(result.message || 'Schedule saved');
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  }
};

// ===== LICENSE =====
const LicenseActions = {
  load: async () => {
    const status = await API.getLicenseStatus();
    const block = document.getElementById('licenseStatusBlock');
    if (!status) { block.innerHTML = '<div class="text-danger small">Could not load license status</div>'; return; }
    if (!status.activated) {
      block.innerHTML = `<span class="badge bg-secondary">Not Activated</span><p class="text-muted small mt-2">No license key has been activated on this installation yet.</p>`;
      return;
    }
    const badgeColor = status.status === 'Active' ? 'success' : status.status === 'Expired' ? 'danger' : 'warning';
    block.innerHTML = `
      <span class="badge bg-${badgeColor}">${status.status}</span>
      <table class="table table-sm mt-2 mb-0">
        <tr><td class="text-muted">Licensed To</td><td>${status.licensed_to || '-'}</td></tr>
        <tr><td class="text-muted">Issued</td><td>${status.issued_date ? new Date(status.issued_date).toLocaleDateString('en-IN') : '-'}</td></tr>
        <tr><td class="text-muted">Valid Until</td><td>${status.valid_until ? new Date(status.valid_until).toLocaleDateString('en-IN') : 'Perpetual'}</td></tr>
        <tr><td class="text-muted">Max Users</td><td>${status.max_users || 'Unlimited'}</td></tr>
        ${status.days_remaining !== null && status.days_remaining !== undefined ? `<tr><td class="text-muted">Days Remaining</td><td>${status.days_remaining}</td></tr>` : ''}
      </table>
    `;
  },

  activate: async () => {
    const key = document.getElementById('licenseKeyInput').value.trim();
    if (!key) { alert('Paste a license key first'); return; }
    const result = await API.activateLicense(key);
    if (result && !result.error) {
      alert(result.message || 'License activated');
      document.getElementById('licenseKeyInput').value = '';
      await LicenseActions.load();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};
