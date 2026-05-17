// Voting booth logic
const params = new URLSearchParams(window.location.search);
const electionId = params.get('election');
let selectedCandidateId = null;
let election = null;
let receiptTokenNew = null;
let isInfoOnly = false;

// ─── Initialise page ─────────────────────────────────────────
async function init() {
  const user = await Auth.requireAuth();
  if (!user) return;
  initNavbar();

  if (!electionId) { window.location.href = '/dashboard.html'; return; }

  // Wire up buttons ONCE (no inline onclick in HTML needed)
  document.getElementById('confirm-vote-btn')?.addEventListener('click', showConfirmModal);
  document.getElementById('submit-vote-btn')?.addEventListener('click', submitVote);
  document.getElementById('cancel-confirm-btn')?.addEventListener('click', closeConfirmModal);
  document.getElementById('copy-receipt-btn')?.addEventListener('click', copyReceipt);
  document.getElementById('copy-receipt-new-btn')?.addEventListener('click', copyReceiptNew);

  try {
    const data = await api.get(`/elections/${electionId}`);
    election = data.election;

    document.getElementById('election-title').textContent = election.title;
    document.getElementById('election-meta').textContent =
      `${(election.candidates || []).length} candidates · Ends ${formatDateTime(election.end_date)}`;

    if (data.has_voted) {
      document.getElementById('existing-receipt').textContent = data.receipt_token || 'N/A';
      showState('already-voted');
      return;
    }

    if (election.status !== 'active') {
      showToast('warning', 'Election Not Active', 'This election is not currently accepting votes.');
      setTimeout(() => window.location.href = '/dashboard.html', 2000);
      return;
    }

    // Determine state eligibility
    const isEligibleState = !election.eligible_states || election.eligible_states.length === 0 || election.eligible_states.includes(user.state);
    
    isInfoOnly = params.get('info') === 'true' || !isEligibleState;
    let candidates = election.candidates || [];
    
    console.log('[DEBUG] Logged-in Voter User:', user);
    console.log('[DEBUG] Election Candidates:', candidates);
    console.log('[DEBUG] Voter Constituency:', user.constituency);
    
    if (!isInfoOnly) {
      // Filter candidates for the voter's specific constituency
      candidates = candidates.filter(c => c.constituency === user.constituency);
      
      if (candidates.length === 0) {
        showToast('info', 'No Candidates', `No candidates found for your constituency (${user.constituency}).`);
      }
    } else {
      // Create a prominent view-only warning banner at the top of the container
      const banner = document.createElement('div');
      banner.className = 'alert alert-info';
      banner.style.marginBottom = '24px';
      banner.style.textAlign = 'left';
      banner.style.background = 'rgba(59, 130, 246, 0.1)';
      banner.style.border = '1px solid var(--blue)';
      
      if (!isEligibleState) {
        banner.innerHTML = `
          <span class="alert-icon">ℹ️</span>
          <div>
            <strong>View-Only Mode:</strong> You are registered in <strong>${user.state.toUpperCase()}</strong>. 
            You can view details, parties, and candidates, but you cannot cast a vote in this election (eligible for: ${election.eligible_states.join(', ')}).
          </div>
        `;
      } else {
        banner.innerHTML = `
          <span class="alert-icon">ℹ️</span>
          <div>
            <strong>View-Only Mode:</strong> Exploring all candidates in this election. You cannot cast a vote in this mode.
          </div>
        `;
      }
      
      const container = document.querySelector('.page-wrapper > .container');
      if (container) {
        container.insertBefore(banner, container.firstChild);
      }
      
      // Hide the confirm/submit selection button
      const confirmBtn = document.getElementById('confirm-vote-btn');
      if (confirmBtn) confirmBtn.style.display = 'none';
      
      // Update header badge to indicate View-Only Mode
      const badge = document.querySelector('.vote-booth-header .badge');
      if (badge) {
        badge.textContent = 'ℹ️ View Only Mode';
        badge.className = 'badge badge-upcoming';
        badge.style.background = 'var(--gold-glass)';
        badge.style.borderColor = 'var(--gold)';
      }

      // Customize prompts for view-only experience
      const stepBadge = document.getElementById('step-badge');
      if (stepBadge) stepBadge.textContent = 'Transparency Info';

      const stepTitle = document.getElementById('step-title');
      if (stepTitle) stepTitle.textContent = 'Candidate Lineup';

      const stepDesc = document.getElementById('step-desc');
      if (stepDesc) stepDesc.textContent = 'Review registered candidates and check their political affiliations or party portfolios below.';

      // Hide the vote progress bar
      const progressContainer = document.querySelector('.vote-progress');
      if (progressContainer) progressContainer.style.display = 'none';
    }

    renderCandidates(candidates);
    showState('vote-section');
  } catch (err) {
    showToast('error', 'Error', err.message);
    setTimeout(() => window.location.href = '/dashboard.html', 2000);
  }
}

