"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Board, Note, NoteColor, Lane } from "@/types";
import { sanitizeText, validateNoteContent, validateAuthorName, LIMITS } from "@/lib/sanitize";
import { Plus, X, Trash2, ThumbsUp, ChevronLeft, Copy, Check, Settings, Pencil, GripVertical } from "lucide-react";
import KofiButton from "@/components/KofiButton";

/* ── Default lanes for project tracking ── */
const DEFAULT_LANES: Lane[] = [
  { id: "todo",        label: "To Do",      color: "#fce7f3", order: 0 },
  { id: "in-progress", label: "In Progress", color: "#dbeafe", order: 1 },
  { id: "done",        label: "#dcfce7",     color: "#dcfce7", order: 2 },
];

// Fix Done label
DEFAULT_LANES[2].label = "Done";

const LEGACY: Record<string, string> = {
  yellow: "#fef9c3", blue: "#dbeafe", pink: "#fce7f3",
  green: "#dcfce7", orange: "#ffedd5",
};
const PRESETS = ["#fef9c3","#dbeafe","#fce7f3","#dcfce7","#ffedd5",
                 "#f0fdf4","#fdf2f8","#eff6ff","#fff7ed","#f0f9ff"];
function colorBg(c: NoteColor): string { return LEGACY[c] ?? c; }

function getFingerprint() {
  let fp = localStorage.getItem("piu_fp");
  if (!fp) { fp = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("piu_fp", fp); }
  return fp;
}

interface Props {
  board: Board;
  initialNotes: Note[];
  currentUser: { id: string; email: string } | null;
  isOwner: boolean;
}

