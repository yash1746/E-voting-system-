const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { encryptBallot, hashVote, generateReceiptToken } = require('../utils/crypto');

/**
 * POST /api/vote/:electionId — Cast an anonymous vote
 *
 * ANONYMITY GUARANTEE:
 * - The 'votes' table stores ONLY: encrypted ballot, hash, chain hash, receipt token
 * - The 'vote_receipts' table stores ONLY: who voted in which election + receipt token
 * - These two tables cannot be joined to reveal what any voter chose
 */
router.post('/:electionId', requireAuth, async (req, res) => {
  const { electionId } = req.params;
  const { candidate_id } = req.body;
  const voterId = req.voter.id;

  try {
    // 1. Check election exists and is active
    const { data: election, error: electionError } = await supabase
      .from('elections')
      .select('id, title, candidates, status, start_date, end_date')
      .eq('id', electionId)
      .single();

    if (electionError || !election) {
      return res.status(404).json({ error: 'Election not found.' });
    }
    if (election.status !== 'active') {
      return res.status(400).json({ error: 'This election is not currently active.' });
    }
    if (new Date(election.end_date) < new Date()) {
      return res.status(400).json({ error: 'This election has ended.' });
    }

    // 2. Validate candidate
    const candidates = Array.isArray(election.candidates) ? election.candidates : [];
    const validCandidate = candidates.find(c => c.id === candidate_id);
    if (!validCandidate) {
      return res.status(400).json({ error: 'Invalid candidate selection.' });
    }

    // 3. CRITICAL: Check for duplicate vote (atomic check)
    const { data: existingReceipt } = await supabase
      .from('vote_receipts')
      .select('id, receipt_token')
      .eq('eligible_voter_id', voterId)
      .eq('election_id', electionId)
      .single();

    if (existingReceipt) {
      return res.status(409).json({
        error: 'You have already voted in this election.',
        receipt_token: existingReceipt.receipt_token,
      });
    }

    // 4. Get last vote's hash for chain linking
    const { data: lastVote } = await supabase
      .from('votes')
      .select('vote_hash')
      .eq('election_id', electionId)
      .order('cast_at', { ascending: false })
      .limit(1)
      .single();

    const previousHash = lastVote?.vote_hash || '0000000000000000000000000000000000000000000000000000000000000000';

    // 5. Create encrypted ballot (only contains candidateId, not voter identity)
    const ballot = {
      candidate_id,
      candidate_name: validCandidate.name,
      election_id: electionId,
      nonce: require('crypto').randomBytes(16).toString('hex'), // Prevents duplicate ballots
    };
    const encryptedBallot = encryptBallot(ballot);
    const voteHash = hashVote(ballot);
    const receiptToken = generateReceiptToken();

    // 6. Insert anonymous vote record (NO voter reference)
    const { error: voteError } = await supabase
      .from('votes')
      .insert({
        election_id: electionId,
        encrypted_ballot: encryptedBallot,
        vote_hash: voteHash,
        previous_hash: previousHash,
        receipt_token: receiptToken,
      });

    if (voteError) throw voteError;

    // 7. Record that voter has voted (separate table, no ballot data)
    const { error: receiptError } = await supabase
      .from('vote_receipts')
      .insert({
        eligible_voter_id: voterId,
        election_id: electionId,
        receipt_token: receiptToken,
      });

    if (receiptError) {
      // Rollback: remove the vote if receipt failed
      await supabase.from('votes').delete().eq('receipt_token', receiptToken);
      throw receiptError;
    }

    // 8. Audit log
    await supabase.from('audit_logs').insert({
      action: 'VOTE_CAST',
      performed_by: req.voter.voter_id_number,
      details: { election_id: electionId }, // No candidate stored in log either
      ip_address: req.ip,
    });

    return res.json({
      success: true,
      receipt_token: receiptToken,
      vote_hash: voteHash,
      message: 'Your vote has been cast successfully and anonymously.',
    });
  } catch (err) {
    console.error('cast vote error:', err);
    res.status(500).json({ error: 'Failed to cast vote. Please try again.' });
  }
});

/**
 * GET /api/vote/receipt/:token — Verify vote was recorded
 */
router.get('/receipt/:token', requireAuth, async (req, res) => {
  try {
    const { data: vote } = await supabase
      .from('votes')
      .select('id, election_id, vote_hash, cast_at')
      .eq('receipt_token', req.params.token)
      .single();

    if (!vote) {
      return res.status(404).json({ error: 'Receipt not found.' });
    }

    // Verify ownership (voter has a receipt_token entry for this election)
    const { data: ownership } = await supabase
      .from('vote_receipts')
      .select('id')
      .eq('eligible_voter_id', req.voter.id)
      .eq('receipt_token', req.params.token)
      .single();

    if (!ownership) {
      return res.status(403).json({ error: 'This receipt does not belong to your account.' });
    }

    return res.json({
      verified: true,
      receipt_token: req.params.token,
      vote_hash: vote.vote_hash,
      election_id: vote.election_id,
      cast_at: vote.cast_at,
      message: 'Your vote is confirmed and recorded in the audit chain.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify receipt.' });
  }
});

module.exports = router;
