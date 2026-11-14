/**
 * ==============================================================================
 * TrafficFlow-AI Road Network Graph & Dijkstra Routing Module
 * ==============================================================================
 * Graph model of the 4-junction network and 2 destination hospitals.
 * Computes shortest paths, segment lengths, exit directions, and SVG coordinates.
 */

export const GRAPH_NODES = {
  J1: { id: 'J1', name: 'Junction 1', label: 'North-West (Grand Ave)', x: 180, y: 130, isJunction: true },
  J2: { id: 'J2', name: 'Junction 2', label: 'North-East (Metro Blvd)', x: 440, y: 130, isJunction: true },
  J3: { id: 'J3', name: 'Junction 3', label: 'South-West (Outer Ring)', x: 180, y: 310, isJunction: true },
  J4: { id: 'J4', name: 'Junction 4', label: 'South-East (Expressway)', x: 440, y: 310, isJunction: true },
  HOSPITAL: { id: 'HOSPITAL', code: 'HOSPITAL', name: 'City Hospital (H1)', label: 'City Hospital', x: 600, y: 310, isHospital: true },
  H2: { id: 'H2', code: 'H2', name: 'Metro Trauma Center (H2)', label: 'Metro Trauma Center', x: 600, y: 130, isHospital: true }
};

export const GRAPH_EDGES = [
  // Horizontal corridor top: J1 <-> J2 (dist = 260)
  { from: 'J1', to: 'J2', exitDirection: 'EAST', requiredPhase: 'EAST_WEST', distance: 260 },
  { from: 'J2', to: 'J1', exitDirection: 'WEST', requiredPhase: 'EAST_WEST', distance: 260 },

  // Vertical corridor left: J1 <-> J3 (dist = 180)
  { from: 'J1', to: 'J3', exitDirection: 'SOUTH', requiredPhase: 'NORTH_SOUTH', distance: 180 },
  { from: 'J3', to: 'J1', exitDirection: 'NORTH', requiredPhase: 'NORTH_SOUTH', distance: 180 },

  // Vertical corridor right: J2 <-> J4 (dist = 180)
  { from: 'J2', to: 'J4', exitDirection: 'SOUTH', requiredPhase: 'NORTH_SOUTH', distance: 180 },
  { from: 'J4', to: 'J2', exitDirection: 'NORTH', requiredPhase: 'NORTH_SOUTH', distance: 180 },

  // Horizontal corridor bottom: J3 <-> J4 (dist = 260)
  { from: 'J3', to: 'J4', exitDirection: 'EAST', requiredPhase: 'EAST_WEST', distance: 260 },
  { from: 'J4', to: 'J3', exitDirection: 'WEST', requiredPhase: 'EAST_WEST', distance: 260 },

  // Hospital 1 connector: J4 -> HOSPITAL (dist = 160)
  { from: 'J4', to: 'HOSPITAL', exitDirection: 'EAST', requiredPhase: 'EAST_WEST', distance: 160 },

  // Hospital 2 connector: J2 -> H2 (dist = 160)
  { from: 'J2', to: 'H2', exitDirection: 'EAST', requiredPhase: 'EAST_WEST', distance: 160 }
];

/**
 * Dijkstra shortest path algorithm on the road graph
 * @param {string} startNodeId - Start node (e.g. 'J1')
 * @param {string} targetHospitalId - Destination hospital ('HOSPITAL' | 'H2')
 * @returns {object} { path: string[], totalDistance: number, segments: object[] }
 */
export function findShortestRoute(startNodeId, targetHospitalId = 'HOSPITAL') {
  const normTarget = targetHospitalId === 'H1' ? 'HOSPITAL' : targetHospitalId;
  const start = GRAPH_NODES[startNodeId] ? startNodeId : 'J1';
  const target = GRAPH_NODES[normTarget] ? normTarget : 'HOSPITAL';

  const dist = {};
  const prev = {};
  const unvisited = new Set(Object.keys(GRAPH_NODES));

  for (const node of unvisited) {
    dist[node] = Infinity;
    prev[node] = null;
  }
  dist[start] = 0;

  while (unvisited.size > 0) {
    let curr = null;
    let minDist = Infinity;
    for (const node of unvisited) {
      if (dist[node] < minDist) {
        minDist = dist[node];
        curr = node;
      }
    }

    if (!curr || minDist === Infinity) break;
    if (curr === target) break;

    unvisited.delete(curr);

    const edges = GRAPH_EDGES.filter((e) => e.from === curr);
    for (const edge of edges) {
      if (!unvisited.has(edge.to)) continue;
      const alt = dist[curr] + edge.distance;
      if (alt < dist[edge.to]) {
        dist[edge.to] = alt;
        prev[edge.to] = curr;
      }
    }
  }

  // Backtrack path
  const path = [];
  let curr = target;
  while (curr) {
    path.unshift(curr);
    curr = prev[curr];
  }

  if (path.length === 0 || path[0] !== start) {
    // Fallback if disconnected
    return {
      path: [start, target],
      totalDistance: 600,
      segments: []
    };
  }

  // Construct segments details
  const segments = [];
  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const u = path[i];
    const v = path[i + 1];
    const edge = GRAPH_EDGES.find((e) => e.from === u && e.to === v) || {
      from: u,
      to: v,
      distance: Math.round(Math.hypot(GRAPH_NODES[v].x - GRAPH_NODES[u].x, GRAPH_NODES[v].y - GRAPH_NODES[u].y)),
      exitDirection: 'EAST',
      requiredPhase: 'EAST_WEST'
    };
    segments.push(edge);
    totalDistance += edge.distance;
  }

  return {
    path,
    totalDistance,
    segments
  };
}

