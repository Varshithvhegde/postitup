"use client";
import { useEffect } from "react";

declare global {
  interface Window {
    kofiwidget2: {
      init: (text: string, color: string, id: string) => void;
      draw: () => void;
    };
  }
}

interface Props {
  size?: "sm" | "md";
}

export default function KofiButton({ size = "md" }: Props) {
  const containerId = `kofi-${size}`;

  useEffect(() => {
    // Load Ko-fi widget script once
    if (document.querySelector('script[src*="ko-fi"]')) {
      if (window.kofiwidget2) {
        window.kofiwidget2.init("Support me on Ko-fi", "#72a4f2", "Z0P8212FIO");
        window.kofiwidget2.draw();
      }
      return;
    }
    const script = document.createElement("script");
    script.src = "https://storage.ko-fi.com/cdn/widget/Widget_2.js";
    script.type = "text/javascript";
    script.onload = () => {
      window.kofiwidget2.init("Support me on Ko-fi", "#72a4f2", "Z0P8212FIO");
      window.kofiwidget2.draw();
    };
    document.head.appendChild(script);
  }, []);

  // Render a clean paper-styled link instead of the widget
  // (the widget injects its own iframe which clashes with our CSS)
  return (
    <a
      href="https://ko-fi.com/Z0P8212FIO"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size === "sm" ? 5 : 6,
        padding: size === "sm" ? "5px 10px" : "7px 14px",
        background: "var(--sticky-b)",
        border: "1.5px solid rgba(28,28,28,0.2)",
        fontFamily: "var(--font-kalam), serif",
        fontSize: size === "sm" ? "0.82rem" : "0.9rem",
        color: "var(--ink)",
        textDecoration: "none",
        boxShadow: "2px 2px 0 rgba(28,28,28,0.1)",
        transition: "transform 0.15s, box-shadow 0.15s",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.boxShadow = "3px 4px 0 rgba(28,28,28,0.14)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 rgba(28,28,28,0.1)";
      }}
    >
      {/* Ko-fi cup SVG */}
      <svg width={size === "sm" ? 14 : 16} height={size === "sm" ? 14 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8h1a4 4 0 0 1 0 8h-1"/>
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
        <line x1="6" y1="2" x2="6" y2="4"/>
        <line x1="10" y1="2" x2="10" y2="4"/>
        <line x1="14" y1="2" x2="14" y2="4"/>
      </svg>
      {size === "sm" ? "Ko-fi" : "Buy me a Ko-fi ☕"}
    </a>
  );
}
