let currentUser = null;
let allElections = [];
let currentFilter = 'all';
let otherStateFilter = 'all';

async function init() {
  const user = await Auth.requireAuth();
  if (!user) return;
  currentUser = user;

  initNavbar('dashboard');

  // Wire logout button
  document.getElementById('dash-logout-btn')
    ?.addEventListener('click', () => Auth.logout());

  // Fill voter info
  document.getElementById('highlight-state').textContent = user.state.toUpperCase();
  document.getElementById('highlight-district').textContent = `${user.district} · ${user.constituency || 'No Constituency'}`;
  document.getElementById('highlight-voter-id').textContent = `ID: ${user.voter_id_number}`;

  // Other state filter listener
  document.getElementById('other-state-filter')?.addEventListener('change', (e) => {
    otherStateFilter = e.target.value;
    renderElections();
  });

  await loadElections();
}

async function loadElections() {
  try {
    const data = await api.get('/elections');
    allElections = data.elections || [];
    updateStats();
    renderElections();
    document.getElementById('elections-loading').style.display = 'none';
    document.getElementById('state-elections-grid').style.display = 'grid';
  } catch (err) {
    document.getElementById('elections-loading').innerHTML = `
      <div class="alert alert-error"><span class="alert-icon">⚠️</span>${err.message}</div>
    `;
  }
}

function updateStats() {
  const active   = allElections.filter(e => e.status === 'active').length;
  const upcoming = allElections.filter(e => e.status === 'upcoming').length;
  const closed   = allElections.filter(e => e.status === 'closed').length;
  const voted    = allElections.filter(e => e.has_voted).length;

  animateCount(document.getElementById('stat-active'),   active,   800);
  animateCount(document.getElementById('stat-voted'),    voted,    800);
  animateCount(document.getElementById('stat-upcoming'), upcoming, 800);
  animateCount(document.getElementById('stat-closed'),   closed,   800);
}

function renderElections() {
  const stateGrid = document.getElementById('state-elections-grid');
  const otherGrid = document.getElementById('other-elections-grid');
  const noState   = document.getElementById('no-state-elections');

  const filtered = currentFilter === 'all'
    ? allElections
    : allElections.filter(e => e.status === currentFilter);

  // Split elections
  const myStateElections = filtered.filter(e => 
    (e.eligible_states || []).includes(currentUser.state)
  );
  
  let otherElections = filtered.filter(e => 
    !(e.eligible_states || []).includes(currentUser.state)
  );

  // Apply other state filter
  if (otherStateFilter !== 'all') {
    if (otherStateFilter === 'National') {
      otherElections = otherElections.filter(e => !e.eligible_states || e.eligible_states.length === 0);
    } else {
      otherElections = otherElections.filter(e => (e.eligible_states || []).includes(otherStateFilter));
    }
  }

  noState.classList.toggle('hidden', myStateElections.length > 0);
  
  const renderCard = (e, isMyState) => {
    const isAnnounced = e.results_announced === true;
    const statusBadge = (() => {
      if (e.status === 'active') return '<span class="badge badge-active">🟢 Active</span>';
      if (e.status === 'upcoming') return '<span class="badge badge-upcoming">🟡 Upcoming</span>';
      if (e.status === 'closed') {
        return isAnnounced 
          ? '<span class="badge badge-closed" style="background:rgba(239, 68, 68, 0.1); border-color:var(--red); color:var(--red); animation: pulse-red 2s infinite; font-weight:700;">🔴 Results Out</span>'
          : '<span class="badge badge-closed">⚫ Closed</span>';
      }
      return '';
    })();

    const votedBadge = e.has_voted ? '<span class="badge badge-voted">✅ Voted</span>' : '';

    const actionBtn = (() => {
      // ONLY allow voting if it's the voter's state
      if (isMyState) {
        if (e.status === 'active' && !e.has_voted) return `<a href="/vote.html?election=${e.id}" class="btn btn-primary">🗳️ Vote Now</a>`;
        if (e.has_voted) {
          if (e.status === 'closed') {
            return isAnnounced 
              ? `<a href="/results.html?election=${e.id}" class="btn btn-ghost btn-sm">📊 Results</a>`
              : `<button class="btn btn-ghost btn-sm" disabled style="opacity:0.6; cursor:not-allowed;">⏳ Results Awaited</button>`;
          }
          return `<a href="/vote.html?election=${e.id}" class="btn btn-ghost btn-sm">View Receipt</a>`;
        }
      } else {
        // For other states, only allow viewing info/results
        if (e.status === 'closed') {
          return isAnnounced 
            ? `<a href="/results.html?election=${e.id}" class="btn btn-ghost btn-sm">📊 Results</a>`
            : `<button class="btn btn-ghost btn-sm" disabled style="opacity:0.6; cursor:not-allowed;">⏳ Results Awaited</button>`;
        }
        return `<button class="btn btn-ghost btn-sm" onclick="showInfo('${e.id}')">ℹ️ View Info</button>`;
      }
      if (e.status === 'closed') {
        return isAnnounced 
          ? `<a href="/results.html?election=${e.id}" class="btn btn-ghost btn-sm">📊 Results</a>`
          : `<button class="btn btn-ghost btn-sm" disabled style="opacity:0.6; cursor:not-allowed;">⏳ Results Awaited</button>`;
      }
      return `<button class="btn btn-ghost btn-sm" disabled>⏳ Not Yet Open</button>`;
    })();

    const mainTitle = e.election_type || 'General Election';
    const subTitle = e.title;

    return `
      <div class="election-card ${e.status === 'active' ? 'active-election' : ''}">
        <div class="election-card-header">
          <div>
            <div class="election-title" style="font-size:20px; color:var(--text-primary);">${mainTitle}</div>
            <div style="font-size:11px; color:var(--text-secondary); font-weight:600; text-transform:uppercase; margin-top:2px;">${subTitle}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
            ${statusBadge}
            ${votedBadge}
          </div>
        </div>
        <div class="election-desc">${(e.description || '').slice(0, 100)}${e.description?.length > 100 ? '…' : ''}</div>
        <div class="election-meta">
          <span>🏛️ ${e.candidate_count} candidates</span>
          <span>📅 ${formatDate(e.end_date)}</span>
        </div>
        <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
          ${!e.eligible_states || e.eligible_states.length === 0 
            ? '<span class="badge badge-active" style="background:var(--blue-glass); border-color:var(--blue); font-size:10px;">🌐 National</span>' 
            : `<span class="badge badge-upcoming" style="background:var(--gold-glass); border-color:var(--gold); font-size:10px;">📍 ${e.eligible_states[0]}${e.eligible_states.length > 1 ? '...' : ''}</span>`}
          <div style="flex-grow:1; display:flex; justify-content:flex-end;">${actionBtn}</div>
        </div>
      </div>
    `;
  };

  stateGrid.innerHTML = myStateElections.map(e => renderCard(e, true)).join('');
  otherGrid.innerHTML = otherElections.map(e => renderCard(e, false)).join('');
}

function showInfo(id) {
  // Redirect to vote page but it will be in view-only mode if not eligible
  window.location.href = `/vote.html?election=${id}&info=true`;
}

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderElections();
  });
});

init();
