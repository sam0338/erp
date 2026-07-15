// Modal markup for all the dedicated (non-generic) masters. Kept in one
// place so master-data.js can inject them once into the page.
const MasterModals = {
  markup: () => `
    <!-- Work Center Modal -->
    <div class="modal fade" id="wcModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title" id="wcModalTitle">New Work Center</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="WorkCenterModal.submit(event)">
          <div class="modal-body">
            <input type="hidden" id="wcId">
            <div class="mb-2"><label class="form-label">Code *</label><input type="text" class="form-control" id="wcCode" required></div>
            <div class="mb-2"><label class="form-label">Name *</label><input type="text" class="form-control" id="wcName" required></div>
            <div class="mb-2"><label class="form-label">Department</label><input type="text" class="form-control" id="wcDept"></div>
            <div class="mb-2"><label class="form-label">Capacity / Day</label><input type="number" class="form-control" id="wcCapacity" step="0.01"></div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary">Save</button></div>
        </form>
      </div></div>
    </div>

    <!-- Machine Modal -->
    <div class="modal fade" id="machineModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title" id="machineModalTitle">New Machine</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="MachineModal.submit(event)">
          <div class="modal-body">
            <input type="hidden" id="machineId">
            <div class="mb-2"><label class="form-label">Code *</label><input type="text" class="form-control" id="machineCode" required></div>
            <div class="mb-2"><label class="form-label">Name *</label><input type="text" class="form-control" id="machineName" required></div>
            <div class="mb-2"><label class="form-label">Work Center</label><select class="form-control" id="machineWC"><option value="">None</option></select></div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary">Save</button></div>
        </form>
      </div></div>
    </div>

    <!-- Warehouse Location Modal -->
    <div class="modal fade" id="locationModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">New Warehouse Location</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="LocationModal.submit(event)">
          <div class="modal-body">
            <div class="mb-2"><label class="form-label">Warehouse *</label><select class="form-control" id="locWarehouse" required></select></div>
            <div class="mb-2"><label class="form-label">Location Code *</label><input type="text" class="form-control" id="locCode" required placeholder="e.g. A-01-03"></div>
            <div class="row">
              <div class="col-6 mb-2"><label class="form-label">Rack</label><input type="text" class="form-control" id="locRack"></div>
              <div class="col-6 mb-2"><label class="form-label">Bin</label><input type="text" class="form-control" id="locBin"></div>
            </div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary">Save</button></div>
        </form>
      </div></div>
    </div>

    <!-- Routing Modal -->
    <div class="modal fade" id="routingModal" tabindex="-1">
      <div class="modal-dialog modal-lg"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title" id="routingModalTitle">New Routing</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="RoutingModal.submit(event)">
          <div class="modal-body">
            <input type="hidden" id="routingId">
            <div class="mb-2"><label class="form-label">Routing Name *</label><input type="text" class="form-control" id="routingName" required></div>
            <div class="mb-2"><label class="form-label">Linked Recipe (optional)</label><select class="form-control" id="routingRecipe"><option value="">None</option></select></div>
            <hr>
            <label class="form-label fw-bold">Operation Steps</label>
            <div id="routingStepsContainer"></div>
            <button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick="RoutingModal.addStep()">+ Add Step</button>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary">Save Routing</button></div>
        </form>
      </div></div>
    </div>

    <!-- Customer Modal -->
    <div class="modal fade" id="customerModal" tabindex="-1">
      <div class="modal-dialog modal-lg"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title" id="customerModalTitle">New Customer</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="CustomerModal.submit(event)">
          <div class="modal-body">
            <input type="hidden" id="customerId">
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Customer Name *</label><input type="text" class="form-control" id="customerName" required></div>
              <div class="col-md-6 mb-2"><label class="form-label">Contact Person</label><input type="text" class="form-control" id="customerContact"></div>
            </div>
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Email</label><input type="email" class="form-control" id="customerEmail"></div>
              <div class="col-md-6 mb-2"><label class="form-label">Phone</label><input type="text" class="form-control" id="customerPhone"></div>
            </div>
            <div class="mb-2"><label class="form-label">Address</label><textarea class="form-control" id="customerAddress" rows="2"></textarea></div>
            <div class="row">
              <div class="col-md-4 mb-2"><label class="form-label">City</label><input type="text" class="form-control" id="customerCity"></div>
              <div class="col-md-4 mb-2"><label class="form-label">State</label><input type="text" class="form-control" id="customerState"></div>
              <div class="col-md-4 mb-2"><label class="form-label">Postal Code</label><input type="text" class="form-control" id="customerPostal"></div>
            </div>
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">GSTIN</label><input type="text" class="form-control" id="customerGstin"></div>
              <div class="col-md-6 mb-2"><label class="form-label">Credit Limit</label><input type="number" class="form-control" id="customerCreditLimit" step="0.01" value="0"></div>
            </div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary">Save</button></div>
        </form>
      </div></div>
    </div>

    <!-- Tax Modal -->
    <div class="modal fade" id="taxModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title" id="taxModalTitle">New Tax Entry</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="TaxModal.submit(event)">
          <div class="modal-body">
            <input type="hidden" id="taxId">
            <div class="mb-2"><label class="form-label">Tax Name *</label><input type="text" class="form-control" id="taxName" required placeholder="e.g. GST 18%"></div>
            <div class="mb-2"><label class="form-label">Rate (%) *</label><input type="number" class="form-control" id="taxRate" step="0.01" required></div>
            <div class="mb-2"><label class="form-label">HSN/SAC Code</label><input type="text" class="form-control" id="taxHsn"></div>
            <div class="mb-2"><label class="form-label">GST Class</label>
              <select class="form-control" id="taxClass">
                <option>Goods</option><option>Services</option><option>Exempt</option><option>Nil-rated</option>
              </select>
            </div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary">Save</button></div>
        </form>
      </div></div>
    </div>

    <!-- Employee Modal -->
    <div class="modal fade" id="employeeModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title" id="employeeModalTitle">New Employee</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="EmployeeModal.submit(event)">
          <div class="modal-body">
            <input type="hidden" id="empId">
            <div class="mb-2"><label class="form-label">Full Name *</label><input type="text" class="form-control" id="empName" required></div>
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Department</label><input type="text" class="form-control" id="empDept"></div>
              <div class="col-md-6 mb-2"><label class="form-label">Designation</label><input type="text" class="form-control" id="empDesignation"></div>
            </div>
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Shift</label><input type="text" class="form-control" id="empShift"></div>
              <div class="col-md-6 mb-2"><label class="form-label">Date of Joining</label><input type="date" class="form-control" id="empDoj"></div>
            </div>
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Phone</label><input type="text" class="form-control" id="empPhone"></div>
              <div class="col-md-6 mb-2"><label class="form-label">Email</label><input type="email" class="form-control" id="empEmail"></div>
            </div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary">Save</button></div>
        </form>
      </div></div>
    </div>
  `
};

