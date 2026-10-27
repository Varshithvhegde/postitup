"use client";

const SWATCHES = ["#1c1c1c", "#ffffff", "#dc2626", "#2563eb", "#16a34a"];

interface Props {
  value: string | null;
  onChange: (v: string | null) => void;
  size?: number;
}

export default function TextColorPicker({ value, onChange, size = 24 }: Props) {
  const custom = value !== null && !SWATCHES.includes(value);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <button type="button" onClick={() => onChange(null)} title="Automatic (contrast with note color)"
        style={{ height: size, padding: "0 8px", fontSize: "0.72rem", fontFamily: "var(--font-kalam), serif", cursor: "pointer", borderRadius: 2, background: value === null ? "#1c1c1c" : "rgba(255,255,255,0.7)", color: value === null ? "#fff" : "#1c1c1c", border: "1.5px solid rgba(28,28,28,0.35)" }}>
        Auto
      </button>
      {SWATCHES.map(hex => (
        <button type="button" key={hex} onClick={() => onChange(hex)} title={hex}
          style={{ width: size, height: size, background: hex, border: value === hex ? "2.5px solid #1c1c1c" : "1.5px solid rgba(28,28,28,0.35)", outline: value === hex && hex === "#1c1c1c" ? "2px solid #fff" : "none", outlineOffset: -4, cursor: "pointer", transform: value === hex ? "scale(1.2)" : "scale(1)", transition: "transform 0.15s", borderRadius: 2, flexShrink: 0 }} />
      ))}
      <label title="Custom text color" style={{ position: "relative", width: size, height: size, cursor: "pointer", flexShrink: 0 }}>
        <div style={{ width: size, height: size, background: custom ? value! : "transparent", border: custom ? "2.5px solid #1c1c1c" : "1.5px dashed rgba(28,28,28,0.45)", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#1c1c1c", overflow: "hidden" }}>
          {custom ? null : "＋"}
        </div>
        <input type="color" value={value ?? "#1c1c1c"} onChange={e => onChange(e.target.value)}
          style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
      </label>
    </div>
  );
}
