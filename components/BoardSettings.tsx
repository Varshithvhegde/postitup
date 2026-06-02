"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { Board, BoardMode, BoardVisibility } from "@/types";
import { sanitizeText, validateBoardTitle, LIMITS } from "@/lib/sanitize";
import { Trash2, ChevronLeft, Save, AlertTriangle } from "lucide-react";

const MODES: { value: BoardMode; label: string; desc: string }[] = [
  { value: "free",  label: "Free canvas",  desc: "Drag notes anywhere on an open dot-grid canvas" },
  { value: "grid",  label: "Grid snap",    desc: "Notes snap to a square grid" },
  { value: "ruled", label: "Ruled lines",  desc: "Horizontal lines like a notebook" },
];

const VIS: { value: BoardVisibility; label: string; desc: string }[] = [
  { value: "public",  label: "Public",    desc: "Anyone can find and post" },
  { value: "link",    label: "Link only", desc: "Anyone with the link can post" },
  { value: "private", label: "Private",   desc: "Only you can see and post" },
];

export default function BoardSettings({ board }: { board: Board }) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle]           = useState(board.title);
  const [description, setDescription] = useState(board.description ?? "");
  const [prompt, setPrompt]         = useState(board.prompt ?? "");
  const [mode, setMode]             = useState<BoardMode>(board.mode);
  const [visibility, setVisibility] = useState<BoardVisibility>(board.visibility);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting]     = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    setSaved(false);

    const titleErr = validateBoardTitle(title);
    if (titleErr) { setError(titleErr); setSaving(false); return; }

    const { error } = await supabase
      .from("boards")
      .update({
        title:       sanitizeText(title),
        description: description.trim() ? sanitizeText(description).slice(0, LIMITS.boardDesc.max) : null,
        prompt:      prompt.trim()      ? sanitizeText(prompt).slice(0, LIMITS.boardPrompt.max)    : null,
        mode,
        visibility,
        updated_at: new Date().toISOString(),
      })
      .eq("id", board.id);

    setSaving(false);
    if (error) { setError(error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleDelete = async () => {
    if (deleteConfirm !== board.title) return;
    setDeleting(true);
    const { error } = await supabase.from("boards").delete().eq("id", board.id);
    if (error) { setError(error.message); setDeleting(false); return; }
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen px-6 py-12" style={{ background: "var(--paper)" }}>
      <div className="fixed inset-0 bg-dot-grid -z-10" />
      <div className="max-w-xl mx-auto">
        <Link href={`/board/${board.slug}`}
          style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink2)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 32 }}>
          <ChevronLeft size={15} /> Back to board
        </Link>

        {/* Settings card */}
        <div style={{ position: "relative", marginBottom: 32 }}>
          <span className="tape tape-y" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 64, height: 18, borderRadius: 2, zIndex: 10 }} />
          <div className="sk" style={{ padding: "36px 32px", background: "white" }}>
            <div className="sk-b" />
            <div className="sk-i">
              <h1 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.8rem", color: "var(--ink)", marginBottom: 28 }}>
                Board settings
              </h1>

              <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                {/* Title */}
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Board title *</span>
                  <input value={title} onChange={e => setTitle(e.target.value)} required
                    style={{ padding: "10px 12px", border: "1.5px solid rgba(28,28,28,0.2)", background: "var(--paper)", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink)", outline: "none" }} />
                </label>

                {/* Description */}
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</span>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
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
                        style={{ padding: "12px 16px", border: mode === m.value ? "2px solid var(--ink)" : "1.5px solid rgba(28,28,28,0.18)", background: mode === m.value ? "var(--sticky-y)" : "white", cursor: "pointer", textAlign: "left", transition: "border-color 0.15s, background 0.15s" }}>
                        <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "1rem", fontWeight: 700, color: "var(--ink)", display: "block" }}>{m.label}</span>
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
                        style={{ flex: 1, padding: "10px 8px", border: visibility === v.value ? "2px solid var(--ink)" : "1.5px solid rgba(28,28,28,0.18)", background: visibility === v.value ? "var(--sticky-b)" : "white", cursor: "pointer", textAlign: "center", transition: "border-color 0.15s, background 0.15s" }}>
                        <div style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.92rem", fontWeight: 700, color: "var(--ink)" }}>{v.label}</div>
                        <div style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.72rem", color: "var(--ink3)" }}>{v.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "#ef4444" }}>{error}</p>}

                <button type="submit" disabled={saving || !title.trim()}
                  style={{ padding: "12px", background: saved ? "#16a34a" : saving ? "var(--ink3)" : "var(--ink)", color: "white", border: "none", cursor: saving || !title.trim() ? "default" : "pointer", fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.05rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.2s" }}>
                  <Save size={16} />
                  {saved ? "Saved! ✓" : saving ? "Saving…" : "Save changes"}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div style={{ position: "relative" }}>
          <span className="tape tape-p" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 64, height: 18, borderRadius: 2, zIndex: 10 }} />
          <div className="sk sn-p" style={{ padding: "28px 32px", position: "relative" }}>
            <div className="sk-b" />
            <div className="sk-i">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={18} style={{ color: "#dc2626" }} />
                <h2 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.2rem", color: "#dc2626" }}>Danger zone</h2>
              </div>
              <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.92rem", color: "var(--ink2)", marginBottom: 16, lineHeight: 1.6 }}>
                Deleting this board will permanently remove all notes and data. This cannot be undone.
              </p>

              {!showDelete ? (
                <button onClick={() => setShowDelete(true)}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", background: "white", border: "1.5px solid #dc2626", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", color: "#dc2626" }}>
                  <Trash2 size={15} /> Delete this board
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink)" }}>
                    Type <strong>{board.title}</strong> to confirm deletion:
                  </p>
                  <input
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder={board.title}
                    style={{ padding: "10px 12px", border: "1.5px solid #dc2626", background: "white", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink)", outline: "none" }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={handleDelete}
                      disabled={deleteConfirm !== board.title || deleting}
                      style={{ flex: 1, padding: "10px", background: deleteConfirm === board.title ? "#dc2626" : "var(--ink3)", color: "white", border: "none", cursor: deleteConfirm === board.title && !deleting ? "pointer" : "default", fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                      <Trash2 size={14} />
                      {deleting ? "Deleting…" : "Delete permanently"}
                    </button>
                    <button onClick={() => { setShowDelete(false); setDeleteConfirm(""); }}
                      style={{ padding: "10px 16px", background: "white", border: "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", color: "var(--ink2)" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
