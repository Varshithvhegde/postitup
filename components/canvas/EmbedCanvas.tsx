"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Board, Note, NoteColor } from "@/types";
import { sanitizeText, validateNoteContent, validateAuthorName, LIMITS } from "@/lib/sanitize";
import { Plus, X, ThumbsUp, Trash2 } from "lucide-react";

const COLORS: { value: NoteColor; bg: string; tape: string }[] = [
  { value: "yellow", bg: "var(--sticky-y)", tape: "tape-y" },
  { value: "blue",   bg: "var(--sticky-b)", tape: "tape-b" },
  { value: "pink",   bg: "var(--sticky-p)", tape: "tape-p" },
  { value: "green",  bg: "var(--sticky-g)", tape: "tape-g" },
  { value: "orange", bg: "var(--sticky-o)", tape: "tape-o" },
];
const colorBg   = (c: NoteColor) => COLORS.find(x => x.value === c)?.bg   ?? "var(--sticky-y)";
const colorTape = (c: NoteColor) => COLORS.find(x => x.value === c)?.tape ?? "tape-y";

const GRID = 32;
function snap(v: number, mode: Board["mode"]) {
  return mode === "grid" ? Math.round(v / GRID) * GRID : v;
}
function randRot() { return (Math.random() - 0.5) * 6; }
function getFingerprint() {
  let fp = localStorage.getItem("piu_fp");
  if (!fp) { fp = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("piu_fp", fp); }
  return fp;
}

interface Props {
  board: Board;
  initialNotes: Note[];
  currentUser: { id: string; email: string } | null;
}

