// VEDA Hotel PMS - Main App Logic
let currentUser = null;
let currentView = 'dashboard';
let roomTypesCache = [];
let propertyCache = null;
let settingsRoomTypesCache = [];
let settingsRoomsCache = [];

const STATUS_LABELS = {
  vacant_clean: 'Vacant · Clean',
  vacant_dirty: 'Vacant · Dirty',
  occupied_clean: 'Occupied',
  occupied_dirty: 'Occupied · Dirty',
  out_of_order: 'Out of Order',
  out_of_service: 'Out of Service'
};

const RES_STATUS_BADGE = {
  confirmed: 'badge-info',
  checked_in: 'badge-ok',
  checked_out: 'badge-neutral',
  cancelled: 'badge-danger',
  no_show: 'badge-danger'
};

const NAV_PERMISSIONS = {
  dashboard: ['Admin', 'Manager', 'FrontOffice', 'Housekeeping', 'Accounts'],
  rooms: ['Admin', 'Manager', 'FrontOffice', 'Housekeeping'],
  reservations: ['Admin', 'Manager', 'FrontOffice', 'Accounts'],
  guests: ['Admin', 'Manager', 'FrontOffice', 'Accounts'],
  requests: ['Admin', 'Manager', 'FrontOffice', 'Housekeeping'],
  cashclosing: ['Admin', 'Manager', 'Accounts'],
  analytics: ['Admin', 'Manager', 'Accounts']
};

// ---------------- Init ----------------
(async function init() {
  try {
    currentUser = await api.get('/api/auth/me');
  } catch (e) {
    return; // redirected to login by api.js
  }
  document.getElementById('userName').textContent = currentUser.fullName || currentUser.username;
  document.getElementById('userRole').textContent = currentUser.role || '';
  document.getElementById('propertyTag').textContent = 'Property #' + currentUser.propertyId;

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.view));
  });

  // Hide nav items this role isn't permitted to use (Admin sees everything)
  if (currentUser.role !== 'Admin') {
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      const allowed = NAV_PERMISSIONS[item.dataset.view];
      if (allowed && !allowed.includes(currentUser.role)) {
        item.style.display = 'none';
      }
    });
  }

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api.post('/api/auth/logout');
    window.location.href = '/login.html';
  });

  try {
    roomTypesCache = await api.get('/api/rooms/types');
  } catch (e) { /* ignore */ }

  try {
    window.__addonsCache = await api.get('/api/revenue/addons');
  } catch (e) { window.__addonsCache = []; }

  try {
    propertyCache = await api.get('/api/property');
    document.getElementById('propertyTag').textContent = propertyCache.name;
  } catch (e) { /* ignore */ }

  if (currentUser.role === 'Admin') {
    try {
      const allProperties = await api.get('/api/property/all');
      if (allProperties.length > 1) {
        const wrap = document.getElementById('propertySwitcherWrap');
        const select = document.createElement('select');
        select.style.cssText = 'width:100%;margin-top:8px;padding:6px 8px;border-radius:6px;border:1px solid rgba(234,243,241,0.2);background:rgba(234,243,241,0.08);color:#EAF3F1;font-size:12px;';
        select.innerHTML = allProperties.map(p => `<option value="${p.id}" ${p.id === propertyCache.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
        select.addEventListener('change', async () => {
          try {
            await api.post('/api/property/switch', { property_id: parseInt(select.value) });
            window.location.reload();
          } catch (e) { showToast(e.message, true); }
        });
        wrap.appendChild(select);
      }
    } catch (e) { /* ignore */ }
  }

  if (currentUser.role === 'Admin' || currentUser.role === 'Manager') {
    const operationsGroup = document.querySelector('.nav-group');
    const settingsGroup = document.createElement('div');
    settingsGroup.className = 'nav-group';
    settingsGroup.innerHTML = '<div class="nav-label">Configuration</div>';
    const settingsLink = document.createElement('a');
    settingsLink.className = 'nav-item';
    settingsLink.dataset.view = 'settings';
    settingsLink.innerHTML = '<span class="dot"></span>Settings';
    settingsLink.addEventListener('click', () => navigate('settings'));
    settingsGroup.appendChild(settingsLink);
    operationsGroup.insertAdjacentElement('afterend', settingsGroup);
  }

  navigate('dashboard');

  try {
    const licenseStatus = await api.get('/api/license/status');
    if (licenseStatus.inTrial) {
      const banner = document.getElementById('trialBanner');
      banner.className = 'trial-banner';
      banner.style.display = 'flex';
      banner.innerHTML = `Trial: ${licenseStatus.trialDaysRemaining} day${licenseStatus.trialDaysRemaining === 1 ? '' : 's'} remaining. <a onclick="navigate('settings');setTimeout(()=>document.querySelector('[data-tab=license]')?.click(),50);">Activate license →</a>`;
    }
  } catch (e) { /* ignore */ }
})();

function navigate(view) {
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === view));
  const renderers = {
    dashboard: renderDashboard,
    rooms: renderRooms,
    reservations: renderReservations,
    guests: renderGuests,
    settings: renderSettings,
    requests: renderRequests,
    cashclosing: renderCashClosing,
    analytics: renderAnalytics
  };
  (renderers[view] || renderDashboard)();
}

function setMain(html) {
  document.getElementById('mainContent').innerHTML = html;
}

// ================= DASHBOARD =================
async function renderDashboard() {
  setMain(`<div class="page-header"><div><h1>Dashboard</h1><div class="sub">Today's snapshot across the property</div></div></div>
    <div class="stat-grid" id="statGrid"><div class="muted">Loading…</div></div>
    <div class="card" style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:10px;">Upcoming Birthdays &amp; Anniversaries (next 7 days)</div>
      <div id="occasionsWrap" class="muted">Loading…</div>
    </div>
    <div class="card">
      <div class="flex-between" style="margin-bottom:14px;">
        <strong>Today's Arrivals &amp; Departures</strong>
        <a href="#" onclick="navigate('reservations');return false;" style="font-size:12.5px;color:var(--teal-700);font-weight:600;">View all reservations →</a>
      </div>
      <div id="todayLists" class="muted">Loading…</div>
    </div>`);

  try {
    const summary = await api.get('/api/dashboard/summary');
    document.getElementById('statGrid').innerHTML = `
      <div class="stat-card"><div class="label">Occupancy</div><div class="value">${summary.occupancy_pct}%</div><div class="hint">${summary.occupied_rooms} of ${summary.total_rooms} rooms</div></div>
      <div class="stat-card"><div class="label">In-House Guests</div><div class="value">${summary.in_house}</div><div class="hint">currently checked in</div></div>
      <div class="stat-card"><div class="label">Arrivals Today</div><div class="value accent">${summary.arrivals_today}</div><div class="hint">expected check-ins</div></div>
      <div class="stat-card"><div class="label">Departures Today</div><div class="value accent">${summary.departures_today}</div><div class="hint">expected check-outs</div></div>
      <div class="stat-card"><div class="label">Vacant Rooms</div><div class="value">${summary.vacant_rooms}</div><div class="hint">${summary.out_of_order_rooms} out of order</div></div>
      <div class="stat-card"><div class="label">Revenue Today</div><div class="value">${fmtMoney(summary.revenue_today)}</div><div class="hint">payments collected</div></div>`;
  } catch (e) {
    document.getElementById('statGrid').innerHTML = `<div class="muted">Could not load summary.</div>`;
  }

  try {
    const occasions = await api.get('/api/guests/upcoming-occasions?days=7');
    const rows = [
      ...occasions.birthdays.map(g => ({ ...g, kind: 'Birthday', dateField: g.date_of_birth })),
      ...occasions.anniversaries.map(g => ({ ...g, kind: 'Anniversary', dateField: g.anniversary_date }))
    ];
    const occasionsWrap = document.getElementById('occasionsWrap');
    if (rows.length === 0) {
      occasionsWrap.innerHTML = '<div style="font-size:13px;">None in the next 7 days.</div>';
    } else {
      occasionsWrap.innerHTML = rows.map(g => `
        <div class="flex-between" style="padding:6px 0;border-bottom:1px solid var(--line);">
          <div style="font-size:13px;"><strong>${escapeHtml(g.full_name)}</strong> — ${g.kind} (${g.dateField.slice(5)})</div>
          ${g.phone ? `<button class="btn btn-outline btn-sm" onclick="sendOccasionWish('${escapeHtml(g.phone)}', '${escapeHtml(g.full_name)}', '${g.kind}')">Send Wish</button>` : ''}
        </div>`).join('');
    }
  } catch (e) {
    document.getElementById('occasionsWrap').innerHTML = '<div style="font-size:13px;">Could not load.</div>';
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const [arrivals, departures] = await Promise.all([
      api.get('/api/reservations?status=confirmed'),
      api.get('/api/reservations?status=checked_in')
    ]);
    const todayArrivals = arrivals.filter(r => r.arrival_date === today);
    const todayDepartures = departures.filter(r => r.departure_date === today);

    const listHtml = (title, rows, dateField) => `
      <div style="margin-bottom:16px;">
        <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">${title} (${rows.length})</div>
        ${rows.length === 0 ? '<div class="muted" style="font-size:13px;">None</div>' : `
          <table><tbody>
            ${rows.map(r => `<tr style="cursor:pointer" onclick="openReservationDetail(${r.id})">
              <td style="width:30%"><strong>${escapeHtml(r.guest_name)}</strong></td>
              <td class="mono">${escapeHtml(r.booking_ref)}</td>
              <td><span class="badge ${RES_STATUS_BADGE[r.status] || 'badge-neutral'}">${r.status.replace('_',' ')}</span></td>
            </tr>`).join('')}
          </tbody></table>`}
      </div>`;

    document.getElementById('todayLists').innerHTML =
      listHtml('Arrivals', todayArrivals) + listHtml('Departures', todayDepartures);
  } catch (e) {
    document.getElementById('todayLists').innerHTML = `<div class="muted">Could not load today's activity.</div>`;
  }
}

function sendOccasionWish(phone, name, kind) {
  const message = kind === 'Birthday'
    ? `Happy Birthday, ${name}! 🎉 Wishing you a wonderful day from all of us at ${propertyCache ? propertyCache.name : 'our hotel'}. We'd love to host you again soon!`
    : `Happy Anniversary, ${name}! 🎉 Wishing you both continued happiness from all of us at ${propertyCache ? propertyCache.name : 'our hotel'}. We'd love to host you again soon!`;
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`, '_blank');
}

// ================= ROOMS =================
async function renderRooms() {
  setMain(`<div class="page-header"><div><h1>Rooms &amp; Housekeeping</h1><div class="sub">Live room status across the property</div></div></div>
    <div style="display:flex;gap:16px;margin-bottom:16px;font-size:12px;" id="legend"></div>
    <div class="room-grid" id="roomGrid"><div class="muted">Loading…</div></div>`);

  document.getElementById('legend').innerHTML = [
    ['vacant_clean', 'Vacant / Clean'], ['vacant_dirty', 'Vacant / Dirty'],
    ['occupied_clean', 'Occupied'], ['out_of_order', 'Out of Order']
  ].map(([k, label]) => `<div style="display:flex;align-items:center;gap:6px;">
      <span style="width:10px;height:10px;border-radius:2px;background:${legendColor(k)};display:inline-block;"></span>${label}
    </div>`).join('');

  try {
    const rooms = await api.get('/api/rooms');
    document.getElementById('roomGrid').innerHTML = rooms.map(r => `
      <div class="room-tile st-${r.status}" onclick="openRoomStatusModal(${r.id}, '${r.status}', '${escapeHtml(r.room_number)}')">
        <div class="num">${escapeHtml(r.room_number)}</div>
        <div class="type">${escapeHtml(r.room_type_name)}</div>
        <span class="status-pill" style="background:${legendColor(r.status)}22;color:${legendColor(r.status)};">${STATUS_LABELS[r.status] || r.status}</span>
      </div>`).join('');
  } catch (e) {
    document.getElementById('roomGrid').innerHTML = `<div class="muted">Could not load rooms.</div>`;
  }
}

function legendColor(status) {
  const map = {
    vacant_clean: '#2E7D51', vacant_dirty: '#B4791F',
    occupied_clean: '#1D6E6B', occupied_dirty: '#1D6E6B',
    out_of_order: '#A3372F', out_of_service: '#A3372F'
  };
  return map[status] || '#6b7280';
}

function openRoomStatusModal(roomId, currentStatus, roomNumber) {
  const options = Object.keys(STATUS_LABELS).map(s =>
    `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('');

  showModal(`Room ${roomNumber}`, `
    <div class="form-field">
      <label>Status</label>
      <select id="roomStatusSelect">${options}</select>
    </div>
    <div class="form-field">
      <label>Remarks (optional)</label>
      <textarea id="roomStatusRemarks" rows="2" placeholder="e.g. AC not working, reported to maintenance"></textarea>
    </div>
  `, [
    { label: 'Cancel', cls: 'btn-outline', action: closeModal },
    { label: 'Update Status', cls: 'btn-primary', action: async () => {
      try {
        const status = document.getElementById('roomStatusSelect').value;
        const remarks = document.getElementById('roomStatusRemarks').value;
        await api.patch(`/api/rooms/${roomId}/status`, { status, housekeeping_status: status.includes('dirty') ? 'dirty' : 'clean', remarks });
        closeModal();
        showToast('Room status updated');
        renderRooms();
      } catch (e) { showToast(e.message, true); }
    }}
  ]);
}

// ================= RESERVATIONS =================
async function renderReservations() {
  setMain(`<div class="page-header">
      <div><h1>Reservations</h1><div class="sub">Bookings, check-ins and check-outs</div></div>
      <button class="btn btn-brass" onclick="openNewBookingModal()">+ New Booking</button>
    </div>
    <div class="tab-bar" id="resTabs">
      ${['all','confirmed','checked_in','checked_out','cancelled'].map(s =>
        `<button class="tab-btn ${s === 'all' ? 'active' : ''}" data-status="${s}">${s === 'all' ? 'All' : s.replace('_',' ')}</button>`).join('')}
    </div>
    <div id="resTableWrap"><div class="muted">Loading…</div></div>`);

  document.querySelectorAll('#resTabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#resTabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadReservationsTable(btn.dataset.status);
    });
  });

  loadReservationsTable('all');
}

