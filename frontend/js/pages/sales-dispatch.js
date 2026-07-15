const SalesDispatchPage = {
  render: async () => `
    <div class="row mb-4">
      <div class="col-md-8">
        <h2><i class="fas fa-truck-loading me-2"></i>Sales &amp; Dispatch</h2>
        <p class="text-muted mb-0">Quotation → Sales Order → Dispatch Planning → Delivery Challan → Invoice, with customer history and returns.</p>
      </div>
    </div>

    <div class="row" id="salesKpis">
      <div class="col-md-2 mb-3"><div class="card border-0 shadow-sm"><div class="card-body"><p class="text-muted small mb-1">Quotations</p><h4 id="kpiQuotations">-</h4></div></div></div>
      <div class="col-md-2 mb-3"><div class="card border-0 shadow-sm"><div class="card-body"><p class="text-muted small mb-1">Pending Orders</p><h4 id="kpiPendingOrders">-</h4></div></div></div>
      <div class="col-md-3 mb-3"><div class="card border-0 shadow-sm"><div class="card-body"><p class="text-muted small mb-1">Dispatched This Month</p><h4 id="kpiDispatched">-</h4></div></div></div>
      <div class="col-md-2 mb-3"><div class="card border-0 shadow-sm"><div class="card-body"><p class="text-muted small mb-1">Pending Returns</p><h4 id="kpiReturns">-</h4></div></div></div>
      <div class="col-md-3 mb-3"><div class="card border-0 shadow-sm"><div class="card-body"><p class="text-muted small mb-1">Unpaid Invoice Value</p><h4 id="kpiUnpaid">-</h4></div></div></div>
    </div>

    <ul class="nav nav-tabs mb-3" id="salesTabs">
      <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#sdDashboard">Dashboard</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#sdQuotations">Quotations</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#sdOrders">Sales Orders</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#sdPlans">Dispatch Planning</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#sdChallans">Delivery Challans</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#sdPacking">Packing Lists</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#sdReturns">Sales Returns</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#sdInvoices">Invoices</button></li>
    </ul>

    <div class="tab-content">
      <!-- DASHBOARD -->
      <div class="tab-pane fade show active" id="sdDashboard">
        <div class="row">
          <div class="col-md-7 mb-3">
            <div class="card border-0 shadow-sm">
              <div class="card-header fw-bold">Pending Orders (not yet fully dispatched)</div>
              <div class="card-body table-responsive">
                <table class="table table-sm table-hover mb-0">
                  <thead class="table-light"><tr><th>SO No</th><th>Customer</th><th>Status</th><th>Ordered/Dispatched</th><th>Expected Delivery</th></tr></thead>
                  <tbody id="dashPendingOrders"><tr><td colspan="5" class="text-center text-muted">Loading...</td></tr></tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="col-md-5 mb-3">
            <div class="card border-0 shadow-sm">
              <div class="card-header fw-bold">Upcoming Dispatch Plans</div>
              <div class="card-body table-responsive">
                <table class="table table-sm table-hover mb-0">
                  <thead class="table-light"><tr><th>Plan</th><th>SO</th><th>Customer</th><th>Date</th><th>Status</th></tr></thead>
                  <tbody id="dashUpcomingDispatch"><tr><td colspan="5" class="text-center text-muted">Loading...</td></tr></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div class="card border-0 shadow-sm">
          <div class="card-header fw-bold">Customer Dispatch History</div>
          <div class="card-body">
            <select class="form-control form-control-sm w-auto d-inline-block mb-2" id="dispatchHistoryCustomer" onchange="SalesDispatchPage.loadCustomerHistory()"></select>
            <div id="customerHistoryTable"></div>
          </div>
        </div>
      </div>

      <!-- QUOTATIONS -->
      <div class="tab-pane fade" id="sdQuotations">
        <div class="d-flex justify-content-between mb-2">
          <p class="text-muted small mb-0">Customer quotations. Accept and convert one directly into a sales order.</p>
          <button class="btn btn-sm btn-primary" onclick="QuotationModal.show()"><i class="fas fa-plus me-1"></i>New Quotation</button>
        </div>
        <div class="card border-0 shadow-sm">
          <div class="card-body table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light"><tr><th>Quotation No</th><th>Customer</th><th>Date</th><th>Valid Until</th><th>Value</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody id="quotationsBody"><tr><td colspan="7" class="text-center text-muted">Loading...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- SALES ORDERS -->
      <div class="tab-pane fade" id="sdOrders">
        <div class="d-flex justify-content-between mb-2">
          <p class="text-muted small mb-0">Confirmed customer orders. Status tracks Draft → Confirmed → Ready to Dispatch → Partially/Fully Dispatched → Completed.</p>
          <button class="btn btn-sm btn-primary" onclick="SalesOrderModal.show()"><i class="fas fa-plus me-1"></i>New Sales Order</button>
        </div>
        <div class="card border-0 shadow-sm">
          <div class="card-body table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light"><tr><th>SO No</th><th>Customer</th><th>Order Date</th><th>Expected Delivery</th><th>Ordered/Dispatched</th><th>Value</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody id="ordersBody"><tr><td colspan="8" class="text-center text-muted">Loading...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- DISPATCH PLANNING -->
      <div class="tab-pane fade" id="sdPlans">
        <div class="d-flex justify-content-between mb-2">
          <p class="text-muted small mb-0">Plan what goes out, from where, and when — before cutting the actual delivery challan.</p>
          <button class="btn btn-sm btn-primary" onclick="DispatchPlanModal.show()"><i class="fas fa-plus me-1"></i>New Dispatch Plan</button>
        </div>
        <div class="card border-0 shadow-sm">
          <div class="card-body table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light"><tr><th>Plan No</th><th>SO</th><th>Customer</th><th>Warehouse</th><th>Planned Date</th><th>Vehicle</th><th>Status</th><th>Items</th></tr></thead>
              <tbody id="plansBody"><tr><td colspan="8" class="text-center text-muted">Loading...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- DELIVERY CHALLANS -->
      <div class="tab-pane fade" id="sdChallans">
        <div class="d-flex justify-content-between mb-2">
          <p class="text-muted small mb-0">Cutting a challan deducts real stock (FIFO) and is the actual dispatch note.</p>
          <button class="btn btn-sm btn-primary" onclick="ChallanModal.show()"><i class="fas fa-plus me-1"></i>New Delivery Challan</button>
        </div>
        <div class="card border-0 shadow-sm">
          <div class="card-body table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light"><tr><th>Challan No</th><th>SO</th><th>Customer</th><th>Warehouse</th><th>Date</th><th>Vehicle</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody id="challansBody"><tr><td colspan="8" class="text-center text-muted">Loading...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- PACKING LISTS -->
      <div class="tab-pane fade" id="sdPacking">
        <div class="d-flex justify-content-between mb-2">
          <p class="text-muted small mb-0">Package-wise breakdown (carton/bundle/coil count, weights) for a challan.</p>
          <button class="btn btn-sm btn-primary" onclick="PackingListModal.show()"><i class="fas fa-plus me-1"></i>New Packing List</button>
        </div>
        <div class="card border-0 shadow-sm">
          <div class="card-body table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light"><tr><th>Packing List No</th><th>Challan</th><th>Packages</th><th>Gross/Net Wt</th><th>Actions</th></tr></thead>
              <tbody id="packingBody"><tr><td colspan="5" class="text-center text-muted">Loading...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- SALES RETURNS -->
      <div class="tab-pane fade" id="sdReturns">
        <div class="d-flex justify-content-between mb-2">
          <p class="text-muted small mb-0">Goods returned by a customer. Accepting a "Good" condition line posts it back into usable stock.</p>
          <button class="btn btn-sm btn-primary" onclick="SalesReturnModal.show()"><i class="fas fa-plus me-1"></i>New Sales Return</button>
        </div>
        <div class="card border-0 shadow-sm">
          <div class="card-body table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light"><tr><th>Return No</th><th>Customer</th><th>SO</th><th>Warehouse</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody id="returnsBody"><tr><td colspan="7" class="text-center text-muted">Loading...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- INVOICES -->
      <div class="tab-pane fade" id="sdInvoices">
        <div class="d-flex justify-content-between mb-2">
          <p class="text-muted small mb-0">Real GST invoicing — pick a customer, consolidate whatever's been dispatched across their orders, generate one tax invoice.</p>
          <button class="btn btn-sm btn-primary" onclick="SalesInvoiceModal.show()"><i class="fas fa-plus me-1"></i>Generate Invoice</button>
        </div>
        <div class="card border-0 shadow-sm">
          <div class="card-body table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light"><tr><th>Invoice No</th><th>Customer</th><th>Orders</th><th>Taxable</th><th>Tax</th><th>Grand Total</th><th>Paid</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody id="invoicesBody"><tr><td colspan="9" class="text-center text-muted">Loading...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    ${SalesDispatchPage.modalsHtml()}
  `,

  modalsHtml: () => `
    <!-- Quotation Modal -->
    <div class="modal fade" id="quotationModal" tabindex="-1">
      <div class="modal-dialog modal-lg"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">New Quotation</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="QuotationModal.submit(event)">
          <div class="modal-body">
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Customer *</label><select class="form-control" id="qtCustomer" required></select></div>
              <div class="col-md-6 mb-2"><label class="form-label">Valid Until</label><input type="date" class="form-control" id="qtValidUntil"></div>
            </div>
            <label class="form-label fw-bold">Items</label>
            <div id="qtItemsContainer"></div>
            <button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick="QuotationModal.addItem()"><i class="fas fa-plus me-1"></i>Add Item</button>
            <div class="mb-2 mt-3"><label class="form-label">Notes</label><textarea class="form-control" id="qtNotes" rows="2"></textarea></div>
            <div class="text-end small" id="qtTotalsPreview"></div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Save Quotation</button></div>
        </form>
      </div></div>
    </div>

    <!-- Sales Order Modal -->
    <div class="modal fade" id="soModal" tabindex="-1">
      <div class="modal-dialog modal-lg"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">New Sales Order</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="SalesOrderModal.submit(event)">
          <div class="modal-body">
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Customer *</label><select class="form-control" id="soCustomer" required></select></div>
              <div class="col-md-6 mb-2"><label class="form-label">Expected Delivery Date</label><input type="date" class="form-control" id="soExpectedDelivery"></div>
            </div>
            <div class="row">
              <div class="col-md-4 mb-2"><label class="form-label">Payment Term</label><select class="form-control" id="soPaymentTerm"></select></div>
              <div class="col-md-4 mb-2"><label class="form-label">Transporter</label><select class="form-control" id="soTransporter"></select></div>
              <div class="col-md-4 mb-2"><label class="form-label">Destination</label><input type="text" class="form-control" id="soDestination"></div>
            </div>
            <label class="form-label fw-bold">Items</label>
            <div id="soItemsContainer"></div>
            <button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick="SalesOrderModal.addItem()"><i class="fas fa-plus me-1"></i>Add Item</button>
            <div class="mb-2 mt-3"><label class="form-label">Special Remarks</label><textarea class="form-control" id="soRemarks" rows="2"></textarea></div>
            <div class="text-end small" id="soTotalsPreview"></div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Save Sales Order</button></div>
        </form>
      </div></div>
    </div>

    <!-- Convert Quotation Modal -->
    <div class="modal fade" id="convertModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Convert Quotation to Sales Order</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="ConvertModal.submit(event)">
          <div class="modal-body">
            <input type="hidden" id="convertQuotationId">
            <div class="mb-2"><label class="form-label">Expected Delivery Date</label><input type="date" class="form-control" id="convExpectedDelivery"></div>
            <div class="mb-2"><label class="form-label">Payment Term</label><select class="form-control" id="convPaymentTerm"></select></div>
            <div class="mb-2"><label class="form-label">Transporter</label><select class="form-control" id="convTransporter"></select></div>
            <div class="mb-2"><label class="form-label">Destination</label><input type="text" class="form-control" id="convDestination"></div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Convert</button></div>
        </form>
      </div></div>
    </div>

    <!-- Dispatch Plan Modal -->
    <div class="modal fade" id="planModal" tabindex="-1">
      <div class="modal-dialog modal-lg"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">New Dispatch Plan</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="DispatchPlanModal.submit(event)">
          <div class="modal-body">
            <div class="mb-2"><label class="form-label">Sales Order *</label><select class="form-control" id="planSO" required onchange="DispatchPlanModal.onOrderChange()"></select></div>
            <div class="row">
              <div class="col-md-4 mb-2"><label class="form-label">Warehouse</label><select class="form-control" id="planWarehouse"></select></div>
              <div class="col-md-4 mb-2"><label class="form-label">Planned Date</label><input type="date" class="form-control" id="planDate"></div>
              <div class="col-md-4 mb-2"><label class="form-label">Vehicle Number</label><input type="text" class="form-control" id="planVehicle"></div>
            </div>
            <div class="mb-2"><label class="form-label">Transporter</label><select class="form-control" id="planTransporter"></select></div>
            <label class="form-label fw-bold">Items to Plan (pending balance shown)</label>
            <div id="planItemsContainer" class="small text-muted">Select a sales order first</div>
            <div class="mb-2 mt-2"><label class="form-label">Notes</label><textarea class="form-control" id="planNotes" rows="2"></textarea></div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Create Plan</button></div>
        </form>
      </div></div>
    </div>

    <!-- Challan Modal -->
    <div class="modal fade" id="challanModal" tabindex="-1">
      <div class="modal-dialog modal-lg"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">New Delivery Challan</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="ChallanModal.submit(event)">
          <div class="modal-body">
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Sales Order *</label><select class="form-control" id="chSO" required onchange="ChallanModal.onOrderChange()"></select></div>
              <div class="col-md-6 mb-2"><label class="form-label">Warehouse *</label><select class="form-control" id="chWarehouse" required></select></div>
            </div>
            <div class="row">
              <div class="col-md-4 mb-2"><label class="form-label">Vehicle Number</label><input type="text" class="form-control" id="chVehicle"></div>
              <div class="col-md-4 mb-2"><label class="form-label">Driver Name</label><input type="text" class="form-control" id="chDriverName"></div>
              <div class="col-md-4 mb-2"><label class="form-label">Driver Phone</label><input type="text" class="form-control" id="chDriverPhone"></div>
            </div>
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Transporter</label><select class="form-control" id="chTransporter"></select></div>
              <div class="col-md-6 mb-2"><label class="form-label">E-Way Bill Number</label><input type="text" class="form-control" id="chEwayBill"></div>
            </div>
            <div class="mb-2"><label class="form-label">Destination</label><input type="text" class="form-control" id="chDestination"></div>
            <label class="form-label fw-bold">Items to Dispatch (pending balance shown)</label>
            <div id="chItemsContainer" class="small text-muted">Select a sales order first</div>
            <div class="alert alert-warning small mt-2">Confirming will deduct real stock (FIFO by batch) from the selected warehouse immediately.</div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Dispatch &amp; Create Challan</button></div>
        </form>
      </div></div>
    </div>

    <!-- Packing List Modal -->
    <div class="modal fade" id="packingModal" tabindex="-1">
      <div class="modal-dialog modal-lg"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">New Packing List</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="PackingListModal.submit(event)">
          <div class="modal-body">
            <div class="mb-2"><label class="form-label">Delivery Challan *</label><select class="form-control" id="pkChallan" required></select></div>
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Gross Weight (Kg)</label><input type="number" class="form-control" id="pkGrossWeight" step="0.01"></div>
              <div class="col-md-6 mb-2"><label class="form-label">Net Weight (Kg)</label><input type="number" class="form-control" id="pkNetWeight" step="0.01"></div>
            </div>
            <label class="form-label fw-bold">Packages</label>
            <div id="pkItemsContainer"></div>
            <button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick="PackingListModal.addPackage()"><i class="fas fa-plus me-1"></i>Add Package</button>
            <div class="mb-2 mt-3"><label class="form-label">Notes</label><textarea class="form-control" id="pkNotes" rows="2"></textarea></div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Save Packing List</button></div>
        </form>
      </div></div>
    </div>

    <!-- Sales Return Modal -->
    <div class="modal fade" id="returnModal" tabindex="-1">
      <div class="modal-dialog modal-lg"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">New Sales Return</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="SalesReturnModal.submit(event)">
          <div class="modal-body">
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Customer *</label><select class="form-control" id="rtCustomer" required></select></div>
              <div class="col-md-6 mb-2"><label class="form-label">Sales Order (optional)</label><select class="form-control" id="rtSO"><option value="">— None —</option></select></div>
            </div>
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Return-to Warehouse *</label><select class="form-control" id="rtWarehouse" required></select></div>
              <div class="col-md-6 mb-2"><label class="form-label">Reason</label><input type="text" class="form-control" id="rtReason"></div>
            </div>
            <label class="form-label fw-bold">Items</label>
            <div id="rtItemsContainer"></div>
            <button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick="SalesReturnModal.addItem()"><i class="fas fa-plus me-1"></i>Add Item</button>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Record Return</button></div>
        </form>
      </div></div>
    </div>

    <!-- Invoice Modal -->
    <div class="modal fade" id="invoiceModal" tabindex="-1">
      <div class="modal-dialog modal-xl"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Generate Invoice</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="SalesInvoiceModal.submit(event)">
          <div class="modal-body">
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">Customer *</label><select class="form-control" id="invCustomer" required onchange="SalesInvoiceModal.onCustomerChange()"></select></div>
              <div class="col-md-3 mb-2"><label class="form-label">Invoice Date</label><input type="date" class="form-control" id="invDate"></div>
              <div class="col-md-3 mb-2"><label class="form-label">Due Date</label><input type="date" class="form-control" id="invDueDate"></div>
            </div>
            <div class="form-text mb-2">Pick a customer to see everything dispatched to them that hasn't been invoiced yet — across all their orders. Tick what to bill; one invoice can consolidate several orders.</div>
            <div id="billableItemsContainer" class="mb-2"><div class="text-muted small">Select a customer first</div></div>
            <div class="row">
              <div class="col-md-6 mb-2"><label class="form-label">External Reference (Tally/Busy)</label><input type="text" class="form-control" id="invExternalRef"></div>
              <div class="col-md-6 mb-2"><label class="form-label">Notes</label><input type="text" class="form-control" id="invNotes"></div>
            </div>
            <div id="invoiceTotalsPreview" class="text-end small border-top pt-2"></div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Generate Invoice</button></div>
        </form>
      </div></div>
    </div>

    <!-- Record Payment Modal -->
    <div class="modal fade" id="paymentModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Record Payment</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <form onsubmit="PaymentModal.submit(event)">
          <div class="modal-body">
            <input type="hidden" id="paymentInvoiceId">
            <div class="mb-2"><label class="form-label">Amount Received *</label><input type="number" class="form-control" id="paymentAmount" step="0.01" required></div>
            <div class="mb-2"><label class="form-label">Payment Mode</label>
              <select class="form-control" id="paymentMode"><option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>UPI</option><option>Card</option></select>
            </div>
            <div class="mb-2"><label class="form-label">Reference Number</label><input type="text" class="form-control" id="paymentReference"></div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary">Record</button></div>
        </form>
      </div></div>
    </div>
    <!-- Availability Check Modal -->
    <div class="modal fade" id="availabilityModal" tabindex="-1">
      <div class="modal-dialog modal-xl"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Order Fulfillment Check</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body" id="availabilityBody"><div class="text-center text-muted py-4">Checking...</div></div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button></div>
      </div></div>
    </div>
  `,

  masters: { customers: [], materials: [], warehouses: [], orders: [], paymentTerms: [], transporters: [] },

  init: async () => {
    await SalesDispatchPage.loadMasters();
    await Promise.all([
      SalesDispatchPage.loadDashboard(),
      SalesDispatchPage.loadQuotations(),
      SalesDispatchPage.loadOrders(),
      SalesDispatchPage.loadPlans(),
      SalesDispatchPage.loadChallans(),
      SalesDispatchPage.loadPacking(),
      SalesDispatchPage.loadReturns(),
      SalesDispatchPage.loadInvoices()
    ]);
  },

  loadMasters: async () => {
    const [customers, materials, warehouses, orders, paymentTerms, transporters] = await Promise.all([
      API.getCustomers(), API.getMaterials(), API.getWarehouses(), API.getSalesOrders(),
      API.getSimpleMasters('payment_term'), API.getSimpleMasters('transporter')
    ]);
    // Array.isArray (not `|| []`) matters here: a failed call returns a
    // truthy {error: "..."} object, and `{error} || []` still keeps the
    // error object — which then throws "customers.map is not a function"
    // deep inside a dropdown render and silently kills the entire page
    // init with no visible error. Array.isArray catches that case safely.
    const asArray = (v) => Array.isArray(v) ? v : [];
    SalesDispatchPage.masters = {
      customers: asArray(customers), materials: asArray(materials), warehouses: asArray(warehouses),
      orders: asArray(orders), paymentTerms: asArray(paymentTerms), transporters: asArray(transporters)
    };
    const loadErrors = [customers, materials, warehouses, orders, paymentTerms, transporters]
      .filter(v => v && !Array.isArray(v) && v.error).map(v => v.error);
    if (loadErrors.length) {
      console.error('Sales & Dispatch: some reference data failed to load:', loadErrors);
    }
    const dhSel = document.getElementById('dispatchHistoryCustomer');
    if (dhSel) dhSel.innerHTML = '<option value="">— Select a customer —</option>' + SalesDispatchPage.masters.customers.map(c => `<option value="${c.id}">${c.customer_name}</option>`).join('');
  },

  customerOptions: () => SalesDispatchPage.masters.customers.map(c => `<option value="${c.id}">${c.customer_name}${c.city ? ' — ' + c.city : ''}</option>`).join(''),
  materialOptions: () => SalesDispatchPage.masters.materials.map(m => `<option value="${m.id}" data-unit="${m.unit_of_measure || ''}">${m.material_name} (${m.material_code})</option>`).join(''),
  warehouseOptions: () => SalesDispatchPage.masters.warehouses.map(w => `<option value="${w.id}">${w.warehouse_name}</option>`).join(''),
  orderOptions: () => SalesDispatchPage.masters.orders.map(o => `<option value="${o.id}">${o.so_number} — ${o.customer_name}</option>`).join(''),
  paymentTermOptions: () => '<option value="">— None —</option>' + SalesDispatchPage.masters.paymentTerms.map(p => `<option value="${p.name}">${p.name}</option>`).join(''),
  transporterOptions: () => '<option value="">— None —</option>' + SalesDispatchPage.masters.transporters.map(t => `<option value="${t.name}">${t.name}</option>`).join(''),

  fmt: (n) => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),

  // Renders either the mapped rows, a clear error message (if the API call
  // failed), or an empty-state message — so a broken API call never looks
  // identical to "there's just nothing here yet".
  rowsOrMessage: (rows, colspan, emptyMsg, mapFn) => {
    if (!Array.isArray(rows)) {
      const errMsg = (rows && rows.error) ? rows.error : 'Could not load this data — check the server is running and the browser console for details.';
      return `<tr><td colspan="${colspan}" class="text-center text-danger py-3"><i class="fas fa-triangle-exclamation me-1"></i>${errMsg}</td></tr>`;
    }
    if (rows.length === 0) return `<tr><td colspan="${colspan}" class="text-center text-muted">${emptyMsg}</td></tr>`;
    return rows.map(mapFn).join('');
  },

  // ---- Dashboard ----
  loadDashboard: async () => {
    const data = await API.getSalesDashboard();
    if (!data || data.error) {
      const msg = (data && data.error) || 'Could not load the sales dashboard — check the server console.';
      ['dashPendingOrders'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = `<tr><td colspan="5" class="text-danger text-center">${msg}</td></tr>`; });
      document.getElementById('dashUpcomingDispatch').innerHTML = `<tr><td colspan="5" class="text-danger text-center">${msg}</td></tr>`;
      return;
    }
    document.getElementById('kpiQuotations').textContent = data.counts.total_quotations;
    document.getElementById('kpiPendingOrders').textContent = data.counts.pending_orders;
    document.getElementById('kpiDispatched').textContent = data.counts.dispatched_this_month;
    document.getElementById('kpiReturns').textContent = data.counts.pending_returns;
    document.getElementById('kpiUnpaid').textContent = SalesDispatchPage.fmt(data.counts.unpaid_invoices_value);

    document.getElementById('dashPendingOrders').innerHTML = data.pending_orders.length ? data.pending_orders.map(o => `
      <tr><td>${o.so_number}</td><td>${o.customer_name}</td><td><span class="badge bg-info">${o.status}</span></td>
      <td>${o.dispatched_qty}/${o.ordered_qty}</td><td>${o.expected_delivery_date ? new Date(o.expected_delivery_date).toLocaleDateString('en-IN') : '-'}</td></tr>
    `).join('') : '<tr><td colspan="5" class="text-center text-muted">No pending orders</td></tr>';

    document.getElementById('dashUpcomingDispatch').innerHTML = data.upcoming_dispatch.length ? data.upcoming_dispatch.map(p => `
      <tr><td>${p.plan_number}</td><td>${p.so_number || '-'}</td><td>${p.customer_name || '-'}</td>
      <td>${p.planned_date ? new Date(p.planned_date).toLocaleDateString('en-IN') : '-'}</td><td><span class="badge bg-secondary">${p.status}</span></td></tr>
    `).join('') : '<tr><td colspan="5" class="text-center text-muted">No upcoming dispatch plans</td></tr>';
  },

  loadCustomerHistory: async () => {
    const customerId = document.getElementById('dispatchHistoryCustomer').value;
    const container = document.getElementById('customerHistoryTable');
    if (!customerId) { container.innerHTML = ''; return; }
    const history = await API.getCustomerDispatchHistory(customerId);
    if (!history || history.error || history.length === 0) { container.innerHTML = '<div class="text-muted small">No dispatch history for this customer yet.</div>'; return; }
    container.innerHTML = `
      <table class="table table-sm table-bordered mb-0">
        <thead class="table-light"><tr><th>Challan</th><th>SO</th><th>Date</th><th>Vehicle</th><th>Status</th><th>Items</th></tr></thead>
        <tbody>${history.map(c => `
          <tr><td>${c.challan_number}</td><td>${c.so_number || '-'}</td><td>${new Date(c.challan_date).toLocaleDateString('en-IN')}</td>
          <td>${c.vehicle_number || '-'}</td><td><span class="badge bg-secondary">${c.status}</span></td>
          <td class="small">${(c.items || []).map(i => `${i.material_name}: ${i.quantity}`).join(', ')}</td></tr>
        `).join('')}</tbody>
      </table>`;
  },

  // ---- Quotations ----
  loadQuotations: async () => {
    const rows = await API.getQuotations();
    SalesDispatchPage._quotations = Array.isArray(rows) ? rows : [];
    document.getElementById('quotationsBody').innerHTML = SalesDispatchPage.rowsOrMessage(rows, 7, 'No quotations yet', q => `
      <tr>
        <td>${q.quotation_number}</td><td>${q.customer_name}</td><td>${new Date(q.quotation_date).toLocaleDateString('en-IN')}</td>
        <td>${q.valid_until ? new Date(q.valid_until).toLocaleDateString('en-IN') : '-'}</td><td>${SalesDispatchPage.fmt(q.grand_total)}</td>
        <td><span class="badge bg-${q.status === 'Accepted' ? 'success' : q.status === 'Rejected' ? 'danger' : q.status === 'Converted' ? 'primary' : 'secondary'}">${q.status}</span></td>
        <td>
          ${q.status === 'Draft' ? `<button class="btn btn-sm btn-outline-secondary" onclick="QuotationModal.setStatus(${q.id}, 'Sent')">Mark Sent</button>` : ''}
          ${q.status === 'Sent' ? `<button class="btn btn-sm btn-outline-success" onclick="QuotationModal.setStatus(${q.id}, 'Accepted')">Accept</button> <button class="btn btn-sm btn-outline-danger" onclick="QuotationModal.setStatus(${q.id}, 'Rejected')">Reject</button>` : ''}
          ${q.status === 'Accepted' ? `<button class="btn btn-sm btn-primary" onclick="ConvertModal.show(${q.id})">Convert to SO</button>` : ''}
        </td>
      </tr>
    `);
  },

  // ---- Sales Orders ----
  loadOrders: async () => {
    const rows = await API.getSalesOrders();
    SalesDispatchPage.masters.orders = Array.isArray(rows) ? rows : [];
    document.getElementById('ordersBody').innerHTML = SalesDispatchPage.rowsOrMessage(rows, 8, 'No sales orders yet', o => `
      <tr>
        <td>${o.so_number}</td><td>${o.customer_name}</td><td>${new Date(o.order_date).toLocaleDateString('en-IN')}</td>
        <td>${o.expected_delivery_date ? new Date(o.expected_delivery_date).toLocaleDateString('en-IN') : '-'}</td>
        <td>${o.total_dispatched_qty}/${o.total_ordered_qty}</td><td>${SalesDispatchPage.fmt(o.grand_total)}</td>
        <td><span class="badge bg-info">${o.status}</span></td>
        <td>
          ${o.status === 'Draft' ? `<button class="btn btn-sm btn-outline-success" onclick="SalesDispatchPage.setOrderStatus(${o.id}, 'Confirmed')">Confirm</button>` : ''}
          <button class="btn btn-sm btn-outline-info" onclick="AvailabilityModal.show(${o.id})">Check Availability</button>
          ${['Draft', 'Confirmed'].includes(o.status) ? `<button class="btn btn-sm btn-outline-danger" onclick="SalesDispatchPage.setOrderStatus(${o.id}, 'Cancelled')">Cancel</button>` : ''}
        </td>
      </tr>
    `);
    SalesDispatchPage.refreshOrderDropdowns();
  },

  setOrderStatus: async (id, status) => {
    const result = await API.updateSalesOrderStatus(id, status);
    if (result && !result.error) { await SalesDispatchPage.loadOrders(); await SalesDispatchPage.loadDashboard(); }
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  },

  refreshOrderDropdowns: () => {
    const opts = '<option value="">— Select —</option>' + SalesDispatchPage.orderOptions();
    ['planSO', 'chSO', 'rtSO'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = opts; });
  },

  // ---- Dispatch Plans ----
  loadPlans: async () => {
    const rows = await API.getDispatchPlans();
    document.getElementById('plansBody').innerHTML = SalesDispatchPage.rowsOrMessage(rows, 8, 'No dispatch plans yet', p => `
      <tr>
        <td>${p.plan_number}</td><td>${p.so_number || '-'}</td><td>${p.customer_name || '-'}</td><td>${p.warehouse_name || '-'}</td>
        <td>${p.planned_date ? new Date(p.planned_date).toLocaleDateString('en-IN') : '-'}</td><td>${p.vehicle_number || '-'}</td>
        <td><span class="badge bg-secondary">${p.status}</span></td>
        <td class="small">${(p.items || []).map(i => `${i.material_name}: ${i.planned_quantity}`).join(', ')}</td>
      </tr>
    `);
  },

  // ---- Challans ----
  loadChallans: async () => {
    const rows = await API.getChallans();
    document.getElementById('challansBody').innerHTML = SalesDispatchPage.rowsOrMessage(rows, 8, 'No delivery challans yet', c => `
      <tr>
        <td>${c.challan_number}</td><td>${c.so_number || '-'}</td><td>${c.customer_name || '-'}</td><td>${c.warehouse_name || '-'}</td>
        <td>${new Date(c.challan_date).toLocaleDateString('en-IN')}</td><td>${c.vehicle_number || '-'}</td>
        <td><span class="badge bg-${c.status === 'Delivered' ? 'success' : 'secondary'}">${c.status}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-secondary" onclick="ChallanPrint.print(${c.id})">Print</button>
          ${c.status === 'Dispatched' ? `<button class="btn btn-sm btn-outline-success" onclick="SalesDispatchPage.setChallanStatus(${c.id}, 'Delivered')">Mark Delivered</button>` : ''}
          ${c.invoice_id
            ? `<button class="btn btn-sm btn-outline-primary" onclick="InvoicePrint.print(${c.invoice_id})">Print Invoice</button>`
            : `<button class="btn btn-sm btn-outline-primary" onclick="SalesInvoiceModal.showForCustomer(${c.customer_id || 'null'})">Generate Invoice</button>`}
        </td>
      </tr>
    `);
  },

  setChallanStatus: async (id, status) => {
    const result = await API.updateChallanStatus(id, status);
    if (result && !result.error) await SalesDispatchPage.loadChallans();
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  },

  // ---- Packing Lists ----
  loadPacking: async () => {
    const rows = await API.getPackingLists();
    document.getElementById('packingBody').innerHTML = SalesDispatchPage.rowsOrMessage(rows, 5, 'No packing lists yet', p => `
      <tr>
        <td>${p.packing_list_number}</td><td>${p.challan_number || '-'}</td><td>${p.total_packages}</td>
        <td>${p.gross_weight || '-'} / ${p.net_weight || '-'}</td>
        <td><button class="btn btn-sm btn-outline-secondary" onclick="PackingListPrint.print(${p.id})">Print</button></td>
      </tr>
    `);
    SalesDispatchPage._packingLists = Array.isArray(rows) ? rows : [];
  },

  // ---- Sales Returns ----
  loadReturns: async () => {
    const rows = await API.getSalesReturns();
    document.getElementById('returnsBody').innerHTML = SalesDispatchPage.rowsOrMessage(rows, 7, 'No sales returns yet', r => `
      <tr>
        <td>${r.return_number}</td><td>${r.customer_name}</td><td>${r.so_number || '-'}</td><td>${r.warehouse_name || '-'}</td>
        <td>${r.reason || '-'}</td><td><span class="badge bg-${r.status === 'Accepted' ? 'success' : r.status === 'Rejected' ? 'danger' : 'warning'}">${r.status}</span></td>
        <td>
          ${r.status === 'Pending' ? `<button class="btn btn-sm btn-outline-success" onclick="SalesDispatchPage.decideReturn(${r.id}, 'Accepted')">Accept</button> <button class="btn btn-sm btn-outline-danger" onclick="SalesDispatchPage.decideReturn(${r.id}, 'Rejected')">Reject</button>` : '-'}
        </td>
      </tr>
    `);
  },

  decideReturn: async (id, status) => {
    const result = await API.decideSalesReturn(id, status);
    if (result && !result.error) { await SalesDispatchPage.loadReturns(); await SalesDispatchPage.loadDashboard(); }
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  },

  // ---- Invoices ----
  loadInvoices: async () => {
    const rows = await API.getSalesInvoices();
    document.getElementById('invoicesBody').innerHTML = SalesDispatchPage.rowsOrMessage(rows, 9, 'No invoices generated yet', i => `
      <tr>
        <td>${i.invoice_number}</td><td>${i.customer_name}</td><td>${i.order_count || 1}</td>
        <td>${SalesDispatchPage.fmt(i.taxable_value)}</td><td>${SalesDispatchPage.fmt(i.tax_amount)}</td>
        <td>${SalesDispatchPage.fmt(i.grand_total)}</td><td>${SalesDispatchPage.fmt(i.paid_amount)}</td>
        <td><span class="badge bg-${i.status === 'Paid' ? 'success' : i.status === 'Partially Paid' ? 'warning' : 'secondary'}">${i.status}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-secondary" onclick="InvoicePrint.print(${i.id})">Print</button>
          ${i.status !== 'Paid' ? `<button class="btn btn-sm btn-outline-primary" onclick="PaymentModal.show(${i.id})">Record Payment</button>` : ''}
        </td>
      </tr>
    `);
  }
};

