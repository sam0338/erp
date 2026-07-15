const API_BASE_URL = '/api';

class API {
  static async request(method, endpoint, data = null) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };

    const config = {
      method,
      headers
    };

    if (data) config.body = JSON.stringify(data);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      // No special-casing for 401 here anymore — see note above the class.
      // The status is attached (non-enumerable-ish via a plain prop) so a
      // caller that genuinely needs to tell "session invalid" apart from
      // other errors can check `result._status === 401` itself, opt-in,
      // with zero automatic side effects from this shared helper.
      const body = await response.json().catch(() => ({}));
      if (typeof body === 'object' && body !== null) body._status = response.status;
      return body;
    } catch (error) {
      console.error('API Error:', error);
      return { error: error.message };
    }
  }

  // Auth endpoints
  static register(data) { return this.request('POST', '/auth/register', data); }
  static login(data) { return this.request('POST', '/auth/login', data); }
  static getProfile() { return this.request('GET', '/auth/profile'); }

  // ===== VENDORS =====
  static getVendors() { return this.request('GET', '/purchase/vendors'); }

  // User management (admin only)
  static getUsers() { return this.request('GET', '/users'); }
  static getUserRoles() { return this.request('GET', '/users/roles'); }
  static createUser(data) { return this.request('POST', '/users', data); }
  static updateUser(id, data) { return this.request('PUT', `/users/${id}`, data); }
  static resetUserPassword(id, new_password) { return this.request('PUT', `/users/${id}/reset-password`, { new_password }); }

  // ===== QUALITY CONTROL =====
  static getPendingInspections() { return this.request('GET', '/quality/pending'); }
  static getInspectionHistory() { return this.request('GET', '/quality/inspections'); }
  static getQCHold() { return this.request('GET', '/quality/hold'); }
  static submitInspectionResult(id, data) { return this.request('POST', `/quality/inspections/${id}/result`, data); }
  static releaseHold(materialId, warehouseId, data) { return this.request('PUT', `/quality/hold/${materialId}/${warehouseId}/release`, data); }

  // ===== GRN detail (for the traceability print) =====
  static getGRNDetail(id) { return this.request('GET', `/purchase/grn/${id}`); }
  static submitGRNToAccounts(id, remarks) { return this.request('POST', `/purchase/grn/${id}/submit-accounts`, { remarks }); }

  // ===== Accounts GRN acknowledgement =====
  static getAccountsGRNSubmissions(date = null) { return this.request('GET', `/accounts/grn-submissions${date ? `?date=${date}` : ''}`); }
  static acknowledgeGRNSubmission(id, remarks) { return this.request('PUT', `/accounts/grn-submissions/${id}/acknowledge`, { remarks }); }

  // ===== Invoices / Payment Vouchers =====
  static getInvoiceDetail(id) { return this.request('GET', `/purchase/invoices/${id}`); }
  static createPaymentVoucher(invoiceId, data) { return this.request('POST', `/purchase/invoices/${invoiceId}/vouchers`, data); }

  // ===== Company Settings =====
  static getCompanySettings() { return this.request('GET', '/settings/company'); }
  static updateCompanySettings(data) { return this.request('PUT', '/settings/company', data); }

  // ===== Approval Hierarchy Settings =====
  static getIndentApprovalSetting() { return this.request('GET', '/settings/approval/indent'); }
  static updateIndentApprovalSetting(levels_required) { return this.request('PUT', '/settings/approval/indent', { levels_required }); }
  static getPOApprovalMatrix() { return this.request('GET', '/settings/approval/po-matrix'); }
  static addPOApprovalTier(data) { return this.request('POST', '/settings/approval/po-matrix', data); }
  static deletePOApprovalTier(id) { return this.request('DELETE', `/settings/approval/po-matrix/${id}`); }

  // ===== Number Series =====
  static getNumberSeries() { return this.request('GET', '/settings/number-series'); }
  static updateNumberSeries(entity, data) { return this.request('PUT', `/settings/number-series/${entity}`, data); }

  // ===== Branches =====
  static getBranches() { return this.request('GET', '/settings/branches'); }
  static createBranch(data) { return this.request('POST', '/settings/branches', data); }
  static updateBranch(id, data) { return this.request('PUT', `/settings/branches/${id}`, data); }

  // ===== Financial Year & Period Locking =====
  static getFinancialYears() { return this.request('GET', '/settings/financial-years'); }
  static createFinancialYear(data) { return this.request('POST', '/settings/financial-years', data); }
  static lockPeriod(id) { return this.request('PUT', `/settings/periods/${id}/lock`); }
  static unlockPeriod(id) { return this.request('PUT', `/settings/periods/${id}/unlock`); }

  // ===== Audit Log =====
  static getAuditLog(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request('GET', `/settings/audit-log${params ? '?' + params : ''}`);
  }

  // ===== Notification Templates =====
  static getNotificationTemplates() { return this.request('GET', '/settings/notification-templates'); }
  static updateNotificationTemplate(id, data) { return this.request('PUT', `/settings/notification-templates/${id}`, data); }

  // ===== Backup & Restore =====
  static async downloadBackup() {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/settings/backup`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Backup failed' }));
      throw new Error(err.error || 'Backup failed');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sakaar-erp-backup-${new Date().toISOString().split('T')[0]}.db`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }
  static restoreBackup(fileDataBase64, confirm) { return this.request('POST', '/settings/restore', { file_data_base64: fileDataBase64, confirm }); }
  static backupToLocalPath(path) { return this.request('POST', '/settings/backup/to-path', { path }); }

  // ===== Auto-Backup Schedule =====
  static getBackupSchedule() { return this.request('GET', '/settings/backup-schedule'); }
  static saveBackupSchedule(data) { return this.request('PUT', '/settings/backup-schedule', data); }

  // ===== Google Drive Backup =====
  static getGdriveStatus() { return this.request('GET', '/settings/gdrive/status'); }
  static configureGdrive(client_id, client_secret) { return this.request('POST', '/settings/gdrive/configure', { client_id, client_secret }); }
  static getGdriveAuthUrl() { return this.request('GET', '/settings/gdrive/auth-url'); }
  static backupToGdriveNow() { return this.request('POST', '/settings/gdrive/backup-now'); }
  static getGdriveBackups() { return this.request('GET', '/settings/gdrive/backups'); }
  static restoreFromGdrive(file_id, confirm) { return this.request('POST', '/settings/gdrive/restore', { file_id, confirm }); }
  static disconnectGdrive() { return this.request('POST', '/settings/gdrive/disconnect'); }

  // ===== License =====
  static getLicenseStatus() { return this.request('GET', '/license/status'); }
  static activateLicense(license_key) { return this.request('POST', '/license/activate', { license_key }); }

  // ===== MASTER DATA =====
  static getSimpleMasters(type) { return this.request('GET', `/masters/simple/${type}`); }
  static createSimpleMaster(type, data) { return this.request('POST', `/masters/simple/${type}`, data); }
  static updateSimpleMaster(type, id, data) { return this.request('PUT', `/masters/simple/${type}/${id}`, data); }
  static deleteSimpleMaster(type, id) { return this.request('DELETE', `/masters/simple/${type}/${id}`); }

  static getUomConversions() { return this.request('GET', '/masters/uom-conversions'); }
  static createUomConversion(data) { return this.request('POST', '/masters/uom-conversions', data); }
  static deleteUomConversion(id) { return this.request('DELETE', `/masters/uom-conversions/${id}`); }

  static getWorkCenters() { return this.request('GET', '/masters/work-centers'); }
  static createWorkCenter(data) { return this.request('POST', '/masters/work-centers', data); }
  static updateWorkCenter(id, data) { return this.request('PUT', `/masters/work-centers/${id}`, data); }

  static getMachines() { return this.request('GET', '/masters/machines'); }
  static createMachine(data) { return this.request('POST', '/masters/machines', data); }
  static updateMachine(id, data) { return this.request('PUT', `/masters/machines/${id}`, data); }

  static getWarehouseLocations() { return this.request('GET', '/masters/warehouse-locations'); }
  static createWarehouseLocation(data) { return this.request('POST', '/masters/warehouse-locations', data); }
  static deleteWarehouseLocation(id) { return this.request('DELETE', `/masters/warehouse-locations/${id}`); }

  static getCustomers() { return this.request('GET', '/masters/customers'); }
  static createCustomer(data) { return this.request('POST', '/masters/customers', data); }
  static updateCustomer(id, data) { return this.request('PUT', `/masters/customers/${id}`, data); }

  static getTaxMaster() { return this.request('GET', '/masters/tax'); }
  static createTaxMaster(data) { return this.request('POST', '/masters/tax', data); }
  static updateTaxMaster(id, data) { return this.request('PUT', `/masters/tax/${id}`, data); }

  static getEmployees() { return this.request('GET', '/masters/employees'); }
  static createEmployee(data) { return this.request('POST', '/masters/employees', data); }
  static updateEmployee(id, data) { return this.request('PUT', `/masters/employees/${id}`, data); }

  static getRoutings() { return this.request('GET', '/masters/routing'); }
  static createRouting(data) { return this.request('POST', '/masters/routing', data); }
  static updateRouting(id, data) { return this.request('PUT', `/masters/routing/${id}`, data); }
  static deleteRouting(id) { return this.request('DELETE', `/masters/routing/${id}`); }

  // ===== Inventory traceability & reports =====
  static getStockBatches(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request('GET', `/inventory/batches${params ? '?' + params : ''}`);
  }
  static getStockAging() { return this.request('GET', '/inventory/aging'); }
  static getMovementReport(days) { return this.request('GET', `/inventory/movement-report?days=${days}`); }

  // ===== INVENTORY: category-wise stock summary =====
  static getStockSummary() { return this.request('GET', '/inventory/stock-summary'); }

  static getVendor(id) { return this.request('GET', `/purchase/vendors/${id}`); }
  static createVendor(data) { return this.request('POST', '/purchase/vendors', data); }
  static updateVendor(id, data) { return this.request('PUT', `/purchase/vendors/${id}`, data); }
  static deleteVendor(id) { return this.request('DELETE', `/purchase/vendors/${id}`); }

  // ===== MATERIALS =====
  static getMaterials() { return this.request('GET', '/purchase/materials'); }
  static createMaterial(data) { return this.request('POST', '/purchase/materials', data); }

  // ===== PURCHASE ORDERS =====
  static getPurchaseOrders() { return this.request('GET', '/purchase/purchase-orders'); }
  static getPurchaseOrder(id) { return this.request('GET', `/purchase/purchase-orders/${id}`); }
  static createPurchaseOrder(data) { return this.request('POST', '/purchase/purchase-orders', data); }
  static updatePurchaseOrder(id, data) { return this.request('PUT', `/purchase/purchase-orders/${id}`, data); }
  static deletePurchaseOrder(id) { return this.request('DELETE', `/purchase/purchase-orders/${id}`); }
  static submitPO(id) { return this.request('PUT', `/purchase/purchase-orders/${id}/submit`); }
  static approvePO(id) { return this.request('PUT', `/purchase/purchase-orders/${id}/approve`); }
  // BUG FIX: purchase-orders.js calls API.updatePOStatus(), but that method
  // never existed on this class, so clicking "Submit" on a PO threw
  // "API.updatePOStatus is not a function". Added to match the new
  // PUT /purchase/purchase-orders/:id/status endpoint.
  static updatePOStatus(id, status) { return this.request('PUT', `/purchase/purchase-orders/${id}/status`, { status }); }
  static requestPOChange(id, data) { return this.request('POST', `/purchase/purchase-orders/${id}/change-requests`, data); }
  static getPOChangeRequests() { return this.request('GET', '/purchase/po-change-requests'); }
  static decidePOChangeRequest(id, data) { return this.request('PUT', `/purchase/po-change-requests/${id}/decision`, data); }

  // ===== GRN =====
  static createGRN(data) { return this.request('POST', '/purchase/grn', data); }
  static getGRNs() { return this.request('GET', '/purchase/grn'); }

  // ===== INVOICES =====
  static createInvoice(data) { return this.request('POST', '/purchase/invoices', data); }
  static getInvoices() { return this.request('GET', '/purchase/invoices'); }
  static updateInvoiceStatus(id, data) { return this.request('PUT', `/purchase/invoices/${id}/status`, data); }

  // ===== INVENTORY - WAREHOUSES =====
  static getWarehouses() { return this.request('GET', '/inventory/warehouses'); }
  static createWarehouse(data) { return this.request('POST', '/inventory/warehouses', data); }

  // ===== INVENTORY - STOCK IN =====
  static createStockIn(data) { return this.request('POST', '/inventory/stock-in', data); }
  static getStockInList() { return this.request('GET', '/inventory/stock-in'); }

  // ===== INVENTORY - STOCK OUT =====
  static createStockOut(data) { return this.request('POST', '/inventory/stock-out', data); }
  static getStockOutList() { return this.request('GET', '/inventory/stock-out'); }

  // ===== INVENTORY - STOCK TRANSFER =====
  static createStockTransfer(data) { return this.request('POST', '/inventory/transfer', data); }
  static receiveStockTransfer(id) { return this.request('PUT', `/inventory/transfer/${id}/receive`); }
  static getStockTransferList() { return this.request('GET', '/inventory/transfer'); }

  // ===== INVENTORY - STOCK LEDGER =====
  static getStockLedger() { return this.request('GET', '/inventory/ledger'); }
  static getLowStockItems() { return this.request('GET', '/inventory/ledger/low-stock'); }

  // ===== INVENTORY - STOCK ADJUSTMENT =====
  static createStockAdjustment(data) { return this.request('POST', '/inventory/adjustment', data); }
  static approveStockAdjustment(id) { return this.request('PUT', `/inventory/adjustment/${id}/approve`); }
  static getStockAdjustmentList() { return this.request('GET', '/inventory/adjustment'); }

  // ===== INVENTORY - VALUATION =====
  static getStockValuation() { return this.request('GET', '/inventory/valuation'); }

  // ===== PRODUCTION - ORDERS =====
  static getProductionOrders() { return this.request('GET', '/production/orders'); }
  static createProductionOrder(data) { return this.request('POST', '/production/orders', data); }
  static updateProductionOrder(id, data) { return this.request('PUT', `/production/orders/${id}`, data); }
  static scheduleProductionOrder(id, data) { return this.request('PUT', `/production/orders/${id}/schedule`, data); }
  static getSchedulingBoard() { return this.request('GET', '/production/scheduling-board'); }
  static getProductionRecipes() { return this.request('GET', '/production/recipes'); }
  static getProductionRecipe(id) { return this.request('GET', `/production/recipes/${id}`); }
  static createProductionRecipe(data) { return this.request('POST', '/production/recipes', data); }
  static updateProductionRecipe(id, data) { return this.request('PUT', `/production/recipes/${id}`, data); }
  static createAlternateBOM(recipeId, data) { return this.request('POST', `/production/recipes/${recipeId}/alternates`, data); }

  // ===== PRODUCTION - WORK ORDERS / JOB CARDS =====
  static getWorkOrders(productionOrderId) { return this.request('GET', `/production/work-orders${productionOrderId ? `?production_order_id=${productionOrderId}` : ''}`); }
  static createWorkOrder(data) { return this.request('POST', '/production/work-orders', data); }
  static updateWorkOrder(id, data) { return this.request('PUT', `/production/work-orders/${id}`, data); }
  static getJobCard(workOrderId) { return this.request('GET', `/production/job-card/${workOrderId}`); }

  // ===== PRODUCTION - MATERIAL ISSUE / RETURN =====
  static getAllocations() { return this.request('GET', '/production/allocations'); }
  static createAllocation(data) { return this.request('POST', '/production/allocations', data); }
  static getProductionReturns() { return this.request('GET', '/production/returns'); }
  static createProductionReturn(data) { return this.request('POST', '/production/returns', data); }

  // ===== PRODUCTION - WIP =====
  static getWipLog(productionOrderId) { return this.request('GET', `/production/wip${productionOrderId ? `?production_order_id=${productionOrderId}` : ''}`); }
  static getWipSummary(productionOrderId) { return this.request('GET', `/production/wip/summary/${productionOrderId}`); }
  static logWip(data) { return this.request('POST', '/production/wip', data); }

  // ===== PRODUCTION - RECEIPTS =====
  static getProductionReceipts() { return this.request('GET', '/production/receipts'); }
  static createProductionReceipt(data) { return this.request('POST', '/production/receipts', data); }

  // ===== PRODUCTION - VARIANCE =====
  static getVarianceReport(id) { return this.request('GET', `/production/variance/${id}`); }
  static getVarianceReports() { return this.request('GET', '/production/variance'); }

  // ===== MATERIALS (additions) =====
  static getMaterial(id) { return this.request('GET', `/purchase/materials/${id}`); }
  static updateMaterial(id, data) { return this.request('PUT', `/purchase/materials/${id}`, data); }

  // ===== SALES & DISPATCH =====
  static getSalesDashboard() { return this.request('GET', '/sales/dashboard'); }
  static getCustomerDispatchHistory(customerId) { return this.request('GET', `/sales/customers/${customerId}/dispatch-history`); }

  static getQuotations() { return this.request('GET', '/sales/quotations'); }
  static getQuotation(id) { return this.request('GET', `/sales/quotations/${id}`); }
  static createQuotation(data) { return this.request('POST', '/sales/quotations', data); }
  static updateQuotationStatus(id, status) { return this.request('PUT', `/sales/quotations/${id}/status`, { status }); }
  static convertQuotation(id, data) { return this.request('POST', `/sales/quotations/${id}/convert`, data); }

  static getSalesOrders() { return this.request('GET', '/sales/orders'); }
  static getSalesOrder(id) { return this.request('GET', `/sales/orders/${id}`); }
  static createSalesOrder(data) { return this.request('POST', '/sales/orders', data); }
  static updateSalesOrderStatus(id, status) { return this.request('PUT', `/sales/orders/${id}/status`, { status }); }

  static getDispatchPlans() { return this.request('GET', '/sales/dispatch-plans'); }
  static createDispatchPlan(data) { return this.request('POST', '/sales/dispatch-plans', data); }
  static updateDispatchPlanStatus(id, status) { return this.request('PUT', `/sales/dispatch-plans/${id}/status`, { status }); }

  static getChallans() { return this.request('GET', '/sales/challans'); }
  static getChallan(id) { return this.request('GET', `/sales/challans/${id}`); }
  static createChallan(data) { return this.request('POST', '/sales/challans', data); }
  static updateChallanStatus(id, status) { return this.request('PUT', `/sales/challans/${id}/status`, { status }); }

  static getPackingLists() { return this.request('GET', '/sales/packing-lists'); }
  static createPackingList(data) { return this.request('POST', '/sales/packing-lists', data); }

  static getSalesReturns() { return this.request('GET', '/sales/returns'); }
  static createSalesReturn(data) { return this.request('POST', '/sales/returns', data); }
  static decideSalesReturn(id, status) { return this.request('PUT', `/sales/returns/${id}/decision`, { status }); }

  static getSalesInvoices() { return this.request('GET', '/sales/invoices'); }
  static getSalesInvoice(id) { return this.request('GET', `/sales/invoices/${id}`); }
  static getCustomerBillableItems(customerId) { return this.request('GET', `/sales/customers/${customerId}/billable-items`); }

  // ===== POS / Counter Billing =====
  static posSearch(query, warehouseId) { return this.request('GET', `/pos/search?q=${encodeURIComponent(query)}${warehouseId ? `&warehouse_id=${warehouseId}` : ''}`); }
  static posTodaySummary(warehouseId) { return this.request('GET', `/pos/today-summary${warehouseId ? `?warehouse_id=${warehouseId}` : ''}`); }
  static posGetInvoice(id) { return this.request('GET', `/pos/invoice/${id}`); }
  static posCompleteSale(data) { return this.request('POST', '/pos/sale', data); }
  static posSalesHistory(params = {}) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)).toString();
    return this.request('GET', `/pos/sales${qs ? '?' + qs : ''}`);
  }

  // ===== MIS Reports =====
  static misReport(key, params = {}) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)).toString();
    return this.request('GET', `/mis/${key}${qs ? '?' + qs : ''}`);
  }
  static createSalesInvoice(data) { return this.request('POST', '/sales/invoices', data); }
  static recordInvoicePayment(id, data) { return this.request('PUT', `/sales/invoices/${id}/record-payment`, data); }
  static getOrderAvailability(soId) { return this.request('GET', `/sales/orders/${soId}/availability`); }
  static checkAvailability(materialId, quantity) { return this.request('GET', `/sales/availability-check?material_id=${materialId}&quantity=${quantity}`); }

  // ===== FINANCE & COMMERCIAL CONTROLS =====
  static getExpenses() { return this.request('GET', '/finance/expenses'); }
  static createExpense(data) { return this.request('POST', '/finance/expenses', data); }
  static recordExpensePayment(id, data) { return this.request('PUT', `/finance/expenses/${id}/record-payment`, data); }
  static getPayablesSummary() { return this.request('GET', '/finance/payables-summary'); }
  static getVendorOutstanding() { return this.request('GET', '/finance/vendor-outstanding'); }
  static getReceivablesSummary() { return this.request('GET', '/finance/receivables-summary'); }
  static getCustomerOutstanding() { return this.request('GET', '/finance/customer-outstanding'); }
  static getMarginReport() { return this.request('GET', '/finance/margin-report'); }
  static getGstSummary(from, to) { return this.request('GET', `/finance/gst-summary${from && to ? `?from=${from}&to=${to}` : ''}`); }
  static getAccountingStaging(status) { return this.request('GET', `/finance/staging${status ? `?status=${status}` : ''}`); }
  static syncAccountingStaging() { return this.request('POST', '/finance/staging/sync'); }
  static async exportAccountingStaging() {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/finance/staging/export`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Export failed' }));
      throw new Error(err.error || 'Export failed');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounting-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  // ===== EMPLOYEE ADVANCE & EXPENSE CLAIMS =====
  static createExpenseClaim(data) { return this.request('POST', '/expenses/claims', data); }
  static getMyExpenseClaims() { return this.request('GET', '/expenses/claims/my'); }
  static getClaimsPendingMyApproval() { return this.request('GET', '/expenses/claims/pending-approval'); }
  static decideExpenseClaim(id, decision, comments) { return this.request('PUT', `/expenses/claims/${id}/manager-decision`, { decision, comments }); }
  static getClaimsForSettlement() { return this.request('GET', '/expenses/claims/for-settlement'); }
  static settleExpenseClaim(id, data) { return this.request('PUT', `/expenses/claims/${id}/settle`, data); }
  static getAllExpenseClaims(filters = {}) { const qs = new URLSearchParams(filters).toString(); return this.request('GET', `/expenses/claims${qs ? '?' + qs : ''}`); }
  static getExpenseClaim(id) { return this.request('GET', `/expenses/claims/${id}`); }
  static getExpenseClaimsSummary() { return this.request('GET', '/expenses/summary'); }

  // ===== INDENT =====
  static raiseIndent(data) { return this.request('POST', '/indent/create', data); }
  static updateIndent(id, data) { return this.request('PUT', `/indent/${id}`, data); }
  static getIndent(id) { return this.request('GET', `/indent/${id}`); }
  static getMyIndents() { return this.request('GET', '/indent/my-indents'); }
  static getApprovedIndents() { return this.request('GET', '/indent/approved'); }
  static getMaterialAvailability(materialId) { return this.request('GET', `/indent/inventory/material/${materialId}`); }
  static submitIndent(id) { return this.request('PUT', `/indent/${id}/submit`); }
  static getIndentsPending() { return this.request('GET', '/indent/approval/pending'); }
  static approveIndent(id, approved, comments) { return this.request('PUT', `/indent/${id}/approve`, { approved, comments }); }
  static rejectIndent(id, comments) { return this.request('PUT', `/indent/${id}/reject`, { comments }); }
  static submitQuotation(indentId, data) { return this.request('POST', `/indent/${indentId}/quotation`, data); }
  static getIndentQuotations(indentId) { return this.request('GET', `/indent/${indentId}/quotations`); }
  static evaluateRates(indentId, rates) { return this.request('POST', `/indent/${indentId}/evaluate-rates`, rates); }
  static generatePO(indentId, data) { return this.request('POST', `/indent/${indentId}/generate-po`, data); }
}

// Shared by every "Export" button across the app (Vendors, Materials,
// Inventory, MIS Reports, ...) so there's one correct CSV-escaping
// implementation instead of several slightly-different copies.
// columns: [{ key: 'field_name', label: 'Column Header' }, ...]
// rows: array of plain objects (e.g. straight from an API call)
function exportToCSV(filename, columns, rows) {
  if (!rows || !rows.length) {
    alert('Nothing to export yet.');
    return;
  }
  const escapeCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = columns.map(c => escapeCsv(c.label)).join(',');
  const body = rows.map(row => columns.map(c => escapeCsv(row[c.key])).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
