// State management
const state = {
  currentStep: 1,
  businessDescription: '',
  selectedTopics: [],
  customTopics: [],
  suggestedSources: [],
  selectedSources: [],
  frequency: 'daily',
  deliveryMethod: 'email',
  relevanceThreshold: 5,
  competitors: [],
  keywordAlerts: '',
  pricing: null,
  userId: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  updatePricing();
});

function initializeEventListeners() {
  // Step 1: Get topic suggestions
  document.getElementById('getTopicSuggestions').addEventListener('click', handleGetTopics);

  // Step 2: Continue to sources
  document.getElementById('continueToSources').addEventListener('click', handleContinueToSources);

  // Step 2: Custom topic handling
  const customTopicInput = document.getElementById('customTopic');
  if (customTopicInput) {
    customTopicInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCustomTopic();
      }
    });
  }

  // Step 3: Add custom source
  document.getElementById('addCustomSource').addEventListener('click', addCustomSource);
  document.getElementById('continueToConfig').addEventListener('click', () => goToStep(4));

  // Step 4: Configuration changes
  document.querySelectorAll('input[name="frequency"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.frequency = radio.value;
      updatePricing();
    });
  });

  document.querySelectorAll('input[name="delivery"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.deliveryMethod = radio.value;
      updatePricing();
    });
  });

  document.getElementById('relevanceThreshold').addEventListener('input', (e) => {
    state.relevanceThreshold = parseInt(e.target.value);
    document.getElementById('thresholdValue').textContent = e.target.value;
  });

  document.getElementById('findCompetitors').addEventListener('click', handleFindCompetitors);
  document.getElementById('continueToReview').addEventListener('click', handleReview);

  // Step 5: Submit
  document.getElementById('submitProfile').addEventListener('click', handleSubmit);

  // Success page
  document.getElementById('copyUserId').addEventListener('click', copyUserId);
  document.getElementById('viewDashboard').addEventListener('click', viewDashboard);
}

async function handleGetTopics() {
  const businessDesc = document.getElementById('business_description').value.trim();

  if (!businessDesc) {
    alert('Please enter your business description');
    return;
  }

  state.businessDescription = businessDesc;

  // Show step 2
  goToStep(2);

  // Show loading
  document.getElementById('loadingTopics').style.display = 'block';
  document.getElementById('suggestedTopics').innerHTML = '';
  document.getElementById('topicActions').style.display = 'none';

  try {
    const response = await fetch('/api/suggest-topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_description: businessDesc })
    });

    if (!response.ok) throw new Error('Failed to get topic suggestions');

    const data = await response.json();

    // Hide loading
    document.getElementById('loadingTopics').style.display = 'none';

    // Display topics
    displayTopics(data.topics);

    // Show custom topic input and actions
    document.getElementById('customTopicGroup').style.display = 'block';
    document.getElementById('topicActions').style.display = 'flex';

  } catch (error) {
    console.error('Error:', error);
    document.getElementById('loadingTopics').style.display = 'none';
    document.getElementById('suggestedTopics').innerHTML = `
      <div style="text-align: center; color: #ef4444; padding: 40px;">
        Failed to get topic suggestions. Please try again or add topics manually.
      </div>
    `;
    document.getElementById('customTopicGroup').style.display = 'block';
    document.getElementById('topicActions').style.display = 'flex';
  }
}

