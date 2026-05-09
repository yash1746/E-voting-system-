// Admin panel logic
let currentSection = 'elections';

document.addEventListener('DOMContentLoaded', () => {
  // Wire all static button listeners immediately once DOM is ready
  document.getElementById('create-election-form')
    ?.addEventListener('submit', handleCreateElection);
  document.getElementById('add-voter-form')
    ?.addEventListener('submit', handleAddVoter);

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });

  init();
});

async function init() {
  const user = await Auth.requireAdmin();
  if (!user) return;

  initNavbar();

  // Admin navbar logout
  const authArea = document.getElementById('navbar-auth');
  if (authArea) {
    authArea.innerHTML = `
      <span class="text-sm text-muted" style="margin-right:8px;">⚙️ ${user.full_name.split(' ')[0]}</span>
      <button id="admin-logout-btn" class="btn btn-sm btn-ghost">Logout</button>
    `;
    document.getElementById('admin-logout-btn')
      ?.addEventListener('click', () => Auth.logout());
  }

  // Wire static buttons via addEventListener (not onclick=)
  document.getElementById('create-election-btn-open')
    ?.addEventListener('click', showCreateElectionModal);
  document.getElementById('add-voter-btn-open')
    ?.addEventListener('click', showAddVoterModal);
  document.getElementById('refresh-logs-btn')
    ?.addEventListener('click', loadLogs);
  document.getElementById('cancel-election-modal')
    ?.addEventListener('click', () => closeModal('create-election-modal'));
  document.getElementById('cancel-voter-modal')
    ?.addEventListener('click', () => closeModal('add-voter-modal'));

  // Wire sidebar nav buttons
  document.querySelectorAll('.admin-nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => switchSection(btn.dataset.section));
  });

  await loadStats();
  await loadElections();
  loadVoters();
}

// ─── Stats ────────────────────────────────────────────────────
async function loadStats() {
  try {
    const data = await api.get('/admin/stats');
    animateCount(document.getElementById('stat-voters'),   data.total_voters,    1000);
    animateCount(document.getElementById('stat-elections'), data.total_elections, 1000);
    animateCount(document.getElementById('stat-votes'),    data.total_votes,     1000);
    animateCount(document.getElementById('stat-parties'),  data.total_parties,   1000);
  } catch {}
}

// ─── Section Switching ────────────────────────────────────────
function switchSection(name) {
  currentSection = name;
  document.querySelectorAll('.admin-nav-item[data-section]').forEach(b => {
    b.classList.toggle('active', b.dataset.section === name);
  });
  ['elections', 'voters', 'applications', 'logs'].forEach(s => {
    document.getElementById(`section-${s}`)?.classList.toggle('hidden', s !== name);
  });
  if (name === 'logs') loadLogs();
  if (name === 'applications') loadApplications();
}

// ─── Elections ────────────────────────────────────────────────
async function loadElections() {
  try {
    const data = await api.get('/elections');
    const elections = data.elections || [];
    const container = document.getElementById('elections-list');

    if (!elections.length) {
      container.innerHTML = '<div class="text-muted text-sm">No elections created yet.</div>';
      return;
    }

    container.innerHTML = `
      <div style="display:grid; gap:16px;">
        ${elections.map(e => `
          <div style="background:var(--bg-glass); border:1px solid var(--border); border-radius:var(--radius); padding:18px;">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:12px;">
              <div>
                <div class="font-bold" style="font-size:16px;">${e.title}</div>
                <div class="text-muted text-sm">${formatDate(e.start_date)} → ${formatDate(e.end_date)} · ${(e.candidates || []).length} candidates</div>
              </div>
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                ${{
                  active:   '<span class="badge badge-active">🟢 Active</span>',
                  upcoming: '<span class="badge badge-upcoming">🟡 Upcoming</span>',
                  paused:   '<span class="badge badge-paused" style="background:var(--gold-glass); color:var(--gold);">⏸ Paused</span>',
                  closed:   '<span class="badge badge-closed">⚫ Closed</span>',
                }[e.status] || ''}
                ${e.status !== 'closed' ? `
                  ${e.status === 'upcoming' ? `
                    <button class="btn btn-sm btn-ghost" data-election-id="${e.id}" data-new-status="active">▶ Activate</button>
                  ` : e.status === 'active' ? `
                    <button class="btn btn-sm btn-ghost" data-election-id="${e.id}" data-new-status="paused">⏸ Pause</button>
                    <button class="btn btn-sm btn-ghost" data-election-id="${e.id}" data-new-status="closed">⏹ Close</button>
                  ` : e.status === 'paused' ? `
                    <button class="btn btn-sm btn-ghost" data-election-id="${e.id}" data-new-status="active">▶ Resume</button>
                    <button class="btn btn-sm btn-ghost" data-election-id="${e.id}" data-new-status="closed">⏹ Close</button>
                  ` : ''}
                ` : `
                  <a href="/results.html?election=${e.id}" class="btn btn-sm btn-ghost">📊 Results</a>
                  <button class="btn btn-sm btn-ghost" data-export-id="${e.id}">📥 Export CSV</button>
                `}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Wire buttons via event delegation
    container.addEventListener('click', async (e) => {
      const statusBtn = e.target.closest('[data-election-id]');
      if (statusBtn) {
        await changeStatus(statusBtn.dataset.electionId, statusBtn.dataset.newStatus);
        return;
      }

      const exportBtn = e.target.closest('[data-export-id]');
      if (exportBtn) {
        await handleExport(exportBtn.dataset.exportId);
      }
    });

  } catch (err) {
    document.getElementById('elections-list').innerHTML =
      `<div class="alert alert-error"><span class="alert-icon">⚠️</span>${err.message}</div>`;
  }
}