// ===== WORK CENTERS =====
const WorkCenterModal = {
  cache: [],
  show: () => {
    document.getElementById('wcId').value = '';
    document.getElementById('wcModalTitle').textContent = 'New Work Center';
    document.getElementById('wcCode').value = ''; document.getElementById('wcCode').disabled = false;
    document.getElementById('wcName').value = ''; document.getElementById('wcDept').value = ''; document.getElementById('wcCapacity').value = '';
    new bootstrap.Modal(document.getElementById('wcModal')).show();
  },
  edit: (wc) => {
    document.getElementById('wcId').value = wc.id;
    document.getElementById('wcModalTitle').textContent = `Edit — ${wc.wc_name}`;
    document.getElementById('wcCode').value = wc.wc_code; document.getElementById('wcCode').disabled = true;
    document.getElementById('wcName').value = wc.wc_name;
    document.getElementById('wcDept').value = wc.department || '';
    document.getElementById('wcCapacity').value = wc.capacity_per_day || '';
    new bootstrap.Modal(document.getElementById('wcModal')).show();
  },
  submit: async (event) => {
    event.preventDefault();
    const id = document.getElementById('wcId').value;
    const data = { wc_code: document.getElementById('wcCode').value, wc_name: document.getElementById('wcName').value, department: document.getElementById('wcDept').value, capacity_per_day: document.getElementById('wcCapacity').value };
    const result = id ? await API.updateWorkCenter(id, data) : await API.createWorkCenter(data);
    if (result && !result.error) {
      bootstrap.Modal.getInstance(document.getElementById('wcModal')).hide();
      await WorkCenterModal.loadWorkCenters();
    } else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  },
  loadWorkCenters: async () => {
    const rows = await API.getWorkCenters();
    if (!Array.isArray(rows)) return;
    WorkCenterModal.cache = rows;
    document.getElementById('workCenterList').innerHTML = rows.map(w => `
      <tr><td>${w.wc_code}</td><td>${w.wc_name}</td><td>${w.department || '-'}</td><td>${w.capacity_per_day || '-'}</td>
        <td><button class="btn btn-sm btn-link p-0" onclick='WorkCenterModal.edit(${JSON.stringify(w).replace(/'/g, "&apos;")})'>Edit</button></td></tr>
    `).join('') || '<tr><td colspan="5" class="text-center text-muted">None yet</td></tr>';

    const wcSelect = document.getElementById('machineWC');
    if (wcSelect) wcSelect.innerHTML = '<option value="">None</option>' + rows.map(w => `<option value="${w.id}">${w.wc_name}</option>`).join('');
    const stepWcSelects = document.querySelectorAll('.stepWC');
    stepWcSelects.forEach(sel => { sel.innerHTML = '<option value="">Work Center</option>' + rows.map(w => `<option value="${w.id}">${w.wc_name}</option>`).join(''); });
  }
};

