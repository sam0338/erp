// VEDA Pharmacy - POS / Sales
let currentUser = null;
let itemsCache = [];
let doctorsCache = [];
let cart = []; // { item_id, name, unit, schedule, gst_rate, quantity, discount_pct, previewMrp, previewStock, loading }
let historyCache = [];
let currentStore = null; // for the receipt's tagline/footer — see Shop Settings (public/settings.html)

const RX_SCHEDULES = ['H1', 'X'];
const PAYMENT_BADGE = { Paid: 'badge-green', Partial: 'badge-amber', Unpaid: 'badge-red' };
const STATUS_BADGE = { Completed: 'badge-green', Cancelled: 'badge-red', Returned: 'badge-slate' };

(async function init() {
  currentUser = await initShell({ activeView: 'sales' });
  if (!currentUser) return;

  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  const searchInput = document.getElementById('itemSearchInput');
  searchInput.addEventListener('input', debounce(runItemSearch, 150));
  searchInput.addEventListener('focus', runItemSearch);

  const doctorInput = document.getElementById('rxDoctorName');
  doctorInput.addEventListener('input', () => {
    // Any manual edit invalidates a previously-selected doctor — otherwise
    // typing over a selected name while keeping the hidden id would silently
    // attribute commission to the wrong (or a since-edited-away) doctor.
    document.getElementById('rxDoctorId').value = '';
    document.getElementById('doctorCommissionHint').style.display = 'none';
    runDoctorSearch();
  });
  doctorInput.addEventListener('focus', runDoctorSearch);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.item-search-wrap')) {
      document.getElementById('itemSearchResults').style.display = 'none';
      document.getElementById('doctorSearchResults').style.display = 'none';
    }
  });

  document.getElementById('headerDiscount').addEventListener('input', recalcTotals);
  document.getElementById('loyaltyDiscountPct').addEventListener('input', recalcTotals);
  document.getElementById('checkoutBtn').addEventListener('click', handleCheckout);

  document.getElementById('historySearch').addEventListener('input', debounce(loadHistory, 250));
  document.getElementById('historyPaymentFilter').addEventListener('change', loadHistory);

  document.getElementById('checkoutDoctor').addEventListener('change', onCheckoutDoctorChange);

  try {
    itemsCache = await api.get('/api/items');
  } catch (e) {
    showToast(e.message, true);
  }
  try {
    doctorsCache = await api.get('/api/doctors');
  } catch (e) { /* the Walk-in / No Doctor option still renders without this — see populateCheckoutDoctorSelect */ }
  populateCheckoutDoctorSelect();

  try {
    currentStore = await api.get(`/api/stores/${currentUser.storeId}`);
  } catch (e) { /* non-fatal — receipt falls back to its default tagline/footer text */ }

  // Arriving here via the global Retrieve Bill overlay (public/js/shell.js)
  // from some other page — jump straight to that sale's detail.
  const openSaleId = new URLSearchParams(window.location.search).get('openSale');
  if (openSaleId) {
    switchTab('history');
    openHistoryDetail(parseInt(openSaleId, 10));
    history.replaceState(null, '', '/sales.html');
  }
})();

// Every sale tags a doctor now — the select always has a value (it defaults
// to Walk-in / No Doctor), so there's no "forgot to pick one" state; the
// cashier has to actively pick a registered doctor to earn commission, and
// picking is required either way (see validateSaleBody's doctor_id check).
function populateCheckoutDoctorSelect() {
  const select = document.getElementById('checkoutDoctor');
  const options = ['<option value="walkin">Walk-in / No Doctor</option>']
    .concat(doctorsCache.map(d => `<option value="${d.id}">${escapeHtml(d.name)} (${d.default_commission_pct}%)</option>`));
  select.innerHTML = options.join('');
}

function getCheckoutDoctorId() {
  const val = document.getElementById('checkoutDoctor').value;
  return val === 'walkin' ? null : parseInt(val, 10);
}