function displayTopics(topics) {
  const container = document.getElementById('suggestedTopics');
  container.innerHTML = '';

  topics.forEach((topic, index) => {
    const card = document.createElement('div');
    card.className = 'topic-card';
    card.innerHTML = `
      <input type="checkbox" id="topic-${index}" value="${topic.topic}">
      <div class="topic-header">
        <div class="topic-title">${topic.topic}</div>
        <div class="topic-check"></div>
      </div>
      <div class="topic-category ${topic.category}">${topic.category}</div>
      <div class="topic-description">${topic.description}</div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const checkbox = card.querySelector('input');
        checkbox.checked = !checkbox.checked;
        handleTopicSelection(checkbox, topic.topic);
      }
    });

    const checkbox = card.querySelector('input');
    checkbox.addEventListener('change', () => handleTopicSelection(checkbox, topic.topic));

    container.appendChild(card);
  });
}

function handleTopicSelection(checkbox, topic) {
  const card = checkbox.closest('.topic-card');

  if (checkbox.checked) {
    card.classList.add('selected');
    if (!state.selectedTopics.includes(topic)) {
      state.selectedTopics.push(topic);
    }
  } else {
    card.classList.remove('selected');
    state.selectedTopics = state.selectedTopics.filter(t => t !== topic);
  }
}

function addCustomTopic() {
  const input = document.getElementById('customTopic');
  const topic = input.value.trim();

  if (!topic) return;

  if (!state.customTopics.includes(topic)) {
    state.customTopics.push(topic);
    displayCustomTopics();
  }

  input.value = '';
}

function displayCustomTopics() {
  const container = document.getElementById('selectedCustomTopics');
  container.innerHTML = '';

  state.customTopics.forEach(topic => {
    const tag = document.createElement('div');
    tag.className = 'custom-topic-tag';
    tag.innerHTML = `
      ${topic}
      <button onclick="removeCustomTopic('${topic}')">×</button>
    `;
    container.appendChild(tag);
  });
}

function removeCustomTopic(topic) {
  state.customTopics = state.customTopics.filter(t => t !== topic);
  displayCustomTopics();
}

async function handleContinueToSources() {
  const allTopics = [...state.selectedTopics, ...state.customTopics];

  if (allTopics.length === 0) {
    alert('Please select at least one topic');
    return;
  }

  // Go to step 3
  goToStep(3);

  // Show loading
  document.getElementById('loadingSources').style.display = 'block';
  document.getElementById('sourcesList').innerHTML = '';
  document.getElementById('sourceActions').style.display = 'none';

  try {
    const response = await fetch('/api/suggest-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_description: state.businessDescription,
        topics: allTopics.join(', ')
      })
    });

    if (!response.ok) throw new Error('Failed to get source suggestions');

    const data = await response.json();
    state.suggestedSources = data.sources;

    // Hide loading
    document.getElementById('loadingSources').style.display = 'none';

    // Display sources (all pre-selected)
    displaySources(data.sources);

    // Show actions
    document.getElementById('sourceActions').style.display = 'flex';

    // Auto-select all sources
    state.selectedSources = [...data.sources];
    updatePricing();

  } catch (error) {
    console.error('Error:', error);
    document.getElementById('loadingSources').style.display = 'none';
    document.getElementById('sourcesList').innerHTML = `
      <div style="text-align: center; color: #ef4444; padding: 40px;">
        Failed to get source suggestions. Please add sources manually.
      </div>
    `;
    document.getElementById('sourceActions').style.display = 'flex';
  }
}

function displaySources(sources) {
  const container = document.getElementById('sourcesList');
  container.innerHTML = '';

  sources.forEach((source, index) => {
    const card = document.createElement('div');
    card.className = 'source-card selected';
    card.innerHTML = `
      <input type="checkbox" id="source-${index}" checked>
      <div class="source-header">
        <div class="source-info">
          <div class="source-category ${source.category || 'news'}">${source.category || 'news'}</div>
          <div class="source-name">${source.name}</div>
          <a href="${source.url}" target="_blank" class="source-url" onclick="event.stopPropagation()">${source.url}</a>
          <div class="source-description">${source.description}</div>
        </div>
        <div class="source-check"></div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'A') {
        const checkbox = card.querySelector('input');
        checkbox.checked = !checkbox.checked;
        handleSourceSelection(checkbox, source);
      }
    });

    const checkbox = card.querySelector('input');
    checkbox.addEventListener('change', () => handleSourceSelection(checkbox, source));

    container.appendChild(card);
  });
}

