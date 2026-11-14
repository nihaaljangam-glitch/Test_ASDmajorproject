import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findShortestRoute,
  getAmbulanceCoordinates,
  getRouteSvgPath,
  getActiveSegmentSvgPath,
  GRAPH_NODES,
  GRAPH_EDGES
} from '../src/sim/routing.js';

test('#4 Dijkstra finds optimal shortest path from J1 to H2 (Metro Trauma)', () => {
  const result = findShortestRoute('J1', 'H2');
  assert.deepEqual(result.path, ['J1', 'J2', 'H2']);
  assert.equal(result.totalDistance, 420); // 260 + 160
  assert.equal(result.segments.length, 2);
  assert.equal(result.segments[0].exitDirection, 'EAST');
  assert.equal(result.segments[0].requiredPhase, 'EAST_WEST');
  assert.equal(result.segments[1].exitDirection, 'EAST');
  assert.equal(result.segments[1].requiredPhase, 'EAST_WEST');
});

test('#4 Dijkstra finds optimal shortest path from J3 to HOSPITAL (City Hospital H1)', () => {
  const result = findShortestRoute('J3', 'HOSPITAL');
  assert.deepEqual(result.path, ['J3', 'J4', 'HOSPITAL']);
  assert.equal(result.totalDistance, 420); // 260 + 160
  assert.equal(result.segments.length, 2);
  assert.equal(result.segments[0].requiredPhase, 'EAST_WEST');
  assert.equal(result.segments[1].requiredPhase, 'EAST_WEST');
});

test('#4 Dijkstra finds direct connections to destination hospitals', () => {
  const j4ToH1 = findShortestRoute('J4', 'HOSPITAL');
  assert.deepEqual(j4ToH1.path, ['J4', 'HOSPITAL']);
  assert.equal(j4ToH1.totalDistance, 160);

  const j2ToH2 = findShortestRoute('J2', 'H2');
  assert.deepEqual(j2ToH2.path, ['J2', 'H2']);
  assert.equal(j2ToH2.totalDistance, 160);
});

test('#4 getAmbulanceCoordinates maps 0% to start node and 100% to destination hospital', () => {
  const amb = {
    junction: 'J1',
    targetHospital: 'H2',
    path: ['J1', 'J2', 'H2'],
    totalDistance: 420,
    progress: 0
  };

  const startCoords = getAmbulanceCoordinates(amb);
  assert.equal(startCoords.x, GRAPH_NODES.J1.x);
  assert.equal(startCoords.y, GRAPH_NODES.J1.y);

  amb.progress = 100;
  const endCoords = getAmbulanceCoordinates(amb);
  assert.equal(endCoords.x, GRAPH_NODES.H2.x);
  assert.equal(endCoords.y, GRAPH_NODES.H2.y);
  assert.equal(endCoords.currentJunction, 'H2');
});

test('#4 getRouteSvgPath produces valid SVG path string', () => {
  const svgPath = getRouteSvgPath(['J1', 'J2', 'H2']);
  assert.equal(svgPath, 'M 180 130 L 440 130 L 600 130');
});
