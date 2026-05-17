/* Shared frontend JS utilities */
const API_BASE = '/api';

// ─── API Client ──────────────────────────────────────────────────
const api = {
  async request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  },
  get:    (path)        => api.request('GET',    path),
  post:   (path, body)  => api.request('POST',   path, body),
  patch:  (path, body)  => api.request('PATCH',  path, body),
  delete: (path)        => api.request('DELETE', path),
};

// ─── Auth Helpers ────────────────────────────────────────────────
const Auth = {
  _user: null,
  _session: null,

  async getUser() {
    if (this._user) return this._user;
    try {
      const data = await api.get('/auth/me');
      this._user = data.voter;
      this._role = data.role;
      return this._user;
    } catch {
      return null;
    }
  },

  async requireAuth(redirectTo = '/login.html') {
    const user = await this.getUser();
    if (!user) {
      window.location.href = redirectTo;
      return null;
    }
    return user;
  },

  async requireAdmin() {
    await this.requireAuth();
    if (this._role !== 'admin') {
      showToast('error', 'Access Denied', 'Admin privileges required.');
      setTimeout(() => window.location.href = '/dashboard.html', 1500);
      return null;
    }
    return this._user;
  },

  async logout() {
    try { await api.post('/auth/logout', {}); } catch {}
    this._user = null;
    window.location.href = '/login.html';
  },

  getRole() { return this._role; },

  // Store temp session data
  saveTemp(key, val) { sessionStorage.setItem(`ev_${key}`, JSON.stringify(val)); },
  getTemp(key) {
    const v = sessionStorage.getItem(`ev_${key}`);
    return v ? JSON.parse(v) : null;
  },
  clearTemp(key) { sessionStorage.removeItem(`ev_${key}`); },
};

// Expose to window so any inline handlers or external scripts can access
window.Auth = Auth;
window.api  = api;

// ─── Toast Notifications ─────────────────────────────────────────
function showToast(type, title, message, duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// ─── Button Loading State ─────────────────────────────────────────
function setBtnLoading(btn, loading, text = null) {
  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
    if (text) {
      const txtEl = btn.querySelector('.btn-text');
      if (txtEl) txtEl.textContent = text;
      else btn.textContent = text;
    }
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ─── Alert Helper ─────────────────────────────────────────────────
function showAlert(containerId, type, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const icons = { error: '⚠️', success: '✅', warning: '⚠️', info: 'ℹ️' };
  el.innerHTML = `
    <div class="alert alert-${type}">
      <span class="alert-icon">${icons[type]}</span>
      <span>${message}</span>
    </div>
  `;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearAlert(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '';
}

// ─── Date Helpers ─────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeUntil(iso) {
  if (!iso) return '';
  const diff = new Date(iso) - new Date();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86400000);
  const hrs  = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hrs}h remaining`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hrs}h ${mins}m remaining`;
}

// ─── Navbar ───────────────────────────────────────────────────────
async function initNavbar(activePage) {
  const navbar = document.getElementById('main-navbar');
  if (!navbar) return;

  const user = await Auth.getUser();

  // Highlight active nav link
  document.querySelectorAll('.navbar-nav a').forEach(a => {
    if (a.dataset.page === activePage) a.classList.add('active');
  });

  // Inject mobile toggle button if it doesn't exist
  let toggleBtn = navbar.querySelector('.navbar-toggle');
  if (!toggleBtn) {
    toggleBtn = document.createElement('button');
    toggleBtn.className = 'navbar-toggle';
    toggleBtn.setAttribute('aria-label', 'Toggle Navigation');
    toggleBtn.innerHTML = `
      <span class="bar"></span>
      <span class="bar"></span>
      <span class="bar"></span>
    `;
    const authAreaEl = navbar.querySelector('#navbar-auth');
    if (authAreaEl) {
      navbar.insertBefore(toggleBtn, authAreaEl);
    } else {
      navbar.appendChild(toggleBtn);
    }
    
    toggleBtn.addEventListener('click', () => {
      toggleBtn.classList.toggle('active');
      const navList = navbar.querySelector('.navbar-nav');
      if (navList) navList.classList.toggle('active');
    });
  }

  const authArea = document.getElementById('navbar-auth');
  if (authArea) {
    if (user) {
      authArea.innerHTML = `
        <span class="text-sm text-muted" style="margin-right:8px">
          👤 ${user.full_name.split(' ')[0]}
        </span>
        ${Auth.getRole() === 'admin' ? `<a href="/admin.html" class="btn btn-sm btn-ghost">⚙️ Admin</a>` : ''}
        <button id="navbar-logout-btn" class="btn btn-sm btn-ghost">Logout</button>
      `;
      // Attach listener after HTML is injected
      document.getElementById('navbar-logout-btn')
        ?.addEventListener('click', () => Auth.logout());
    } else {
      authArea.innerHTML = `<a href="/login.html" class="btn btn-sm btn-primary">🗳️ Login to Vote</a>`;
    }
  }
}

// ─── Number Counting Animation ────────────────────────────────────
function animateCount(el, target, duration = 1200) {
  const start = performance.now();
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(ease * target).toLocaleString('en-IN');
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}