// ================= QUOTATION =================
const QuotationModal = {
  modal: null, itemCount: 0,
  show: () => {
    document.getElementById('qtCustomer').innerHTML = SalesDispatchPage.customerOptions();
    document.getElementById('qtItemsContainer').innerHTML = '';
    QuotationModal.itemCount = 0;
    QuotationModal.addItem();
    document.getElementById('qtValidUntil').value = '';
    document.getElementById('qtNotes').value = '';
    QuotationModal.modal = new bootstrap.Modal(document.getElementById('quotationModal'));
    QuotationModal.modal.show();
  },
  addItem: () => {
    const idx = QuotationModal.itemCount++;
    const div = document.createElement('div');
    div.className = 'row mb-2 qt-item align-items-center';
    div.innerHTML = `
      <div class="col-md-4"><select class="form-control form-control-sm material-select" required><option value="">Material</option>${SalesDispatchPage.materialOptions()}</select></div>
      <div class="col-md-2"><input type="number" class="form-control form-control-sm qty-input" placeholder="Qty" step="0.01" required oninput="QuotationModal.recalc()"></div>
      <div class="col-md-2"><input type="number" class="form-control form-control-sm price-input" placeholder="Unit Price" step="0.01" required oninput="QuotationModal.recalc()"></div>
      <div class="col-md-2"><input type="number" class="form-control form-control-sm tax-input" placeholder="Tax %" step="0.01" value="18" oninput="QuotationModal.recalc()"></div>
      <div class="col-md-2"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.qt-item').remove(); QuotationModal.recalc()"><i class="fas fa-trash"></i></button></div>
    `;
    document.getElementById('qtItemsContainer').appendChild(div);
  },
  recalc: () => {
    let total = 0, tax = 0;
    document.querySelectorAll('.qt-item').forEach(row => {
      const qty = parseFloat(row.querySelector('.qty-input').value) || 0;
      const price = parseFloat(row.querySelector('.price-input').value) || 0;
      const taxRate = parseFloat(row.querySelector('.tax-input').value) || 0;
      const base = qty * price;
      total += base; tax += base * (taxRate / 100);
    });
    document.getElementById('qtTotalsPreview').innerHTML = `Subtotal: ${SalesDispatchPage.fmt(total)} · Tax: ${SalesDispatchPage.fmt(tax)} · <strong>Grand Total: ${SalesDispatchPage.fmt(total + tax)}</strong>`;
  },
  setStatus: async (id, status) => {
    const result = await API.updateQuotationStatus(id, status);
    if (result && !result.error) await SalesDispatchPage.loadQuotations();
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  },
  submit: async (event) => {
    event.preventDefault();
    const items = [];
    document.querySelectorAll('.qt-item').forEach(row => {
      const sel = row.querySelector('.material-select');
      const materialId = sel.value;
      if (!materialId) return;
      items.push({
        material_id: parseInt(materialId),
        quantity: parseFloat(row.querySelector('.qty-input').value) || 0,
        unit_of_measure: sel.selectedOptions[0].dataset.unit || 'Nos',
        unit_price: parseFloat(row.querySelector('.price-input').value) || 0,
        tax_rate: parseFloat(row.querySelector('.tax-input').value) || 0
      });
    });
    if (!items.length) { alert('Add at least one item'); return; }
    const data = { customer_id: document.getElementById('qtCustomer').value, valid_until: document.getElementById('qtValidUntil').value, notes: document.getElementById('qtNotes').value, items };
    const result = await API.createQuotation(data);
    if (result && !result.error) { QuotationModal.modal.hide(); alert(result.message || 'Quotation created'); await SalesDispatchPage.loadQuotations(); await SalesDispatchPage.loadDashboard(); }
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  }
};