async function loadReservationsTable(status) {
  const wrap = document.getElementById('resTableWrap');
  wrap.innerHTML = '<div class="muted">Loading…</div>';
  try {
    const url = status === 'all' ? '/api/reservations' : `/api/reservations?status=${status}`;
    const rows = await api.get(url);
    if (rows.length === 0) {
      wrap.innerHTML = `<div class="empty-state">No reservations found.</div>`;
      return;
    }
    wrap.innerHTML = `<div class="card" style="padding:0;">
      <table>
        <thead><tr><th>Booking Ref</th><th>Guest</th><th>Arrival</th><th>Departure</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${rows.map(r => `<tr style="cursor:pointer" onclick="openReservationDetail(${r.id})">
            <td class="mono">${escapeHtml(r.booking_ref)}</td>
            <td><strong>${escapeHtml(r.guest_name)}</strong><br><span class="muted" style="font-size:11.5px;">${escapeHtml(r.guest_phone || '')}</span></td>
            <td>${fmtDate(r.arrival_date)}</td>
            <td>${fmtDate(r.departure_date)}</td>
            <td><span class="badge ${RES_STATUS_BADGE[r.status] || 'badge-neutral'}">${r.status.replace('_',' ')}</span></td>
            <td style="text-align:right;color:var(--teal-700);font-weight:600;font-size:12.5px;">View →</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="muted">Could not load reservations.</div>`;
  }
}

function openNewBookingModal() {
  const typeOptions = roomTypesCache.map(t => `<option value="${t.id}" data-rate="${t.base_rate}">${escapeHtml(t.name)} (${fmtMoney(t.base_rate)}/night)</option>`).join('');
  const addons = window.__addonsCache || [];

  showModal('New Booking', `
    <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:10px;">Guest Details</div>
    <div class="form-grid">
      <div class="form-field"><label>Full Name *</label><input id="nb_name" type="text" required></div>
      <div class="form-field"><label>Phone</label><input id="nb_phone" type="text"></div>
      <div class="form-field"><label>Email</label><input id="nb_email" type="email"></div>
      <div class="form-field"><label>ID Proof Number</label><input id="nb_idnum" type="text"></div>
      <div class="form-field span-2"><label>Address</label><input id="nb_address" type="text" placeholder="Street address"></div>
      <div class="form-field"><label>City</label><input id="nb_city" type="text"></div>
      <div class="form-field"><label>State</label><input id="nb_state" type="text" placeholder="e.g. Madhya Pradesh"></div>
      <div class="form-field"><label>Company (optional)</label><input id="nb_company" type="text"></div>
      <div class="form-field"><label>Guest GSTIN (optional)</label><input id="nb_gstin" type="text" placeholder="If travelling on company GST"></div>
    </div>
    <div class="divider"></div>
    <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:10px;">Stay Details</div>
    <div class="form-grid">
      <div class="form-field"><label>Arrival Date *</label><input id="nb_arrival" type="date" required></div>
      <div class="form-field"><label>Departure Date *</label><input id="nb_departure" type="date" required></div>
      <div class="form-field"><label>Room Type *</label><select id="nb_roomtype">${typeOptions}</select></div>
      <div class="form-field"><label>Rate / Night</label><input id="nb_rate" type="number" step="0.01"></div>
      <div class="form-field"><label>Adults</label><input id="nb_adults" type="number" value="1" min="1"></div>
      <div class="form-field"><label>Source</label>
        <select id="nb_source">
          <option value="walk_in">Walk-in</option><option value="phone">Phone</option>
          <option value="ota">OTA</option><option value="corporate">Corporate</option><option value="agent">Agent</option>
        </select>
      </div>
    </div>
    ${addons.length > 0 ? `
    <div class="divider"></div>
    <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:10px;">Add-ons (optional)</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:6px;">
      ${addons.map(a => `<label style="display:flex;align-items:center;gap:8px;font-size:13px;">
        <input type="checkbox" class="nb-addon-check" value="${a.id}" style="width:auto;">
        ${escapeHtml(a.name)} — ${fmtMoney(a.price)}
      </label>`).join('')}
    </div>` : ''}
  `, [
    { label: 'Cancel', cls: 'btn-outline', action: closeModal },
    { label: 'Create Booking', cls: 'btn-primary', action: submitNewBooking }
  ]);

  // Auto-fill rate on room type / arrival date change, checking seasonal rate plans
  setTimeout(() => {
    const sel = document.getElementById('nb_roomtype');
    const rateInput = document.getElementById('nb_rate');
    const arrivalInput = document.getElementById('nb_arrival');

    const syncRate = async () => {
      const roomTypeId = sel.value;
      const arrival = arrivalInput.value;
      if (!roomTypeId || !arrival) return;
      try {
        const effective = await api.get(`/api/rate-plans/effective?room_type_id=${roomTypeId}&date=${arrival}`);
        rateInput.value = effective.rate;
        if (effective.source === 'seasonal') {
          showToast(`Seasonal rate applied: ${effective.plan_name}`);
        }
      } catch (e) {
        rateInput.value = sel.selectedOptions[0]?.dataset.rate || '';
      }
    };

    sel.addEventListener('change', syncRate);
    arrivalInput.addEventListener('change', syncRate);

    // default dates: today / tomorrow
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 86400000);
    arrivalInput.value = today.toISOString().slice(0, 10);
    document.getElementById('nb_departure').value = tomorrow.toISOString().slice(0, 10);
    syncRate();
  }, 0);
}

async function submitNewBooking() {
  const name = document.getElementById('nb_name').value.trim();
  const arrival = document.getElementById('nb_arrival').value;
  const departure = document.getElementById('nb_departure').value;
  const roomTypeId = document.getElementById('nb_roomtype').value;
  const rate = parseFloat(document.getElementById('nb_rate').value);

  if (!name) return showToast('Guest name is required', true);
  if (!arrival || !departure) return showToast('Arrival and departure dates are required', true);
  if (!rate || rate <= 0) return showToast('A valid rate is required', true);

  try {
    const payload = {
      guest: {
        full_name: name,
        phone: document.getElementById('nb_phone').value.trim(),
        email: document.getElementById('nb_email').value.trim(),
        id_proof_number: document.getElementById('nb_idnum').value.trim(),
        address: document.getElementById('nb_address').value.trim(),
        city: document.getElementById('nb_city').value.trim(),
        state: document.getElementById('nb_state').value.trim(),
        company_name: document.getElementById('nb_company').value.trim(),
        gstin: document.getElementById('nb_gstin').value.trim()
      },
      arrival_date: arrival,
      departure_date: departure,
      adults: parseInt(document.getElementById('nb_adults').value) || 1,
      source: document.getElementById('nb_source').value,
      rooms: [{ room_type_id: parseInt(roomTypeId), rate_per_night: rate }]
    };
    const result = await api.post('/api/reservations', payload);

    const selectedAddonIds = Array.from(document.querySelectorAll('.nb-addon-check:checked')).map(el => el.value);
    if (selectedAddonIds.length > 0 && result.folioId) {
      await Promise.all(selectedAddonIds.map(addonId =>
        api.post(`/api/revenue/addons/${addonId}/apply/${result.folioId}`).catch(() => null)
      ));
    }

    closeModal();
    showToast(`Booking created: ${result.bookingRef}`);
    navigate('reservations');
  } catch (e) {
    showToast(e.message, true);
  }
}

async function openReservationDetail(id) {
  showModal('Loading…', '<div class="muted">Fetching reservation…</div>', []);
  try {
    const r = await api.get(`/api/reservations/${id}`);
    const chargeTotal = (r.charges || []).reduce((s, c) => s + c.amount + c.tax_amount, 0);
    const paidTotal = (r.payments || []).reduce((s, p) => s + p.amount, 0);
    const balance = chargeTotal - paidTotal;

    const body = `
      <div class="flex-between" style="margin-bottom:14px;">
        <div>
          <div style="font-family:var(--font-display);font-size:19px;font-weight:600;">${escapeHtml(r.guest_name)}</div>
          <div class="muted mono" style="font-size:12px;">${escapeHtml(r.booking_ref)}</div>
        </div>
        <span class="badge ${RES_STATUS_BADGE[r.status] || 'badge-neutral'}">${r.status.replace('_',' ')}</span>
      </div>
      <div class="form-grid" style="margin-bottom:6px;">
        <div><div class="muted" style="font-size:11px;">ARRIVAL</div><div>${fmtDate(r.arrival_date)}</div></div>
        <div><div class="muted" style="font-size:11px;">DEPARTURE</div><div>${fmtDate(r.departure_date)}</div></div>
        <div><div class="muted" style="font-size:11px;">PHONE</div><div>${escapeHtml(r.guest_phone || '—')}</div></div>
        <div><div class="muted" style="font-size:11px;">SOURCE</div><div>${escapeHtml(r.source || '—')}</div></div>
      </div>
      <div class="divider"></div>
      <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:8px;">Rooms</div>
      <table><tbody>
        ${(r.rooms || []).map(rm => `<tr>
          <td>${rm.room_number ? `<strong>${escapeHtml(rm.room_number)}</strong>` : '<span class="muted">Not assigned</span>'}</td>
          <td>${escapeHtml(rm.room_type_name)}</td>
          <td>${fmtMoney(rm.rate_per_night)}/night</td>
          <td><span class="badge badge-neutral">${rm.status.replace('_',' ')}</span></td>
          <td>${rm.status !== 'checked_out' && ['confirmed','checked_in'].includes(r.status) ? `
            <button class="btn btn-outline btn-sm" onclick="openAssignRoomModal(${r.id}, ${rm.id}, ${rm.room_type_id}, '${r.arrival_date}', '${r.departure_date}')">
              ${rm.room_id ? 'Change' : 'Assign'}
            </button>` : ''}
          </td>
        </tr>`).join('')}
      </tbody></table>
      <div class="divider"></div>
      <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:8px;">Folio Summary</div>
      <div class="form-grid">
        <div><div class="muted" style="font-size:11px;">CHARGES</div><div>${fmtMoney(chargeTotal)}</div></div>
        <div><div class="muted" style="font-size:11px;">PAID</div><div>${fmtMoney(paidTotal)}</div></div>
      </div>
      <div style="font-size:15px;font-weight:700;margin-top:6px;color:${balance > 0.5 ? 'var(--danger)' : 'var(--ok)'};">
        Balance: ${fmtMoney(balance)}
      </div>
    `;

    const footerBtns = [];
    if (r.folio) {
      footerBtns.push({ label: 'Billing / Folio', cls: 'btn-outline', action: () => openFolioModal(r.folio.id, r.booking_ref) });
    }
    footerBtns.push({ label: 'WhatsApp', cls: 'btn-outline', action: () => sendReservationWhatsapp(id) });
    footerBtns.push({ label: 'Email', cls: 'btn-outline', action: () => sendReservationEmail(id) });
    footerBtns.push({ label: 'Guest Portal Link', cls: 'btn-outline', action: () => {
      const url = `${window.location.origin}/guest.html?ref=${encodeURIComponent(r.booking_ref)}`;
      navigator.clipboard?.writeText(url);
      showToast('Guest portal link copied to clipboard');
    }});
    if (r.status === 'confirmed') {
      footerBtns.push({ label: 'Check In', cls: 'btn-brass', action: async () => {
        try {
          const result = await api.post(`/api/reservations/${id}/checkin`, {});
          closeModal();
          if (result.auto_assigned && result.auto_assigned.length) {
            showToast(`Checked in — auto-assigned room(s): ${result.auto_assigned.join(', ')}`);
          } else {
            showToast('Guest checked in');
          }
          navigate('reservations');
        } catch (e) { showToast(e.message, true); }
      }});
      footerBtns.push({ label: 'Cancel Booking', cls: 'btn-danger-outline', action: async () => {
        if (!confirm('Cancel this reservation?')) return;
        try {
          await api.post(`/api/reservations/${id}/cancel`, {});
          closeModal(); showToast('Reservation cancelled'); navigate('reservations');
        } catch (e) { showToast(e.message, true); }
      }});
      footerBtns.push({ label: 'Mark No-Show', cls: 'btn-danger-outline', action: async () => {
        if (!confirm('Mark this reservation as a no-show?')) return;
        try {
          await api.post(`/api/reservations/${id}/no-show`, {});
          closeModal(); showToast('Marked as no-show'); navigate('reservations');
        } catch (e) { showToast(e.message, true); }
      }});
    }
    if (r.status === 'checked_in') {
      footerBtns.push({ label: 'Check Out', cls: 'btn-primary', action: async () => {
        try {
          await api.post(`/api/reservations/${id}/checkout`, {});
          if (r.folio) {
            promptInvoicePrint(r.folio.id, r.booking_ref);
          } else {
            closeModal(); showToast('Guest checked out'); navigate('reservations');
          }
        } catch (e) { showToast(e.message, true); }
      }});
    }
    footerBtns.push({ label: 'Close', cls: 'btn-outline', action: closeModal });

    showModal(`Reservation`, body, footerBtns);
  } catch (e) {
    showModal('Error', `<div class="muted">${escapeHtml(e.message)}</div>`, [{ label: 'Close', cls: 'btn-outline', action: closeModal }]);
  }
}

// Prompted automatically right after a checkout completes — front desk decides
// how (or whether) to hand the guest their bill.
function promptInvoicePrint(folioId, bookingRef) {
  const gstRegistered = propertyCache ? !!propertyCache.is_gst_registered : true;
  const buttons = [
    { label: 'Skip', cls: 'btn-outline', action: () => { closeModal(); showToast('Guest checked out'); navigate('reservations'); } },
    { label: 'WhatsApp Invoice', cls: 'btn-outline', action: async () => { await sendInvoiceWhatsapp(folioId); } },
    { label: 'Print (without GST)', cls: 'btn-outline', action: () => printInvoice(folioId, false) }
  ];
  if (gstRegistered) {
    buttons.push({ label: 'Print (with GST)', cls: 'btn-primary', action: () => printInvoice(folioId, true) });
  }
  showModal('Checkout Complete', `
    <p style="margin-bottom:6px;">Guest for booking <strong>${escapeHtml(bookingRef)}</strong> has been checked out.</p>
    <p class="muted" style="font-size:13px;">Print or send the final invoice now?</p>
  `, buttons);
}

// ---------------- Invoice Printing (with / without GST) ----------------
async function printInvoice(folioId, withGst) {
  if (withGst && propertyCache && !propertyCache.is_gst_registered) {
    showToast('This property is not GST registered — printing without GST instead', true);
    withGst = false;
  }
  try {
    const data = await api.get(`/api/billing/folio/${folioId}/invoice`);
    const html = buildInvoiceHtml(data, withGst);
    const win = window.open('', '_blank', 'width=820,height=900');
    if (!win) { showToast('Please allow pop-ups to print the bill', true); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => setTimeout(() => win.print(), 250);
  } catch (e) {
    showToast(e.message, true);
  }
}

function buildInvoiceHtml(data, withGst) {
  const { folio, reservation, rooms, charges, payments, summary, billTo, supplyType } = data;
  const docTitle = withGst ? 'Tax Invoice' : 'Bill';
  const isInterState = supplyType === 'inter_state';

  const roomsLine = rooms.map(r =>
    `${escapeHtml(r.room_type_name)}${r.room_number ? ' · Room ' + escapeHtml(r.room_number) : ''} (${fmtMoney(r.rate_per_night)}/night)`
  ).join(', ');

  const chargeRows = charges.map(c => `
    <tr>
      <td>${escapeHtml(c.description || c.charge_type)}</td>
      <td style="text-align:right;">${fmtMoney(c.amount)}</td>
      ${withGst
        ? (isInterState
            ? `<td style="text-align:right;">${fmtMoney(c.igst)}</td>`
            : `<td style="text-align:right;">${fmtMoney(c.cgst)}</td><td style="text-align:right;">${fmtMoney(c.sgst)}</td>`)
        : ''}
      <td style="text-align:right;">${fmtMoney(c.line_total)}</td>
    </tr>`).join('');

  const paymentRows = payments.map(p => `
    <tr>
      <td>${p.mode.replace('_', ' ')}${p.reference_number ? ' · ' + escapeHtml(p.reference_number) : ''}</td>
      <td style="text-align:right;">${fmtDate(p.paid_at)}</td>
      <td style="text-align:right;">${fmtMoney(p.amount)}</td>
    </tr>`).join('') || '<tr><td colspan="3" style="color:#999;">No payments recorded</td></tr>';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${docTitle} — ${escapeHtml(reservation.booking_ref)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1C2321; padding: 36px; max-width: 760px; margin: 0 auto; }
  .top { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 2px solid #0D3B3A; padding-bottom: 16px; margin-bottom: 20px; }
  .prop-name { font-size: 22px; font-weight: 700; color: #0D3B3A; }
  .prop-meta { font-size: 12px; color: #555; margin-top: 4px; line-height: 1.5; }
  .doc-title { font-size: 20px; font-weight: 700; text-align: right; }
  .doc-meta { font-size: 12px; color: #555; text-align: right; margin-top: 4px; }
  .party-grid { display:flex; justify-content:space-between; margin-bottom: 20px; gap: 30px; }
  .party h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 6px; }
  .party div { font-size: 13px; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  thead th { text-align:left; font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ddd; padding: 8px 6px; }
  tbody td { font-size: 13px; padding: 8px 6px; border-bottom: 1px solid #eee; }
  .totals { width: 280px; margin-left: auto; }
  .totals div { display:flex; justify-content:space-between; font-size: 13px; padding: 4px 0; }
  .totals .grand { font-size: 16px; font-weight: 700; border-top: 2px solid #0D3B3A; margin-top: 6px; padding-top: 8px; }
  .totals .balance { font-weight: 700; color: ${summary.balance > 0.5 ? '#A3372F' : '#2E7D51'}; }
  .footer { margin-top: 30px; text-align:center; font-size: 12px; color: #888; }
  @media print { body { padding: 12px; } }
</style>
</head><body>
  <div class="top">
    <div>
      <div class="prop-name">${escapeHtml(reservation.property_name)}</div>
      <div class="prop-meta">
        ${escapeHtml([reservation.property_address, reservation.property_city, reservation.property_state].filter(Boolean).join(', '))}<br>
        ${reservation.property_phone ? 'Phone: ' + escapeHtml(reservation.property_phone) + '<br>' : ''}
        ${withGst && reservation.property_gstin ? 'GSTIN: ' + escapeHtml(reservation.property_gstin) : ''}
      </div>
    </div>
    <div>
      <div class="doc-title">${docTitle}</div>
      <div class="doc-meta">
        Folio: ${escapeHtml(folio.folio_number)}<br>
        Date: ${fmtDate(new Date().toISOString())}${withGst ? '<br>Place of Supply: ' + (isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)') : ''}
      </div>
    </div>
  </div>

  <div class="party-grid">
    <div class="party">
      <h4>Billed To${billTo.same_as_guest ? '' : ' (Reimbursement Billing)'}</h4>
      <div>
        <strong>${escapeHtml(billTo.name || reservation.guest_name)}</strong><br>
        ${billTo.phone ? escapeHtml(billTo.phone) + '<br>' : ''}
        ${billTo.address ? escapeHtml(billTo.address) + '<br>' : ''}
        ${billTo.city || billTo.state ? escapeHtml([billTo.city, billTo.state].filter(Boolean).join(', ')) + '<br>' : ''}
        ${withGst && billTo.gstin ? 'GSTIN: ' + escapeHtml(billTo.gstin) : ''}
        ${!billTo.same_as_guest ? `<div style="margin-top:8px;font-size:11.5px;color:#888;">Guest: ${escapeHtml(reservation.guest_name)}${reservation.guest_phone ? ' · ' + escapeHtml(reservation.guest_phone) : ''}</div>` : ''}
      </div>
    </div>
    <div class="party">
      <h4>Stay Details</h4>
      <div>
        Booking Ref: ${escapeHtml(reservation.booking_ref)}<br>
        Arrival: ${fmtDate(reservation.arrival_date)}<br>
        Departure: ${fmtDate(reservation.departure_date)}<br>
        ${escapeHtml(roomsLine)}
      </div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th>Description</th><th style="text-align:right;">Amount</th>
      ${withGst ? (isInterState ? '<th style="text-align:right;">IGST</th>' : '<th style="text-align:right;">CGST</th><th style="text-align:right;">SGST</th>') : ''}
      <th style="text-align:right;">Total</th>
    </tr></thead>
    <tbody>${chargeRows}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>${fmtMoney(summary.subtotal)}</span></div>
    ${withGst ? (isInterState
      ? `<div><span>IGST</span><span>${fmtMoney(summary.igst)}</span></div>`
      : `<div><span>CGST</span><span>${fmtMoney(summary.cgst)}</span></div>
         <div><span>SGST</span><span>${fmtMoney(summary.sgst)}</span></div>`) : ''}
    <div class="grand"><span>Grand Total</span><span>${fmtMoney(summary.grand_total)}</span></div>
    <div style="margin-top:8px;"><span>Paid</span><span>${fmtMoney(summary.paid_total)}</span></div>
    <div class="balance"><span>Balance</span><span>${fmtMoney(summary.balance)}</span></div>
  </div>

  <div style="font-size:12px;font-weight:700;color:#666;text-transform:uppercase;margin-bottom:8px;">Payments Received</div>
  <table>
    <thead><tr><th>Mode</th><th style="text-align:right;">Date</th><th style="text-align:right;">Amount</th></tr></thead>
    <tbody>${paymentRows}</tbody>
  </table>

  <div class="footer">Thank you for staying with ${escapeHtml(reservation.property_name)}.${!withGst ? ' (Simplified bill — no tax breakup shown)' : ''}</div>
</body></html>`;
}

async function sendInvoiceWhatsapp(folioId) {
  try {
    const { link } = await api.get(`/api/messaging/invoice/${folioId}/whatsapp-link`);
    window.open(link, '_blank');
  } catch (e) { showToast(e.message, true); }
}

async function sendInvoiceEmail(folioId) {
  try {
    await api.post(`/api/messaging/invoice/${folioId}/email`);
    showToast('Invoice emailed to guest');
  } catch (e) { showToast(e.message, true); }
}

async function sendReservationWhatsapp(reservationId) {
  try {
    const { link } = await api.get(`/api/messaging/reservation/${reservationId}/whatsapp-link`);
    window.open(link, '_blank');
  } catch (e) { showToast(e.message, true); }
}

async function sendReservationEmail(reservationId) {
  try {
    await api.post(`/api/messaging/reservation/${reservationId}/email`);
    showToast('Confirmation emailed to guest');
  } catch (e) { showToast(e.message, true); }
}

// ---------------- Room Assignment ----------------
async function openAssignRoomModal(reservationId, reservationRoomId, roomTypeId, arrival, departure) {
  showModal('Assign Room', '<div class="muted">Finding available rooms…</div>', []);
  try {
    const available = await api.get(
      `/api/rooms/available?arrival=${encodeURIComponent(arrival)}&departure=${encodeURIComponent(departure)}&room_type_id=${roomTypeId}`
    );

    if (available.length === 0) {
      showModal('Assign Room', `<div class="muted">No vacant rooms of this type are free for ${fmtDate(arrival)} – ${fmtDate(departure)}. Try a different room type, or free up a room first.</div>`,
        [{ label: 'Close', cls: 'btn-outline', action: closeModal }]);
      return;
    }

    const options = available.map(rm =>
      `<option value="${rm.id}">${escapeHtml(rm.room_number)} — ${escapeHtml(rm.room_type_name)} (${STATUS_LABELS[rm.status] || rm.status})</option>`
    ).join('');

    showModal('Assign Room', `
      <p class="muted" style="margin-bottom:14px;font-size:13px;">Available rooms for ${fmtDate(arrival)} – ${fmtDate(departure)}:</p>
      <div class="form-field">
        <label>Room</label>
        <select id="assignRoomSelect">${options}</select>
      </div>
    `, [
      { label: 'Cancel', cls: 'btn-outline', action: closeModal },
      { label: 'Assign Room', cls: 'btn-primary', action: async () => {
        const roomId = parseInt(document.getElementById('assignRoomSelect').value);
        try {
          const result = await api.patch(`/api/reservations/${reservationId}/assign-room`, {
            reservation_room_id: reservationRoomId, room_id: roomId
          });
          showToast(`Room ${result.room_number} assigned`);
          openReservationDetail(reservationId);
        } catch (e) { showToast(e.message, true); }
      }}
    ]);
  } catch (e) {
    showModal('Assign Room', `<div class="muted">${escapeHtml(e.message)}</div>`, [{ label: 'Close', cls: 'btn-outline', action: closeModal }]);
  }
}

// ---------------- Billing / Folio Modal ----------------
async function openFolioModal(folioId, bookingRef) {
  try {
    const [data, addons] = await Promise.all([
      api.get(`/api/billing/folio/${folioId}`),
      api.get('/api/revenue/addons').catch(() => [])
    ]);
    window.__addonsCache = addons;
    renderFolioModal(folioId, bookingRef, data);
  } catch (e) {
    showToast(e.message, true);
  }
}

function renderFolioModal(folioId, bookingRef, data) {
  const { charges, payments, summary, folio } = data;
  const gstRegistered = propertyCache ? !!propertyCache.is_gst_registered : true;

  const billToLabel = folio.bill_to_same_as_guest
    ? 'Same as guest'
    : `${folio.bill_to_name || '—'}${folio.bill_to_gstin ? ' · GSTIN ' + escapeHtml(folio.bill_to_gstin) : ''}`;

  const body = `
    <div class="muted mono" style="font-size:12px;margin-bottom:10px;">Folio ${escapeHtml(folio.folio_number)} · Booking ${escapeHtml(bookingRef)}</div>

    <div class="card" style="padding:12px 14px;margin-bottom:16px;">
      <div class="flex-between">
        <div>
          <div style="font-size:11px;text-transform:uppercase;color:var(--ink-soft);font-weight:700;margin-bottom:3px;">Bill To</div>
          <div style="font-size:13.5px;">${billToLabel}</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="openBillToModal(${folioId})">Change</button>
      </div>
    </div>

    <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:8px;">Charges</div>
    <table><tbody>
      ${charges.map(c => `<tr>
        <td>${escapeHtml(c.description || c.charge_type)}<br><span class="badge badge-neutral" style="margin-top:4px;">${c.charge_type}${c.tax_rate ? ' · ' + c.tax_rate + '% GST' : ''}</span></td>
        <td style="text-align:right;">${fmtMoney(c.amount + c.tax_amount)}</td>
      </tr>`).join('') || '<tr><td class="muted">No charges yet</td></tr>'}
    </tbody></table>
    <div class="divider"></div>
    <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:8px;">Payments</div>
    <table><tbody>
      ${payments.map(p => `<tr>
        <td>${p.mode.replace('_',' ')}${p.reference_number ? ' · ' + escapeHtml(p.reference_number) : ''}</td>
        <td style="text-align:right;">${fmtMoney(p.amount)}</td>
      </tr>`).join('') || '<tr><td class="muted">No payments yet</td></tr>'}
    </tbody></table>
    <div class="divider"></div>
    <div class="flex-between" style="font-size:15px;font-weight:700;margin-bottom:16px;">
      <span>Balance Due</span>
      <span style="color:${summary.balance > 0.5 ? 'var(--danger)' : 'var(--ok)'};">${fmtMoney(summary.balance)}</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
      ${gstRegistered ? `<button class="btn btn-outline btn-sm" onclick="printInvoice(${folioId}, true)">Print Bill (with GST)</button>` : ''}
      <button class="btn btn-outline btn-sm" onclick="printInvoice(${folioId}, false)">Print Bill (without GST)</button>
      <button class="btn btn-outline btn-sm" onclick="sendInvoiceWhatsapp(${folioId})">WhatsApp Invoice</button>
      <button class="btn btn-outline btn-sm" onclick="sendInvoiceEmail(${folioId})">Email Invoice</button>
    </div>
    ${folio.status === 'open' ? `
    ${(window.__addonsCache || []).length > 0 ? `
    <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:8px;">Quick Add-ons</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
      ${(window.__addonsCache || []).map(a => `
        <button class="btn btn-outline btn-sm" onclick="applyAddon(${a.id}, ${folioId})">+ ${escapeHtml(a.name)} (${fmtMoney(a.price)})</button>
      `).join('')}
    </div>
    <div class="divider"></div>
    ` : ''}
    <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:8px;">Add Charge</div>
    <div class="form-grid">
      <div class="form-field"><label>Type</label>
        <select id="chg_type">
          <option value="fnb">Food &amp; Beverage</option><option value="laundry">Laundry</option>
          <option value="minibar">Minibar</option><option value="misc">Miscellaneous</option>
        </select>
      </div>
      <div class="form-field"><label>Amount</label><input id="chg_amount" type="number" step="0.01"></div>
      <div class="form-field span-2"><label>Description</label><input id="chg_desc" type="text"></div>
      ${gstRegistered ? `<div class="form-field"><label>Tax Rate % (optional)</label><input id="chg_tax_rate" type="number" step="0.01" placeholder="e.g. 18"></div>` : '<input type="hidden" id="chg_tax_rate" value="0">'}
    </div>
    <button class="btn btn-outline btn-sm" onclick="submitCharge(${folioId})">Add Charge</button>
    <div class="divider"></div>
    <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:8px;">Record Payment</div>
    <div class="form-grid">
      <div class="form-field"><label>Amount</label><input id="pay_amount" type="number" step="0.01"></div>
      <div class="form-field"><label>Mode</label>
        <select id="pay_mode">
          <option value="cash">Cash</option><option value="card">Card</option>
          <option value="upi">UPI</option><option value="bank_transfer">Bank Transfer</option>
        </select>
      </div>
      <div class="form-field span-2"><label>Reference # (optional)</label><input id="pay_ref" type="text"></div>
    </div>
    <button class="btn btn-brass btn-sm" onclick="submitPayment(${folioId})">Record Payment</button>
    ` : `<div class="badge badge-neutral">Folio ${folio.status}</div>`}
  `;
  showModal('Billing', body, [{ label: 'Close', cls: 'btn-outline', action: closeModal }]);
}

async function applyAddon(addonId, folioId) {
  try {
    await api.post(`/api/revenue/addons/${addonId}/apply/${folioId}`);
    showToast('Add-on applied');
    const data = await api.get(`/api/billing/folio/${folioId}`);
    renderFolioModal(folioId, '', data);
  } catch (e) { showToast(e.message, true); }
}

// ---------------- Bill-To (redirect invoice to company / other person) ----------------
async function openBillToModal(folioId) {
  showModal('Bill To', '<div class="muted">Loading…</div>', []);
  let folio;
  try {
    const data = await api.get(`/api/billing/folio/${folioId}`);
    folio = data.folio;
  } catch (e) {
    showModal('Bill To', `<div class="muted">${escapeHtml(e.message)}</div>`, [{ label: 'Close', cls: 'btn-outline', action: closeModal }]);
    return;
  }
  const same = !!folio.bill_to_same_as_guest;

  showModal('Bill To', `
    <div class="form-field">
      <label><input type="checkbox" id="bt_same" ${same ? 'checked' : ''} style="width:auto;margin-right:6px;"> Bill to guest (default)</label>
    </div>
    <div id="bt_companyFields" style="display:${same ? 'none' : 'block'};">
      <div class="form-grid">
        <div class="form-field span-2"><label>Company / Payer Name *</label><input id="bt_name" type="text" value="${escapeHtml(folio.bill_to_name || '')}" placeholder="e.g. Acme Industries Pvt Ltd"></div>
        <div class="form-field span-2"><label>Address</label><input id="bt_address" type="text" value="${escapeHtml(folio.bill_to_address || '')}"></div>
        <div class="form-field"><label>City</label><input id="bt_city" type="text" value="${escapeHtml(folio.bill_to_city || '')}"></div>
        <div class="form-field"><label>State *</label><input id="bt_state" type="text" value="${escapeHtml(folio.bill_to_state || '')}" placeholder="Needed to determine CGST/SGST vs IGST"></div>
        <div class="form-field"><label>GSTIN</label><input id="bt_gstin" type="text" value="${escapeHtml(folio.bill_to_gstin || '')}"></div>
        <div class="form-field"><label>Phone</label><input id="bt_phone" type="text" value="${escapeHtml(folio.bill_to_phone || '')}"></div>
        <div class="form-field span-2"><label>Email</label><input id="bt_email" type="email" value="${escapeHtml(folio.bill_to_email || '')}"></div>
      </div>
    </div>
  `, [
    { label: 'Cancel', cls: 'btn-outline', action: closeModal },
    { label: 'Save', cls: 'btn-primary', action: async () => {
      const sameNow = document.getElementById('bt_same').checked;
      const payload = { bill_to_same_as_guest: sameNow };
      if (!sameNow) {
        const name = document.getElementById('bt_name').value.trim();
        if (!name) { showToast('Company / payer name is required', true); return; }
        payload.bill_to_name = name;
        payload.bill_to_address = document.getElementById('bt_address').value.trim();
        payload.bill_to_city = document.getElementById('bt_city').value.trim();
        payload.bill_to_state = document.getElementById('bt_state').value.trim();
        payload.bill_to_gstin = document.getElementById('bt_gstin').value.trim();
        payload.bill_to_phone = document.getElementById('bt_phone').value.trim();
        payload.bill_to_email = document.getElementById('bt_email').value.trim();
      }
      try {
        await api.patch(`/api/billing/folio/${folioId}/bill-to`, payload);
        showToast('Billing party updated');
        const refreshed = await api.get(`/api/billing/folio/${folioId}`);
        renderFolioModal(folioId, '', refreshed);
      } catch (e) { showToast(e.message, true); }
    }}
  ]);

  setTimeout(() => {
    const chk = document.getElementById('bt_same');
    const fields = document.getElementById('bt_companyFields');
    chk.addEventListener('change', () => { fields.style.display = chk.checked ? 'none' : 'block'; });
  }, 0);
}

async function submitCharge(folioId) {
  const charge_type = document.getElementById('chg_type').value;
  const amount = parseFloat(document.getElementById('chg_amount').value);
  const description = document.getElementById('chg_desc').value.trim();
  const taxRateEl = document.getElementById('chg_tax_rate');
  const tax_rate = taxRateEl ? (parseFloat(taxRateEl.value) || 0) : 0;
  if (!amount || amount <= 0) return showToast('Enter a valid amount', true);
  try {
    await api.post(`/api/billing/folio/${folioId}/charge`, { charge_type, amount, description, tax_rate });
    showToast('Charge added');
    const data = await api.get(`/api/billing/folio/${folioId}`);
    renderFolioModal(folioId, '', data);
  } catch (e) { showToast(e.message, true); }
}

async function submitPayment(folioId) {
  const amount = parseFloat(document.getElementById('pay_amount').value);
  const mode = document.getElementById('pay_mode').value;
  const reference_number = document.getElementById('pay_ref').value.trim();
  if (!amount || amount <= 0) return showToast('Enter a valid amount', true);
  try {
    await api.post(`/api/billing/folio/${folioId}/payment`, { amount, mode, reference_number });
    showToast('Payment recorded');
    const data = await api.get(`/api/billing/folio/${folioId}`);
    renderFolioModal(folioId, '', data);
  } catch (e) { showToast(e.message, true); }
}

// ================= GUESTS =================
async function renderGuests() {
  setMain(`<div class="page-header">
      <div><h1>Guests</h1><div class="sub">Guest directory and stay history</div></div>
    </div>
    <div class="form-field" style="max-width:320px;">
      <input type="text" id="guestSearch" placeholder="Search by name, phone, email…">
    </div>
    <div id="guestTableWrap" style="margin-top:14px;"><div class="muted">Loading…</div></div>`);

  document.getElementById('guestSearch').addEventListener('input', debounce(() => {
    loadGuests(document.getElementById('guestSearch').value);
  }, 300));

  loadGuests('');
}

async function loadGuests(search) {
  const wrap = document.getElementById('guestTableWrap');
  try {
    const url = search ? `/api/guests?search=${encodeURIComponent(search)}` : '/api/guests';
    const guests = await api.get(url);
    if (guests.length === 0) {
      wrap.innerHTML = `<div class="empty-state">No guests found.</div>`;
      return;
    }
    wrap.innerHTML = `<div class="card" style="padding:0;">
      <table>
        <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>City</th><th>Company</th></tr></thead>
        <tbody>
          ${guests.map(g => `<tr style="cursor:pointer" onclick="openGuestDetail(${g.id})">
            <td><strong>${escapeHtml(g.full_name)}</strong></td>
            <td>${escapeHtml(g.phone || '—')}</td>
            <td>${escapeHtml(g.email || '—')}</td>
            <td>${escapeHtml(g.city || '—')}</td>
            <td>${escapeHtml(g.company_name || '—')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="muted">Could not load guests.</div>`;
  }
}

async function openGuestDetail(guestId) {
  showModal('Guest', '<div class="muted">Loading guest history…</div>', []);
  try {
    const g = await api.get(`/api/guests/${guestId}`);
    const history = g.reservation_history || [];

    const body = `
      <div class="flex-between" style="margin-bottom:2px;">
        <div style="font-family:var(--font-display);font-size:19px;font-weight:600;">${escapeHtml(g.full_name)}</div>
        ${g.vip_status ? `<span class="badge badge-warn">${escapeHtml(g.vip_status)}</span>` : ''}
      </div>
      <div class="muted" style="font-size:12.5px;margin-bottom:10px;">
        ${escapeHtml(g.phone || '—')} · ${escapeHtml(g.email || '—')}${g.company_name ? ' · ' + escapeHtml(g.company_name) : ''}
      </div>
      <div style="display:flex;gap:16px;margin-bottom:10px;font-size:12.5px;">
        <div><span class="muted">Loyalty Points:</span> <strong>${g.loyalty_points || 0}</strong></div>
        ${g.date_of_birth ? `<div><span class="muted">Birthday:</span> ${fmtDate(g.date_of_birth)}</div>` : ''}
        ${g.anniversary_date ? `<div><span class="muted">Anniversary:</span> ${fmtDate(g.anniversary_date)}</div>` : ''}
      </div>
      ${g.preferences ? `<div class="muted" style="font-size:12.5px;margin-bottom:10px;"><strong>Preferences:</strong> ${escapeHtml(g.preferences)}</div>` : ''}
      <button class="btn btn-outline btn-sm" onclick="openGuestEditModal(${g.id})" style="margin-bottom:14px;">Edit Guest Profile</button>
      <div class="divider"></div>
      <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:8px;">Stay History (${history.length})</div>
      ${history.length === 0 ? '<div class="muted" style="font-size:13px;">No reservations yet.</div>' : `
      <table><tbody>
        ${history.map(h => `<tr style="cursor:pointer" onclick="closeModal();openReservationDetail(${h.id})">
          <td>
            <span class="mono" style="font-size:12px;">${escapeHtml(h.booking_ref)}</span><br>
            <span class="muted" style="font-size:11.5px;">${fmtDate(h.arrival_date)} – ${fmtDate(h.departure_date)}</span>
          </td>
          <td>
            ${h.room_numbers ? `<strong>${escapeHtml(h.room_numbers)}</strong>` : '<span class="muted">unassigned</span>'}<br>
            <span class="muted" style="font-size:11.5px;">${escapeHtml(h.room_types || '')}</span>
          </td>
          <td>
            ${h.payment_modes ? escapeHtml(h.payment_modes).replace(/,/g, ', ').replace(/_/g, ' ') : '<span class="muted">no payment</span>'}<br>
            <span class="muted" style="font-size:11.5px;">${fmtMoney(h.total_paid)}</span>
          </td>
          <td><span class="badge ${RES_STATUS_BADGE[h.status] || 'badge-neutral'}">${h.status.replace('_',' ')}</span></td>
        </tr>`).join('')}
      </tbody></table>`}
    `;
    showModal('Guest Profile', body, [{ label: 'Close', cls: 'btn-outline', action: closeModal }]);
  } catch (e) {
    showModal('Guest', `<div class="muted">${escapeHtml(e.message)}</div>`, [{ label: 'Close', cls: 'btn-outline', action: closeModal }]);
  }
}

function openGuestEditModal(guestId) {
  api.get(`/api/guests/${guestId}`).then(g => {
    showModal('Edit Guest Profile', `
      <div class="form-grid">
        <div class="form-field"><label>VIP Status</label>
          <select id="ge_vip">
            <option value="" ${!g.vip_status ? 'selected' : ''}>None</option>
            <option value="VIP" ${g.vip_status === 'VIP' ? 'selected' : ''}>VIP</option>
            <option value="Corporate" ${g.vip_status === 'Corporate' ? 'selected' : ''}>Corporate</option>
            <option value="Repeat" ${g.vip_status === 'Repeat' ? 'selected' : ''}>Repeat</option>
          </select>
        </div>
        <div class="form-field"><label>Birthday</label><input id="ge_dob" type="date" value="${g.date_of_birth || ''}"></div>
        <div class="form-field"><label>Anniversary</label><input id="ge_anniv" type="date" value="${g.anniversary_date || ''}"></div>
        <div class="form-field span-2"><label>Preferences</label><input id="ge_pref" type="text" value="${escapeHtml(g.preferences || '')}" placeholder="e.g. High floor, non-smoking, extra pillow"></div>
      </div>
    `, [
      { label: 'Cancel', cls: 'btn-outline', action: closeModal },
      { label: 'Save', cls: 'btn-primary', action: async () => {
        const payload = {
          vip_status: document.getElementById('ge_vip').value || null,
          date_of_birth: document.getElementById('ge_dob').value || null,
          anniversary_date: document.getElementById('ge_anniv').value || null,
          preferences: document.getElementById('ge_pref').value.trim()
        };
        try {
          await api.put(`/api/guests/${guestId}`, payload);
          showToast('Guest profile updated');
          closeModal();
          openGuestDetail(guestId);
        } catch (e) { showToast(e.message, true); }
      }}
    ]);
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ================= GUEST REQUESTS =================
async function renderRequests() {
  setMain(`<div class="page-header"><div><h1>Guest Requests</h1><div class="sub">Housekeeping, food, laundry, and stay-extension requests from guests</div></div></div>
    <div class="tab-bar" id="reqTabs">
      ${['pending', 'in_progress', 'completed', 'cancelled', 'all'].map(s =>
        `<button class="tab-btn ${s === 'pending' ? 'active' : ''}" data-status="${s}">${s === 'all' ? 'All' : s.replace('_', ' ')}</button>`).join('')}
    </div>
    <div id="reqTableWrap"><div class="muted">Loading…</div></div>`);

  document.querySelectorAll('#reqTabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#reqTabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadRequestsTable(btn.dataset.status);
    });
  });
  loadRequestsTable('pending');
}

async function loadRequestsTable(status) {
  const wrap = document.getElementById('reqTableWrap');
  wrap.innerHTML = '<div class="muted">Loading…</div>';
  try {
    const url = status === 'all' ? '/api/service-requests' : `/api/service-requests?status=${status}`;
    const rows = await api.get(url);
    if (rows.length === 0) {
      wrap.innerHTML = '<div class="empty-state">No requests here.</div>';
      return;
    }
    wrap.innerHTML = `<div class="card" style="padding:0;">
      <table>
        <thead><tr><th>Type</th><th>Guest</th><th>Room</th><th>Details</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td><span class="badge badge-info">${r.request_type.replace('_',' ')}</span></td>
            <td><strong>${escapeHtml(r.guest_name)}</strong><br><span class="muted" style="font-size:11px;">${escapeHtml(r.booking_ref)}</span></td>
            <td>${escapeHtml(r.room_numbers || '—')}</td>
            <td style="max-width:220px;">${escapeHtml(r.details || '—')}</td>
            <td><span class="badge ${r.status === 'completed' ? 'badge-ok' : r.status === 'cancelled' ? 'badge-danger' : r.status === 'in_progress' ? 'badge-info' : 'badge-warn'}">${r.status.replace('_',' ')}</span></td>
            <td style="text-align:right;white-space:nowrap;">
              ${r.status === 'pending' ? `<button class="btn btn-outline btn-sm" onclick="updateRequestStatus(${r.id}, 'in_progress')">Start</button>` : ''}
              ${r.status !== 'completed' && r.status !== 'cancelled' ? `<button class="btn btn-brass btn-sm" onclick="updateRequestStatus(${r.id}, 'completed')">Complete</button>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="muted">${escapeHtml(e.message)}</div>`;
  }
}

async function updateRequestStatus(id, status) {
  try {
    await api.patch(`/api/service-requests/${id}`, { status });
    showToast('Request updated');
    const activeTab = document.querySelector('#reqTabs .tab-btn.active');
    loadRequestsTable(activeTab ? activeTab.dataset.status : 'pending');
  } catch (e) { showToast(e.message, true); }
}

// ================= CASH CLOSING =================
async function renderCashClosing() {
  setMain(`<div class="page-header"><div><h1>Cash Closing</h1><div class="sub">Daily payment reconciliation by mode</div></div></div>
    <div id="cashTodayWrap"><div class="muted">Loading…</div></div>
    <div class="card" style="margin:20px 0;">
      <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:10px;">Export to Tally</div>
      <div class="form-grid">
        <div class="form-field"><label>From</label><input id="tally_from" type="date"></div>
        <div class="form-field"><label>To</label><input id="tally_to" type="date"></div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="exportTally()">Download Tally XML</button>
    </div>
    <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:10px;">Closing History</div>
    <div id="cashHistoryWrap"><div class="muted">Loading…</div></div>`);

  const today = new Date().toISOString().slice(0, 10);
  setTimeout(() => {
    document.getElementById('tally_from').value = today;
    document.getElementById('tally_to').value = today;
  }, 0);

  loadCashToday(today);
  loadCashHistory();
}

async function loadCashToday(date) {
  const wrap = document.getElementById('cashTodayWrap');
  try {
    const data = await api.get(`/api/finance/day-summary?date=${date}`);
    const e = data.expected;
    wrap.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="label">Cash</div><div class="value">${fmtMoney(e.cash)}</div></div>
        <div class="stat-card"><div class="label">UPI</div><div class="value">${fmtMoney(e.upi)}</div></div>
        <div class="stat-card"><div class="label">Card</div><div class="value">${fmtMoney(e.card)}</div></div>
        <div class="stat-card"><div class="label">Bank Transfer</div><div class="value">${fmtMoney(e.bank_transfer)}</div></div>
      </div>
      <div class="card" style="max-width:420px;">
        ${data.already_closed ? `
          <div class="badge badge-ok" style="margin-bottom:10px;">Day already closed</div>
          <div style="font-size:13px;">Actual cash counted: <strong>${fmtMoney(data.closing.actual_cash)}</strong></div>
          <div style="font-size:13px;color:${Math.abs(data.closing.discrepancy) > 0.5 ? 'var(--danger)' : 'var(--ok)'};">Discrepancy: ${fmtMoney(data.closing.discrepancy)}</div>
        ` : `
          <div class="form-field"><label>Actual Cash Counted (₹)</label><input id="cc_actual" type="number" step="0.01" value="${e.cash}"></div>
          <div class="form-field"><label>Notes</label><input id="cc_notes" type="text" placeholder="optional"></div>
          <button class="btn btn-primary btn-sm" onclick="closeCashDay('${date}')">Close Day</button>
        `}
      </div>`;
  } catch (err) {
    wrap.innerHTML = `<div class="muted">${escapeHtml(err.message)}</div>`;
  }
}

async function closeCashDay(date) {
  const actual_cash = parseFloat(document.getElementById('cc_actual').value);
  const notes = document.getElementById('cc_notes').value.trim();
  if (isNaN(actual_cash)) return showToast('Enter the counted cash amount', true);
  try {
    const result = await api.post('/api/finance/close-day', { closing_date: date, actual_cash, notes });
    showToast(Math.abs(result.discrepancy) > 0.5 ? `Day closed — discrepancy of ${fmtMoney(result.discrepancy)}` : 'Day closed — cash matches');
    loadCashToday(date);
    loadCashHistory();
  } catch (e) { showToast(e.message, true); }
}

async function loadCashHistory() {
  const wrap = document.getElementById('cashHistoryWrap');
  try {
    const rows = await api.get('/api/finance/closings');
    if (rows.length === 0) { wrap.innerHTML = '<div class="muted">No closings yet.</div>'; return; }
    wrap.innerHTML = `<div class="card" style="padding:0;">
      <table>
        <thead><tr><th>Date</th><th>Cash</th><th>UPI</th><th>Card</th><th>Bank</th><th>Discrepancy</th><th>Closed By</th></tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td>${fmtDate(r.closing_date)}</td>
            <td>${fmtMoney(r.expected_cash)}</td>
            <td>${fmtMoney(r.expected_upi)}</td>
            <td>${fmtMoney(r.expected_card)}</td>
            <td>${fmtMoney(r.expected_bank_transfer)}</td>
            <td style="color:${Math.abs(r.discrepancy) > 0.5 ? 'var(--danger)' : 'var(--ok)'};">${fmtMoney(r.discrepancy)}</td>
            <td>${escapeHtml(r.closed_by_name || '—')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="muted">${escapeHtml(e.message)}</div>`;
  }
}

function exportTally() {
  const from = document.getElementById('tally_from').value;
  const to = document.getElementById('tally_to').value;
  if (!from || !to) return showToast('Pick both dates', true);
  window.open(`/api/finance/tally-export?from=${from}&to=${to}`, '_blank');
}

// ================= ANALYTICS =================
let occupancyChartInstance = null;
let roomTypeChartInstance = null;

async function renderAnalytics() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  setMain(`<div class="page-header"><div><h1>Analytics</h1><div class="sub">Occupancy, revenue, and booking performance</div></div></div>
    <div style="display:flex;gap:10px;align-items:flex-end;margin-bottom:20px;">
      <div class="form-field" style="margin-bottom:0;"><label>From</label><input id="an_from" type="date" value="${monthAgo}"></div>
      <div class="form-field" style="margin-bottom:0;"><label>To</label><input id="an_to" type="date" value="${today}"></div>
      <button class="btn btn-primary" onclick="loadAnalytics()">Update</button>
    </div>
    <div id="analyticsContent"><div class="muted">Loading…</div></div>`);

  loadAnalytics();
}

async function loadAnalytics() {
  const from = document.getElementById('an_from').value;
  const to = document.getElementById('an_to').value;
  const wrap = document.getElementById('analyticsContent');
  wrap.innerHTML = '<div class="muted">Loading…</div>';

  try {
    const data = await api.get(`/api/analytics/summary?from=${from}&to=${to}`);

    let multiPropertyHtml = '';
    if (currentUser.role === 'Admin') {
      try {
        const mp = await api.get(`/api/analytics/multi-property?from=${from}&to=${to}`);
        if (mp.properties.length > 1) {
          multiPropertyHtml = `
            <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin:24px 0 10px;">Multi-Property Comparison</div>
            <div class="card" style="padding:0;">
              <table>
                <thead><tr><th>Property</th><th>Rooms</th><th>ADR</th><th>RevPAR</th><th>Revenue</th><th>Bookings</th><th>Cancel %</th></tr></thead>
                <tbody>
                  ${mp.properties.map(p => `<tr>
                    <td><strong>${escapeHtml(p.property_name)}</strong><br><span class="muted" style="font-size:11px;">${escapeHtml(p.city || '')}</span></td>
                    <td>${p.total_rooms}</td>
                    <td>${fmtMoney(p.adr)}</td>
                    <td>${fmtMoney(p.revpar)}</td>
                    <td>${fmtMoney(p.total_room_revenue)}</td>
                    <td>${p.total_reservations}</td>
                    <td>${p.cancellation_pct}%</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>`;
        }
      } catch (e) { /* ignore */ }
    }

    wrap.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="label">ADR</div><div class="value">${fmtMoney(data.adr)}</div><div class="hint">avg. daily rate</div></div>
        <div class="stat-card"><div class="label">RevPAR</div><div class="value">${fmtMoney(data.revpar)}</div><div class="hint">revenue per available room</div></div>
        <div class="stat-card"><div class="label">Room Revenue</div><div class="value accent">${fmtMoney(data.total_room_revenue)}</div></div>
        <div class="stat-card"><div class="label">Cancellation Rate</div><div class="value">${data.cancellation_pct}%</div></div>
        <div class="stat-card"><div class="label">No-show Rate</div><div class="value">${data.no_show_pct}%</div></div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:10px;">Occupancy Trend</div>
        <canvas id="occupancyChart" height="80"></canvas>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div class="card">
          <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:10px;">Revenue by Room Type</div>
          <canvas id="roomTypeChart" height="140"></canvas>
        </div>
        <div class="card">
          <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:10px;">Booking Source</div>
          <table><tbody>
            ${data.source_breakdown.map(s => `<tr><td>${escapeHtml((s.source || 'unknown').replace('_',' '))}</td><td style="text-align:right;">${s.count}</td></tr>`).join('') || '<tr><td class="muted">No data</td></tr>'}
          </tbody></table>
        </div>
      </div>
      ${multiPropertyHtml}
    `;

    if (typeof Chart !== 'undefined') {
      if (occupancyChartInstance) occupancyChartInstance.destroy();
      if (roomTypeChartInstance) roomTypeChartInstance.destroy();

      const occCtx = document.getElementById('occupancyChart');
      occupancyChartInstance = new Chart(occCtx, {
        type: 'line',
        data: {
          labels: data.occupancy_trend.map(d => d.date.slice(5)),
          datasets: [{ label: 'Occupancy %', data: data.occupancy_trend.map(d => d.occupancy_pct), borderColor: '#0D3B3A', backgroundColor: 'rgba(13,59,58,0.08)', fill: true, tension: 0.3 }]
        },
        options: { plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } }
      });

      const rtCtx = document.getElementById('roomTypeChart');
      roomTypeChartInstance = new Chart(rtCtx, {
        type: 'bar',
        data: {
          labels: data.revenue_by_room_type.map(r => r.room_type_name),
          datasets: [{ label: 'Revenue', data: data.revenue_by_room_type.map(r => r.revenue), backgroundColor: '#B8925A' }]
        },
        options: { plugins: { legend: { display: false } } }
      });
    }
  } catch (e) {
    wrap.innerHTML = `<div class="muted">${escapeHtml(e.message)}</div>`;
  }
}

// ================= SETTINGS =================
async function renderSettings() {
  setMain(`<div class="page-header"><div><h1>Settings</h1><div class="sub">Property details, room categories, and room inventory</div></div></div>
    <div class="tab-bar" id="settingsTabs">
      <button class="tab-btn active" data-tab="property">Property</button>
      <button class="tab-btn" data-tab="roomtypes">Room Types &amp; Rates</button>
      <button class="tab-btn" data-tab="rooms">Rooms</button>
      <button class="tab-btn" data-tab="seasonal">Seasonal Rates</button>
      <button class="tab-btn" data-tab="revenue">Revenue Intelligence</button>
      <button class="tab-btn" data-tab="channels">Online Booking &amp; Channels</button>
      <button class="tab-btn" data-tab="license">License</button>
    </div>
    <div id="settingsContent"><div class="muted">Loading…</div></div>`);

  document.querySelectorAll('#settingsTabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#settingsTabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadSettingsTab(btn.dataset.tab);
    });
  });

  loadSettingsTab('property');
}

function loadSettingsTab(tab) {
  if (tab === 'property') renderPropertyTab();
  else if (tab === 'roomtypes') renderRoomTypesTab();
  else if (tab === 'rooms') renderRoomsTab();
  else if (tab === 'seasonal') renderSeasonalRatesTab();
  else if (tab === 'revenue') renderRevenueIntelligenceTab();
  else if (tab === 'channels') renderChannelsTab();
  else if (tab === 'license') renderLicenseTab();
}

// ---------- Property tab ----------
async function renderPropertyTab() {
  const wrap = document.getElementById('settingsContent');
  wrap.innerHTML = '<div class="muted">Loading…</div>';
  try {
    const p = await api.get('/api/property');
    wrap.innerHTML = `<div class="card" style="max-width:640px;">
      <div class="form-grid">
        <div class="form-field span-2"><label>Property Name *</label><input id="pp_name" type="text" value="${escapeHtml(p.name)}"></div>
        <div class="form-field span-2"><label>Address</label><input id="pp_address" type="text" value="${escapeHtml(p.address || '')}"></div>
        <div class="form-field"><label>City</label><input id="pp_city" type="text" value="${escapeHtml(p.city || '')}"></div>
        <div class="form-field"><label>State</label><input id="pp_state" type="text" value="${escapeHtml(p.state || '')}"></div>
        <div class="form-field"><label>Phone</label><input id="pp_phone" type="text" value="${escapeHtml(p.phone || '')}"></div>
        <div class="form-field"><label>Email</label><input id="pp_email" type="email" value="${escapeHtml(p.email || '')}"></div>
        <div class="form-field"><label>Check-in Time</label><input id="pp_checkin" type="text" value="${escapeHtml(p.checkin_time || '12:00')}"></div>
        <div class="form-field"><label>Check-out Time</label><input id="pp_checkout" type="text" value="${escapeHtml(p.checkout_time || '11:00')}"></div>
      </div>
      <div class="divider"></div>
      <div class="form-field">
        <label><input type="checkbox" id="pp_gst_registered" ${p.is_gst_registered ? 'checked' : ''} style="width:auto;margin-right:6px;"> Property is GST registered</label>
      </div>
      <div id="pp_gstinField" style="display:${p.is_gst_registered ? 'block' : 'none'};max-width:280px;">
        <div class="form-field"><label>GSTIN</label><input id="pp_gstin" type="text" value="${escapeHtml(p.gstin || '')}"></div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="savePropertyInfo()">Save Property Details</button>
    </div>`;
    setTimeout(() => {
      const chk = document.getElementById('pp_gst_registered');
      const field = document.getElementById('pp_gstinField');
      chk.addEventListener('change', () => { field.style.display = chk.checked ? 'block' : 'none'; });
    }, 0);
  } catch (e) {
    wrap.innerHTML = `<div class="muted">${escapeHtml(e.message)}</div>`;
  }
}

async function savePropertyInfo() {
  const payload = {
    name: document.getElementById('pp_name').value.trim(),
    address: document.getElementById('pp_address').value.trim(),
    city: document.getElementById('pp_city').value.trim(),
    state: document.getElementById('pp_state').value.trim(),
    phone: document.getElementById('pp_phone').value.trim(),
    email: document.getElementById('pp_email').value.trim(),
    checkin_time: document.getElementById('pp_checkin').value.trim(),
    checkout_time: document.getElementById('pp_checkout').value.trim(),
    is_gst_registered: document.getElementById('pp_gst_registered').checked
  };
  const gstinEl = document.getElementById('pp_gstin');
  if (gstinEl) payload.gstin = gstinEl.value.trim();
  if (!payload.name) return showToast('Property name is required', true);

  try {
    await api.put('/api/property', payload);
    propertyCache = await api.get('/api/property');
    document.getElementById('propertyTag').textContent = propertyCache.name;
    showToast('Property details saved');
  } catch (e) { showToast(e.message, true); }
}

// ---------- Room Types tab ----------
async function renderRoomTypesTab() {
  const wrap = document.getElementById('settingsContent');
  wrap.innerHTML = '<div class="muted">Loading…</div>';
  try {
    settingsRoomTypesCache = await api.get('/api/rooms/types');
    wrap.innerHTML = `
      <div class="flex-between" style="margin-bottom:14px;">
        <div class="muted" style="font-size:13px;">${settingsRoomTypesCache.length} room type(s)</div>
        <button class="btn btn-brass btn-sm" onclick="openRoomTypeModal()">+ Add Room Type</button>
      </div>
      <div class="card" style="padding:0;">
        <table>
          <thead><tr><th>Name</th><th>Base Rate</th><th>GST %</th><th>Max Occ.</th><th>Extra Bed</th><th></th></tr></thead>
          <tbody>
            ${settingsRoomTypesCache.map(t => `<tr>
              <td><strong>${escapeHtml(t.name)}</strong>${t.description ? '<br><span class="muted" style="font-size:11.5px;">' + escapeHtml(t.description) + '</span>' : ''}</td>
              <td>${fmtMoney(t.base_rate)}</td>
              <td>${t.gst_rate || 0}%</td>
              <td>${t.max_occupancy}</td>
              <td>${fmtMoney(t.extra_bed_rate)}</td>
              <td style="text-align:right;white-space:nowrap;">
                <button class="btn btn-outline btn-sm" onclick="openRoomTypeModal(${t.id})">Edit</button>
                <button class="btn btn-danger-outline btn-sm" onclick="deleteRoomType(${t.id})">Remove</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="muted">${escapeHtml(e.message)}</div>`;
  }
}

function openRoomTypeModal(id) {
  const existing = id ? settingsRoomTypesCache.find(t => t.id === id) : null;
  showModal(existing ? 'Edit Room Type' : 'Add Room Type', `
    <div class="form-grid">
      <div class="form-field span-2"><label>Name *</label><input id="rt_name" type="text" value="${existing ? escapeHtml(existing.name) : ''}"></div>
      <div class="form-field span-2"><label>Description</label><input id="rt_desc" type="text" value="${existing ? escapeHtml(existing.description || '') : ''}"></div>
      <div class="form-field"><label>Base Rate (₹/night) *</label><input id="rt_rate" type="number" step="0.01" value="${existing ? existing.base_rate : ''}"></div>
      <div class="form-field"><label>GST Rate %</label><input id="rt_gst" type="number" step="0.01" value="${existing ? (existing.gst_rate || 0) : 0}"></div>
      <div class="form-field"><label>Max Occupancy</label><input id="rt_occ" type="number" value="${existing ? existing.max_occupancy : 2}"></div>
      <div class="form-field"><label>Extra Bed Rate</label><input id="rt_extrabed" type="number" step="0.01" value="${existing ? existing.extra_bed_rate : 0}"></div>
    </div>
  `, [
    { label: 'Cancel', cls: 'btn-outline', action: closeModal },
    { label: existing ? 'Save Changes' : 'Add Room Type', cls: 'btn-primary', action: async () => {
      const payload = {
        name: document.getElementById('rt_name').value.trim(),
        description: document.getElementById('rt_desc').value.trim(),
        base_rate: parseFloat(document.getElementById('rt_rate').value),
        gst_rate: parseFloat(document.getElementById('rt_gst').value) || 0,
        max_occupancy: parseInt(document.getElementById('rt_occ').value) || 2,
        extra_bed_rate: parseFloat(document.getElementById('rt_extrabed').value) || 0
      };
      if (!payload.name || !payload.base_rate) return showToast('Name and base rate are required', true);
      try {
        if (existing) {
          await api.put(`/api/rooms/types/${existing.id}`, payload);
        } else {
          await api.post('/api/rooms/types', payload);
        }
        closeModal();
        showToast('Room type saved');
        roomTypesCache = await api.get('/api/rooms/types');
        renderRoomTypesTab();
      } catch (e) { showToast(e.message, true); }
    }}
  ]);
}

async function deleteRoomType(id) {
  if (!confirm('Remove this room type? Only possible if no active rooms still use it.')) return;
  try {
    await api.del(`/api/rooms/types/${id}`);
    showToast('Room type removed');
    roomTypesCache = await api.get('/api/rooms/types');
    renderRoomTypesTab();
  } catch (e) { showToast(e.message, true); }
}

// ---------- Rooms tab ----------
async function renderRoomsTab() {
  const wrap = document.getElementById('settingsContent');
  wrap.innerHTML = '<div class="muted">Loading…</div>';
  try {
    const [rooms, types] = await Promise.all([api.get('/api/rooms'), api.get('/api/rooms/types')]);
    settingsRoomsCache = rooms;
    settingsRoomTypesCache = types;
    wrap.innerHTML = `
      <div class="flex-between" style="margin-bottom:14px;">
        <div class="muted" style="font-size:13px;">${rooms.length} room(s)</div>
        <button class="btn btn-brass btn-sm" onclick="openRoomModal()">+ Add Room</button>
      </div>
      <div class="card" style="padding:0;">
        <table>
          <thead><tr><th>Room #</th><th>Floor</th><th>Type</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${rooms.map(r => `<tr>
              <td><strong>${escapeHtml(r.room_number)}</strong></td>
              <td>${escapeHtml(r.floor || '—')}</td>
              <td>${escapeHtml(r.room_type_name)}</td>
              <td><span class="status-pill" style="background:${legendColor(r.status)}22;color:${legendColor(r.status)};">${STATUS_LABELS[r.status] || r.status}</span></td>
              <td style="text-align:right;white-space:nowrap;">
                <button class="btn btn-outline btn-sm" onclick="openRoomModal(${r.id})">Edit</button>
                <button class="btn btn-danger-outline btn-sm" onclick="deleteRoom(${r.id})">Remove</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="muted">${escapeHtml(e.message)}</div>`;
  }
}

function openRoomModal(id) {
  const existing = id ? settingsRoomsCache.find(r => r.id === id) : null;
  const typeOptions = settingsRoomTypesCache.map(t =>
    `<option value="${t.id}" ${existing && existing.room_type_id === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');

  showModal(existing ? 'Edit Room' : 'Add Room', `
    <div class="form-grid">
      <div class="form-field"><label>Room Number *</label><input id="rm_number" type="text" value="${existing ? escapeHtml(existing.room_number) : ''}"></div>
      <div class="form-field"><label>Floor</label><input id="rm_floor" type="text" value="${existing ? escapeHtml(existing.floor || '') : ''}"></div>
      <div class="form-field span-2"><label>Room Type *</label><select id="rm_type">${typeOptions}</select></div>
    </div>
  `, [
    { label: 'Cancel', cls: 'btn-outline', action: closeModal },
    { label: existing ? 'Save Changes' : 'Add Room', cls: 'btn-primary', action: async () => {
      const payload = {
        room_number: document.getElementById('rm_number').value.trim(),
        floor: document.getElementById('rm_floor').value.trim(),
        room_type_id: parseInt(document.getElementById('rm_type').value)
      };
      if (!payload.room_number) return showToast('Room number is required', true);
      try {
        if (existing) {
          await api.put(`/api/rooms/${existing.id}`, payload);
        } else {
          await api.post('/api/rooms', payload);
        }
        closeModal();
        showToast('Room saved');
        renderRoomsTab();
      } catch (e) { showToast(e.message, true); }
    }}
  ]);
}

async function deleteRoom(id) {
  if (!confirm('Remove this room from active inventory?')) return;
  try {
    await api.del(`/api/rooms/${id}`);
    showToast('Room removed');
    renderRoomsTab();
  } catch (e) { showToast(e.message, true); }
}

// ---------- Seasonal Rates tab ----------
let settingsRatePlansCache = [];

async function renderSeasonalRatesTab() {
  const wrap = document.getElementById('settingsContent');
  wrap.innerHTML = '<div class="muted">Loading…</div>';
  try {
    [settingsRatePlansCache, settingsRoomTypesCache] = await Promise.all([
      api.get('/api/rate-plans'), api.get('/api/rooms/types')
    ]);
    wrap.innerHTML = `
      <p class="muted" style="font-size:13px;margin-bottom:14px;max-width:560px;">
        Set a special rate for a date range (festival season, weekends, an event in town). When a booking's
        arrival date falls inside a plan's range, that rate is suggested automatically instead of the base rate.
      </p>
      <div class="flex-between" style="margin-bottom:14px;">
        <div class="muted" style="font-size:13px;">${settingsRatePlansCache.length} active plan(s)</div>
        <button class="btn btn-brass btn-sm" onclick="openRatePlanModal()">+ Add Seasonal Rate</button>
      </div>
      <div class="card" style="padding:0;">
        <table>
          <thead><tr><th>Name</th><th>Room Type</th><th>Rate</th><th>Valid From</th><th>Valid To</th><th></th></tr></thead>
          <tbody>
            ${settingsRatePlansCache.map(p => `<tr>
              <td><strong>${escapeHtml(p.name)}</strong></td>
              <td>${escapeHtml(p.room_type_name)}</td>
              <td>${fmtMoney(p.rate)}</td>
              <td>${fmtDate(p.valid_from)}</td>
              <td>${fmtDate(p.valid_to)}</td>
              <td style="text-align:right;white-space:nowrap;">
                <button class="btn btn-outline btn-sm" onclick="openRatePlanModal(${p.id})">Edit</button>
                <button class="btn btn-danger-outline btn-sm" onclick="deleteRatePlan(${p.id})">Remove</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="6" class="muted">No seasonal rates set yet.</td></tr>'}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="muted">${escapeHtml(e.message)}</div>`;
  }
}

function openRatePlanModal(id) {
  const existing = id ? settingsRatePlansCache.find(p => p.id === id) : null;
  const typeOptions = settingsRoomTypesCache.map(t =>
    `<option value="${t.id}" ${existing && existing.room_type_id === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');

  showModal(existing ? 'Edit Seasonal Rate' : 'Add Seasonal Rate', `
    <div class="form-grid">
      <div class="form-field span-2"><label>Name *</label><input id="rp_name" type="text" value="${existing ? escapeHtml(existing.name) : ''}" placeholder="e.g. Diwali Season"></div>
      <div class="form-field span-2"><label>Room Type *</label><select id="rp_type">${typeOptions}</select></div>
      <div class="form-field"><label>Rate (₹/night) *</label><input id="rp_rate" type="number" step="0.01" value="${existing ? existing.rate : ''}"></div>
      <div class="form-field"><label>Valid From *</label><input id="rp_from" type="date" value="${existing ? existing.valid_from : ''}"></div>
      <div class="form-field"><label>Valid To *</label><input id="rp_to" type="date" value="${existing ? existing.valid_to : ''}"></div>
    </div>
  `, [
    { label: 'Cancel', cls: 'btn-outline', action: closeModal },
    { label: existing ? 'Save Changes' : 'Add Rate', cls: 'btn-primary', action: async () => {
      const payload = {
        name: document.getElementById('rp_name').value.trim(),
        room_type_id: parseInt(document.getElementById('rp_type').value),
        rate: parseFloat(document.getElementById('rp_rate').value),
        valid_from: document.getElementById('rp_from').value,
        valid_to: document.getElementById('rp_to').value
      };
      if (!payload.name || !payload.rate || !payload.valid_from || !payload.valid_to) {
        return showToast('All fields are required', true);
      }
      try {
        if (existing) {
          await api.put(`/api/rate-plans/${existing.id}`, payload);
        } else {
          await api.post('/api/rate-plans', payload);
        }
        closeModal();
        showToast('Seasonal rate saved');
        renderSeasonalRatesTab();
      } catch (e) { showToast(e.message, true); }
    }}
  ]);
}

async function deleteRatePlan(id) {
  if (!confirm('Remove this seasonal rate?')) return;
  try {
    await api.del(`/api/rate-plans/${id}`);
    showToast('Seasonal rate removed');
    renderSeasonalRatesTab();
  } catch (e) { showToast(e.message, true); }
}

// ---------- Revenue Intelligence tab ----------
async function renderRevenueIntelligenceTab() {
  const wrap = document.getElementById('settingsContent');
  wrap.innerHTML = '<div class="muted">Loading…</div>';
  try {
    const [suggData, competitorRates, addons] = await Promise.all([
      api.get('/api/revenue/suggestions?days=14'),
      api.get('/api/revenue/competitor-rates'),
      api.get('/api/revenue/addons')
    ]);
    const s = suggData.settings;

    wrap.innerHTML = `
      <div class="card" style="margin-bottom:20px;">
        <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:10px;">Pricing Rules</div>
        <div class="form-grid">
          <div class="form-field"><label>Weekend Multiplier (Fri/Sat)</label><input id="ri_weekend" type="number" step="0.01" value="${s.weekend_multiplier}"></div>
          <div class="form-field"><label>High Occupancy Threshold %</label><input id="ri_highthresh" type="number" step="1" value="${s.high_occ_threshold}"></div>
          <div class="form-field"><label>High Occupancy Rate Bump %</label><input id="ri_highbump" type="number" step="1" value="${s.high_occ_bump_pct}"></div>
          <div class="form-field"><label>Low Occupancy Threshold %</label><input id="ri_lowthresh" type="number" step="1" value="${s.low_occ_threshold}"></div>
          <div class="form-field"><label>Low Occupancy Discount %</label><input id="ri_lowdisc" type="number" step="1" value="${s.low_occ_discount_pct}"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="saveRevenueSettings()">Save Rules</button>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="flex-between" style="margin-bottom:10px;">
          <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;">Pricing Suggestions (next 14 days)</div>
        </div>
        ${suggData.suggestions.length === 0 ? '<div class="muted" style="font-size:13px;">No suggestions right now — occupancy is within your normal range.</div>' : `
        <table><tbody>
          ${suggData.suggestions.map(sg => `<tr>
            <td>${fmtDate(sg.date)}${sg.is_weekend ? ' <span class="badge badge-info">weekend</span>' : ''}</td>
            <td>${escapeHtml(sg.room_type_name)}</td>
            <td class="muted" style="font-size:11.5px;">${escapeHtml(sg.reason)}</td>
            <td>${fmtMoney(sg.current_rate)} → <strong>${fmtMoney(sg.suggested_rate)}</strong></td>
            <td style="text-align:right;"><button class="btn btn-brass btn-sm" onclick='applyPricingSuggestion(${sg.room_type_id}, "${sg.date}", ${sg.suggested_rate}, "${escapeHtml(sg.reason).replace(/"/g,'')}")'>Apply</button></td>
          </tr>`).join('')}
        </tbody></table>`}
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="flex-between" style="margin-bottom:10px;">
          <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;">Competitor Rates (manual)</div>
          <button class="btn btn-outline btn-sm" onclick="openCompetitorRateModal()">+ Log a Rate</button>
        </div>
        ${competitorRates.length === 0 ? '<div class="muted" style="font-size:13px;">No competitor rates logged yet.</div>' : `
        <table><tbody>
          ${competitorRates.slice(0, 10).map(cr => `<tr>
            <td>${fmtDate(cr.rate_date)}</td>
            <td>${escapeHtml(cr.competitor_name)}</td>
            <td>${cr.room_type_name ? escapeHtml(cr.room_type_name) : '<span class="muted">Any</span>'}</td>
            <td>${fmtMoney(cr.rate)}</td>
            <td style="text-align:right;"><button class="btn btn-danger-outline btn-sm" onclick="deleteCompetitorRate(${cr.id})">Remove</button></td>
          </tr>`).join('')}
        </tbody></table>`}
      </div>

      <div class="card">
        <div class="flex-between" style="margin-bottom:10px;">
          <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;">Upsell Add-ons Catalog</div>
          <button class="btn btn-brass btn-sm" onclick="openAddonModal()">+ Add Item</button>
        </div>
        ${addons.length === 0 ? '<div class="muted" style="font-size:13px;">No add-ons yet — e.g. Airport Pickup, Breakfast, Late Checkout.</div>' : `
        <table><tbody>
          ${addons.map(a => `<tr>
            <td><strong>${escapeHtml(a.name)}</strong>${a.description ? '<br><span class="muted" style="font-size:11px;">'+escapeHtml(a.description)+'</span>' : ''}</td>
            <td>${fmtMoney(a.price)}</td>
            <td>${a.tax_rate || 0}% GST</td>
            <td style="text-align:right;">
              <button class="btn btn-outline btn-sm" onclick="openAddonModal(${a.id})">Edit</button>
              <button class="btn btn-danger-outline btn-sm" onclick="deleteAddon(${a.id})">Remove</button>
            </td>
          </tr>`).join('')}
        </tbody></table>`}
      </div>`;

    window.__addonsCache = addons;
    window.__competitorRatesCache = competitorRates;
  } catch (e) {
    wrap.innerHTML = `<div class="muted">${escapeHtml(e.message)}</div>`;
  }
}

async function saveRevenueSettings() {
  const payload = {
    weekend_multiplier: parseFloat(document.getElementById('ri_weekend').value) || 1,
    high_occ_threshold: parseFloat(document.getElementById('ri_highthresh').value) || 80,
    high_occ_bump_pct: parseFloat(document.getElementById('ri_highbump').value) || 0,
    low_occ_threshold: parseFloat(document.getElementById('ri_lowthresh').value) || 30,
    low_occ_discount_pct: parseFloat(document.getElementById('ri_lowdisc').value) || 0
  };
  try {
    await api.put('/api/revenue/settings', payload);
    showToast('Pricing rules saved');
    renderRevenueIntelligenceTab();
  } catch (e) { showToast(e.message, true); }
}

async function applyPricingSuggestion(roomTypeId, date, rate, reason) {
  try {
    await api.post('/api/revenue/apply-suggestion', { room_type_id: roomTypeId, date, rate, reason });
    showToast(`Rate applied for ${fmtDate(date)}`);
    renderRevenueIntelligenceTab();
  } catch (e) { showToast(e.message, true); }
}

function openCompetitorRateModal() {
  const typeOptions = '<option value="">Any room type</option>' + settingsRoomTypesCache.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  showModal('Log Competitor Rate', `
    <div class="form-grid">
      <div class="form-field span-2"><label>Competitor Name *</label><input id="cr_name" type="text" placeholder="e.g. Hotel XYZ on Booking.com"></div>
      <div class="form-field"><label>Room Type</label><select id="cr_type">${typeOptions}</select></div>
      <div class="form-field"><label>Rate *</label><input id="cr_rate" type="number" step="0.01"></div>
      <div class="form-field span-2"><label>Date Observed *</label><input id="cr_date" type="date"></div>
    </div>
  `, [
    { label: 'Cancel', cls: 'btn-outline', action: closeModal },
    { label: 'Save', cls: 'btn-primary', action: async () => {
      const payload = {
        competitor_name: document.getElementById('cr_name').value.trim(),
        room_type_id: document.getElementById('cr_type').value || null,
        rate: parseFloat(document.getElementById('cr_rate').value),
        rate_date: document.getElementById('cr_date').value
      };
      if (!payload.competitor_name || !payload.rate || !payload.rate_date) return showToast('All required fields must be filled', true);
      try {
        await api.post('/api/revenue/competitor-rates', payload);
        closeModal();
        showToast('Competitor rate logged');
        renderRevenueIntelligenceTab();
      } catch (e) { showToast(e.message, true); }
    }}
  ]);
  setTimeout(() => { document.getElementById('cr_date').value = new Date().toISOString().slice(0, 10); }, 0);
}

async function deleteCompetitorRate(id) {
  try {
    await api.del(`/api/revenue/competitor-rates/${id}`);
    showToast('Removed');
    renderRevenueIntelligenceTab();
  } catch (e) { showToast(e.message, true); }
}

function openAddonModal(id) {
  const existing = id ? (window.__addonsCache || []).find(a => a.id === id) : null;
  showModal(existing ? 'Edit Add-on' : 'Add Upsell Item', `
    <div class="form-grid">
      <div class="form-field span-2"><label>Name *</label><input id="ad_name" type="text" value="${existing ? escapeHtml(existing.name) : ''}" placeholder="e.g. Airport Pickup"></div>
      <div class="form-field span-2"><label>Description</label><input id="ad_desc" type="text" value="${existing ? escapeHtml(existing.description || '') : ''}"></div>
      <div class="form-field"><label>Price *</label><input id="ad_price" type="number" step="0.01" value="${existing ? existing.price : ''}"></div>
      <div class="form-field"><label>GST %</label><input id="ad_tax" type="number" step="0.01" value="${existing ? (existing.tax_rate || 0) : 0}"></div>
    </div>
  `, [
    { label: 'Cancel', cls: 'btn-outline', action: closeModal },
    { label: existing ? 'Save Changes' : 'Add Item', cls: 'btn-primary', action: async () => {
      const payload = {
        name: document.getElementById('ad_name').value.trim(),
        description: document.getElementById('ad_desc').value.trim(),
        price: parseFloat(document.getElementById('ad_price').value),
        tax_rate: parseFloat(document.getElementById('ad_tax').value) || 0
      };
      if (!payload.name || !payload.price) return showToast('Name and price are required', true);
      try {
        if (existing) { await api.put(`/api/revenue/addons/${existing.id}`, payload); }
        else { await api.post('/api/revenue/addons', payload); }
        closeModal();
        showToast('Add-on saved');
        renderRevenueIntelligenceTab();
      } catch (e) { showToast(e.message, true); }
    }}
  ]);
}

async function deleteAddon(id) {
  if (!confirm('Remove this add-on from the catalog?')) return;
  try {
    await api.del(`/api/revenue/addons/${id}`);
    showToast('Add-on removed');
    renderRevenueIntelligenceTab();
  } catch (e) { showToast(e.message, true); }
}

// ---------- Online Booking & Channels tab ----------
async function renderChannelsTab() {
  const wrap = document.getElementById('settingsContent');
  wrap.innerHTML = '<div class="muted">Loading…</div>';
  try {
    const [property, types, calendars] = await Promise.all([
      api.get('/api/property'), api.get('/api/rooms/types'), api.get('/api/external-calendars')
    ]);
    settingsRoomTypesCache = types;

    const bookingUrl = `${window.location.origin}/book.html?code=${encodeURIComponent(property.code)}`;

    wrap.innerHTML = `
      <div class="card" style="margin-bottom:20px;">
        <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:8px;">Direct Booking Page</div>
        <p class="muted" style="font-size:13px;margin-bottom:10px;">
          Share this link, or embed it as an iframe on your website, so guests can book directly without an OTA commission.
        </p>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="text" readonly value="${escapeHtml(bookingUrl)}" style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:var(--radius);font-family:var(--font-mono);font-size:12px;" onclick="this.select()">
          <button class="btn btn-outline btn-sm" onclick="window.open('${bookingUrl}', '_blank')">Open</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:8px;">Export Calendar (block dates on OTAs)</div>
        <p class="muted" style="font-size:13px;margin-bottom:10px;">
          Paste one of these links into Booking.com, Airbnb, or Google Calendar's "import calendar" field for the matching room type,
          so rooms booked here get blocked there too.
        </p>
        ${types.map(t => `
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
            <span style="font-size:12.5px;min-width:110px;">${escapeHtml(t.name)}</span>
            <input type="text" readonly value="${window.location.origin}/api/public/ical/${t.id}.ics?token=${escapeHtml(property.ical_token || '')}" style="flex:1;padding:6px 9px;border:1px solid var(--line);border-radius:var(--radius);font-family:var(--font-mono);font-size:11px;" onclick="this.select()">
          </div>`).join('')}
      </div>

      <div class="card">
        <div class="flex-between" style="margin-bottom:10px;">
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;">Import Calendars (block OTA-booked dates here)</div>
            <p class="muted" style="font-size:13px;margin-top:4px;">Subscribe to an OTA's iCal export URL for a room type — new bookings there get blocked here on Sync.</p>
          </div>
          <button class="btn btn-brass btn-sm" onclick="openAddCalendarModal()">+ Add Calendar</button>
        </div>
        ${calendars.length === 0 ? '<div class="muted" style="font-size:13px;">No external calendars connected yet.</div>' : `
        <table><tbody>
          ${calendars.map(c => `<tr>
            <td><strong>${escapeHtml(c.name)}</strong><br><span class="muted" style="font-size:11px;">${escapeHtml(c.room_type_name)}</span></td>
            <td>
              ${c.last_synced_at ? `<span class="badge ${c.last_sync_status === 'ok' ? 'badge-ok' : 'badge-danger'}">${c.last_sync_status === 'ok' ? 'Synced' : 'Error'}</span><br><span class="muted" style="font-size:11px;">${fmtDate(c.last_synced_at)}</span>` : '<span class="badge badge-neutral">Never synced</span>'}
            </td>
            <td style="text-align:right;white-space:nowrap;">
              <button class="btn btn-outline btn-sm" onclick="syncExternalCalendar(${c.id})">Sync Now</button>
              <button class="btn btn-danger-outline btn-sm" onclick="deleteExternalCalendar(${c.id})">Remove</button>
            </td>
          </tr>`).join('')}
        </tbody></table>`}
      </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="muted">${escapeHtml(e.message)}</div>`;
  }
}

function openAddCalendarModal() {
  const typeOptions = settingsRoomTypesCache.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  showModal('Add External Calendar', `
    <div class="form-grid">
      <div class="form-field span-2"><label>Name *</label><input id="ec_name" type="text" placeholder="e.g. Booking.com - Deluxe"></div>
      <div class="form-field span-2"><label>Room Type *</label><select id="ec_type">${typeOptions}</select></div>
      <div class="form-field span-2"><label>iCal URL *</label><input id="ec_url" type="text" placeholder="https://..."></div>
    </div>
  `, [
    { label: 'Cancel', cls: 'btn-outline', action: closeModal },
    { label: 'Add Calendar', cls: 'btn-primary', action: async () => {
      const payload = {
        name: document.getElementById('ec_name').value.trim(),
        room_type_id: parseInt(document.getElementById('ec_type').value),
        ical_url: document.getElementById('ec_url').value.trim()
      };
      if (!payload.name || !payload.ical_url) return showToast('Name and iCal URL are required', true);
      try {
        await api.post('/api/external-calendars', payload);
        closeModal();
        showToast('Calendar added — click Sync Now to pull in bookings');
        renderChannelsTab();
      } catch (e) { showToast(e.message, true); }
    }}
  ]);
}

async function syncExternalCalendar(id) {
  showToast('Syncing…');
  try {
    const result = await api.post(`/api/external-calendars/${id}/sync`);
    showToast(`Synced: ${result.created} new block(s), ${result.skipped} already known`);
    renderChannelsTab();
  } catch (e) { showToast(e.message, true); }
}

async function deleteExternalCalendar(id) {
  if (!confirm('Stop syncing this calendar?')) return;
  try {
    await api.del(`/api/external-calendars/${id}`);
    showToast('Calendar removed');
    renderChannelsTab();
  } catch (e) { showToast(e.message, true); }
}

// ---------- License tab ----------
async function renderLicenseTab() {
  const wrap = document.getElementById('settingsContent');
  wrap.innerHTML = '<div class="muted">Loading…</div>';
  try {
    const status = await api.get('/api/license/status');
    wrap.innerHTML = `
      <div class="card" style="max-width:520px;">
        ${status.licensed ? `
          <div class="badge badge-ok" style="margin-bottom:12px;">Licensed</div>
          <div style="font-size:13px;margin-bottom:4px;">Licensed to: <strong>${escapeHtml(status.licensedTo || '—')}</strong></div>
          <div style="font-size:13px;margin-bottom:16px;">${status.validUntil ? 'Valid until ' + fmtDate(status.validUntil) : 'Perpetual license — no expiry'}</div>
        ` : status.inTrial ? `
          <div class="badge badge-warn" style="margin-bottom:12px;">Trial — ${status.trialDaysRemaining} day${status.trialDaysRemaining === 1 ? '' : 's'} remaining</div>
        ` : `
          <div class="badge badge-danger" style="margin-bottom:12px;">Trial expired</div>
        `}
        <div class="divider"></div>
        <div style="font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:6px;">Installation ID</div>
        <div class="mono" style="font-size:12.5px;background:var(--teal-100);padding:10px 12px;border-radius:var(--radius);word-break:break-all;margin-bottom:8px;" onclick="this.focus()">${escapeHtml(status.fingerprint)}</div>
        <p class="muted" style="font-size:12.5px;margin-bottom:16px;">Send this ID to your vendor to receive a license key for this installation.</p>

        <div class="form-field"><label>License Key</label><textarea id="lic_key" rows="3" placeholder="Paste license key here"></textarea></div>
        <button class="btn btn-primary btn-sm" onclick="activateLicenseFromSettings()">Activate</button>
      </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="muted">${escapeHtml(e.message)}</div>`;
  }
}

async function activateLicenseFromSettings() {
  const key = document.getElementById('lic_key').value.trim();
  if (!key) return showToast('Paste a license key first', true);
  try {
    const result = await api.post('/api/license/activate', { license_key: key });
    showToast(`License activated${result.licensedTo ? ' for ' + result.licensedTo : ''}`);
    document.getElementById('trialBanner').style.display = 'none';
    renderLicenseTab();
  } catch (e) { showToast(e.message, true); }
}

// ================= MODAL SYSTEM =================
function showModal(title, bodyHtml, buttons) {
  const footer = (buttons || []).map((b, i) =>
    `<button class="btn ${b.cls}" data-btn-idx="${i}">${escapeHtml(b.label)}</button>`).join('');

  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal">
        <div class="modal-header"><h3>${escapeHtml(title)}</h3><span class="modal-close" onclick="closeModal()">&times;</span></div>
        <div class="modal-body">${bodyHtml}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    </div>`;

  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });

  (buttons || []).forEach((b, i) => {
    const el = document.querySelector(`[data-btn-idx="${i}"]`);
    if (el) el.addEventListener('click', b.action);
  });
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}
