const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireAdmin } = require('../middleware/auth');

/**
 * GET /api/admin/voters — List eligible voters
 */
router.get('/voters', requireAdmin, async (req, res) => {
  try {
    const { data, count, error } = await supabase
      .from('eligible_voters')
      .select('id, full_name, voter_id_number, district, state, gender, is_active, registered_at', { count: 'exact' })
      .order('registered_at', { ascending: false });

    if (error) throw error;
    return res.json({ voters: data, total: count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch voters.' });
  }
});

/**
 * POST /api/admin/voters — Add a new eligible voter
 */
router.post('/voters', requireAdmin, async (req, res) => {
  try {
    const { full_name, voter_id_number, phone, email, district, state, date_of_birth, gender } = req.body;
    if (!full_name || !voter_id_number || !phone || !district || !state || !date_of_birth) {
      return res.status(400).json({ error: 'All required fields must be provided.' });
    }

    const { data, error } = await supabase
      .from('eligible_voters')
      .insert({ full_name, voter_id_number: voter_id_number.toUpperCase(), phone, email, district, state, date_of_birth, gender })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Voter ID already exists.' });
      throw error;
    }

    await supabase.from('audit_logs').insert({
      action: 'VOTER_ADDED',
      performed_by: req.voter.voter_id_number,
      details: { voter_id: voter_id_number },
      ip_address: req.ip,
    });

    return res.json({ success: true, voter: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add voter.' });
  }
});

/**
 * PATCH /api/admin/voters/:id/toggle — Activate / deactivate voter
 */
router.patch('/voters/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const { data: voter } = await supabase.from('eligible_voters').select('is_active').eq('id', req.params.id).single();
    if (!voter) return res.status(404).json({ error: 'Voter not found.' });

    const { data } = await supabase
      .from('eligible_voters')
      .update({ is_active: !voter.is_active })
      .eq('id', req.params.id)
      .select()
      .single();

    return res.json({ success: true, voter: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update voter status.' });
  }
});

/**
 * GET /api/admin/logs — Audit logs
 */
router.get('/logs', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return res.json({ logs: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

/**
 * GET /api/admin/stats — Dashboard statistics
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [voters, elections, votes, parties] = await Promise.all([
      supabase.from('eligible_voters').select('id', { count: 'exact' }),
      supabase.from('elections').select('id, status', { count: 'exact' }),
      supabase.from('votes').select('id', { count: 'exact' }),
      supabase.from('parties').select('id', { count: 'exact' }),
    ]);

    const electionsByStatus = {};
    (elections.data || []).forEach(e => {
      electionsByStatus[e.status] = (electionsByStatus[e.status] || 0) + 1;
    });

    return res.json({
      total_voters: voters.count || 0,
      total_elections: elections.count || 0,
      total_votes: votes.count || 0,
      total_parties: parties.count || 0,
      elections_by_status: electionsByStatus,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

/**
 * DELETE /api/admin/logs/:id — Delete a log entry
 */
router.delete('/logs/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('audit_logs').delete().eq('id', req.params.id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete log.' });
  }
});

module.exports = router;
