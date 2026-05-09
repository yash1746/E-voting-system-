// Dashboard page logic
let allElections = [];
let currentFilter = 'all';

async function init() {
  const user = await Auth.requireAuth();
  if (!user) return;

  initNavbar('dashboard');

  // Wire logout button
  document.getElementById('dash-logout-btn')
    ?.addEventListener('click', () => Auth.logout());

  // Fill voter info
  document.getElementById('voter-name').textContent = user.full_name.split(' ')[0];
  document.getElementById('voter-meta').textContent = `${user.voter_id_number} · ${user.district}, ${user.state}`;
  document.getElementById('voter-id-display').textContent = user.voter_id_number;
  document.getElementById('voter-district').textContent = user.district;
  document.getElementById('voter-state').textContent = user.state;
  document.getElementById('voter-card').style.display = 'block';

  await loadElections();
}

async function loadElections() {
  try {
    const data = await api.get('/elections');
    allElections = data.elections || [];
    updateStats();
    renderElections();
    document.getElementById('elections-loading').style.display = 'none';
    document.getElementById('elections-grid').style.display = 'grid';
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
  const grid = document.getElementById('elections-grid');
  const noEl = document.getElementById('no-elections');
  const filtered = currentFilter === 'all'
    ? allElections
    : allElections.filter(e => e.status === currentFilter);

  if (!filtered.length) {
    grid.innerHTML = '';
    noEl.classList.remove('hidden');
    return;
  }
  noEl.classList.add('hidden');

  grid.innerHTML = filtered.map(e => {
    const statusBadge = {
      active:   '<span class="badge badge-active">🟢 Active</span>',
      upcoming: '<span class="badge badge-upcoming">🟡 Upcoming</span>',
      closed:   '<span class="badge badge-closed">⚫ Closed</span>',
    }[e.status] || '';

    const votedBadge = e.has_voted
      ? '<span class="badge badge-voted">✅ Voted</span>'
      : '';

    const actionBtn = (() => {
      if (e.status === 'active' && !e.has_voted) {
        return `<a href="/vote.html?election=${e.id}" class="btn btn-primary">🗳️ Vote Now</a>`;
      }
      if (e.has_voted) {
        return `<a href="/vote.html?election=${e.id}" class="btn btn-ghost btn-sm">View Receipt</a>`;
      }
      if (e.status === 'closed') {
        return `<a href="/results.html?election=${e.id}" class="btn btn-ghost btn-sm">📊 Results</a>`;
      }
      return `<button class="btn btn-ghost btn-sm" disabled>⏳ Not Yet Open</button>`;
    })();

    return `
      <div class="election-card ${e.status === 'active' ? 'active-election' : ''}">
        <div class="election-card-header">
          <div class="election-title">${e.title}</div>
          <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
            ${statusBadge}
            ${votedBadge}
          </div>
        </div>
        <div class="election-desc">${(e.description || '').slice(0, 120)}${e.description?.length > 120 ? '…' : ''}</div>
        <div class="election-meta">
          <span>🏛️ ${e.candidate_count} candidates</span>
          <span>📅 ${formatDate(e.end_date)}</span>
          ${e.status === 'active' ? `<span style="color:var(--green);">⏱ ${timeUntil(e.end_date)}</span>` : ''}
        </div>
        <div class="election-actions">${actionBtn}</div>
      </div>
    `;
  }).join('');
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