const ConvertModal = {
  modal: null,
  show: (quotationId) => {
    document.getElementById('convertQuotationId').value = quotationId;
    document.getElementById('convPaymentTerm').innerHTML = SalesDispatchPage.paymentTermOptions();
    document.getElementById('convTransporter').innerHTML = SalesDispatchPage.transporterOptions();
    document.getElementById('convExpectedDelivery').value = '';
    document.getElementById('convDestination').value = '';
    ConvertModal.modal = new bootstrap.Modal(document.getElementById('convertModal'));
    ConvertModal.modal.show();
  },
  submit: async (event) => {
    event.preventDefault();
    const id = document.getElementById('convertQuotationId').value;
    const data = {
      expected_delivery_date: document.getElementById('convExpectedDelivery').value,
      payment_term: document.getElementById('convPaymentTerm').value,
      transporter: document.getElementById('convTransporter').value,
      destination: document.getElementById('convDestination').value
    };
    const result = await API.convertQuotation(id, data);
    if (result && !result.error) { ConvertModal.modal.hide(); alert(result.message || 'Converted to sales order'); await SalesDispatchPage.loadQuotations(); await SalesDispatchPage.loadOrders(); }
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  }
};

// ================= SALES ORDER =================
const SalesOrderModal = {
  modal: null, itemCount: 0,
  show: () => {
    document.getElementById('soCustomer').innerHTML = SalesDispatchPage.customerOptions();
    document.getElementById('soPaymentTerm').innerHTML = SalesDispatchPage.paymentTermOptions();
    document.getElementById('soTransporter').innerHTML = SalesDispatchPage.transporterOptions();
    document.getElementById('soItemsContainer').innerHTML = '';
    SalesOrderModal.itemCount = 0;
    SalesOrderModal.addItem();
    document.getElementById('soExpectedDelivery').value = '';
    document.getElementById('soDestination').value = '';
    document.getElementById('soRemarks').value = '';
    SalesOrderModal.modal = new bootstrap.Modal(document.getElementById('soModal'));
    SalesOrderModal.modal.show();
  },
  addItem: () => {
    const div = document.createElement('div');
    div.className = 'row mb-2 so-item align-items-center';
    div.innerHTML = `
      <div class="col-md-4"><select class="form-control form-control-sm material-select" required><option value="">Material</option>${SalesDispatchPage.materialOptions()}</select></div>
      <div class="col-md-2"><input type="number" class="form-control form-control-sm qty-input" placeholder="Qty" step="0.01" required oninput="SalesOrderModal.recalc()"></div>
      <div class="col-md-2"><input type="number" class="form-control form-control-sm price-input" placeholder="Unit Price" step="0.01" required oninput="SalesOrderModal.recalc()"></div>
      <div class="col-md-2"><input type="number" class="form-control form-control-sm tax-input" placeholder="Tax %" step="0.01" value="18" oninput="SalesOrderModal.recalc()"></div>
      <div class="col-md-2"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.so-item').remove(); SalesOrderModal.recalc()"><i class="fas fa-trash"></i></button></div>
    `;
    document.getElementById('soItemsContainer').appendChild(div);
  },
  recalc: () => {
    let total = 0, tax = 0;
    document.querySelectorAll('.so-item').forEach(row => {
      const qty = parseFloat(row.querySelector('.qty-input').value) || 0;
      const price = parseFloat(row.querySelector('.price-input').value) || 0;
      const taxRate = parseFloat(row.querySelector('.tax-input').value) || 0;
      const base = qty * price;
      total += base; tax += base * (taxRate / 100);
    });
    document.getElementById('soTotalsPreview').innerHTML = `Subtotal: ${SalesDispatchPage.fmt(total)} · Tax: ${SalesDispatchPage.fmt(tax)} · <strong>Grand Total: ${SalesDispatchPage.fmt(total + tax)}</strong>`;
  },
  submit: async (event) => {
    event.preventDefault();
    const items = [];
    document.querySelectorAll('.so-item').forEach(row => {
      const sel = row.querySelector('.material-select');
      const materialId = sel.value;
      if (!materialId) return;
      items.push({
        material_id: parseInt(materialId),
        quantity: parseFloat(row.querySelector('.qty-input').value) || 0,
        unit_of_measure: sel.selectedOptions[0].dataset.unit || 'Nos',
        unit_price: parseFloat(row.querySelector('.price-input').value) || 0,
        tax_rate: parseFloat(row.querySelector('.tax-input').value) || 0
      });
    });
    if (!items.length) { alert('Add at least one item'); return; }
    const data = {
      customer_id: document.getElementById('soCustomer').value,
      expected_delivery_date: document.getElementById('soExpectedDelivery').value,
      payment_term: document.getElementById('soPaymentTerm').value,
      transporter: document.getElementById('soTransporter').value,
      destination: document.getElementById('soDestination').value,
      special_remarks: document.getElementById('soRemarks').value,
      items
    };
    const result = await API.createSalesOrder(data);
    if (result && !result.error) { SalesOrderModal.modal.hide(); alert(result.message || 'Sales order created'); await SalesDispatchPage.loadOrders(); await SalesDispatchPage.loadDashboard(); }
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  }
};

