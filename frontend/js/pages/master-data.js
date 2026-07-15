const MasterDataPage = {
  render: async () => {
    return `
      <div class="row mb-4">
        <div class="col-md-12">
          <h2><i class="fas fa-database me-2"></i>Master Data Management</h2>
          <p class="text-muted">Standardized reference data used across Purchase, Production, Inventory, and Quality.</p>
        </div>
      </div>

      <ul class="nav nav-tabs mb-3 flex-wrap">
        <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#itemGroupsTab">Item Groups &amp; Grades</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#uomTab">UOM &amp; Conversions</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#wcTab">Work Centers &amp; Machines</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#locationsTab">Warehouse Locations</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#routingTab">Routing</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#customersTab">Customers</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#taxTab">Tax / HSN</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#employeesTab">Employees</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#deptShiftTab">Departments &amp; Shifts</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#reasonTab">Reason Codes</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#termsTab">Payment Terms / Transport</button></li>
      </ul>

      <div class="tab-content">

        <div class="tab-pane fade show active" id="itemGroupsTab">
          <div class="row">
            <div class="col-md-6">${SimpleMasterWidget.markup('item_group', 'Item Group')}</div>
            <div class="col-md-6">${SimpleMasterWidget.markup('grade', 'Grade')}</div>
          </div>
        </div>

        <div class="tab-pane fade" id="uomTab">
          <div class="row">
            <div class="col-md-5">${SimpleMasterWidget.markup('uom', 'Unit of Measure')}</div>
            <div class="col-md-7">
              <div class="card border-0 shadow-sm">
                <div class="card-body">
                  <h6>Conversion Factors</h6>
                  <p class="text-muted small">E.g. 1 Box = 12 Nos</p>
                  <table class="table table-sm"><thead><tr><th>From</th><th>To</th><th>Factor</th><th></th></tr></thead><tbody id="uomConvList"></tbody></table>
                  <form class="row g-2 mt-2" onsubmit="UomConversionActions.add(event)">
                    <div class="col-4"><input type="text" class="form-control form-control-sm" id="convFrom" placeholder="From UOM code" required></div>
                    <div class="col-4"><input type="text" class="form-control form-control-sm" id="convTo" placeholder="To UOM code" required></div>
                    <div class="col-3"><input type="number" class="form-control form-control-sm" id="convFactor" placeholder="Factor" step="0.0001" required></div>
                    <div class="col-1"><button class="btn btn-sm btn-primary w-100">+</button></div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="tab-pane fade" id="wcTab">
          <div class="row">
            <div class="col-md-6">
              <div class="card border-0 shadow-sm mb-3">
                <div class="card-body">
                  <div class="d-flex justify-content-between"><h6>Work Centers</h6><button class="btn btn-sm btn-outline-primary" onclick="WorkCenterModal.show()">+ New</button></div>
                  <table class="table table-sm"><thead><tr><th>Code</th><th>Name</th><th>Dept</th><th>Capacity/day</th><th></th></tr></thead><tbody id="workCenterList"></tbody></table>
                </div>
              </div>
            </div>
            <div class="col-md-6">
              <div class="card border-0 shadow-sm mb-3">
                <div class="card-body">
                  <div class="d-flex justify-content-between"><h6>Machines</h6><button class="btn btn-sm btn-outline-primary" onclick="MachineModal.show()">+ New</button></div>
                  <table class="table table-sm"><thead><tr><th>Code</th><th>Name</th><th>Work Center</th><th></th></tr></thead><tbody id="machineList"></tbody></table>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="tab-pane fade" id="locationsTab">
          <div class="d-flex justify-content-between mb-2"><p class="text-muted small mb-0">Rack/bin locations within your existing warehouses.</p><button class="btn btn-sm btn-outline-primary" onclick="LocationModal.show()">+ New Location</button></div>
          <div class="card border-0 shadow-sm"><div class="card-body">
            <table class="table table-sm"><thead><tr><th>Warehouse</th><th>Location Code</th><th>Rack</th><th>Bin</th><th></th></tr></thead><tbody id="locationList"></tbody></table>
          </div></div>
        </div>

        <div class="tab-pane fade" id="routingTab">
          <div class="d-flex justify-content-between mb-2"><p class="text-muted small mb-0">Sequence of operations to produce something — separate from the BOM (which is materials in/out).</p><button class="btn btn-sm btn-outline-primary" onclick="RoutingModal.show()">+ New Routing</button></div>
          <div id="routingList"></div>
        </div>

        <div class="tab-pane fade" id="customersTab">
          <div class="d-flex justify-content-between mb-2"><p class="text-muted small mb-0">Standalone for now — ready for when a sales module is built.</p><button class="btn btn-sm btn-outline-primary" onclick="CustomerModal.show()">+ New Customer</button></div>
          <div class="card border-0 shadow-sm"><div class="card-body">
            <table class="table table-sm"><thead><tr><th>Code</th><th>Name</th><th>City</th><th>GSTIN</th><th>Credit Limit</th><th></th></tr></thead><tbody id="customerList"></tbody></table>
          </div></div>
        </div>

        <div class="tab-pane fade" id="taxTab">
          <div class="d-flex justify-content-between mb-2"><p class="text-muted small mb-0">Tax rates, HSN/SAC codes, and GST classification.</p><button class="btn btn-sm btn-outline-primary" onclick="TaxModal.show()">+ New Entry</button></div>
          <div class="card border-0 shadow-sm"><div class="card-body">
            <table class="table table-sm"><thead><tr><th>Name</th><th>Rate %</th><th>HSN/SAC</th><th>GST Class</th><th></th></tr></thead><tbody id="taxList"></tbody></table>
          </div></div>
        </div>

        <div class="tab-pane fade" id="employeesTab">
          <div class="d-flex justify-content-between mb-2"><p class="text-muted small mb-0">Workforce master — separate from portal logins (Users), since not every employee needs one.</p><button class="btn btn-sm btn-outline-primary" onclick="EmployeeModal.show()">+ New Employee</button></div>
          <div class="card border-0 shadow-sm"><div class="card-body">
            <table class="table table-sm"><thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Designation</th><th>Shift</th><th></th></tr></thead><tbody id="employeeList"></tbody></table>
          </div></div>
        </div>

        <div class="tab-pane fade" id="deptShiftTab">
          <div class="row">
            <div class="col-md-6">${SimpleMasterWidget.markup('department', 'Department')}</div>
            <div class="col-md-6">${SimpleMasterWidget.markup('shift', 'Shift', ['start_time', 'end_time'])}</div>
          </div>
        </div>

        <div class="tab-pane fade" id="reasonTab">
          <p class="text-muted small">Used for rejection, return, scrap, and stock adjustment records.</p>
          ${SimpleMasterWidget.markup('reason_code', 'Reason Code', ['category'])}
        </div>

        <div class="tab-pane fade" id="termsTab">
          <div class="row">
            <div class="col-md-4">${SimpleMasterWidget.markup('payment_term', 'Payment Term', ['days'])}</div>
            <div class="col-md-4">${SimpleMasterWidget.markup('transporter', 'Transporter')}</div>
            <div class="col-md-4">${SimpleMasterWidget.markup('dispatch_mode', 'Dispatch Mode')}</div>
          </div>
        </div>

      </div>

      ${SimpleMasterWidget.modalMarkup()}
      ${MasterModals.markup()}
    `;
  },

  init: async () => {
    await Promise.all([
      SimpleMasterWidget.load('item_group'), SimpleMasterWidget.load('grade'), SimpleMasterWidget.load('uom'),
      SimpleMasterWidget.load('department'), SimpleMasterWidget.load('shift'), SimpleMasterWidget.load('reason_code'),
      SimpleMasterWidget.load('payment_term'), SimpleMasterWidget.load('transporter'), SimpleMasterWidget.load('dispatch_mode'),
      UomConversionActions.load(),
      WorkCenterModal.loadWorkCenters(),
      MachineModal.loadMachines(),
      LocationModal.loadLocations(),
      RoutingModal.loadRoutings(),
      CustomerModal.loadCustomers(),
      TaxModal.loadTax(),
      EmployeeModal.loadEmployees()
    ]);
  }
};

