const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { dbOperations } = require('../database');
const { requireAuth } = require('../middleware/auth');

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { full_name, company_name, email, password } = req.body;

    // Validation
    if (!full_name || !company_name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const userId = uuidv4();

    // Create account
    await dbOperations.createAccount({
      user_id: userId,
      email,
      password,
      full_name,
      company_name
    });

    // Create session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await dbOperations.createSession({
      session_id: sessionId,
      user_id: userId,
      expires_at: expiresAt.toISOString()
    });

    // Set cookie
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      user_id: userId,
      message: 'Account created successfully'
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({ error: error.message || 'Signup failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Verify credentials
    const account = await dbOperations.verifyLogin(email, password);

    // Create session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await dbOperations.createSession({
      session_id: sessionId,
      user_id: account.user_id,
      expires_at: expiresAt.toISOString()
    });

    // Set cookie
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      user_id: account.user_id,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message || 'Login failed' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const sessionId = req.cookies.session_id;

    if (sessionId) {
      await dbOperations.deleteSession(sessionId);
    }

    res.clearCookie('session_id');
    res.json({ success: true, message: 'Logged out successfully' });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const account = await dbOperations.getAccount(req.userId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json(account);

  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get account info' });
  }
});

module.exports = router;
