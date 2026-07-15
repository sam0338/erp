const StockTransferPage = {
  render: async () => `
    <div class="row mb-4">
      <div class="col-md-8"><h2><i class="fas fa-exchange me-2"></i>Stock Transfer</h2></div>
      <div class="col-md-4 text-end">
        <button class="btn btn-primary" onclick="StockTransferModal.show()"><i class="fas fa-plus me-1"></i>New Transfer</button>
      </div>
    </div>
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <table class="table table-hover">
          <thead class="table-light"><tr>
            <th>Transfer No</th><th>Material</th><th>Qty</th><th>From Warehouse</th>
            <th>To Warehouse</th><th>Date</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody id="transferBody">
            <tr><td colspan="8" class="text-center text-muted">Loading...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal fade" id="transferModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Record Stock Transfer</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="transferForm" onsubmit="StockTransferModal.submit(event)">
            <div class="modal-body">
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Material *</label>
                  <select class="form-control" id="stMaterial" required></select>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Quantity *</label>
                  <input type="number" class="form-control" id="stQuantity" step="0.01" required>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">From Warehouse *</label>
                  <select class="form-control" id="stFromWarehouse" required></select>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">To Warehouse *</label>
                  <select class="form-control" id="stToWarehouse" required></select>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Remarks</label>
                <textarea class="form-control" id="stRemarks" rows="2"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Create Transfer</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  init: async () => {
    const materials = await API.getMaterials() || [];
    const warehouses = await API.getWarehouses() || [];
    const transfers = await API.getStockTransferList() || [];

    document.getElementById('stMaterial').innerHTML = '<option value="">Select</option>' + materials.map(m => `<option value="${m.id}">${m.material_name}</option>`).join('');
    const whOptions = warehouses.map(w => `<option value="${w.id}">${w.warehouse_name}</option>`).join('');
    document.getElementById('stFromWarehouse').innerHTML = '<option value="">Select</option>' + whOptions;
    document.getElementById('stToWarehouse').innerHTML = '<option value="">Select</option>' + whOptions;

    const html = transfers.length > 0 ? transfers.map(t => `<tr>
      <td>${t.transfer_number}</td><td>${t.material_name}</td><td>${t.quantity}</td>
      <td>${t.from_warehouse_name}</td><td>${t.to_warehouse_name}</td>
      <td>${new Date(t.transfer_date).toLocaleDateString('en-IN')}</td>
      <td><span class="badge ${t.status === 'In Transit' ? 'bg-warning' : 'bg-success'}">${t.status}</span></td>
      <td>${t.status === 'In Transit' ? `<button class="btn btn-sm btn-success" onclick="StockTransferModal.receive(${t.id})">Receive</button>` : '-'}</td></tr>`).join('') : '<tr><td colspan="8" class="text-center text-muted">No transfers</td></tr>';
    document.getElementById('transferBody').innerHTML = html;
  }
};

const StockTransferModal = {
  modal: null,
  show: () => { StockTransferModal.modal = new bootstrap.Modal(document.getElementById('transferModal')); StockTransferModal.modal.show(); },
  submit: async (event) => {
    event.preventDefault();
    const data = {
      material_id: parseInt(document.getElementById('stMaterial').value),
      from_warehouse_id: parseInt(document.getElementById('stFromWarehouse').value),
      to_warehouse_id: parseInt(document.getElementById('stToWarehouse').value),
      quantity: parseFloat(document.getElementById('stQuantity').value),
      remarks: document.getElementById('stRemarks').value
    };
    const result = await API.createStockTransfer(data);
    if (!result.error) { StockTransferModal.modal.hide(); alert('Transfer created: ' + result.transfer_number); StockTransferPage.init(); }
    else { alert('Error: ' + result.error); }
  },
  receive: async (transferId) => {
    if (confirm('Mark this transfer as received?')) {
      const result = await API.receiveStockTransfer(transferId);
      if (!result.error) { alert('Transfer received'); StockTransferPage.init(); }
      else { alert('Error: ' + result.error); }
    }
  }
};
