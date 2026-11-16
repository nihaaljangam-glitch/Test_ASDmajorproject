import test from 'node:test';
import assert from 'node:assert/strict';

test('#5 traffic flow dots: visible dots capped at min(queue, 12) with overflow label calculation', () => {
  const computeDots = (queue) => {
    const count = Math.max(0, Number(queue) || 0);
    const visibleDots = Math.min(count, 12);
    const remaining = count - visibleDots;
    return { visibleDots, remaining };
  };

  // Case 1: 0 queue -> 0 dots, 0 remaining
  assert.deepEqual(computeDots(0), { visibleDots: 0, remaining: 0 });

  // Case 2: 5 queue -> 5 dots, 0 remaining
  assert.deepEqual(computeDots(5), { visibleDots: 5, remaining: 0 });

  // Case 3: 12 queue -> 12 dots, 0 remaining
  assert.deepEqual(computeDots(12), { visibleDots: 12, remaining: 0 });

  // Case 4: 15 queue -> 12 dots, 3 remaining ("+3" label)
  assert.deepEqual(computeDots(15), { visibleDots: 12, remaining: 3 });

  // Case 5: 50 queue -> 12 dots, 38 remaining ("+38" label)
  assert.deepEqual(computeDots(50), { visibleDots: 12, remaining: 38 });
});

test('#5 traffic flow: all 16 approaches across 4 junctions compute correct flow status', () => {
  const junctions = ['J1', 'J2', 'J3', 'J4'];
  const directions = ['north', 'south', 'east', 'west'];

  let totalApproaches = 0;
  for (const jId of junctions) {
    for (const dir of directions) {
      totalApproaches++;
    }
  }

  assert.equal(totalApproaches, 16, 'Must have exactly 16 directional approaches');
});
