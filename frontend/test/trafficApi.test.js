import test from 'node:test';
import assert from 'node:assert/strict';
import { requestTrafficDecision } from '../src/api/trafficApi.js';

test('posts the network decision to the proxied backend endpoint', async () => {
  let request;
  const response = await requestTrafficDecision({ networkVehicles: { J1: { north: 1 } } }, async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ status: 'success', junctions: {} }) };
  });

  assert.equal(request.url, '/api/traffic/decision');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), { networkVehicles: { J1: { north: 1 } } });
  assert.equal(response.status, 'success');
});

test('surfaces backend HTTP failures to the caller', async () => {
  await assert.rejects(
    () => requestTrafficDecision({}, async () => ({ ok: false, status: 503 })),
    /Traffic decision request failed \(HTTP 503\)/
  );
});