// ================= DISPATCH PLAN =================
const DispatchPlanModal = {
  modal: null,
  show: () => {
    document.getElementById('planSO').innerHTML = '<option value="">— Select —</option>' + SalesDispatchPage.orderOptions();
    document.getElementById('planWarehouse').innerHTML = SalesDispatchPage.warehouseOptions();
    document.getElementById('planTransporter').innerHTML = SalesDispatchPage.transporterOptions();
    document.getElementById('planItemsContainer').innerHTML = '<div class="small text-muted">Select a sales order first</div>';
    document.getElementById('planDate').value = '';
    document.getElementById('planVehicle').value = '';
    document.getElementById('planNotes').value = '';
    DispatchPlanModal.modal = new bootstrap.Modal(document.getElementById('planModal'));
    DispatchPlanModal.modal.show();
  },
  onOrderChange: async () => {
    const soId = document.getElementById('planSO').value;
    const container = document.getElementById('planItemsContainer');
    if (!soId) { container.innerHTML = '<div class="small text-muted">Select a sales order first</div>'; return; }
    const so = await API.getSalesOrder(soId);
    if (!so || so.error) { container.innerHTML = '<div class="text-danger small">Could not load order items</div>'; return; }
    const pending = (so.items || []).filter(i => (parseFloat(i.quantity) - parseFloat(i.dispatched_quantity || 0)) > 0.001);
    if (!pending.length) { container.innerHTML = '<div class="text-success small">Everything on this order has already been dispatched.</div>'; return; }
    container.innerHTML = pending.map(i => {
      const remaining = (parseFloat(i.quantity) - parseFloat(i.dispatched_quantity || 0)).toFixed(2);
      return `
      <div class="row mb-1 plan-item align-items-center" data-so-item-id="${i.id}" data-material-id="${i.material_id}">
        <div class="col-md-5">${i.material_name} <span class="text-muted small">(pending: ${remaining} ${i.unit_of_measure || ''})</span></div>
        <div class="col-md-3"><input type="number" class="form-control form-control-sm plan-qty" placeholder="Plan Qty" step="0.01" max="${remaining}"></div>
      </div>`;
    }).join('');
  },
  submit: async (event) => {
    event.preventDefault();
    const items = [];
    document.querySelectorAll('.plan-item').forEach(row => {
      const qty = parseFloat(row.querySelector('.plan-qty').value) || 0;
      if (qty > 0) items.push({ so_item_id: row.dataset.soItemId, material_id: row.dataset.materialId, planned_quantity: qty });
    });
    if (!items.length) { alert('Enter a planned quantity for at least one item'); return; }
    const data = {
      so_id: document.getElementById('planSO').value,
      warehouse_id: document.getElementById('planWarehouse').value,
      planned_date: document.getElementById('planDate').value,
      vehicle_number: document.getElementById('planVehicle').value,
      transporter: document.getElementById('planTransporter').value,
      notes: document.getElementById('planNotes').value,
      items
    };
    const result = await API.createDispatchPlan(data);
    if (result && !result.error) { DispatchPlanModal.modal.hide(); alert(result.message || 'Dispatch plan created'); await SalesDispatchPage.loadPlans(); await SalesDispatchPage.loadOrders(); await SalesDispatchPage.loadDashboard(); }
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  }
};

