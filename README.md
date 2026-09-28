# backtest-sample-size

The sample-size math behind **[How many trades should you backtest?](https://thebacktestinglab.com/tools/how-many-trades-should-you-backtest/)**, the interactive tool at thebacktestinglab.com.

**[Try the live tool →](https://thebacktestinglab.com/tools/how-many-trades-should-you-backtest/)**

A strategy with a true 50% win rate can easily measure 40% or 60% over 100 trades. This module shows how wide that range is for any win rate, confidence level and number of trades, and how many trades you need before the range is narrow enough to trust. At 95% confidence, pinning a 50% win rate to within ±5 points takes **385 trades**.

It is a single TypeScript file with no dependencies, no framework and no colours. `src/sampleSize.ts` is byte-identical to the file that runs on the live site.

## What it does

- **The band.** For a given true win rate and sample size, the range of win rates a backtest could plausibly measure.
- **Trades needed.** The smallest number of trades that brings the band inside a precision target (for example ±5 points).
- **Chart geometry.** Log-scaled axes, the filled cone as SVG path strings, gridline ticks and a portrait mode that swaps the axes. It supplies geometry only; styling is up to you.

## Two things worth knowing

**The unit is a trade, not a backtest.** Each trade is one win/loss trial, which is what the binomial `n` counts. One backtest run can hold hundreds of trades.

**It uses the Wald interval on purpose.** The math runs *forward*: it assumes a true win rate and asks what a sample of `n` trades could measure. That is a sampling interval, and `z * sqrt(p(1 - p) / n)` is the right formula for it. Wald's known weaknesses apply to the *backward* question ("I measured 62% over 40 trades, what is my true win rate?"), which needs the Wilson interval instead. Where the band runs past 0% or 100% it is clipped, and `band()` reports that with `clipped: true`.

## Usage

```ts
import { zFor, band, requiredSampleSize } from './sampleSize';

const z = zFor(95); // 1.96

band(50, 100, z);
// { moe: 9.8, lo: 40.2, hi: 59.8, clipped: false }

requiredSampleSize(50, 5, z);
// 385
```

Win rates, confidence levels and margins are all in **percent** (`50`, not `0.5`).

### Exports

| Export | What it does |
| --- | --- |
| `zFor(confidencePct)` | Two-tailed critical value for any confidence level, not just 90/95/99 |
| `marginOfError(winRatePct, n, z)` | Half-width of the band, in percentage points |
| `band(winRatePct, n, z)` | `{ moe, lo, hi, clipped }`, clipped to 0 to 100 |
| `requiredSampleSize(winRatePct, targetMoePP, z)` | Smallest whole number of trades that meets the target |
| `targetMoeBounds(winRatePct, z)` | The tightest and loosest targets the chart's sample-size range can answer |
| `axisRangeFor(winRatePct, z)` | Win-rate axis range. Depends on win rate and confidence only, never on `n`, so moving the marker never rescales the axis |
| `winRateTicks(axis)` | Win-rate gridlines every 10 points |
| `makeGeometry(width, height, padding, orientation, axis)` | Scales and point mapping for `'horizontal'` or `'vertical'` charts |
| `bandPaths(geometry, winRatePct, z, steps?)` | SVG path strings for the cone's fill and its two edges |
| `N_TICKS` | Sample-size gridlines that read as round numbers on a log axis |
| `N_MIN`, `N_MAX`, `WIN_RATE_*`, `CONFIDENCE_*`, `TARGET_MOE_DEFAULT` | The limits and defaults the live tool uses |
| `clamp(v, lo, hi)` | Helper |

## Run the demo

`demo/index.html` is a minimal page that draws the cone from this module. Browsers cannot run TypeScript directly, so compile it first:

```bash
yarn install
yarn build          # compiles src/sampleSize.ts to dist/
python3 -m http.server 8000
```

Then open <http://localhost:8000/demo/>. Any static server works; opening the file directly will not, because browsers block ES module imports from `file://`.

The demo is deliberately bare. The full tool, with the draggable marker, precision slider and phone layout, is at [thebacktestinglab.com](https://thebacktestinglab.com/tools/how-many-trades-should-you-backtest/).

## Contributing

The live site is the source of truth for `src/sampleSize.ts`, and changes are copied here from it. Issues and pull requests are welcome; accepted changes go into the site first and then come back to this repo.

## Licence

[MIT](LICENSE). Built by [BacktestingLab](https://thebacktestinglab.com) ([@backtestinglab](https://x.com/backtestinglab)).
