const ROLE_LABELS = {
  admin: 'Administrator',
  approver: 'Approver',
  purchaser: 'Purchaser',
  storekeeper: 'Storekeeper',
  production: 'Production',
  sales: 'Sales',
  accounts: 'Accounts',
  cashier: 'Cashier (POS)',
  employee: 'Employee (Requester)'
};

const ROLE_BADGE_COLOR = {
  admin: 'danger',
  approver: 'warning',
  purchaser: 'primary',
  storekeeper: 'info',
  production: 'success',
  sales: 'primary',
  accounts: 'dark',
  cashier: 'success',
  employee: 'secondary'
};

const MODULE_LABELS = {
  dashboard: 'Dashboard',
  purchase: 'Purchase',
  indent: 'Indent',
  inventory: 'Inventory',
  quality: 'Quality',
  production: 'Production',
  sales: 'Sales & Dispatch',
  pos: 'POS Billing',
  accounts: 'Accounts',
  finance: 'Finance',
  expenses: 'Expense Claims',
  reports: 'MIS Reports',
  masters: 'Master Data',
  admin: 'Admin'
};

const UsersPage = {
  render: async () => {
    return `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="fas fa-users-cog me-2"></i>User Management</h2>
          <p class="text-muted">Create logins and set access privileges for your team</p>
        </div>
        <div class="col-md-4 text-end">
          <button class="btn btn-primary" onclick="UserModal.show()">
            <i class="fas fa-user-plus me-2"></i>New User
          </button>
        </div>
      </div>

      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Approver</th>
                <th>Modules</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="usersList">
              <tr><td colspan="9" class="text-center text-muted py-4">Loading users...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- User Modal -->
      <div class="modal fade" id="userModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="userModalTitle">New User</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="userForm" onsubmit="UserModal.submit(event)">
              <div class="modal-body">
                <input type="hidden" id="userId">
                <div class="mb-3">
                  <label class="form-label">Full Name *</label>
                  <input type="text" class="form-control" id="userFullName" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Username *</label>
                  <input type="text" class="form-control" id="userUsername" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Email *</label>
                  <input type="email" class="form-control" id="userEmail" required>
                </div>
                <div class="mb-3" id="userPasswordGroup">
                  <label class="form-label">Password *</label>
                  <input type="password" class="form-control" id="userPassword" minlength="6">
                  <div class="form-text">Minimum 6 characters.</div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Role / Privilege *</label>
                  <select class="form-control" id="userRole" required onchange="UserModal.renderModulePermissions(UserModal.getModulePermissions(), this.value)">
                    ${Object.entries(ROLE_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
                  </select>
                  <div class="form-text">Controls which parts of the portal this login can access.</div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Department</label>
                  <input type="text" class="form-control" id="userDepartment">
                </div>
                <div class="mb-3">
                  <label class="form-label">Approval Level</label>
                  <input type="number" class="form-control" id="userApprovalLevel" min="1" value="1">
                  <div class="form-text">For the approval hierarchy: Level 1 approves first, Level 2 next, and so on. Only relevant for users who approve indents or POs.</div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Fixed Approver</label>
                  <select class="form-control" id="userApprover">
                    <option value="">No fixed approver</option>
                  </select>
                  <div class="form-text">Submitted/approved PO edit or delete requests go to this person.</div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Permission Matrix</label>
                  <div class="table-responsive">
                    <table class="table table-sm table-bordered mb-0" id="permissionMatrix"></table>
                  </div>
                  <div class="form-text">Admin users always get full access to everything.</div>
                </div>
                <div class="mb-3 form-check" id="userActiveGroup" style="display:none">
                  <input type="checkbox" class="form-check-input" id="userIsActive">
                  <label class="form-check-label" for="userIsActive">Account active</label>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Save User</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Reset Password Modal -->
      <div class="modal fade" id="resetPasswordModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Reset Password</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="resetPasswordForm" onsubmit="UserModal.submitPasswordReset(event)">
              <div class="modal-body">
                <input type="hidden" id="resetUserId">
                <div class="mb-3">
                  <label class="form-label">New Password *</label>
                  <input type="password" class="form-control" id="resetNewPassword" minlength="6" required>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  init: async () => {
    // This page is admin-only, but nothing stops a non-admin from calling
    // navigateTo('users') directly, so enforce it client-side too (the
    // server-side requireAdmin check is what actually protects the data).
    const currentUser = Auth.getUser();
    if (!currentUser || currentUser.role !== 'admin') {
      document.getElementById('content').innerHTML = `
        <div class="alert alert-danger">You don't have permission to view this page.</div>
      `;
      return;
    }
    await UserModal.loadUsers();
  }
};

const UserModal = {
  modal: null,
  resetModal: null,
  users: [],

  show: () => {
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('userModalTitle').textContent = 'New User';
    document.getElementById('userPasswordGroup').style.display = 'block';
    document.getElementById('userPassword').required = true;
    document.getElementById('userActiveGroup').style.display = 'none';
    document.getElementById('userUsername').disabled = false;
    UserModal.populateApproverSelect();
    UserModal.renderModulePermissions({});
    UserModal.modal = new bootstrap.Modal(document.getElementById('userModal'));
    UserModal.modal.show();
  },

  edit: (user) => {
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = user.id;
    document.getElementById('userModalTitle').textContent = `Edit User - ${user.username}`;
    document.getElementById('userFullName').value = user.full_name;
    document.getElementById('userUsername').value = user.username;
    document.getElementById('userUsername').disabled = true; // username isn't editable once created
    document.getElementById('userEmail').value = user.email;
    document.getElementById('userRole').value = user.role;
    document.getElementById('userDepartment').value = user.department || '';
    document.getElementById('userApprovalLevel').value = user.approval_level || 1;
    UserModal.populateApproverSelect(user.id);
    document.getElementById('userApprover').value = user.approver_id || '';
    UserModal.renderModulePermissions(user.module_permissions || {}, user.role);
    // Password is optional on edit - only shown/required on create.
    document.getElementById('userPasswordGroup').style.display = 'none';
    document.getElementById('userPassword').required = false;
    document.getElementById('userActiveGroup').style.display = 'block';
    document.getElementById('userIsActive').checked = !!user.is_active;
    UserModal.modal = new bootstrap.Modal(document.getElementById('userModal'));
    UserModal.modal.show();
  },

  loadUsers: async () => {
    const users = await API.getUsers();
    if (!Array.isArray(users)) {
      document.getElementById('usersList').innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4">${(users && users.error) || 'Could not load users.'}</td></tr>`;
      return;
    }
    UserModal.users = users;

    const currentUser = Auth.getUser();
    const html = users.length > 0
      ? users.map(u => `
          <tr>
            <td>${u.full_name}</td>
            <td>${u.username}</td>
            <td>${u.email}</td>
            <td><span class="badge bg-${ROLE_BADGE_COLOR[u.role] || 'secondary'}">${ROLE_LABELS[u.role] || u.role}</span></td>
            <td>${u.department || '-'}</td>
            <td>${u.approver_name || '-'}<br><span class="badge bg-light text-dark border">Level ${u.approval_level || 1}</span></td>
            <td>${Object.entries(u.module_permissions || {}).filter(([, perm]) => typeof perm === 'boolean' ? perm : Object.values(perm || {}).some(Boolean)).map(([key]) => `<span class="badge bg-light text-dark border me-1">${MODULE_LABELS[key] || key}</span>`).join('') || '-'}</td>
            <td>${u.is_active ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Deactivated</span>'}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick='UserModal.edit(${JSON.stringify(u).replace(/'/g, "&apos;")})'>Edit</button>
              <button class="btn btn-sm btn-outline-secondary" onclick="UserModal.showResetPassword(${u.id})">Reset PW</button>
              ${u.id !== currentUser.id ? `<button class="btn btn-sm btn-outline-${u.is_active ? 'danger' : 'success'}" onclick="UserModal.toggleActive(${u.id}, ${!u.is_active})">${u.is_active ? 'Deactivate' : 'Activate'}</button>` : ''}
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="9" class="text-center text-muted py-4">No users yet</td></tr>';

    document.getElementById('usersList').innerHTML = html;
  },

  populateApproverSelect: (currentUserId = null) => {
    const select = document.getElementById('userApprover');
    if (!select) return;
    const approvers = UserModal.users.filter(u => u.id !== currentUserId && u.is_active && ['admin', 'approver'].includes(u.role));
    select.innerHTML = '<option value="">No fixed approver</option>' + approvers.map(u =>
      `<option value="${u.id}">${u.full_name} (${ROLE_LABELS[u.role] || u.role}, Level ${u.approval_level || 1})</option>`
    ).join('');
  },

  ACTIONS: ['view', 'create', 'edit', 'delete', 'approve'],

  renderModulePermissions: (permissions = {}, role = null) => {
    const table = document.getElementById('permissionMatrix');
    if (!table) return;
    const actions = UserModal.ACTIONS;
    const isAdmin = role === 'admin';

    const headerRow = `<tr><th>Module</th>${actions.map(a => `<th class="text-center text-capitalize">${a}</th>`).join('')}</tr>`;
    const bodyRows = Object.entries(MODULE_LABELS).map(([moduleKey, label]) => {
      const modulePerm = permissions[moduleKey];
      // Old data may just be `true`/`false` for the whole module — treat
      // that as every action having that same value.
      const asObject = typeof modulePerm === 'boolean'
        ? actions.reduce((acc, a) => ({ ...acc, [a]: modulePerm }), {})
        : (modulePerm || {});

      const cells = actions.map(a => `
        <td class="text-center">
          <input type="checkbox" class="form-check-input perm-cell" data-module="${moduleKey}" data-action="${a}"
            ${asObject[a] ? 'checked' : ''} ${isAdmin ? 'disabled checked' : ''}>
        </td>
      `).join('');

      return `<tr><td>${label}</td>${cells}</tr>`;
    }).join('');

    table.innerHTML = `<thead class="table-light">${headerRow}</thead><tbody>${bodyRows}</tbody>`;
  },

  getModulePermissions: () => {
    const role = document.getElementById('userRole').value;
    const permissions = {};
    Object.keys(MODULE_LABELS).forEach(moduleKey => {
      const perm = {};
      UserModal.ACTIONS.forEach(a => {
        perm[a] = role === 'admin' ? true : !!document.querySelector(`.perm-cell[data-module="${moduleKey}"][data-action="${a}"]`)?.checked;
      });
      permissions[moduleKey] = perm;
    });
    return permissions;
  },

  submit: async (event) => {
    event.preventDefault();
    const id = document.getElementById('userId').value;
    const data = {
      full_name: document.getElementById('userFullName').value,
      username: document.getElementById('userUsername').value,
      email: document.getElementById('userEmail').value,
      role: document.getElementById('userRole').value,
      department: document.getElementById('userDepartment').value,
      approval_level: parseInt(document.getElementById('userApprovalLevel').value) || 1,
      approver_id: document.getElementById('userApprover').value || null,
      module_permissions: UserModal.getModulePermissions()
    };

    let result;
    if (id) {
      data.is_active = document.getElementById('userIsActive').checked;
      result = await API.updateUser(id, data);
    } else {
      data.password = document.getElementById('userPassword').value;
      result = await API.createUser(data);
    }

    if (result && !result.error) {
      UserModal.modal.hide();
      alert(id ? 'User updated successfully' : 'User created successfully');
      await UserModal.loadUsers();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  toggleActive: async (id, makeActive) => {
    if (!confirm(makeActive ? 'Reactivate this user?' : 'Deactivate this user? They will no longer be able to log in.')) return;
    const result = await API.updateUser(id, { is_active: makeActive });
    if (result && !result.error) {
      await UserModal.loadUsers();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  showResetPassword: (id) => {
    document.getElementById('resetPasswordForm').reset();
    document.getElementById('resetUserId').value = id;
    UserModal.resetModal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
    UserModal.resetModal.show();
  },

  submitPasswordReset: async (event) => {
    event.preventDefault();
    const id = document.getElementById('resetUserId').value;
    const newPassword = document.getElementById('resetNewPassword').value;
    const result = await API.resetUserPassword(id, newPassword);
    if (result && !result.error) {
      UserModal.resetModal.hide();
      alert('Password reset successfully');
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};
