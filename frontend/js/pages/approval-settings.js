const ApprovalSettingsPage = {
  render: async () => {
    return `
      <div class="row mb-4">
        <div class="col-md-12">
          <h2><i class="fas fa-sitemap me-2"></i>Approval Hierarchy</h2>
          <p class="text-muted">Set how many sequential approval levels are needed. Assign each approver's level under User Management.</p>
        </div>
      </div>

      <div class="row">
        <div class="col-md-5 mb-4">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <h5>Indent Approval</h5>
              <p class="text-muted small">Every indent needs this many sequential approvals (Level 1, then Level 2, etc.) before it's final.</p>
              <form onsubmit="ApprovalSettingsActions.saveIndentLevels(event)">
                <div class="mb-3">
                  <label class="form-label">Levels Required</label>
                  <input type="number" class="form-control" id="indentLevelsRequired" min="1" required>
                </div>
                <button type="submit" class="btn btn-primary btn-sm">Save</button>
              </form>
            </div>
          </div>
        </div>

        <div class="col-md-7 mb-4">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <h5>Purchase Order Approval (by value)</h5>
              <p class="text-muted small">Define how many approval levels a PO needs based on its grand total. E.g. up to ₹50,000 → 1 level; ₹50,000–₹5,00,000 → 2 levels; above that → 3 levels.</p>

              <table class="table table-sm mb-3">
                <thead><tr><th>Min Amount</th><th>Max Amount</th><th>Levels Required</th><th></th></tr></thead>
                <tbody id="poMatrixList"><tr><td colspan="4" class="text-center text-muted">Loading...</td></tr></tbody>
              </table>

              <form class="row g-2" onsubmit="ApprovalSettingsActions.addTier(event)">
                <div class="col-md-3">
                  <input type="number" class="form-control form-control-sm" id="tierMin" placeholder="Min Amount" step="0.01" value="0" required>
                </div>
                <div class="col-md-3">
                  <input type="number" class="form-control form-control-sm" id="tierMax" placeholder="Max Amount (blank = no limit)" step="0.01">
                </div>
                <div class="col-md-3">
                  <input type="number" class="form-control form-control-sm" id="tierLevel" placeholder="Levels Required" min="1" required>
                </div>
                <div class="col-md-3">
                  <button type="submit" class="btn btn-primary btn-sm w-100">Add Tier</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div class="alert alert-info">
        <strong>How this works:</strong> when a user hits "Approve" on an indent or PO, the system only accepts it from
        whoever is set to the <em>next</em> level in the chain (Level 1 must approve before Level 2, and so on) — set
        each approver's level on the <a href="#" onclick="navigateTo('users')">User Management</a> page. Admin accounts
        can approve at any level, so the chain never gets stuck if a designated approver is unavailable.
      </div>
    `;
  },

  init: async () => {
    const currentUser = Auth.getUser();
    if (!currentUser || currentUser.role !== 'admin') {
      document.getElementById('content').innerHTML = `<div class="alert alert-danger">You don't have permission to view this page.</div>`;
      return;
    }
    await ApprovalSettingsActions.load();
  }
};

const ApprovalSettingsActions = {
  load: async () => {
    const [indentSetting, matrix] = await Promise.all([
      API.getIndentApprovalSetting(),
      API.getPOApprovalMatrix()
    ]);

    if (indentSetting && !indentSetting.error) {
      document.getElementById('indentLevelsRequired').value = indentSetting.levels_required || 1;
    }

    ApprovalSettingsActions.renderMatrix(Array.isArray(matrix) ? matrix : []);
  },

  renderMatrix: (rows) => {
    const html = rows.length > 0
      ? rows.map(r => `
          <tr>
            <td>₹${parseFloat(r.min_amount).toLocaleString('en-IN')}</td>
            <td>${r.max_amount !== null ? '₹' + parseFloat(r.max_amount).toLocaleString('en-IN') : 'No limit'}</td>
            <td>${r.required_level}</td>
            <td><button class="btn btn-sm btn-outline-danger" onclick="ApprovalSettingsActions.deleteTier(${r.id})">Remove</button></td>
          </tr>
        `).join('')
      : '<tr><td colspan="4" class="text-center text-muted">No tiers configured — every PO defaults to 1 approval level</td></tr>';

    document.getElementById('poMatrixList').innerHTML = html;
  },

  saveIndentLevels: async (event) => {
    event.preventDefault();
    const levels = parseInt(document.getElementById('indentLevelsRequired').value);
    const result = await API.updateIndentApprovalSetting(levels);
    if (result && !result.error) {
      alert('Saved. This applies to indents submitted from now on.');
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  addTier: async (event) => {
    event.preventDefault();
    const data = {
      min_amount: parseFloat(document.getElementById('tierMin').value) || 0,
      max_amount: document.getElementById('tierMax').value ? parseFloat(document.getElementById('tierMax').value) : null,
      required_level: parseInt(document.getElementById('tierLevel').value)
    };

    const result = await API.addPOApprovalTier(data);
    if (result && !result.error) {
      document.querySelector('#poMatrixList').closest('.card-body').querySelector('form').reset();
      document.getElementById('tierMin').value = 0;
      await ApprovalSettingsActions.load();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  deleteTier: async (id) => {
    if (!confirm('Remove this approval tier?')) return;
    const result = await API.deletePOApprovalTier(id);
    if (result && !result.error) {
      await ApprovalSettingsActions.load();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};
