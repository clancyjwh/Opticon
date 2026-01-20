const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        business_description TEXT NOT NULL,
        topics TEXT NOT NULL,
        frequency TEXT NOT NULL,
        delivery_method TEXT NOT NULL,
        price REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sources table
    db.run(`
      CREATE TABLE IF NOT EXISTS sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        url TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        approved BOOLEAN DEFAULT 1,
        suggested_by_ai BOOLEAN DEFAULT 0,
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Preferences table
    db.run(`
      CREATE TABLE IF NOT EXISTS preferences (
        user_id TEXT PRIMARY KEY,
        relevance_threshold INTEGER DEFAULT 5,
        competitor_urls TEXT,
        keyword_alerts TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
  // Create new user
  createUser: (userData) => {
    return new Promise((resolve, reject) => {
      const { id, business_description, topics, frequency, delivery_method, price } = userData;
      const sql = `INSERT INTO users (id, business_description, topics, frequency, delivery_method, price)
                   VALUES (?, ?, ?, ?, ?, ?)`;

      db.run(sql, [id, business_description, topics, frequency, delivery_method, price], function(err) {
        if (err) reject(err);
        else resolve({ id });
      });
    });
  },

  // Get user by ID
  getUser: (userId) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  // Get all users
  getAllUsers: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM users ORDER BY created_at DESC', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  // Save sources
  saveSources: (userId, sources) => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare('INSERT INTO sources (user_id, url, name, description, approved, suggested_by_ai, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)');

      sources.forEach((source, index) => {
        stmt.run([
          userId,
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

  // Get user sources
  getUserSources: (userId) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM sources WHERE user_id = ? AND approved = 1 ORDER BY display_order', [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  // Save preferences
  savePreferences: (userId, preferences) => {
    return new Promise((resolve, reject) => {
      const { relevance_threshold, competitor_urls, keyword_alerts } = preferences;
      const sql = `INSERT OR REPLACE INTO preferences (user_id, relevance_threshold, competitor_urls, keyword_alerts, updated_at)
                   VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`;

      db.run(sql, [userId, relevance_threshold, competitor_urls, keyword_alerts], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  // Get preferences
  getPreferences: (userId) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM preferences WHERE user_id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

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

  // Get admin stats
  getAdminStats: () => {
    return new Promise((resolve, reject) => {
      const stats = {};

      // Total users
      db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
        if (err) return reject(err);
        stats.totalUsers = row.count;

        // Total MRR
        db.get('SELECT SUM(price) as mrr FROM users', [], (err, row) => {
          if (err) return reject(err);
          stats.totalMRR = row.mrr || 0;

          // Frequency breakdown
          db.all('SELECT frequency, COUNT(*) as count FROM users GROUP BY frequency', [], (err, rows) => {
            if (err) return reject(err);
            stats.frequencyBreakdown = rows;

            // Popular topics
            db.all('SELECT topics, COUNT(*) as count FROM users GROUP BY topics ORDER BY count DESC LIMIT 10', [], (err, rows) => {
              if (err) return reject(err);
              stats.popularTopics = rows;

              resolve(stats);
            });
          });
        });
      });
    });
  }
};

module.exports = { db, dbOperations };
