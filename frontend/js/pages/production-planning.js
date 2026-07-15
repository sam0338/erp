const ProductionPlanningPage = {
  render: async () => `
    <div class="row mb-4">
      <div class="col-md-8">
        <h2><i class="fas fa-industry me-2"></i>Production Planning &amp; Execution</h2>
        <p class="text-muted mb-0">BOM → Routing → Issue → WIP → Receipt, connected end to end.</p>
      </div>
      <div class="col-md-4 text-end">
        <button class="btn btn-primary" onclick="ProductionModal.show()">
          <i class="fas fa-plus me-1"></i>New Production Order
        </button>
      </div>
    </div>

    <div class="row">
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <p class="text-muted small mb-1">Active Orders</p>
            <h3 id="activeOrders">-</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <p class="text-muted small mb-1">Work Orders In Progress</p>
            <h3 id="inProgressWO">-</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <p class="text-muted small mb-1">Completed Orders</p>
            <h3 id="completedToday">-</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <p class="text-muted small mb-1">Material Issued Today</p>
            <h3 id="allocationPending">-</h3>
          </div>
        </div>
      </div>
    </div>

    <div class="row mt-2">
      <div class="col-md-12">
        <ul class="nav nav-tabs mb-3" id="prodTabs">
          <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#board">Scheduling Board</button></li>
          <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#orders">Production Orders</button></li>
          <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#workorders">Work Orders / Job Cards</button></li>
          <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#issue">Issue Material</button></li>
          <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#returns">Return Material</button></li>
          <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#wip">WIP Tracking</button></li>
          <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#receipts">FG Receipt</button></li>
          <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#variance">Variance Report</button></li>
        </ul>

        <div class="tab-content">
          <!-- SCHEDULING BOARD -->
          <div class="tab-pane fade show active" id="board">
            <div class="row" id="schedulingBoard">
              <div class="col-12 text-center text-muted py-4">Loading...</div>
            </div>
          </div>

          <!-- PRODUCTION ORDERS -->
          <div class="tab-pane fade" id="orders">
            <div class="card border-0 shadow-sm">
              <div class="card-body table-responsive">
                <table class="table table-hover mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>PO No</th><th>Product</th><th>Qty</th><th>Planned In / Out</th>
                      <th>Actual In / Out</th><th>Schedule</th><th>Machine/Shift/Operator</th>
                      <th>Priority</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody id="ordersBody"><tr><td colspan="10" class="text-center text-muted">Loading...</td></tr></tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- WORK ORDERS / JOB CARDS -->
          <div class="tab-pane fade" id="workorders">
            <div class="card border-0 shadow-sm">
              <div class="card-body table-responsive">
                <table class="table table-hover mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>WO No</th><th>Production Order</th><th>Op #</th><th>Operation</th>
                      <th>Machine</th><th>Shift</th><th>Operator</th><th>Produced</th><th>Scrap/Rej</th>
                      <th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody id="workOrdersBody"><tr><td colspan="11" class="text-center text-muted">Loading...</td></tr></tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- ISSUE MATERIAL -->
          <div class="tab-pane fade" id="issue">
            <div class="d-flex justify-content-between mb-2">
              <p class="text-muted small mb-0">Raw material issued from store to a production order (deducts stock immediately, FIFO by batch).</p>
              <button class="btn btn-sm btn-primary" onclick="IssueModal.show()"><i class="fas fa-plus me-1"></i>Issue Material</button>
            </div>
            <div class="card border-0 shadow-sm">
              <div class="card-body table-responsive">
                <table class="table table-hover mb-0">
                  <thead class="table-light"><tr><th>Issue No</th><th>Production Order</th><th>Material</th><th>Qty Issued</th><th>Warehouse</th><th>Status</th></tr></thead>
                  <tbody id="allocationBody"><tr><td colspan="6" class="text-center text-muted">Loading...</td></tr></tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- RETURN MATERIAL -->
          <div class="tab-pane fade" id="returns">
            <div class="d-flex justify-content-between mb-2">
              <p class="text-muted small mb-0">Unused raw material handed back from the shop floor to store.</p>
              <button class="btn btn-sm btn-primary" onclick="ReturnModal.show()"><i class="fas fa-plus me-1"></i>Return Material</button>
            </div>
            <div class="card border-0 shadow-sm">
              <div class="card-body table-responsive">
                <table class="table table-hover mb-0">
                  <thead class="table-light"><tr><th>Return No</th><th>Production Order</th><th>Material</th><th>Qty Returned</th><th>Warehouse</th><th>Reason</th><th>By</th></tr></thead>
                  <tbody id="returnsBody"><tr><td colspan="7" class="text-center text-muted">Loading...</td></tr></tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- WIP TRACKING -->
          <div class="tab-pane fade" id="wip">
            <div class="d-flex justify-content-between mb-2">
              <p class="text-muted small mb-0">Movement of work-in-progress between stages/operations, with scrap, rework and rejection captured at each stage.</p>
              <button class="btn btn-sm btn-primary" onclick="WipModal.show()"><i class="fas fa-plus me-1"></i>Log WIP Movement</button>
            </div>
            <div class="mb-3">
              <label class="form-label small">View stage-wise WIP balance for order:</label>
              <select class="form-control form-control-sm w-auto d-inline-block" id="wipOrderFilter" onchange="ProductionPlanningPage.loadWipSummary()"></select>
            </div>
            <div id="wipSummary" class="mb-3"></div>
            <div class="card border-0 shadow-sm">
              <div class="card-body table-responsive">
                <table class="table table-hover mb-0">
                  <thead class="table-light"><tr><th>WIP No</th><th>Production Order</th><th>Stage</th><th>In</th><th>Out</th><th>Scrap</th><th>Rework</th><th>Rejection</th><th>Machine/Shift/Operator</th></tr></thead>
                  <tbody id="wipBody"><tr><td colspan="9" class="text-center text-muted">Loading...</td></tr></tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- FG RECEIPT -->
          <div class="tab-pane fade" id="receipts">
            <div class="d-flex justify-content-between mb-2">
              <p class="text-muted small mb-0">Finished-goods receipt posts real, traceable stock for the BOM's output material, closing the requisition-to-finished-goods loop.</p>
              <button class="btn btn-sm btn-primary" onclick="ReceiptModal.show()"><i class="fas fa-plus me-1"></i>Record Receipt</button>
            </div>
            <div class="card border-0 shadow-sm">
              <div class="card-body table-responsive">
                <table class="table table-hover mb-0">
                  <thead class="table-light"><tr><th>Receipt No</th><th>Production Order</th><th>Warehouse</th><th>Qty Received</th><th>Scrap/Rework/Rejection</th><th>By-Product</th><th>Final?</th><th>By</th></tr></thead>
                  <tbody id="receiptsBody"><tr><td colspan="8" class="text-center text-muted">Loading...</td></tr></tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- VARIANCE REPORT -->
          <div class="tab-pane fade" id="variance">
            <p class="text-muted small">Actual raw-material consumption and output vs. what the BOM says should have been used, for every order in progress or completed.</p>
            <div id="varianceContainer"><div class="text-center text-muted py-4">Loading...</div></div>
          </div>
        </div>
      </div>
    </div>

    ${ProductionPlanningPage.modalsHtml()}
  `,

  modalsHtml: () => `
    <!-- Production Order Modal -->
    <div class="modal fade" id="prodModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Create Production Order</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="prodForm" onsubmit="ProductionModal.submit(event)">
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Use BOM (optional)</label>
                <select class="form-control" id="recipeSelect" onchange="ProductionModal.onRecipeChange()">
                  <option value="">— None, enter manually —</option>
                </select>
                <div class="form-text">Selecting a BOM auto-fills the product name/unit, computes raw material needed, and pre-generates job cards from its routing.</div>
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Product Name *</label>
                  <input type="text" class="form-control" id="productName" required>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Quantity *</label>
                  <input type="number" class="form-control" id="quantity" step="0.01" required oninput="ProductionModal.recalculate()">
                </div>
              </div>
              <div id="recipePreview" class="alert alert-light border small" style="display:none"></div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Start Date *</label>
                  <input type="date" class="form-control" id="startDate" required>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">End Date *</label>
                  <input type="date" class="form-control" id="endDate" required>
                </div>
              </div>
              <div class="row">
                <div class="col-md-4 mb-3">
                  <label class="form-label">Priority</label>
                  <select class="form-control" id="priority"><option>Normal</option><option>High</option><option>Urgent</option></select>
                </div>
                <div class="col-md-4 mb-3">
                  <label class="form-label">Routing</label>
                  <select class="form-control" id="orderRouting"><option value="">— From BOM / None —</option></select>
                </div>
                <div class="col-md-4 mb-3">
                  <label class="form-label">Machine</label>
                  <select class="form-control" id="orderMachine"><option value="">— Unassigned —</option></select>
                </div>
              </div>
              <div class="row">
                <div class="col-md-4 mb-3">
                  <label class="form-label">Shift</label>
                  <select class="form-control" id="orderShift"><option value="">— Unassigned —</option><option>Day</option><option>Night</option><option>General</option><option>A</option><option>B</option><option>C</option></select>
                </div>
                <div class="col-md-4 mb-3">
                  <label class="form-label">Operator</label>
                  <select class="form-control" id="orderOperator"><option value="">— Unassigned —</option></select>
                </div>
                <div class="col-md-4 mb-3">
                  <label class="form-label">Source Warehouse (Issue From)</label>
                  <select class="form-control" id="orderSourceWarehouse"><option value="">— Select —</option></select>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Output Warehouse (Receipt To)</label>
                  <select class="form-control" id="orderOutputWarehouse"><option value="">— Select —</option></select>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Create</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Work Order Complete Modal -->
    <div class="modal fade" id="woCompleteModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Update Work Order</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
          <form onsubmit="WorkOrderModal.submit(event)">
            <div class="modal-body">
              <input type="hidden" id="woId">
              <div class="mb-2"><label class="form-label">Status</label>
                <select class="form-control" id="woStatus"><option>Not Started</option><option>In Progress</option><option>Completed</option><option>On Hold</option></select>
              </div>
              <div class="row">
                <div class="col-6 mb-2"><label class="form-label">Machine</label><select class="form-control" id="woMachine"></select></div>
                <div class="col-6 mb-2"><label class="form-label">Shift</label>
                  <select class="form-control" id="woShift"><option value="">—</option><option>Day</option><option>Night</option><option>General</option><option>A</option><option>B</option><option>C</option></select>
                </div>
              </div>
              <div class="mb-2"><label class="form-label">Operator</label><select class="form-control" id="woOperator"></select></div>
              <div class="row">
                <div class="col-4 mb-2"><label class="form-label">Qty Produced</label><input type="number" class="form-control" id="woQtyProduced" step="0.01" value="0"></div>
                <div class="col-4 mb-2"><label class="form-label">Scrap Qty</label><input type="number" class="form-control" id="woScrap" step="0.01" value="0"></div>
                <div class="col-4 mb-2"><label class="form-label">Rejection Qty</label><input type="number" class="form-control" id="woRejection" step="0.01" value="0"></div>
              </div>
              <div class="mb-2"><label class="form-label">Notes</label><textarea class="form-control" id="woNotes" rows="2"></textarea></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Issue Material Modal -->
    <div class="modal fade" id="issueModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Issue Raw Material to Production</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
          <form onsubmit="IssueModal.submit(event)">
            <div class="modal-body">
              <div class="mb-2"><label class="form-label">Production Order *</label><select class="form-control" id="issueOrder" required></select></div>
              <div class="mb-2"><label class="form-label">Material *</label><select class="form-control" id="issueMaterial" required></select></div>
              <div class="mb-2"><label class="form-label">Quantity *</label><input type="number" class="form-control" id="issueQty" step="0.01" required></div>
              <div class="mb-2"><label class="form-label">Warehouse *</label><select class="form-control" id="issueWarehouse" required></select></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Issue</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Return Material Modal -->
    <div class="modal fade" id="returnModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Return Unused Material to Store</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
          <form onsubmit="ReturnModal.submit(event)">
            <div class="modal-body">
              <div class="mb-2"><label class="form-label">Production Order *</label><select class="form-control" id="returnOrder" required></select></div>
              <div class="mb-2"><label class="form-label">Material *</label><select class="form-control" id="returnMaterial" required></select></div>
              <div class="mb-2"><label class="form-label">Quantity *</label><input type="number" class="form-control" id="returnQty" step="0.01" required></div>
              <div class="mb-2"><label class="form-label">Warehouse *</label><select class="form-control" id="returnWarehouse" required></select></div>
              <div class="mb-2"><label class="form-label">Reason</label><input type="text" class="form-control" id="returnReason" placeholder="e.g. Excess issued, order cancelled"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Return to Store</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- WIP Log Modal -->
    <div class="modal fade" id="wipModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Log WIP Movement</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
          <form onsubmit="WipModal.submit(event)">
            <div class="modal-body">
              <div class="mb-2"><label class="form-label">Production Order *</label><select class="form-control" id="wipOrder" required></select></div>
              <div class="mb-2"><label class="form-label">Work Order / Operation (optional)</label><select class="form-control" id="wipWorkOrder"><option value="">— None —</option></select></div>
              <div class="mb-2"><label class="form-label">Stage / Operation Name *</label><input type="text" class="form-control" id="wipStage" required placeholder="e.g. Slitting, Annealing, Packing"></div>
              <div class="row">
                <div class="col-6 mb-2"><label class="form-label">Qty In</label><input type="number" class="form-control" id="wipQtyIn" step="0.01" value="0"></div>
                <div class="col-6 mb-2"><label class="form-label">Qty Out</label><input type="number" class="form-control" id="wipQtyOut" step="0.01" value="0"></div>
              </div>
              <div class="row">
                <div class="col-4 mb-2"><label class="form-label">Scrap</label><input type="number" class="form-control" id="wipScrap" step="0.01" value="0"></div>
                <div class="col-4 mb-2"><label class="form-label">Rework</label><input type="number" class="form-control" id="wipRework" step="0.01" value="0"></div>
                <div class="col-4 mb-2"><label class="form-label">Rejection</label><input type="number" class="form-control" id="wipRejection" step="0.01" value="0"></div>
              </div>
              <div class="row">
                <div class="col-4 mb-2"><label class="form-label">Machine</label><select class="form-control" id="wipMachine"></select></div>
                <div class="col-4 mb-2"><label class="form-label">Shift</label>
                  <select class="form-control" id="wipShift"><option value="">—</option><option>Day</option><option>Night</option><option>General</option><option>A</option><option>B</option><option>C</option></select>
                </div>
                <div class="col-4 mb-2"><label class="form-label">Operator</label><select class="form-control" id="wipOperator"></select></div>
              </div>
              <div class="mb-2"><label class="form-label">Remarks</label><input type="text" class="form-control" id="wipRemarks"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Log Movement</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- FG Receipt Modal -->
    <div class="modal fade" id="receiptModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Finished Goods Receipt</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
          <form onsubmit="ReceiptModal.submit(event)">
            <div class="modal-body">
              <div class="mb-2"><label class="form-label">Production Order *</label><select class="form-control" id="receiptOrder" required></select></div>
              <div class="mb-2"><label class="form-label">Warehouse *</label><select class="form-control" id="receiptWarehouse" required></select></div>
              <div class="mb-2"><label class="form-label">Quantity Received *</label><input type="number" class="form-control" id="receiptQty" step="0.01" required></div>
              <div class="mb-2"><label class="form-label">Batch Number</label><input type="text" class="form-control" id="receiptBatch" placeholder="Auto-generated if blank"></div>
              <div class="row">
                <div class="col-4 mb-2"><label class="form-label">Scrap</label><input type="number" class="form-control" id="receiptScrap" step="0.01" value="0"></div>
                <div class="col-4 mb-2"><label class="form-label">Rework</label><input type="number" class="form-control" id="receiptRework" step="0.01" value="0"></div>
                <div class="col-4 mb-2"><label class="form-label">Rejection</label><input type="number" class="form-control" id="receiptRejection" step="0.01" value="0"></div>
              </div>
              <div class="row">
                <div class="col-8 mb-2"><label class="form-label">By-Product (optional)</label><select class="form-control" id="receiptByProductMaterial"><option value="">— None —</option></select></div>
                <div class="col-4 mb-2"><label class="form-label">By-Product Qty</label><input type="number" class="form-control" id="receiptByProductQty" step="0.01" value="0"></div>
              </div>
              <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="receiptFinal">
                <label class="form-check-label" for="receiptFinal">This is the final receipt — mark order Completed</label>
              </div>
              <div class="mb-2"><label class="form-label">Remarks</label><input type="text" class="form-control" id="receiptRemarks"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Record Receipt</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,

  masters: { orders: [], materials: [], warehouses: [], machines: [], employees: [] },

  init: async () => {
    await ProductionPlanningPage.loadMasters();
    await Promise.all([
      ProductionPlanningPage.loadBoard(),
      ProductionPlanningPage.loadOrders(),
      ProductionPlanningPage.loadWorkOrders(),
      ProductionPlanningPage.loadAllocations(),
      ProductionPlanningPage.loadReturns(),
      ProductionPlanningPage.loadWip(),
      ProductionPlanningPage.loadReceipts(),
      ProductionPlanningPage.loadVariance()
    ]);
  },

  loadMasters: async () => {
    const [orders, materials, warehouses, machines, employees] = await Promise.all([
      API.getProductionOrders(), API.getMaterials(), API.getWarehouses(), API.getMachines(), API.getEmployees()
    ]);
    const asArray = (v) => Array.isArray(v) ? v : [];
    ProductionPlanningPage.masters = {
      orders: asArray(orders), materials: asArray(materials), warehouses: asArray(warehouses),
      machines: asArray(machines), employees: asArray(employees)
    };
  },

  orderOptions: () => ProductionPlanningPage.masters.orders.map(o => `<option value="${o.id}">${o.po_number} — ${o.product_name} (${o.quantity} ${o.unit_of_measure || ''})</option>`).join(''),
  materialOptions: () => ProductionPlanningPage.masters.materials.map(m => `<option value="${m.id}">${m.material_name} (${m.material_code})</option>`).join(''),
  warehouseOptions: () => ProductionPlanningPage.masters.warehouses.map(w => `<option value="${w.id}">${w.warehouse_name}</option>`).join(''),
  machineOptions: () => '<option value="">— Unassigned —</option>' + ProductionPlanningPage.masters.machines.map(m => `<option value="${m.id}">${m.machine_name}</option>`).join(''),
  employeeOptions: () => '<option value="">— Unassigned —</option>' + ProductionPlanningPage.masters.employees.map(e => `<option value="${e.id}">${e.full_name}</option>`).join(''),

  loadBoard: async () => {
    const board = await API.getSchedulingBoard();
    if (!board || board.error) {
      document.getElementById('schedulingBoard').innerHTML = `<div class="col-12 text-danger text-center py-4">${(board && board.error) || 'Could not load scheduling board'}</div>`;
      return;
    }
    const lanes = ['Planned', 'In Progress', 'On Hold', 'Completed'];
    const laneColor = { Planned: 'secondary', 'In Progress': 'warning', 'On Hold': 'danger', Completed: 'success' };
    document.getElementById('activeOrders').textContent = (board.Planned.length + board['In Progress'].length + board['On Hold'].length);
    document.getElementById('completedToday').textContent = board.Completed.length;

    document.getElementById('schedulingBoard').innerHTML = lanes.map(lane => `
      <div class="col-md-3 mb-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-${laneColor[lane]} bg-opacity-25 fw-bold">${lane} <span class="badge bg-${laneColor[lane]}">${board[lane].length}</span></div>
          <div class="card-body p-2" style="max-height:520px; overflow-y:auto;">
            ${board[lane].length ? board[lane].map(o => `
              <div class="card mb-2 border-start border-3 border-${laneColor[lane]}">
                <div class="card-body p-2">
                  <div class="d-flex justify-content-between">
                    <strong class="small">${o.po_number}</strong>
                    <span class="badge bg-${o.priority === 'Urgent' ? 'danger' : o.priority === 'High' ? 'warning' : 'light text-dark'}">${o.priority}</span>
                  </div>
                  <div class="small">${o.product_name}</div>
                  <div class="small text-muted">${o.quantity} ${o.unit_of_measure || ''}</div>
                  <div class="small text-muted">${o.start_date ? new Date(o.start_date).toLocaleDateString('en-IN') : ''} → ${o.end_date ? new Date(o.end_date).toLocaleDateString('en-IN') : ''}</div>
                  ${o.machine_name ? `<div class="small text-muted"><i class="fas fa-cog"></i> ${o.machine_name}${o.shift ? ' · ' + o.shift : ''}${o.operator_name ? ' · ' + o.operator_name : ''}</div>` : ''}
                  <div class="small">Ops: ${o.completed_operations}/${o.total_operations}</div>
                  <select class="form-select form-select-sm mt-1" onchange="ProductionPlanningPage.rescheduleStatus(${o.id}, this.value)">
                    ${lanes.map(l => `<option value="${l}" ${l === lane ? 'selected' : ''}>${l}</option>`).join('')}
                  </select>
                </div>
              </div>
            `).join('') : '<div class="text-muted small text-center py-3">No orders</div>'}
          </div>
        </div>
      </div>
    `).join('');
  },

  rescheduleStatus: async (orderId, status) => {
    const result = await API.scheduleProductionOrder(orderId, { status });
    if (result && !result.error) {
      await ProductionPlanningPage.loadBoard();
      await ProductionPlanningPage.loadOrders();
    } else {
      alert('Error: ' + ((result && result.error) || 'Could not update'));
    }
  },

  loadOrders: async () => {
    const orders = await API.getProductionOrders();
    ProductionPlanningPage.masters.orders = orders || [];
    document.getElementById('inProgressWO').textContent = '-';

    const html = (orders && orders.length > 0)
      ? orders.map(o => `
          <tr>
            <td><strong>${o.po_number}</strong></td>
            <td>${o.product_name}${o.product_code ? ` <span class="text-muted small">(${o.product_code})</span>` : ''}</td>
            <td>${o.quantity} ${o.unit_of_measure || ''}</td>
            <td>${o.expected_input_quantity ? parseFloat(o.expected_input_quantity).toFixed(2) : '-'} / ${o.expected_output_quantity ? parseFloat(o.expected_output_quantity).toFixed(2) : '-'}</td>
            <td>${o.actual_input_quantity ? parseFloat(o.actual_input_quantity).toFixed(2) : '0'} / ${o.actual_output_quantity ? parseFloat(o.actual_output_quantity).toFixed(2) : '0'}</td>
            <td class="small">${new Date(o.start_date).toLocaleDateString('en-IN')} → ${new Date(o.end_date).toLocaleDateString('en-IN')}</td>
            <td class="small">${o.machine_name || '-'} / ${o.shift || '-'} / ${o.operator_name || '-'}</td>
            <td><span class="badge bg-${o.priority === 'Urgent' ? 'danger' : 'warning'}">${o.priority}</span></td>
            <td><span class="badge bg-info">${o.status}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-secondary" onclick="ProductionPlanningPage.showVarianceFor(${o.id})">Variance</button>
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="10" class="text-center text-muted">No production orders</td></tr>';
    document.getElementById('ordersBody').innerHTML = html;
    ProductionPlanningPage.refreshOrderDropdowns();
  },

  refreshOrderDropdowns: () => {
    const opts = ProductionPlanningPage.orderOptions();
    ['issueOrder', 'returnOrder', 'wipOrder', 'receiptOrder'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<option value="">— Select —</option>' + opts;
    });
    const wipFilter = document.getElementById('wipOrderFilter');
    if (wipFilter) wipFilter.innerHTML = '<option value="">— Select an order —</option>' + opts;
  },

  loadWorkOrders: async () => {
    const workOrders = await API.getWorkOrders();
    document.getElementById('inProgressWO').textContent = (workOrders || []).filter(w => w.status === 'In Progress').length;
    const html = (workOrders && workOrders.length > 0)
      ? workOrders.map(w => `
          <tr>
            <td><strong>${w.work_order_number}</strong></td>
            <td>${w.po_number || w.production_order_id}</td>
            <td>${w.operation_number ?? '-'}</td>
            <td>${w.operation_name}</td>
            <td>${w.machine_name || '-'}</td>
            <td>${w.shift || '-'}</td>
            <td>${w.operator_name || '-'}</td>
            <td>${w.quantity_produced || 0}</td>
            <td>${w.scrap_quantity || 0} / ${w.rejection_quantity || 0}</td>
            <td><span class="badge bg-${w.status === 'Completed' ? 'success' : w.status === 'In Progress' ? 'warning' : 'secondary'}">${w.status}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="WorkOrderModal.show(${w.id})">Update</button>
              <button class="btn btn-sm btn-outline-secondary" onclick="JobCard.print(${w.id})">Job Card</button>
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="11" class="text-center text-muted">No work orders — created automatically when a production order uses a BOM with a linked routing.</td></tr>';
    document.getElementById('workOrdersBody').innerHTML = html;
  },

  loadAllocations: async () => {
    const allocations = await API.getAllocations();
    document.getElementById('allocationPending').textContent = (allocations || []).length;
    const html = (allocations && allocations.length > 0)
      ? allocations.map(a => `
          <tr><td>${a.allocation_number}</td><td>${a.po_number || a.production_order_id}</td><td>${a.material_name}</td>
          <td>${a.quantity_allocated}</td><td>${a.warehouse_name || '-'}</td><td><span class="badge bg-success">${a.status}</span></td></tr>
        `).join('')
      : '<tr><td colspan="6" class="text-center text-muted">No material issued yet</td></tr>';
    document.getElementById('allocationBody').innerHTML = html;
  },

  loadReturns: async () => {
    const returns = await API.getProductionReturns();
    const html = (returns && returns.length > 0)
      ? returns.map(r => `
          <tr><td>${r.return_number}</td><td>${r.po_number || r.production_order_id}</td><td>${r.material_name}</td>
          <td>${r.quantity_returned}</td><td>${r.warehouse_name || '-'}</td><td>${r.reason || '-'}</td><td>${r.returned_by_name || '-'}</td></tr>
        `).join('')
      : '<tr><td colspan="7" class="text-center text-muted">No returns recorded yet</td></tr>';
    document.getElementById('returnsBody').innerHTML = html;
  },

  loadWip: async () => {
    const rows = await API.getWipLog();
    const html = (rows && rows.length > 0)
      ? rows.map(w => `
          <tr><td>${w.wip_number}</td><td>${w.po_number || w.production_order_id}</td><td>${w.stage_name}</td>
          <td>${w.quantity_in}</td><td>${w.quantity_out}</td><td>${w.scrap_quantity}</td><td>${w.rework_quantity}</td><td>${w.rejection_quantity}</td>
          <td class="small">${w.machine_name || '-'} / ${w.shift || '-'} / ${w.operator_name || '-'}</td></tr>
        `).join('')
      : '<tr><td colspan="9" class="text-center text-muted">No WIP movements logged yet</td></tr>';
    document.getElementById('wipBody').innerHTML = html;
  },

  loadWipSummary: async () => {
    const orderId = document.getElementById('wipOrderFilter').value;
    const container = document.getElementById('wipSummary');
    if (!orderId) { container.innerHTML = ''; return; }
    const rows = await API.getWipSummary(orderId);
    if (!rows || rows.error || rows.length === 0) { container.innerHTML = '<div class="text-muted small">No WIP logged for this order yet.</div>'; return; }
    container.innerHTML = `
      <table class="table table-sm table-bordered mb-0">
        <thead class="table-light"><tr><th>Stage</th><th>Total In</th><th>Total Out</th><th>Scrap</th><th>Rework</th><th>Rejection</th><th>WIP Balance</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${r.stage_name}</td><td>${r.total_in}</td><td>${r.total_out}</td><td>${r.total_scrap}</td><td>${r.total_rework}</td><td>${r.total_rejection}</td><td><strong>${r.wip_balance}</strong></td></tr>`).join('')}</tbody>
      </table>`;
  },

  loadReceipts: async () => {
    const rows = await API.getProductionReceipts();
    const html = (rows && rows.length > 0)
      ? rows.map(r => `
          <tr><td>${r.receipt_number}</td><td>${r.po_number || r.production_order_id}</td><td>${r.warehouse_name || '-'}</td>
          <td>${r.quantity_received}</td><td>${r.scrap_quantity}/${r.rework_quantity}/${r.rejection_quantity}</td>
          <td>${r.by_product_name ? `${r.by_product_name}: ${r.by_product_quantity}` : '-'}</td>
          <td>${r.is_final ? '<span class="badge bg-success">Final</span>' : '<span class="badge bg-secondary">Partial</span>'}</td>
          <td>${r.received_by_name || '-'}</td></tr>
        `).join('')
      : '<tr><td colspan="8" class="text-center text-muted">No receipts recorded yet</td></tr>';
    document.getElementById('receiptsBody').innerHTML = html;
  },

  loadVariance: async () => {
    const reports = await API.getVarianceReports();
    const container = document.getElementById('varianceContainer');
    if (!reports || reports.error) { container.innerHTML = `<div class="text-danger">${(reports && reports.error) || 'Could not load variance report'}</div>`; return; }
    if (reports.length === 0) { container.innerHTML = '<div class="text-muted text-center py-4">No in-progress or completed orders yet.</div>'; return; }
    container.innerHTML = reports.map(ProductionPlanningPage.varianceCardHtml).join('');
  },

  varianceCardHtml: (v) => `
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between">
          <h6>${v.po_number} — ${v.product_name}</h6>
          <div>
            <span class="badge bg-${v.yield_percent >= 95 ? 'success' : v.yield_percent >= 85 ? 'warning' : 'danger'}">Yield: ${v.yield_percent ?? '-'}%</span>
          </div>
        </div>
        <div class="small text-muted mb-2">Planned output ${v.planned_output} · Actual output ${v.actual_output} · Output variance ${v.output_variance >= 0 ? '+' : ''}${v.output_variance} · Scrap ${v.total_scrap} · Rejection ${v.total_rejection}</div>
        ${v.materials.length ? `
        <table class="table table-sm mb-0">
          <thead class="table-light"><tr><th>Material</th><th>Planned</th><th>Issued</th><th>Returned</th><th>Net Consumed</th><th>Variance</th></tr></thead>
          <tbody>
            ${v.materials.map(m => `
              <tr class="${Math.abs(m.variance_percent || 0) > 10 ? 'table-danger' : ''}">
                <td>${m.material_name}</td><td>${m.planned_quantity}</td><td>${m.issued_quantity}</td><td>${m.returned_quantity}</td>
                <td>${m.net_consumed}</td><td>${m.variance >= 0 ? '+' : ''}${m.variance} ${m.variance_percent !== null ? `(${m.variance_percent}%)` : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="text-muted small">This order has no BOM linked, so no material-level variance is available.</div>'}
      </div>
    </div>
  `,

  showVarianceFor: async (orderId) => {
    const tabBtn = document.querySelector('#prodTabs button[data-bs-target="#variance"]');
    if (tabBtn) new bootstrap.Tab(tabBtn).show();
    const v = await API.getVarianceReport(orderId);
    if (!v || v.error) { alert('Could not load variance report'); return; }
    document.getElementById('varianceContainer').innerHTML = ProductionPlanningPage.varianceCardHtml(v);
  }
};

const ProductionModal = {
  modal: null,
  recipes: [],
  routings: [],
  selectedRecipe: null,

  show: async () => {
    document.getElementById('prodForm').reset();
    document.getElementById('productName').disabled = false;
    document.getElementById('recipePreview').style.display = 'none';
    ProductionModal.selectedRecipe = null;

    const recipesResult = await API.getProductionRecipes();
    ProductionModal.recipes = Array.isArray(recipesResult) ? recipesResult : [];
    const flatRecipes = ProductionModal.recipes.flatMap(r => [r, ...(r.alternates || [])]);
    document.getElementById('recipeSelect').innerHTML = '<option value="">— None, enter manually —</option>' +
      flatRecipes.map(r => `<option value="${r.id}">${r.product_name}${r.is_alternate ? ' (Alt: ' + (r.alternate_label || 'alternate') + ')' : ''} (${r.product_code})</option>`).join('');

    const routingsResult = await API.getRoutings();
    ProductionModal.routings = Array.isArray(routingsResult) ? routingsResult : [];
    document.getElementById('orderRouting').innerHTML = '<option value="">— From BOM / None —</option>' +
      ProductionModal.routings.map(r => `<option value="${r.id}">${r.routing_name}</option>`).join('');

    document.getElementById('orderMachine').innerHTML = ProductionPlanningPage.machineOptions();
    document.getElementById('orderOperator').innerHTML = ProductionPlanningPage.employeeOptions();
    document.getElementById('orderSourceWarehouse').innerHTML = '<option value="">— Select —</option>' + ProductionPlanningPage.warehouseOptions();
    document.getElementById('orderOutputWarehouse').innerHTML = '<option value="">— Select —</option>' + ProductionPlanningPage.warehouseOptions();

    ProductionModal.modal = new bootstrap.Modal(document.getElementById('prodModal'));
    ProductionModal.modal.show();
  },

  onRecipeChange: async () => {
    const recipeId = document.getElementById('recipeSelect').value;
    if (!recipeId) {
      ProductionModal.selectedRecipe = null;
      document.getElementById('productName').disabled = false;
      document.getElementById('recipePreview').style.display = 'none';
      return;
    }
    const recipe = await API.getProductionRecipe(recipeId);
    if (!recipe || recipe.error) return;
    ProductionModal.selectedRecipe = recipe;
    document.getElementById('productName').value = recipe.product_name;
    document.getElementById('productName').disabled = true;
    if (recipe.routing_id) document.getElementById('orderRouting').value = recipe.routing_id;
    if (!document.getElementById('quantity').value) document.getElementById('quantity').value = recipe.output_quantity;
    ProductionModal.recalculate();
  },

  recalculate: () => {
    const recipe = ProductionModal.selectedRecipe;
    const preview = document.getElementById('recipePreview');
    if (!recipe) { preview.style.display = 'none'; return; }
    const orderQty = parseFloat(document.getElementById('quantity').value) || 0;
    const multiplier = recipe.output_quantity ? orderQty / parseFloat(recipe.output_quantity) : 0;
    const rows = (recipe.items || []).map(item => {
      const needed = (parseFloat(item.input_quantity) || 0) * multiplier;
      const withScrap = needed * (1 + (parseFloat(item.scrap_percent) || 0) / 100);
      return `<div>• ${item.material_name}: <strong>${withScrap.toFixed(2)} ${item.input_unit || ''}</strong>${item.scrap_percent > 0 ? ` (incl. ${item.scrap_percent}% scrap)` : ''}</div>`;
    }).join('');
    const totalInput = (recipe.items || []).reduce((sum, item) => {
      const needed = (parseFloat(item.input_quantity) || 0) * multiplier;
      return sum + needed * (1 + (parseFloat(item.scrap_percent) || 0) / 100);
    }, 0);
    preview.style.display = 'block';
    preview.innerHTML = `
      <strong>Raw material needed for ${orderQty || 0} ${recipe.output_unit || ''} output:</strong>
      ${rows}
      <div class="mt-1"><strong>Total input: ${totalInput.toFixed(2)}</strong> vs output ${orderQty || 0} ${recipe.output_unit || ''}</div>
      ${!recipe.output_material_id ? '<div class="text-danger mt-1">⚠ This BOM has no Output Material linked — Finished Goods Receipt will not be possible until you set one on the BOM.</div>' : ''}
    `;
  },

  submit: async (event) => {
    event.preventDefault();
    const data = {
      recipe_id: ProductionModal.selectedRecipe ? ProductionModal.selectedRecipe.id : null,
      product_name: document.getElementById('productName').value,
      quantity: parseFloat(document.getElementById('quantity').value),
      unit_of_measure: ProductionModal.selectedRecipe ? ProductionModal.selectedRecipe.output_unit : null,
      start_date: document.getElementById('startDate').value,
      end_date: document.getElementById('endDate').value,
      priority: document.getElementById('priority').value,
      routing_id: document.getElementById('orderRouting').value || null,
      machine_id: document.getElementById('orderMachine').value || null,
      shift: document.getElementById('orderShift').value || null,
      operator_id: document.getElementById('orderOperator').value || null,
      source_warehouse_id: document.getElementById('orderSourceWarehouse').value || null,
      output_warehouse_id: document.getElementById('orderOutputWarehouse').value || null
    };

    const result = await API.createProductionOrder(data);
    if (result && !result.error) {
      ProductionModal.modal.hide();
      alert(result.message || ('Production order created: ' + result.po_number));
      await ProductionPlanningPage.init();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};

const WorkOrderModal = {
  modal: null,
  currentId: null,

  show: async (woId) => {
    const workOrders = await API.getWorkOrders();
    const wo = (workOrders || []).find(w => w.id === woId);
    if (!wo) { alert('Work order not found'); return; }
    WorkOrderModal.currentId = woId;
    document.getElementById('woId').value = woId;
    document.getElementById('woStatus').value = wo.status;
    document.getElementById('woMachine').innerHTML = ProductionPlanningPage.machineOptions();
    document.getElementById('woOperator').innerHTML = ProductionPlanningPage.employeeOptions();
    document.getElementById('woMachine').value = wo.machine_id || '';
    document.getElementById('woOperator').value = wo.operator_id || '';
    document.getElementById('woShift').value = wo.shift || '';
    document.getElementById('woQtyProduced').value = wo.quantity_produced || 0;
    document.getElementById('woScrap').value = wo.scrap_quantity || 0;
    document.getElementById('woRejection').value = wo.rejection_quantity || 0;
    document.getElementById('woNotes').value = wo.notes || '';
    WorkOrderModal.modal = new bootstrap.Modal(document.getElementById('woCompleteModal'));
    WorkOrderModal.modal.show();
  },

  submit: async (event) => {
    event.preventDefault();
    const id = document.getElementById('woId').value;
    const status = document.getElementById('woStatus').value;
    const data = {
      status,
      machine_id: document.getElementById('woMachine').value || null,
      shift: document.getElementById('woShift').value || null,
      operator_id: document.getElementById('woOperator').value || null,
      quantity_produced: parseFloat(document.getElementById('woQtyProduced').value) || 0,
      scrap_quantity: parseFloat(document.getElementById('woScrap').value) || 0,
      rejection_quantity: parseFloat(document.getElementById('woRejection').value) || 0,
      notes: document.getElementById('woNotes').value
    };
    if (status === 'In Progress') data.start_time = new Date().toISOString();
    if (status === 'Completed') data.end_time = new Date().toISOString();
    const result = await API.updateWorkOrder(id, data);
    if (result && !result.error) {
      WorkOrderModal.modal.hide();
      await ProductionPlanningPage.loadWorkOrders();
      await ProductionPlanningPage.loadOrders();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};

const IssueModal = {
  modal: null,
  show: () => {
    document.getElementById('issueOrder').innerHTML = '<option value="">— Select —</option>' + ProductionPlanningPage.orderOptions();
    document.getElementById('issueMaterial').innerHTML = ProductionPlanningPage.materialOptions();
    document.getElementById('issueWarehouse').innerHTML = ProductionPlanningPage.warehouseOptions();
    IssueModal.modal = new bootstrap.Modal(document.getElementById('issueModal'));
    IssueModal.modal.show();
  },
  submit: async (event) => {
    event.preventDefault();
    const data = {
      production_order_id: document.getElementById('issueOrder').value,
      material_id: document.getElementById('issueMaterial').value,
      quantity_allocated: parseFloat(document.getElementById('issueQty').value),
      warehouse_id: document.getElementById('issueWarehouse').value
    };
    const result = await API.createAllocation(data);
    if (result && !result.error) {
      IssueModal.modal.hide();
      alert(result.message || 'Material issued');
      await ProductionPlanningPage.loadAllocations();
      await ProductionPlanningPage.loadOrders();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};

const ReturnModal = {
  modal: null,
  show: () => {
    document.getElementById('returnOrder').innerHTML = '<option value="">— Select —</option>' + ProductionPlanningPage.orderOptions();
    document.getElementById('returnMaterial').innerHTML = ProductionPlanningPage.materialOptions();
    document.getElementById('returnWarehouse').innerHTML = ProductionPlanningPage.warehouseOptions();
    ReturnModal.modal = new bootstrap.Modal(document.getElementById('returnModal'));
    ReturnModal.modal.show();
  },
  submit: async (event) => {
    event.preventDefault();
    const data = {
      production_order_id: document.getElementById('returnOrder').value,
      material_id: document.getElementById('returnMaterial').value,
      quantity_returned: parseFloat(document.getElementById('returnQty').value),
      warehouse_id: document.getElementById('returnWarehouse').value,
      reason: document.getElementById('returnReason').value
    };
    const result = await API.createProductionReturn(data);
    if (result && !result.error) {
      ReturnModal.modal.hide();
      alert(result.message || 'Material returned');
      await ProductionPlanningPage.loadReturns();
      await ProductionPlanningPage.loadOrders();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};

const WipModal = {
  modal: null,
  show: async () => {
    document.getElementById('wipOrder').innerHTML = '<option value="">— Select —</option>' + ProductionPlanningPage.orderOptions();
    document.getElementById('wipMachine').innerHTML = ProductionPlanningPage.machineOptions();
    document.getElementById('wipOperator').innerHTML = ProductionPlanningPage.employeeOptions();
    WipModal.modal = new bootstrap.Modal(document.getElementById('wipModal'));
    WipModal.modal.show();
  },
  onOrderChange: async () => {
    const orderId = document.getElementById('wipOrder').value;
    const sel = document.getElementById('wipWorkOrder');
    if (!orderId) { sel.innerHTML = '<option value="">— None —</option>'; return; }
    const wos = await API.getWorkOrders(orderId);
    sel.innerHTML = '<option value="">— None —</option>' + (wos || []).map(w => `<option value="${w.id}">${w.operation_name}</option>`).join('');
  },
  submit: async (event) => {
    event.preventDefault();
    const data = {
      production_order_id: document.getElementById('wipOrder').value,
      work_order_id: document.getElementById('wipWorkOrder').value || null,
      stage_name: document.getElementById('wipStage').value,
      quantity_in: parseFloat(document.getElementById('wipQtyIn').value) || 0,
      quantity_out: parseFloat(document.getElementById('wipQtyOut').value) || 0,
      scrap_quantity: parseFloat(document.getElementById('wipScrap').value) || 0,
      rework_quantity: parseFloat(document.getElementById('wipRework').value) || 0,
      rejection_quantity: parseFloat(document.getElementById('wipRejection').value) || 0,
      machine_id: document.getElementById('wipMachine').value || null,
      shift: document.getElementById('wipShift').value || null,
      operator_id: document.getElementById('wipOperator').value || null,
      remarks: document.getElementById('wipRemarks').value
    };
    const result = await API.logWip(data);
    if (result && !result.error) {
      WipModal.modal.hide();
      alert(result.message || 'WIP movement logged');
      await ProductionPlanningPage.loadWip();
      await ProductionPlanningPage.loadOrders();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};
// Populate work-order dropdown whenever the WIP order selection changes.
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'wipOrder') WipModal.onOrderChange(); });

const ReceiptModal = {
  modal: null,
  show: () => {
    document.getElementById('receiptOrder').innerHTML = '<option value="">— Select —</option>' + ProductionPlanningPage.orderOptions();
    document.getElementById('receiptWarehouse').innerHTML = ProductionPlanningPage.warehouseOptions();
    document.getElementById('receiptByProductMaterial').innerHTML = '<option value="">— None —</option>' + ProductionPlanningPage.materialOptions();
    ReceiptModal.modal = new bootstrap.Modal(document.getElementById('receiptModal'));
    ReceiptModal.modal.show();
  },
  submit: async (event) => {
    event.preventDefault();
    const data = {
      production_order_id: document.getElementById('receiptOrder').value,
      warehouse_id: document.getElementById('receiptWarehouse').value,
      quantity_received: parseFloat(document.getElementById('receiptQty').value),
      batch_number: document.getElementById('receiptBatch').value,
      scrap_quantity: parseFloat(document.getElementById('receiptScrap').value) || 0,
      rework_quantity: parseFloat(document.getElementById('receiptRework').value) || 0,
      rejection_quantity: parseFloat(document.getElementById('receiptRejection').value) || 0,
      by_product_material_id: document.getElementById('receiptByProductMaterial').value || null,
      by_product_quantity: parseFloat(document.getElementById('receiptByProductQty').value) || 0,
      is_final: document.getElementById('receiptFinal').checked,
      remarks: document.getElementById('receiptRemarks').value
    };
    const result = await API.createProductionReceipt(data);
    if (result && !result.error) {
      ReceiptModal.modal.hide();
      alert(result.message || 'Receipt recorded');
      await ProductionPlanningPage.loadReceipts();
      await ProductionPlanningPage.loadOrders();
      await ProductionPlanningPage.loadVariance();
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};

const JobCard = {
  print: async (workOrderId) => {
    const data = await API.getJobCard(workOrderId);
    if (!data || data.error) { alert('Could not load job card'); return; }
    const { work_order: wo, all_operations, materials_issued, company } = data;
    const companyAddressLine = [company && company.address, company && company.city, company && company.state].filter(Boolean).join(', ');
    const opsHtml = (all_operations || []).map(op => `
      <tr class="${op.operation_number === wo.operation_number ? 'current-op' : ''}">
        <td>${op.operation_number ?? '-'}</td><td>${op.operation_name}</td><td>${op.status}</td><td>${op.quantity_produced || 0}</td>
      </tr>
    `).join('');
    const matHtml = (materials_issued || []).map(m => `<tr><td>${m.material_name}</td><td>${m.quantity_allocated}</td><td>${m.unit_of_measure || ''}</td></tr>`).join('');

    const printHtml = `
      <!DOCTYPE html><html><head><title>Job Card ${wo.work_order_number}</title><meta charset="utf-8">
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: Arial, Helvetica, sans-serif; color:#222; font-size:12px; }
        h2 { color:#1a4d8f; margin-bottom:0; }
        table { width:100%; border-collapse: collapse; margin-top:8px; }
        th, td { border:1px solid #ccc; padding:5px 8px; text-align:left; font-size:11px; }
        th { background:#f0f4fa; }
        .current-op { background:#fff8dc; font-weight:bold; }
        .meta { display:flex; justify-content:space-between; background:#f7f9fc; border:1px solid #ddd; padding:8px; margin:10px 0; }
        .sign { display:flex; justify-content:space-between; margin-top:60px; }
        .sign div { border-top:1px solid #333; width:30%; text-align:center; padding-top:4px; }
      </style></head>
      <body>
        <h2>${(company && company.company_name) || 'Company'}</h2>
        <div class="small text-muted">${companyAddressLine}</div>
        <h3>JOB CARD</h3>
        <div class="meta">
          <div><strong>Work Order:</strong> ${wo.work_order_number}<br><strong>Production Order:</strong> ${wo.po_number}</div>
          <div><strong>Product:</strong> ${wo.product_name}<br><strong>Order Qty:</strong> ${wo.order_quantity} ${wo.unit_of_measure || ''}</div>
          <div><strong>Operation:</strong> ${wo.operation_name} (#${wo.operation_number ?? '-'})<br><strong>Status:</strong> ${wo.status}</div>
        </div>
        <div class="meta">
          <div><strong>Machine:</strong> ${wo.machine_name || '-'}</div>
          <div><strong>Shift:</strong> ${wo.shift || '-'}</div>
          <div><strong>Operator:</strong> ${wo.operator_name || wo.assigned_to_name || '-'}</div>
          <div><strong>Planned Hours:</strong> ${wo.planned_hours || '-'}</div>
        </div>
        <h4>All Operations for this Order</h4>
        <table><thead><tr><th>#</th><th>Operation</th><th>Status</th><th>Qty Produced</th></tr></thead><tbody>${opsHtml}</tbody></table>
        <h4>Materials Issued to this Order</h4>
        <table><thead><tr><th>Material</th><th>Qty</th><th>Unit</th></tr></thead><tbody>${matHtml || '<tr><td colspan="3">None issued yet</td></tr>'}</tbody></table>
        <div class="sign"><div>Operator</div><div>Supervisor</div><div>QC / Store</div></div>
        <script>window.onload = () => window.print();</script>
      </body></html>
    `;
    const w = window.open('', '_blank');
    if (!w) { alert('Please allow pop-ups to print the job card.'); return; }
    w.document.write(printHtml);
    w.document.close();
  }
};
