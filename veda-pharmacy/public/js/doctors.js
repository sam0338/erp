// VEDA Pharmacy - Doctors (referral commission registry)
let currentUser = null;
let doctorsCache = [];

(async function init() {
  currentUser = await initShell({ activeView: 'doctors' });
  if (!currentUser) return;

  document.getElementById('addDoctorBtn').addEventListener('click', () => openModal(null));
  document.getElementById('searchInput').addEventListener('input', debounce(loadDoctors, 250));
  document.getElementById('includeInactive').addEventListener('change', loadDoctors);

  await loadDoctors();
})();

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function loadDoctors() {
  const tbody = document.getElementById('doctorsTbody');
  const q = document.getElementById('searchInput').value.trim();
  const includeInactive = document.getElementById('includeInactive').checked;

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (includeInactive) params.set('include_inactive', '1');

  try {
    doctorsCache = await api.get('/api/doctors?' + params.toString());
    renderTable(doctorsCache);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderTable(doctors) {
  const tbody = document.getElementById('doctorsTbody');
  const emptyState = document.getElementById('doctorsEmpty');
  if (doctors.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  tbody.innerHTML = doctors.map(d => `
    <tr${d.is_active ? '' : ' style="opacity:0.55;"'}>
      <td>
        <strong>${escapeHtml(d.name)}</strong>
        ${d.is_active ? '' : '<span class="badge badge-slate" style="margin-top:4px;">Inactive</span>'}
      </td>
      <td>${escapeHtml(d.phone || '—')}</td>
      <td class="mono">${escapeHtml(d.registration_no || '—')}</td>
      <td>${d.default_commission_pct}%</td>
      <td>${d.referred_sale_count}</td>
      <td>${fmtMoney(d.lifetime_commission_accrued)}</td>
      <td>${d.commission_unpaid > 0 ? `<span class="badge badge-amber">${fmtMoney(d.commission_unpaid)}</span>` : `<span class="badge badge-green">${fmtMoney(0)}</span>`}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" onclick="openHistoryModal(${d.id})">History</button>
        <button class="btn btn-secondary btn-sm" onclick="openModal(${d.id})">Edit</button>
        ${d.is_active ? `<button class="btn btn-danger-outline btn-sm" onclick="handleDelete(${d.id})">Remove</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function openModal(id) {
  const d = id ? doctorsCache.find(x => x.id === id) || {} : {};
  const isEdit = !!id;

  const modalRoot = document.getElementById('modalRoot');
  modalRoot.innerHTML = `
    <div class="modal-overlay" id="doctorModalOverlay">
      <div class="modal">
        <div class="modal-header">
          <h3>${isEdit ? 'Edit Doctor' : 'Add Doctor'}</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="doctorForm">
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-field span-2">
                <label>Doctor Name *</label>
                <input type="text" name="name" required value="${escapeHtml(d.name || '')}" placeholder="e.g. Dr. Anil Verma">
              </div>
              <div class="form-field">
                <label>Phone</label>
                <input type="text" name="phone" value="${escapeHtml(d.phone || '')}">
              </div>
              <div class="form-field">
                <label>Registration No.</label>
                <input type="text" name="registration_no" value="${escapeHtml(d.registration_no || '')}" placeholder="Medical council reg. no.">
              </div>
              <div class="form-field span-2">
                <label>Default Commission %</label>
                <input type="number" name="default_commission_pct" step="0.01" min="0" max="100" value="${d.default_commission_pct !== undefined ? d.default_commission_pct : 0}">
                <div class="form-hint">Applied to the sale total (not deducted from the patient's price) and snapshotted onto each sale — changing this later only affects future sales.</div>
              </div>
              <div class="form-field span-2">
                <label>Notes</label>
                <input type="text" name="notes" value="${escapeHtml(d.notes || '')}">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Doctor'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('doctorModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'doctorModalOverlay') closeModal();
  });
  document.getElementById('doctorForm').addEventListener('submit', (e) => handleSubmit(e, id));
}

async function handleSubmit(e, id) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  data.default_commission_pct = parseFloat(data.default_commission_pct) || 0;

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    if (id) {
      await api.put(`/api/doctors/${id}`, data);
      showToast('Doctor updated');
    } else {
      await api.post('/api/doctors', data);
      showToast('Doctor added');
    }
    closeModal();
    await loadDoctors();
  } catch (err) {
    showToast(err.message, true);
    submitBtn.disabled = false;
  }
}

async function handleDelete(id) {
  const d = doctorsCache.find(x => x.id === id);
  if (!d) return;
  if (!confirm(`Remove "${d.name}" from the doctors registry?`)) return;

  try {
    await api.del(`/api/doctors/${id}`);
    showToast('Doctor removed');
    await loadDoctors();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function openHistoryModal(id) {
  let data;
  try {
    data = await api.get(`/api/doctors/${id}/commissions`);
  } catch (e) {
    showToast(e.message, true);
    return;
  }

  const modalRoot = document.getElementById('modalRoot');
  modalRoot.innerHTML = `
    <div class="modal-overlay" id="historyOverlay">
      <div class="modal" style="max-width:640px;">
        <div class="modal-header">
          <h3>${escapeHtml(data.name)} — Commission History</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-grid" style="margin-bottom:14px;">
            <div><div class="muted" style="font-size:11px;">Lifetime Accrued</div><strong>${fmtMoney(data.unpaid_total + data.paid_total)}</strong></div>
            <div><div class="muted" style="font-size:11px;">Paid Out</div><strong style="color:var(--ok);">${fmtMoney(data.paid_total)}</strong></div>
            <div><div class="muted" style="font-size:11px;">Unpaid</div><strong style="color:${data.unpaid_total > 0 ? 'var(--warn)' : 'var(--ok)'};">${fmtMoney(data.unpaid_total)}</strong></div>
          </div>

          ${data.unpaid_total > 0 ? `
            <form id="payCommissionForm" class="rx-panel" style="background:var(--brand-100);border-color:var(--brand-500);margin-bottom:14px;">
              <div class="rx-title" style="color:var(--brand-700);">Pay Out ${fmtMoney(data.unpaid_total)}</div>
              <div class="form-grid" style="gap:8px;">
                <div class="form-field" style="margin-bottom:8px;">
                  <label>Payment Mode</label>
                  <select name="payment_mode">
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div class="form-field" style="margin-bottom:8px;">
                  <label>Reference No.</label>
                  <input type="text" name="reference_no" placeholder="Optional">
                </div>
              </div>
              <div class="form-field" style="margin-bottom:8px;">
                <label>Notes</label>
                <input type="text" name="notes" placeholder="Optional">
              </div>
              <button type="submit" class="btn btn-primary btn-sm">Settle ${fmtMoney(data.unpaid_total)}</button>
            </form>
          ` : ''}

          <strong style="font-size:12.5px;color:var(--brand-900);">Sales</strong>
          ${data.sales.length === 0 ? '<p class="muted">No sales linked to this doctor yet.</p>' : `
            <table style="width:100%;font-size:12.5px;margin-top:8px;">
              <thead>
                <tr><th style="text-align:left;">Invoice</th><th style="text-align:left;">Patient</th><th>Total</th><th>Rate</th><th>Commission</th><th>Status</th><th>Payout</th></tr>
              </thead>
              <tbody>
                ${data.sales.map(s => `
                  <tr${s.status === 'Cancelled' ? ' style="opacity:0.5;"' : ''}>
                    <td class="mono">${escapeHtml(s.invoice_no)}</td>
                    <td>${escapeHtml(s.patient_name || '—')}</td>
                    <td style="text-align:right;">${fmtMoney(s.total_amount)}</td>
                    <td style="text-align:right;">${s.doctor_commission_pct}%</td>
                    <td style="text-align:right;">${fmtMoney(s.doctor_commission_amount)}</td>
                    <td><span class="badge ${s.status === 'Cancelled' ? 'badge-red' : 'badge-green'}">${escapeHtml(s.status)}</span></td>
                    <td>${s.commission_paid_at ? `<span class="badge badge-green">Paid</span>` : (s.status === 'Completed' && s.doctor_commission_amount > 0 ? `<span class="badge badge-amber">Unpaid</span>` : '—')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}

          ${data.payments.length > 0 ? `
            <div class="divider"></div>
            <strong style="font-size:12.5px;color:var(--brand-900);">Payout History</strong>
            <table style="width:100%;font-size:12.5px;margin-top:8px;">
              <thead>
                <tr><th style="text-align:left;">Date</th><th style="text-align:left;">Mode</th><th style="text-align:left;">Reference</th><th style="text-align:right;">Amount</th></tr>
              </thead>
              <tbody>
                ${data.payments.map(p => `
                  <tr>
                    <td>${fmtDate(p.payment_date)}</td>
                    <td>${escapeHtml(p.payment_mode || '—')}</td>
                    <td class="mono">${escapeHtml(p.reference_no || '—')}</td>
                    <td style="text-align:right;">${fmtMoney(p.amount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="closeModal()">Close</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('historyOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'historyOverlay') closeModal();
  });

  const payForm = document.getElementById('payCommissionForm');
  if (payForm) {
    payForm.addEventListener('submit', (e) => handlePayCommission(e, id));
  }
}

async function handlePayCommission(e, doctorId) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const result = await api.post(`/api/doctors/${doctorId}/pay-commission`, data);
    showToast(`Paid out ${fmtMoney(result.amount)} — ${result.sales_settled} sale(s) settled`);
    await openHistoryModal(doctorId); // refresh the modal in place
    loadDoctors(); // refresh the list's Accrued/Unpaid columns in the background
  } catch (err) {
    showToast(err.message, true);
    submitBtn.disabled = false;
  }
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}
