// Sample-size math and chart geometry for "How many trades should you backtest?".
//
// The unit throughout is a TRADE, not a "backtest": each trade is one win/loss
// trial, which is what the binomial n counts. One backtest run can contain
// hundreds of them.
//
// Deliberately framework-free and colour-free: this module is the part of the
// tool that gets open-sourced under the backtestinglab org, byte-identical to
// what runs on the site. Anything here must work equally under a plain index.html.

// ---------------------------------------------------------------------------
// Domain limits
// ---------------------------------------------------------------------------

export const N_MIN = 10;
// 1000 is already past what a trader reaches by hand, and it is the point where
// the curve has visibly flattened, so nothing is gained by running the axis out
// to 2500. It does leave room for a ±4 target (601 trades), which is why
// TARGET_MOE_MIN sits there.
export const N_MAX = 1000;

export const WIN_RATE_MIN = 30;
export const WIN_RATE_MAX = 85;
export const WIN_RATE_DEFAULT = 50;

export const CONFIDENCE_MIN = 70;
export const CONFIDENCE_MAX = 99.9;
export const CONFIDENCE_DEFAULT = 95;
export const CONFIDENCE_PRESETS = [90, 95, 99];
// Below this the interval is wide-open enough that a losing strategy clears it
// comfortably, so the chart flags it rather than refusing it.
export const CONFIDENCE_WARN_BELOW = 90;

export const TARGET_MOE_DEFAULT = 5;

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/**
 * Inverse standard normal CDF (Acklam's rational approximation, ~1e-9).
 *
 * Needed because the confidence level is a free input: a lookup table of
 * 90/95/99 would not serve a custom 97.5%.
 */
function inverseNormalCdf(p: number): number {
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= 1 - pLow) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

/** Two-tailed critical value for a confidence level given in percent. */
export const zFor = (confidencePct: number): number =>
  inverseNormalCdf(1 - (1 - confidencePct / 100) / 2);

/**
 * Margin of error in percentage points: z * sqrt(p(1-p)/n).
 *
 * This is the *sampling* interval — it runs forward from a win rate assumed
 * true and asks what a sample of n backtested trades could measure. It is not a
 * confidence interval estimated from an observed result; that direction is the
 * companion tool's job and needs Wilson instead.
 */
export function marginOfError(
  winRatePct: number,
  n: number,
  z: number,
): number {
  const p = winRatePct / 100;
  return z * Math.sqrt((p * (1 - p)) / n) * 100;
}

export interface Band {
  moe: number;
  lo: number;
  hi: number;
  /** True where the raw interval ran past 0% or 100% and was clipped. */
  clipped: boolean;
}

/**
 * The interval around `winRatePct`, clipped to [0, 100].
 *
 * Wald is symmetric and unbounded, so a high assumed win rate at small n
 * produces an upper edge above 100%. Clipping is the honest render: a measured
 * win rate above 100% is not a possible outcome.
 */
export function band(winRatePct: number, n: number, z: number): Band {
  const moe = marginOfError(winRatePct, n, z);
  const rawLo = winRatePct - moe;
  const rawHi = winRatePct + moe;
  return {
    moe,
    lo: clamp(rawLo, 0, 100),
    hi: clamp(rawHi, 0, 100),
    clipped: rawLo < 0 || rawHi > 100,
  };
}

/**
 * Trades needed for a target margin of error: n = z^2 * p(1-p) / E^2.
 *
 * Inverts `marginOfError`, so the answer is the smallest whole n whose
 * interval is no wider than the target.
 */
export function requiredSampleSize(
  winRatePct: number,
  targetMoePP: number,
  z: number,
): number {
  const p = winRatePct / 100;
  const e = targetMoePP / 100;
  return Math.ceil((z * z * p * (1 - p)) / (e * e));
}

/**
 * The precision targets the chart can actually answer for, given the current
 * win rate and confidence level.
 *
 * Fixed end stops were wrong: a ±4 target stops short of the axis end, and a
 * tighter one would demand a sample the chart cannot show. The bounds are
 * therefore the margin at each end of the sample-size axis, so the slider
 * travels exactly as far as the marker can and no further.
 *
 * Both ends round up to 0.1. Rounding the max down instead left it one trade
 * short of the axis end (n = 11 rather than 10); rounding up lands on it, and
 * the sub-0.1 overshoot is far too small to push the answer below N_MIN.
 */
