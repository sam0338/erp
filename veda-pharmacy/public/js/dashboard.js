// VEDA Pharmacy - Dashboard
let currentUser = null;

const EXPIRY_BADGE = { expired: 'badge-danger', near: 'badge-warn' };

(async function init() {
  currentUser = await initShell({ activeView: 'dashboard' });
  if (!currentUser) return;

  const today = new Date().toISOString().slice(0, 10);

  const [todaySales, monthRegister, lowStock, expiry] = await Promise.allSettled([
    api.get(`/api/sales?from=${today}&to=${today}`),
    api.get('/api/reports/sales-register'), // defaults to this month
    api.get('/api/reports/low-stock'),
    api.get('/api/reports/expiry?days=90')
  ]);

  renderTodaySales(todaySales);
  renderMonthRevenue(monthRegister);
  renderLowStock(lowStock);
  renderExpiry(expiry);
  renderAlerts(lowStock, expiry);
  maybeShowExpiryPopup(expiry);
})();

function settled(result, fallback) {
  return result.status === 'fulfilled' ? result.value : fallback;
}

// ---------------- Stat cards ----------------

function renderTodaySales(result) {
  const sales = settled(result, null);
  if (!sales) {
    document.getElementById('statTodaySales').textContent = '—';
    document.getElementById('statTodaySalesHint').textContent = 'Could not load';
    return;
  }
  const valid = sales.filter(s => s.status !== 'Cancelled');
  const total = valid.reduce((sum, s) => sum + s.total_amount, 0);
  document.getElementById('statTodaySales').textContent = fmtMoney(total);
  document.getElementById('statTodaySalesHint').textContent = `${valid.length} bill${valid.length === 1 ? '' : 's'} today`;
}

function renderMonthRevenue(result) {
  const data = settled(result, null);
  if (!data) {
    document.getElementById('statMonthRevenue').textContent = '—';
    document.getElementById('statMonthRevenueHint').textContent = 'Could not load';
    return;
  }
  const billCount = data.completed_count + data.returned_count;
  document.getElementById('statMonthRevenue').textContent = fmtMoney(data.totals.net_total_amount);
  document.getElementById('statMonthRevenueHint').textContent = `${billCount} bill${billCount === 1 ? '' : 's'}, net of returns`;
}

function renderLowStock(result) {
  const data = settled(result, null);
  const items = data ? data.items : [];
  document.getElementById('statLowStock').textContent = data ? items.length : '—';

  const tbody = document.getElementById('dashLowStockTbody');
  if (!data) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Could not load low stock.</td></tr>';
    return;
  }
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">✅ Everything is above its reorder level.</td></tr>';
    return;
  }
  tbody.innerHTML = items.slice(0, 8).map(i => `
    <tr>
      <td>${escapeHtml(i.name)}</td>
      <td><span class="badge badge-danger">${i.total_stock} ${escapeHtml(i.unit)}</span></td>
      <td class="muted">${i.reorder_level} ${escapeHtml(i.unit)}</td>
    </tr>
  `).join('');
}

function renderExpiry(result) {
  const data = settled(result, null);
  const batches = data ? data.batches : [];
  const count = data ? batches.length : 0;
  document.getElementById('statExpiring').textContent = data ? count : '—';
  const expiredCount = data ? batches.filter(b => b.expiry_status === 'expired').length : 0;
  document.getElementById('statExpiringHint').textContent = data
    ? (expiredCount > 0 ? `${expiredCount} already expired` : 'Within 90 days')
    : 'Could not load';

  const tbody = document.getElementById('dashExpiryTbody');
  if (!data) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Could not load expiry data.</td></tr>';
    return;
  }
  if (batches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">✅ Nothing expiring in the next 90 days.</td></tr>';
    return;
  }
  tbody.innerHTML = batches.slice(0, 8).map(b => `
    <tr class="expiry-row ${b.expiry_status}">
      <td>${escapeHtml(b.item_name)}</td>
      <td class="mono">${escapeHtml(b.batch_no)}</td>
      <td>${fmtDate(b.expiry_date)}</td>
      <td><span class="badge ${EXPIRY_BADGE[b.expiry_status]}">${b.expiry_status === 'expired' ? 'Expired' : 'Near expiry'}</span></td>
      <td>${b.quantity} ${escapeHtml(b.unit)}</td>
    </tr>
  `).join('');
}

