/**
 * TrafficFlow-AI Simulation Configuration
 */

export const DIRECTIONS = ['north', 'south', 'east', 'west'];

// Map Coordinates & Junction Configuration
export const JUNCTIONS = {
  J1: { id: 'J1', name: 'Junction 1', label: 'North-West (Grand Ave)', x: 180, y: 130 },
  J2: { id: 'J2', name: 'Junction 2', label: 'North-East (Metro Blvd)', x: 440, y: 130 },
  J3: { id: 'J3', name: 'Junction 3', label: 'South-West (Outer Ring)', x: 180, y: 310 },
  J4: { id: 'J4', name: 'Junction 4', label: 'South-East (Expressway)', x: 440, y: 310 }
};

// Safe Phase Definitions
export const SAFE_PHASES = {
  NORTH_SOUTH: {
    id: 'NORTH_SOUTH',
    label: 'Phase 1: NORTH / SOUTH',
    greenDirections: ['north', 'south'],
    conflictingDirections: ['east', 'west']
  },
  EAST_WEST: {
    id: 'EAST_WEST',
    label: 'Phase 2: EAST / WEST',
    greenDirections: ['east', 'west'],
    conflictingDirections: ['north', 'south']
  }
};
