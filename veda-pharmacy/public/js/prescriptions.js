// VEDA Pharmacy - Prescriptions Register
let currentUser = null;
let prescriptionsCache = [];

(async function init() {
  currentUser = await initShell({ activeView: 'prescriptions' });
  if (!currentUser) return;

  document.getElementById('searchInput').addEventListener('input', debounce(loadPrescriptions, 250));
  document.getElementById('fromDate').addEventListener('change', loadPrescriptions);
  document.getElementById('toDate').addEventListener('change', loadPrescriptions);

  await loadPrescriptions();
})();

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function loadPrescriptions() {
  const tbody = document.getElementById('prescriptionsTbody');
  const params = new URLSearchParams();
  const q = document.getElementById('searchInput').value.trim();
  const from = document.getElementById('fromDate').value;
  const to = document.getElementById('toDate').value;
  if (q) params.set('q', q);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  try {
    prescriptionsCache = await api.get('/api/prescriptions?' + params.toString());
    renderTable(prescriptionsCache);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderTable(rows) {
  const tbody = document.getElementById('prescriptionsTbody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No prescriptions recorded yet — they\'re captured automatically whenever a Schedule H1/X sale is rung up at POS.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(p => `
    <tr>
      <td>${fmtDate(p.created_at)}</td>
      <td><strong>${escapeHtml(p.patient_name)}</strong>${p.patient_age ? ' · ' + p.patient_age + 'y' : ''}${p.patient_gender ? ' (' + escapeHtml(p.patient_gender) + ')' : ''}</td>
      <td>${escapeHtml(p.doctor_name)}</td>
      <td class="mono">${escapeHtml(p.rx_ref_no || '—')}</td>
      <td class="mono">${escapeHtml(p.invoice_no)}</td>
      <td>${p.image_path ? '<span class="badge badge-ok">On file</span>' : '<span class="badge badge-neutral">None</span>'}</td>
      <td><button class="btn btn-outline btn-sm" onclick="openDetailModal(${p.id})">View</button></td>
    </tr>
  `).join('');
}

async function openDetailModal(id) {
  let p;
  try {
    p = await api.get(`/api/prescriptions/${id}`);
  } catch (e) {
    showToast(e.message, true);
    return;
  }

  const photoSrc = p.image_path ? `/api/prescriptions/${id}/photo?t=${Date.now()}` : null;

  const modalRoot = document.getElementById('modalRoot');
  modalRoot.innerHTML = `
    <div class="modal-overlay" id="rxDetailOverlay">
      <div class="modal" style="max-width:620px;">
        <div class="modal-header">
          <h3>Prescription — ${escapeHtml(p.patient_name)}</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-grid" style="margin-bottom:14px;">
            <div><div class="muted" style="font-size:11px;">Patient</div><strong>${escapeHtml(p.patient_name)}</strong>${p.patient_age ? ', ' + p.patient_age + 'y' : ''}${p.patient_gender ? ' (' + escapeHtml(p.patient_gender) + ')' : ''}</div>
            <div><div class="muted" style="font-size:11px;">Doctor</div><strong>${escapeHtml(p.doctor_name)}</strong>${p.doctor_reg_no ? '<div class="muted" style="font-size:11.5px;">Reg. ' + escapeHtml(p.doctor_reg_no) + '</div>' : ''}</div>
            <div><div class="muted" style="font-size:11px;">Rx Ref No.</div><strong>${escapeHtml(p.rx_ref_no || '—')}</strong></div>
            <div><div class="muted" style="font-size:11px;">Rx Date</div><strong>${p.rx_date ? fmtDate(p.rx_date) : '—'}</strong></div>
            <div><div class="muted" style="font-size:11px;">Sale Invoice</div><strong class="mono">${escapeHtml(p.sale.invoice_no)}</strong></div>
            <div><div class="muted" style="font-size:11px;">Sale Date</div><strong>${fmtDate(p.sale.sale_date)}</strong></div>
          </div>

          ${p.notes ? `<p class="muted" style="font-size:12.5px;margin-bottom:14px;">${escapeHtml(p.notes)}</p>` : ''}

          <div class="divider"></div>

          <strong style="font-size:12.5px;color:var(--brand-900);">Schedule H1/X items dispensed</strong>
          <table style="width:100%;font-size:12.5px;margin:8px 0 14px;">
            ${p.items.map(l => `
              <tr>
                <td>${escapeHtml(l.item_name)}</td>
                <td class="muted">${escapeHtml(l.schedule)}</td>
                <td style="text-align:right;">${l.quantity} ${escapeHtml(l.unit)}</td>
              </tr>
            `).join('')}
          </table>

          <div class="divider"></div>

          <strong style="font-size:12.5px;color:var(--brand-900);display:block;margin-bottom:8px;">Rx photo</strong>
          <div class="rx-photo-box${photoSrc ? '' : ' empty'}" id="rxPhotoBox">
            ${photoSrc ? `<img src="${photoSrc}" alt="Prescription photo">` : 'No photo on file'}
          </div>
          <form id="rxPhotoForm" style="display:flex;gap:8px;align-items:center;">
            <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required style="flex:1;font-size:12.5px;">
            <button type="submit" class="btn btn-outline btn-sm">${photoSrc ? 'Replace' : 'Upload'}</button>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="closeModal()">Close</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('rxDetailOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'rxDetailOverlay') closeModal();
  });
  document.getElementById('rxPhotoForm').addEventListener('submit', (e) => handlePhotoUpload(e, id));
}

async function handlePhotoUpload(e, id) {
  e.preventDefault();
  const form = e.target;
  const fileInput = form.querySelector('input[type="file"]');
  if (!fileInput.files[0]) {
    showToast('Choose a photo first', true);
    return;
  }

  const formData = new FormData();
  formData.append('photo', fileInput.files[0]);

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const res = await fetch(`/api/prescriptions/${id}/photo`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    showToast('Photo saved');
    const box = document.getElementById('rxPhotoBox');
    box.classList.remove('empty');
    box.innerHTML = `<img src="/api/prescriptions/${id}/photo?t=${Date.now()}" alt="Prescription photo">`;
    form.querySelector('button[type="submit"]').textContent = 'Replace';
    await loadPrescriptions();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}