// ================= CHALLAN =================
const ChallanModal = {
  modal: null,
  show: () => {
    document.getElementById('chSO').innerHTML = '<option value="">— Select —</option>' + SalesDispatchPage.orderOptions();
    document.getElementById('chWarehouse').innerHTML = SalesDispatchPage.warehouseOptions();
    document.getElementById('chTransporter').innerHTML = SalesDispatchPage.transporterOptions();
    document.getElementById('chItemsContainer').innerHTML = '<div class="small text-muted">Select a sales order first</div>';
    ['chVehicle', 'chDriverName', 'chDriverPhone', 'chEwayBill', 'chDestination'].forEach(id => document.getElementById(id).value = '');
    ChallanModal.modal = new bootstrap.Modal(document.getElementById('challanModal'));
    ChallanModal.modal.show();
  },
  onOrderChange: async () => {
    const soId = document.getElementById('chSO').value;
    const container = document.getElementById('chItemsContainer');
    if (!soId) { container.innerHTML = '<div class="small text-muted">Select a sales order first</div>'; return; }
    const so = await API.getSalesOrder(soId);
    if (!so || so.error) { container.innerHTML = '<div class="text-danger small">Could not load order items</div>'; return; }
    document.getElementById('chDestination').value = so.destination || '';
    const pending = (so.items || []).filter(i => (parseFloat(i.quantity) - parseFloat(i.dispatched_quantity || 0)) > 0.001);
    if (!pending.length) { container.innerHTML = '<div class="text-success small">Everything on this order has already been dispatched.</div>'; return; }
    container.innerHTML = pending.map(i => {
      const remaining = (parseFloat(i.quantity) - parseFloat(i.dispatched_quantity || 0)).toFixed(2);
      return `
      <div class="row mb-1 ch-item align-items-center" data-so-item-id="${i.id}" data-material-id="${i.material_id}" data-unit="${i.unit_of_measure || ''}">
        <div class="col-md-5">${i.material_name} <span class="text-muted small">(pending: ${remaining} ${i.unit_of_measure || ''})</span></div>
        <div class="col-md-3"><input type="number" class="form-control form-control-sm ch-qty" placeholder="Dispatch Qty" step="0.01" max="${remaining}"></div>
      </div>`;
    }).join('');
  },
  submit: async (event) => {
    event.preventDefault();
    const items = [];
    document.querySelectorAll('.ch-item').forEach(row => {
      const qty = parseFloat(row.querySelector('.ch-qty').value) || 0;
      if (qty > 0) items.push({ so_item_id: row.dataset.soItemId, material_id: row.dataset.materialId, quantity: qty, unit_of_measure: row.dataset.unit });
    });
    if (!items.length) { alert('Enter a dispatch quantity for at least one item'); return; }
    const data = {
      so_id: document.getElementById('chSO').value,
      warehouse_id: document.getElementById('chWarehouse').value,
      vehicle_number: document.getElementById('chVehicle').value,
      transporter: document.getElementById('chTransporter').value,
      driver_name: document.getElementById('chDriverName').value,
      driver_phone: document.getElementById('chDriverPhone').value,
      destination: document.getElementById('chDestination').value,
      eway_bill_number: document.getElementById('chEwayBill').value,
      items
    };
    const result = await API.createChallan(data);
    if (result && !result.error) {
      ChallanModal.modal.hide();
      alert(result.message || 'Delivery challan created');
      await Promise.all([SalesDispatchPage.loadChallans(), SalesDispatchPage.loadOrders(), SalesDispatchPage.loadPlans(), SalesDispatchPage.loadDashboard()]);
    } else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  }
};

