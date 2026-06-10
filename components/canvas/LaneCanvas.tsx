"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Board, Note, NoteColor, Lane } from "@/types";
import { sanitizeText, validateNoteContent, validateAuthorName, LIMITS } from "@/lib/sanitize";
import { Plus, X, Trash2, ThumbsUp, ChevronLeft, Copy, Check, Settings, Pencil, ChevronRight, ChevronLeft as ChevLeft } from "lucide-react";
import KofiButton from "@/components/KofiButton";

const DEFAULT_LANES: Lane[] = [
  { id: "todo",        label: "To Do",       color: "#fce7f3", order: 0 },
  { id: "in-progress", label: "In Progress", color: "#dbeafe", order: 1 },
  { id: "done",        label: "Done",        color: "#dcfce7", order: 2 },
];

const LEGACY: Record<string, string> = {
  yellow: "#fef9c3", blue: "#dbeafe", pink: "#fce7f3",
  green: "#dcfce7", orange: "#ffedd5",
};
const PRESETS = ["#fef9c3","#dbeafe","#fce7f3","#dcfce7","#ffedd5",
                 "#f0fdf4","#fdf2f8","#eff6ff","#fff7ed","#f0f9ff"];
function colorBg(c: NoteColor): string { return LEGACY[c] ?? c; }

const PRIORITY_CONFIG = {
  high:   { label: "High",   color: "#ef4444", bg: "#fee2e2" },
  medium: { label: "Medium", color: "#f59e0b", bg: "#fef3c7" },
  low:    { label: "Low",    color: "#22c55e", bg: "#dcfce7" },
};

function getFingerprint() {
  let fp = localStorage.getItem("piu_fp");
  if (!fp) { fp = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("piu_fp", fp); }
  return fp;
}

function isOverdue(due: string | null) {
  if (!due) return false;
  return new Date(due) < new Date(new Date().toDateString());
}

