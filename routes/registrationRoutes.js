const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireAdmin } = require('../middleware/auth');

/**
 * POST /api/register/apply — Public: Submit voter application
 */
router.post('/apply', async (req, res) => {
  try {
    const { full_name, voter_id_number, phone, email, date_of_birth, district, state } = req.body;

    if (!full_name || !voter_id_number || !phone || !date_of_birth || !district || !state) {
      return res.status(400).json({ error: 'All fields except email are required.' });
    }

    // Check if voter ID already exists in applications or registry
    const { data: existingApp } = await supabase
      .from('voter_applications')
      .select('id')
      .eq('voter_id_number', voter_id_number)
      .eq('status', 'pending')
      .single();

    if (existingApp) {
      return res.status(409).json({ error: 'An application for this Voter ID is already pending.' });
    }

    const { data: existingVoter } = await supabase
      .from('eligible_voters')
      .select('id')
      .eq('voter_id_number', voter_id_number)
      .single();

    if (existingVoter) {
      return res.status(409).json({ error: 'This Voter ID is already registered in the system.' });
    }

    const { error } = await supabase
      .from('voter_applications')
      .insert({
        full_name,
        voter_id_number,
        phone,
        email,
        date_of_birth,
        district,
        state,
      });

    if (error) throw error;

    return res.json({ success: true, message: 'Application submitted successfully. An administrator will review it shortly.' });
  } catch (err) {
    console.error('registration application error:', err);
    res.status(500).json({ error: 'Failed to submit application. Please try again.' });
  }
});

/**
 * GET /api/register/pending — Admin: List pending applications
 */
router.get('/pending', requireAdmin, async (req, res) => {
  try {
    const { data: applications, error } = await supabase
      .from('voter_applications')
      .select('*')
      .eq('status', 'pending')
      .order('applied_at', { ascending: false });

    if (error) throw error;
    return res.json({ applications });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending applications.' });
  }
});

/**
 * POST /api/register/review — Admin: Approve or reject application
 */
router.post('/review', requireAdmin, async (req, res) => {
  const { id, action } = req.body; // action: 'approved' | 'rejected'

  if (!id || !['approved', 'rejected'].includes(action)) {
    return res.status(400).json({ error: 'Invalid review action.' });
  }

  try {
    const { data: app, error: fetchError } = await supabase
      .from('voter_applications')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !app) return res.status(404).json({ error: 'Application not found.' });

    if (action === 'approved') {
      // 1. Add to eligible_voters
      const { error: insertError } = await supabase
        .from('eligible_voters')
        .insert({
          full_name: app.full_name,
          voter_id_number: app.voter_id_number,
          phone: app.phone,
          email: app.email,
          date_of_birth: app.date_of_birth,
          district: app.district,
          state: app.state,
          is_active: true,
        });

      if (insertError) throw insertError;
    }

    // 2. Update application status
    const { error: updateError } = await supabase
      .from('voter_applications')
      .update({
        status: action,
        reviewed_by: req.voter.voter_id_number,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // 3. Log audit
    await supabase.from('audit_logs').insert({
      action: `VOTER_REGISTRATION_${action.toUpperCase()}`,
      performed_by: req.voter.voter_id_number,
      details: { voter_id_number: app.voter_id_number, application_id: id },
      ip_address: req.ip,
    });

    return res.json({ success: true, message: `Application ${action} successfully.` });
  } catch (err) {
    console.error('review application error:', err);
    res.status(500).json({ error: 'Failed to process review.' });
  }
});

module.exports = router;
