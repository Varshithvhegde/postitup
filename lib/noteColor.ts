import type { CSSProperties } from "react";

const LEGACY: Record<string, string> = {
  yellow: "#fef9c3", blue: "#dbeafe", pink: "#fce7f3",
  green: "#dcfce7", orange: "#ffedd5",
};

function luminance(hex: string): number | null {
  let h = hex.trim();
  if (!h.startsWith("#")) return null;
  h = h.slice(1);
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const [r, g, b] = [0, 2, 4].map(i => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isDarkColor(c: string): boolean {
  const l = luminance(LEGACY[c] ?? c);
  return l !== null && l < 0.4;
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** Overrides the ink CSS variables: a custom text color wins, otherwise light text on dark notes. */
export function noteInkVars(c: string, textColor?: string | null): CSSProperties {
  if (textColor && HEX6.test(textColor)) {
    return {
      "--ink": textColor,
      "--ink2": `color-mix(in srgb, ${textColor} 80%, transparent)`,
      "--ink3": `color-mix(in srgb, ${textColor} 60%, transparent)`,
    } as CSSProperties;
  }
  if (!isDarkColor(c)) return {};
  return {
    "--ink": "#f8f8f4",
    "--ink2": "#d6d4cc",
    "--ink3": "#b0aea4",
  } as CSSProperties;
}
