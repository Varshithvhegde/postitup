"use client";

interface Props {
  size?: "sm" | "md";
}

export default function KofiButton({ size = "md" }: Props) {
  const isSmall = size === "sm";

  return (
    <a
      href="https://ko-fi.com/varshithvhegde"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isSmall ? 5 : 7,
        padding: isSmall ? "5px 10px" : "8px 16px",
        background: "#72a4f2",
        border: "1.5px solid rgba(28,28,28,0.2)",
        fontFamily: "var(--font-kalam), serif",
        fontSize: isSmall ? "0.82rem" : "0.95rem",
        color: "white",
        textDecoration: "none",
        boxShadow: "2px 2px 0 rgba(28,28,28,0.12)",
        transition: "transform 0.15s, box-shadow 0.15s",
        whiteSpace: "nowrap",
        flexShrink: 0,
        borderRadius: 2,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.boxShadow = "3px 4px 0 rgba(28,28,28,0.18)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 rgba(28,28,28,0.12)";
      }}
    >
      <img
        src="https://storage.ko-fi.com/cdn/logomarkLogo.png"
        alt="Ko-fi"
        style={{ width: isSmall ? 14 : 18, height: isSmall ? 14 : 18, objectFit: "contain" }}
      />
      <span>{isSmall ? "Ko-fi ☕" : "Support me on Ko-fi"}</span>
    </a>
  );
}
