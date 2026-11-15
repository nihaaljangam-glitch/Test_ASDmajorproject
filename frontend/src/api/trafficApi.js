const DECISION_ENDPOINT = '/api/traffic/decision';

export async function requestTrafficDecision(payload, fetchImpl = fetch) {
  const response = await fetchImpl(DECISION_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Traffic decision request failed (HTTP ${response.status})`);
  }

  return response.json();
}
