// Pricing configuration
const PRICING_CONFIG = {
  basePrice: 10,
  frequencyMultipliers: {
    daily: 3,
    weekly: 2,
    monthly: 1
  },
  sourcePrice: 2,
  deliveryCosts: {
    email: 0,
    dashboard: 5,
    slack: 10
  }
};

function calculatePrice({ frequency, sources_count, delivery_method }) {
  // Validate inputs
  if (!frequency || !PRICING_CONFIG.frequencyMultipliers[frequency]) {
    throw new Error(`Invalid frequency: ${frequency}`);
  }

  if (sources_count === undefined || sources_count < 0) {
    throw new Error('Invalid sources count');
  }

  if (!delivery_method || PRICING_CONFIG.deliveryCosts[delivery_method] === undefined) {
    throw new Error(`Invalid delivery method: ${delivery_method}`);
  }

  // Calculate components
  const frequencyMultiplier = PRICING_CONFIG.frequencyMultipliers[frequency];
  const baseWithFrequency = PRICING_CONFIG.basePrice * frequencyMultiplier;
  const sourcesCost = sources_count * PRICING_CONFIG.sourcePrice;
  const deliveryCost = PRICING_CONFIG.deliveryCosts[delivery_method];

  const total = baseWithFrequency + sourcesCost + deliveryCost;

  return {
    breakdown: {
      base_price: PRICING_CONFIG.basePrice,
      frequency,
      frequency_multiplier: frequencyMultiplier,
      base_with_frequency: baseWithFrequency,
      sources_count,
      source_price: PRICING_CONFIG.sourcePrice,
      sources_cost: sourcesCost,
      delivery_method,
      delivery_cost: deliveryCost
    },
    total,
    monthly: total,
    annually: total * 12
  };
}

function formatPricing(pricing) {
  return {
    ...pricing,
    total_formatted: `$${pricing.total.toFixed(2)}/month`,
    annually_formatted: `$${pricing.annually.toFixed(2)}/year`
  };
}

module.exports = {
  calculatePrice,
  formatPricing,
  PRICING_CONFIG
};