// ─── State visibility ─────────────────────────────────────────
function showState(id) {
  ['loading', 'already-voted', 'vote-section'].forEach(s =>
    document.getElementById(s)?.classList.add('hidden')
  );
  document.getElementById(id)?.classList.remove('hidden');
}

// ─── Render candidates ────────────────────────────────────────
function renderCandidates(candidates) {
  const grid = document.getElementById('candidates-grid');
  grid.innerHTML = candidates.map(c => `
    <div class="candidate-card" data-candidate-id="${c.id}">
      <span class="candidate-symbol">${c.symbol || '🏛️'}</span>
      <div class="candidate-name">${c.name}</div>
      <div class="candidate-party">
        <span class="candidate-party-dot" style="background:${c.color || '#3b82f6'}"></span>
        ${c.party}
      </div>
      <div class="text-xs text-muted" style="margin-top:4px; font-weight:600;">📍 ${c.constituency || 'General'}</div>
      <div style="margin-top:14px;">
        <a href="/parties.html?party=${c.party_id}" class="btn btn-ghost btn-sm" target="_blank">
          🏛️ View Party Info
        </a>
      </div>
    </div>
  `).join('');

  // Event delegation — one listener for all cards
  grid.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;           // Ignore party-info link clicks
    const card = e.target.closest('[data-candidate-id]');
    if (card) selectCandidate(card.dataset.candidateId);
  });
}

// ─── Select a candidate ───────────────────────────────────────
function selectCandidate(id) {
  if (isInfoOnly) return; // Prevent selection in view-only mode
  selectedCandidateId = id;
  document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector(`[data-candidate-id="${id}"]`);
  if (card) card.classList.add('selected');
  const confirmBtn = document.getElementById('confirm-vote-btn');
  if (confirmBtn) confirmBtn.disabled = false;
  document.getElementById('progress-bar').style.width = '66%';
}

// ─── Confirm modal ────────────────────────────────────────────
function showConfirmModal() {
  if (!selectedCandidateId || !election) return;
  const candidate = election.candidates.find(c => c.id === selectedCandidateId);
  if (!candidate) return;

  document.getElementById('confirm-symbol').textContent = candidate.symbol || '🏛️';
  document.getElementById('confirm-name').textContent   = candidate.name;
  document.getElementById('confirm-party').textContent  = candidate.party;
  document.getElementById('confirm-modal').classList.remove('hidden');
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').classList.add('hidden');
}

// ─── Submit vote ──────────────────────────────────────────────
async function submitVote() {
  const btn = document.getElementById('submit-vote-btn');
  setBtnLoading(btn, true, 'Submitting...');

  try {
    const data = await api.post(`/vote/${electionId}`, { candidate_id: selectedCandidateId });

    closeConfirmModal();
    document.getElementById('progress-bar').style.width = '100%';
    document.getElementById('vote-receipt').textContent = data.receipt_token;
    document.getElementById('vote-hash').textContent    = data.vote_hash.slice(0, 32) + '...';
    receiptTokenNew = data.receipt_token;

    // Generate QR Code
    try {
      const qrUrl = `${window.location.origin}/audit.html?token=${data.receipt_token}`;
      QRCode.toCanvas(document.getElementById('qr-canvas'), qrUrl, {
        width: 160,
        margin: 1,
        color: { dark: '#1a3c6e', light: '#ffffff' }
      });
      document.getElementById('receipt-qr').classList.remove('hidden');
    } catch (qrErr) {
      console.error('QR Gen failed:', qrErr);
    }

    document.getElementById('step-choose').classList.add('hidden');
    document.getElementById('step-receipt').classList.remove('hidden');
    showToast('success', 'Vote Cast! 🎉', 'Your anonymous ballot has been recorded.');
  } catch (err) {
    showToast('error', 'Failed', err.message);
    closeConfirmModal();
  } finally {
    setBtnLoading(btn, false);
  }
}

// ─── Copy receipt helpers ─────────────────────────────────────
function copyReceipt() {
  const token = document.getElementById('existing-receipt').textContent;
  navigator.clipboard.writeText(token);
  showToast('success', 'Copied!', 'Receipt token copied to clipboard.');
}

function copyReceiptNew() {
  if (receiptTokenNew) {
    navigator.clipboard.writeText(receiptTokenNew);
    showToast('success', 'Copied!', 'Receipt token copied to clipboard.');
  }
}

init();
