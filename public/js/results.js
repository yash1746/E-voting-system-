// Results page logic
let elections = [];

async function init() {
  initNavbar('results');

  // Wire button
  document.getElementById('load-results-btn')?.addEventListener('click', loadResults);

  await loadElectionList();

  // Auto-select from URL
  const params = new URLSearchParams(window.location.search);
  const electionParam = params.get('election');
  if (electionParam) {
    document.getElementById('election-select').value = electionParam;
    loadResults();
  }
}

async function loadElectionList() {
  try {
    // Try authenticated first, fall back to public listing
    let data;
    try {
      data = await api.get('/elections');
    } catch {
      return; // Not logged in — show placeholder
    }
    elections = data.elections || [];
    const select = document.getElementById('election-select');
    select.innerHTML = '<option value="">— Choose an election —</option>' +
      elections.map(e => `<option value="${e.id}">${e.title} (${e.status})</option>`).join('');
  } catch {}
}

async function loadResults() {
  const id = document.getElementById('election-select').value;
  if (!id) { showToast('warning', '', 'Please select an election.'); return; }

  document.getElementById('placeholder').classList.add('hidden');
  document.getElementById('results-section').classList.add('hidden');
  document.getElementById('loading').classList.remove('hidden');

  try {
    const data = await api.get(`/results/${id}`);
    renderResults(data);
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('results-section').classList.remove('hidden');
  } catch (err) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('placeholder').classList.remove('hidden');
    document.getElementById('placeholder').innerHTML = `
      <div style="font-size:48px; margin-bottom:20px;">🔒</div>
      <div style="font-size:16px; color:var(--text-secondary);">${err.message}</div>
    `;
  }
}

function renderResults(data) {
  const { election, results, total_votes, winner, chain_integrity } = data;

  // Election title
  document.getElementById('results-election-title').textContent = election.title;
  document.getElementById('results-total-votes').textContent = `${total_votes.toLocaleString('en-IN')} total votes`;

  // Winner
  if (winner) {
    document.getElementById('winner-symbol').textContent = winner.symbol || '🏛️';
    document.getElementById('winner-name').textContent = winner.name;
    document.getElementById('winner-party').textContent = winner.party;
    document.getElementById('winner-votes').textContent =
      `${winner.votes.toLocaleString('en-IN')} votes · ${winner.percentage}%`;
    document.getElementById('winner-card').style.display = 'block';
  } else {
    document.getElementById('winner-card').style.display = 'none';
  }

  // Chain integrity
  const chainIcon = document.getElementById('chain-icon');
  const chainText = document.getElementById('chain-text');
  if (chain_integrity.valid) {
    chainIcon.textContent = '✅';
    chainText.textContent = 'Hash chain intact — all votes verified unaltered';
    chainText.style.color = 'var(--green)';
  } else {
    chainIcon.textContent = '⚠️';
    chainText.textContent = `Chain broken at vote ${chain_integrity.brokenAt} — possible tampering detected!`;
    chainText.style.color = 'var(--red)';
  }

  // Results bars
  const barsContainer = document.getElementById('results-bars');
  barsContainer.innerHTML = results.map((r, i) => `
    <div class="result-bar-container" style="animation:slideInUp ${0.2 + i * 0.1}s ease both;">
      <div class="result-bar-label">
        <div class="candidate-info">
          <span style="font-size:20px;">${r.symbol || '🏛️'}</span>
          <div>
            <div class="font-bold">${i === 0 ? '👑 ' : ''}${r.name}</div>
            <div class="text-muted" style="font-size:12px;">${r.party}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div class="font-bold">${r.votes.toLocaleString('en-IN')}</div>
          <div class="text-muted text-sm">${r.percentage}%</div>
        </div>
      </div>
      <div class="result-bar-track">
        <div class="result-bar-fill" id="bar-${i}"
          style="width:0%; background:${r.color || 'var(--gradient-blue)'};">
        </div>
      </div>
    </div>
  `).join('');

  // Animate bars after render
  setTimeout(() => {
    results.forEach((r, i) => {
      const bar = document.getElementById(`bar-${i}`);
      if (bar) bar.style.width = `${r.percentage}%`;
    });
  }, 100);
}

// Require auth to see results
Auth.getUser().then(u => {
  if (!u) {
    // Still init but will hit 401 on loadResults
  }
});

init();
