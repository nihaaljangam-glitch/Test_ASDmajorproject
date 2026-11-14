/**
 * Traffic Density Tiers & Color Mappings
 */

export const TRAFFIC_TIERS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  VERY_HIGH: 'VERY_HIGH'
};

export const TIER_COLORS = {
  LOW: '#10b981',
  MEDIUM: '#06b6d4',
  HIGH: '#f59e0b',
  VERY_HIGH: '#f43f5e'
};

export const TIER_BG_TINTS = {
  LOW: '#0d2222',
  MEDIUM: '#0c2635',
  HIGH: '#2a2010',
  VERY_HIGH: '#2f121a'
};

export const TIER_BREAKPOINTS = {
  LOW_MAX: 10,
  MEDIUM_MAX: 20,
  HIGH_MAX: 50
};

/**
 * Categorize vehicle count or congestion index into a traffic density tier
 * <=10: LOW, 11-20: MEDIUM, 21-50: HIGH, >50: VERY_HIGH
 * @param {number} count - Number of vehicles waiting or index score
 * @returns {'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'}
 */
export function getTrafficTier(count) {
  const num = Number(count) || 0;
  if (num <= 10) return TRAFFIC_TIERS.LOW;
  if (num <= 20) return TRAFFIC_TIERS.MEDIUM;
  if (num <= 50) return TRAFFIC_TIERS.HIGH;
  return TRAFFIC_TIERS.VERY_HIGH;
}

/**
 * Get the accent color for a traffic density tier
 * @param {number|string} countOrTier - Vehicle count number or tier name
 * @returns {string} Hex color string
 */
export function getTrafficTierColor(countOrTier) {
  if (typeof countOrTier === 'string' && TIER_COLORS[countOrTier]) {
    return TIER_COLORS[countOrTier];
  }
  const tier = getTrafficTier(countOrTier);
  return TIER_COLORS[tier] || TIER_COLORS.LOW;
}

/**
 * Get the heat background tint for a traffic density tier
 * @param {number|string} countOrTier - Vehicle count or tier name
 * @returns {string} Hex color string
 */
export function getTierBgTint(countOrTier) {
  if (typeof countOrTier === 'string' && TIER_BG_TINTS[countOrTier]) {
    return TIER_BG_TINTS[countOrTier];
  }
  const tier = getTrafficTier(countOrTier);
  return TIER_BG_TINTS[tier] || TIER_BG_TINTS.LOW;
}

/**
 * Compute network congestion index (0 to 100)
 * Mean over 16 approaches of (min(queue,100)/100*0.6 + min(wait,60)/60*0.4)*100
 */
export function computeCongestionIndex(vehicles, waitingTimes) {
  if (!vehicles) return 0;
  let totalScore = 0;
  let approachCount = 0;

  for (const jId of Object.keys(vehicles)) {
    const jVehicles = vehicles[jId] || {};
    const jWaits = waitingTimes?.[jId] || {};

    for (const dir of ['north', 'south', 'east', 'west']) {
      const q = Math.min(100, Math.max(0, Number(jVehicles[dir]) || 0));
      const w = Math.min(60, Math.max(0, Number(jWaits[dir]) || 0));
      const approachScore = ((q / 100) * 0.6 + (w / 60) * 0.4) * 100;
      totalScore += approachScore;
      approachCount++;
    }
  }

  return approachCount > 0 ? Math.round((totalScore / approachCount) * 10) / 10 : 0;
}
