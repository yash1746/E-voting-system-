// ─── Login / Auth Page Logic ───────────────────────────────────
let sessionToken = null;
let eligibleVoterId = null;
let timerInterval = null;

// ─── Step transitions ─────────────────────────────────────────
function goToStep(n) {
  ['step1','step2','step3'].forEach((id, i) => {
    document.getElementById(id).classList.toggle('hidden', i + 1 !== n);
  });
  ['step1-indicator','step2-indicator','step3-indicator'].forEach((id, i) => {
    const el = document.getElementById(id);
    el.classList.remove('active','done');
    if (i + 1 < n) el.classList.add('done');
    if (i + 1 === n) el.classList.add('active');
  });
  clearAlert('alert-area');
}

function backToStep1() {
  clearTimer();
  goToStep(1);
}

// ─── Step 1: Verify Voter ID ──────────────────────────────────
document.getElementById('voter-id-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('voter-id-input');
  const voterId = input.value.trim().toUpperCase();
  const btn = document.getElementById('verify-voter-btn');

  if (!voterId) {
    showAlert('alert-area', 'error', 'Please enter your Voter ID number.');
    return;
  }

  setBtnLoading(btn, true, 'Verifying...');
  clearAlert('alert-area');

  try {
    const data = await api.post('/auth/verify-voter', { voter_id: voterId });
    eligibleVoterId = data.eligible_voter_id;

    // Send OTP
    const otpData = await api.post('/auth/send-otp', { eligible_voter_id: eligibleVoterId });
    sessionToken = otpData.session_token;

    // Update UI
    document.getElementById('confirmed-name').textContent = data.full_name;
    document.getElementById('confirmed-district').textContent = `${data.district}, ${data.state}`;
    const contact = data.masked_email || data.masked_phone || 'your registered contact';
    document.getElementById('otp-sent-to').textContent = contact;

    if (otpData.demo_note) {
      showAlert('alert-area', 'info', `⚡ Demo Mode: Check the server console/terminal window for your OTP code.`);
    }

    goToStep(2);
    startTimer(10 * 60);
    setTimeout(() => document.querySelector('.otp-digit').focus(), 100);

    // Store temp data
    Auth.saveTemp('session_token', sessionToken);
    Auth.saveTemp('eligible_voter_id', eligibleVoterId);
    Auth.saveTemp('voter_name', data.full_name);

    // ── DEMO MODE: show OTP on screen and auto-fill ──────────────
    if (otpData.demo_otp) {
      const otp = otpData.demo_otp;
      // Auto-fill the boxes
      document.querySelectorAll('.otp-digit').forEach((inp, i) => {
        inp.value = otp[i] || '';
        inp.classList.toggle('filled', !!otp[i]);
      });
      // Show banner
      showAlert('alert-area', 'info',
        `⚡ <strong>Demo Mode</strong> — Your OTP is: <span style="font-size:22px; font-weight:900; letter-spacing:6px; color:var(--gold-light);">${otp}</span><br>
         <span style="font-size:12px; color:var(--text-muted);">(Auto-filled above. Configure email in .env to send real OTPs)</span>`
      );
    }
  } catch (err) {
    showAlert('alert-area', 'error', err.message);
  } finally {
    setBtnLoading(btn, false);
  }
});

// ─── OTP Input — Auto-advance & backspace ────────────────────
document.querySelectorAll('.otp-digit').forEach((input, i, inputs) => {
  input.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '');
    e.target.value = val;
    if (val) {
      e.target.classList.add('filled');
      if (i < inputs.length - 1) inputs[i + 1].focus();
    } else {
      e.target.classList.remove('filled');
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value && i > 0) {
      inputs[i - 1].focus();
      inputs[i - 1].value = '';
      inputs[i - 1].classList.remove('filled');
    }
  });
  input.addEventListener('paste', (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    inputs.forEach((inp, idx) => {
      inp.value = pasted[idx] || '';
      inp.classList.toggle('filled', !!pasted[idx]);
    });
    inputs[Math.min(pasted.length, 5)].focus();
    e.preventDefault();
  });
});