function formatDate(due: string) {
  return new Date(due).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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

  const [showAdd, setShowAdd]       = useState(false);
  const [addLane, setAddLane]       = useState("todo");
  const [newText, setNewText]       = useState("");
  const [newColor, setNewColor]     = useState<NoteColor>("#fef9c3");
  const [newPriority, setNewPriority] = useState<"high"|"medium"|"low"|"">("");
  const [newDueDate, setNewDueDate] = useState("");
  const [authorName, setAuthorName] = useState(() => typeof window !== "undefined" ? localStorage.getItem("piu_name") ?? "" : "");
  const [addError, setAddError]     = useState("");
  const [saving, setSaving]         = useState(false);

  // Full edit modal
  const [editNote, setEditNote]     = useState<Note | null>(null);
  const [editText, setEditText]     = useState("");
  const [editColor, setEditColor]   = useState<NoteColor>("#fef9c3");
  const [editPriority, setEditPriority] = useState<"high"|"medium"|"low"|"">("");
  const [editDueDate, setEditDueDate]   = useState("");
  const [editSaving, setEditSaving]     = useState(false);

  const dragging = useRef<{ id: string; fromLane: string } | null>(null);
  const [dragOverLane, setDragOverLane] = useState<string | null>(null);
  const [voted, setVoted] = useState<Set<string>>(new Set());

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
      priority: newPriority || null,
      due_date: newDueDate || null,
    });
    setSaving(false);
    if (error) { setAddError("Failed to save. Try again."); return; }
    setNewText(""); setNewDueDate(""); setNewPriority(""); setShowAdd(false);
  };

  const deleteNote = async (id: string) => {
    setNotes(n => n.filter(x => x.id !== id));
    await supabase.from("notes").delete().eq("id", id);
  };

  const openEdit = (note: Note) => {
    setEditNote(note);
    setEditText(note.content);
    setEditColor(note.color);
    setEditPriority((note.priority as "high"|"medium"|"low"|"") ?? "");
    setEditDueDate(note.due_date ?? "");
  };

  const saveEdit = async () => {
    if (!editNote) return;
    const clean = sanitizeText(editText).trim();
    if (!clean) return;
    setEditSaving(true);
    const update = {
      content:  clean,
      color:    editColor,
      priority: editPriority || null,
      due_date: editDueDate || null,
    };
    setNotes(ns => ns.map(n => n.id === editNote.id ? { ...n, ...update } : n));
    await supabase.from("notes").update(update).eq("id", editNote.id);
    setEditSaving(false);
    setEditNote(null);
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

  /* Move card to adjacent lane */
  const moveCard = async (note: Note, dir: "prev" | "next") => {
    const idx = DEFAULT_LANES.findIndex(l => l.id === note.lane_id);
    const targetIdx = dir === "next" ? idx + 1 : idx - 1;
    if (targetIdx < 0 || targetIdx >= DEFAULT_LANES.length) return;
    const targetLane = DEFAULT_LANES[targetIdx].id;
    const targetNotes = notes.filter(n => n.lane_id === targetLane);
    setNotes(ns => ns.map(n => n.id === note.id ? { ...n, lane_id: targetLane, lane_order: targetNotes.length } : n));
    await supabase.from("notes").update({ lane_id: targetLane, lane_order: targetNotes.length }).eq("id", note.id);
  };

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

      {/* ── Lane board — fills full width ── */}
      <div style={{ flex: 1, overflow: "hidden", background: "var(--paper)", position: "relative" }}>
        <div className="bg-dot-grid" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }} />
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${lanes.length}, 1fr)`,
          gap: 12,
          padding: "16px 16px 16px",
          height: "100%",
          position: "relative",
          zIndex: 1,
          boxSizing: "border-box",
        }}>
          {lanes.map((lane, laneIdx) => {
            const laneNotes = notes
              .filter(n => n.lane_id === lane.id)
              .sort((a, b) => a.lane_order - b.lane_order);
            const isOver = dragOverLane === lane.id;

            return (
              <div key={lane.id}
                onDragOver={e => onDragOver(e, lane.id)}
                onDragLeave={() => setDragOverLane(null)}
                onDrop={e => onDrop(e, lane.id)}
                style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}
              >
                {/* Lane header */}
                <div style={{ background: lane.color, border: "1.5px solid var(--ink)", borderBottom: "none", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", flexShrink: 0 }}>
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
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink2)", display: "flex", alignItems: "center", padding: 2 }}
                      onMouseEnter={e => (e.currentTarget.style.color = "var(--ink)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "var(--ink2)")}>
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {/* Lane body */}
                <div style={{ flex: 1, overflowY: "auto", border: "1.5px solid var(--ink)", background: isOver ? `${lane.color}90` : "rgba(255,255,255,0.6)", padding: "10px 10px 24px", display: "flex", flexDirection: "column", gap: 8, transition: "background 0.15s", backdropFilter: "blur(2px)" }}>
                  {laneNotes.length === 0 && !isOver && (
                    <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink3)", textAlign: "center", padding: "24px 0", pointerEvents: "none" }}>
                      Drop cards here
                    </p>
                  )}

                  {laneNotes.map(note => {
                    const pri = note.priority ? PRIORITY_CONFIG[note.priority] : null;
                    const overdue = isOverdue(note.due_date);

                    return (
                      <div key={note.id}
                        draggable
                        onDragStart={e => onDragStart(e, note)}
                        style={{ background: colorBg(note.color), border: "1.5px solid var(--ink)", boxShadow: "2px 3px 0 rgba(28,28,28,0.1)", padding: "10px 10px 8px", position: "relative", cursor: "grab", transition: "box-shadow 0.15s, transform 0.15s", userSelect: "none" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "3px 5px 0 rgba(28,28,28,0.14)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "2px 3px 0 rgba(28,28,28,0.1)"; }}
                      >
                        {/* Priority + actions row */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          {pri ? (
                            <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.68rem", fontWeight: 700, padding: "1px 7px", background: pri.bg, color: pri.color, border: `1px solid ${pri.color}40` }}>
                              {pri.label}
                            </span>
                          ) : <span />}
                          <div style={{ display: "flex", gap: 2 }}>
                            {(isOwner || currentUser?.id === note.user_id) && (
                              <button onClick={() => openEdit(note)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink3)", padding: 2, opacity: 0.5 }}
                                onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                                onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}>
                                <Pencil size={10} />
                              </button>
                            )}
                            {(isOwner || currentUser?.id === note.user_id) && (
                              <button onClick={() => deleteNote(note.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink3)", padding: 2, opacity: 0.5 }}
                                onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                                onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}>
                                <Trash2 size={10} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Content */}
                        <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.92rem", color: "var(--ink)", lineHeight: 1.55, margin: "0 0 8px 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {note.content}
                        </p>

                        {/* Due date */}
                        {note.due_date && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--font-kalam), serif", fontSize: "0.7rem", color: overdue ? "#ef4444" : "var(--ink3)", background: overdue ? "#fee2e2" : "rgba(28,28,28,0.06)", padding: "1px 7px", marginBottom: 8, border: overdue ? "1px solid #fca5a5" : "none" }}>
                            📅 {formatDate(note.due_date)}{overdue ? " · Overdue" : ""}
                          </div>
                        )}

                        {/* Footer — author + upvotes + move arrows */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6, borderTop: "1px dashed rgba(28,28,28,0.15)" }}>
                          <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.7rem", fontWeight: 700, color: "var(--ink2)" }}>— {note.author_name}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            {/* Quick move left */}
                            {laneIdx > 0 && (
                              <button onClick={() => moveCard(note, "prev")}
                                title={`Move to ${DEFAULT_LANES[laneIdx - 1].label}`}
                                style={{ background: "none", border: "1px solid rgba(28,28,28,0.15)", borderRadius: 3, cursor: "pointer", color: "var(--ink3)", padding: "1px 3px", display: "flex", alignItems: "center" }}
                                onMouseEnter={e => (e.currentTarget.style.color = "var(--ink)")}
                                onMouseLeave={e => (e.currentTarget.style.color = "var(--ink3)")}>
                                <ChevLeft size={11} />
                              </button>
                            )}
                            {/* Upvote */}
                            <button onClick={() => upvote(note)}
                              style={{ display: "flex", alignItems: "center", gap: 3, background: voted.has(note.id) ? "rgba(28,28,28,0.1)" : "none", border: "1px solid rgba(28,28,28,0.15)", borderRadius: 20, padding: "1px 6px", cursor: voted.has(note.id) ? "default" : "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.7rem", color: "var(--ink2)" }}>
                              <ThumbsUp size={9} style={{ color: voted.has(note.id) ? "var(--ink)" : "var(--ink3)" }} />
                              {note.upvotes}
                            </button>
                            {/* Quick move right */}
                            {laneIdx < DEFAULT_LANES.length - 1 && (
                              <button onClick={() => moveCard(note, "next")}
                                title={`Move to ${DEFAULT_LANES[laneIdx + 1].label}`}
                                style={{ background: "none", border: "1px solid rgba(28,28,28,0.15)", borderRadius: 3, cursor: "pointer", color: "var(--ink3)", padding: "1px 3px", display: "flex", alignItems: "center" }}
                                onMouseEnter={e => (e.currentTarget.style.color = "var(--ink)")}
                                onMouseLeave={e => (e.currentTarget.style.color = "var(--ink3)")}>
                                <ChevronRight size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
          <div style={{ position: "relative", maxWidth: 400, width: "100%", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
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
                  <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink3)", marginBottom: 6 }}>Column</p>
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

                {/* Priority */}
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink3)", marginBottom: 6 }}>Priority (optional)</p>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["high", "medium", "low"] as const).map(p => (
                      <button key={p} onClick={() => setNewPriority(newPriority === p ? "" : p)}
                        style={{ flex: 1, padding: "5px", background: newPriority === p ? PRIORITY_CONFIG[p].bg : "white", border: newPriority === p ? `2px solid ${PRIORITY_CONFIG[p].color}` : "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: newPriority === p ? PRIORITY_CONFIG[p].color : "var(--ink2)", fontWeight: newPriority === p ? 700 : 400, transition: "all 0.15s" }}>
                        {PRIORITY_CONFIG[p].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Due date */}
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink3)", marginBottom: 6 }}>Due date (optional)</p>
                  <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", border: "1.5px solid rgba(28,28,28,0.2)", background: "rgba(255,255,255,0.6)", fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink)", outline: "none" }} />
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

      {/* ── Edit card modal ── */}
      {editNote && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,28,28,0.35)", backdropFilter: "blur(3px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setEditNote(null)}>
          <div style={{ position: "relative", maxWidth: 400, width: "100%", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <span className="tape tape-b" style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 56, height: 17, borderRadius: 2, zIndex: 10 }} />
            <div className="sk" style={{ background: colorBg(editColor), padding: "28px 22px 22px" }}>
              <div className="sk-b" />
              <div className="sk-i">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.1rem", color: "var(--ink)" }}>Edit card</h3>
                  <button onClick={() => setEditNote(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink2)" }}><X size={18} /></button>
                </div>

                {/* Content */}
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <textarea autoFocus value={editText}
                    onChange={e => setEditText(e.target.value.slice(0, LIMITS.noteContent.max))}
                    onKeyDown={e => { if (e.key === "Enter" && e.metaKey) saveEdit(); }}
                    placeholder="Card content" rows={3}
                    style={{ width: "100%", padding: "10px", border: "1.5px solid rgba(28,28,28,0.2)", background: "rgba(255,255,255,0.6)", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink)", outline: "none", resize: "vertical" }}
                  />
                  <span style={{ position: "absolute", bottom: 6, right: 8, fontFamily: "var(--font-kalam), serif", fontSize: "0.7rem", color: "var(--ink3)" }}>{editText.length}/{LIMITS.noteContent.max}</span>
                </div>

                {/* Priority */}
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink3)", marginBottom: 6 }}>Priority</p>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["high", "medium", "low"] as const).map(p => (
                      <button key={p} onClick={() => setEditPriority(editPriority === p ? "" : p)}
                        style={{ flex: 1, padding: "5px", background: editPriority === p ? PRIORITY_CONFIG[p].bg : "white", border: editPriority === p ? `2px solid ${PRIORITY_CONFIG[p].color}` : "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: editPriority === p ? PRIORITY_CONFIG[p].color : "var(--ink2)", fontWeight: editPriority === p ? 700 : 400, transition: "all 0.15s" }}>
                        {PRIORITY_CONFIG[p].label}
                      </button>
                    ))}
                    {editPriority && (
                      <button onClick={() => setEditPriority("")}
                        style={{ padding: "5px 8px", background: "white", border: "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.75rem", color: "var(--ink3)" }}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Due date */}
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink3)", marginBottom: 6 }}>Due date</p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
                      style={{ flex: 1, padding: "7px 10px", border: "1.5px solid rgba(28,28,28,0.2)", background: "rgba(255,255,255,0.6)", fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink)", outline: "none" }} />
                    {editDueDate && (
                      <button onClick={() => setEditDueDate("")}
                        style={{ padding: "7px 10px", background: "white", border: "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.8rem", color: "var(--ink3)" }}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Color */}
                <div style={{ marginBottom: 18 }}>
                  <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink3)", marginBottom: 6 }}>Card color</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    {PRESETS.map(hex => (
                      <button key={hex} onClick={() => setEditColor(hex)}
                        style={{ width: 22, height: 22, background: hex, border: editColor === hex ? "2.5px solid var(--ink)" : "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", borderRadius: 2, transform: editColor === hex ? "scale(1.2)" : "scale(1)", transition: "transform 0.15s" }} />
                    ))}
                    <label style={{ position: "relative", width: 22, height: 22, cursor: "pointer" }}>
                      <div style={{ width: 22, height: 22, background: !PRESETS.includes(editColor) ? editColor : "transparent", border: "1.5px dashed rgba(28,28,28,0.35)", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", color: "var(--ink3)" }}>
                        {PRESETS.includes(editColor) ? "＋" : null}
                      </div>
                      <input type="color" value={PRESETS.includes(editColor) ? "#ffffff" : editColor}
                        onChange={e => setEditColor(e.target.value)}
                        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
                    </label>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={saveEdit} disabled={!editText.trim() || editSaving}
                    style={{ flex: 1, padding: "10px", background: editText.trim() && !editSaving ? "var(--ink)" : "var(--ink3)", color: "white", border: "none", cursor: editText.trim() && !editSaving ? "pointer" : "default", fontFamily: "var(--font-kalam), serif", fontSize: "1rem" }}>
                    {editSaving ? "Saving…" : "Save changes"}
                  </button>
                  <button onClick={() => setEditNote(null)}
                    style={{ padding: "10px 14px", background: "none", border: "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink2)" }}>
                    Cancel
                  </button>
                </div>
                <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.72rem", color: "var(--ink3)", marginTop: 8, textAlign: "center" }}>⌘+Enter to save</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