const ChallanPrint = {
  print: async (id) => {
    const c = await API.getChallan(id);
    if (!c || c.error) { alert('Could not load challan'); return; }
    const company = await API.getCompanySettings() || {};
    const itemsHtml = (c.items || []).map((i, idx) => `<tr><td>${idx + 1}</td><td>${i.material_name}</td><td>${i.hsn_code || '-'}</td><td style="text-align:right">${i.quantity} ${i.unit_of_measure || ''}</td><td>${i.batch_number || '-'}</td></tr>`).join('');
    const printHtml = `
      <!DOCTYPE html><html><head><title>${c.challan_number}</title><meta charset="utf-8">
      <style>
        @page { size: A4; margin: 15mm; } body { font-family: Arial, Helvetica, sans-serif; color:#222; font-size:12px; }
        h2 { color:#1a4d8f; margin-bottom:0; } table { width:100%; border-collapse: collapse; margin-top:10px; }
        th, td { border:1px solid #ccc; padding:6px 8px; text-align:left; font-size:11px; } th { background:#f0f4fa; }
        .meta { display:flex; justify-content:space-between; background:#f7f9fc; border:1px solid #ddd; padding:8px; margin:10px 0; }
        .sign { display:flex; justify-content:space-between; margin-top:60px; } .sign div { border-top:1px solid #333; width:30%; text-align:center; padding-top:4px; }
      </style></head><body>
        <h2>${company.company_name || 'Company'}</h2>
        <div class="small text-muted">${[company.address, company.city, company.state].filter(Boolean).join(', ')}${company.gstin ? ' | GSTIN: ' + company.gstin : ''}</div>
        <h3>DELIVERY CHALLAN</h3>
        <div class="meta">
          <div><strong>Challan No:</strong> ${c.challan_number}<br><strong>Date:</strong> ${new Date(c.challan_date).toLocaleDateString('en-IN')}<br><strong>SO No:</strong> ${c.so_number || '-'}</div>
          <div><strong>Customer:</strong> ${c.customer_name}<br>${[c.customer_address, c.customer_city, c.customer_state].filter(Boolean).join(', ')}<br>${c.customer_gstin ? 'GSTIN: ' + c.customer_gstin : ''}</div>
          <div><strong>Vehicle:</strong> ${c.vehicle_number || '-'}<br><strong>Transporter:</strong> ${c.transporter || '-'}<br><strong>E-Way Bill:</strong> ${c.eway_bill_number || '-'}</div>
        </div>
        <table><thead><tr><th>#</th><th>Material</th><th>HSN</th><th>Qty</th><th>Batch</th></tr></thead><tbody>${itemsHtml}</tbody></table>
        <div class="sign"><div>Store / Dispatch</div><div>Driver / Transporter</div><div>Received By (Customer)</div></div>
        <script>window.onload = () => window.print();</script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Please allow pop-ups to print.'); return; }
    w.document.write(printHtml); w.document.close();
  }
};

// Proper GST tax invoice — CGST+SGST for an in-state customer, IGST for
// out-of-state, each line already carrying its SO reference in the
// description so a consolidated multi-order invoice is never ambiguous
// about what it's billing.
const InvoicePrint = {
  print: async (id) => {
    const inv = await API.getSalesInvoice(id);
    if (!inv || inv.error) { alert('Could not load invoice'); return; }
    const company = await API.getCompanySettings() || {};
    const interstate = !!inv.is_interstate;

    const itemsHtml = (inv.items || []).map((it, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${it.description || it.material_name || ''}</td>
        <td>${it.hsn_code || '-'}</td>
        <td style="text-align:right">${it.quantity} ${it.unit_of_measure || ''}</td>
        <td style="text-align:right">${SalesDispatchPage.fmt(it.unit_price)}</td>
        <td style="text-align:right">${SalesDispatchPage.fmt(it.taxable_value)}</td>
        ${interstate
          ? `<td style="text-align:right">${it.tax_rate}%<br>${SalesDispatchPage.fmt(it.igst_amount)}</td>`
          : `<td style="text-align:right">${(it.tax_rate / 2).toFixed(1)}%<br>${SalesDispatchPage.fmt(it.cgst_amount)}</td><td style="text-align:right">${(it.tax_rate / 2).toFixed(1)}%<br>${SalesDispatchPage.fmt(it.sgst_amount)}</td>`}
        <td style="text-align:right">${SalesDispatchPage.fmt(it.line_total)}</td>
      </tr>
    `).join('');

    const taxHeaders = interstate
      ? `<th>IGST</th>`
      : `<th>CGST</th><th>SGST</th>`;

    const printHtml = `
      <!DOCTYPE html><html><head><title>${inv.invoice_number}</title><meta charset="utf-8">
      <style>
        @page { size: A4; margin: 14mm; } body { font-family: Arial, Helvetica, sans-serif; color:#222; font-size:12px; }
        h2 { color:#1a4d8f; margin-bottom:0; } h3 { margin: 6px 0 0; letter-spacing: 1px; }
        table { width:100%; border-collapse: collapse; margin-top:10px; }
        th, td { border:1px solid #ccc; padding:6px 7px; text-align:left; font-size:10.5px; } th { background:#f0f4fa; }
        .meta { display:flex; justify-content:space-between; background:#f7f9fc; border:1px solid #ddd; padding:10px; margin:10px 0; gap: 10px; }
        .meta > div { flex: 1; }
        .totals { width: 340px; margin-left: auto; margin-top: 10px; }
        .totals td { font-size: 11.5px; }
        .grand { font-size: 14px; font-weight: bold; background: #f0f4fa; }
        .sign { display:flex; justify-content:flex-end; margin-top:70px; } .sign div { border-top:1px solid #333; width:220px; text-align:center; padding-top:4px; }
      </style></head><body>
        <h2>${company.company_name || 'Company'}</h2>
        <div class="small text-muted">${[company.address, company.city, company.state, company.postal_code].filter(Boolean).join(', ')}${company.gstin ? ' | GSTIN: ' + company.gstin : ''}</div>
        <h3>TAX INVOICE</h3>
        <div class="meta">
          <div><strong>Invoice No:</strong> ${inv.invoice_number}<br><strong>Date:</strong> ${new Date(inv.invoice_date).toLocaleDateString('en-IN')}<br><strong>Due Date:</strong> ${inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN') : '-'}</div>
          <div><strong>Bill To:</strong> ${inv.customer_name}<br>${[inv.customer_address, inv.customer_city, inv.customer_state].filter(Boolean).join(', ')}<br>${inv.customer_gstin ? 'GSTIN: ' + inv.customer_gstin : ''}</div>
          <div><strong>Place of Supply:</strong> ${inv.place_of_supply || '-'}<br><strong>Supply Type:</strong> ${interstate ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)'}<br>${inv.external_reference ? '<strong>Ref:</strong> ' + inv.external_reference : ''}</div>
        </div>
        <table>
          <thead><tr><th>#</th><th>Description (with Order Ref)</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Taxable Value</th>${taxHeaders}<th>Line Total</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <table class="totals">
          <tr><td>Taxable Value</td><td style="text-align:right">${SalesDispatchPage.fmt(inv.taxable_value)}</td></tr>
          ${interstate
            ? `<tr><td>IGST</td><td style="text-align:right">${SalesDispatchPage.fmt(inv.igst_total)}</td></tr>`
            : `<tr><td>CGST</td><td style="text-align:right">${SalesDispatchPage.fmt(inv.cgst_total)}</td></tr><tr><td>SGST</td><td style="text-align:right">${SalesDispatchPage.fmt(inv.sgst_total)}</td></tr>`}
          <tr class="grand"><td>Grand Total</td><td style="text-align:right">${SalesDispatchPage.fmt(inv.grand_total)}</td></tr>
          <tr><td>Paid</td><td style="text-align:right">${SalesDispatchPage.fmt(inv.paid_amount)}</td></tr>
          <tr><td><strong>Balance Due</strong></td><td style="text-align:right"><strong>${SalesDispatchPage.fmt(inv.grand_total - inv.paid_amount)}</strong></td></tr>
        </table>
        ${inv.notes ? `<div class="small text-muted mt-2"><strong>Notes:</strong> ${inv.notes}</div>` : ''}
        <div class="sign"><div>Authorized Signatory</div></div>
        <script>window.onload = () => window.print();</script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Please allow pop-ups to print.'); return; }
    w.document.write(printHtml); w.document.close();
  }
};

// ================= PACKING LIST =================
const PackingListModal = {
  modal: null, pkgCount: 0,
  show: async () => {
    const challans = await API.getChallans();
    document.getElementById('pkChallan').innerHTML = '<option value="">— Select —</option>' + (Array.isArray(challans) ? challans : []).map(c => `<option value="${c.id}">${c.challan_number} — ${c.customer_name || ''}</option>`).join('');
    document.getElementById('pkItemsContainer').innerHTML = '';
    PackingListModal.pkgCount = 0;
    PackingListModal.addPackage();
    document.getElementById('pkGrossWeight').value = '';
    document.getElementById('pkNetWeight').value = '';
    document.getElementById('pkNotes').value = '';
    PackingListModal.modal = new bootstrap.Modal(document.getElementById('packingModal'));
    PackingListModal.modal.show();
  },
  addPackage: () => {
    const idx = ++PackingListModal.pkgCount;
    const div = document.createElement('div');
    div.className = 'row mb-2 pk-item align-items-center';
    div.innerHTML = `
      <div class="col-md-2"><input type="text" class="form-control form-control-sm pkg-no" placeholder="Pkg No" value="${idx}"></div>
      <div class="col-md-3"><select class="form-control form-control-sm pkg-material"><option value="">Material</option>${SalesDispatchPage.materialOptions()}</select></div>
      <div class="col-md-3"><input type="text" class="form-control form-control-sm pkg-desc" placeholder="Description"></div>
      <div class="col-md-2"><input type="number" class="form-control form-control-sm pkg-qty" placeholder="Qty" step="0.01"></div>
      <div class="col-md-1"><input type="number" class="form-control form-control-sm pkg-weight" placeholder="Wt" step="0.01"></div>
      <div class="col-md-1"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.pk-item').remove()"><i class="fas fa-trash"></i></button></div>
    `;
    document.getElementById('pkItemsContainer').appendChild(div);
  },
  submit: async (event) => {
    event.preventDefault();
    const items = [];
    document.querySelectorAll('.pk-item').forEach(row => {
      items.push({
        package_no: row.querySelector('.pkg-no').value,
        material_id: row.querySelector('.pkg-material').value || null,
        description: row.querySelector('.pkg-desc').value,
        quantity: row.querySelector('.pkg-qty').value,
        weight: row.querySelector('.pkg-weight').value
      });
    });
    const data = {
      challan_id: document.getElementById('pkChallan').value,
      gross_weight: document.getElementById('pkGrossWeight').value,
      net_weight: document.getElementById('pkNetWeight').value,
      notes: document.getElementById('pkNotes').value,
      items
    };
    const result = await API.createPackingList(data);
    if (result && !result.error) { PackingListModal.modal.hide(); alert(result.message || 'Packing list created'); await SalesDispatchPage.loadPacking(); }
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  }
};

const PackingListPrint = {
  print: (id) => {
    const list = (SalesDispatchPage._packingLists || []).find(p => p.id === id);
    if (!list) { alert('Could not find this packing list'); return; }
    const rows = (list.items || []).map(i => `<tr><td>${i.package_no}</td><td>${i.description || '-'}</td><td>${i.quantity || '-'}</td><td>${i.weight || '-'}</td></tr>`).join('');
    const printHtml = `
      <!DOCTYPE html><html><head><title>${list.packing_list_number}</title><meta charset="utf-8">
      <style>@page{size:A4;margin:15mm} body{font-family:Arial;font-size:12px} table{width:100%;border-collapse:collapse;margin-top:10px} th,td{border:1px solid #ccc;padding:6px}</style>
      </head><body>
        <h3>PACKING LIST — ${list.packing_list_number}</h3>
        <div>Challan: ${list.challan_number || '-'} | Total Packages: ${list.total_packages} | Gross Wt: ${list.gross_weight || '-'} | Net Wt: ${list.net_weight || '-'}</div>
        <table><thead><tr><th>Package #</th><th>Description</th><th>Qty</th><th>Weight</th></tr></thead><tbody>${rows}</tbody></table>
        <script>window.onload = () => window.print();</script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Please allow pop-ups to print.'); return; }
    w.document.write(printHtml); w.document.close();
  }
};