// ---------------- Persistent notification banner ----------------
// Unlike the popup below (which shows once per login), this stays visible
// on every dashboard visit for as long as there's something to flag — the
// "notification" half of the ask, distinct from the one-time "popup" half.

function renderAlerts(lowStockResult, expiryResult) {
  const lowStock = settled(lowStockResult, null);
  const expiry = settled(expiryResult, null);
  const box = document.getElementById('dashAlerts');
  const banners = [];

  if (expiry) {
    const expired = expiry.batches.filter(b => b.expiry_status === 'expired');
    const near = expiry.batches.filter(b => b.expiry_status === 'near');
    if (expired.length > 0) {
      banners.push(`<div class="alert-banner danger">🚫 <strong>${expired.length} batch(es)</strong> have already expired and are still in stock — remove from sale immediately. <a href="/reports.html?tab=expiry">Review →</a></div>`);
    }
    if (near.length > 0) {
      banners.push(`<div class="alert-banner warn">⏰ <strong>${near.length} batch(es)</strong> expiring within 90 days. <a href="/reports.html?tab=expiry">Review →</a></div>`);
    }
  }
  if (lowStock && lowStock.items.length > 0) {
    banners.push(`<div class="alert-banner warn">📦 <strong>${lowStock.items.length} item(s)</strong> at or below their reorder level. <a href="/reports.html?tab=lowstock">Review →</a></div>`);
  }

  box.innerHTML = banners.length > 0 ? banners.join('') : '';
}

// ---------------- Once-per-login expiry popup ----------------
// login.html sets sessionStorage.vedaJustLoggedIn right before redirecting
// here. We consume (and clear) that flag so the popup fires exactly once
// per fresh login, not on every sidebar click back to the dashboard.

function maybeShowExpiryPopup(expiryResult) {
  const justLoggedIn = sessionStorage.getItem('vedaJustLoggedIn') === '1';
  sessionStorage.removeItem('vedaJustLoggedIn');
  if (!justLoggedIn) return;

  const data = settled(expiryResult, null);
  if (!data || data.batches.length === 0) return;

  const expired = data.batches.filter(b => b.expiry_status === 'expired').length;
  const near = data.batches.length - expired;

  const modalRoot = document.getElementById('modalRoot');
  modalRoot.innerHTML = `
    <div class="modal-overlay" id="expiryPopupOverlay">
      <div class="modal">
        <div class="modal-header">
          <h3>⏰ Expiry Watch</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <p class="muted" style="margin-bottom:12px;font-size:13px;">
            ${expired > 0 ? `<strong style="color:var(--danger);">${expired} batch(es) already expired.</strong> ` : ''}${near > 0 ? `${near} batch(es) expiring within 90 days.` : ''}
          </p>
          <div style="overflow-x:auto;">
            <table>
              <thead><tr><th>Item</th><th>Batch</th><th>Expiry</th><th>Qty</th></tr></thead>
              <tbody>
                ${data.batches.slice(0, 10).map(b => `
                  <tr class="expiry-row ${b.expiry_status}">
                    <td>${escapeHtml(b.item_name)}</td>
                    <td class="mono">${escapeHtml(b.batch_no)}</td>
                    <td>${fmtDate(b.expiry_date)}</td>
                    <td>${b.quantity} ${escapeHtml(b.unit)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${data.batches.length > 10 ? `<div class="muted" style="font-size:11.5px;margin-top:8px;">+ ${data.batches.length - 10} more — see the full report.</div>` : ''}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="closeModal()">Dismiss</button>
          <a class="btn btn-primary" href="/reports.html?tab=expiry">View Full Report</a>
        </div>
      </div>
    </div>
  `;
  document.getElementById('expiryPopupOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'expiryPopupOverlay') closeModal();
  });
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}
