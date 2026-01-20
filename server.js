require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { dbOperations } = require('./database');
const perplexityService = require('./services/perplexity');
const pricingService = require('./services/pricing');
const makeWebhook = require('./services/make-webhook');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(limiter);
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API: Suggest topics based on business description
app.post('/api/suggest-topics', async (req, res) => {
  try {
    const { business_description } = req.body;

    if (!business_description) {
      return res.status(400).json({ error: 'Business description is required' });
    }

    const topics = await perplexityService.suggestTopics(business_description);

    res.json({ success: true, topics });

  } catch (error) {
    console.error('Error suggesting topics:', error.message);
    res.status(500).json({
      error: 'Failed to suggest topics',
      details: error.message
    });
  }
});

// API: Suggest sources based on business and topics
app.post('/api/suggest-sources', async (req, res) => {
  try {
    const { business_description, topics } = req.body;

    if (!business_description || !topics) {
      return res.status(400).json({ error: 'Business description and topics are required' });
    }

    const sources = await perplexityService.suggestSources(business_description, topics);

    res.json({ success: true, sources });

  } catch (error) {
    console.error('Error suggesting sources:', error.message);
    res.status(500).json({
      error: 'Failed to suggest sources',
      details: error.message
    });
  }
});

// API: Find competitor sources
app.post('/api/find-competitors', async (req, res) => {
  try {
    const { competitor_names } = req.body;

    if (!competitor_names) {
      return res.status(400).json({ error: 'Competitor names are required' });
    }

    const competitors = await perplexityService.findCompetitors(competitor_names);

    res.json({ success: true, competitors });

  } catch (error) {
    console.error('Error finding competitors:', error.message);
    res.status(500).json({
      error: 'Failed to find competitors',
      details: error.message
    });
  }
});

// API: Calculate pricing
app.post('/api/calculate-price', (req, res) => {
  try {
    const { frequency, sources_count, delivery_method } = req.body;

    if (!frequency || sources_count === undefined || !delivery_method) {
      return res.status(400).json({ error: 'All pricing parameters are required' });
    }

    const pricing = pricingService.calculatePrice({
      frequency,
      sources_count: parseInt(sources_count),
      delivery_method
    });

    res.json({ success: true, pricing });

  } catch (error) {
    console.error('Error calculating price:', error.message);
    res.status(500).json({
      error: 'Failed to calculate price',
      details: error.message
    });
  }
});

// API: Submit complete profile
app.post('/api/submit-profile', async (req, res) => {
  try {
    const {
      business_description,
      topics,
      frequency,
      delivery_method,
      approved_sources,
      preferences
    } = req.body;

    // Validation
    if (!business_description || !topics || !frequency || !delivery_method || !approved_sources) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    // Generate user ID
    const userId = uuidv4();

    // Calculate price
    const pricing = pricingService.calculatePrice({
      frequency,
      sources_count: approved_sources.length,
      delivery_method
    });

    // Save user
    await dbOperations.createUser({
      id: userId,
      business_description,
      topics: Array.isArray(topics) ? topics.join(', ') : topics,
      frequency,
      delivery_method,
      price: pricing.total
    });

    // Save sources
    await dbOperations.saveSources(userId, approved_sources);

    // Save preferences if provided
    if (preferences) {
      await dbOperations.savePreferences(userId, {
        relevance_threshold: preferences.relevance_threshold || 5,
        competitor_urls: preferences.competitor_urls || '',
        keyword_alerts: preferences.keyword_alerts || ''
      });
    }

    // Send to Make.com webhook
    const webhookPayload = {
      user_id: userId,
      business_description,
      topics: Array.isArray(topics) ? topics : topics.split(',').map(t => t.trim()),
      frequency,
      delivery_method,
      price: pricing.total,
      approved_sources: approved_sources.map(s => ({
        name: s.name,
        url: s.url,
        description: s.description
      })),
      preferences: preferences || {},
      timestamp: new Date().toISOString()
    };

    let makeResponse = null;
    try {
      makeResponse = await makeWebhook.sendProfileToMake(webhookPayload);

      await dbOperations.logWebhook({
        user_id: userId,
        webhook_type: 'profile_submission',
        payload: webhookPayload,
        response: makeResponse,
        status: 'success'
      });
    } catch (webhookError) {
      console.error('Make.com webhook error:', webhookError.message);

      await dbOperations.logWebhook({
        user_id: userId,
        webhook_type: 'profile_submission',
        payload: webhookPayload,
        response: { error: webhookError.message },
        status: 'failed'
      });
    }

    res.json({
      success: true,
      user_id: userId,
      pricing,
      message: 'Profile created successfully',
      make_status: makeResponse ? 'sent' : 'pending'
    });

  } catch (error) {
    console.error('Error submitting profile:', error.message);
    res.status(500).json({
      error: 'Failed to submit profile',
      details: error.message
    });
  }
});