async function handleExport(id) {
  try {
    const data = await api.get(`/results/${id}`);
    const results = data.results;
    const title = data.election.title;

    const rows = [
      ['Candidate Name', 'Party', 'Symbol', 'Vote Count', 'Percentage'],
      ...results.map(r => [
        r.name,
        r.party,
        r.symbol,
        r.vote_count,
        ((r.vote_count / data.total_votes) * 100).toFixed(2) + '%'
      ])
    ];

    const csvContent = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `results_${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Exported', 'CSV downloaded successfully.');
  } catch (err) {
    showToast('error', 'Export Failed', err.message);
  }
}

async function changeStatus(id, newStatus) {
  try {
    await api.patch(`/elections/${id}/status`, { status: newStatus });
    showToast('success', 'Updated', `Election status changed to ${newStatus}`);
    loadElections();
    loadStats();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

async function handleCreateElection(e) {
  e.preventDefault();
  const btn = document.getElementById('create-election-btn');
  setBtnLoading(btn, true, 'Creating...');
  try {
    let candidates;
    try { candidates = JSON.parse(document.getElementById('el-candidates').value); }
    catch { showToast('error', 'Invalid JSON', 'Please check your candidates JSON.'); setBtnLoading(btn, false); return; }

    const stateSelect = document.getElementById('el-states');
    const eligible_states = Array.from(stateSelect.selectedOptions).map(option => option.value);

    await api.post('/elections', {
      title:       document.getElementById('el-title').value.trim(),
      description: document.getElementById('el-desc').value.trim(),
      start_date:  document.getElementById('el-start').value,
      end_date:    document.getElementById('el-end').value,
      candidates,
      eligible_states,
    });

    showToast('success', 'Created!', 'Election created successfully.');
    closeModal('create-election-modal');
    document.getElementById('create-election-form').reset();
    loadElections();
    loadStats();
  } catch (err) {
    showToast('error', 'Failed', err.message);
  } finally {
    setBtnLoading(btn, false);
  }
}

// ─── Voters ───────────────────────────────────────────────────
async function loadVoters() {
  try {
    const data = await api.get('/admin/voters');
    const voters = data.voters || [];
    const tbody = document.getElementById('voters-tbody');

    if (!voters.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-muted">No voters found.</td></tr>';
      return;
    }

    tbody.innerHTML = voters.map(v => `
      <tr>
        <td><span class="font-bold">${v.full_name}</span></td>
        <td><span class="font-mono text-gold text-sm">${v.voter_id_number}</span></td>
        <td>${v.district}</td>
        <td>${v.state}</td>
        <td>${v.is_active
          ? '<span class="badge badge-active">Active</span>'
          : '<span class="badge badge-closed">Inactive</span>'}</td>
        <td>
          <button class="btn btn-sm btn-ghost" data-voter-id="${v.id}">
            ${v.is_active ? '🚫 Deactivate' : '✅ Activate'}
          </button>
        </td>
      </tr>
    `).join('');

    // Event delegation for toggle buttons
    tbody.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-voter-id]');
      if (!btn) return;
      await toggleVoter(btn.dataset.voterId);
    });

  } catch (err) {
    document.getElementById('voters-tbody').innerHTML =
      `<tr><td colspan="6"><div class="alert alert-error">${err.message}</div></td></tr>`;
  }
}

async function toggleVoter(id) {
  try {
    await api.patch(`/admin/voters/${id}/toggle`, {});
    showToast('success', 'Updated', 'Voter status changed.');
    loadVoters();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

// ─── Applications ─────────────────────────────────────────────
async function loadApplications() {
  try {
    const data = await api.get('/register/pending');
    const apps = data.applications || [];
    const tbody = document.getElementById('apps-tbody');

    if (!apps.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted" style="text-align:center; padding:40px;">No pending applications found.</td></tr>';
      return;
    }

    tbody.innerHTML = apps.map(app => `
      <tr>
        <td><span class="font-bold">${app.full_name}</span></td>
        <td><span class="font-mono text-blue text-sm">${app.voter_id_number}</span></td>
        <td>${app.state} / ${app.district}</td>
        <td>${new Date(app.applied_at).toLocaleDateString()}</td>
        <td>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-sm btn-primary" data-app-id="${app.id}" data-action="approved">Approve</button>
            <button class="btn btn-sm btn-ghost" data-app-id="${app.id}" data-action="rejected">Reject</button>
          </div>
        </td>
      </tr>
    `).join('');

    // Wire buttons via event delegation
    tbody.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-app-id]');
      if (!btn) return;
      await reviewApp(btn.dataset.appId, btn.dataset.action);
    });

  } catch (err) {
    showToast('error', 'Error', 'Failed to load applications.');
  }
}

async function reviewApp(id, action) {
  if (!confirm(`Are you sure you want to ${action} this application?`)) return;
  try {
    await api.post('/register/review', { id, action });
    showToast('success', 'Done', `Application ${action} successfully.`);
    loadApplications();
    loadStats();
    if (action === 'approved') loadVoters();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

async function handleAddVoter(e) {
  e.preventDefault();
  const btn = document.getElementById('add-voter-btn');
  setBtnLoading(btn, true, 'Adding...');
  try {
    await api.post('/admin/voters', {
      full_name:       document.getElementById('v-name').value.trim(),
      voter_id_number: document.getElementById('v-id').value.trim().toUpperCase(),
      phone:           document.getElementById('v-phone').value.trim(),
      email:           document.getElementById('v-email').value.trim() || null,
      date_of_birth:   document.getElementById('v-dob').value,
      gender:          document.getElementById('v-gender').value,
      district:        document.getElementById('v-district').value.trim(),
      state:           document.getElementById('v-state').value.trim(),
    });
    showToast('success', 'Voter Added!', 'The voter has been added to the registry.');
    closeModal('add-voter-modal');
    document.getElementById('add-voter-form').reset();
    loadVoters();
    loadStats();
  } catch (err) {
    showToast('error', 'Failed', err.message);
  } finally {
    setBtnLoading(btn, false);
  }
}

// ─── Audit Logs ───────────────────────────────────────────────
async function loadLogs() {
  try {
    const data = await api.get('/admin/logs');
    const logs = data.logs || [];
    const tbody = document.getElementById('logs-tbody');

    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">No logs found.</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td><span class="font-bold text-sm">${l.action}</span></td>
        <td class="text-sm font-mono">${l.performed_by || '—'}</td>
        <td class="text-xs text-muted">${l.details ? JSON.stringify(l.details).slice(0, 60) + '...' : '—'}</td>
        <td class="text-xs text-muted">${l.ip_address || '—'}</td>
        <td class="text-xs">${formatDateTime(l.created_at)}</td>
      </tr>
    `).join('');
  } catch {}
}

// ─── Modal Helpers ────────────────────────────────────────────
function showCreateElectionModal() {
  document.getElementById('create-election-modal').classList.remove('hidden');
  const now = new Date();
  const local = new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById('el-start').value = local;
  const future = new Date(now.getTime() + 7 * 24 * 3600000 - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById('el-end').value = future;
}

function showAddVoterModal() {
  document.getElementById('add-voter-modal').classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}