export default function LaneCanvas({ board, initialNotes, currentUser, isOwner }: Props) {
  const supabase = createClient();
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [copied, setCopied] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  /* ── Add note modal ── */
  const [showAdd, setShowAdd]         = useState(false);
  const [addLane, setAddLane]         = useState("todo");
  const [newText, setNewText]         = useState("");
  const [newColor, setNewColor]       = useState<NoteColor>("#fef9c3");
  const [authorName, setAuthorName]   = useState(() => typeof window !== "undefined" ? localStorage.getItem("piu_name") ?? "" : "");
  const [addError, setAddError]       = useState("");
  const [saving, setSaving]           = useState(false);

  /* ── Inline edit ── */
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editText, setEditText]       = useState("");

  /* ── Drag between lanes ── */
  const dragging = useRef<{ id: string; fromLane: string } | null>(null);
  const [dragOverLane, setDragOverLane] = useState<string | null>(null);

  /* ── Voted ── */
  const [voted, setVoted] = useState<Set<string>>(new Set());

  /* ── Realtime ── */
  useEffect(() => {
    const ch = supabase.channel(`lane:${board.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notes", filter: `board_id=eq.${board.id}` },
        p => setNotes(n => n.find(x => x.id === p.new.id) ? n : [...n, p.new as Note]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notes", filter: `board_id=eq.${board.id}` },
        p => setNotes(n => n.map(x => x.id === p.new.id ? { ...x, ...p.new } : x)))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notes", filter: `board_id=eq.${board.id}` },
        p => setNotes(n => n.filter(x => x.id !== p.old.id)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [board.id, supabase]);

  /* ── Add note ── */
  const addNote = async () => {
    const ce = validateNoteContent(newText);
    if (ce) { setAddError(ce); return; }
    const ne = validateAuthorName(authorName);
    if (ne) { setAddError(ne); return; }
    setSaving(true);
    const clean = sanitizeText(newText);
    const name  = sanitizeText(authorName) || "Anonymous";
    localStorage.setItem("piu_name", name);
    const laneNotes = notes.filter(n => n.lane_id === addLane);
    const { error } = await supabase.from("notes").insert({
      board_id: board.id, content: clean, color: newColor,
      x: 0, y: 0, width: 220, rotation: 0,
      author_name: name, user_id: currentUser?.id ?? null,
      lane_id: addLane, lane_order: laneNotes.length,
    });
    setSaving(false);
    if (error) { setAddError("Failed to save. Try again."); return; }
    setNewText(""); setShowAdd(false);
  };

  /* ── Delete note ── */
  const deleteNote = async (id: string) => {
    setNotes(n => n.filter(x => x.id !== id));
    await supabase.from("notes").delete().eq("id", id);
  };

  /* ── Inline edit ── */
  const saveEdit = async (id: string) => {
    const clean = sanitizeText(editText).trim();
    setEditingId(null);
    if (!clean) return;
    setNotes(ns => ns.map(n => n.id === id ? { ...n, content: clean } : n));
    await supabase.from("notes").update({ content: clean }).eq("id", id);
  };

  /* ── Upvote ── */
  const upvote = async (note: Note) => {
    const fp = getFingerprint();
    if (voted.has(note.id)) return;
    const { data } = await supabase.rpc("increment_upvote", { note_id: note.id, voter_fp: fp });
    if (data?.success) {
      setVoted(v => new Set([...v, note.id]));
      setNotes(ns => ns.map(n => n.id === note.id ? { ...n, upvotes: data.upvotes } : n));
    }
  };

  /* ── Drag & drop between lanes ── */
  const onDragStart = (e: React.DragEvent, note: Note) => {
    dragging.current = { id: note.id, fromLane: note.lane_id ?? "todo" };
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent, laneId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverLane(laneId);
  };

  const onDrop = async (e: React.DragEvent, laneId: string) => {
    e.preventDefault();
    setDragOverLane(null);
    if (!dragging.current || dragging.current.fromLane === laneId) { dragging.current = null; return; }
    const { id } = dragging.current;
    dragging.current = null;
    const laneNotes = notes.filter(n => n.lane_id === laneId);
    setNotes(ns => ns.map(n => n.id === id ? { ...n, lane_id: laneId, lane_order: laneNotes.length } : n));
    await supabase.from("notes").update({ lane_id: laneId, lane_order: laneNotes.length }).eq("id", id);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lanes = DEFAULT_LANES;

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: "var(--paper)", overflow: "hidden" }}>

      {/* Toolbar */}
      <div style={{ flexShrink: 0, borderBottom: "1.5px solid rgba(28,28,28,0.12)", background: "rgba(250,249,246,0.95)", backdropFilter: "blur(6px)", zIndex: 50, position: "relative" }}>
        <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
            <a href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--ink2)", textDecoration: "none", fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", flexShrink: 0 }}>
              <ChevronLeft size={16} /> Back
            </a>
            <div style={{ width: 1, height: 20, background: "rgba(28,28,28,0.15)", flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {board.title}
            </span>
            {/* Beta badge */}
            <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.7rem", padding: "2px 7px", background: "#fde047", border: "1px solid rgba(28,28,28,0.2)", color: "var(--ink)", flexShrink: 0, fontWeight: 700 }}>
              BETA
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <a href="https://github.com/Varshithvhegde/postitup/issues" target="_blank" rel="noopener noreferrer"
              className="desktop-only"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", background: "var(--paper2)", border: "1.5px solid rgba(28,28,28,0.18)", color: "var(--ink2)", textDecoration: "none", fontFamily: "var(--font-kalam), serif", fontSize: "0.82rem" }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              Feedback
            </a>

            <button onClick={() => setShowAdd(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", background: "var(--ink)", border: "none", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem", color: "white" }}>
              <Plus size={14} /> Add card
            </button>

            <button onClick={copyLink}
              style={{ display: "flex", alignItems: "center", padding: "7px 10px", background: copied ? "var(--sticky-g)" : "var(--paper2)", border: "1.5px solid rgba(28,28,28,0.18)", cursor: "pointer", color: "var(--ink)", transition: "background 0.2s" }}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>

            <button onClick={() => setMobileMenu(m => !m)}
              style={{ display: "flex", alignItems: "center", padding: "7px 8px", background: mobileMenu ? "var(--sticky-y)" : "var(--paper2)", border: "1.5px solid rgba(28,28,28,0.18)", cursor: "pointer", color: "var(--ink)" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="13" cy="8" r="1.5"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop + overflow menu */}
      {mobileMenu && <div style={{ position: "fixed", inset: 0, zIndex: 58 }} onClick={() => setMobileMenu(false)} />}
      {mobileMenu && (
        <div style={{ position: "fixed", top: 52, right: 8, zIndex: 70, minWidth: 200, background: "rgba(250,249,246,0.99)", border: "1.5px solid rgba(28,28,28,0.15)", boxShadow: "4px 5px 0 rgba(28,28,28,0.12)", padding: "8px", display: "flex", flexDirection: "column", gap: 2 }}>
          <KofiButton size="sm" />
          {isOwner && (
            <a href={`/board/${board.slug}/settings`} onClick={() => setMobileMenu(false)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", color: "var(--ink2)", textDecoration: "none", fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem" }}>
              <Settings size={14} /> Board settings
            </a>
          )}
        </div>
      )}

      {/* ── Lane board ── */}
      <div style={{ flex: 1, display: "flex", gap: 0, overflow: "hidden", background: "var(--paper)" }}>
        {/* Background dot grid */}
        <div className="bg-dot-grid" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />

        <div style={{ display: "flex", gap: 16, padding: "20px 16px", overflowX: "auto", overflowY: "hidden", flex: 1, position: "relative", zIndex: 1 }}>
          {lanes.map(lane => {
            const laneNotes = notes
              .filter(n => n.lane_id === lane.id)
              .sort((a, b) => a.lane_order - b.lane_order);
            const isOver = dragOverLane === lane.id;

            return (
              <div
                key={lane.id}
                onDragOver={e => onDragOver(e, lane.id)}
                onDragLeave={() => setDragOverLane(null)}
                onDrop={e => onDrop(e, lane.id)}
                style={{
                  flex: "0 0 300px",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  minWidth: 0,
                }}
              >
                {/* Lane header */}
                <div style={{
                  background: lane.color,
                  border: "1.5px solid var(--ink)",
                  borderBottom: "none",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  position: "relative",
                }}>
                  {/* Tape on header */}
                  <span className={`tape tape-${lane.id === "todo" ? "p" : lane.id === "in-progress" ? "b" : "g"}`}
                    style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 48, height: 15, borderRadius: 2 }} />
                  <h3 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>
                    {lane.label}
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.75rem", color: "var(--ink3)", background: "rgba(28,28,28,0.08)", padding: "1px 7px", borderRadius: 10 }}>
                      {laneNotes.length}
                    </span>
                    <button onClick={() => { setAddLane(lane.id); setShowAdd(true); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink2)", display: "flex", alignItems: "center", padding: 2, transition: "color 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "var(--ink)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "var(--ink2)")}>
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {/* Lane body */}
                <div style={{
                  flex: 1,
                  overflowY: "auto",
                  border: "1.5px solid var(--ink)",
                  background: isOver ? `${lane.color}80` : "rgba(255,255,255,0.55)",
                  padding: "10px 10px 60px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  transition: "background 0.15s",
                  backdropFilter: "blur(2px)",
                }}>
                  {laneNotes.length === 0 && !isOver && (
                    <div style={{ textAlign: "center", padding: "32px 12px", pointerEvents: "none" }}>
                      <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink3)" }}>
                        Drop cards here
                      </p>
                    </div>
                  )}

                  {laneNotes.map(note => (
                    <div
                      key={note.id}
                      draggable={editingId !== note.id}
                      onDragStart={e => onDragStart(e, note)}
                      style={{
                        background: colorBg(note.color),
                        border: "1.5px solid var(--ink)",
                        boxShadow: "2px 3px 0 rgba(28,28,28,0.1)",
                        padding: "12px 12px 10px",
                        position: "relative",
                        cursor: editingId === note.id ? "default" : "grab",
                        transition: "box-shadow 0.15s, transform 0.15s",
                        userSelect: editingId === note.id ? "text" : "none",
                      }}
                      onMouseEnter={e => { if (editingId !== note.id) { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "3px 5px 0 rgba(28,28,28,0.14)"; } }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "2px 3px 0 rgba(28,28,28,0.1)"; }}
                    >
                      {/* Drag handle */}
                      {editingId !== note.id && (
                        <div style={{ position: "absolute", top: 8, left: 6, color: "var(--ink3)", opacity: 0.4, cursor: "grab" }}>
                          <GripVertical size={12} />
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{ position: "absolute", top: 5, right: 5, display: "flex", gap: 2 }}>
                        {(isOwner || currentUser?.id === note.user_id) && editingId !== note.id && (
                          <button onClick={() => { setEditingId(note.id); setEditText(note.content); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink3)", padding: 2, opacity: 0.5 }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}>
                            <Pencil size={11} />
                          </button>
                        )}
                        {(isOwner || currentUser?.id === note.user_id) && (
                          <button onClick={() => deleteNote(note.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink3)", padding: 2, opacity: 0.5 }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}>
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>

                      {/* Content */}
                      {editingId === note.id ? (
                        <textarea
                          autoFocus
                          value={editText}
                          onChange={e => setEditText(e.target.value.slice(0, LIMITS.noteContent.max))}
                          onBlur={() => saveEdit(note.id)}
                          onKeyDown={e => { if (e.key === "Enter" && e.metaKey) { e.preventDefault(); saveEdit(note.id); } if (e.key === "Escape") setEditingId(null); }}
                          style={{ width: "100%", background: "rgba(255,255,255,0.5)", border: "1.5px solid var(--ink)", fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", color: "var(--ink)", lineHeight: 1.6, resize: "none", outline: "none", padding: "4px 6px", marginTop: 4 }}
                          rows={3}
                        />
                      ) : (
                        <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", color: "var(--ink)", lineHeight: 1.6, margin: "0 0 10px 16px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {note.content}
                        </p>
                      )}

                      {/* Footer */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px dashed rgba(28,28,28,0.15)", marginTop: editingId === note.id ? 8 : 0 }}>
                        <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.72rem", fontWeight: 700, color: "var(--ink2)" }}>— {note.author_name}</span>
                        <button onClick={() => upvote(note)}
                          style={{ display: "flex", alignItems: "center", gap: 3, background: voted.has(note.id) ? "rgba(28,28,28,0.1)" : "none", border: "1px solid rgba(28,28,28,0.15)", borderRadius: 20, padding: "2px 7px", cursor: voted.has(note.id) ? "default" : "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.72rem", color: "var(--ink2)" }}>
                          <ThumbsUp size={10} style={{ color: voted.has(note.id) ? "var(--ink)" : "var(--ink3)" }} />
                          {note.upvotes}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Add card modal ── */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,28,28,0.35)", backdropFilter: "blur(3px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setShowAdd(false)}>
          <div style={{ position: "relative", maxWidth: 380, width: "100%" }} onClick={e => e.stopPropagation()}>
            <span className="tape tape-y" style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 56, height: 17, borderRadius: 2, zIndex: 10 }} />
            <div className="sk" style={{ background: colorBg(newColor), padding: "28px 22px 22px" }}>
              <div className="sk-b" />
              <div className="sk-i">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.1rem", color: "var(--ink)" }}>New card</h3>
                  <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink2)" }}><X size={18} /></button>
                </div>

                {/* Lane selector */}
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink3)", marginBottom: 6 }}>Add to column</p>
                  <div style={{ display: "flex", gap: 6 }}>
                    {lanes.map(l => (
                      <button key={l.id} onClick={() => setAddLane(l.id)}
                        style={{ flex: 1, padding: "6px 8px", background: addLane === l.id ? l.color : "white", border: addLane === l.id ? "2px solid var(--ink)" : "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.8rem", color: "var(--ink)", transition: "all 0.15s" }}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Author */}
                <input value={authorName} onChange={e => setAuthorName(e.target.value.slice(0, LIMITS.authorName.max))}
                  placeholder="Your name (optional)"
                  style={{ width: "100%", padding: "7px 10px", border: "1.5px solid rgba(28,28,28,0.2)", background: "rgba(255,255,255,0.6)", fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink)", outline: "none", marginBottom: 10 }} />

                {/* Content */}
                <div style={{ position: "relative", marginBottom: 10 }}>
                  <textarea autoFocus value={newText}
                    onChange={e => { setAddError(""); setNewText(e.target.value.slice(0, LIMITS.noteContent.max)); }}
                    onKeyDown={e => { if (e.key === "Enter" && e.metaKey) addNote(); }}
                    placeholder="What needs to be done?" rows={3}
                    style={{ width: "100%", padding: "10px", border: `1.5px solid ${newText.length >= LIMITS.noteContent.max ? "#ef4444" : "rgba(28,28,28,0.2)"}`, background: "rgba(255,255,255,0.6)", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink)", outline: "none", resize: "vertical" }}
                  />
                  <span style={{ position: "absolute", bottom: 6, right: 8, fontFamily: "var(--font-kalam), serif", fontSize: "0.7rem", color: "var(--ink3)" }}>{newText.length}/{LIMITS.noteContent.max}</span>
                </div>

                {/* Color */}
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink3)", marginBottom: 6 }}>Card color</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    {PRESETS.map(hex => (
                      <button key={hex} onClick={() => setNewColor(hex)}
                        style={{ width: 22, height: 22, background: hex, border: newColor === hex ? "2.5px solid var(--ink)" : "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", borderRadius: 2, transform: newColor === hex ? "scale(1.2)" : "scale(1)", transition: "transform 0.15s" }} />
                    ))}
                    <label style={{ position: "relative", width: 22, height: 22, cursor: "pointer" }}>
                      <div style={{ width: 22, height: 22, background: !PRESETS.includes(newColor) ? newColor : "transparent", border: "1.5px dashed rgba(28,28,28,0.35)", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", color: "var(--ink3)" }}>
                        {PRESETS.includes(newColor) ? "＋" : null}
                      </div>
                      <input type="color" value={PRESETS.includes(newColor) ? "#ffffff" : newColor}
                        onChange={e => setNewColor(e.target.value)}
                        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
                    </label>
                  </div>
                </div>

                {addError && <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "#ef4444", marginBottom: 10 }}>{addError}</p>}

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={addNote} disabled={!newText.trim() || saving}
                    style={{ flex: 1, padding: "10px", background: newText.trim() && !saving ? "var(--ink)" : "var(--ink3)", color: "white", border: "none", cursor: newText.trim() && !saving ? "pointer" : "default", fontFamily: "var(--font-kalam), serif", fontSize: "1rem" }}>
                    {saving ? "Adding…" : "Add card 📌"}
                  </button>
                  <button onClick={() => setShowAdd(false)}
                    style={{ padding: "10px 14px", background: "none", border: "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink2)" }}>
                    Cancel
                  </button>
                </div>
                <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.72rem", color: "var(--ink3)", marginTop: 8, textAlign: "center" }}>⌘+Enter to add</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
