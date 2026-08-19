// VEDA Pharmacy - Item Movement Log
let currentUser = null;

const TYPE_BADGE = { Purchase: 'badge-green', 'Stock In': 'badge-green', Sale: 'badge-slate', Return: 'badge-green', Adjustment: 'badge-red' };

(async function init() {
  currentUser = await initShell({ activeView: 'movements' });
  if (!currentUser) return;

  document.getElementById('searchInput').addEventListener('input', debounce(loadMovements, 250));
  document.getElementById('typeFilter').addEventListener('change', loadMovements);

  await loadMovements();
})();

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function loadMovements() {
  const tbody = document.getElementById('movementsTbody');
  const q = document.getElementById('searchInput').value.trim();
  const type = document.getElementById('typeFilter').value;

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (type) params.set('type', type);

  try {
    const rows = await api.get('/api/movements?' + params.toString());
    renderTable(rows);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderTable(rows) {
  const tbody = document.getElementById('movementsTbody');
  const emptyState = document.getElementById('movementsEmpty');
  if (rows.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${fmtDate(r.date)}</td>
      <td>${escapeHtml(r.item_name)}</td>
      <td><span class="badge ${TYPE_BADGE[r.type] || 'badge-slate'}">${escapeHtml(r.type)}</span></td>
      <td style="color:${r.quantity < 0 ? 'var(--danger, #dc2626)' : 'var(--ok, #16a34a)'};font-weight:600;">${r.quantity > 0 ? '+' : ''}${r.quantity}</td>
      <td class="mono">${escapeHtml(r.reference || '—')}</td>
      <td class="muted" style="font-size:12px;">${escapeHtml(r.note || '—')}</td>
    </tr>
  `).join('');
}
