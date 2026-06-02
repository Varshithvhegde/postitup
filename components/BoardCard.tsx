"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Board } from "@/types";
import { Globe, Link as LinkIcon, Lock, Settings } from "lucide-react";

const MODE_LABELS = { free: "Free canvas", grid: "Grid", ruled: "Ruled lines" };
const VIS_ICONS   = { public: Globe, link: LinkIcon, private: Lock };
const VIS_COLORS  = { public: "var(--sticky-g)", link: "var(--sticky-b)", private: "var(--sticky-p)" };
const CARD_COLORS = ["sn-y", "sn-b", "sn-p", "sn-g", "sn-o"];
const CARD_ROTS   = ["-1.5deg", "1deg", "-0.8deg", "1.5deg", "-1deg"];
const TAPE_COLORS = ["y", "b", "p", "g", "o"];

export default function BoardCard({ board, index }: { board: Board; index: number }) {
  const router = useRouter();
  const VIcon  = VIS_ICONS[board.visibility];
  const rot    = CARD_ROTS[index % CARD_ROTS.length];
  const color  = CARD_COLORS[index % CARD_COLORS.length];

  return (
    <div style={{ position: "relative" }}>
      {/* Tape */}
      <span
        className={`tape tape-${TAPE_COLORS[index % TAPE_COLORS.length]}`}
        style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 52, height: 16, borderRadius: 2, zIndex: 10 }}
      />

      {/* Clickable card div — navigates to board */}
      <div
        role="link"
        tabIndex={0}
        onClick={() => router.push(`/board/${board.slug}`)}
        onKeyDown={e => e.key === "Enter" && router.push(`/board/${board.slug}`)}
        className={`sk ${color}`}
        style={{
          display: "block", padding: "22px 18px 18px",
          cursor: "pointer", position: "relative",
          transform: `rotate(${rot})`,
          transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s",
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = "rotate(0deg) translateY(-5px)";
          el.style.boxShadow = "6px 8px 0 rgba(0,0,0,0.14)";
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = `rotate(${rot})`;
          el.style.boxShadow = "";
        }}
      >
        <div className="sk-b" />
        <div className="sk-i">
          <h2 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.2rem", color: "var(--ink)", marginBottom: 6, lineHeight: 1.2 }}>
            {board.title}
          </h2>
          {board.description && (
            <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem", color: "var(--ink2)", marginBottom: 12, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {board.description}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", background: VIS_COLORS[board.visibility], border: "1px solid rgba(28,28,28,0.15)", fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink)" }}>
                <VIcon size={11} /> {board.visibility}
              </span>
              <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink3)" }}>
                {MODE_LABELS[board.mode]}
              </span>
            </div>

            {/* Settings — plain <a>, sibling to card content, stops card click */}
            <a
              href={`/board/${board.slug}/settings`}
              onClick={e => e.stopPropagation()}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 9px", background: "rgba(255,255,255,0.75)", border: "1px solid rgba(28,28,28,0.18)", fontFamily: "var(--font-kalam), serif", fontSize: "0.75rem", color: "var(--ink2)", textDecoration: "none", transition: "color 0.15s, border-color 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--ink)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink2)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(28,28,28,0.18)"; }}
            >
              <Settings size={11} /> Settings
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