// ================= SALES RETURN =================
const SalesReturnModal = {
  modal: null,
  show: () => {
    document.getElementById('rtCustomer').innerHTML = SalesDispatchPage.customerOptions();
    document.getElementById('rtSO').innerHTML = '<option value="">— None —</option>' + SalesDispatchPage.orderOptions();
    document.getElementById('rtWarehouse').innerHTML = SalesDispatchPage.warehouseOptions();
    document.getElementById('rtReason').value = '';
    document.getElementById('rtItemsContainer').innerHTML = '';
    SalesReturnModal.addItem();
    SalesReturnModal.modal = new bootstrap.Modal(document.getElementById('returnModal'));
    SalesReturnModal.modal.show();
  },
  addItem: () => {
    const div = document.createElement('div');
    div.className = 'row mb-2 rt-item align-items-center';
    div.innerHTML = `
      <div class="col-md-4"><select class="form-control form-control-sm material-select"><option value="">Material</option>${SalesDispatchPage.materialOptions()}</select></div>
      <div class="col-md-2"><input type="number" class="form-control form-control-sm qty-input" placeholder="Qty" step="0.01"></div>
      <div class="col-md-3"><select class="form-control form-control-sm condition-select"><option>Good</option><option>Damaged</option><option>Rework</option></select></div>
      <div class="col-md-2"><input type="text" class="form-control form-control-sm remarks-input" placeholder="Remarks"></div>
      <div class="col-md-1"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.rt-item').remove()"><i class="fas fa-trash"></i></button></div>
    `;
    document.getElementById('rtItemsContainer').appendChild(div);
  },
  submit: async (event) => {
    event.preventDefault();
    const items = [];
    document.querySelectorAll('.rt-item').forEach(row => {
      const materialId = row.querySelector('.material-select').value;
      const qty = parseFloat(row.querySelector('.qty-input').value) || 0;
      if (materialId && qty > 0) items.push({ material_id: parseInt(materialId), quantity: qty, item_condition: row.querySelector('.condition-select').value, remarks: row.querySelector('.remarks-input').value });
    });
    if (!items.length) { alert('Add at least one item'); return; }
    const data = {
      customer_id: document.getElementById('rtCustomer').value,
      so_id: document.getElementById('rtSO').value || null,
      warehouse_id: document.getElementById('rtWarehouse').value,
      reason: document.getElementById('rtReason').value,
      items
    };
    const result = await API.createSalesReturn(data);
    if (result && !result.error) { SalesReturnModal.modal.hide(); alert(result.message || 'Return recorded'); await SalesDispatchPage.loadReturns(); await SalesDispatchPage.loadDashboard(); }
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  }
};

