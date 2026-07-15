const IndentPurchaserPage = {
  render: async () => {
    return `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="fas fa-shopping-cart me-2"></i>RFQ & Rate Comparison</h2>
          <p class="text-muted">Collect vendor quotations and compare rates for approved indents — one RFQ covers every item on the indent.</p>
        </div>
      </div>

      <div class="row">
        <div class="col-md-12">
          <ul class="nav nav-tabs mb-3" id="purchaserTabs">
            <li class="nav-item">
              <button class="nav-link active" id="rfqTab" data-bs-toggle="tab" data-bs-target="#rfq">
                <i class="fas fa-envelope-open-text me-1"></i>RFQ Pending (${0})
              </button>
            </li>
          </ul>

          <div class="tab-content">
            <!-- RFQ Pending Tab -->
            <div class="tab-pane fade show active" id="rfq">
              <div class="card border-0 shadow-sm">
                <div class="card-body">
                  <table class="table table-hover mb-0">
                    <thead class="table-light">
                      <tr>
                        <th>Indent No.</th>
                        <th>Items</th>
                        <th>Department</th>
                        <th>Priority</th>
                        <th>Quotations</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody id="rfqPendingList">
                      <tr><td colspan="6" class="text-center text-muted py-4">Loading approved indents...</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RFQ Modal -->
      <div class="modal fade" id="rfqModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Collect Vendor Quotations — <span id="rfqIndentNo">-</span></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="rfqForm" onsubmit="RFQActions.submitQuotation(event)">
              <div class="modal-body">
                <div class="row mb-3">
                  <div class="col-md-8">
                    <div class="card border-0 bg-light">
                      <div class="card-body">
                        <h6 class="text-muted mb-2">Items on this Indent</h6>
                        <table class="table table-sm mb-0">
                          <thead><tr><th>Material</th><th>Qty</th></tr></thead>
                          <tbody id="rfqIndentItemsList"></tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="card border-0 bg-light">
                      <div class="card-body">
                        <h6 class="text-muted mb-2">Quotations Received</h6>
                        <p><span class="badge bg-primary fs-6" id="rfqCount">0</span></p>
                      </div>
                    </div>
                  </div>
                </div>

                <h6 class="mb-3"><i class="fas fa-file-invoice me-2"></i>Submit Vendor Quotation</h6>

                <div class="row">
                  <div class="col-md-12 mb-3">
                    <label class="form-label">Vendor *</label>
                    <select class="form-control" id="rfqVendor" required>
                      <option value="">Select Vendor</option>
                    </select>
                  </div>
                </div>

                <div class="mb-2"><label class="form-label small">Price each item quoted by this vendor:</label></div>
                <table class="table table-sm mb-3">
                  <thead class="table-light"><tr><th>Material</th><th>Qty</th><th style="width:160px">Unit Price (₹)</th><th style="width:140px">Line Total</th><th>Tech Spec (optional)</th></tr></thead>
                  <tbody id="rfqPriceItemsBody"></tbody>
                </table>
                <div class="text-end fw-bold mb-3">Quotation Total: <span id="rfqQuoteTotal">₹0.00</span></div>

                <div class="row">
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Delivery Days *</label>
                    <input type="number" class="form-control" id="rfqDeliveryDays" min="1" required>
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Payment Terms *</label>
                    <select class="form-control" id="rfqPaymentTerms" required>
                      <option value="">Select</option>
                      <option value="Net 15">Net 15</option>
                      <option value="Net 30">Net 30</option>
                      <option value="Net 45">Net 45</option>
                      <option value="COD">Cash on Delivery</option>
                      <option value="Advance 50%">Advance 50%</option>
                    </select>
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Validity (Days) *</label>
                    <input type="number" class="form-control" id="rfqValidity" value="30" required>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Notes</label>
                  <textarea class="form-control" id="rfqNotes" rows="2" placeholder="Additional remarks or conditions"></textarea>
                </div>

                <hr>

                <h6 class="mb-3"><i class="fas fa-list me-2"></i>Quotations Received So Far</h6>
                <div id="rfqQuotationsList" class="table-responsive mb-3">
                  <table class="table table-sm">
                    <thead class="table-light"><tr><th>Vendor</th><th>Total</th><th>Delivery Days</th><th>Terms</th></tr></thead>
                    <tbody id="rfqQuotationsBody">
                      <tr><td colspan="4" class="text-center text-muted">No quotations yet</td></tr>
                    </tbody>
                  </table>
                </div>

                <div id="rfqComparisonBlock" style="display:none">
                  <hr>
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="mb-0"><i class="fas fa-chart-bar me-2"></i>Item-wise Comparison</h6>
                    <button type="button" class="btn btn-sm btn-success" onclick="RFQActions.openRateEvaluation()">Compare &amp; Select Winning Vendor</button>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="submit" class="btn btn-primary">Submit Quotation</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Rate Evaluation Modal -->
      <div class="modal fade" id="rateEvalModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Rate Comparison &amp; Selection</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="rateEvalForm" onsubmit="RFQActions.submitEvaluation(event)">
              <div class="modal-body">
                <div class="row mb-3">
                  <div class="col-md-12">
                    <h6 class="text-muted mb-3">Item-wise Price Comparison (lowest price per item highlighted)</h6>
                    <div id="quotationComparison"></div>
                  </div>
                </div>

                <hr>

                <div class="row">
                  <div class="col-md-12 mb-3">
                    <label class="form-label"><strong>Select Winning Vendor (for the whole indent) *</strong></label>
                    <select class="form-control" id="selectedVendor" required>
                      <option value="">Choose vendor with best overall value</option>
                    </select>
                    <div class="form-text">One vendor is awarded the whole indent. Splitting different items to different vendors on one indent isn't supported yet — if you need that, say so and it can be added.</div>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Selection Criteria</label>
                  <textarea class="form-control" id="selectionCriteria" rows="2" placeholder="Explain your selection criteria (cost, delivery, quality, etc.)"></textarea>
                </div>

                <div class="mb-3">
                  <label class="form-label">Evaluation Comments</label>
                  <textarea class="form-control" id="evaluationComments" rows="2" placeholder="Any additional evaluation notes"></textarea>
                </div>

                <div class="alert alert-info small">
                  <i class="fas fa-info-circle me-2"></i>
                  <strong>Next Step:</strong> A multi-line PO will be generated automatically for the selected vendor, one line per item on this indent.
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-success">Generate PO</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  init: async () => {
    await RFQActions.loadApprovedIndents();
  }
};

const RFQActions = {
  currentIndent: null,
  currentIndentItems: [],
  approvedIndents: [],
  currentQuotations: [],
  rfqModal: null,
  evalModal: null,

  loadApprovedIndents: async () => {
    const indents = await API.getApprovedIndents();
    if (!Array.isArray(indents)) {
      console.error('Failed to load approved indents:', indents);
      document.getElementById('rfqPendingList').innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Could not load indents. Please try logging in again.</td></tr>';
      return;
    }

    RFQActions.approvedIndents = indents;

    const html = RFQActions.approvedIndents.length > 0
      ? RFQActions.approvedIndents.map(indent => `
          <tr>
            <td><strong>${indent.indent_number}</strong></td>
            <td>${indent.item_count} item${indent.item_count === 1 ? '' : 's'}<div class="text-muted small">${indent.item_summary || ''}</div></td>
            <td>${indent.requested_from_dept || indent.area_of_use || '-'}</td>
            <td><span class="badge bg-${indent.priority === 'Urgent' ? 'danger' : indent.priority === 'High' ? 'warning' : 'info'}">${indent.priority}</span></td>
            <td><span class="badge bg-info" id="quoteCount-${indent.id}">0</span></td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="RFQActions.openRFQ(${indent.id}, '${indent.indent_number}')">Send RFQ</button>
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="6" class="text-center text-muted">No approved indents yet</td></tr>';

    document.getElementById('rfqPendingList').innerHTML = html;
  },

  openRFQ: async (indentId, indentNo) => {
    RFQActions.currentIndent = indentId;
    const indent = await API.getIndent(indentId);
    RFQActions.currentIndentItems = (indent && indent.items) || [];

    document.getElementById('rfqIndentNo').textContent = indentNo;
    document.getElementById('rfqIndentItemsList').innerHTML = RFQActions.currentIndentItems.map(it =>
      `<tr><td>${it.material_name}</td><td>${it.quantity_required} ${it.unit_of_measure || it.material_uom || ''}</td></tr>`
    ).join('');

    // Price entry rows — one per indent item, using insertAdjacentHTML-safe
    // rebuild since this whole block is rebuilt fresh each time the modal
    // opens (not appended to incrementally), so the innerHTML+= pitfall
    // that hit the PO form doesn't apply here.
    document.getElementById('rfqPriceItemsBody').innerHTML = RFQActions.currentIndentItems.map(it => `
      <tr class="rfq-price-item" data-indent-item-id="${it.id}" data-qty="${it.quantity_required}">
        <td>${it.material_name}</td>
        <td>${it.quantity_required} ${it.unit_of_measure || it.material_uom || ''}</td>
        <td><input type="number" class="form-control form-control-sm rfq-unit-price" step="0.01" min="0" required oninput="RFQActions.calculateTotal()"></td>
        <td class="rfq-line-total">₹0.00</td>
        <td><input type="text" class="form-control form-control-sm rfq-tech-spec" placeholder="optional"></td>
      </tr>
    `).join('');
    document.getElementById('rfqQuoteTotal').textContent = '₹0.00';

    const vendors = await API.getVendors();
    const vendorSelect = document.getElementById('rfqVendor');
    vendorSelect.innerHTML = '<option value="">Select Vendor</option>' + (Array.isArray(vendors) ? vendors : []).map(v =>
      `<option value="${v.id}">${v.vendor_name} (${v.vendor_code})</option>`
    ).join('');

    await RFQActions.loadQuotations(indentId);

    RFQActions.rfqModal = new bootstrap.Modal(document.getElementById('rfqModal'));
    RFQActions.rfqModal.show();
  },

  calculateTotal: () => {
    let total = 0;
    document.querySelectorAll('.rfq-price-item').forEach(row => {
      const qty = parseFloat(row.dataset.qty) || 0;
      const price = parseFloat(row.querySelector('.rfq-unit-price').value) || 0;
      const lineTotal = qty * price;
      total += lineTotal;
      row.querySelector('.rfq-line-total').textContent = '₹' + lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    });
    document.getElementById('rfqQuoteTotal').textContent = '₹' + total.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  },

  submitQuotation: async (event) => {
    event.preventDefault();

    const items = [];
    document.querySelectorAll('.rfq-price-item').forEach(row => {
      const unitPrice = row.querySelector('.rfq-unit-price').value;
      if (!unitPrice) return;
      items.push({
        indent_item_id: parseInt(row.dataset.indentItemId),
        unit_price: parseFloat(unitPrice),
        technical_specification: row.querySelector('.rfq-tech-spec').value || null
      });
    });
    if (!items.length) { alert('Enter at least one item price'); return; }
    if (!document.getElementById('rfqVendor').value) { alert('Select a vendor'); return; }

    const data = {
      vendor_id: parseInt(document.getElementById('rfqVendor').value),
      delivery_time_days: parseInt(document.getElementById('rfqDeliveryDays').value),
      payment_terms: document.getElementById('rfqPaymentTerms').value,
      validity_days: parseInt(document.getElementById('rfqValidity').value) || 30,
      notes: document.getElementById('rfqNotes').value,
      items
    };

    const result = await API.submitQuotation(RFQActions.currentIndent, data);
    if (result && !result.error) {
      alert('Quotation submitted successfully');
      document.getElementById('rfqForm').reset();
      document.querySelectorAll('.rfq-unit-price, .rfq-tech-spec').forEach(el => el.value = '');
      await RFQActions.loadQuotations(RFQActions.currentIndent);
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  },

  loadQuotations: async (indentId) => {
    const quotations = await API.getIndentQuotations(indentId);
    RFQActions.currentQuotations = Array.isArray(quotations) ? quotations : [];
    document.getElementById('rfqCount').textContent = RFQActions.currentQuotations.length;
    const listBadge = document.getElementById(`quoteCount-${indentId}`);
    if (listBadge) listBadge.textContent = RFQActions.currentQuotations.length;

    const html = RFQActions.currentQuotations.length > 0
      ? RFQActions.currentQuotations.map(q => `
          <tr>
            <td>${q.vendor_name}</td>
            <td>₹${parseFloat(q.total_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td>${q.delivery_time_days} days</td>
            <td>${q.payment_terms}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="4" class="text-center text-muted">No quotations submitted yet</td></tr>';

    document.getElementById('rfqQuotationsBody').innerHTML = html;
    document.getElementById('rfqComparisonBlock').style.display = RFQActions.currentQuotations.length >= 2 ? 'block' : 'none';
  },

  // Item x vendor grid: rows are the indent's items, columns are each
  // vendor's quotation, cells are that vendor's price for that specific
  // item — the actual "RFQ maintained indent-wise" comparison view.
  openRateEvaluation: () => {
    if (RFQActions.currentQuotations.length < 2) { alert('Need at least 2 quotations to compare'); return; }

    const quotations = RFQActions.currentQuotations;
    const rows = RFQActions.currentIndentItems.map(item => {
      const cells = quotations.map(q => {
        const qi = (q.items || []).find(x => x.indent_item_id === item.id);
        return { quotation_id: q.id, price: qi ? qi.unit_price : null };
      });
      const validPrices = cells.filter(c => c.price !== null).map(c => c.price);
      const lowest = validPrices.length ? Math.min(...validPrices) : null;
      return { item, cells, lowest };
    });

    const comparisonHtml = `
      <div class="table-responsive">
        <table class="table table-bordered">
          <thead class="table-light">
            <tr><th>Item</th>${quotations.map(q => `<th>${q.vendor_name}<div class="small text-muted fw-normal">${q.delivery_time_days || '-'} days · ${q.payment_terms || '-'}</div></th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><strong>${r.item.material_name}</strong><div class="small text-muted">${r.item.quantity_required} ${r.item.unit_of_measure || r.item.material_uom || ''}</div></td>
                ${r.cells.map(c => `<td class="${c.price !== null && c.price === r.lowest ? 'table-success' : ''}">${c.price !== null ? '₹' + parseFloat(c.price).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '<span class="text-muted">not quoted</span>'}</td>`).join('')}
              </tr>
            `).join('')}
            <tr class="table-light fw-bold">
              <td>Quotation Total</td>
              ${quotations.map(q => `<td>₹${parseFloat(q.total_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      </div>
    `;
    document.getElementById('quotationComparison').innerHTML = comparisonHtml;

    const vendorSelect = document.getElementById('selectedVendor');
    vendorSelect.innerHTML = '<option value="">Choose vendor with best overall value</option>' + quotations.map(q =>
      `<option value="${q.vendor_id}|${q.id}">${q.vendor_name} — Total ₹${parseFloat(q.total_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${q.delivery_time_days} days)</option>`
    ).join('');

    RFQActions.evalModal = new bootstrap.Modal(document.getElementById('rateEvalModal'));
    RFQActions.evalModal.show();
  },

  submitEvaluation: async (event) => {
    event.preventDefault();

    const selectedValue = document.getElementById('selectedVendor').value.split('|');
    const selectedVendorId = parseInt(selectedValue[0]);
    const selectedQuotationId = parseInt(selectedValue[1]);
    if (!selectedVendorId || !selectedQuotationId) { alert('Select a winning vendor'); return; }

    const data = {
      vendor_id_1: RFQActions.currentQuotations[0]?.vendor_id,
      vendor_id_2: RFQActions.currentQuotations[1]?.vendor_id,
      vendor_id_3: RFQActions.currentQuotations[2]?.vendor_id,
      quotation_id_1: RFQActions.currentQuotations[0]?.id,
      quotation_id_2: RFQActions.currentQuotations[1]?.id,
      quotation_id_3: RFQActions.currentQuotations[2]?.id,
      selected_vendor_id: selectedVendorId,
      selected_quotation_id: selectedQuotationId,
      selection_criteria: document.getElementById('selectionCriteria').value,
      evaluation_comments: document.getElementById('evaluationComments').value
    };

    const result = await API.evaluateRates(RFQActions.currentIndent, data);
    if (result && !result.error) {
      alert('Rate evaluation completed! Generating PO...');

      const poResult = await API.generatePO(RFQActions.currentIndent, { vendor_id: selectedVendorId, evaluation_id: result.id });
      if (poResult && !poResult.error) {
        alert(`PO generated: ${poResult.po_number} (one line per item, priced from ${document.getElementById('selectedVendor').selectedOptions[0].textContent})`);
        RFQActions.evalModal.hide();
        RFQActions.rfqModal.hide();
        await RFQActions.loadApprovedIndents();
      } else {
        alert('Rate evaluation was saved, but PO generation failed: ' + ((poResult && poResult.error) || 'Unknown error'));
      }
    } else {
      alert('Error: ' + ((result && result.error) || 'Something went wrong'));
    }
  }
};
