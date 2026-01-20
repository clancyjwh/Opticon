const axios = require('axios');

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

// Cache for common queries (15 minutes TTL)
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000;

function getCacheKey(type, input) {
  return `${type}:${JSON.stringify(input)}`;
}

function getFromCache(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

async function queryPerplexity(messages, options = {}) {
  if (!PERPLEXITY_API_KEY || PERPLEXITY_API_KEY === 'your_perplexity_api_key_here') {
    throw new Error('Perplexity API key not configured');
  }

  try {
    const response = await axios.post(
      PERPLEXITY_API_URL,
      {
        model: options.model || 'llama-3.1-sonar-small-128k-online',
        messages,
        temperature: options.temperature || 0.2,
        max_tokens: options.max_tokens || 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    return response.data.choices[0].message.content;

  } catch (error) {
    console.error('Perplexity API error:', error.response?.data || error.message);
    throw new Error(`Perplexity API failed: ${error.response?.data?.error || error.message}`);
  }
}

function parseJSONResponse(content) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error('Failed to parse JSON:', error.message);
    return null;
  }
}

async function suggestTopics(businessDescription) {
  const cacheKey = getCacheKey('topics', businessDescription);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const prompt = `Based on this business description: "${businessDescription}"

Suggest 8-10 highly relevant monitoring topics that would be valuable for this business to track. Include regulatory topics, market trends, competitor activities, and industry developments.

Return ONLY a JSON array of objects with this exact format:
[
  {
    "topic": "Topic name",
    "category": "regulatory|market|competitor|industry",
    "description": "Why this is relevant"
  }
]

Return valid JSON only, no additional text.`;

  const messages = [
    {
      role: 'system',
      content: 'You are a business intelligence assistant. Always respond with valid JSON arrays.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  const content = await queryPerplexity(messages);
  const topics = parseJSONResponse(content);

  if (!topics || !Array.isArray(topics)) {
    // Fallback topics
    return [
      { topic: 'Industry regulations', category: 'regulatory', description: 'Track regulatory changes' },
      { topic: 'Market trends', category: 'market', description: 'Monitor market developments' },
      { topic: 'Competitor news', category: 'competitor', description: 'Track competitor activities' }
    ];
  }

  setCache(cacheKey, topics);
  return topics;
}

async function suggestSources(businessDescription, topics) {
  const topicsStr = Array.isArray(topics) ? topics.join(', ') : topics;
  const cacheKey = getCacheKey('sources', { businessDescription, topics: topicsStr });
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const prompt = `Find the top 10 most authoritative sources for monitoring these topics: ${topicsStr}

Business context: ${businessDescription}

Include:
- Government regulatory sites
- Industry publications and journals
- Major news outlets covering this sector
- Trade associations
- Research institutions
- Authoritative blogs

Return ONLY a JSON array with this exact format:
[
  {
    "name": "Source name",
    "url": "https://full-url.com",
    "description": "Brief description of why it's valuable",
    "category": "government|publication|news|association|research|blog"
  }
]

Return valid JSON only, no additional text. Ensure all URLs are complete and valid.`;

  const messages = [
    {
      role: 'system',
      content: 'You are a research assistant that finds authoritative information sources. Always respond with valid JSON arrays containing real, accessible URLs.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  const content = await queryPerplexity(messages);
  const sources = parseJSONResponse(content);

  if (!sources || !Array.isArray(sources)) {
    // Fallback sources
    return [
      {
        name: 'Reuters Business',
        url: 'https://www.reuters.com/business',
        description: 'Global business news',
        category: 'news'
      },
      {
        name: 'Industry Week',
        url: 'https://www.industryweek.com',
        description: 'Manufacturing and industry news',
        category: 'publication'
      }
    ];
  }

  setCache(cacheKey, sources);
  return sources;
}

async function findCompetitors(competitorNames) {
  const namesStr = Array.isArray(competitorNames) ? competitorNames.join(', ') : competitorNames;
  const cacheKey = getCacheKey('competitors', namesStr);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const prompt = `Find online presence (websites, blogs, press pages, social media) for these companies/competitors: ${namesStr}

Return ONLY a JSON array with this exact format:
[
  {
    "name": "Company name",
    "website": "https://main-website.com",
    "blog": "https://blog-url.com",
    "press": "https://press-or-news-url.com",
    "description": "Brief description"
  }
]

Include all available URLs. Return valid JSON only, no additional text.`;

  const messages = [
    {
      role: 'system',
      content: 'You are a competitive intelligence assistant. Always respond with valid JSON arrays containing real URLs.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  const content = await queryPerplexity(messages);
  const competitors = parseJSONResponse(content);

  if (!competitors || !Array.isArray(competitors)) {
    // Return basic structure
    const names = namesStr.split(',').map(n => n.trim());
    return names.map(name => ({
      name,
      website: '',
      blog: '',
      press: '',
      description: 'Competitor tracking enabled'
    }));
  }

  setCache(cacheKey, competitors);
  return competitors;
}

module.exports = {
  suggestTopics,
  suggestSources,
  findCompetitors
};
