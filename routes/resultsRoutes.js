const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { decryptBallot, verifyHashChain } = require('../utils/crypto');

/**
 * GET /api/results/:electionId — Get election results (only after closed)
 */
router.get('/:electionId', requireAuth, async (req, res) => {
  try {
    const { data: election } = await supabase
      .from('elections')
      .select('*')
      .eq('id', req.params.electionId)
      .single();

    if (!election) return res.status(404).json({ error: 'Election not found.' });

    // Only admin or closed elections show results
    if (election.status !== 'closed' && req.role !== 'admin') {
      return res.status(403).json({ error: 'Results are only available after the election is closed.' });
    }

    // Get all votes
    const { data: votes } = await supabase
      .from('votes')
      .select('encrypted_ballot, vote_hash, previous_hash, cast_at')
      .eq('election_id', req.params.electionId)
      .order('cast_at', { ascending: true });

    // Tally votes by decrypting each ballot
    const tally = {};
    const candidates = Array.isArray(election.candidates) ? election.candidates : [];
    candidates.forEach(c => { tally[c.id] = { ...c, votes: 0 }; });

    let decryptErrors = 0;
    (votes || []).forEach(vote => {
      const ballot = decryptBallot(vote.encrypted_ballot);
      if (ballot && tally[ballot.candidate_id] !== undefined) {
        tally[ballot.candidate_id].votes++;
      } else {
        decryptErrors++;
      }
    });

    const totalVotes = (votes || []).length;
    const results = Object.values(tally)
      .sort((a, b) => b.votes - a.votes)
      .map((c, i) => ({
        rank: i + 1,
        candidate_id: c.id,
        name: c.name,
        party: c.party,
        symbol: c.symbol,
        color: c.color,
        votes: c.votes,
        percentage: totalVotes > 0 ? ((c.votes / totalVotes) * 100).toFixed(2) : '0.00',
      }));

    // Verify hash chain integrity
    const chainCheck = verifyHashChain(votes || []);

    return res.json({
      election: {
        id: election.id,
        title: election.title,
        status: election.status,
        start_date: election.start_date,
        end_date: election.end_date,
      },
      results,
      total_votes: totalVotes,
      winner: results[0] || null,
      chain_integrity: chainCheck,
      decrypt_errors: decryptErrors,
    });
  } catch (err) {
    console.error('results error:', err);
    res.status(500).json({ error: 'Failed to fetch results.' });
  }
});

/**
 * GET /api/results/:electionId/audit — Public hash chain for transparency
 */
router.get('/:electionId/audit', async (req, res) => {
  try {
    const { data: election } = await supabase
      .from('elections')
      .select('id, title, status')
      .eq('id', req.params.electionId)
      .single();

    if (!election) return res.status(404).json({ error: 'Election not found.' });

    const { data: votes } = await supabase
      .from('votes')
      .select('id, vote_hash, previous_hash, cast_at')  // NO encrypted_ballot in public endpoint
      .eq('election_id', req.params.electionId)
      .order('cast_at', { ascending: true });

    const chainCheck = verifyHashChain(votes || []);

    return res.json({
      election,
      total_votes: (votes || []).length,
      chain_valid: chainCheck.valid,
      broken_at: chainCheck.brokenAt,
      chain: (votes || []).map((v, i) => ({
        index: i + 1,
        vote_hash: v.vote_hash,
        previous_hash: v.previous_hash,
        cast_at: v.cast_at,
        valid_link: i === 0 ? true : v.previous_hash === (votes[i - 1]?.vote_hash || null),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit data.' });
  }
});

module.exports = router;