// ================= INVOICE =================
const SalesInvoiceModal = {
  modal: null,
  billableItems: [],
  show: async () => {
    document.getElementById('invCustomer').innerHTML = '<option value="">— Select —</option>' + SalesDispatchPage.customerOptions();
    document.getElementById('invDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('invDueDate').value = '';
    document.getElementById('invExternalRef').value = '';
    document.getElementById('invNotes').value = '';
    document.getElementById('billableItemsContainer').innerHTML = '<div class="text-muted small">Select a customer first</div>';
    document.getElementById('invoiceTotalsPreview').innerHTML = '';
    SalesInvoiceModal.modal = new bootstrap.Modal(document.getElementById('invoiceModal'));
    SalesInvoiceModal.modal.show();
  },

  // Shortcut from a delivery challan row: jump straight into the invoice
  // builder with that customer already selected and their billable items loaded.
  showForCustomer: async (customerId) => {
    await SalesInvoiceModal.show();
    if (!customerId) return;
    document.getElementById('invCustomer').value = customerId;
    await SalesInvoiceModal.onCustomerChange();
  },

  onCustomerChange: async () => {
    const customerId = document.getElementById('invCustomer').value;
    const container = document.getElementById('billableItemsContainer');
    if (!customerId) { container.innerHTML = '<div class="text-muted small">Select a customer first</div>'; return; }
    container.innerHTML = '<div class="text-muted small">Loading dispatched, unbilled items...</div>';
    const items = await API.getCustomerBillableItems(customerId);
    SalesInvoiceModal.billableItems = Array.isArray(items) ? items : [];
    if (!SalesInvoiceModal.billableItems.length) {
      container.innerHTML = '<div class="text-muted small">Nothing dispatched to this customer is awaiting invoicing right now.</div>';
      document.getElementById('invoiceTotalsPreview').innerHTML = '';
      return;
    }
    // Group by SO so a multi-order invoice reads clearly while building it.
    const bySo = {};
    SalesInvoiceModal.billableItems.forEach(it => {
      bySo[it.so_id] = bySo[it.so_id] || { so_number: it.so_number, rows: [] };
      bySo[it.so_id].rows.push(it);
    });
    container.innerHTML = `
      <table class="table table-sm mb-0">
        <thead class="table-light"><tr><th><input type="checkbox" onclick="SalesInvoiceModal.toggleAll(this)"></th><th>Order</th><th>Material</th><th>Billable Qty</th><th>Rate</th><th>Tax %</th></tr></thead>
        <tbody>
          ${Object.values(bySo).map(grp => grp.rows.map((it, idx) => `
            <tr class="billable-item" data-so-item-id="${it.so_item_id}" data-so-id="${it.so_id}" data-material-id="${it.material_id}"
                data-hsn="${it.hsn_code || ''}" data-unit="${it.unit_of_measure || ''}" data-price="${it.unit_price}" data-tax="${it.tax_rate}" data-max="${it.billable_quantity}">
              <td><input type="checkbox" class="bill-check" checked onchange="SalesInvoiceModal.recalcTotals()"></td>
              <td>${idx === 0 ? `<strong>${grp.so_number}</strong>` : ''}</td>
              <td>${it.material_name || '-'}</td>
              <td><input type="number" class="form-control form-control-sm bill-qty" style="width:100px" step="0.001" max="${it.billable_quantity}" value="${it.billable_quantity}" oninput="SalesInvoiceModal.recalcTotals()"></td>
              <td>${SalesDispatchPage.fmt(it.unit_price)}</td>
              <td>${it.tax_rate}%</td>
            </tr>
          `).join('')).join('')}
        </tbody>
      </table>
    `;
    SalesInvoiceModal.recalcTotals();
  },

  toggleAll: (checkbox) => {
    document.querySelectorAll('.bill-check').forEach(c => { c.checked = checkbox.checked; });
    SalesInvoiceModal.recalcTotals();
  },

  recalcTotals: () => {
    let taxable = 0, tax = 0;
    document.querySelectorAll('.billable-item').forEach(row => {
      if (!row.querySelector('.bill-check').checked) return;
      const qty = parseFloat(row.querySelector('.bill-qty').value) || 0;
      const price = parseFloat(row.dataset.price) || 0;
      const rate = parseFloat(row.dataset.tax) || 0;
      const base = qty * price;
      taxable += base; tax += base * (rate / 100);
    });
    document.getElementById('invoiceTotalsPreview').innerHTML =
      `Taxable: ${SalesDispatchPage.fmt(taxable)} &nbsp; · &nbsp; Tax: ${SalesDispatchPage.fmt(tax)} &nbsp; · &nbsp; <strong>Grand Total: ${SalesDispatchPage.fmt(taxable + tax)}</strong>`;
  },

  submit: async (event) => {
    event.preventDefault();
    const items = [];
    document.querySelectorAll('.billable-item').forEach(row => {
      if (!row.querySelector('.bill-check').checked) return;
      const qty = parseFloat(row.querySelector('.bill-qty').value) || 0;
      if (qty <= 0) return;
      items.push({
        so_id: row.dataset.soId, so_item_id: row.dataset.soItemId, material_id: row.dataset.materialId,
        hsn_code: row.dataset.hsn, unit_of_measure: row.dataset.unit, unit_price: row.dataset.price, tax_rate: row.dataset.tax,
        quantity: qty
      });
    });
    if (!items.length) { alert('Tick at least one item to bill'); return; }
    const overLimit = Array.from(document.querySelectorAll('.billable-item')).some(row =>
      row.querySelector('.bill-check').checked && parseFloat(row.querySelector('.bill-qty').value) > parseFloat(row.dataset.max) + 0.001
    );
    if (overLimit) { alert('One or more quantities exceed what has actually been dispatched and is billable'); return; }

    const data = {
      customer_id: document.getElementById('invCustomer').value,
      invoice_date: document.getElementById('invDate').value,
      due_date: document.getElementById('invDueDate').value,
      external_reference: document.getElementById('invExternalRef').value,
      notes: document.getElementById('invNotes').value,
      items
    };
    const result = await API.createSalesInvoice(data);
    if (result && !result.error) {
      SalesInvoiceModal.modal.hide();
      alert(result.message || 'Invoice generated');
      await SalesDispatchPage.loadInvoices();
      await SalesDispatchPage.loadDashboard();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};

const PaymentModal = {
  modal: null,
  show: (invoiceId) => {
    document.getElementById('paymentInvoiceId').value = invoiceId;
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentReference').value = '';
    PaymentModal.modal = new bootstrap.Modal(document.getElementById('paymentModal'));
    PaymentModal.modal.show();
  },
  submit: async (event) => {
    event.preventDefault();
    const id = document.getElementById('paymentInvoiceId').value;
    const data = {
      amount: parseFloat(document.getElementById('paymentAmount').value) || 0,
      payment_mode: document.getElementById('paymentMode').value,
      reference_number: document.getElementById('paymentReference').value
    };
    const result = await API.recordInvoicePayment(id, data);
    if (result && !result.error) { PaymentModal.modal.hide(); alert(result.message || 'Payment recorded'); await SalesDispatchPage.loadInvoices(); await SalesDispatchPage.loadDashboard(); }
    else alert('Error: ' + ((result && result.error) || 'Something went wrong'));
  }
};

// ================= AVAILABILITY / ORDER FULFILLMENT CHECK =================
// Answers: can this order ship straight from free stock? If not, can we
// produce it (is the raw material there)? If not, how short are we, and
// is a purchase order already covering that shortage?
const AvailabilityModal = {
  modal: null,
  show: async (soId) => {
    AvailabilityModal.modal = new bootstrap.Modal(document.getElementById('availabilityModal'));
    document.getElementById('availabilityBody').innerHTML = '<div class="text-center text-muted py-4">Checking stock, QC hold, and open purchase orders...</div>';
    AvailabilityModal.modal.show();
    const result = await API.getOrderAvailability(soId);
    if (!result || result.error) {
      document.getElementById('availabilityBody').innerHTML = `<div class="text-danger">${(result && result.error) || 'Could not run the check'}</div>`;
      return;
    }
    document.getElementById('availabilityBody').innerHTML = AvailabilityModal.render(result);
  },

  overallBadge: (status) => {
    const map = { 'Ready to Ship': 'success', 'Production Required': 'warning', 'Raw Material Shortage — Purchase Required': 'danger' };
    return `<span class="badge bg-${map[status] || 'secondary'} fs-6">${status}</span>`;
  },

  lineDecisionBadge: (decision) => {
    if (!decision) return '';
    let color = 'secondary';
    if (decision.includes('Ship Now — Fully')) color = 'success';
    else if (decision.includes('RM Available') || decision === 'Produce — Raw Material Available') color = 'primary';
    else if (decision.includes('Shortage')) color = 'danger';
    else if (decision.includes('Fully Dispatched')) color = 'success';
    else if (decision.includes('No BOM')) color = 'dark';
    return `<span class="badge bg-${color}">${decision}</span>`;
  },

  render: (result) => {
    const linesHtml = result.lines.map(line => {
      if (line.pending_quantity === 0) {
        return `<div class="card mb-2"><div class="card-body py-2"><strong>${line.material_name}</strong> — ${AvailabilityModal.lineDecisionBadge(line.decision)}</div></div>`;
      }
      const rm = line.production_plan;
      return `
        <div class="card mb-3 border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h6 class="mb-1">${line.material_name}</h6>
                <div class="small text-muted">Pending on order: <strong>${line.pending_quantity}</strong> · Free finished stock (unlinked to other orders): <strong>${line.free_finished_stock}</strong></div>
              </div>
              ${AvailabilityModal.lineDecisionBadge(line.decision)}
            </div>
            <div class="row text-center mt-2">
              <div class="col-4"><div class="small text-muted">Ship Now</div><div class="fw-bold text-success">${line.shippable_now}</div></div>
              <div class="col-4"><div class="small text-muted">Shortfall (to Produce)</div><div class="fw-bold text-danger">${line.shortfall}</div></div>
              <div class="col-4"><div class="small text-muted">Required Output Wt (Kg)</div><div class="fw-bold">${rm ? rm.required_output_weight_kg : '-'}</div></div>
            </div>
            ${rm ? `
              <hr>
              <div class="small text-muted mb-1">Raw material needed to produce the shortfall of ${rm.shortfall_quantity} ${rm.output_unit || ''} (BOM: ${rm.bom_name}${rm.bom_alias ? ' / ' + rm.bom_alias : ''}):</div>
              <table class="table table-sm mb-0">
                <thead class="table-light"><tr><th>Material</th><th>Required</th><th>Free Stock</th><th>QC Pending</th><th>QC Hold</th><th>On Order (PO)</th><th>Status</th></tr></thead>
                <tbody>
                  ${rm.materials.map(m => `
                    <tr class="${m.status.includes('raise') ? 'table-danger' : m.status.includes('covered') ? 'table-warning' : ''}">
                      <td>${m.material_name}</td><td>${m.required_quantity} ${m.unit || ''}</td><td>${m.free_stock}</td>
                      <td>${m.qc_pending}</td><td>${m.qc_hold}</td><td>${m.on_order}</td><td class="small">${m.status}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : (line.shortfall > 0 ? '<div class="text-muted small mt-2">No BOM is linked to this finished item, so raw material requirement can\'t be computed. Link an "Output Material" on its BOM first.</div>' : '')}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div><strong>${result.so_number}</strong> — ${result.customer_name}</div>
        ${AvailabilityModal.overallBadge(result.overall_status)}
      </div>
      ${linesHtml}
    `;
  }
};
