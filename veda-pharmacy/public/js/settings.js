// VEDA Pharmacy - Shop Settings
// Self-service profile/billing-preference editor for the operator's own
// (current) store — reuses the existing Admin-only PUT /api/stores/:id
// endpoint rather than a parallel settings-specific route, since every
// field here is just another column on the stores table (see the note in
// db/schema.sql). Deliberately does NOT include MediStore Pro's Export/
// Import/Clear-All-Data buttons — those were built for its browser-
// localStorage backend and don't map onto a real relational database;
// a "Clear All Data" button on a live pharmacy's SQL database would be an
// unacceptable footgun, so it was left out rather than ported as-is.

let currentUser = null;
let currentStore = null;

(async function init() {
  currentUser = await initShell({ activeView: 'settings' });
  if (!currentUser) return;

  const gate = document.getElementById('settingsGate');
  const form = document.getElementById('settingsForm');

  if (currentUser.role !== 'Admin') {
    gate.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <h3>Admin access required</h3>
        <p>Shop Settings can only be changed by an Admin. Ask an administrator to update these details.</p>
      </div>
    `;
    return;
  }

  try {
    currentStore = await api.get(`/api/stores/${currentUser.storeId}`);
  } catch (e) {
    gate.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`;
    return;
  }

  gate.style.display = 'none';
  form.style.display = 'block';
  populateForm(currentStore);
  form.addEventListener('submit', handleSubmit);
})();

function populateForm(store) {
  const form = document.getElementById('settingsForm');
  Object.keys(store).forEach(key => {
    const field = form.elements[key];
    if (!field) return;
    field.value = store[key] === null || store[key] === undefined ? '' : store[key];
  });
  if (!form.elements.bill_prefix.value) form.elements.bill_prefix.value = 'INV';
  if (!form.elements.default_gst_rate.value) form.elements.default_gst_rate.value = 12;
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  data.default_gst_rate = parseFloat(data.default_gst_rate) || 0;

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    await api.put(`/api/stores/${currentUser.storeId}`, data);
    showToast('Shop settings saved');
    currentStore = await api.get(`/api/stores/${currentUser.storeId}`);
    populateForm(currentStore);
  } catch (err) {
    showToast(err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
}
