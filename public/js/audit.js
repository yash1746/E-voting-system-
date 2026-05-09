// Audit trail page logic
async function init() {
  initNavbar('audit');

  // Wire buttons via JS — no inline onclick needed
  document.getElementById('load-audit-btn')?.addEventListener('click', loadAudit);
  document.getElementById('verify-receipt-btn')?.addEventListener('click', verifyReceipt);
  // Also trigger on Enter key in receipt input
  document.getElementById('receipt-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') verifyReceipt();
  });

  await loadElectionList();

  // Pre-fill receipt from URL
  const params = new URLSearchParams(window.location.search);
  const receipt = params.get('receipt');
  if (receipt) {
    document.getElementById('receipt-input').value = receipt;
    verifyReceipt();
  }
}

async function loadElectionList() {
  try {
    const data = await api.get('/elections');
    const elections = data.elections || [];
    const select = document.getElementById('election-select');
    select.innerHTML = '<option value="">— Choose an election —</option>' +
      elections.map(e => `<option value="${e.id}">${e.title}</option>`).join('');

    // Auto-load first election
    if (elections.length > 0) {
      select.value = elections[0].id;
      loadAudit();
    }
  } catch {
    document.getElementById('election-select').innerHTML = '<option value="">Login to load elections</option>';
  }
}

async function loadAudit() {
  const id = document.getElementById('election-select').value;
  if (!id) return;

  document.getElementById('placeholder').classList.add('hidden');
  document.getElementById('audit-section').classList.add('hidden');
  document.getElementById('loading').classList.remove('hidden');

  try {
    const data = await api.get(`/results/${id}/audit`);
    renderAuditChain(data);
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('audit-section').classList.remove('hidden');
  } catch (err) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('placeholder').classList.remove('hidden');
    document.getElementById('placeholder').innerHTML = `
      <div style="font-size:48px; margin-bottom:16px;">⚠️</div>
      <div class="text-secondary">${err.message}</div>
    `;
  }
}

function renderAuditChain(data) {
  const { election, total_votes, chain_valid, broken_at, chain } = data;

  document.getElementById('audit-election-title').textContent = election.title;
  document.getElementById('audit-meta').textContent = `${total_votes} votes · Status: ${election.status}`;

  const badge = document.getElementById('chain-integrity-badge');
  if (chain_valid) {
    badge.innerHTML = `<span style="color:var(--green);">✅ Chain Intact</span>`;
  } else {
    badge.innerHTML = `<span style="color:var(--red);">⚠️ Chain Broken at vote #${broken_at}</span>`;
  }

  if (!chain || chain.length === 0) {
    document.getElementById('chain-list').innerHTML = `
      <div style="text-align:center; padding:40px; color:var(--text-muted);">
        <div style="font-size:48px; margin-bottom:12px;">📭</div>
        <div>No votes have been cast in this election yet.</div>
      </div>
    `;
    return;
  }

  document.getElementById('chain-list').innerHTML = chain.map((v, i) => `
    <div class="chain-item ${!v.valid_link ? 'invalid' : ''}" style="animation:slideInUp ${0.05 * Math.min(i,10)}s ease both;">
      <div class="chain-index">${v.index}</div>
      <div>
        <div class="chain-hash" style="font-size:11px;" title="${v.vote_hash}">
          ${v.vote_hash.slice(0, 24)}...${v.vote_hash.slice(-8)}
        </div>
        <div class="text-xs text-muted" style="margin-top:3px;">← prev: ${v.previous_hash.slice(0,16)}...</div>
      </div>
      <div class="chain-time">${formatDateTime(v.cast_at)}</div>
      <div class="${v.valid_link ? 'chain-valid' : 'chain-invalid'}" title="${v.valid_link ? 'Valid link' : 'Broken link!'}">
        ${v.valid_link ? '✓' : '✗'}
      </div>
    </div>
  `).join('');
}

async function verifyReceipt() {
  const token = document.getElementById('receipt-input').value.trim();
  const result = document.getElementById('receipt-result');

  if (!token) {
    result.innerHTML = '<div class="alert alert-warning"><span class="alert-icon">⚠️</span>Please enter your receipt token.</div>';
    return;
  }

  result.innerHTML = '<div class="text-muted text-sm">Verifying...</div>';

  try {
    const data = await api.get(`/vote/receipt/${token}`);
    result.innerHTML = `
      <div class="alert alert-success">
        <span class="alert-icon">✅</span>
        <div>
          <div class="font-bold">Vote Confirmed!</div>
          <div class="text-sm">Your vote was recorded on ${formatDateTime(data.cast_at)} and is part of the verified audit chain.</div>
          <div class="text-xs font-mono" style="margin-top:6px; color:var(--blue-light);">Hash: ${data.vote_hash.slice(0,32)}...</div>
        </div>
      </div>
    `;
  } catch (err) {
    result.innerHTML = `
      <div class="alert alert-error">
        <span class="alert-icon">⚠️</span>
        <div>
          <div class="font-bold">Verification Failed</div>
          <div class="text-sm">${err.message}</div>
        </div>
      </div>
    `;
  }
}

init();
