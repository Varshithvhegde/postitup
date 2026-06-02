"use client";
import Link from "next/link";
import type { Board } from "@/types";
import { Globe, Link as LinkIcon, Lock } from "lucide-react";

const MODE_LABELS = { free: "Free canvas", grid: "Grid", ruled: "Ruled lines" };
const VIS_ICONS = { public: Globe, link: LinkIcon, private: Lock };
const VIS_COLORS = { public: "var(--sticky-g)", link: "var(--sticky-b)", private: "var(--sticky-p)" };
const CARD_COLORS = ["sn-y", "sn-b", "sn-p", "sn-g", "sn-o"];
const CARD_ROTS   = ["-1.5deg", "1deg", "-0.8deg", "1.5deg", "-1deg"];
const TAPE_COLORS = ["y", "b", "p", "g", "o"];

export default function BoardCard({ board, index }: { board: Board; index: number }) {
  const VIcon = VIS_ICONS[board.visibility];
  const rot   = CARD_ROTS[index % CARD_ROTS.length];

  return (
    <div style={{ position: "relative" }}>
      <span
        className={`tape tape-${TAPE_COLORS[index % TAPE_COLORS.length]}`}
        style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 52, height: 16, borderRadius: 2, zIndex: 10 }}
      />
      <Link
        href={`/board/${board.slug}`}
        className={`sk ${CARD_COLORS[index % CARD_COLORS.length]}`}
        style={{
          display: "block", padding: "22px 18px 18px",
          textDecoration: "none", position: "relative",
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
          <div className="flex items-center gap-4 mt-3">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", background: VIS_COLORS[board.visibility], border: "1px solid rgba(28,28,28,0.15)", fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink)" }}>
              <VIcon size={11} /> {board.visibility}
            </span>
            <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink3)" }}>
              {MODE_LABELS[board.mode]}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