/**
 * Calculate ambulance current coordinates, current segment, and active controlling junction
 * @param {object} ambulance - Ambulance state object
 * @returns {object} { x: number, y: number, currentJunction: string, activeSegment: object|null }
 */
export function getAmbulanceCoordinates(ambulance) {
  if (!ambulance) return null;
  const path = ambulance.path && ambulance.path.length >= 2 ? ambulance.path : ['J1', 'HOSPITAL'];
  const progress = Math.max(0, Math.min(100, Number(ambulance.progress) || 0));

  const totalDist = ambulance.totalDistance || 600;
  const targetDistance = (progress / 100) * totalDist;

  // Find destination coordinates
  const lastNodeId = path[path.length - 1];
  const lastNode = GRAPH_NODES[lastNodeId] || GRAPH_NODES.HOSPITAL;

  if (progress >= 100) {
    return {
      x: lastNode.x,
      y: lastNode.y,
      currentJunction: lastNodeId,
      activeSegment: null
    };
  }

  // Step through segments to find current position
  let accumulatedDist = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const uId = path[i];
    const vId = path[i + 1];
    const u = GRAPH_NODES[uId];
    const v = GRAPH_NODES[vId];
    const edge = GRAPH_EDGES.find((e) => e.from === uId && e.to === vId);
    const segDist = edge ? edge.distance : Math.hypot(v.x - u.x, v.y - u.y);

    if (accumulatedDist + segDist >= targetDistance || i === path.length - 2) {
      const segOffset = Math.max(0, targetDistance - accumulatedDist);
      const ratio = segDist > 0 ? Math.min(1, segOffset / segDist) : 0;

      const x = Math.round(u.x + ratio * (v.x - u.x));
      const y = Math.round(u.y + ratio * (v.y - u.y));

      // If near the start of the segment, controlling junction is uId;
      // if past midpoint and approaching next junction, controlling junction is vId (if vId is a junction)
      const currentJunction = (ratio >= 0.75 && GRAPH_NODES[vId]?.isJunction) ? vId : uId;

      return {
        x,
        y,
        currentJunction,
        activeSegment: edge || { from: uId, to: vId, distance: segDist }
      };
    }

    accumulatedDist += segDist;
  }

  return {
    x: lastNode.x,
    y: lastNode.y,
    currentJunction: lastNodeId,
    activeSegment: null
  };
}

/**
 * Return SVG path string for an ambulance route
 * @param {string[]} path - Array of node IDs
 * @returns {string} SVG path string
 */
export function getRouteSvgPath(path) {
  if (!Array.isArray(path) || path.length < 2) return '';
  const first = GRAPH_NODES[path[0]];
  if (!first) return '';
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < path.length; i++) {
    const node = GRAPH_NODES[path[i]];
    if (node) {
      d += ` L ${node.x} ${node.y}`;
    }
  }
  return d;
}

/**
 * Return SVG path string for the currently active segment of an ambulance
 * @param {object} ambulance - Ambulance state object
 * @returns {string|null} SVG path string
 */
export function getActiveSegmentSvgPath(ambulance) {
  if (!ambulance || ambulance.progress >= 100) return null;
  const path = ambulance.path || [];
  if (path.length < 2) return null;

  const totalDist = ambulance.totalDistance || 600;
  const targetDistance = ((ambulance.progress || 0) / 100) * totalDist;

  let accumulatedDist = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const u = GRAPH_NODES[path[i]];
    const v = GRAPH_NODES[path[i + 1]];
    if (!u || !v) continue;
    const edge = GRAPH_EDGES.find((e) => e.from === path[i] && e.to === path[i + 1]);
    const segDist = edge ? edge.distance : Math.hypot(v.x - u.x, v.y - u.y);

    if (accumulatedDist + segDist >= targetDistance) {
      return `M ${u.x} ${u.y} L ${v.x} ${v.y}`;
    }
    accumulatedDist += segDist;
  }
  return null;
}
