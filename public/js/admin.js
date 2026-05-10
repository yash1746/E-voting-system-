// Admin panel logic
let currentSection = 'elections';
let allParties = [];

document.addEventListener('DOMContentLoaded', () => {
  // Wire all static button listeners immediately once DOM is ready
  document.getElementById('create-election-form')
    ?.addEventListener('submit', handleCreateElection);
  document.getElementById('add-voter-form')
    ?.addEventListener('submit', handleAddVoter);
  document.getElementById('create-party-form')
    ?.addEventListener('submit', handleCreateParty);

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });

  init();

  // Candidate management in modal
  document.getElementById('add-candidate-btn')
    ?.addEventListener('click', () => addCandidateRow());
  
  document.getElementById('candidates-container')
    ?.addEventListener('click', (e) => {
      if (e.target.closest('.remove-cand-btn')) {
        const rows = document.querySelectorAll('.candidate-row');
        if (rows.length > 1) {
          e.target.closest('.candidate-row').remove();
        } else {
          showToast('info', 'Required', 'At least one candidate is required.');
        }
      }
    });

  // Filter parties and render tags when election states change
  document.getElementById('el-states')?.addEventListener('change', (e) => {
    updateCandidatePartyOptions();
    renderStateTags(e.target, 'el-states-tags');
  });
  document.getElementById('p-states')?.addEventListener('change', (e) => {
    renderStateTags(e.target, 'p-states-tags');
  });
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
  document.getElementById('create-party-btn-open')
    ?.addEventListener('click', showCreatePartyModal);
  document.getElementById('refresh-logs-btn')
    ?.addEventListener('click', loadLogs);
  document.getElementById('cancel-election-modal')
    ?.addEventListener('click', () => closeModal('create-election-modal'));
  document.getElementById('cancel-voter-modal')
    ?.addEventListener('click', () => closeModal('add-voter-modal'));
  document.getElementById('cancel-party-modal')
    ?.addEventListener('click', () => closeModal('create-party-modal'));

  // Wire sidebar nav buttons
  document.querySelectorAll('.admin-nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => switchSection(btn.dataset.section));
  });

  await loadStats();
  await loadElections();
  await loadParties(); // Preload for candidate selection
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
function switchSection(name, logFilter = null) {
  currentSection = name;
  document.querySelectorAll('.admin-nav-item[data-section]').forEach(b => {
    b.classList.toggle('active', b.dataset.section === name);
  });
  ['elections', 'voters', 'parties', 'applications', 'logs'].forEach(s => {
    document.getElementById(`section-${s}`)?.classList.toggle('hidden', s !== name);
  });
  if (name === 'logs') loadLogs(logFilter);
  if (name === 'applications') loadApplications();
  if (name === 'parties') loadParties();
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
                    <button class="btn btn-sm btn-ghost" style="color:var(--red);" onclick="handleDeleteElection('${e.id}')">✕ Delete</button>
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
                  <button class="btn btn-sm btn-ghost" style="color:var(--red);" onclick="handleDeleteElection('${e.id}')">✕ Delete</button>
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

async function handleDeleteElection(id) {
  if (!confirm('Are you sure you want to delete this election? This cannot be undone.')) return;
  try {
    await api.delete(`/elections/${id}`);
    showToast('success', 'Deleted', 'Election removed successfully.');
    loadElections();
    loadStats();
  } catch (err) {
    showToast('error', 'Delete Failed', err.message);
  }
}

async function handleCreateElection(e) {
  e.preventDefault();
  const btn = document.getElementById('submit-election-btn');
  setBtnLoading(btn, true, 'Creating...');
  try {
    const candidateRows = document.querySelectorAll('.candidate-row');
    const candidates = Array.from(candidateRows).map((row, index) => {
      const partySelect = row.querySelector('.cand-party-select');
      const selectedPartyId = partySelect.value;
      const party = allParties.find(p => p.id === selectedPartyId);
      
      return {
        id: `c${index + 1}`,
        name: row.querySelector('.cand-name').value.trim(),
        party: party ? party.name : 'Independent',
        party_id: selectedPartyId,
        symbol: party ? party.symbol_emoji : '👤',
        color: party ? party.color : '#64748b'
      };
    });

    if (candidates.some(c => !c.name)) {
      throw new Error('Please fill in all candidate names.');
    }

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
    document.getElementById('el-states-tags').innerHTML = '';
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
        <td><span class="font-mono text-blue text-sm">${app.voter_id_number || 'New Application'}</span></td>
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
async function loadLogs(filter = null) {
  try {
    const data = await api.get('/admin/logs');
    let logs = data.logs || [];
    const tbody = document.getElementById('logs-tbody');

    if (filter) {
      logs = logs.filter(l => l.action.includes(filter.toUpperCase()));
      showToast('info', 'Filtered', `Showing logs for: ${filter}`);
    }

    if (!logs.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-muted">No ${filter || ''} logs found.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td><span class="font-bold text-sm">${l.action}</span></td>
        <td class="text-sm font-mono">${l.performed_by || '—'}</td>
        <td class="text-xs text-muted">${l.details ? JSON.stringify(l.details).slice(0, 60) + '...' : '—'}</td>
        <td class="text-xs">${formatDateTime(l.created_at)}</td>
        <td>
          <button class="btn btn-ghost btn-sm" style="color:var(--red); padding:4px;" onclick="handleDeleteLog('${l.id}')">✕</button>
        </td>
      </tr>
    `).join('');
  } catch {}
}

async function handleDeleteLog(id) {
  try {
    await api.delete(`/admin/logs/${id}`);
    loadLogs();
  } catch (err) {
    showToast('error', 'Error', 'Failed to delete log.');
  }
}

// ─── Modal Helpers ────────────────────────────────────────────
function showCreateElectionModal() {
  document.getElementById('create-election-modal').classList.remove('hidden');
  
  // Reset candidates to 1 default row
  const container = document.getElementById('candidates-container');
  if (container) {
    container.innerHTML = '';
    addCandidateRow();
  }

  // Clear tags
  const tagsContainer = document.getElementById('el-states-tags');
  if (tagsContainer) tagsContainer.innerHTML = '';

  const now = new Date();
  const local = new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById('el-start').value = local;
  const future = new Date(now.getTime() + 7 * 24 * 3600000 - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById('el-end').value = future;
}

function addCandidateRow() {
  const container = document.getElementById('candidates-container');
  const div = document.createElement('div');
  div.className = 'candidate-row';
  div.style = 'display: grid; grid-template-columns: 1.5fr 1.5fr 40px; gap: 8px; margin-bottom: 8px; align-items: center;';
  
  // Create party options based on current state selection
  const options = getEligiblePartyOptions();
  
  div.innerHTML = `
    <input type="text" class="form-control cand-name" placeholder="Candidate Name" required>
    <select class="form-control cand-party-select" required>
      <option value="">Select Party</option>
      <option value="independent">Independent / None</option>
      ${options}
    </select>
    <button type="button" class="btn btn-ghost remove-cand-btn" style="color: var(--red); padding: 0;">✕</button>
  `;
  container.appendChild(div);
  div.querySelector('.cand-name').focus();
}

function getEligiblePartyOptions() {
  const stateSelect = document.getElementById('el-states');
  const selectedStates = Array.from(stateSelect.selectedOptions).map(o => o.value);
  
  const eligibleParties = allParties.filter(p => {
    // If party is National, it's always eligible
    if (!p.eligible_states || p.eligible_states.includes('National')) return true;
    
    // If no states are selected for the election (National target), show all parties
    if (selectedStates.length === 0) return true;

    // Otherwise, check if party is eligible in any of the selected states
    return selectedStates.some(s => p.eligible_states.includes(s));
  });

  return eligibleParties.map(p => `
    <option value="${p.id}">${p.abbreviation} - ${p.name} (${p.symbol_emoji})</option>
  `).join('');
}

function updateCandidatePartyOptions() {
  const selects = document.querySelectorAll('.cand-party-select');
  const options = getEligiblePartyOptions();
  selects.forEach(s => {
    const currentVal = s.value;
    s.innerHTML = `
      <option value="">Select Party</option>
      <option value="independent">Independent / None</option>
      ${options}
    `;
    s.value = currentVal; // Try to preserve selection
  });
}

// ─── Parties ──────────────────────────────────────────────────
async function loadParties() {
  try {
    const data = await api.get('/parties');
    allParties = data.parties || [];
    const container = document.getElementById('parties-list');
    if (!container) return;

    if (!allParties.length) {
      container.innerHTML = '<div class="text-muted text-sm">No parties registered yet.</div>';
      return;
    }

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:16px;">
        ${allParties.map(p => `
          <div class="card card-sm" style="border-left: 4px solid ${p.color || 'var(--blue)'};">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <div style="font-size:20px; margin-bottom:4px;">${p.symbol_emoji} <span style="font-weight:700;">${p.abbreviation}</span></div>
                <div style="font-weight:600; font-size:14px;">${p.name}</div>
              </div>
              <div class="badge badge-active">${(p.eligible_states || []).includes('National') ? 'National' : (p.eligible_states || []).length + ' States'}</div>
            </div>
            <div style="margin-top:12px; font-size:12px; color:var(--text-secondary);">
              ${p.description ? p.description.slice(0, 80) + '...' : 'No description provided.'}
            </div>
            <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:4px;">
              ${(p.eligible_states || []).slice(0, 3).map(s => `<span style="font-size:10px; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">${s}</span>`).join('')}
              ${(p.eligible_states || []).length > 3 ? `<span style="font-size:10px;">+${(p.eligible_states || []).length - 3} more</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    console.error('loadParties error:', err);
  }
}

function showCreatePartyModal() {
  document.getElementById('create-party-modal').classList.remove('hidden');
}

async function handleCreateParty(e) {
  e.preventDefault();
  const btn = document.getElementById('add-party-btn');
  setBtnLoading(btn, true, 'Registering...');
  try {
    const stateSelect = document.getElementById('p-states');
    const eligible_states = Array.from(stateSelect.selectedOptions).map(option => option.value);

    await api.post('/parties', {
      name:            document.getElementById('p-name').value.trim(),
      abbreviation:    document.getElementById('p-abbr').value.trim(),
      symbol_emoji:    document.getElementById('p-symbol').value.trim(),
      description:     document.getElementById('p-desc').value.trim(),
      eligible_states: eligible_states,
      color:           '#4f8ef7' // Default color
    });

    showToast('success', 'Registered!', 'Political party registered successfully.');
    closeModal('create-party-modal');
    document.getElementById('create-party-form').reset();
    document.getElementById('p-states-tags').innerHTML = '';
    loadParties();
    loadStats();
  } catch (err) {
    showToast('error', 'Failed', err.message);
  } finally {
    setBtnLoading(btn, false);
  }
}

function showAddVoterModal() {
  document.getElementById('add-voter-modal').classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}
// ─── State Selection Tags ─────────────────────────────────────
function renderStateTags(selectElement, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const selectedOptions = Array.from(selectElement.selectedOptions).map(o => o.value);
  
  if (selectedOptions.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = selectedOptions.map(state => `
    <span class="badge" style="background:rgba(59, 130, 246, 0.1); color:var(--text-primary); border:1px solid var(--border); display:flex; align-items:center; gap:6px; padding:4px 10px; font-size:12px;">
      ${state}
      <span style="cursor:pointer; font-weight:bold; font-size:16px; color:var(--red); margin-left:4px;" onclick="unselectState('${selectElement.id}', '${state}')">×</span>
    </span>
  `).join('');
}

function unselectState(selectId, stateValue) {
  const select = document.getElementById(selectId);
  if (!select) return;
  
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].value === stateValue) {
      select.options[i].selected = false;
      break;
    }
  }
  
  // Trigger change event manually
  select.dispatchEvent(new Event('change'));
}
