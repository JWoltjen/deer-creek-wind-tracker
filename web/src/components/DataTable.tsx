import { toCsv } from "../csv";
import type { Observation } from "../types";

export function DataTable({ observations }: { observations: Observation[] }) {
  const rows = [...observations].sort((a, b) => (a.time < b.time ? 1 : -1));
  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "barbed-wire-observations.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <details className="data-table">
      <summary>Full data ({rows.length} readings)</summary>
      <button onClick={download}>Download CSV</button>
      <table>
        <thead><tr><th>Time</th><th>°F</th><th>Dir</th><th>Low</th><th>High</th></tr></thead>
        <tbody>
          {rows.slice(0, 500).map((o, i) => (
            <tr key={i}><td>{new Date(o.time).toLocaleString()}</td><td>{o.tempF}</td><td>{o.dir}</td><td>{o.low}</td><td>{o.high}</td></tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
