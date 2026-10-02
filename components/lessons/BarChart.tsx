import { scaleBars } from "@/lib/lessons/calc";

// A single-series column chart, in HTML rather than SVG.
//
// An SVG scales its text with its width, so labels sized for a laptop turn to
// specks on a phone (or the reverse). Plain boxes keep 11px labels at 11px on
// every screen, and the chart is read on a phone first.
//
// One hue: the highlighted column (this month) in full green, the rest in a
// lighter step. The light step is under 3:1 against white, so every column
// carries a value label or tooltip and the numbers are also in a table for
// screen readers - colour is never the only way to read it.

export interface BarPoint {
  /** Full name, for the tooltip and table: "October 2026". */
  label: string;
  /** Under the column: "Oct". */
  short: string;
  value: number;
  highlight?: boolean;
}

export default function BarChart({
  points,
  ariaLabel,
  format = (n) => String(n),
  labels = "all",
}: {
  points: BarPoint[];
  ariaLabel: string;
  format?: (n: number) => string;
  /** "key" labels only the highlighted and the tallest column. */
  labels?: "all" | "key";
}) {
  const heights = scaleBars(
    points.map((p) => p.value),
    100,
  );
  const max = Math.max(0, ...points.map((p) => p.value));

  return (
    <figure className="lb-bars">
      <div className="lb-bars-plot" aria-hidden="true">
        {points.map((p, i) => {
          const show =
            p.value > 0 &&
            (labels === "all" || p.highlight || p.value === max);
          return (
            <div
              key={p.label}
              className={p.highlight ? "lb-bar on" : "lb-bar"}
              title={`${p.label}: ${format(p.value)}`}
            >
              {show && <span className="lb-bar-val">{format(p.value)}</span>}
              <span
                className="lb-bar-fill"
                style={{ height: `${heights[i]}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="lb-bars-axis" aria-hidden="true">
        {points.map((p) => (
          <span key={p.label} className={p.highlight ? "on" : undefined}>
            {p.short}
          </span>
        ))}
      </div>
      <table className="lb-sr">
        <caption>{ariaLabel}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.label}>
              <th scope="row">{p.label}</th>
              <td>{format(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