function handleSourceSelection(checkbox, source) {
  const card = checkbox.closest('.source-card');

  if (checkbox.checked) {
    card.classList.add('selected');
    if (!state.selectedSources.find(s => s.url === source.url)) {
      state.selectedSources.push(source);
    }
  } else {
    card.classList.remove('selected');
    state.selectedSources = state.selectedSources.filter(s => s.url !== source.url);
  }

  updatePricing();
}

function addCustomSource() {
  const url = document.getElementById('customSourceUrl').value.trim();
  const name = document.getElementById('customSourceName').value.trim();

  if (!url || !name) {
    alert('Please enter both URL and name');
    return;
  }

  const customSource = {
    name,
    url,
    description: 'Custom source',
    category: 'blog',
    suggested_by_ai: false
  };

  state.suggestedSources.push(customSource);
  state.selectedSources.push(customSource);

  // Refresh display
  displaySources(state.suggestedSources);

  // Clear inputs
  document.getElementById('customSourceUrl').value = '';
  document.getElementById('customSourceName').value = '';

  updatePricing();
}

async function handleFindCompetitors() {
  const names = document.getElementById('competitorNames').value.trim();

  if (!names) {
    alert('Please enter competitor names');
    return;
  }

  const button = document.getElementById('findCompetitors');
  button.disabled = true;
  button.textContent = 'Finding...';

  try {
    const response = await fetch('/api/find-competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competitor_names: names })
    });

    if (!response.ok) throw new Error('Failed to find competitors');

    const data = await response.json();
    state.competitors = data.competitors;

    displayCompetitors(data.competitors);

  } catch (error) {
    console.error('Error:', error);
    alert('Failed to find competitors. Please try again.');
  } finally {
    button.disabled = false;
    button.textContent = 'Find Competitors';
  }
}

function displayCompetitors(competitors) {
  const container = document.getElementById('competitorResults');
  container.innerHTML = '';

  competitors.forEach(comp => {
    const div = document.createElement('div');
    div.className = 'competitor-item';

    const links = [];
    if (comp.website) links.push(`<a href="${comp.website}" target="_blank">Website</a>`);
    if (comp.blog) links.push(`<a href="${comp.blog}" target="_blank">Blog</a>`);
    if (comp.press) links.push(`<a href="${comp.press}" target="_blank">Press</a>`);

    div.innerHTML = `
      <strong>${comp.name}</strong>
      <div class="competitor-links">${links.join(' | ')}</div>
    `;

    container.appendChild(div);
  });
}

function updatePricing() {
  const sourcesCount = state.selectedSources.length;

  // Update sources count display
  document.getElementById('sourcesCount').textContent = sourcesCount;

  // Calculate pricing
  fetch('/api/calculate-price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      frequency: state.frequency,
      sources_count: sourcesCount,
      delivery_method: state.deliveryMethod
    })
  })
  .then(res => res.json())
  .then(data => {
    state.pricing = data.pricing;
    displayPricing(data.pricing);
  })
  .catch(err => console.error('Pricing error:', err));
}

function displayPricing(pricing) {
  const { breakdown, total, annually } = pricing;

  document.getElementById('priceBase').textContent = `$${breakdown.base_price}`;
  document.getElementById('priceFrequency').textContent = `×${breakdown.frequency_multiplier}`;
  document.getElementById('priceSources').textContent = `$${breakdown.sources_cost}`;
  document.getElementById('priceDelivery').textContent = `$${breakdown.delivery_cost}`;
  document.getElementById('priceTotal').textContent = `$${total.toFixed(2)}`;
  document.getElementById('priceAnnual').textContent = `$${annually.toFixed(2)}`;
}