// ===== MACHINES =====
const MachineModal = {
  show: () => {
    document.getElementById('machineId').value = '';
    document.getElementById('machineModalTitle').textContent = 'New Machine';
    document.getElementById('machineCode').value = ''; document.getElementById('machineCode').disabled = false;
    document.getElementById('machineName').value = ''; document.getElementById('machineWC').value = '';
    new bootstrap.Modal(document.getElementById('machineModal')).show();
  },
  edit: (m) => {
    document.getElementById('machineId').value = m.id;
    document.getElementById('machineModalTitle').textContent = `Edit — ${m.machine_name}`;
    document.getElementById('machineCode').value = m.machine_code; document.getElementById('machineCode').disabled = true;
    document.getElementById('machineName').value = m.machine_name;
    document.getElementById('machineWC').value = m.work_center_id || '';
    new bootstrap.Modal(document.getElementById('machineModal')).show();
  },
  submit: async (event) => {
    event.preventDefault();
    const id = document.getElementById('machineId').value;
    const data = { machine_code: document.getElementById('machineCode').value, machine_name: document.getElementById('machineName').value, work_center_id: document.getElementById('machineWC').value || null };
    const result = id ? await API.updateMachine(id, data) : await API.createMachine(data);
    if (result && !result.error) {
      bootstrap.Modal.getInstance(document.getElementById('machineModal')).hide();
      await MachineModal.loadMachines();
    } else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  },
  loadMachines: async () => {
    const rows = await API.getMachines();
    if (!Array.isArray(rows)) return;
    document.getElementById('machineList').innerHTML = rows.map(m => `
      <tr><td>${m.machine_code}</td><td>${m.machine_name}</td><td>${m.wc_name || '-'}</td>
        <td><button class="btn btn-sm btn-link p-0" onclick='MachineModal.edit(${JSON.stringify(m).replace(/'/g, "&apos;")})'>Edit</button></td></tr>
    `).join('') || '<tr><td colspan="4" class="text-center text-muted">None yet</td></tr>';
  }
};

// ===== WAREHOUSE LOCATIONS =====
const LocationModal = {
  show: async () => {
    const warehouses = await API.getWarehouses();
    document.getElementById('locWarehouse').innerHTML = (warehouses || []).map(w => `<option value="${w.id}">${w.warehouse_name}</option>`).join('');
    document.getElementById('locCode').value = ''; document.getElementById('locRack').value = ''; document.getElementById('locBin').value = '';
    new bootstrap.Modal(document.getElementById('locationModal')).show();
  },
  submit: async (event) => {
    event.preventDefault();
    const data = { warehouse_id: document.getElementById('locWarehouse').value, location_code: document.getElementById('locCode').value, rack: document.getElementById('locRack').value, bin: document.getElementById('locBin').value };
    const result = await API.createWarehouseLocation(data);
    if (result && !result.error) {
      bootstrap.Modal.getInstance(document.getElementById('locationModal')).hide();
      await LocationModal.loadLocations();
    } else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  },
  loadLocations: async () => {
    const rows = await API.getWarehouseLocations();
    if (!Array.isArray(rows)) return;
    document.getElementById('locationList').innerHTML = rows.map(l => `
      <tr><td>${l.warehouse_name}</td><td>${l.location_code}</td><td>${l.rack || '-'}</td><td>${l.bin || '-'}</td>
        <td><button class="btn btn-sm btn-link text-danger p-0" onclick="LocationModal.remove(${l.id})">Remove</button></td></tr>
    `).join('') || '<tr><td colspan="5" class="text-center text-muted">None yet</td></tr>';
  },
  remove: async (id) => {
    if (!confirm('Remove this location?')) return;
    const result = await API.deleteWarehouseLocation(id);
    if (result && !result.error) await LocationModal.loadLocations();
  }
};

