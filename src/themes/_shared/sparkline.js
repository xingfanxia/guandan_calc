/**
 * Sparkline renderer — pure SVG, no dependencies.
 *
 * Returns an SVG element ready to insert into the DOM. Inherits theme colors
 * via CSS variables so a sparkline rendered under Trading picks up amber,
 * under Linear picks up purple, etc. — without re-rendering on theme switch.
 *
 * Phase 3.5 ship — wired into stats-table when featureManifest.sparklines === true.
 * Demo reference: docs/design/demos/demo-trading-v2.html lines 1774-1902 (rank time-series).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @typedef {Object} SparklineOptions
 * @property {number[]} data           Required. Numeric series.
 * @property {number} [width=120]      SVG viewBox width.
 * @property {number} [height=24]      SVG viewBox height.
 * @property {[number, number]} [range] Y-axis [min, max]. Default: derived from data.
 * @property {boolean} [invertY=false] Flip Y so smaller values plot higher (use for ranks where 1 = top).
 * @property {boolean} [showDots=true] Draw a circle at each data point.
 * @property {boolean} [showGrid=false] Draw faint top/middle/bottom grid lines.
 * @property {string} [color]          Stroke color. Default: `var(--accent)`.
 * @property {string} [accentColor]    Marker color for the most recent point. Default: same as color.
 * @property {string} [ariaLabel]      Accessible label.
 */

/**
 * Render a sparkline as an SVG element.
 *
 * @param {SparklineOptions} options
 * @returns {SVGElement|null} The SVG element, or null if data is empty.
 */
export function renderSparkline(options = {}) {
  const {
    data,
    width = 120,
    height = 24,
    range,
    invertY = false,
    showDots = true,
    showGrid = false,
    color = 'var(--accent, currentColor)',
    accentColor,
    ariaLabel,
  } = options;

  if (!Array.isArray(data) || data.length === 0) return null;

  const padX = 2;
  const padY = 2;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  let lo;
  let hi;
  if (Array.isArray(range) && range.length === 2) {
    [lo, hi] = range;
  } else {
    lo = Math.min(...data);
    hi = Math.max(...data);
  }
  // Avoid divide-by-zero — flat series renders mid-line.
  const span = hi - lo === 0 ? 1 : hi - lo;

  const xFor = (i) =>
    data.length === 1 ? width / 2 : padX + (i / (data.length - 1)) * innerW;

  const yFor = (val) => {
    const t = (val - lo) / span;
    const t2 = invertY ? t : 1 - t;
    return padY + t2 * innerH;
  };

  const points = data.map((val, i) => `${xFor(i).toFixed(1)},${yFor(val).toFixed(1)}`).join(' ');

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'sparkline');
  if (ariaLabel) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', ariaLabel);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }

  if (showGrid) {
    const grid = (y, dashed = false) => {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', String(y));
      line.setAttribute('x2', String(width));
      line.setAttribute('y2', String(y));
      line.setAttribute('class', 'sparkline__grid');
      if (dashed) line.setAttribute('stroke-dasharray', '2 2');
      return line;
    };
    svg.appendChild(grid(padY));
    svg.appendChild(grid(height / 2, true));
    svg.appendChild(grid(height - padY));
  }

  const polyline = document.createElementNS(SVG_NS, 'polyline');
  polyline.setAttribute('points', points);
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', color);
  polyline.setAttribute('stroke-width', '1.5');
  polyline.setAttribute('stroke-linecap', 'round');
  polyline.setAttribute('stroke-linejoin', 'round');
  polyline.setAttribute('class', 'sparkline__line');
  svg.appendChild(polyline);

  if (showDots) {
    data.forEach((val, i) => {
      const cx = xFor(i);
      const cy = yFor(val);
      const isLast = i === data.length - 1;
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('cx', cx.toFixed(1));
      dot.setAttribute('cy', cy.toFixed(1));
      dot.setAttribute('r', isLast ? '2.2' : '1.6');
      dot.setAttribute('fill', isLast ? (accentColor || color) : color);
      dot.setAttribute('class', isLast ? 'sparkline__dot sparkline__dot--last' : 'sparkline__dot');
      svg.appendChild(dot);
    });
  }

  return svg;
}

/**
 * Convenience helper for ranking sparklines (1 = best, N = worst).
 *
 * @param {number[]} rankings  Per-round ranking (1..mode).
 * @param {number} mode        Player count — defines the Y-axis upper bound.
 * @param {Partial<SparklineOptions>} [extra]
 * @returns {SVGElement|null}
 */
export function renderRankingSparkline(rankings, mode, extra = {}) {
  return renderSparkline({
    data: rankings,
    range: [1, Math.max(mode || 8, ...rankings, 1)],
    invertY: true,
    showGrid: true,
    ariaLabel: `近 ${rankings.length} 局排名`,
    ...extra,
  });
}
