import { useState } from "react";
import { finalBand, isCalibrated, type RiderProfile, type Skill } from "../calibration";

const SKILLS: Skill[] = ["beginner", "intermediate", "advanced"];
const SKILL_LABEL: Record<Skill, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

export function CalibrationPanel({ profile, update, nudge }: {
  profile: RiderProfile; update: (p: Partial<RiderProfile>) => void; nudge: (which: "low" | "high", delta: number) => void;
}) {
  const [newKite, setNewKite] = useState("");
  const addKite = () => {
    const v = Number(newKite);
    if (v > 0 && !profile.kites.includes(v)) update({ kites: [...profile.kites, v].sort((a, b) => a - b) });
    setNewKite("");
  };
  const removeKite = (k: number) => update({ kites: profile.kites.filter((x) => x !== k) });
  const calibrated = isCalibrated(profile);
  const band = calibrated ? finalBand(profile) : null;

  return (
    <div className="calib">
      <div className="calib-label">Kites (m²)</div>
      <div className="calib-kites">
        {profile.kites.map((k) => (
          <span className="kite-chip" key={k}>{k} <button aria-label={`remove ${k}`} onClick={() => removeKite(k)}>✕</button></span>
        ))}
        <input className="calib-in kite-in" value={newKite} onChange={(e) => setNewKite(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addKite()} inputMode="decimal" placeholder="+ add" />
      </div>

      <div className="calib-row">
        <label>Weight (lb)<input className="calib-in" type="number" value={profile.weightLb || ""} onChange={(e) => update({ weightLb: Number(e.target.value) })} /></label>
        <label>Board (cm)<input className="calib-in" type="number" value={profile.boardCm || ""} onChange={(e) => update({ boardCm: Number(e.target.value) })} /></label>
      </div>

      <div className="calib-label">Skill</div>
      <div className="calib-skill">
        {SKILLS.map((s) => (
          <button key={s} className={`seg${profile.skill === s ? " on" : ""}`} onClick={() => update({ skill: s })}>{SKILL_LABEL[s]}</button>
        ))}
      </div>

      {calibrated && band ? (
        <div className="calib-out">
          <div className="calib-out-head"><span>Your good range</span><span className="calib-est">estimated from your gear</span></div>
          <div className="calib-band">{band.low}–{band.high} <span className="unit">mph</span></div>
          <div className="calib-nudges">
            <div className="nudge"><button aria-label="low -" onClick={() => nudge("low", -1)}>−</button><span>low {band.low}</span><button aria-label="low +" onClick={() => nudge("low", 1)}>+</button></div>
            <div className="nudge"><button aria-label="high -" onClick={() => nudge("high", -1)}>−</button><span>high {band.high}</span><button aria-label="high +" onClick={() => nudge("high", 1)}>+</button></div>
          </div>
          <div className="calib-note">nudge to match how it really feels · resets if you change gear</div>
        </div>
      ) : (
        <div className="calib-note calib-empty">Not calibrated — using generic defaults. Add your gear to personalize.</div>
      )}
    </div>
  );
}
