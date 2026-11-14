import React from 'react';
import { DIRECTION_COLORS } from '../sim/config.js';

/**
 * Traffic-flow vehicle dots component for a single approach
 * Renders min(queue, 12) scaled car dots.
 * When red/clearance/blocked: dots sit stationary behind stop line.
 * When green and animate=true: dots advance through intersection and fade out.
 * When queue > 12: renders "+N" label.
 */
export function ApproachTrafficDots({
  junction,
  direction,
  queue = 0,
  isGreen = false,
  isBlocked = false,
  animate = true,
  color = null
}) {
  const count = Math.max(0, Number(queue) || 0);
  if (count === 0) return null;

  const visibleDots = Math.min(count, 12);
  const remaining = count - visibleDots;
  const dotColor = color || DIRECTION_COLORS[direction.toUpperCase()] || '#38bdf8';
  const shouldAnimate = animate && isGreen && !isBlocked;

  const cx = junction.x;
  const cy = junction.y;

  // Stop lines and lane offsets
  let stopX = cx;
  let stopY = cy;
  let animationClass = '';
  let labelX = cx;
  let labelY = cy;

  if (direction === 'north') {
    stopX = cx - 10;
    stopY = cy - 44;
    labelX = stopX;
    labelY = stopY - (12 * 7) - 6;
    animationClass = 'car-dot-flow-south';
  } else if (direction === 'south') {
    stopX = cx + 10;
    stopY = cy + 44;
    labelX = stopX;
    labelY = stopY + (12 * 7) + 8;
    animationClass = 'car-dot-flow-north';
  } else if (direction === 'west') {
    stopX = cx - 44;
    stopY = cy + 10;
    labelX = stopX - (12 * 7) - 8;
    labelY = stopY + 2.5;
    animationClass = 'car-dot-flow-east';
  } else if (direction === 'east') {
    stopX = cx + 44;
    stopY = cy - 10;
    labelX = stopX + (12 * 7) + 8;
    labelY = stopY + 2.5;
    animationClass = 'car-dot-flow-west';
  }

  const dots = [];
  for (let k = 0; k < visibleDots; k++) {
    let x = stopX;
    let y = stopY;

    if (direction === 'north') {
      y = stopY - (k * 7);
    } else if (direction === 'south') {
      y = stopY + (k * 7);
    } else if (direction === 'west') {
      x = stopX - (k * 7);
    } else if (direction === 'east') {
      x = stopX + (k * 7);
    }

    const isTailArrival = k === visibleDots - 1;
    const animClass = shouldAnimate 
      ? animationClass 
      : (isTailArrival ? 'car-dot-fade-in' : '');

    dots.push(
      <circle
        key={`dot-${junction.id}-${direction}-${k}`}
        cx={x}
        cy={y}
        r="2.5"
        fill={dotColor}
        stroke="#070b14"
        strokeWidth="0.6"
        className={animClass}
        style={{
          animationDelay: shouldAnimate ? `${(k * 0.1)}s` : undefined,
          transformOrigin: `${x}px ${y}px`
        }}
      />
    );
  }

  return (
    <g className="approach-traffic-dots" aria-hidden="true">
      {dots}

      {/* Overflow "+N" label if queue > 12 */}
      {remaining > 0 && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect
            x="-9"
            y="-5"
            width="18"
            height="10"
            rx="3"
            fill="#0b1329"
            stroke="#475569"
            strokeWidth="0.5"
          />
          <text
            x="0"
            y="2.5"
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="6"
            fontFamily="monospace"
            fontWeight="bold"
          >
            +{remaining}
          </text>
        </g>
      )}
    </g>
  );
}

export default ApproachTrafficDots;
