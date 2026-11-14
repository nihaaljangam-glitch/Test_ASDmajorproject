const { 
  calculate16SignalNetworkDecision, 
  evaluateSingleJunction,
  evaluateSafeIntersection,
  SAFE_PHASES,
  SIGNAL_CONFIG,
  PRIORITY_WEIGHTS,
  MAX_WAIT_TIME
} = require('../algorithms/trafficDecision');

// Initial default vehicle counts for all 16 directional approaches
// 4 Junctions (J1..J4) x 4 Directions (North, South, East, West)
const defaultNetworkTraffic = {
  J1: { north: 25, south: 20, east: 15, west: 20 }, // Grand Ave
  J2: { north: 15, south: 10, east: 15, west: 10 }, // Metro Blvd
  J3: { north: 5,  south: 4,  east: 3,  west: 3  }, // Outer Ring
  J4: { north: 30, south: 25, east: 15, west: 30 }  // Expressway
};

/**
 * Fetch initial 16-signal traffic configuration and vehicle counts
 * GET /api/traffic/current
 */
const getCurrentTraffic = (req, res) => {
  res.status(200).json({
    status: 'success',
    server: 'Node.js Express (Port 3000)',
    totalSignals: 16,
    defaultVehicles: defaultNetworkTraffic,
    safePhases: SAFE_PHASES,
    signalConfig: SIGNAL_CONFIG
  });
};

/**
 * Compute signal timing and safe phase decision
 * Supports both single 4-way intersection and the full 16-signal network
 * GET & POST /api/traffic/decision
 */
const getTrafficDecision = (req, res) => {
  try {
    const payload = req.body || {};

    // Check if the request is for a single 4-way intersection
    const isSingleIntersection = 
      payload.trafficData !== undefined || 
      payload.north !== undefined || 
      req.query?.north !== undefined;

    if (isSingleIntersection) {
      const trafficData = payload.trafficData || {
        north: Number(payload.north ?? req.query?.north ?? 20),
        south: Number(payload.south ?? req.query?.south ?? 15),
        east: Number(payload.east ?? req.query?.east ?? 40),
        west: Number(payload.west ?? req.query?.west ?? 10)
      };

      const emergency = payload.emergency || 
                        payload.emergencyVehicle || 
                        req.query?.emergency || 
                        null;

      const currentPhase = payload.currentPhase || 'NORTH_SOUTH';
      const currentSignalState = payload.currentSignalState || 'GREEN';

      const decision = evaluateSafeIntersection({
        trafficData,
        currentPhase,
        currentSignalState,
        emergency
      });

      return res.status(200).json({
        status: 'success',
        server: 'Node.js Express (Port 3000)',
        connected: true,
        ...decision
      });
    }

    // Full 16-signal multi-junction network decision
    const networkVehicles = payload.networkVehicles || payload.vehicles || defaultNetworkTraffic;
    
    const decision = calculate16SignalNetworkDecision({
      networkVehicles,
      ambulance: payload.ambulance || null,
      activeSignals: payload.activeSignals || {},
      rotatingJunction: payload.rotatingJunction || null
    });

    return res.status(200).json({
      ...decision,
      server: 'Node.js Express (Port 3000)',
      connected: true
    });
  } catch (error) {
    console.error('Error calculating traffic decision:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to calculate traffic decision',
      details: error.message
    });
  }
};

module.exports = {
  getCurrentTraffic,
  getTrafficDecision,
  defaultNetworkTraffic
};
