// Springs for things that move: sheets under a finger, stamps coming down.
// A spring starts from wherever the element is now and with the velocity the
// finger left it, so an animation can be grabbed and reversed mid-flight.

export type SpringConfig = { response: number; damping: number };

/** Apple-style parameters: `response` is the period in seconds, `damping` 1 = no overshoot. */
export const SPRINGS = {
  sheet: { response: 0.42, damping: 0.86 },
  snappy: { response: 0.3, damping: 0.9 },
  bouncy: { response: 0.45, damping: 0.62 },
} satisfies Record<string, SpringConfig>;

export type SpringHandle = { stop: () => void; velocity: () => number; value: () => number };

/**
 * Animates a value from `from` to `to` starting at `velocity` (units/second),
 * calling `onUpdate` every frame. Integrates the spring in 1 ms steps, which
 * is stable for any frame rate.
 */
export function spring(opts: { from: number; to: number; velocity?: number; config?: SpringConfig; onUpdate: (v: number) => void; onDone?: () => void }): SpringHandle {
  const { response, damping } = opts.config ?? SPRINGS.sheet;
  const k = (2 * Math.PI) / response; // angular frequency
  const stiffness = k * k;
  const friction = 2 * damping * k;
  let x = opts.from;
  let v = opts.velocity ?? 0;
  let raf = 0;
  let last = 0;
  let stopped = false;

  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    opts.onUpdate(opts.to);
    queueMicrotask(() => opts.onDone?.());
    return { stop: () => {}, velocity: () => 0, value: () => opts.to };
  }

  const frame = (t: number) => {
    if (stopped) return;
    const dt = last ? Math.min(0.064, (t - last) / 1000) : 1 / 60;
    last = t;
    const steps = Math.max(1, Math.round(dt * 1000));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = -stiffness * (x - opts.to) - friction * v;
      v += a * h;
      x += v * h;
    }
    const settled = Math.abs(v) < 0.5 && Math.abs(x - opts.to) < 0.25;
    if (settled) {
      x = opts.to;
      v = 0;
      opts.onUpdate(x);
      opts.onDone?.();
      return;
    }
    opts.onUpdate(x);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
    },
    velocity: () => v,
    value: () => x,
  };
}

/**
 * Where momentum would carry a flick: the distance a scroll view would coast
 * at UIKit's normal deceleration rate. Decisions (dismissing a sheet)
 * use where the gesture is heading, not where the finger stopped.
 */
export function project(velocity: number, rate = 0.998): number {
  return ((velocity / 1000) * rate) / (1 - rate);
}

/** Resistance past an edge: the further you pull, the less it moves. */
export function rubberband(offset: number, dimension: number, constant = 0.55): number {
  const sign = Math.sign(offset);
  const d = Math.abs(offset);
  return sign * (1 - 1 / ((d * constant) / dimension + 1)) * dimension;
}

/** Tracks pointer velocity from the last ~100 ms of movement. */
export class VelocityTracker {
  private points: { t: number; x: number; y: number }[] = [];
  add(x: number, y: number, t = performance.now()) {
    this.points.push({ t, x, y });
    while (this.points.length > 2 && t - this.points[0].t > 100) this.points.shift();
  }
  get(): { x: number; y: number } {
    const p = this.points;
    if (p.length < 2) return { x: 0, y: 0 };
    const a = p[0];
    const b = p[p.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) return { x: 0, y: 0 };
    return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
  }
  reset() {
    this.points = [];
  }
}
