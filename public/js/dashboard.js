let currentUser = null;

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
  document.getElementById('highlight-district').textContent = user.district;
  document.getElementById('highlight-voter-id').textContent = `ID: ${user.voter_id_number}`;

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
  
  const otherElections = filtered.filter(e => 
    !(e.eligible_states || []).includes(currentUser.state)
  );

  noState.classList.toggle('hidden', myStateElections.length > 0);
  
  const renderCard = (e) => {
    const statusBadge = {
      active:   '<span class="badge badge-active">🟢 Active</span>',
      upcoming: '<span class="badge badge-upcoming">🟡 Upcoming</span>',
      closed:   '<span class="badge badge-closed">⚫ Closed</span>',
    }[e.status] || '';

    const votedBadge = e.has_voted ? '<span class="badge badge-voted">✅ Voted</span>' : '';

    const actionBtn = (() => {
      if (e.status === 'active' && !e.has_voted) return `<a href="/vote.html?election=${e.id}" class="btn btn-primary">🗳️ Vote Now</a>`;
      if (e.has_voted) return `<a href="/vote.html?election=${e.id}" class="btn btn-ghost btn-sm">View Receipt</a>`;
      if (e.status === 'closed') return `<a href="/results.html?election=${e.id}" class="btn btn-ghost btn-sm">📊 Results</a>`;
      return `<button class="btn btn-ghost btn-sm" disabled>⏳ Not Yet Open</button>`;
    })();

    // Swap title with election_type and show original title below
    const mainTitle = e.election_type || 'General Election';
    const subTitle = e.title;

    return `
      <div class="election-card ${e.status === 'active' ? 'active-election' : ''}">
        <div class="election-card-header">
          <div>
            <div class="election-title" style="font-size:20px; color:var(--text-primary);">${mainTitle}</div>
            <div style="font-size:12px; color:var(--text-secondary); font-weight:600; text-transform:uppercase; margin-top:2px;">${subTitle}</div>
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
        <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
          ${!e.eligible_states || e.eligible_states.length === 0 
            ? '<span class="badge badge-active" style="background:var(--blue-glass); border-color:var(--blue); font-size:10px;">🌐 National</span>' 
            : `<span class="badge badge-upcoming" style="background:var(--gold-glass); border-color:var(--gold); font-size:10px;">📍 ${e.eligible_states.join(', ')}</span>`}
          ${actionBtn}
        </div>
      </div>
    `;
  };

  stateGrid.innerHTML = myStateElections.map(renderCard).join('');
  otherGrid.innerHTML = otherElections.map(renderCard).join('');
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
