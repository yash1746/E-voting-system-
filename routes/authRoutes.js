const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { generateOTP, generateSessionToken } = require('../utils/crypto');
const { sendOTP } = require('../utils/mailer');

/**
 * POST /api/auth/verify-voter
 * Step 1: Voter enters their Voter ID — verify against registry
 */
router.post('/verify-voter', async (req, res) => {
  try {
    const { voter_id } = req.body;

    if (!voter_id || voter_id.trim().length < 5) {
      return res.status(400).json({ error: 'Please enter a valid Voter ID number.' });
    }

    const { data: voter, error } = await supabase
      .from('eligible_voters')
      .select('id, full_name, phone, email, voter_id_number, district, state, constituency, is_active')
      .eq('voter_id_number', voter_id.trim().toUpperCase())
      .single();

    if (error || !voter) {
      // Log failed attempt
      await supabase.from('audit_logs').insert({
        action: 'VOTER_ID_NOT_FOUND',
        performed_by: 'system',
        details: { voter_id_attempted: voter_id },
        ip_address: req.ip,
      });
      return res.status(404).json({ error: 'Voter ID not found in the electoral registry. Please check your Voter Card.' });
    }

    if (!voter.is_active) {
      return res.status(403).json({ error: 'This voter ID has been deactivated. Please contact the Electoral Commission.' });
    }

    // Mask phone and email for privacy
    const maskedPhone = voter.phone ? voter.phone.replace(/(\+\d{2}-\d{2})\d+(\d{4})/, '$1****$2') : null;
    const maskedEmail = voter.email ? voter.email.replace(/(.{2}).+(@.+)/, '$1****$2') : null;

    return res.json({
      success: true,
      voter_id: voter.voter_id_number,
      eligible_voter_id: voter.id,
      full_name: voter.full_name,
      district: voter.district,
      state: voter.state,
      constituency: voter.constituency,
      masked_phone: maskedPhone,
      masked_email: maskedEmail,
      delivery_method: voter.email ? 'email' : 'phone',
    });
  } catch (err) {
    console.error('verify-voter error:', err);
    res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
});

/**
 * POST /api/auth/send-otp
 * Step 2: Send OTP to voter's registered contact
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { eligible_voter_id } = req.body;

    if (!eligible_voter_id) {
      return res.status(400).json({ error: 'Voter verification required first.' });
    }

    const { data: voter, error } = await supabase
      .from('eligible_voters')
      .select('id, full_name, email, phone, voter_id_number')
      .eq('id', eligible_voter_id)
      .single();

    if (error || !voter) {
      return res.status(404).json({ error: 'Voter not found.' });
    }

    const otp = generateOTP();
    const sessionToken = generateSessionToken();
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '10');
    const otpExpiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

    // Delete old sessions for this voter
    await supabase.from('voter_sessions').delete().eq('eligible_voter_id', eligible_voter_id);

    // Determine role — voter IDs starting with 'ADMIN' get admin role
    const sessionRole = voter.voter_id_number.startsWith('ADMIN') ? 'admin' : 'voter';

    // Create new session with correct role
    const { error: sessionError } = await supabase.from('voter_sessions').insert({
      eligible_voter_id: voter.id,
      session_token: sessionToken,
      otp_code: otp,
      otp_expires_at: otpExpiresAt,
      otp_verified: false,
      role: sessionRole,
      ip_address: req.ip,
    });

    if (sessionError) {
      throw sessionError;
    }

    // Send OTP
    const contactEmail = voter.email || null;
    await sendOTP(contactEmail, voter.full_name, otp, expiryMinutes);

    await supabase.from('audit_logs').insert({
      action: 'OTP_SENT',
      performed_by: voter.id,
      details: { method: contactEmail ? 'email' : 'phone' },
      ip_address: req.ip,
    });

    const isDemoMode = !process.env.EMAIL_USER || process.env.EMAIL_USER === 'your-email@gmail.com';

    return res.json({
      success: true,
      session_token: sessionToken,
      message: `Verification code sent. Valid for ${expiryMinutes} minutes.`,
      demo_note: isDemoMode ? 'DEMO MODE – email not configured' : null,
      // In demo mode, return OTP so the login page can display it directly
      demo_otp: isDemoMode ? otp : null,
    });
  } catch (err) {
    console.error('send-otp error:', err);
    res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

/**
 * POST /api/auth/verify-otp
 * Step 3: Verify OTP and create authenticated session
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { session_token, otp } = req.body;

    if (!session_token || !otp) {
      return res.status(400).json({ error: 'Session token and OTP are required.' });
    }

    const { data: session, error } = await supabase
      .from('voter_sessions')
      .select('*, eligible_voters(*)')
      .eq('session_token', session_token)
      .eq('otp_verified', false)
      .single();

    if (error || !session) {
      return res.status(401).json({ error: 'Invalid session. Please restart the login process.' });
    }

    if (new Date(session.otp_expires_at) < new Date()) {
      return res.status(401).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    if (session.otp_code !== otp.trim()) {
      await supabase.from('audit_logs').insert({
        action: 'OTP_FAILED',
        performed_by: session.eligible_voter_id,
        details: { attempt: otp },
        ip_address: req.ip,
      });
      return res.status(401).json({ error: 'Incorrect verification code. Please try again.' });
    }

    // Mark session as verified
    await supabase.from('voter_sessions').update({
      otp_verified: true,
      otp_code: null, // Clear OTP after use
    }).eq('id', session.id);

    const voter = session.eligible_voters;

    await supabase.from('audit_logs').insert({
      action: 'LOGIN_SUCCESS',
      performed_by: voter.voter_id_number,
      details: { name: voter.full_name },
      ip_address: req.ip,
    });

    // Set session cookie
    res.cookie('session_token', session_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    return res.json({
      success: true,
      voter: {
        id: voter.id,
        full_name: voter.full_name,
        voter_id_number: voter.voter_id_number,
        district: voter.district,
        state: voter.state,
      },
      role: session.role,
      message: 'Identity verified successfully. Welcome to the National E-Voting System.',
    });
  } catch (err) {
    console.error('verify-otp error:', err);
    res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', async (req, res) => {
  const token = req.cookies?.session_token || req.headers['authorization']?.replace('Bearer ', '');
  if (token) {
    await supabase.from('voter_sessions').delete().eq('session_token', token);
  }
  res.clearCookie('session_token');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * GET /api/auth/me
 */
router.get('/me', async (req, res) => {
  const token = req.cookies?.session_token || req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const { data: session } = await supabase
    .from('voter_sessions')
    .select('*, eligible_voters(*)')
    .eq('session_token', token)
    .eq('otp_verified', true)
    .single();

  if (!session || new Date(session.expires_at) < new Date()) {
    return res.status(401).json({ error: 'Session expired' });
  }

  const voter = session.eligible_voters;
  return res.json({
    voter: {
      id: voter.id,
      full_name: voter.full_name,
      voter_id_number: voter.voter_id_number,
      district: voter.district,
      state: voter.state,
      constituency: voter.constituency,
    },
    role: session.role,
  });
});

module.exports = router;