// API: Receive updates from Make.com
app.post('/api/receive-updates', async (req, res) => {
  try {
    const { user_id, updates } = req.body;

    if (!user_id || !updates || !Array.isArray(updates)) {
      return res.status(400).json({ error: 'user_id and updates array are required' });
    }

    // Verify user exists
    const user = await dbOperations.getUser(user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user preferences for filtering
    const preferences = await dbOperations.getPreferences(user_id);
    const threshold = preferences?.relevance_threshold || 5;

    // Save updates
    const savedUpdates = [];
    for (const update of updates) {
      // Only save if relevance score meets threshold
      const relevanceScore = update.relevance_score || 5;

      if (relevanceScore >= threshold) {
        const saved = await dbOperations.saveUpdate({
          user_id,
          title: update.title,
          content: update.content || update.description || '',
          source_url: update.url || update.source_url || '',
          source_name: update.source || update.source_name || '',
          relevance_score: relevanceScore
        });
        savedUpdates.push(saved);
      }
    }

    // Log webhook
    await dbOperations.logWebhook({
      user_id,
      webhook_type: 'receive_updates',
      payload: req.body,
      response: { saved_count: savedUpdates.length },
      status: 'success'
    });

    res.json({
      success: true,
      message: `Received ${updates.length} updates, saved ${savedUpdates.length} (threshold: ${threshold})`,
      updates_received: updates.length,
      updates_saved: savedUpdates.length
    });

  } catch (error) {
    console.error('Error receiving updates:', error.message);
    res.status(500).json({
      error: 'Failed to process updates',
      details: error.message
    });
  }
});

// API: Get user updates
app.get('/api/updates/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit, minRelevance } = req.query;

    const filters = {};
    if (limit) filters.limit = parseInt(limit);
    if (minRelevance) filters.minRelevance = parseFloat(minRelevance);

    const updates = await dbOperations.getUserUpdates(userId, filters);

    res.json({
      success: true,
      count: updates.length,
      updates
    });

  } catch (error) {
    console.error('Error fetching updates:', error.message);
    res.status(500).json({
      error: 'Failed to fetch updates',
      details: error.message
    });
  }
});

// API: Get user profile
app.get('/api/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await dbOperations.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const sources = await dbOperations.getUserSources(userId);
    const preferences = await dbOperations.getPreferences(userId);

    res.json({
      success: true,
      user,
      sources,
      preferences
    });

  } catch (error) {
    console.error('Error fetching profile:', error.message);
    res.status(500).json({
      error: 'Failed to fetch profile',
      details: error.message
    });
  }
});

// API: Admin stats
app.get('/api/admin/stats', async (req, res) => {
  try {
    const stats = await dbOperations.getAdminStats();
    const users = await dbOperations.getAllUsers();

    res.json({
      success: true,
      stats: {
        ...stats,
        averagePrice: stats.totalUsers > 0 ? stats.totalMRR / stats.totalUsers : 0
      },
      users
    });

  } catch (error) {
    console.error('Error fetching admin stats:', error.message);
    res.status(500).json({
      error: 'Failed to fetch admin stats',
      details: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Opticon API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
});

module.exports = app;