// ===== ROUTING =====
const RoutingModal = {
  stepCount: 0,
  show: async () => {
    document.getElementById('routingId').value = '';
    document.getElementById('routingModalTitle').textContent = 'New Routing';
    document.getElementById('routingName').value = '';
    const recipes = await API.getProductionRecipes();
    document.getElementById('routingRecipe').innerHTML = '<option value="">None</option>' + (recipes || []).map(r => `<option value="${r.id}">${r.product_name}</option>`).join('');
    document.getElementById('routingStepsContainer').innerHTML = '';
    RoutingModal.stepCount = 0;
    RoutingModal.addStep();
    new bootstrap.Modal(document.getElementById('routingModal')).show();
  },
  addStep: (existing = null) => {
    const idx = RoutingModal.stepCount++;
    const div = document.createElement('div');
    div.className = 'row mb-2 routing-step';
    div.innerHTML = `
      <div class="col-md-5"><input type="text" class="form-control form-control-sm stepOp" placeholder="Operation name" value="${existing ? existing.operation_name : ''}" required></div>
      <div class="col-md-4"><select class="form-control form-control-sm stepWC">${WorkCenterModal.cache.map(w => `<option value="${w.id}" ${existing && existing.work_center_id === w.id ? 'selected' : ''}>${w.wc_name}</option>`).join('')}</select></div>
      <div class="col-md-2"><input type="number" class="form-control form-control-sm stepTime" placeholder="Mins" value="${existing ? existing.standard_time_minutes : ''}"></div>
      <div class="col-md-1"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.routing-step').remove()">✕</button></div>
    `;
    document.getElementById('routingStepsContainer').appendChild(div);
  },
  edit: async (routingId) => {
    const routings = await API.getRoutings();
    const routing = (routings || []).find(r => r.id === routingId);
    if (!routing) return;
    document.getElementById('routingId').value = routing.id;
    document.getElementById('routingModalTitle').textContent = `Edit — ${routing.routing_name}`;
    document.getElementById('routingName').value = routing.routing_name;
    const recipes = await API.getProductionRecipes();
    document.getElementById('routingRecipe').innerHTML = '<option value="">None</option>' + (recipes || []).map(r => `<option value="${r.id}" ${routing.recipe_id === r.id ? 'selected' : ''}>${r.product_name}</option>`).join('');
    document.getElementById('routingStepsContainer').innerHTML = '';
    RoutingModal.stepCount = 0;
    (routing.steps || []).forEach(s => RoutingModal.addStep(s));
    if ((routing.steps || []).length === 0) RoutingModal.addStep();
    new bootstrap.Modal(document.getElementById('routingModal')).show();
  },
  submit: async (event) => {
    event.preventDefault();
    const id = document.getElementById('routingId').value;
    const steps = [];
    document.querySelectorAll('.routing-step').forEach(row => {
      const operation_name = row.querySelector('.stepOp').value;
      if (!operation_name) return;
      steps.push({ operation_name, work_center_id: row.querySelector('.stepWC').value || null, standard_time_minutes: row.querySelector('.stepTime').value || null });
    });
    const data = { routing_name: document.getElementById('routingName').value, recipe_id: document.getElementById('routingRecipe').value || null, steps };
    const result = id ? await API.updateRouting(id, data) : await API.createRouting(data);
    if (result && !result.error) {
      bootstrap.Modal.getInstance(document.getElementById('routingModal')).hide();
      await RoutingModal.loadRoutings();
    } else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  },
  loadRoutings: async () => {
    const routings = await API.getRoutings();
    if (!Array.isArray(routings)) return;
    document.getElementById('routingList').innerHTML = routings.map(r => `
      <div class="card border-0 shadow-sm mb-2">
        <div class="card-body">
          <div class="d-flex justify-content-between">
            <h6>${r.routing_name} ${r.recipe_product_name ? `<span class="text-muted small">(${r.recipe_product_name})</span>` : ''}</h6>
            <div><button class="btn btn-sm btn-outline-primary" onclick="RoutingModal.edit(${r.id})">Edit</button> <button class="btn btn-sm btn-outline-danger" onclick="RoutingModal.remove(${r.id})">Remove</button></div>
          </div>
          <ol class="mb-0 small">${(r.steps || []).map(s => `<li>${s.operation_name} ${s.wc_name ? `— ${s.wc_name}` : ''} ${s.standard_time_minutes ? `(${s.standard_time_minutes} min)` : ''}</li>`).join('')}</ol>
        </div>
      </div>
    `).join('') || '<p class="text-muted">No routings yet</p>';
  },
  remove: async (id) => {
    if (!confirm('Remove this routing?')) return;
    const result = await API.deleteRouting(id);
    if (result && !result.error) await RoutingModal.loadRoutings();
  }
};

