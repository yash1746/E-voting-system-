const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * GET /api/elections — List elections
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    // Try to select with election_type, but fallback if the column doesn't exist yet
    let query = supabase.from('elections').select('id, title, description, candidates, start_date, end_date, status, election_type, eligible_districts, eligible_states');
    let { data: elections, error } = await query.order('start_date', { ascending: false });

    if (error && error.message.includes('election_type')) {
      // Fallback: the user likely hasn't run the SQL to add the column yet
      const fallback = await supabase.from('elections').select('id, title, description, candidates, start_date, end_date, status, eligible_districts, eligible_states').order('start_date', { ascending: false });
      elections = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;

    // Filter by state if voter role
    const filteredElections = req.role === 'admin' ? elections : elections.filter(e => {
      if (!e.eligible_states || e.eligible_states.length === 0) return true;
      return e.eligible_states.includes(req.voter.state);
    });

    if (filteredElections.length === 0) {
      return res.json({ elections: [] });
    }

    // For each election, check if this voter has already voted
    const electionIds = filteredElections.map(e => e.id);
    const { data: receipts } = await supabase
      .from('vote_receipts')
      .select('election_id')
      .eq('eligible_voter_id', req.voter.id)
      .in('election_id', electionIds);

    const votedSet = new Set((receipts || []).map(r => r.election_id));

    const enriched = filteredElections.map(e => ({
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
    const { title, description, candidates, election_type, start_date, end_date, eligible_districts, eligible_states } = req.body;

    if (!title || !candidates || !start_date || !end_date) {
      return res.status(400).json({ error: 'Title, candidates, start date, and end date are required.' });
    }

    const insertData = {
      title,
      description,
      candidates,
      start_date,
      end_date,
      eligible_districts: eligible_districts || [],
      eligible_states: eligible_states || [],
      status: new Date(start_date) <= new Date() ? 'active' : 'upcoming',
      created_by: req.voter.voter_id_number,
    };

    if (election_type) insertData.election_type = election_type;

    const { data: election, error } = await supabase
      .from('elections')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.message.includes('election_type')) {
        // Fallback for missing column
        delete insertData.election_type;
        const fallback = await supabase.from('elections').insert(insertData).select().single();
        if (fallback.error) throw fallback.error;
        return res.json({ success: true, election: fallback.data });
      }
      throw error;
    }

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
    if (!['upcoming', 'active', 'paused', 'closed'].includes(status)) {
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
 * PATCH /api/elections/:id — Admin: Update election
 */
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { data: election, error } = await supabase
      .from('elections')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      action: 'ELECTION_UPDATED',
      performed_by: req.voter.voter_id_number,
      details: { election_id: req.params.id, updated_fields: Object.keys(req.body) },
      ip_address: req.ip,
    });

    return res.json({ success: true, election });
  } catch (err) {
    console.error('Update election error:', err);
    res.status(500).json({ error: 'Failed to update election.' });
  }
});

/**
 * DELETE /api/elections/:id — Admin: Delete election (only if upcoming)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { data: election } = await supabase.from('elections').select('status, title').eq('id', req.params.id).single();
    if (!election) return res.status(404).json({ error: 'Election not found.' });
    
    // Only allow deleting closed or upcoming elections
    if (['active', 'paused'].includes(election.status)) {
      return res.status(400).json({ error: 'Cannot delete an active or paused election. Close it first.' });
    }

    const { error } = await supabase.from('elections').delete().eq('id', req.params.id);
    if (error) throw error;

    await supabase.from('audit_logs').insert({
      action: 'ELECTION_DELETED',
      performed_by: req.voter.voter_id_number,
      details: { election_id: req.params.id, title: election.title },
      ip_address: req.ip,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('Delete election error:', err);
    res.status(500).json({ error: 'Failed to delete election.' });
  }
});

module.exports = router;
