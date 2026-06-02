"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { BoardMode, BoardVisibility } from "@/types";
import { sanitizeText, validateBoardTitle, LIMITS } from "@/lib/sanitize";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + "-" + Math.random().toString(36).slice(2, 6);
}

const MODES: { value: BoardMode; label: string; desc: string; bg: string }[] = [
  { value: "free",  label: "Free canvas",  desc: "Drag notes anywhere on an open dot-grid canvas", bg: "sn-y" },
  { value: "grid",  label: "Grid snap",    desc: "Notes snap to a square grid — neat and organized", bg: "sn-b" },
  { value: "ruled", label: "Ruled lines",  desc: "Horizontal lines like a notebook — great for lists", bg: "sn-p" },
];

const VIS: { value: BoardVisibility; label: string; desc: string }[] = [
  { value: "public", label: "Public", desc: "Anyone can find and post" },
  { value: "link",   label: "Link only", desc: "Anyone with the link can post" },
  { value: "private",label: "Private", desc: "Only you can see and post" },
];

export default function NewBoardPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<BoardMode>("free");
  const [visibility, setVisibility] = useState<BoardVisibility>("link");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const titleErr = validateBoardTitle(title);
    if (titleErr) { setError(titleErr); return; }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }

    const cleanTitle = sanitizeText(title);
    const slug = slugify(cleanTitle);
    const { data, error } = await supabase.from("boards").insert({
      title: cleanTitle,
      description: description.trim() ? sanitizeText(description).slice(0, LIMITS.boardDesc.max) : null,
      prompt: prompt.trim() ? sanitizeText(prompt).slice(0, LIMITS.boardPrompt.max) : null,
      slug, mode, visibility,
      owner_id: user.id,
    }).select().single();

    if (error) { setError(error.message); setLoading(false); return; }
    router.push(`/board/${data.slug}`);
  };

  return (
    <main className="min-h-screen px-6 py-12" style={{ background: "var(--paper)" }}>
      <div className="fixed inset-0 bg-dot-grid -z-10" />
      <div className="max-w-xl mx-auto">
        <Link href="/dashboard" style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink2)", textDecoration: "none", display: "inline-block", marginBottom: 32 }}>← Dashboard</Link>

        <div style={{ position: "relative" }}>
          <span className="tape tape-y" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 64, height: 18, borderRadius: 2, zIndex: 10 }} />
          <div className="sk" style={{ padding: "36px 32px", background: "white" }}>
            <div className="sk-b" />
            <div className="sk-i">
              <h1 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.8rem", color: "var(--ink)", marginBottom: 28 }}>New board</h1>

              <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Title */}
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Board title *</span>
                  <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Sprint Retro, Feedback Board…"
                    style={{ padding: "10px 12px", border: "1.5px solid rgba(28,28,28,0.2)", background: "var(--paper)", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink)", outline: "none" }} />
                </label>

                {/* Description */}
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</span>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What's this board for?"
                    style={{ padding: "10px 12px", border: "1.5px solid rgba(28,28,28,0.2)", background: "var(--paper)", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink)", outline: "none", resize: "vertical" }} />
                </label>

                {/* Prompt */}
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Prompt for contributors</span>
                  <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g. What went well? What can we improve?"
                    style={{ padding: "10px 12px", border: "1.5px solid rgba(28,28,28,0.2)", background: "var(--paper)", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink)", outline: "none" }} />
                </label>

                {/* Canvas mode */}
                <div>
                  <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Canvas mode</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {MODES.map(m => (
                      <button key={m.value} type="button" onClick={() => setMode(m.value)}
                        style={{
                          padding: "12px 16px", border: mode === m.value ? "2px solid var(--ink)" : "1.5px solid rgba(28,28,28,0.18)",
                          background: mode === m.value ? `var(--sticky-${m.bg.replace("sn-","")})` : "white",
                          cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 2,
                          transition: "border-color 0.15s, background 0.15s",
                        }}>
                        <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>{m.label}</span>
                        <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink2)" }}>{m.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visibility */}
                <div>
                  <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Who can post?</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {VIS.map(v => (
                      <button key={v.value} type="button" onClick={() => setVisibility(v.value)}
                        style={{
                          flex: 1, padding: "10px 8px", border: visibility === v.value ? "2px solid var(--ink)" : "1.5px solid rgba(28,28,28,0.18)",
                          background: visibility === v.value ? "var(--sticky-y)" : "white",
                          cursor: "pointer", textAlign: "center",
                          transition: "border-color 0.15s, background 0.15s",
                        }}>
                        <div style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.92rem", fontWeight: 700, color: "var(--ink)" }}>{v.label}</div>
                        <div style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.75rem", color: "var(--ink3)" }}>{v.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "#ef4444" }}>{error}</p>}

                <button type="submit" disabled={loading || !title.trim()}
                  style={{ padding: "13px", background: loading || !title.trim() ? "var(--ink3)" : "var(--ink)", color: "white", border: "none", cursor: loading || !title.trim() ? "default" : "pointer", fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.1rem" }}>
                  {loading ? "Creating…" : "Create board →"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