function handleReview() {
  if (state.selectedSources.length === 0) {
    alert('Please select at least one source');
    return;
  }

  goToStep(5);

  // Populate review
  const allTopics = [...state.selectedTopics, ...state.customTopics];

  document.getElementById('reviewBusiness').textContent = state.businessDescription;
  document.getElementById('reviewTopicsCount').textContent = allTopics.length;

  const topicsContainer = document.getElementById('reviewTopics');
  topicsContainer.innerHTML = '';
  allTopics.forEach(topic => {
    const tag = document.createElement('div');
    tag.className = 'review-tag';
    tag.textContent = topic;
    topicsContainer.appendChild(tag);
  });

  document.getElementById('reviewSourcesCount').textContent = state.selectedSources.length;

  const sourcesContainer = document.getElementById('reviewSources');
  sourcesContainer.innerHTML = '';
  state.selectedSources.forEach(source => {
    const div = document.createElement('div');
    div.className = 'review-list-item';
    div.textContent = source.name;
    sourcesContainer.appendChild(div);
  });

  document.getElementById('reviewFrequency').textContent = state.frequency;
  document.getElementById('reviewDelivery').textContent = state.deliveryMethod;
  document.getElementById('reviewThreshold').textContent = state.relevanceThreshold;

  if (state.pricing) {
    document.getElementById('finalPrice').textContent = `$${state.pricing.total.toFixed(2)}`;
  }
}

async function handleSubmit() {
  const button = document.getElementById('submitProfile');
  button.disabled = true;
  button.textContent = 'Submitting...';

  try {
    const allTopics = [...state.selectedTopics, ...state.customTopics];

    const payload = {
      business_description: state.businessDescription,
      topics: allTopics,
      frequency: state.frequency,
      delivery_method: state.deliveryMethod,
      approved_sources: state.selectedSources.map(s => ({
        name: s.name,
        url: s.url,
        description: s.description,
        suggested_by_ai: s.suggested_by_ai !== false
      })),
      preferences: {
        relevance_threshold: state.relevanceThreshold,
        competitor_urls: state.competitors.map(c => c.website).filter(Boolean).join(','),
        keyword_alerts: document.getElementById('keywordAlerts').value
      }
    };

    const response = await fetch('/api/submit-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Failed to submit profile');

    const data = await response.json();
    state.userId = data.user_id;

    // Show success page
    showSuccess(data);

  } catch (error) {
    console.error('Error:', error);
    alert('Failed to submit profile. Please try again.');
    button.disabled = false;
    button.textContent = 'Activate Monitoring';
  }
}

function showSuccess(data) {
  goToStep('success');

  document.getElementById('successUserId').textContent = data.user_id;
  document.getElementById('successSourceCount').textContent = state.selectedSources.length;
  document.getElementById('successFrequency').textContent = state.frequency;
  document.getElementById('successThreshold').textContent = state.relevanceThreshold;
}

function copyUserId() {
  const userId = document.getElementById('successUserId').textContent;
  navigator.clipboard.writeText(userId).then(() => {
    const button = document.getElementById('copyUserId');
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
  });
}

function viewDashboard() {
  window.location.href = `/dashboard.html?userId=${state.userId}`;
}

function goToStep(step) {
  // Hide all steps
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));

  // Show target step
  const stepId = step === 'success' ? 'stepSuccess' : `step${step}`;
  document.getElementById(stepId).classList.add('active');

  // Update progress bar
  document.querySelectorAll('.progress-step').forEach(s => s.classList.remove('active', 'completed'));

  if (step !== 'success') {
    for (let i = 1; i < step; i++) {
      document.querySelector(`.progress-step[data-step="${i}"]`).classList.add('completed');
    }
    document.querySelector(`.progress-step[data-step="${step}"]`).classList.add('active');
  } else {
    document.querySelectorAll('.progress-step').forEach(s => s.classList.add('completed'));
  }

  state.currentStep = step;

  // Scroll to top
  window.scrollTo(0, 0);
}