export default function EmbedCanvas({ board, initialNotes, currentUser }: Props) {
  const supabase = createClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const dragging = useRef<{ id: string; ox: number; oy: number; startX: number; startY: number; finalX: number; finalY: number } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addPos, setAddPos] = useState({ x: 100, y: 100 });
  const [newText, setNewText] = useState("");
  const [newColor, setNewColor] = useState<NoteColor>("yellow");
  const [authorName, setAuthorName] = useState(() => typeof window !== "undefined" ? localStorage.getItem("piu_name") ?? "" : "");
  const [voted, setVoted] = useState<Set<string>>(new Set());

  const bgClass = board.mode === "grid" ? "bg-grid" : board.mode === "ruled" ? "bg-ruled" : "bg-dot-grid";

  useEffect(() => {
    const ch = supabase.channel(`embed:${board.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notes", filter: `board_id=eq.${board.id}` },
        p => setNotes(n => n.find(x => x.id === p.new.id) ? n : [...n, p.new as Note]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notes", filter: `board_id=eq.${board.id}` },
        p => setNotes(n => n.map(x => x.id === p.new.id ? { ...x, ...p.new } : x)))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notes", filter: `board_id=eq.${board.id}` },
        p => setNotes(n => n.filter(x => x.id !== p.old.id)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [board.id, supabase]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault(); setIsPanning(true);
      panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
    }
  }, [pan]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: panStart.current.px + e.clientX - panStart.current.mx, y: panStart.current.py + e.clientY - panStart.current.my });
      return;
    }
    if (dragging.current) {
      const nx = snap(dragging.current.ox + (e.clientX - dragging.current.startX) / scale, board.mode);
      const ny = snap(dragging.current.oy + (e.clientY - dragging.current.startY) / scale, board.mode);
      dragging.current.finalX = nx; dragging.current.finalY = ny;
      setNotes(ns => ns.map(n => n.id === dragging.current?.id ? { ...n, x: nx, y: ny } : n));
    }
  }, [isPanning, scale, board.mode]);

  const onMouseUp = useCallback(async () => {
    setIsPanning(false);
    if (dragging.current) {
      const { id, finalX, finalY } = dragging.current;
      dragging.current = null;
      await supabase.from("notes").update({ x: finalX, y: finalY }).eq("id", id);
    }
  }, [supabase]);

  const onDblClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".note-card")) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    setAddPos({ x: snap((e.clientX - rect.left - pan.x) / scale, board.mode), y: snap((e.clientY - rect.top - pan.y) / scale, board.mode) });
    setShowAdd(true);
  }, [pan, scale, board.mode]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); setScale(s => Math.min(2, Math.max(0.4, s - e.deltaY * 0.001))); }
  }, []);

  const [addError, setAddError] = useState("");
  const addNote = async () => {
    setAddError("");
    const contentErr = validateNoteContent(newText);
    if (contentErr) { setAddError(contentErr); return; }
    const nameErr = validateAuthorName(authorName);
    if (nameErr) { setAddError(nameErr); return; }
    const cleanContent = sanitizeText(newText);
    const cleanName    = sanitizeText(authorName) || "Anonymous";
    localStorage.setItem("piu_name", cleanName);
    const { error } = await supabase.from("notes").insert({ board_id: board.id, content: cleanContent, color: newColor, x: addPos.x, y: addPos.y, width: 200, rotation: randRot(), author_name: cleanName, user_id: currentUser?.id ?? null });
    if (error) { setAddError("Failed to save. Try again."); return; }
    setNewText(""); setShowAdd(false);
  };

  const upvote = async (note: Note) => {
    const fp = getFingerprint();
    if (voted.has(note.id)) return;
    const { data } = await supabase.rpc("increment_upvote", { note_id: note.id, voter_fp: fp });
    if (data?.success) {
      setVoted(v => new Set([...v, note.id]));
      setNotes(ns => ns.map(n => n.id === note.id ? { ...n, upvotes: data.upvotes } : n));
    }
  };

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "var(--paper)", fontFamily: "var(--font-kalam), Georgia, serif", overflow: "hidden" }}>
      <svg style={{ display: "none" }} aria-hidden>
        <defs>
          <filter id="roughen"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="3" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G"/></filter>
        </defs>
      </svg>

      {/* Mini toolbar */}
      <div style={{ height: 44, flexShrink: 0, borderBottom: "1.5px solid rgba(28,28,28,0.12)", background: "rgba(250,249,246,0.96)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          📌 {board.title}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {board.prompt && <span style={{ fontSize: "0.75rem", color: "var(--ink3)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{board.prompt}</span>}
          <button onClick={() => { setAddPos({ x: 80, y: 60 }); setShowAdd(true); }}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", background: "var(--ink)", border: "none", cursor: "pointer", color: "white", fontSize: "0.85rem", fontFamily: "inherit" }}>
            <Plus size={13} /> Add note
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={canvasRef} className={bgClass}
        style={{ flex: 1, position: "relative", overflow: "hidden", cursor: isPanning ? "grabbing" : "default" }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp} onDoubleClick={onDblClick} onWheel={onWheel}>

        {notes.length === 0 && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
            <p style={{ fontSize: "1.1rem", color: "var(--ink3)" }}>Double-click to add a note</p>
          </div>
        )}

        <div style={{ position: "absolute", top: 0, left: 0, transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`, transformOrigin: "0 0" }}>
          {notes.map(note => (
            <div key={note.id} className="note-card"
              onMouseDown={e => { if ((e.target as HTMLElement).closest("button")) return; e.stopPropagation(); dragging.current = { id: note.id, ox: note.x, oy: note.y, startX: e.clientX, startY: e.clientY, finalX: note.x, finalY: note.y }; }}
              style={{ position: "absolute", left: note.x, top: note.y, width: note.width, transform: `rotate(${note.rotation}deg)`, cursor: "grab", userSelect: "none", zIndex: 2 }}>
              <span className={`tape ${colorTape(note.color)}`} style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 44, height: 14, borderRadius: 2 }} />
              <div style={{ background: colorBg(note.color), border: "1.5px solid var(--ink)", boxShadow: "2px 3px 0 rgba(28,28,28,0.1)", padding: "20px 12px 10px" }}>
                <p style={{ fontSize: "0.9rem", color: "var(--ink)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{note.content}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 6, borderTop: "1px dashed rgba(28,28,28,0.18)" }}>
                  <span style={{ fontSize: "0.68rem", color: "var(--ink3)" }}>— {note.author_name}</span>
                  <button onClick={() => upvote(note)}
                    style={{ display: "flex", alignItems: "center", gap: 3, background: voted.has(note.id) ? "rgba(28,28,28,0.1)" : "none", border: "1px solid rgba(28,28,28,0.15)", borderRadius: 20, padding: "2px 7px", cursor: voted.has(note.id) ? "default" : "pointer", fontSize: "0.72rem", color: "var(--ink2)", fontFamily: "inherit" }}>
                    <ThumbsUp size={10} /> {note.upvotes}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ position: "absolute", bottom: 8, right: 10, fontSize: "0.7rem", color: "var(--ink3)", background: "rgba(250,249,246,0.8)", padding: "2px 8px" }}>
          {Math.round(scale * 100)}% · Ctrl+scroll zoom · Alt+drag pan
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,28,28,0.3)", backdropFilter: "blur(2px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
          onClick={() => setShowAdd(false)}>
          <div style={{ maxWidth: 340, width: "100%", position: "relative" }} onClick={e => e.stopPropagation()}>
            <span className={`tape ${colorTape(newColor)}`} style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 52, height: 16, borderRadius: 2, zIndex: 10 }} />
            <div className="sk" style={{ background: colorBg(newColor), padding: "24px 20px 18px" }}>
              <div className="sk-b" />
              <div className="sk-i">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.05rem", color: "var(--ink)" }}>New note</span>
                  <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink2)" }}><X size={16} /></button>
                </div>
                <input value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="Your name (optional)"
                  style={{ width: "100%", padding: "6px 9px", border: "1.5px solid rgba(28,28,28,0.2)", background: "rgba(255,255,255,0.6)", fontSize: "0.88rem", fontFamily: "inherit", color: "var(--ink)", outline: "none", marginBottom: 8 }} />
                <textarea autoFocus value={newText} onChange={e => setNewText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && e.metaKey) addNote(); }}
                  placeholder="Write your note…" rows={3}
                  style={{ width: "100%", padding: "8px", border: "1.5px solid rgba(28,28,28,0.2)", background: "rgba(255,255,255,0.6)", fontSize: "0.95rem", fontFamily: "inherit", color: "var(--ink)", outline: "none", resize: "vertical", marginBottom: 12 }} />
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {COLORS.map(c => (
                    <button key={c.value} onClick={() => setNewColor(c.value)}
                      style={{ width: 24, height: 24, background: c.bg, border: newColor === c.value ? "2.5px solid var(--ink)" : "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", borderRadius: 2, transform: newColor === c.value ? "scale(1.15)" : "scale(1)", transition: "transform 0.15s" }} />
                  ))}
                </div>
                <button onClick={addNote} disabled={!newText.trim()}
                  style={{ width: "100%", padding: "9px", background: newText.trim() ? "var(--ink)" : "var(--ink3)", color: "white", border: "none", cursor: newText.trim() ? "pointer" : "default", fontSize: "0.95rem", fontFamily: "inherit" }}>
                  Pin it! 📌
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