// ===== GENERIC SIMPLE MASTER WIDGET (Item Group, Grade, UOM, Department,
// Shift, Reason Code, Payment Term, Transporter, Dispatch Mode) =====
const SimpleMasterWidget = {
  cache: {},

  markup: (type, label, extraFields = []) => `
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="mb-0">${label}s</h6>
          <button class="btn btn-sm btn-outline-primary" onclick='SimpleMasterWidget.openForm("${type}", "${label}", ${JSON.stringify(extraFields)})'>+ New</button>
        </div>
        <table class="table table-sm mb-0">
          <thead><tr><th>Code</th><th>Name</th>${extraFields.map(f => `<th class="text-capitalize">${f.replace(/_/g, ' ')}</th>`).join('')}<th></th></tr></thead>
          <tbody id="simpleList-${type}"><tr><td colspan="${2 + extraFields.length + 1}" class="text-center text-muted">Loading...</td></tr></tbody>
        </table>
      </div>
    </div>
  `,

  modalMarkup: () => `
    <div class="modal fade" id="simpleMasterModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title" id="simpleMasterModalTitle">New</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
          <form id="simpleMasterForm" onsubmit="SimpleMasterWidget.submit(event)">
            <div class="modal-body">
              <input type="hidden" id="smType"><input type="hidden" id="smId">
              <div class="mb-2"><label class="form-label">Code *</label><input type="text" class="form-control" id="smCode" required></div>
              <div class="mb-2"><label class="form-label">Name *</label><input type="text" class="form-control" id="smName" required></div>
              <div id="smExtraFields"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,

  openForm: (type, label, extraFields, existing = null) => {
    document.getElementById('simpleMasterForm').reset();
    document.getElementById('smType').value = type;
    document.getElementById('smId').value = existing ? existing.id : '';
    document.getElementById('simpleMasterModalTitle').textContent = existing ? `Edit ${label}` : `New ${label}`;
    document.getElementById('smCode').value = existing ? existing.code : '';
    document.getElementById('smCode').disabled = !!existing;
    document.getElementById('smName').value = existing ? existing.name : '';

    const extraContainer = document.getElementById('smExtraFields');
    extraContainer.innerHTML = extraFields.map(f => {
      const val = existing && existing.extra ? existing.extra[f] : '';
      const inputType = f.includes('time') ? 'time' : (f === 'days' ? 'number' : 'text');
      return `<div class="mb-2"><label class="form-label text-capitalize">${f.replace(/_/g, ' ')}</label><input type="${inputType}" class="form-control smExtra" data-field="${f}" value="${val || ''}"></div>`;
    }).join('');

    new bootstrap.Modal(document.getElementById('simpleMasterModal')).show();
  },

  submit: async (event) => {
    event.preventDefault();
    const type = document.getElementById('smType').value;
    const id = document.getElementById('smId').value;
    const extra = {};
    document.querySelectorAll('.smExtra').forEach(input => { extra[input.dataset.field] = input.value; });

    const data = { code: document.getElementById('smCode').value, name: document.getElementById('smName').value, extra };
    const result = id ? await API.updateSimpleMaster(type, id, data) : await API.createSimpleMaster(type, data);
    if (result && !result.error) {
      bootstrap.Modal.getInstance(document.getElementById('simpleMasterModal')).hide();
      await SimpleMasterWidget.load(type);
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  load: async (type) => {
    const rows = await API.getSimpleMasters(type);
    const tbody = document.getElementById(`simpleList-${type}`);
    if (!tbody) return;
    if (!Array.isArray(rows)) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">${(rows && rows.error) || 'Could not load.'}</td></tr>`;
      return;
    }
    SimpleMasterWidget.cache[type] = rows;
    const extraKeys = rows.length > 0 && rows[0].extra ? Object.keys(rows[0].extra) : [];
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.code}</td>
        <td>${r.name}</td>
        ${extraKeys.map(k => `<td>${(r.extra && r.extra[k]) || '-'}</td>`).join('')}
        <td>
          <button class="btn btn-sm btn-link p-0 me-2" onclick='SimpleMasterWidget.editFromCache("${type}", ${r.id})'>Edit</button>
          <button class="btn btn-sm btn-link text-danger p-0" onclick="SimpleMasterWidget.remove('${type}', ${r.id})">Remove</button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="10" class="text-center text-muted">None yet</td></tr>`;
  },

  editFromCache: (type, id) => {
    const row = (SimpleMasterWidget.cache[type] || []).find(r => r.id === id);
    if (!row) return;
    const extraFields = row.extra ? Object.keys(row.extra) : [];
    const labelMap = { item_group: 'Item Group', grade: 'Grade', uom: 'Unit of Measure', department: 'Department', shift: 'Shift', reason_code: 'Reason Code', payment_term: 'Payment Term', transporter: 'Transporter', dispatch_mode: 'Dispatch Mode' };
    SimpleMasterWidget.openForm(type, labelMap[type] || type, extraFields, row);
  },

  remove: async (type, id) => {
    if (!confirm('Remove this entry?')) return;
    const result = await API.deleteSimpleMaster(type, id);
    if (result && !result.error) await SimpleMasterWidget.load(type);
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  }
};

// ===== UOM CONVERSIONS =====
const UomConversionActions = {
  load: async () => {
    const rows = await API.getUomConversions();
    if (!Array.isArray(rows)) return;
    document.getElementById('uomConvList').innerHTML = rows.map(r => `
      <tr><td>${r.from_uom}</td><td>${r.to_uom}</td><td>${r.conversion_factor}</td>
        <td><button class="btn btn-sm btn-link text-danger p-0" onclick="UomConversionActions.remove(${r.id})">Remove</button></td></tr>
    `).join('') || '<tr><td colspan="4" class="text-center text-muted">None yet</td></tr>';
  },
  add: async (event) => {
    event.preventDefault();
    const data = {
      from_uom: document.getElementById('convFrom').value.toUpperCase(),
      to_uom: document.getElementById('convTo').value.toUpperCase(),
      conversion_factor: document.getElementById('convFactor').value
    };
    const result = await API.createUomConversion(data);
    if (result && !result.error) {
      document.getElementById('convFrom').value = '';
      document.getElementById('convTo').value = '';
      document.getElementById('convFactor').value = '';
      await UomConversionActions.load();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },
  remove: async (id) => {
    const result = await API.deleteUomConversion(id);
    if (result && !result.error) await UomConversionActions.load();
  }
};
