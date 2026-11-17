import { formatNumber } from "./ui";

/**
 * Charts.
 *
 * Hand-built SVG rather than a charting library: it renders on the server with
 * no hydration cost, inherits the theme tokens so light and dark both work,
 * and carries real text alternatives for screen readers.
 *
 * The categorical palette is ordered so that adjacent series stay
 * distinguishable for the common forms of colour blindness, and no meaning is
 * ever carried by colour alone - every series is also labelled.
 */

export const SERIES_COLORS = [
  "#6366f1", // indigo
  "#0ea5e9", // sky
  "#22c55e", // green
  "#f59e0b", // amber
  "#ec4899", // pink
  "#14b8a6", // teal
  "#8b5cf6", // violet
  "#f43f5e", // rose
];

/* ------------------------------------------------------------- area chart */

export interface SeriesPoint {
  label: string;
  value: number;
}

export function AreaChart({
  data,
  height = 180,
  color = "var(--brand)",
  valueLabel = "value",
  showAxis = true,
}: {
  data: SeriesPoint[];
  height?: number;
  color?: string;
  valueLabel?: string;
  showAxis?: boolean;
}) {
  if (data.length === 0) {
    return <NoData height={height} />;
  }

  const w = 100; // viewBox units; the SVG scales to its container
  const h = height;
  const padTop = 8;
  const padBottom = showAxis ? 22 : 8;
  const plotH = h - padTop - padBottom;

  const values = data.map((d) => d.value);
  const dataMax = Math.max(...values, 1);
  const dataMin = Math.min(...values);

  /*
   * Anchoring every chart at zero flattens a "level" series - a follower count
   * that moves from 94K to 95K would render as a straight line. So anchor at
   * zero only when the series actually varies across most of its own range
   * (impressions, engagements); otherwise scale to the data with a little
   * headroom, which is what makes the movement visible.
   */
  const varies = dataMin <= 0 || dataMax - dataMin > dataMax * 0.45;
  const pad = (dataMax - dataMin) * 0.15 || dataMax * 0.05;
  const max = varies ? dataMax : dataMax + pad;
  const min = varies ? Math.min(dataMin, 0) : dataMin - pad;
  const range = max - min || 1;

  const x = (i: number) => (data.length === 1 ? w / 2 : (i / (data.length - 1)) * w);
  const y = (v: number) => padTop + plotH - ((v - min) / range) * plotH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(d.value).toFixed(2)}`).join(" ");
  const area = `${line} L${w},${padTop + plotH} L0,${padTop + plotH} Z`;
  const gradId = `grad-${Math.abs(hashString(valueLabel + data.length))}`;

  // Only label the ends and middle - more than three on a sparkline is noise.
  const ticks = data.length <= 3 ? data.map((_, i) => i) : [0, Math.floor((data.length - 1) / 2), data.length - 1];

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height }}
        role="img"
        aria-label={`${valueLabel} over ${data.length} points, from ${formatNumber(data[0].value)} to ${formatNumber(data[data.length - 1].value)}, peaking at ${formatNumber(max)}`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal guides at 0%, 50%, 100% of the range. */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1="0"
            x2={w}
            y1={padTop + plotH * f}
            y2={padTop + plotH * f}
            stroke="var(--border)"
            strokeWidth="0.4"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={area} fill={`url(#${gradId})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Mark the final point so the current value is findable. */}
        <circle
          cx={x(data.length - 1)}
          cy={y(data[data.length - 1].value)}
          r="2.4"
          fill={color}
          stroke="var(--surface)"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {showAxis ? (
        <div
          className="mt-1 flex justify-between text-[0.6875rem]"
          style={{ color: "var(--text-faint)" }}
        >
          {ticks.map((i) => (
            <span key={i}>{data[i].label}</span>
          ))}
        </div>
      ) : null}

      {/* The underlying numbers, for anyone who cannot use the picture. */}
      <figcaption className="sr-only">
        <table>
          <caption>{valueLabel}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <th scope="row">{d.label}</th>
                <td>{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------- bar chart */

export function BarChart({
  data,
  height = 180,
  valueLabel = "value",
  colors,
}: {
  data: SeriesPoint[];
  height?: number;
  valueLabel?: string;
  colors?: string[];
}) {
  if (data.length === 0) return <NoData height={height} />;

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <figure className="m-0">
      <div
        className="flex items-end gap-1.5"
        style={{ height }}
        role="img"
        aria-label={`${valueLabel} by category. ${data
          .map((d) => `${d.label}: ${formatNumber(d.value)}`)
          .join(", ")}`}
      >
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          return (
            <div key={d.label} className="flex min-w-0 flex-1 flex-col justify-end gap-1.5">
              <span
                className="text-center text-[0.625rem] font-semibold tabular-nums"
                style={{ color: "var(--text-faint)" }}
              >
                {formatNumber(d.value)}
              </span>
              <div
                className="rounded-t-[4px] transition-all"
                style={{
                  // A floor of 2% keeps a zero bar visible as "present but empty".
                  height: `${Math.max(2, pct)}%`,
                  background: colors?.[i] ?? SERIES_COLORS[i % SERIES_COLORS.length],
                  opacity: d.value === 0 ? 0.25 : 1,
                }}
                title={`${d.label}: ${d.value.toLocaleString()}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d) => (
          <span
            key={d.label}
            className="min-w-0 flex-1 truncate text-center text-[0.625rem]"
            style={{ color: "var(--text-faint)" }}
            title={d.label}
          >
            {d.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

/* --------------------------------------------------------- stacked bars */

export function StackedBar({
  segments,
  height = 10,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  height?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return (
      <div
        className="w-full rounded-full"
        style={{ height, background: "var(--bg-elevated)" }}
        aria-hidden="true"
      />
    );
  }
  return (
    <div
      className="flex w-full overflow-hidden rounded-full"
      style={{ height, background: "var(--bg-elevated)" }}
      role="img"
      aria-label={segments
        .filter((s) => s.value > 0)
        .map((s) => `${s.label}: ${formatNumber(s.value)}`)
        .join(", ")}
    >
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${s.value.toLocaleString()} (${((s.value / total) * 100).toFixed(0)}%)`}
          />
        ))}
    </div>
  );
}