function onCheckoutDoctorChange() {
  const select = document.getElementById('checkoutDoctor');
  const hint = document.getElementById('checkoutDoctorHint');
  if (select.value === 'walkin') {
    hint.style.display = 'none';
  } else {
    const doctor = doctorsCache.find(d => d.id === parseInt(select.value, 10));
    if (doctor) {
      hint.textContent = `${doctor.default_commission_pct}% commission will accrue on this sale.`;
      hint.style.display = 'block';
    }
  }

  // Convenience prefill only — if the Rx panel's prescribing-doctor field is
  // still empty, default it to the same doctor (most sales, the referrer and
  // the prescriber are the same person). Never overwrites a value the
  // cashier already typed or picked, since the prescriber can legitimately
  // be someone else entirely (see the note in routes/sales.js).
  const rxDoctorName = document.getElementById('rxDoctorName');
  if (select.value !== 'walkin' && !rxDoctorName.value.trim()) {
    const doctor = doctorsCache.find(d => d.id === parseInt(select.value, 10));
    if (doctor) {
      rxDoctorName.value = doctor.name;
      document.getElementById('rxDoctorId').value = doctor.id;
      const rxHint = document.getElementById('doctorCommissionHint');
      rxHint.textContent = `Registered doctor — ${doctor.default_commission_pct}% commission will accrue on this sale.`;
      rxHint.style.display = 'block';
    }
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('newSaleTab').style.display = tab === 'newsale' ? 'block' : 'none';
  document.getElementById('historyTab').style.display = tab === 'history' ? 'block' : 'none';
  if (tab === 'history') loadHistory();
}

// ---------------- Item search / cart ----------------

function runItemSearch() {
  const q = document.getElementById('itemSearchInput').value.trim().toLowerCase();
  const resultsBox = document.getElementById('itemSearchResults');
  if (!q) { resultsBox.style.display = 'none'; return; }

  const matches = itemsCache.filter(i =>
    i.name.toLowerCase().includes(q) ||
    (i.generic_name || '').toLowerCase().includes(q) ||
    (i.hsn_code || '').toLowerCase().includes(q)
  ).slice(0, 8);

  if (matches.length === 0) {
    resultsBox.innerHTML = '<div class="result-row muted">No matching items</div>';
  } else {
    resultsBox.innerHTML = matches.map(i => `
      <div class="result-row" data-id="${i.id}">
        ${escapeHtml(i.name)}
        <span class="stock-hint">${i.total_stock} ${escapeHtml(i.unit)}${RX_SCHEDULES.includes(i.schedule) ? ' · Rx' : ''}</span>
      </div>
    `).join('');
    resultsBox.querySelectorAll('.result-row[data-id]').forEach(row => {
      row.addEventListener('click', () => {
        const item = itemsCache.find(i => i.id === parseInt(row.dataset.id, 10));
        addToCart(item);
        document.getElementById('itemSearchInput').value = '';
        resultsBox.style.display = 'none';
      });
    });
  }
  resultsBox.style.display = 'block';
}

// ---------------- Doctor picker (Rx panel) ----------------
// This is the PRESCRIBING doctor for the legal Rx record — independent of
// the sale-wide "Doctor" select above, which is what actually drives
// commission (see routes/sales.js). They're usually the same person, hence
// the auto-prefill in onCheckoutDoctorChange, but this field can point at
// any doctor (registered here or not) since a pharmacy must be able to
// dispense on any qualified doctor's prescription. Typing a name that
// doesn't match anything in the list is still a valid prescription — the
// text field alone satisfies the H1/X gate.

function runDoctorSearch() {
  const q = document.getElementById('rxDoctorName').value.trim().toLowerCase();
  const resultsBox = document.getElementById('doctorSearchResults');
  if (!q) { resultsBox.style.display = 'none'; return; }

  const matches = doctorsCache.filter(d => d.name.toLowerCase().includes(q)).slice(0, 6);
  if (matches.length === 0) {
    resultsBox.style.display = 'none';
    return;
  }

  resultsBox.innerHTML = matches.map(d => `
    <div class="result-row" data-id="${d.id}">
      ${escapeHtml(d.name)}
      <span class="stock-hint">${d.default_commission_pct}% commission</span>
    </div>
  `).join('');
  resultsBox.querySelectorAll('.result-row[data-id]').forEach(row => {
    row.addEventListener('click', () => {
      const doctor = doctorsCache.find(d => d.id === parseInt(row.dataset.id, 10));
      document.getElementById('rxDoctorName').value = doctor.name; // no 'input' event on programmatic set — id below survives
      document.getElementById('rxDoctorId').value = doctor.id;
      const hint = document.getElementById('doctorCommissionHint');
      hint.textContent = `Matches a registered doctor on file.${doctor.id === getCheckoutDoctorId() ? '' : ' Note: this differs from the Doctor selected above, which is what commission is based on.'}`;
      hint.style.display = 'block';
      resultsBox.style.display = 'none';
    });
  });
  resultsBox.style.display = 'block';
}

async function addToCart(item) {
  const existing = cart.find(l => l.item_id === item.id);
  if (existing) {
    existing.quantity += 1;
    renderCart();
    return;
  }

  const line = {
    item_id: item.id, name: item.name, unit: item.unit, schedule: item.schedule,
    gst_rate: item.gst_rate, quantity: 1, discount_pct: 0,
    previewMrp: null, previewStock: item.total_stock, loading: true
  };
  cart.push(line);
  renderCart();

  try {
    const batches = await api.get(`/api/batches?item_id=${item.id}`);
    line.previewMrp = batches.length > 0 ? batches[0].mrp : null;
  } catch (e) { /* preview is best-effort */ }
  line.loading = false;
  renderCart();
}

function renderCart() {
  const tbody = document.getElementById('cartTbody');
  if (cart.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Search above to add items to the cart.</td></tr>';
    recalcTotals();
    updateRxPanel();
    return;
  }

  tbody.innerHTML = cart.map((line, idx) => {
    const est = estimateLine(line);
    return `
      <tr>
        <td>
          ${escapeHtml(line.name)}
          ${RX_SCHEDULES.includes(line.schedule) ? '<span class="badge badge-amber" style="margin-left:6px;">Rx</span>' : ''}
        </td>
        <td class="muted" style="font-size:12px;">${line.previewStock} ${escapeHtml(line.unit)}</td>
        <td><input type="number" min="1" value="${line.quantity}" data-idx="${idx}" class="cart-qty"></td>
        <td><input type="number" min="0" max="100" value="${line.discount_pct}" data-idx="${idx}" class="cart-disc"></td>
        <td>${line.loading ? '…' : (line.previewMrp === null ? '<span class="muted">no stock</span>' : fmtMoney(est.gross))}</td>
        <td><button type="button" class="rm-btn" data-idx="${idx}" title="Remove">&times;</button></td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.cart-qty').forEach(el => el.addEventListener('input', (e) => {
    cart[parseInt(e.target.dataset.idx, 10)].quantity = parseInt(e.target.value, 10) || 1;
    renderCart();
  }));
  tbody.querySelectorAll('.cart-disc').forEach(el => el.addEventListener('input', (e) => {
    cart[parseInt(e.target.dataset.idx, 10)].discount_pct = parseFloat(e.target.value) || 0;
    renderCart();
  }));
  tbody.querySelectorAll('.rm-btn').forEach(el => el.addEventListener('click', (e) => {
    cart.splice(parseInt(e.target.dataset.idx, 10), 1);
    renderCart();
  }));

  recalcTotals();
  updateRxPanel();
}

// Client-side mirror of routes/sales.js's computeInclusiveChunk — this is
// only a preview using the soonest-expiry batch's MRP; the server is
// authoritative and may split across batches with slightly different MRPs.
function estimateLine(line) {
  if (line.previewMrp === null) return { gross: 0, taxable: 0, cgst: 0, sgst: 0 };
  const unitRate = round2(line.previewMrp * (1 - line.discount_pct / 100));
  const gross = round2(line.quantity * unitRate);
  const tax = round2(gross * line.gst_rate / (100 + line.gst_rate));
  const taxable = round2(gross - tax);
  const cgst = round2(tax / 2);
  const sgst = round2(tax - cgst);
  return { gross, taxable, cgst, sgst };
}

function recalcTotals() {
  let taxable = 0, cgst = 0, sgst = 0, gross = 0;
  cart.forEach(line => {
    const est = estimateLine(line);
    taxable += est.taxable; cgst += est.cgst; sgst += est.sgst; gross += est.gross;
  });
  const discount = parseFloat(document.getElementById('headerDiscount').value) || 0;
  const loyaltyPct = parseFloat(document.getElementById('loyaltyDiscountPct').value) || 0;
  const loyaltyAmount = round2(gross * loyaltyPct / 100);
  const total = Math.round(gross - discount - loyaltyAmount);

  document.getElementById('posTaxable').textContent = fmtMoney(taxable);
  document.getElementById('posCgst').textContent = fmtMoney(cgst);
  document.getElementById('posSgst').textContent = fmtMoney(sgst);
  document.getElementById('posDiscount').textContent = fmtMoney(discount);
  document.getElementById('posLoyalty').textContent = fmtMoney(loyaltyAmount);
  document.getElementById('posGrand').textContent = fmtMoney(total);
}

function updateRxPanel() {
  const needsRx = cart.some(l => RX_SCHEDULES.includes(l.schedule));
  document.getElementById('rxPanel').style.display = needsRx ? 'block' : 'none';
}

async function handleCheckout() {
  if (cart.length === 0) {
    showToast('Cart is empty', true);
    return;
  }

  const patientName = document.getElementById('customerName').value.trim();
  if (!patientName) {
    showToast('Patient name is required', true);
    return;
  }
  // The select always has a value (defaults to walkin), but guard anyway —
  // an empty value here would otherwise fail server-side with a less
  // specific error.
  const doctorId = document.getElementById('checkoutDoctor').value;
  if (!doctorId) {
    showToast('Select a doctor, or choose Walk-in / No Doctor', true);
    return;
  }

  const needsRx = cart.some(l => RX_SCHEDULES.includes(l.schedule));
  let prescription = null;
  if (needsRx) {
    const doctorName = document.getElementById('rxDoctorName').value.trim();
    if (!doctorName) {
      showToast('A prescribing doctor name is required for the prescription item(s) in this cart', true);
      return;
    }
    prescription = {
      patient_age: document.getElementById('rxPatientAge').value || null,
      patient_gender: document.getElementById('rxPatientGender').value || null,
      doctor_name: doctorName,
      doctor_id: document.getElementById('rxDoctorId').value || null,
      doctor_reg_no: document.getElementById('rxDoctorRegNo').value || null,
      rx_ref_no: document.getElementById('rxRefNo').value || null,
      rx_date: document.getElementById('rxDate').value || null
    };
  }

  const payload = {
    customer_name: patientName,
    customer_phone: document.getElementById('customerPhone').value || null,
    doctor_id: doctorId,
    payment_mode: document.getElementById('paymentMode').value,
    discount_amount: document.getElementById('headerDiscount').value || 0,
    patient_incentive_pct: document.getElementById('loyaltyDiscountPct').value || 0,
    prescription,
    items: cart.map(l => ({ item_id: l.item_id, quantity: l.quantity, discount_pct: l.discount_pct }))
  };

  const btn = document.getElementById('checkoutBtn');
  btn.disabled = true;
  try {
    const result = await api.post('/api/sales', payload);
    showToast(`Sale complete — ${result.invoice_no}, ${fmtMoney(result.total_amount)}`);
    const sale = await api.get(`/api/sales/${result.id}`);
    showReceipt(sale);
    resetCart();
  } catch (e) {
    showToast(e.message, true);
  } finally {
    btn.disabled = false;
  }
}

function resetCart() {
  cart = [];
  document.getElementById('customerName').value = '';
  document.getElementById('customerPhone').value = '';
  document.getElementById('checkoutDoctor').value = 'walkin';
  document.getElementById('checkoutDoctorHint').style.display = 'none';
  document.getElementById('headerDiscount').value = '0';
  document.getElementById('loyaltyDiscountPct').value = '0';
  document.getElementById('paymentMode').value = 'Cash';
  ['rxPatientAge', 'rxDoctorName', 'rxDoctorId', 'rxDoctorRegNo', 'rxRefNo', 'rxDate'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('rxPatientGender').value = '';
  document.getElementById('doctorCommissionHint').style.display = 'none';
  renderCart();
}

// ---------------- Receipt ----------------

function showReceipt(sale) {
  const modalRoot = document.getElementById('modalRoot');
  const gst = sale.cgst_amount + sale.sgst_amount;
  modalRoot.innerHTML = `
    <div class="modal-overlay" id="receiptOverlay">
      <div class="modal" style="max-width:460px;">
        <div class="modal-header">
          <h3>Sale Complete</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body" id="receiptPrintArea">
          <div class="a5-bill">
            <div class="bill-header">
              <img src="/img/logo-mark.svg" alt="" width="30" height="30" style="display:block;margin:0 auto 3px;">
              <div class="bill-shop-name">${escapeHtml(currentUser.storeName || 'VEDA Pharmacy')}</div>
              <div class="bill-shop-tag">${escapeHtml((currentStore && currentStore.tagline) || 'Licensed Retail Chemist & Druggist')}</div>
            </div>
            <div class="bill-meta">
              <div class="bill-meta-left">
                <div>Patient: <strong>${escapeHtml(sale.customer_name || '—')}</strong></div>
                ${sale.doctor_name ? `<div>Doctor: ${escapeHtml(sale.doctor_name)}</div>` : ''}
                <div>Payment: ${escapeHtml(sale.payment_mode)}</div>
              </div>
              <div class="bill-meta-right">
                <div class="bill-no">${escapeHtml(sale.invoice_no)}</div>
                <div>${fmtDate(sale.sale_date)}</div>
              </div>
            </div>
            <table>
              <thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead>
              <tbody>
                ${sale.items.map(l => `
                  <tr>
                    <td>${escapeHtml(l.item_name)}${RX_SCHEDULES.includes(l.schedule) ? ' <span class="rx-badge">Rx</span>' : ''}</td>
                    <td>${l.quantity}</td>
                    <td>${fmtMoney(l.line_total)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="bill-totals">
              <div class="totals-box">
                <div class="tot-row"><span>Taxable</span><span>${fmtMoney(sale.taxable_amount)}</span></div>
                <div class="tot-row"><span>CGST + SGST</span><span>${fmtMoney(gst)}</span></div>
                ${sale.discount_amount > 0 ? `<div class="tot-row"><span>Discount</span><span>-${fmtMoney(sale.discount_amount)}</span></div>` : ''}
                ${sale.patient_incentive_amount > 0 ? `<div class="tot-row"><span>Loyalty Discount</span><span>-${fmtMoney(sale.patient_incentive_amount)}</span></div>` : ''}
                <div class="tot-row grand"><span>Total</span><span>${fmtMoney(sale.total_amount)}</span></div>
              </div>
            </div>
            <div class="sig-area">
              <div>Thank you — get well soon.</div>
              <div class="sig-line">Pharmacist</div>
            </div>
            <div class="bill-footer">${escapeHtml((currentStore && currentStore.invoice_footer) || 'Computer-generated invoice · Goods once sold are not returnable except as per prevailing policy')}</div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>
          <button type="button" class="btn btn-primary" onclick="window.print()">Print Receipt</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('receiptOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'receiptOverlay') closeModal();
  });
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}

// ---------------- Sales History ----------------

async function loadHistory() {
  const tbody = document.getElementById('historyTbody');
  const params = new URLSearchParams();
  const q = document.getElementById('historySearch').value.trim();
  const paymentStatus = document.getElementById('historyPaymentFilter').value;
  if (q) params.set('q', q);
  if (paymentStatus) params.set('payment_status', paymentStatus);

  try {
    historyCache = await api.get('/api/sales?' + params.toString());
    renderHistory(historyCache);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderHistory(sales) {
  const tbody = document.getElementById('historyTbody');
  const emptyState = document.getElementById('historyEmpty');
  if (sales.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';
  tbody.innerHTML = sales.map(s => `
    <tr${s.status === 'Cancelled' ? ' style="opacity:0.55;"' : ''}>
      <td class="mono">${escapeHtml(s.invoice_no)}</td>
      <td>${fmtDate(s.sale_date)}</td>
      <td>${escapeHtml(s.customer_name || '—')}</td>
      <td>${s.doctor_name ? escapeHtml(s.doctor_name) : '<span class="muted">Walk-in</span>'}</td>
      <td>${s.item_count}</td>
      <td>${fmtMoney(s.total_amount)}</td>
      <td><span class="badge ${PAYMENT_BADGE[s.payment_status] || 'badge-slate'}">${escapeHtml(s.payment_status)}</span></td>
      <td><span class="badge ${STATUS_BADGE[s.status] || 'badge-slate'}">${escapeHtml(s.status)}</span></td>
      <td><button class="btn btn-secondary btn-sm" onclick="openHistoryDetail(${s.id})">View</button></td>
    </tr>
  `).join('');
}

async function openHistoryDetail(id) {
  let sale;
  try {
    sale = await api.get(`/api/sales/${id}`);
  } catch (e) {
    showToast(e.message, true);
    return;
  }

  // Cancel is a full-sale void; it's blocked server-side once any return
  // exists (partially-restored stock would otherwise get double-restored)
  // — mirror that here so the button doesn't invite a request that's just
  // going to be rejected.
  const canCancel = sale.status === 'Completed' && sale.returns.length === 0 && currentUser.role !== 'Cashier';
  const canReturn = sale.status === 'Completed';

  const modalRoot = document.getElementById('modalRoot');
  modalRoot.innerHTML = `
    <div class="modal-overlay" id="detailOverlay">
      <div class="modal" style="max-width:680px;">
        <div class="modal-header">
          <h3>${escapeHtml(sale.invoice_no)}</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-grid" style="margin-bottom:10px;">
            <div><div class="muted" style="font-size:11px;">Date</div><strong>${fmtDate(sale.sale_date)}</strong></div>
            <div><div class="muted" style="font-size:11px;">Patient</div><strong>${escapeHtml(sale.customer_name || '—')}</strong></div>
            <div><div class="muted" style="font-size:11px;">Doctor</div><strong>${sale.doctor_name ? escapeHtml(sale.doctor_name) : 'Walk-in / No Doctor'}</strong></div>
            <div><div class="muted" style="font-size:11px;">Payment</div><strong>${escapeHtml(sale.payment_mode)}</strong></div>
            <div><div class="muted" style="font-size:11px;">Status</div><span class="badge ${STATUS_BADGE[sale.status] || 'badge-slate'}">${escapeHtml(sale.status)}</span></div>
          </div>

          <table class="line-table" style="width:100%;border-collapse:collapse;">
            <thead><tr><th style="text-align:left;">Item</th><th>Batch</th><th>Qty</th><th>Rate</th><th>GST%</th><th>Line Total</th>${canReturn ? '<th>Return Qty</th>' : ''}</tr></thead>
            <tbody>
              ${sale.items.map(l => {
                const remaining = l.quantity - l.returned_quantity;
                return `
                <tr>
                  <td>
                    ${escapeHtml(l.item_name)}
                    ${l.returned_quantity > 0 ? `<div class="muted" style="font-size:11px;">${l.returned_quantity} of ${l.quantity} returned</div>` : ''}
                  </td>
                  <td class="mono">${escapeHtml(l.batch_no)}</td>
                  <td>${l.quantity} ${escapeHtml(l.unit)}</td>
                  <td>${fmtMoney(l.sale_rate)}</td>
                  <td>${l.gst_rate}%</td>
                  <td>${fmtMoney(l.line_total)}</td>
                  ${canReturn ? `<td>${remaining > 0 ? `<input type="number" min="0" max="${remaining}" value="0" data-sale-item-id="${l.id}" class="return-qty-input" style="width:56px;padding:5px 6px;border:1px solid var(--border);border-radius:5px;">` : '<span class="muted">—</span>'}</td>` : ''}
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>

          ${canReturn ? `
            <div class="form-field" style="margin-top:10px;">
              <label>Return Reason</label>
              <input type="text" id="returnReason" placeholder="Optional">
            </div>
            <button type="button" class="btn btn-outline btn-sm" id="processReturnBtn">Process Return</button>
          ` : ''}

          <div class="grn-totals" style="margin-top:10px;">
            <table>
              <tr><td>Taxable</td><td>${fmtMoney(sale.taxable_amount)}</td></tr>
              <tr><td>CGST</td><td>${fmtMoney(sale.cgst_amount)}</td></tr>
              <tr><td>SGST</td><td>${fmtMoney(sale.sgst_amount)}</td></tr>
              <tr><td>Discount</td><td>-${fmtMoney(sale.discount_amount)}</td></tr>
              ${sale.patient_incentive_amount > 0 ? `<tr><td>Loyalty Discount (${sale.patient_incentive_pct}%)</td><td>-${fmtMoney(sale.patient_incentive_amount)}</td></tr>` : ''}
              <tr class="grand"><td>Total</td><td>${fmtMoney(sale.total_amount)}</td></tr>
            </table>
          </div>

          ${sale.prescription ? `
            <div class="divider"></div>
            <div class="rx-panel" style="background:var(--brand-100);border-color:var(--brand-500);">
              <div class="rx-title" style="color:var(--brand-700);">Prescription</div>
              <div style="font-size:12.5px;line-height:1.7;">
                Patient: <strong>${escapeHtml(sale.prescription.patient_name)}</strong>${sale.prescription.patient_age ? ', ' + sale.prescription.patient_age + 'y' : ''}${sale.prescription.patient_gender ? ' (' + sale.prescription.patient_gender + ')' : ''}<br>
                Doctor: <strong>${escapeHtml(sale.prescription.doctor_name)}</strong>${sale.prescription.doctor_reg_no ? ' (Reg. ' + escapeHtml(sale.prescription.doctor_reg_no) + ')' : ''}<br>
                ${sale.prescription.rx_ref_no ? 'Rx Ref: ' + escapeHtml(sale.prescription.rx_ref_no) + '<br>' : ''}
                ${sale.prescription.rx_date ? 'Rx Date: ' + fmtDate(sale.prescription.rx_date) : ''}
              </div>
            </div>
          ` : ''}

          ${sale.doctor_commission_amount > 0 ? `
            <div class="divider"></div>
            <div class="rx-panel">
              <div class="rx-title">Doctor Commission (internal — not shown on customer receipt)</div>
              <div style="font-size:12.5px;">
                ${escapeHtml(sale.doctor_name || 'Doctor')}: <strong>${sale.doctor_commission_pct}%</strong> of ${fmtMoney(sale.total_amount)} = <strong>${fmtMoney(sale.doctor_commission_amount)}</strong>
              </div>
            </div>
          ` : ''}

          ${sale.returns.length > 0 ? `
            <div class="divider"></div>
            <strong style="font-size:12.5px;color:var(--brand-900);">Returns</strong>
            <table style="width:100%;font-size:12.5px;margin-top:8px;">
              <thead><tr><th style="text-align:left;">Return No.</th><th style="text-align:left;">Date</th><th style="text-align:left;">Items</th><th style="text-align:right;">Refund</th></tr></thead>
              <tbody>
                ${sale.returns.map(r => `
                  <tr>
                    <td class="mono">${escapeHtml(r.return_no)}</td>
                    <td>${fmtDate(r.return_date)}</td>
                    <td>${r.items.map(i => `${escapeHtml(i.item_name)} × ${i.quantity}`).join(', ')}${r.reason ? `<div class="muted" style="font-size:11px;">${escapeHtml(r.reason)}</div>` : ''}</td>
                    <td style="text-align:right;">${fmtMoney(r.refund_amount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="closeModal()">Close</button>
          ${canCancel ? `<button type="button" class="btn btn-danger-outline" id="cancelSaleBtn">Cancel Sale</button>` : ''}
        </div>
      </div>
    </div>
  `;

  document.getElementById('detailOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'detailOverlay') closeModal();
  });
  const cancelBtn = document.getElementById('cancelSaleBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      if (!confirm(`Cancel ${sale.invoice_no}? This restores all stock it drew from.`)) return;
      try {
        await api.put(`/api/sales/${sale.id}/cancel`);
        showToast('Sale cancelled, stock restored');
        closeModal();
        await loadHistory();
      } catch (e) {
        showToast(e.message, true);
      }
    });
  }
  const returnBtn = document.getElementById('processReturnBtn');
  if (returnBtn) {
    returnBtn.addEventListener('click', () => handleProcessReturn(sale.id));
  }
}

async function handleProcessReturn(saleId) {
  const inputs = document.querySelectorAll('.return-qty-input');
  const items = [];
  inputs.forEach(el => {
    const qty = parseInt(el.value, 10) || 0;
    if (qty > 0) items.push({ sale_item_id: parseInt(el.dataset.saleItemId, 10), quantity: qty });
  });

  if (items.length === 0) {
    showToast('Enter a return quantity for at least one line', true);
    return;
  }

  const reason = document.getElementById('returnReason').value || null;
  const btn = document.getElementById('processReturnBtn');
  btn.disabled = true;

  try {
    const result = await api.post(`/api/sales/${saleId}/returns`, { items, reason });
    showToast(`Return processed — ${result.return_no}, refund ${fmtMoney(result.refund_amount)}`);
    await openHistoryDetail(saleId); // refresh the modal in place with updated quantities/status
    loadHistory(); // refresh the underlying list's status badge in the background
  } catch (e) {
    showToast(e.message, true);
    btn.disabled = false;
  }
}
