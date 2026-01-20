const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'opticon.db');

// Create and initialize database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeTables();
  }
});

function initializeTables() {
  db.serialize(() => {
    // Auth table - user accounts
    db.run(`
      CREATE TABLE IF NOT EXISTS auth (
        user_id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        company_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);

    // Sessions table
    db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES auth(user_id) ON DELETE CASCADE
      )
    `);

    // Users table - monitoring profiles
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        business_description TEXT NOT NULL,
        topics TEXT NOT NULL,
        frequency TEXT NOT NULL,
        delivery_method TEXT NOT NULL,
        price REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES auth(user_id) ON DELETE CASCADE
      )
    `);

    // Sources table
    db.run(`
      CREATE TABLE IF NOT EXISTS sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id TEXT NOT NULL,
        url TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        approved BOOLEAN DEFAULT 1,
        suggested_by_ai BOOLEAN DEFAULT 0,
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (profile_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Updates table
    db.run(`
      CREATE TABLE IF NOT EXISTS updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        source_url TEXT,
        source_name TEXT,
        relevance_score REAL DEFAULT 0,
        delivered BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivered_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES auth(user_id) ON DELETE CASCADE
      )
    `);

    // Preferences table
    db.run(`
      CREATE TABLE IF NOT EXISTS preferences (
        profile_id TEXT PRIMARY KEY,
        relevance_threshold INTEGER DEFAULT 5,
        competitor_urls TEXT,
        keyword_alerts TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (profile_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Webhook logs table
    db.run(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        webhook_type TEXT NOT NULL,
        payload TEXT,
        response TEXT,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables initialized');
  });
}

// Database operations
const dbOperations = {
  // ===== AUTH OPERATIONS =====

  // Create new user account
  createAccount: async (userData) => {
    return new Promise(async (resolve, reject) => {
      const { user_id, email, password, full_name, company_name } = userData;

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      const sql = `INSERT INTO auth (user_id, email, password_hash, full_name, company_name)
                   VALUES (?, ?, ?, ?, ?)`;

      db.run(sql, [user_id, email, password_hash, full_name, company_name], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            reject(new Error('Email already exists'));
          } else {
            reject(err);
          }
        } else {
          resolve({ user_id });
        }
      });
    });
  },

  // Verify login credentials
  verifyLogin: async (email, password) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM auth WHERE email = ?', [email], async (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          reject(new Error('Invalid email or password'));
        } else {
          const isValid = await bcrypt.compare(password, row.password_hash);
          if (isValid) {
            // Update last login
            db.run('UPDATE auth SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?', [row.user_id]);
            resolve(row);
          } else {
            reject(new Error('Invalid email or password'));
          }
        }
      });
    });
  },

  // Create session
  createSession: (sessionData) => {
    return new Promise((resolve, reject) => {
      const { session_id, user_id, expires_at } = sessionData;
      const sql = `INSERT INTO sessions (session_id, user_id, expires_at)
                   VALUES (?, ?, ?)`;

      db.run(sql, [session_id, user_id, expires_at], function(err) {
        if (err) reject(err);
        else resolve({ session_id });
      });
    });
  },

  // Get session
  getSession: (sessionId) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM sessions WHERE session_id = ? AND expires_at > CURRENT_TIMESTAMP',
        [sessionId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  // Delete session (logout)
  deleteSession: (sessionId) => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM sessions WHERE session_id = ?', [sessionId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  // Get account by user_id
  getAccount: (userId) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT user_id, email, full_name, company_name, created_at, last_login FROM auth WHERE user_id = ?',
        [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  // ===== PROFILE OPERATIONS =====

  // Create monitoring profile
  createProfile: (profileData) => {
    return new Promise((resolve, reject) => {
      const { id, user_id, business_description, topics, frequency, delivery_method, price } = profileData;
      const sql = `INSERT INTO users (id, user_id, business_description, topics, frequency, delivery_method, price)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`;

      db.run(sql, [id, user_id, business_description, topics, frequency, delivery_method, price], function(err) {
        if (err) reject(err);
        else resolve({ id });
      });
    });
  },

  // Get user profile
  getProfile: (profileId) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [profileId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  // Get all profiles for a user
  getUserProfiles: (userId) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM users WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  // ===== SOURCE OPERATIONS =====

  // Save sources
  saveSources: (profileId, sources) => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare('INSERT INTO sources (profile_id, url, name, description, approved, suggested_by_ai, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)');

      sources.forEach((source, index) => {
        stmt.run([
          profileId,
          source.url,
          source.name,
          source.description || '',
          source.approved !== false ? 1 : 0,
          source.suggested_by_ai ? 1 : 0,
          index
        ]);
      });

      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  // Get profile sources
  getProfileSources: (profileId) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM sources WHERE profile_id = ? AND approved = 1 ORDER BY display_order', [profileId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  // Get all sources for user (across all profiles)
  getUserSources: (userId) => {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT s.* FROM sources s
        JOIN users u ON s.profile_id = u.id
        WHERE u.user_id = ? AND s.approved = 1
        ORDER BY s.display_order
      `;
      db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  // ===== PREFERENCES OPERATIONS =====

  // Save preferences
  savePreferences: (profileId, preferences) => {
    return new Promise((resolve, reject) => {
      const { relevance_threshold, competitor_urls, keyword_alerts } = preferences;
      const sql = `INSERT OR REPLACE INTO preferences (profile_id, relevance_threshold, competitor_urls, keyword_alerts, updated_at)
                   VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`;

      db.run(sql, [profileId, relevance_threshold, competitor_urls, keyword_alerts], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  // Get preferences
  getPreferences: (profileId) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM preferences WHERE profile_id = ?', [profileId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  // ===== UPDATES OPERATIONS =====

  // Save update
  saveUpdate: (updateData) => {
    return new Promise((resolve, reject) => {
      const { user_id, title, content, source_url, source_name, relevance_score } = updateData;
      const sql = `INSERT INTO updates (user_id, title, content, source_url, source_name, relevance_score)
                   VALUES (?, ?, ?, ?, ?, ?)`;

      db.run(sql, [user_id, title, content, source_url, source_name, relevance_score || 0], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
  },

  // Get user updates
  getUserUpdates: (userId, filters = {}) => {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM updates WHERE user_id = ?';
      const params = [userId];

      if (filters.delivered !== undefined) {
        sql += ' AND delivered = ?';
        params.push(filters.delivered ? 1 : 0);
      }

      if (filters.minRelevance) {
        sql += ' AND relevance_score >= ?';
        params.push(filters.minRelevance);
      }

      if (filters.search) {
        sql += ' AND (title LIKE ? OR content LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm);
      }

      if (filters.source) {
        sql += ' AND source_name = ?';
        params.push(filters.source);
      }

      sql += ' ORDER BY created_at DESC';

      if (filters.limit) {
        sql += ' LIMIT ?';
        params.push(filters.limit);
      }

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  // Mark update as delivered
  markUpdateDelivered: (updateId) => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE updates SET delivered = 1, delivered_at = CURRENT_TIMESTAMP WHERE id = ?', [updateId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  // ===== WEBHOOK OPERATIONS =====

  // Log webhook
  logWebhook: (logData) => {
    return new Promise((resolve, reject) => {
      const { user_id, webhook_type, payload, response, status } = logData;
      const sql = `INSERT INTO webhook_logs (user_id, webhook_type, payload, response, status)
                   VALUES (?, ?, ?, ?, ?)`;

      db.run(sql, [user_id, webhook_type, JSON.stringify(payload), JSON.stringify(response), status], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  // ===== ADMIN OPERATIONS =====

  // Get admin stats
  getAdminStats: () => {
    return new Promise((resolve, reject) => {
      const stats = {};

      // Total accounts
      db.get('SELECT COUNT(*) as count FROM auth', [], (err, row) => {
        if (err) return reject(err);
        stats.totalAccounts = row.count;

        // Total profiles
        db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
          if (err) return reject(err);
          stats.totalProfiles = row.count;

          // Total MRR
          db.get('SELECT SUM(price) as mrr FROM users', [], (err, row) => {
            if (err) return reject(err);
            stats.totalMRR = row.mrr || 0;

            // Frequency breakdown
            db.all('SELECT frequency, COUNT(*) as count FROM users GROUP BY frequency', [], (err, rows) => {
              if (err) return reject(err);
              stats.frequencyBreakdown = rows;

              // Get all accounts
              db.all('SELECT user_id, email, full_name, company_name, created_at FROM auth ORDER BY created_at DESC', [], (err, rows) => {
                if (err) return reject(err);
                stats.accounts = rows;

                resolve(stats);
              });
            });
          });
        });
      });
    });
  }
};

module.exports = { db, dbOperations };
