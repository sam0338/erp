// VEDA Pharmacy - Shared app shell (sidebar user chip, logout, trial banner)
//
// Unlike the single-page app.js in veda-hotel-pms, each module here gets its
// own static HTML page (dashboard.html, items.html, ...) that all share this
// one shell script. Call initShell({ activeView: '<data-href value>' }) at
// the top of a page's inline script; it resolves with the logged-in user
// once /api/auth/me succeeds (or redirects to /login.html and never
// resolves if the session is invalid — api.js handles that redirect).
async function initShell(opts) {
  opts = opts || {};
  let currentUser;
  try {
    currentUser = await api.get('/api/auth/me');
  } catch (e) {
    return null; // api.js already redirected to /login.html
  }

  document.getElementById('userName').textContent = currentUser.fullName || currentUser.username;
  document.getElementById('userRole').textContent = currentUser.role || '';

  const storeTag = document.getElementById('storeTag');
  if (storeTag) {
    storeTag.textContent = currentUser.storeName || (currentUser.storeId ? ('Store #' + currentUser.storeId) : 'VEDA Pharmacy');
  }

  // Only Admin gets to see every store and switch between them — every
  // other role stays pinned to the store on their user record (the backend
  // enforces this independently on POST /api/stores/switch; this is just
  // what decides whether the picker/nav link render at all).
  if (currentUser.role === 'Admin') {
    const adminNavGroup = document.getElementById('adminNavGroup');
    if (adminNavGroup) adminNavGroup.style.display = '';

    if (storeTag) {
      try {
        const stores = await api.get('/api/stores');
        if (stores.length > 1) {
          const select = document.createElement('select');
          select.id = 'storeSwitcher';
          select.style.cssText = 'width:100%;padding:6px 8px;border-radius:6px;border:1px solid rgba(234,243,236,0.2);background:rgba(234,243,236,0.08);color:#EAF3EC;font-size:12px;';
          select.innerHTML = stores.map(s => `<option value="${s.id}" ${s.id === currentUser.storeId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
          select.addEventListener('change', async () => {
            try {
              await api.post('/api/stores/switch', { store_id: parseInt(select.value, 10) });
              window.location.reload();
            } catch (e) {
              showToast(e.message, true);
            }
          });
          storeTag.innerHTML = '';
          storeTag.appendChild(select);
        }
      } catch (e) { /* switcher is best-effort — plain store name still shows if this fails */ }
    }
  }

  document.querySelectorAll('.nav-item[data-href]').forEach(item => {
    if (item.dataset.href === opts.activeView) item.classList.add('active');
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await api.post('/api/auth/logout');
      window.location.href = '/login.html';
    });
  }

  injectTopbarActions();

  try {
    const licenseStatus = await api.get('/api/license/status');
    if (licenseStatus.inTrial) {
      const banner = document.getElementById('trialBanner');
      if (banner) {
        banner.className = 'trial-banner';
        banner.style.display = 'flex';
        banner.innerHTML = `Trial: ${licenseStatus.trialDaysRemaining} day${licenseStatus.trialDaysRemaining === 1 ? '' : 's'} remaining. <a href="/license.html">Activate license →</a>`;
        // #sidebar is position:fixed (MediPro's layout, not a document-flow
        // grid), so it needs an explicit push-down to clear the banner —
        // measured rather than hardcoded, since the banner can wrap to two
        // lines on a narrow window. See the body.has-trial-banner rule and
        // --trial-banner-height custom property in style.css.
        document.body.classList.add('has-trial-banner');
        document.documentElement.style.setProperty('--trial-banner-height', banner.offsetHeight + 'px');
      }
    }
  } catch (e) { /* ignore — license check is best-effort here */ }

  return currentUser;
}

// MediStore Pro's topbar carries a live date plus two global shortcuts on
// every page: 🔍 Retrieve Bill (search past invoices without leaving
// wherever you are) and ➕ New Bill (jump straight into a fresh sale). Both
// are injected here rather than duplicated into all 10 page templates.
function injectTopbarActions() {
  const topbarDate = document.getElementById('topbarDate');
  if (topbarDate) {
    topbarDate.textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  const topbarRight = document.querySelector('.topbar-right');
  if (!topbarRight || document.getElementById('retrieveBillBtn')) return;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:8px;align-items:center;';
  wrap.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="retrieveBillBtn">🔍 Retrieve Bill</button>
    <button class="btn btn-primary btn-sm" id="newBillBtn">➕ New Bill</button>
  `;
  topbarRight.insertBefore(wrap, topbarRight.firstChild);

  document.getElementById('retrieveBillBtn').addEventListener('click', openRetrieveBillModal);
  document.getElementById('newBillBtn').addEventListener('click', () => {
    // Already on the POS page — reset in place rather than a full reload,
    // same as clicking through would feel like in MediPro. Everywhere else,
    // just navigate there; sales.js starts on a clean cart by default.
    if (window.location.pathname === '/sales.html' && typeof resetCart === 'function' && typeof switchTab === 'function') {
      switchTab('newsale');
      resetCart();
    } else {
      window.location.href = '/sales.html';
    }
  });
}

// Global "Retrieve Bill" — searches /api/sales (the same endpoint the POS
// page's own Sales History tab uses) by invoice/customer/phone, with a
// date range and payment-status filter, plus a stats strip. This is a
// quick-access overlay usable from any page; the POS page's own History
// tab remains the full browsing view.
async function openRetrieveBillModal() {
  const modalRoot = document.getElementById('modalRoot');
  if (!modalRoot) { window.location.href = '/sales.html'; return; }

  modalRoot.innerHTML = `
    <div class="modal-overlay" id="retrieveBillOverlay">
      <div class="modal" style="max-width:820px;">
        <div class="modal-header">
          <h3>🔍 Retrieve Bill</h3>
          <button class="modal-close" onclick="closeRetrieveBillModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="filter-row" style="margin-bottom:12px;">
            <div class="search-wrap" style="flex:1;min-width:220px;">
              <span class="search-icon">🔍</span>
              <input type="text" id="rbSearch" placeholder="Invoice no, customer name or phone…">
            </div>
            <input type="date" id="rbFrom" style="max-width:150px;">
            <input type="date" id="rbTo" style="max-width:150px;">
            <select id="rbPaymentStatus" style="max-width:140px;">
              <option value="">All Payments</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Unpaid">Unpaid</option>
            </select>
          </div>
          <div class="stats-row" id="rbStats" style="display:flex;gap:12px;margin-bottom:12px;font-size:12.5px;color:var(--slate);"></div>
          <div class="table-wrap" style="max-height:420px;overflow-y:auto;">
            <table>
              <thead>
                <tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Amount</th><th>Payment</th><th></th></tr>
              </thead>
              <tbody id="rbTbody"><tr><td colspan="6" class="empty-state">Searching…</td></tr></tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="closeRetrieveBillModal()">Close</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('retrieveBillOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'retrieveBillOverlay') closeRetrieveBillModal();
  });

  let t;
  const debounced = () => { clearTimeout(t); t = setTimeout(runRetrieveBillSearch, 250); };
  document.getElementById('rbSearch').addEventListener('input', debounced);
  document.getElementById('rbFrom').addEventListener('change', runRetrieveBillSearch);
  document.getElementById('rbTo').addEventListener('change', runRetrieveBillSearch);
  document.getElementById('rbPaymentStatus').addEventListener('change', runRetrieveBillSearch);

  await runRetrieveBillSearch();
}

async function runRetrieveBillSearch() {
  const tbody = document.getElementById('rbTbody');
  if (!tbody) return; // modal was closed mid-request

  const params = new URLSearchParams();
  const q = document.getElementById('rbSearch').value.trim();
  const from = document.getElementById('rbFrom').value;
  const to = document.getElementById('rbTo').value;
  const paymentStatus = document.getElementById('rbPaymentStatus').value;
  if (q) params.set('q', q);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (paymentStatus) params.set('payment_status', paymentStatus);

  try {
    const sales = await api.get('/api/sales?' + params.toString());
    const statsEl = document.getElementById('rbStats');
    if (statsEl) {
      const total = sales.reduce((s, x) => s + x.total_amount, 0);
      statsEl.innerHTML = `<span><strong>${sales.length}</strong> bill${sales.length === 1 ? '' : 's'}</span><span><strong>${fmtMoney(total)}</strong> total</span>`;
    }
    if (!document.getElementById('rbTbody')) return;
    if (sales.length === 0) {
      document.getElementById('rbTbody').innerHTML = '<tr><td colspan="6" class="empty-state">No bills match your search.</td></tr>';
      return;
    }
    document.getElementById('rbTbody').innerHTML = sales.slice(0, 100).map(s => `
      <tr>
        <td class="mono">${escapeHtml(s.invoice_no)}</td>
        <td>${fmtDate(s.sale_date)}</td>
        <td>${escapeHtml(s.customer_name || 'Walk-in')}</td>
        <td>${fmtMoney(s.total_amount)}</td>
        <td><span class="badge ${s.payment_status === 'Paid' ? 'badge-green' : s.payment_status === 'Partial' ? 'badge-amber' : 'badge-red'}">${escapeHtml(s.payment_status)}</span></td>
        <td><button class="btn btn-secondary btn-sm" onclick="viewRetrievedBill(${s.id})">View</button></td>
      </tr>
    `).join('');
  } catch (e) {
    if (document.getElementById('rbTbody')) {
      document.getElementById('rbTbody').innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(e.message)}</td></tr>`;
    }
  }
}

function viewRetrievedBill(id) {
  closeRetrieveBillModal();
  if (window.location.pathname === '/sales.html' && typeof switchTab === 'function' && typeof openHistoryDetail === 'function') {
    switchTab('history');
    openHistoryDetail(id);
  } else {
    window.location.href = '/sales.html?openSale=' + id;
  }
}

function closeRetrieveBillModal() {
  const modalRoot = document.getElementById('modalRoot');
  if (modalRoot) modalRoot.innerHTML = '';
}
