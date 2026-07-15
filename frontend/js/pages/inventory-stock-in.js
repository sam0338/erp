const StockInPage = {
  render: async () => `
    <div class="row mb-4">
      <div class="col-md-8"><h2><i class="fas fa-arrow-down me-2"></i>Stock In</h2></div>
      <div class="col-md-4 text-end">
        <button class="btn btn-primary" onclick="StockInModal.show()"><i class="fas fa-plus me-1"></i>New Stock In</button>
      </div>
    </div>
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <table class="table table-hover">
          <thead class="table-light"><tr>
            <th>Stock In No</th><th>Material</th><th>Qty</th><th>Warehouse</th>
            <th>Source</th><th>Batch</th><th>Date</th><th>Status</th>
          </tr></thead>
          <tbody id="stockInBody">
            <tr><td colspan="8" class="text-center text-muted">Loading...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal fade" id="stockInModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Record Stock In</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="stockInForm" onsubmit="StockInModal.submit(event)">
            <div class="modal-body">
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Material *</label>
                  <select class="form-control" id="siMaterial" required></select>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Warehouse *</label>
                  <select class="form-control" id="siWarehouse" required></select>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Quantity *</label>
                  <input type="number" class="form-control" id="siQuantity" step="0.01" required>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Unit Cost *</label>
                  <input type="number" class="form-control" id="siUnitCost" step="0.01" required>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Source *</label>
                  <select class="form-control" id="siSource" required>
                    <option>Purchase Order</option><option>Transfer</option><option>Return</option>
                  </select>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Batch Number</label>
                  <input type="text" class="form-control" id="siBatch">
                </div>
              </div>
              <div class="row">
                <div class="col-md-4 mb-3">
                  <label class="form-label">Heat Number</label>
                  <input type="text" class="form-control" id="siHeat" placeholder="For metals/coils">
                </div>
                <div class="col-md-4 mb-3">
                  <label class="form-label">Coil Number</label>
                  <input type="text" class="form-control" id="siCoil">
                </div>
                <div class="col-md-4 mb-3">
                  <label class="form-label">Serial Number</label>
                  <input type="text" class="form-control" id="siSerial">
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Expiry Date</label>
                <input type="date" class="form-control" id="siExpiry">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Record Stock In</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  init: async () => {
    const materials = await fetch('/api/purchase/materials', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json()).catch(() => []);
    const warehouses = await fetch('/api/inventory/warehouses', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json()).catch(() => []);
    const stocks = await fetch('/api/inventory/stock-in', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json()).catch(() => []);

    document.getElementById('siMaterial').innerHTML = '<option value="">Select</option>' + materials.map(m => `<option value="${m.id}">${m.material_name}</option>`).join('');
    document.getElementById('siWarehouse').innerHTML = '<option value="">Select</option>' + warehouses.map(w => `<option value="${w.id}">${w.warehouse_name}</option>`).join('');

    const html = stocks.length > 0 ? stocks.map(s => `<tr>
      <td>${s.stock_in_number}</td><td>${s.material_name}</td><td>${s.quantity}</td>
      <td>${s.warehouse_name}</td><td>${s.source}</td><td>${s.batch_number || '-'}</td>
      <td>${new Date(s.received_date).toLocaleDateString('en-IN')}</td>
      <td><span class="badge bg-success">${s.status}</span></td></tr>`).join('') : '<tr><td colspan="8" class="text-center text-muted">No stock in records</td></tr>';
    document.getElementById('stockInBody').innerHTML = html;
  }
};

const StockInModal = {
  modal: null,
  show: () => { StockInModal.modal = new bootstrap.Modal(document.getElementById('stockInModal')); StockInModal.modal.show(); },
  submit: async (event) => {
    event.preventDefault();
    const data = {
      material_id: parseInt(document.getElementById('siMaterial').value),
      warehouse_id: parseInt(document.getElementById('siWarehouse').value),
      quantity: parseFloat(document.getElementById('siQuantity').value),
      unit_cost: parseFloat(document.getElementById('siUnitCost').value),
      source: document.getElementById('siSource').value,
      batch_number: document.getElementById('siBatch').value,
      heat_number: document.getElementById('siHeat').value,
      coil_number: document.getElementById('siCoil').value,
      serial_number: document.getElementById('siSerial').value,
      expiry_date: document.getElementById('siExpiry').value
    };
    const result = await fetch('/api/inventory/stock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify(data)
    }).then(r => r.json()).catch(() => null);
    if (result && !result.error) { StockInModal.modal.hide(); alert('Stock recorded: ' + result.stock_in_number); StockInPage.init(); }
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  }
};
