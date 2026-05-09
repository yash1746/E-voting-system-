const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

/**
 * GET /api/parties — List all parties
 */
router.get('/', async (req, res) => {
  try {
    const { data: parties, error } = await supabase
      .from('parties')
      .select('*')
      .order('name');

    if (error) throw error;
    return res.json({ parties });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch parties.' });
  }
});

/**
 * GET /api/parties/:id — Party details
 */
router.get('/:id', async (req, res) => {
  try {
    const { data: party, error } = await supabase
      .from('parties')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !party) return res.status(404).json({ error: 'Party not found.' });
    return res.json({ party });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch party.' });
  }
});

/**
 * GET /api/parties/:id/actions — Party key actions
 */
router.get('/:id/actions', async (req, res) => {
  try {
    const { data: actions, error } = await supabase
      .from('party_actions')
      .select('*')
      .eq('party_id', req.params.id)
      .order('action_date', { ascending: false });

    if (error) throw error;
    return res.json({ actions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch party actions.' });
  }
});

/**
 * GET /api/parties/:id/speeches — Party speeches
 */
router.get('/:id/speeches', async (req, res) => {
  try {
    const { data: speeches, error } = await supabase
      .from('party_speeches')
      .select('*')
      .eq('party_id', req.params.id)
      .order('speech_date', { ascending: false });

    if (error) throw error;
    return res.json({ speeches });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch party speeches.' });
  }
});

module.exports = router;
