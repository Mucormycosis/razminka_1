import { useEffect, useRef } from 'react';

const WIDTH = 1200;
const HEIGHT = 420;

const LAYERS = [
  { points: 7, variance: 0.62, duration: 14000, y: 148, drift: 54, lift: 9, opacity: 0.72, width: 1.2, color: '#6d9ae8' },
  { points: 9, variance: 0.82, duration: 11500, y: 206, drift: -42, lift: 12, opacity: 0.6, width: 1.5, color: '#5a8cd8' },
  { points: 6, variance: 0.54, duration: 9600, y: 264, drift: 66, lift: 8, opacity: 0.5, width: 1.1, color: '#7d9bf0' },
  { points: 8, variance: 0.7, duration: 13200, y: 318, drift: -34, lift: 11, opacity: 0.42, width: 1.3, color: '#4d97c8' },
  { points: 5, variance: 0.44, duration: 8800, y: 370, drift: 46, lift: 7, opacity: 0.34, width: 1.1, color: '#5f7fd8' },
];

const easeInOut = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

function createPoints(count, variance, y) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const envelope = Math.sin(Math.PI * t);
    points.push([t * WIDTH, y - envelope * (0.16 + Math.random() * variance) * HEIGHT]);
  }
  return points;
}

function toPath(points) {
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)},${c2x.toFixed(1)} ${c2y.toFixed(1)},${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }

  return d;
}

function blend(from, to, t) {
  return from.map(([x, y], i) => [x, y + (to[i][1] - y) * t]);
}

export default function WaveField({ paused = false }) {
  const pathsRef = useRef([]);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const states = LAYERS.map((layer) => {
      const points = createPoints(layer.points, layer.variance, layer.y);
      return {
        from: points,
        to: createPoints(layer.points, layer.variance, layer.y),
        started: 0,
        duration: layer.duration,
        layer,
      };
    });

    states.forEach((state, i) => {
      const node = pathsRef.current[i];
      if (node) node.setAttribute('d', toPath(state.from));
    });

    if (reduced) return undefined;

    let frame = 0;

    const tick = (now) => {
      if (!document.hidden && !pausedRef.current) {
        states.forEach((state, i) => {
          if (!state.started) state.started = now;

          const elapsed = now - state.started;
          const progress = Math.min(elapsed / state.duration, 1);
          const eased = easeInOut(progress);

          const node = pathsRef.current[i];
          if (node) node.setAttribute('d', toPath(blend(state.from, state.to, eased)));

          if (progress >= 1) {
            state.from = state.to;
            state.to = createPoints(state.layer.points, state.layer.variance, state.layer.y);
            state.started = now;
          }
        });
      }

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <svg
      className="field"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {LAYERS.map((layer, i) => (
        <path
          key={layer.points}
          ref={(node) => {
            pathsRef.current[i] = node;
          }}
          className={`field__line field__line--${i + 1}`}
          d=""
          fill="none"
          stroke={layer.color}
          strokeWidth={layer.width}
          strokeOpacity={layer.opacity}
          strokeLinecap="round"
          style={{
            '--drift': `${layer.drift}px`,
            '--lift': `${layer.lift}px`,
            '--layer-speed': `${layer.duration / 1000}s`,
            '--pulse-speed': `${(layer.duration / 1000) * 0.72}s`,
            '--pulse-delay': `${-i * 2.4}s`,
          }}
        />
      ))}
    </svg>
  );
}