// ─── Step 2: Verify OTP ───────────────────────────────────────
document.getElementById('otp-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const otp = Array.from(document.querySelectorAll('.otp-digit')).map(i => i.value).join('');
  const btn = document.getElementById('verify-otp-btn');

  if (otp.length !== 6) {
    showAlert('alert-area', 'error', 'Please enter all 6 digits of the verification code.');
    return;
  }

  setBtnLoading(btn, true, 'Verifying...');
  clearAlert('alert-area');

  try {
    const storedToken = Auth.getTemp('session_token') || sessionToken;
    const data = await api.post('/auth/verify-otp', { session_token: storedToken, otp });

    clearTimer();
    document.getElementById('success-name').textContent = data.voter.full_name;

    // Mark step 2 done, step 3 active
    document.getElementById('step2-indicator').classList.remove('active');
    document.getElementById('step2-indicator').classList.add('done');
    document.getElementById('step3-indicator').classList.add('active');

    goToStep(3);
    showToast('success', 'Identity Verified!', `Welcome, ${data.voter.full_name}`);

    // Redirect after short delay
    setTimeout(() => {
      window.location.href = data.role === 'admin' ? '/admin.html' : '/dashboard.html';
    }, 2200);
  } catch (err) {
    showAlert('alert-area', 'error', err.message);
    // Clear OTP inputs on failure
    document.querySelectorAll('.otp-digit').forEach(i => { i.value = ''; i.classList.remove('filled'); });
    document.querySelector('.otp-digit').focus();
  } finally {
    setBtnLoading(btn, false);
  }
});

// ─── Resend OTP ───────────────────────────────────────────────
async function resendOTP() {
  const btn = document.getElementById('resend-btn');
  btn.disabled = true;
  btn.textContent = 'Sending...';
  clearAlert('alert-area');
  try {
    const id = Auth.getTemp('eligible_voter_id') || eligibleVoterId;
    const otpData = await api.post('/auth/send-otp', { eligible_voter_id: id });
    sessionToken = otpData.session_token;
    Auth.saveTemp('session_token', sessionToken);
    clearTimer();
    startTimer(10 * 60);
    document.querySelectorAll('.otp-digit').forEach(i => { i.value = ''; i.classList.remove('filled'); });
    document.querySelector('.otp-digit').focus();
    showToast('success', 'Code Resent', 'A new verification code has been sent.');
    if (otpData.demo_note) {
      showAlert('alert-area', 'info', '⚡ Demo Mode: Check server console for the new OTP.');
    }
  } catch (err) {
    showAlert('alert-area', 'error', err.message);
  } finally {
    setTimeout(() => { btn.disabled = false; btn.textContent = '🔄 Resend Code'; }, 30000);
  }
}

// ─── OTP Countdown Timer ──────────────────────────────────────
function startTimer(seconds) {
  clearTimer();
  const timerEl = document.getElementById('otp-timer');
  let remaining = seconds;
  updateTimerDisplay(remaining, timerEl);
  timerInterval = setInterval(() => {
    remaining--;
    updateTimerDisplay(remaining, timerEl);
    if (remaining <= 0) {
      clearTimer();
      timerEl.textContent = 'Expired';
      timerEl.style.color = 'var(--red)';
      showAlert('alert-area', 'warning', 'Your verification code has expired. Please click "Resend Code".');
    }
  }, 1000);
}

function clearTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimerDisplay(secs, el) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  el.textContent = `${m}:${s}`;
  el.style.color = secs < 60 ? 'var(--red)' : 'var(--gold-light)';
}

// ─── Redirect if already logged in ───────────────────────────
Auth.getUser().then(u => {
  if (u) window.location.href = '/dashboard.html';
});
