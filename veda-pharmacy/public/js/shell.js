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

  try {
    const licenseStatus = await api.get('/api/license/status');
    if (licenseStatus.inTrial) {
      const banner = document.getElementById('trialBanner');
      if (banner) {
        banner.className = 'trial-banner';
        banner.style.display = 'flex';
        banner.innerHTML = `Trial: ${licenseStatus.trialDaysRemaining} day${licenseStatus.trialDaysRemaining === 1 ? '' : 's'} remaining. <a href="/license.html">Activate license →</a>`;
      }
    }
  } catch (e) { /* ignore — license check is best-effort here */ }

  return currentUser;
}
