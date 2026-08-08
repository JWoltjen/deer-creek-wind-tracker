import { classify, rateDirection, type Category } from "../classify";
import type { Observation } from "../types";

const LABEL: Record<Category, string> = {
  good: "🟢 GOOD RIGHT NOW", gusty: "🟡 RIDEABLE BUT GUSTY",
  light: "⚪ TOO LIGHT", strong: "🔴 STRONG / CAUTION",
};

export function Verdict({ latest }: { latest: Observation | null }) {
  if (!latest) return <section><h1>No data yet</h1></section>;
  const cat = classify(latest.low, latest.high);
  const dir = rateDirection(latest.dir);
  return (
    <section className={`verdict verdict-${cat}`}>
      <h1>{LABEL[cat]}</h1>
      <p>{latest.dir} ({dir}) · {latest.low}–{latest.high} mph</p>
      <small>updated {new Date(latest.time).toLocaleString()}</small>
    </section>
  );
}