export function targetMoeBounds(
  winRatePct: number,
  z: number,
): { min: number; max: number } {
  const upTo01 = (v: number) => Math.ceil(v * 10) / 10;
  return {
    min: upTo01(marginOfError(winRatePct, N_MAX, z)),
    max: upTo01(marginOfError(winRatePct, N_MIN, z)),
  };
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * Portrait phones get the axes swapped rather than a squeezed copy of the
 * desktop chart: sample size runs down the long edge, win rate across the
 * short one, so the cone still has room to visibly narrow.
 */
export type Orientation = 'horizontal' | 'vertical';

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Geometry {
  orientation: Orientation;
  width: number;
  height: number;
  axis: AxisRange;
  plot: { x0: number; y0: number; x1: number; y1: number };
  /** Sample size -> position along the sample-size axis. */
  nToPos: (n: number) => number;
  /** Position along the sample-size axis -> sample size (unrounded). */
  posToN: (pos: number) => number;
  /** Win rate percent -> position along the win-rate axis. */
  pctToPos: (pct: number) => number;
  /** Point for a (sample size, win rate) pair, in the current orientation. */
  point: (n: number, pct: number) => [number, number];
}

export interface AxisRange {
  min: number;
  max: number;
}

/**
 * The win-rate axis range.
 *
 * Derived from the widest the band ever gets — its span at N_MIN — plus a
 * little air, so a full 0-100 axis does not leave most of the chart empty.
 *
 * Crucially this depends only on the win rate and the confidence level, never
 * on n. Dragging the marker therefore cannot rescale the axis underneath the
 * reader's own hand, which would read as the chart fighting back.
 */
export function axisRangeFor(winRatePct: number, z: number): AxisRange {
  const widest = marginOfError(winRatePct, N_MIN, z);
  const air = 4;
  return {
    min: clamp(Math.floor((winRatePct - widest - air) / 5) * 5, 0, 100),
    max: clamp(Math.ceil((winRatePct + widest + air) / 5) * 5, 0, 100),
  };
}

/** Win-rate gridlines: every 10 points inside the visible range. */
export function winRateTicks({ min, max }: AxisRange): number[] {
  const ticks: number[] = [];
  for (let p = Math.ceil(min / 10) * 10; p <= max; p += 10) ticks.push(p);
  return ticks;
}

export function makeGeometry(
  width: number,
  height: number,
  pad: Padding,
  orientation: Orientation,
  axis: AxisRange,
): Geometry {
  const plot = {
    x0: pad.left,
    y0: pad.top,
    x1: width - pad.right,
    y1: height - pad.bottom,
  };

  const logMin = Math.log10(N_MIN);
  const logMax = Math.log10(N_MAX);
  const nFraction = (n: number) =>
    (Math.log10(clamp(n, N_MIN, N_MAX)) - logMin) / (logMax - logMin);
  const pctFraction = (pct: number) =>
    (clamp(pct, axis.min, axis.max) - axis.min) / (axis.max - axis.min);

  const horizontal = orientation === 'horizontal';
  // The sample-size axis runs left-to-right in landscape and top-to-bottom in
  // portrait; the win-rate axis runs bottom-to-top and left-to-right.
  const nSpan = horizontal ? plot.x1 - plot.x0 : plot.y1 - plot.y0;
  const nOrigin = horizontal ? plot.x0 : plot.y0;
  const nToPos = (n: number) => nOrigin + nFraction(n) * nSpan;
  const posToN = (pos: number) => {
    const f = clamp((pos - nOrigin) / nSpan, 0, 1);
    return Math.pow(10, logMin + f * (logMax - logMin));
  };
  const pctToPos = (pct: number) =>
    horizontal
      ? plot.y1 - pctFraction(pct) * (plot.y1 - plot.y0)
      : plot.x0 + pctFraction(pct) * (plot.x1 - plot.x0);

  return {
    orientation,
    width,
    height,
    axis,
    plot,
    nToPos,
    posToN,
    pctToPos,
    point: (n, pct) =>
      horizontal ? [nToPos(n), pctToPos(pct)] : [pctToPos(pct), nToPos(n)],
  };
}

export interface BandPaths {
  fill: string;
  upper: string;
  lower: string;
}

/**
 * The cone: one filled polygon plus its two edges, sampled along the log axis.
 *
 * Edges are traced separately from the fill so a clipped edge can be drawn
 * flat against the 0%/100% boundary without the fill developing a seam.
 */
export function bandPaths(
  geom: Geometry,
  winRatePct: number,
  z: number,
  steps = 240,
): BandPaths {
  const upper: string[] = [];
  const lower: string[] = [];
  const logMin = Math.log10(N_MIN);
  const logMax = Math.log10(N_MAX);

  for (let i = 0; i <= steps; i++) {
    const n = Math.pow(10, logMin + ((logMax - logMin) * i) / steps);
    const { lo, hi } = band(winRatePct, n, z);
    const [ux, uy] = geom.point(n, hi);
    const [lx, ly] = geom.point(n, lo);
    upper.push(`${ux.toFixed(1)} ${uy.toFixed(1)}`);
    lower.push(`${lx.toFixed(1)} ${ly.toFixed(1)}`);
  }

  const upperPath = `M${upper.join(' L')}`;
  const lowerPath = `M${lower.join(' L')}`;
  return {
    fill: `${upperPath} L${lower.slice().reverse().join(' L')} Z`,
    upper: upperPath,
    lower: lowerPath,
  };
}

/** Sample-size gridlines that read as round numbers on a log axis. */
// 500 is deliberately absent: on a log axis it crowds 385, the number everyone
// arrives for.
export const N_TICKS = [10, 20, 50, 100, 200, 385, 1000];

