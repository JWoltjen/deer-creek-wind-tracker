import { classify, steadiness, rateDirection } from "../classify";
import { CAT_LABEL, categoryColor } from "../theme";
import type { Observation } from "../types";
import { useThresholds } from "../ThresholdsContext";
import { recommendKite, type RiderProfile } from "../calibration";

const DIR_NOTE = { ideal: "ideal direction", ok: "ok direction", off: "off direction" } as const;

export function Verdict({ latest, profile }: { latest: Observation | null; profile: RiderProfile }) {
  const t = useThresholds();
  if (!latest) return <div className="verdict"><p>No data yet</p></div>;
  const cat = classify(latest.low, latest.high, t);
  const dir = rateDirection(latest.dir);
  const spread = latest.high - latest.low;
  return (
    <div className="verdict">
      <div className="verdict-head">
        <span className="chip" style={{ color: categoryColor[cat] }}>● {CAT_LABEL[cat]}</span>
        <span className="verdict-time">updated {new Date(latest.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
        <a className="live-link" href="http://65.130.252.76:90/fastDC.htm" target="_blank" rel="noreferrer">See live →</a>
      </div>
      <div className="verdict-num">
        <span className="lull">{latest.low}</span><span className="sep">–</span>
        <span className="gust" style={{ color: "var(--accent)" }}>{latest.high}</span>
        <span className="unit"> mph</span>
      </div>
      <div className="verdict-sub">lull → gust</div>
      <div className="verdict-line">
        <b>{latest.dir}</b> · {steadiness(latest.low, latest.high, t)} ({spread} mph spread) · {DIR_NOTE[dir]}
      </div>
      {profile.kites.length > 0 && (() => {
        const rec = recommendKite(profile.kites, profile.weightLb, (latest.low + latest.high) / 2);
        return rec.note ? <div className="kite-call">🪁 <span>{rec.note}</span></div> : null;
      })()}
    </div>
  );
}
