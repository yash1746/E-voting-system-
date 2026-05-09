const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * GET /api/elections — List elections
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data: elections, error } = await supabase
      .from('elections')
      .select('id, title, description, candidates, start_date, end_date, status, eligible_districts')
      .order('start_date', { ascending: false });

    if (error) throw error;

    // For each election, check if this voter has already voted
    const electionIds = elections.map(e => e.id);
    const { data: receipts } = await supabase
      .from('vote_receipts')
      .select('election_id')
      .eq('eligible_voter_id', req.voter.id)
      .in('election_id', electionIds);

    const votedSet = new Set((receipts || []).map(r => r.election_id));

    const enriched = elections.map(e => ({
      ...e,
      has_voted: votedSet.has(e.id),
      candidate_count: Array.isArray(e.candidates) ? e.candidates.length : 0,
    }));

    return res.json({ elections: enriched });
  } catch (err) {
    console.error('list elections error:', err);
    res.status(500).json({ error: 'Failed to fetch elections.' });
  }
});

/**
 * GET /api/elections/:id — Get election details
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: election, error } = await supabase
      .from('elections')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !election) {
      return res.status(404).json({ error: 'Election not found.' });
    }

    // Check if voter has already voted
    const { data: receipt } = await supabase
      .from('vote_receipts')
      .select('id, voted_at, receipt_token')
      .eq('eligible_voter_id', req.voter.id)
      .eq('election_id', req.params.id)
      .single();

    // Count total votes
    const { count } = await supabase
      .from('votes')
      .select('id', { count: 'exact' })
      .eq('election_id', req.params.id);

    return res.json({
      election,
      has_voted: !!receipt,
      receipt_token: receipt?.receipt_token || null,
      voted_at: receipt?.voted_at || null,
      total_votes: count || 0,
    });
  } catch (err) {
    console.error('get election error:', err);
    res.status(500).json({ error: 'Failed to fetch election details.' });
  }
});

/**
 * POST /api/elections — Admin: Create election
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { title, description, candidates, start_date, end_date, eligible_districts } = req.body;

    if (!title || !candidates || !start_date || !end_date) {
      return res.status(400).json({ error: 'Title, candidates, start date, and end date are required.' });
    }

    const { data: election, error } = await supabase
      .from('elections')
      .insert({
        title,
        description,
        candidates,
        start_date,
        end_date,
        eligible_districts: eligible_districts || [],
        status: new Date(start_date) <= new Date() ? 'active' : 'upcoming',
        created_by: req.voter.voter_id_number,
      })
      .select()
      .single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      action: 'ELECTION_CREATED',
      performed_by: req.voter.voter_id_number,
      details: { election_id: election.id, title },
      ip_address: req.ip,
    });

    return res.json({ success: true, election });
  } catch (err) {
    console.error('create election error:', err);
    res.status(500).json({ error: 'Failed to create election.' });
  }
});

/**
 * PATCH /api/elections/:id/status — Admin: Update election status
 */
router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['upcoming', 'active', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const { data: election, error } = await supabase
      .from('elections')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      action: `ELECTION_STATUS_CHANGED_TO_${status.toUpperCase()}`,
      performed_by: req.voter.voter_id_number,
      details: { election_id: req.params.id },
      ip_address: req.ip,
    });

    return res.json({ success: true, election });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update election status.' });
  }
});

/**
 * DELETE /api/elections/:id — Admin: Delete election (only if upcoming)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { data: election } = await supabase.from('elections').select('status').eq('id', req.params.id).single();
    if (!election) return res.status(404).json({ error: 'Election not found.' });
    if (election.status !== 'upcoming') return res.status(400).json({ error: 'Only upcoming elections can be deleted.' });

    await supabase.from('elections').delete().eq('id', req.params.id);
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete election.' });
  }
});

module.exports = router;