/* --------------------------------------------------------------- heatmap */

/** Best-time-to-post grid: 7 days x 24 hours. */
export function Heatmap({
  cells,
  dayNames,
}: {
  /** score is 0-100 */
  cells: Array<{ dayOfWeek: number; hour: number; score: number }>;
  dayNames: string[];
}) {
  const grid = new Map<string, number>();
  for (const c of cells) grid.set(`${c.dayOfWeek}-${c.hour}`, c.score);
  const peak = Math.max(...cells.map((c) => c.score), 1);

  const best = [...cells].sort((a, b) => b.score - a.score).slice(0, 3);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: "2px" }}>
          <caption className="sr-only">
            Best times to post by day and hour. Strongest slots:{" "}
            {best.map((b) => `${dayNames[b.dayOfWeek]} ${b.hour}:00 (${Math.round(b.score)}/100)`).join(", ")}
          </caption>
          <thead>
            <tr>
              <th className="w-9" />
              {Array.from({ length: 24 }, (_, h) => (
                <th
                  key={h}
                  scope="col"
                  className="text-[0.5625rem] font-normal"
                  style={{ color: "var(--text-faint)" }}
                >
                  {h % 3 === 0 ? h : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 7 }, (_, d) => (
              <tr key={d}>
                <th
                  scope="row"
                  className="pr-1 text-right text-[0.625rem] font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  {dayNames[d]}
                </th>
                {Array.from({ length: 24 }, (_, h) => {
                  const score = grid.get(`${d}-${h}`) ?? 0;
                  const intensity = score / peak;
                  return (
                    <td key={h} className="p-0">
                      <div
                        className="h-4 w-full rounded-[3px]"
                        style={{
                          minWidth: 10,
                          background:
                            score === 0
                              ? "var(--bg-elevated)"
                              : `color-mix(in srgb, var(--brand) ${Math.round(14 + intensity * 86)}%, transparent)`,
                        }}
                        title={`${dayNames[d]} ${String(h).padStart(2, "0")}:00 - ${score === 0 ? "no data" : `${Math.round(score)}/100`}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="mt-3 flex items-center gap-2 text-[0.6875rem]"
        style={{ color: "var(--text-faint)" }}
      >
        <span>Quiet</span>
        <span className="flex gap-[2px]">
          {[14, 35, 55, 75, 100].map((p) => (
            <span
              key={p}
              className="h-2.5 w-4 rounded-[2px]"
              style={{ background: `color-mix(in srgb, var(--brand) ${p}%, transparent)` }}
            />
          ))}
        </span>
        <span>Peak</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- gauge */

export function ScoreRing({
  score,
  size = 64,
  label,
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (clamped / 100) * circumference;
  const color =
    clamped >= 78 ? "var(--good)" : clamped >= 62 ? "var(--warn)" : "var(--bad)";

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={`${label ? `${label}: ` : ""}${Math.round(clamped)} out of 100`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--bg-elevated)"
          strokeWidth="5"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <span
        className="absolute text-[0.8125rem] font-bold tabular-nums"
        style={{ color }}
      >
        {Math.round(clamped)}
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------- misc */

function NoData({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg text-[0.8125rem]"
      style={{ height, background: "var(--bg-elevated)", color: "var(--text-faint)" }}
    >
      Not enough data yet
    </div>
  );
}

export function Legend({
  items,
}: {
  items: Array<{ label: string; color: string; value?: string }>;
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5 text-[0.75rem]">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: it.color }}
            aria-hidden="true"
          />
          <span style={{ color: "var(--text-muted)" }}>{it.label}</span>
          {it.value ? <span className="font-semibold tabular-nums">{it.value}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
