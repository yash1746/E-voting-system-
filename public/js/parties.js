// Party Transparency Page
let parties = [];
let selectedPartyId = null;

async function init() {
  initNavbar('parties');
  try {
    const data = await api.get('/parties');
    parties = data.parties || [];
    renderPartyList();
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');

    // Auto-select from URL param
    const params = new URLSearchParams(window.location.search);
    const partyParam = params.get('party');
    if (partyParam) selectParty(partyParam);
    else if (parties.length > 0) selectParty(parties[0].id);
  } catch (err) {
    document.getElementById('loading').innerHTML = `
      <div class="alert alert-error"><span class="alert-icon">⚠️</span>${err.message}</div>
    `;
  }
}

function renderPartyList() {
  document.getElementById('party-list').innerHTML = parties.map(p => `
    <button
      class="admin-nav-item${selectedPartyId === p.id ? ' active' : ''}"
      id="party-btn-${p.id}"
      onclick="selectParty('${p.id}')"
    >
      <span class="nav-icon">${p.symbol_emoji || '🏛️'}</span>
      <span style="font-size:13px;">${p.abbreviation || p.name}</span>
    </button>
  `).join('');
}

async function selectParty(id) {
  selectedPartyId = id;
  document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`party-btn-${id}`);
  if (btn) btn.classList.add('active');

  const party = parties.find(p => p.id === id);
  if (!party) return;

  const detail = document.getElementById('party-detail');
  detail.innerHTML = `
    <div class="card" style="margin-bottom:20px;">
      <div style="display:flex; align-items:center; gap:20px; flex-wrap:wrap;">
        <div style="width:72px; height:72px; border-radius:50%; background:rgba(255,255,255,0.06); border:3px solid ${party.color || '#3b82f6'}33; display:flex; align-items:center; justify-content:center; font-size:36px; flex-shrink:0;">
          ${party.symbol_emoji || '🏛️'}
        </div>
        <div style="flex:1;">
          <h2 style="font-size:22px; font-weight:800; margin-bottom:4px;">${party.name}</h2>
          <div class="text-secondary text-sm" style="margin-bottom:8px;">
            Founded ${party.founded_year || 'N/A'} · ${party.ideology || ''} · HQ: ${party.headquarters || 'N/A'}
          </div>
          <div class="text-secondary" style="font-size:14px;">${party.description || ''}</div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div class="text-xs text-muted" style="margin-bottom:4px; letter-spacing:1px;">LEADER</div>
          <div class="font-bold">${party.leader_name || '—'}</div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="party-tabs" id="party-tabs">
      <button class="party-tab active" data-tab="actions" onclick="switchTab('actions')">⚡ Key Actions</button>
      <button class="party-tab" data-tab="speeches" onclick="switchTab('speeches')">🎙️ Speeches</button>
    </div>

    <div id="tab-actions"></div>
    <div id="tab-speeches" class="hidden"></div>
  `;

  // Load both in parallel
  loadActions(id);
  loadSpeeches(id);
}

async function loadActions(partyId) {
  const container = document.getElementById('tab-actions');
  container.innerHTML = '<div class="text-muted text-sm" style="padding:20px 0;">Loading actions...</div>';
  try {
    const data = await api.get(`/parties/${partyId}/actions`);
    const actions = data.actions || [];
    if (!actions.length) {
      container.innerHTML = '<div class="text-muted" style="padding:32px 0; text-align:center;">No actions recorded yet.</div>';
      return;
    }
    container.innerHTML = `
      <div style="display:grid; gap:12px;">
        ${actions.map(a => `
          <div class="action-item">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
              <div class="action-date">📅 ${formatDate(a.action_date)}</div>
              <div style="display:flex; gap:8px;">
                <span class="badge badge-${(a.impact || 'neutral').toLowerCase()}" style="font-size:10px;">
                  ${a.impact === 'positive' ? '▲' : a.impact === 'negative' ? '▼' : '●'} ${a.impact || 'neutral'}
                </span>
                <span style="font-size:11px; color:var(--text-muted); text-transform:capitalize; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:12px;">
                  ${a.category || 'other'}
                </span>
              </div>
            </div>
            <div class="action-title">${a.title}</div>
            <div class="action-desc">${a.description || ''}</div>
            ${a.source_url ? `<a href="${a.source_url}" target="_blank" class="text-sm text-blue" style="margin-top:8px; display:inline-block;">🔗 Source</a>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error"><span class="alert-icon">⚠️</span>${err.message}</div>`;
  }
}

async function loadSpeeches(partyId) {
  const container = document.getElementById('tab-speeches');
  try {
    const data = await api.get(`/parties/${partyId}/speeches`);
    const speeches = data.speeches || [];
    if (!speeches.length) {
      container.innerHTML = '<div class="text-muted" style="padding:32px 0; text-align:center;">No speeches recorded yet.</div>';
      return;
    }
    container.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:20px;">
        ${speeches.map(s => `
          <div class="speech-card">
            ${s.video_url ? `
              <iframe class="speech-video"
                src="${toEmbedUrl(s.video_url)}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen>
              </iframe>
            ` : '<div style="aspect-ratio:16/9; background:var(--bg-glass); display:flex; align-items:center; justify-content:center; font-size:40px;">🎙️</div>'}
            <div class="speech-info">
              <div class="speech-event">📅 ${formatDate(s.speech_date)} · ${s.event_name || ''}</div>
              <div class="speech-title">${s.title}</div>
              <div class="speech-summary text-secondary text-sm" style="margin-top:6px;">${s.summary || ''}</div>
              <div class="text-sm" style="margin-top:10px; color:var(--text-muted);">🗣️ ${s.speaker_name}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch {}
}

function toEmbedUrl(url) {
  if (!url) return '';
  return url.replace('watch?v=', 'embed/');
}

function switchTab(tab) {
  document.querySelectorAll('.party-tab').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
  document.getElementById('tab-actions').classList.toggle('hidden', tab !== 'actions');
  document.getElementById('tab-speeches').classList.toggle('hidden', tab !== 'speeches');
}

init();
