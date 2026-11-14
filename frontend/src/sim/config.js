/**
 * TrafficFlow-AI Simulation Configuration
 */

export const API_BASE_URL = 'http://localhost:3000/api/traffic';
export const API_ROOT_URL = 'http://localhost:3000/api';

export const DIRECTIONS = ['north', 'south', 'east', 'west'];

// Map Coordinates & Junction Configuration
export const JUNCTIONS = {
  J1: { id: 'J1', name: 'Junction 1', label: 'North-West (Grand Ave)', x: 180, y: 130 },
  J2: { id: 'J2', name: 'Junction 2', label: 'North-East (Metro Blvd)', x: 440, y: 130 },
  J3: { id: 'J3', name: 'Junction 3', label: 'South-West (Outer Ring)', x: 180, y: 310 },
  J4: { id: 'J4', name: 'Junction 4', label: 'South-East (Expressway)', x: 440, y: 310 }
};

import { SINGLE_PHASES, PAIR_PHASES } from './phases.js';

// Hospitals Configuration
export const HOSPITALS = {
  HOSPITAL: {
    id: 'HOSPITAL',
    code: 'HOSPITAL',
    name: 'City Hospital (H1)',
    label: 'City Hospital',
    x: 600,
    y: 310,
    connectedJunction: 'J4'
  },
  H2: {
    id: 'H2',
    code: 'H2',
    name: 'Metro Trauma Center (H2)',
    label: 'Metro Trauma Center',
    x: 600,
    y: 130,
    connectedJunction: 'J2'
  }
};

export const HOSPITAL = HOSPITALS.HOSPITAL;

// Safe Phase Definitions
export const SAFE_PHASES = {
  ...SINGLE_PHASES,
  ...PAIR_PHASES
};

export const DEFAULT_SIGNAL_CONFIG = {
  minGreenTime: 15,
  maxGreenTime: 60,
  yellowTime: 3,
  allRedTime: 2,
  maxWaitTime: 90, // Default 90s in SINGLE mode (longer cycle)
  greenFactor: 0.5
};

export const SIGNAL_CONFIG = DEFAULT_SIGNAL_CONFIG;

export const SIGNAL_CONFIG_LIMITS = {
  minGreen: { min: 5, max: 30, step: 1 },
  maxGreen: { min: 30, max: 120, step: 1 },
  yellow: { min: 2, max: 6, step: 1 },
  allRed: { min: 1, max: 5, step: 1 },
  starvation: { min: 30, max: 120, step: 5 },
  greenFactor: { min: 0.1, max: 1.0, step: 0.05 }
};

export const MAX_QUEUE_CAP = 100;
export const DEFAULT_ARRIVAL_RATE = 8;

export const DEFAULT_ARRIVAL_CONFIG = {
  globalRate: 8,
  isRushHour: false,
  rushHourMultiplier: 2.5
};

export const INCIDENT_STATES = {
  NORMAL: 'NORMAL',
  INCIDENT: 'INCIDENT',
  ROAD_BLOCK: 'ROAD_BLOCK'
};

export const DEFAULT_INCIDENTS = {
  J1: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' },
  J2: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' },
  J3: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' },
  J4: { north: 'NORMAL', south: 'NORMAL', east: 'NORMAL', west: 'NORMAL' }
};

export const ARRIVAL_PRESETS = {
  LIGHT: {
    key: 'LIGHT',
    globalRate: 6,
    label: 'Light'
  },
  NORMAL: {
    key: 'NORMAL',
    globalRate: 15,
    label: 'Normal'
  },
  RUSH_HOUR: {
    key: 'RUSH_HOUR',
    globalRate: 35,
    label: 'Rush Hour',
    multipliers: {
      J1: { north: 1.0, south: 1.0, east: 1.2, west: 1.0 },
      J2: { north: 1.0, south: 1.5, east: 2.5, west: 1.0 },
      J3: { north: 1.0, south: 1.0, east: 1.5, west: 1.0 },
      J4: { north: 2.2, south: 2.5, east: 2.0, west: 2.5 }
    }
  }
};

// Default initial vehicle counts for all 16 directional approaches
export const DEFAULT_NETWORK_VEHICLES = {
  J1: { north: 25, south: 20, east: 15, west: 20 },
  J2: { north: 15, south: 10, east: 15, west: 10 },
  J3: { north: 5,  south: 4,  east: 3,  west: 3  },
  J4: { north: 30, south: 25, east: 15, west: 30 }
};

export const DEFAULT_WAITING_TIMES = {
  J1: { north: 5, south: 5, east: 25, west: 20 },
  J2: { north: 20, south: 15, east: 5, west: 5 },
  J3: { north: 5, south: 5, east: 10, west: 10 },
  J4: { north: 35, south: 30, east: 10, west: 10 }
};

export const PRESETS = {
  DEFAULT: DEFAULT_NETWORK_VEHICLES,
  BALANCED: {
    J1: { north: 20, south: 20, east: 20, west: 20 },
    J2: { north: 20, south: 20, east: 20, west: 20 },
    J3: { north: 20, south: 20, east: 20, west: 20 },
    J4: { north: 20, south: 20, east: 20, west: 20 }
  },
  RUSH_HOUR: {
    J1: { north: 60, south: 45, east: 30, west: 20 },
    J2: { north: 40, south: 20, east: 70, west: 35 },
    J3: { north: 15, south: 20, east: 10, west: 15 },
    J4: { north: 85, south: 50, east: 40, west: 65 }
  }
};

export const EXIT_DIRECTIONS = {
  J1: 'EAST',
  J2: 'SOUTH',
  J3: 'EAST',
  J4: 'EAST'
};

export const AMBULANCE_ROUTES = {
  J1: ['J1', 'J2', 'J4', 'HOSPITAL'],
  J2: ['J2', 'J4', 'HOSPITAL'],
  J3: ['J3', 'J4', 'HOSPITAL']
};

export const DIRECTION_COLORS = {
  NORTH: '#22d3ee',
  SOUTH: '#34d399',
  EAST: '#fbbf24',
  WEST: '#fb7185'
};
