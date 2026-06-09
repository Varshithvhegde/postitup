"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { StickyNote, Users, Zap, Code2, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import KofiButton from "@/components/KofiButton";

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session);
    });
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden" style={{ background: "var(--paper)" }}>
      {/* SVG roughen filter */}
      <svg style={{ display: "none", position: "absolute" }} aria-hidden>
        <defs>
          <filter id="roughen" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* Dot grid background */}
      <div className="fixed inset-0 bg-dot-grid -z-10" />

      {/* Nav */}
      <nav className="sticky top-0 z-50" style={{ borderBottom: "1.5px solid rgba(28,28,28,0.12)", background: "rgba(250,249,246,0.92)", backdropFilter: "blur(6px)" }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span style={{ display:"flex", alignItems:"center", gap: 8 }}>
            <img src="/logo.svg" alt="" width={32} height={32} style={{ display:"block" }} />
            <span style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)" }}>PostItUp</span>
          </span>
          <div className="flex items-center gap-4">
            <KofiButton size="sm" />
            {loggedIn ? (
              <>
                <Link href="/new" style={{ fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink2)", textDecoration: "none" }}>
                  New board
                </Link>
                <Link href="/dashboard" className="sk" style={{ fontFamily: "var(--font-kalam), serif", fontSize: "1rem", padding: "6px 18px", color: "var(--ink)", textDecoration: "none", background: "var(--sticky-y)", position: "relative" }}>
                  <div className="sk-b" />
                  <span className="sk-i">Dashboard →</span>
                </Link>
              </>
            ) : (
              <>
                <Link href="/auth/login" style={{ fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink2)", textDecoration: "none" }}>
                  Sign in
                </Link>
                <Link href="/auth/signup" className="sk" style={{ fontFamily: "var(--font-kalam), serif", fontSize: "1rem", padding: "6px 18px", color: "var(--ink)", textDecoration: "none", background: "var(--sticky-y)", position: "relative" }}>
                  <div className="sk-b" />
                  <span className="sk-i">Get started →</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="relative inline-block mb-6">
          <span className="tape tape-p" style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 64, height: 18, borderRadius: 2 }} />
          <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>collaborative boards</span>
        </div>

        <h1 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "clamp(2.4rem,7vw,4.2rem)", fontWeight: 400, color: "var(--ink)", lineHeight: 1.1, marginBottom: 16 }}>
          Your team&apos;s ideas,<br />pinned together.
        </h1>

        <svg width="340" height="14" viewBox="0 0 340 14" preserveAspectRatio="none" className="mx-auto mb-6" style={{ display: "block" }} aria-hidden>
          <path d="M0,9 C40,3 80,12 120,7 C160,2 200,11 240,7 C280,3 315,10 340,7"
            stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" style={{ transform: "scaleX(1)", transformOrigin: "left" }} />
        </svg>

        <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "1.15rem", color: "var(--ink2)", maxWidth: 540, margin: "0 auto 32px", lineHeight: 1.7 }}>
          Create sticky note boards for retros, feedback, brainstorming — real-time, embeddable, and delightfully paper-like.
        </p>

        <div className="flex flex-wrap gap-3 justify-center">
          <Link href={loggedIn ? "/new" : "/auth/signup"} className="sk" style={{ fontFamily: "var(--font-kalam), serif", fontSize: "1.1rem", padding: "12px 28px", background: "var(--ink)", color: "white", textDecoration: "none", position: "relative", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <div className="sk-b" />
            <span className="sk-i flex items-center gap-2" style={{ color: "white" }}>
              {loggedIn ? "Create a board" : "Get started free"} <ArrowRight size={16} />
            </span>
          </Link>
          <Link href={loggedIn ? "/dashboard" : "/board/demo"} className="sk" style={{ fontFamily: "var(--font-kalam), serif", fontSize: "1.1rem", padding: "12px 28px", background: "var(--sticky-b)", color: "var(--ink)", textDecoration: "none", position: "relative" }}>
            <div className="sk-b" />
            <span className="sk-i">{loggedIn ? "My dashboard →" : "Try demo board"}</span>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { Icon: StickyNote, color: "sn-y", tape: "tape-y", rot: "-1.5deg", title: "Three canvas modes", desc: "Free-drag, ruled lines, or grid snap — owner picks the feel for their board." },
            { Icon: Users,      color: "sn-b", tape: "tape-b", rot: "1deg",    title: "Real-time collab",  desc: "Notes appear live for everyone on the board, no refresh needed." },
            { Icon: Zap,        color: "sn-p", tape: "tape-p", rot: "-0.8deg", title: "Anonymous posting", desc: "No sign-in needed to drop a note on a public or link board." },
            { Icon: Code2,      color: "sn-g", tape: "tape-g", rot: "1.5deg",  title: "Embeddable",        desc: "Drop any board into your site with one iframe line. npm package coming soon." },
          ].map(({ Icon, color, tape, rot, title, desc }) => (
            <div key={title} style={{ position: "relative" }}>
              <span className={`tape ${tape}`} style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 52, height: 16, borderRadius: 2, zIndex: 10 }} />
              <div className={`sk ${color}`} style={{ padding: "24px 18px 20px", position: "relative", transform: `rotate(${rot})`, transition: "transform 0.2s" }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = "rotate(0deg) translateY(-4px)"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = `rotate(${rot})`}
              >
                <div className="sk-b" />
                <div className="sk-i">
                  <Icon size={22} style={{ color: "var(--ink)", marginBottom: 10 }} />
                  <h3 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{title}</h3>
                  <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink2)", lineHeight: 1.6 }}>{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Live reviews board */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <span className="tape tape-y" style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 72, height: 18, borderRadius: 2 }} />
            <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              from real users
            </span>
          </div>
          <h2 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "clamp(1.6rem,4vw,2.4rem)", color: "var(--ink)", marginTop: 12, marginBottom: 6 }}>
            See what people are pinning
          </h2>
          <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", color: "var(--ink3)" }}>
            Live board — drop a note or a review below ↓
          </p>
        </div>

        {/* Embedded live board */}
        <div style={{ position: "relative" }}>
          {/* Tape corners on the iframe frame */}
          <span className="tape tape-b" style={{ position: "absolute", top: -10, left: 24, width: 60, height: 18, borderRadius: 2, transform: "rotate(-4deg)", zIndex: 10 }} />
          <span className="tape tape-p" style={{ position: "absolute", top: -10, right: 24, width: 60, height: 18, borderRadius: 2, transform: "rotate(4deg)", zIndex: 10 }} />
          <div className="sk" style={{
            overflow: "hidden",
            position: "relative",
            boxShadow: "6px 8px 0 rgba(28,28,28,0.14)",
          }}>
            <div className="sk-b" />
            <iframe
              src="https://postitup.varshithvhegde.in/embed/ratig-gcll"
              width="100%"
              height="520"
              style={{ display: "block", border: "none" }}
              title="Live PostItUp board — drop a note"
              loading="lazy"
            />
          </div>
        </div>

        {/* CTA below board */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link href="https://postitup.varshithvhegde.in/board/ratig-gcll"
            target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink2)", textDecoration: "none" }}>
            Open full board ↗
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1.5px solid rgba(28,28,28,0.1)", padding: "24px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap", marginBottom: 10 }}>
          {[
            { label: "Privacy Policy", href: "/legal/privacy" },
            { label: "Terms of Service", href: "/legal/terms" },
            { label: "Cookie Policy", href: "/legal/cookies" },
          ].map(({ label, href }) => (
            <Link key={href} href={href} style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink3)", textDecoration: "none" }}>
              {label}
            </Link>
          ))}
        </div>
        <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink3)" }}>
          ✏️ PostItUp — built with paper &amp; code
        </p>
      </footer>
    </main>
  );
}
