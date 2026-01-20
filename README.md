# 🔍 Opticon - Intelligent Event Monitoring SaaS

Opticon is a production-ready SaaS platform that automatically monitors the web for business-relevant events and updates. Users describe their business and topics of interest, and Opticon uses AI to discover sources, monitor them continuously, and deliver curated updates.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/clancyjwh/Opticon)

## 🎯 Features

### For End Users
- **AI-Powered Onboarding**: Multi-step guided setup with smart topic and source suggestions
- **Source Discovery**: Perplexity AI automatically finds the 8-10 most relevant monitoring sources
- **Customization**: Adjust update frequency, relevance threshold, and delivery method
- **Competitor Tracking**: Automatically discover and monitor competitor web presence
- **Keyword Alerts**: Get instant notifications for critical keywords
- **Updates Dashboard**: View all updates with filtering and relevance scoring

### For Business
- **Subscription Pricing**: Dynamic pricing calculator based on frequency, sources, and delivery
- **Admin Dashboard**: Monitor MRR, user count, and key metrics
- **Make.com Integration**: Flexible webhook system for monitoring automation
- **Scalable Architecture**: Built for growth with serverless deployment

## 🏗️ Architecture

```
User → Onboarding → Perplexity AI → Source Suggestions
                         ↓
                   User Approval
                         ↓
                  Make.com Webhook (Profile)
                         ↓
              Make.com (Monitoring/Scraping/AI Filtering)
                         ↓
                 Opticon Webhook (/receive-updates)
                         ↓
                  SQLite Database → Delivery
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Perplexity API key ([Get one](https://www.perplexity.ai/))
- Make.com account (optional for now)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/clancyjwh/Opticon.git
   cd Opticon
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your API keys:
   ```env
   PERPLEXITY_API_KEY=your_actual_api_key
   MAKECOM_WEBHOOK_URL=https://hook.make.com/your_webhook
   PORT=3000
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

### Deploy to Vercel

#### One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/clancyjwh/Opticon)

#### Manual Deploy

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

3. **Set environment variables** in Vercel dashboard:
   - Go to your project → Settings → Environment Variables
   - Add `PERPLEXITY_API_KEY`
   - Add `MAKECOM_WEBHOOK_URL`

4. **Redeploy** after adding environment variables

## 📋 API Endpoints

### User-Facing Endpoints

#### POST `/api/suggest-topics`
Suggests monitoring topics based on business description using Perplexity AI.

**Request:**
```json
{
  "business_description": "Vancouver property management company managing 200+ units"
}
```

**Response:**
```json
{
  "success": true,
  "topics": [
    {
      "topic": "BC rental regulations",
      "category": "regulatory",
      "description": "Track changes in BC tenancy laws"
    }
  ]
}
```

#### POST `/api/suggest-sources`
Finds 8-10 authoritative sources for monitoring.

**Request:**
```json
{
  "business_description": "Vancouver property management...",
  "topics": "BC rental regulations, housing policy, tenant law"
}
```

**Response:**
```json
{
  "success": true,
  "sources": [
    {
      "name": "BC Housing Authority",
      "url": "https://www.bchousing.org",
      "description": "Official BC housing policies",
      "category": "government"
    }
  ]
}
```

#### POST `/api/find-competitors`
Discovers competitor web presence.

**Request:**
```json
{
  "competitor_names": "Airbnb, VRBO"
}
```

**Response:**
```json
{
  "success": true,
  "competitors": [
    {
      "name": "Airbnb",
      "website": "https://airbnb.com",
      "blog": "https://blog.airbnb.com",
      "press": "https://press.airbnb.com"
    }
  ]
}
```

#### POST `/api/calculate-price`
Calculates subscription pricing in real-time.

**Request:**
```json
{
  "frequency": "daily",
  "sources_count": 8,
  "delivery_method": "email"
}
```

**Response:**
```json
{
  "success": true,
  "pricing": {
    "breakdown": {
      "base_price": 10,
      "frequency_multiplier": 3,
      "base_with_frequency": 30,
      "sources_cost": 16,
      "delivery_cost": 0
    },
    "total": 46,
    "annually": 552
  }
}
```

#### POST `/api/submit-profile`
Submits complete user profile and sends to Make.com.

**Request:**
```json
{
  "business_description": "...",
  "topics": ["topic1", "topic2"],
  "frequency": "daily",
  "delivery_method": "email",
  "approved_sources": [
    {
      "name": "Source Name",
      "url": "https://...",
      "description": "..."
    }
  ],
  "preferences": {
    "relevance_threshold": 7,
    "competitor_urls": "https://competitor.com",
    "keyword_alerts": "lawsuit, acquisition"
  }
}
```

**Response:**
```json
{
  "success": true,
  "user_id": "uuid-here",
  "pricing": {...},
  "message": "Profile created successfully",
  "make_status": "sent"
}
```

### Webhook Endpoints

#### POST `/api/receive-updates`
Receives updates from Make.com monitoring scenarios.

**Request (from Make.com):**
```json
{
  "user_id": "uuid-here",
  "updates": [
    {
      "title": "New BC Rental Regulation",
      "content": "The BC government announced...",
      "url": "https://source.com/article",
      "source": "BC Housing",
      "relevance_score": 8
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Received 1 updates, saved 1 (threshold: 5)",
  "updates_received": 1,
  "updates_saved": 1
}
```

### Query Endpoints

#### GET `/api/updates/:userId`
Retrieves updates for a user.

**Query Parameters:**
- `limit` (optional): Maximum number of updates
- `minRelevance` (optional): Minimum relevance score

