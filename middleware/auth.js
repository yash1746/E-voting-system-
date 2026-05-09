const { supabase } = require('../config/supabase');

/**
 * Verify a session token and return voter info
 */
async function requireAuth(req, res, next) {
  const token = req.cookies?.session_token || req.headers['authorization']?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const { data: session, error } = await supabase
    .from('voter_sessions')
    .select('*, eligible_voters(*)')
    .eq('session_token', token)
    .eq('otp_verified', true)
    .single();

  if (error || !session) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  // Check session expiry
  if (new Date(session.expires_at) < new Date()) {
    await supabase.from('voter_sessions').delete().eq('id', session.id);
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  req.voter = session.eligible_voters;
  req.session = session;
  req.role = session.role;
  next();
}

/**
 * Require admin role
 */
async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