// ===== CUSTOMERS =====
const CustomerModal = {
  show: () => {
    document.getElementById('customerId').value = '';
    document.getElementById('customerModalTitle').textContent = 'New Customer';
    ['customerName', 'customerContact', 'customerEmail', 'customerPhone', 'customerAddress', 'customerCity', 'customerState', 'customerPostal', 'customerGstin'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('customerCreditLimit').value = 0;
    new bootstrap.Modal(document.getElementById('customerModal')).show();
  },
  edit: (c) => {
    document.getElementById('customerId').value = c.id;
    document.getElementById('customerModalTitle').textContent = `Edit — ${c.customer_name}`;
    document.getElementById('customerName').value = c.customer_name;
    document.getElementById('customerContact').value = c.contact_person || '';
    document.getElementById('customerEmail').value = c.email || '';
    document.getElementById('customerPhone').value = c.phone || '';
    document.getElementById('customerAddress').value = c.address || '';
    document.getElementById('customerCity').value = c.city || '';
    document.getElementById('customerState').value = c.state || '';
    document.getElementById('customerPostal').value = c.postal_code || '';
    document.getElementById('customerGstin').value = c.gst_number || '';
    document.getElementById('customerCreditLimit').value = c.credit_limit || 0;
    new bootstrap.Modal(document.getElementById('customerModal')).show();
  },
  submit: async (event) => {
    event.preventDefault();
    const id = document.getElementById('customerId').value;
    const data = {
      customer_name: document.getElementById('customerName').value,
      contact_person: document.getElementById('customerContact').value,
      email: document.getElementById('customerEmail').value,
      phone: document.getElementById('customerPhone').value,
      address: document.getElementById('customerAddress').value,
      city: document.getElementById('customerCity').value,
      state: document.getElementById('customerState').value,
      postal_code: document.getElementById('customerPostal').value,
      gst_number: document.getElementById('customerGstin').value,
      credit_limit: document.getElementById('customerCreditLimit').value
    };
    const result = id ? await API.updateCustomer(id, data) : await API.createCustomer(data);
    if (result && !result.error) {
      bootstrap.Modal.getInstance(document.getElementById('customerModal')).hide();
      await CustomerModal.loadCustomers();
    } else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  },
  loadCustomers: async () => {
    const rows = await API.getCustomers();
    if (!Array.isArray(rows)) return;
    document.getElementById('customerList').innerHTML = rows.map(c => `
      <tr><td>${c.customer_code}</td><td>${c.customer_name}</td><td>${c.city || '-'}</td><td>${c.gst_number || '-'}</td><td>₹${parseFloat(c.credit_limit || 0).toLocaleString('en-IN')}</td>
        <td><button class="btn btn-sm btn-link p-0" onclick='CustomerModal.edit(${JSON.stringify(c).replace(/'/g, "&apos;")})'>Edit</button></td></tr>
    `).join('') || '<tr><td colspan="6" class="text-center text-muted">None yet</td></tr>';
  }
};

// ===== TAX MASTER =====
const TaxModal = {
  show: () => {
    document.getElementById('taxId').value = '';
    document.getElementById('taxModalTitle').textContent = 'New Tax Entry';
    document.getElementById('taxName').value = ''; document.getElementById('taxRate').value = ''; document.getElementById('taxHsn').value = ''; document.getElementById('taxClass').value = 'Goods';
    new bootstrap.Modal(document.getElementById('taxModal')).show();
  },
  edit: (t) => {
    document.getElementById('taxId').value = t.id;
    document.getElementById('taxModalTitle').textContent = `Edit — ${t.tax_name}`;
    document.getElementById('taxName').value = t.tax_name;
    document.getElementById('taxRate').value = t.rate;
    document.getElementById('taxHsn').value = t.hsn_sac_code || '';
    document.getElementById('taxClass').value = t.gst_class || 'Goods';
    new bootstrap.Modal(document.getElementById('taxModal')).show();
  },
  submit: async (event) => {
    event.preventDefault();
    const id = document.getElementById('taxId').value;
    const data = { tax_name: document.getElementById('taxName').value, rate: document.getElementById('taxRate').value, hsn_sac_code: document.getElementById('taxHsn').value, gst_class: document.getElementById('taxClass').value };
    const result = id ? await API.updateTaxMaster(id, data) : await API.createTaxMaster(data);
    if (result && !result.error) {
      bootstrap.Modal.getInstance(document.getElementById('taxModal')).hide();
      await TaxModal.loadTax();
    } else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  },
  loadTax: async () => {
    const rows = await API.getTaxMaster();
    if (!Array.isArray(rows)) return;
    document.getElementById('taxList').innerHTML = rows.map(t => `
      <tr><td>${t.tax_name}</td><td>${t.rate}%</td><td>${t.hsn_sac_code || '-'}</td><td>${t.gst_class || '-'}</td>
        <td><button class="btn btn-sm btn-link p-0" onclick='TaxModal.edit(${JSON.stringify(t).replace(/'/g, "&apos;")})'>Edit</button></td></tr>
    `).join('') || '<tr><td colspan="5" class="text-center text-muted">None yet</td></tr>';
  }
};

// ===== EMPLOYEES =====
const EmployeeModal = {
  show: () => {
    document.getElementById('empId').value = '';
    document.getElementById('employeeModalTitle').textContent = 'New Employee';
    ['empName', 'empDept', 'empDesignation', 'empShift', 'empDoj', 'empPhone', 'empEmail'].forEach(id => document.getElementById(id).value = '');
    new bootstrap.Modal(document.getElementById('employeeModal')).show();
  },
  edit: (e) => {
    document.getElementById('empId').value = e.id;
    document.getElementById('employeeModalTitle').textContent = `Edit — ${e.full_name}`;
    document.getElementById('empName').value = e.full_name;
    document.getElementById('empDept').value = e.department || '';
    document.getElementById('empDesignation').value = e.designation || '';
    document.getElementById('empShift').value = e.shift || '';
    document.getElementById('empDoj').value = e.date_of_joining || '';
    document.getElementById('empPhone').value = e.phone || '';
    document.getElementById('empEmail').value = e.email || '';
    new bootstrap.Modal(document.getElementById('employeeModal')).show();
  },
  submit: async (event) => {
    event.preventDefault();
    const id = document.getElementById('empId').value;
    const data = {
      full_name: document.getElementById('empName').value,
      department: document.getElementById('empDept').value,
      designation: document.getElementById('empDesignation').value,
      shift: document.getElementById('empShift').value,
      date_of_joining: document.getElementById('empDoj').value,
      phone: document.getElementById('empPhone').value,
      email: document.getElementById('empEmail').value
    };
    const result = id ? await API.updateEmployee(id, data) : await API.createEmployee(data);
    if (result && !result.error) {
      bootstrap.Modal.getInstance(document.getElementById('employeeModal')).hide();
      await EmployeeModal.loadEmployees();
    } else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  },
  loadEmployees: async () => {
    const rows = await API.getEmployees();
    if (!Array.isArray(rows)) return;
    document.getElementById('employeeList').innerHTML = rows.map(e => `
      <tr><td>${e.employee_code}</td><td>${e.full_name}</td><td>${e.department || '-'}</td><td>${e.designation || '-'}</td><td>${e.shift || '-'}</td>
        <td><button class="btn btn-sm btn-link p-0" onclick='EmployeeModal.edit(${JSON.stringify(e).replace(/'/g, "&apos;")})'>Edit</button></td></tr>
    `).join('') || '<tr><td colspan="6" class="text-center text-muted">None yet</td></tr>';
  }
};
