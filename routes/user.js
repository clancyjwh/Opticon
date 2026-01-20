const express = require('express');
const router = express.Router();
const { dbOperations } = require('../database');
const { requireAuth } = require('../middleware/auth');

// Get user's updates
router.get('/updates', requireAuth, async (req, res) => {
  try {
    const { search, source, minRelevance, limit } = req.query;

    const filters = {};
    if (search) filters.search = search;
    if (source) filters.source = source;
    if (minRelevance) filters.minRelevance = parseFloat(minRelevance);
    if (limit) filters.limit = parseInt(limit);

    const updates = await dbOperations.getUserUpdates(req.userId, filters);

    res.json({
      success: true,
      count: updates.length,
      updates
    });

  } catch (error) {
    console.error('Get updates error:', error);
    res.status(500).json({ error: 'Failed to fetch updates' });
  }
});

// Get user's sources
router.get('/sources', requireAuth, async (req, res) => {
  try {
    const sources = await dbOperations.getUserSources(req.userId);

    res.json({
      success: true,
      count: sources.length,
      sources
    });

  } catch (error) {
    console.error('Get sources error:', error);
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

// Get user's profiles
router.get('/profiles', requireAuth, async (req, res) => {
  try {
    const profiles = await dbOperations.getUserProfiles(req.userId);

    res.json({
      success: true,
      count: profiles.length,
      profiles
    });

  } catch (error) {
    console.error('Get profiles error:', error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

// Get user's account info
router.get('/account', requireAuth, async (req, res) => {
  try {
    const account = await dbOperations.getAccount(req.userId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({
      success: true,
      account
    });

  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

module.exports = router;