**Response:**
```json
{
  "success": true,
  "count": 5,
  "updates": [
    {
      "id": 1,
      "title": "...",
      "content": "...",
      "relevance_score": 8,
      "created_at": "2024-01-20T10:00:00Z"
    }
  ]
}
```

#### GET `/api/profile/:userId`
Retrieves complete user profile.

#### GET `/api/admin/stats`
Admin dashboard statistics.

## 🗄️ Database Schema

### SQLite Tables

#### `users`
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  business_description TEXT NOT NULL,
  topics TEXT NOT NULL,
  frequency TEXT NOT NULL,
  delivery_method TEXT NOT NULL,
  price REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `sources`
```sql
CREATE TABLE sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  approved BOOLEAN DEFAULT 1,
  suggested_by_ai BOOLEAN DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `updates`
```sql
CREATE TABLE updates (
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
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `preferences`
```sql
CREATE TABLE preferences (
  user_id TEXT PRIMARY KEY,
  relevance_threshold INTEGER DEFAULT 5,
  competitor_urls TEXT,
  keyword_alerts TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## 💰 Pricing Model

### Formula
```
Total = (Base Price × Frequency Multiplier) + (Sources × $2) + Delivery Cost
```

### Components
- **Base Price**: $10/month
- **Frequency Multipliers**:
  - Daily: 3x ($30)
  - Weekly: 2x ($20)
  - Monthly: 1x ($10)
- **Sources**: $2 per source
- **Delivery**:
  - Email: Free
  - Dashboard: +$5/month
  - Slack: +$10/month

### Example
- Daily updates (3x) = $30
- 8 sources = $16
- Email delivery = $0
- **Total: $46/month**

## 🔧 Make.com Integration

### Setup Webhook for Profile Submission

1. Create new scenario in Make.com
2. Add **Webhooks → Custom Webhook** as first module
3. Copy webhook URL
4. Add to `.env` as `MAKECOM_WEBHOOK_URL`

### Expected Payload from Opticon

```json
{
  "user_id": "uuid",
  "business_description": "...",
  "topics": ["topic1", "topic2"],
  "frequency": "daily",
  "delivery_method": "email",
  "price": 46,
  "approved_sources": [
    {"name": "...", "url": "...", "description": "..."}
  ],
  "preferences": {
    "relevance_threshold": 7,
    "competitor_urls": "...",
    "keyword_alerts": "..."
  },
  "timestamp": "2024-01-20T10:00:00Z"
}
```

### Sending Updates Back to Opticon

Create a Make.com scenario that:
1. Monitors sources (HTTP, RSS, custom scrapers)
2. Filters content with AI (OpenAI module)
3. Scores relevance (1-10)
4. POSTs to Opticon's `/api/receive-updates` endpoint

**Payload Format:**
```json
{
  "user_id": "uuid-from-original-webhook",
  "updates": [
    {
      "title": "Article Title",
      "content": "Article summary or full text",
      "url": "https://source.com/article",
      "source": "Source Name",
      "relevance_score": 8
    }
  ]
}
```

## 📁 Project Structure

```
Opticon/
├── server.js                 # Main Express server
├── database.js               # SQLite setup and operations
├── package.json              # Dependencies
├── vercel.json               # Vercel deployment config
├── .env.example              # Environment variables template
├── .gitignore               # Git ignore rules
├── services/
│   ├── perplexity.js        # Perplexity AI integration
│   ├── pricing.js           # Pricing calculator
│   └── make-webhook.js      # Make.com webhook sender
├── public/
│   ├── index.html           # Main onboarding page
│   ├── admin.html           # Admin dashboard
│   ├── dashboard.html       # User updates dashboard
│   ├── styles.css           # Global styles
│   └── app.js               # Frontend JavaScript
└── README.md                # This file
```

## 🔒 Security

- **Input Validation**: All endpoints validate input
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configured for production use
- **Environment Variables**: Sensitive keys never committed
- **SQL Injection**: Using parameterized queries
- **XSS Protection**: Content sanitization on display

## 🧪 Testing

### Test the Complete Flow

1. **Start server**: `npm start`
2. **Open**: http://localhost:3000
3. **Complete onboarding**:
   - Enter business description
   - Select topics
   - Approve sources
   - Configure settings
   - Submit profile
4. **Check database**: `sqlite3 opticon.db "SELECT * FROM users;"`

### Test Receiving Updates

```bash
curl -X POST http://localhost:3000/api/receive-updates \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "your-user-id-here",
    "updates": [
      {
        "title": "Test Update",
        "content": "This is a test",
        "url": "https://example.com",
        "source": "Test Source",
        "relevance_score": 7
      }
    ]
  }'
```

### View Admin Dashboard

Visit: http://localhost:3000/admin

## 📊 Migration to PostgreSQL (Production)

For production on Vercel, migrate from SQLite to PostgreSQL:

1. **Install Vercel Postgres**:
   ```bash
   vercel postgres create
   ```

2. **Update database.js** to use `pg` instead of `sqlite3`

3. **Run migration script** (provided separately)

## 🚀 Deployment Checklist

- [ ] Get Perplexity API key
- [ ] Set up Make.com webhook
- [ ] Update `.env` with actual values
- [ ] Test locally with `npm start`
- [ ] Push to GitHub
- [ ] Deploy to Vercel
- [ ] Add environment variables in Vercel dashboard
- [ ] Test production deployment
- [ ] Configure Make.com with production URLs
- [ ] Test end-to-end flow

## 📝 License

MIT

## 🤝 Support

For issues or questions:
- Open an issue on GitHub
- Email: support@opticon.com (configure your support email)

---

**Built with ❤️ using Node.js, Express, SQLite, and Perplexity AI**
