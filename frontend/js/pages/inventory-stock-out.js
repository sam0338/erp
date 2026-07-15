const StockOutPage = {
  render: async () => `
    <div class="row mb-4">
      <div class="col-md-8"><h2><i class="fas fa-arrow-up me-2"></i>Stock Out</h2></div>
      <div class="col-md-4 text-end">
        <button class="btn btn-primary" onclick="StockOutModal.show()"><i class="fas fa-plus me-1"></i>New Stock Out</button>
      </div>
    </div>
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <table class="table table-hover">
          <thead class="table-light"><tr>
            <th>Stock Out No</th><th>Material</th><th>Qty</th><th>Warehouse</th>
            <th>Purpose</th><th>Issued To</th><th>Date</th><th>Status</th>
          </tr></thead>
          <tbody id="stockOutBody">
            <tr><td colspan="8" class="text-center text-muted">Loading...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal fade" id="stockOutModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Record Stock Out</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="stockOutForm" onsubmit="StockOutModal.submit(event)">
            <div class="modal-body">
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Material *</label>
                  <select class="form-control" id="soMaterial" required></select>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Warehouse *</label>
                  <select class="form-control" id="soWarehouse" required></select>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Quantity *</label>
                  <input type="number" class="form-control" id="soQuantity" step="0.01" required>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Purpose *</label>
                  <select class="form-control" id="soPurpose" required>
                    <option>Production</option><option>Sales</option><option>Sample</option><option>Scrap</option><option>Return</option>
                  </select>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Issued To</label>
                <input type="text" class="form-control" id="soIssuedTo">
              </div>
              <div class="mb-3">
                <label class="form-label">Remarks</label>
                <textarea class="form-control" id="soRemarks" rows="2"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Record Stock Out</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  init: async () => {
    const materials = await API.getMaterials() || [];
    const warehouses = await API.getWarehouses() || [];
    const stocks = await API.getStockOutList() || [];

    document.getElementById('soMaterial').innerHTML = '<option value="">Select</option>' + materials.map(m => `<option value="${m.id}">${m.material_name}</option>`).join('');
    document.getElementById('soWarehouse').innerHTML = '<option value="">Select</option>' + warehouses.map(w => `<option value="${w.id}">${w.warehouse_name}</option>`).join('');

    const html = stocks.length > 0 ? stocks.map(s => `<tr>
      <td>${s.stock_out_number}</td><td>${s.material_name}</td><td>${s.quantity}</td>
      <td>${s.warehouse_name}</td><td>${s.purpose}</td><td>${s.issued_to || '-'}</td>
      <td>${new Date(s.issued_date).toLocaleDateString('en-IN')}</td>
      <td><span class="badge bg-info">${s.status}</span></td></tr>`).join('') : '<tr><td colspan="8" class="text-center text-muted">No stock out records</td></tr>';
    document.getElementById('stockOutBody').innerHTML = html;
  }
};

const StockOutModal = {
  modal: null,
  show: () => { StockOutModal.modal = new bootstrap.Modal(document.getElementById('stockOutModal')); StockOutModal.modal.show(); },
  submit: async (event) => {
    event.preventDefault();
    const data = {
      material_id: parseInt(document.getElementById('soMaterial').value),
      warehouse_id: parseInt(document.getElementById('soWarehouse').value),
      quantity: parseFloat(document.getElementById('soQuantity').value),
      purpose: document.getElementById('soPurpose').value,
      issued_to: document.getElementById('soIssuedTo').value,
      remarks: document.getElementById('soRemarks').value
    };
    const result = await API.createStockOut(data);
    if (!result.error) { StockOutModal.modal.hide(); alert('Stock out recorded: ' + result.stock_out_number); StockOutPage.init(); }
    else { alert('Error: ' + result.error); }
  }
};
