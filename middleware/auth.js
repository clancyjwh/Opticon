const { dbOperations } = require('../database');

// Middleware to check if user is authenticated
async function requireAuth(req, res, next) {
  try {
    const sessionId = req.cookies.session_id;

    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required', redirect: '/login' });
    }

    const session = await dbOperations.getSession(sessionId);

    if (!session) {
      res.clearCookie('session_id');
      return res.status(401).json({ error: 'Session expired', redirect: '/login' });
    }

    // Attach user_id to request
    req.userId = session.user_id;
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

// Optional auth - doesn't block if not authenticated
async function optionalAuth(req, res, next) {
  try {
    const sessionId = req.cookies.session_id;

    if (sessionId) {
      const session = await dbOperations.getSession(sessionId);
      if (session) {
        req.userId = session.user_id;
      }
    }

    next();

  } catch (error) {
    console.error('Optional auth error:', error);
    next();
  }
}

module.exports = { requireAuth, optionalAuth };
