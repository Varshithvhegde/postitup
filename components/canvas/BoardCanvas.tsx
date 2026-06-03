"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Board, Note, NoteColor, Rating } from "@/types";
import { sanitizeText, validateNoteContent, validateAuthorName, LIMITS } from "@/lib/sanitize";
import {
  Plus, X, ThumbsUp, Trash2, Link as LinkIcon,
  Settings, ChevronLeft, Copy, Check, Star,
} from "lucide-react";
import RatingsPanel from "@/components/canvas/RatingsPanel";

/* ── Color palette ── */
const COLORS: { value: NoteColor; label: string; bg: string; tape: string }[] = [
  { value: "yellow", label: "Yellow", bg: "var(--sticky-y)", tape: "tape-y" },
  { value: "blue",   label: "Blue",   bg: "var(--sticky-b)", tape: "tape-b" },
  { value: "pink",   label: "Pink",   bg: "var(--sticky-p)", tape: "tape-p" },
  { value: "green",  label: "Green",  bg: "var(--sticky-g)", tape: "tape-g" },
  { value: "orange", label: "Orange", bg: "var(--sticky-o)", tape: "tape-o" },
];
const colorBg = (c: NoteColor) => COLORS.find(x => x.value === c)?.bg ?? "var(--sticky-y)";
const colorTape = (c: NoteColor) => COLORS.find(x => x.value === c)?.tape ?? "tape-y";

/* ── Grid snap helper ── */
const GRID = 32;
function snap(v: number, mode: Board["mode"]) {
  if (mode === "grid") return Math.round(v / GRID) * GRID;
  return v;
}

/* ── Random slight rotation ── */
function randRot() { return (Math.random() - 0.5) * 6; }

/* ── Fingerprint for anonymous votes ── */
function getFingerprint() {
  let fp = localStorage.getItem("piu_fp");
  if (!fp) { fp = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("piu_fp", fp); }
  return fp;
}

interface Props {
  board: Board;
  initialNotes: Note[];
  initialRatings: Rating[];
  currentUser: { id: string; email: string } | null;
  isOwner: boolean;
}

export default function BoardCanvas({ board, initialNotes, initialRatings, currentUser, isOwner }: Props) {
  const supabase = createClient();
  const canvasRef = useRef<HTMLDivElement>(null);

  /* ── State ── */
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [ratings, setRatings] = useState<Rating[]>(initialRatings);
  const [showRatings, setShowRatings] = useState(false);
  // modal tab: "note" | "review"
  const [modalTab, setModalTab] = useState<"note" | "review">("note");
  // review form state
  const [reviewStars, setReviewStars] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewError, setReviewError] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [hasRated, setHasRated] = useState(() => {
    if (typeof window === "undefined") return false;
    const fp = localStorage.getItem("piu_fp");
    return fp ? initialRatings.some(r => r.voter_fingerprint === fp) : false;
  });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  /* ── Adding note ── */
  const [showAddForm, setShowAddForm] = useState(false);
  const [addPos, setAddPos] = useState({ x: 100, y: 100 });
  const [newText, setNewText] = useState("");
  const [newColor, setNewColor] = useState<NoteColor>("yellow");
  const [authorName, setAuthorName] = useState(() => typeof window !== "undefined" ? localStorage.getItem("piu_name") ?? "" : "");

  /* ── Dragging a note ── */
  // finalPos always reflects the latest dragged position so mouseUp never reads stale state
  const dragging = useRef<{ id: string; ox: number; oy: number; startX: number; startY: number; finalX: number; finalY: number } | null>(null);

  /* ── Voted set ── */
  const [voted, setVoted] = useState<Set<string>>(new Set());

  /* ── Copied link ── */
  const [copied, setCopied] = useState(false);

  /* ── Settings panel ── */
  const [showSettings, setShowSettings] = useState(false);

  /* ── Realtime subscription ── */
  useEffect(() => {
    const channel = supabase
      .channel(`board:${board.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notes", filter: `board_id=eq.${board.id}` },
        (payload) => {
          setNotes(n => n.find(x => x.id === payload.new.id) ? n : [...n, payload.new as Note]);
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notes", filter: `board_id=eq.${board.id}` },
        (payload) => {
          setNotes(n => n.map(x => x.id === payload.new.id ? { ...x, ...payload.new } : x));
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notes", filter: `board_id=eq.${board.id}` },
        (payload) => {
          setNotes(n => n.filter(x => x.id !== payload.old.id));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [board.id, supabase]);

  /* ── Realtime: ratings ── */
  useEffect(() => {
    if (!board.enable_ratings) return;
    const ch = supabase.channel(`ratings:${board.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ratings", filter: `board_id=eq.${board.id}` },
        p => setRatings(r => r.find(x => x.id === p.new.id) ? r : [...r, p.new as Rating]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ratings", filter: `board_id=eq.${board.id}` },
        p => setRatings(r => r.map(x => x.id === p.new.id ? { ...x, ...p.new } : x)))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "ratings", filter: `board_id=eq.${board.id}` },
        p => setRatings(r => r.filter(x => x.id !== p.old.id)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [board.id, board.enable_ratings, supabase]);

  /* ── Submit review ── */
  const submitReview = async () => {
    if (reviewStars === 0) { setReviewError("Pick a star rating first"); return; }
    setReviewSubmitting(true);
    setReviewError("");
    const fp = getFingerprint();
    const name = sanitizeText(authorName) || "Anonymous";
    localStorage.setItem("piu_name", name);
    const { error } = await supabase.from("ratings").insert({
      board_id: board.id,
      stars: reviewStars,
      review: reviewText.trim() ? sanitizeText(reviewText).slice(0, 300) : null,
      author_name: name,
      user_id: currentUser?.id ?? null,
      voter_fingerprint: fp,
      x: addPos.x,
      y: addPos.y,
      width: 220,
      rotation: randRot(),
    });
    setReviewSubmitting(false);
    if (error) {
      if (error.code === "23505") { setReviewError("You've already reviewed this board"); setHasRated(true); }
      else setReviewError("Failed to submit. Try again.");
      return;
    }
    setHasRated(true);
    setReviewStars(0);
    setReviewText("");
    setShowAddForm(false);
  };

  /* ── Delete rating ── */
  const deleteRating = async (id: string) => {
    setRatings(r => r.filter(x => x.id !== id));
    await supabase.from("ratings").delete().eq("id", id);
  };

  /* ── Canvas background class ── */
  const bgClass = board.mode === "grid" ? "bg-grid" : board.mode === "ruled" ? "bg-ruled" : "bg-dot-grid";

  /* ── Pan via middle-mouse or space+drag ── */
  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
    }
  }, [pan]);

  const onCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: panStart.current.px + (e.clientX - panStart.current.mx), y: panStart.current.py + (e.clientY - panStart.current.my) });
      return;
    }
    if (dragging.current) {
      const dx = (e.clientX - dragging.current.startX) / scale;
      const dy = (e.clientY - dragging.current.startY) / scale;
      const nx = snap(dragging.current.ox + dx, board.mode);
      const ny = snap(dragging.current.oy + dy, board.mode);
      // Keep ref in sync so mouseUp always has the final position
      dragging.current.finalX = nx;
      dragging.current.finalY = ny;
      setNotes(ns => ns.map(n => n.id === dragging.current?.id ? { ...n, x: nx, y: ny } : n));
    }
  }, [isPanning, scale, board.mode]);

  const onCanvasMouseUp = useCallback(async () => {
    setIsPanning(false);
    if (dragging.current) {
      const { id, finalX, finalY } = dragging.current;
      dragging.current = null;
      const { error } = await supabase.from("notes").update({ x: finalX, y: finalY }).eq("id", id);
      if (error) console.error("Position save failed:", error.message, error.code);
    }
  }, [supabase]);

  /* ── Zoom ── */
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setScale(s => Math.min(2, Math.max(0.4, s - e.deltaY * 0.001)));
    }
  }, []);

  /* ── Double-click to add note ── */
  const onCanvasDblClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".note-card")) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = snap((e.clientX - rect.left - pan.x) / scale, board.mode);
    const y = snap((e.clientY - rect.top - pan.y) / scale, board.mode);
    setAddPos({ x, y });
    setModalTab("note");
    setShowAddForm(true);
  }, [pan, scale, board.mode]);

  /* ── Add note ── */
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

    const { error } = await supabase.from("notes").insert({
      board_id:    board.id,
      content:     cleanContent,
      color:       newColor,
      x:           addPos.x,
      y:           addPos.y,
      width:       200,
      rotation:    randRot(),
      author_name: cleanName,
      user_id:     currentUser?.id ?? null,
    });
    if (error) { setAddError("Failed to save note. Try again."); return; }
    setNewText("");
    setShowAddForm(false);
  };

  /* ── Delete note ── */
  const deleteNote = async (id: string) => {
    // Optimistic: remove from local state immediately so UI updates without waiting
    setNotes(n => n.filter(x => x.id !== id));
    await supabase.from("notes").delete().eq("id", id);
  };

  /* ── Upvote — calls secure DB function, never touches upvotes column directly ── */
  const upvote = async (note: Note) => {
    const fp = getFingerprint();
    if (voted.has(note.id)) return;
    const { data } = await supabase.rpc("increment_upvote", { note_id: note.id, voter_fp: fp });
    if (data?.success) {
      setVoted(v => new Set([...v, note.id]));
      setNotes(ns => ns.map(n => n.id === note.id ? { ...n, upvotes: data.upvotes } : n));
    }
  };

  /* ── Note drag start ── */
  const onNoteMouseDown = (e: React.MouseEvent, note: Note) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.stopPropagation();
    dragging.current = { id: note.id, ox: note.x, oy: note.y, startX: e.clientX, startY: e.clientY, finalX: note.x, finalY: note.y };
  };

  /* ── Copy board link ── */
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--paper)" }}>
      {/* SVG filter */}
      <svg style={{ display: "none", position: "absolute" }} aria-hidden>
        <defs>
          <filter id="roughen" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* ── Toolbar ── */}
      <div style={{ height: 52, flexShrink: 0, borderBottom: "1.5px solid rgba(28,28,28,0.12)", background: "rgba(250,249,246,0.95)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink2)", textDecoration: "none", fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem" }}>
            <ChevronLeft size={16} /> Back
          </a>
          <div style={{ width: 1, height: 20, background: "rgba(28,28,28,0.15)" }} />
          <span style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.1rem", color: "var(--ink)", fontWeight: 700 }}>{board.title}</span>
          {board.prompt && (
            <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.82rem", color: "var(--ink3)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              — {board.prompt}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Copy link */}
          <button onClick={copyLink}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: copied ? "var(--sticky-g)" : "var(--paper2)", border: "1.5px solid rgba(28,28,28,0.18)", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem", color: "var(--ink)", transition: "background 0.2s" }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Share"}
          </button>

          {/* Unified add button — opens modal with Note/Review tabs */}
          <button onClick={() => {
            setAddPos({ x: Math.max(60, 120 - pan.x / scale), y: Math.max(60, 80 - pan.y / scale) });
            setModalTab("note");
            setShowAddForm(true);
          }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "var(--ink)", border: "none", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", color: "white" }}>
            <Plus size={15} /> {board.enable_ratings ? "Add" : "Add note"}
          </button>

          {isOwner && (
            <>
              <a href={`/board/${board.slug}/settings`}
                style={{ padding: "6px 12px", background: "var(--paper2)", border: "1.5px solid rgba(28,28,28,0.18)", cursor: "pointer", color: "var(--ink2)", display: "flex", alignItems: "center", gap: 5, textDecoration: "none", fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem" }}>
                <Settings size={14} /> Settings
              </a>
              <button onClick={() => setShowSettings(s => !s)}
                style={{ padding: "6px 10px", background: showSettings ? "var(--sticky-b)" : "var(--paper2)", border: "1.5px solid rgba(28,28,28,0.18)", cursor: "pointer", color: "var(--ink)", display: "flex", alignItems: "center" }}
                title="Embed code">
                <LinkIcon size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Canvas area ── */}
      <div
        ref={canvasRef}
        className={bgClass}
        style={{ flex: 1, position: "relative", overflow: "hidden", cursor: isPanning ? "grabbing" : "default" }}
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onCanvasMouseUp}
        onMouseLeave={onCanvasMouseUp}
        onDoubleClick={onCanvasDblClick}
        onWheel={onWheel}
      >
        {/* Hint text */}
        {notes.length === 0 && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none", zIndex: 1 }}>
            <p style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.4rem", color: "var(--ink3)" }}>Double-click anywhere to add a note</p>
            <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", color: "var(--ink3)", marginTop: 6 }}>Or click "Add note" in the toolbar</p>
          </div>
        )}

        {/* Pan + zoom transform layer */}
        <div style={{ position: "absolute", top: 0, left: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: "0 0", width: "100%", height: "100%" }}>

          {/* ── Rating cards on canvas ── */}
          {board.enable_ratings && ratings.map(r => (
            <div
              key={r.id}
              className="note-card note-enter"
              style={{
                position: "absolute",
                left: r.x, top: r.y,
                width: r.width,
                transform: `rotate(${r.rotation}deg)`,
                userSelect: "none",
                zIndex: 2,
              }}
            >
              <span className="tape tape-y" style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 48, height: 15, borderRadius: 2 }} />
              <div style={{ background: "var(--sticky-y)", border: "1.5px solid var(--ink)", boxShadow: "3px 4px 0 rgba(28,28,28,0.12)", padding: "22px 14px 12px", position: "relative" }}>
                {(isOwner || currentUser?.id === r.user_id) && (
                  <button onClick={() => deleteRating(r.id)}
                    style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", cursor: "pointer", color: "var(--ink3)", padding: 2, opacity: 0.6 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "0.6")}>
                    <Trash2 size={12} />
                  </button>
                )}
                {/* Stars */}
                <div style={{ display: "flex", gap: 2, marginBottom: 6 }}>
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={14}
                      fill={s <= r.stars ? "#f59e0b" : "none"}
                      stroke={s <= r.stars ? "#f59e0b" : "rgba(28,28,28,0.25)"}
                      strokeWidth={1.8}
                    />
                  ))}
                </div>
                {r.review && (
                  <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
                    {r.review}
                  </p>
                )}
                <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px dashed rgba(28,28,28,0.18)" }}>
                  <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.72rem", color: "var(--ink3)" }}>— {r.author_name}</span>
                </div>
              </div>
            </div>
          ))}

          {notes.map(note => (
            <div
              key={note.id}
              className="note-card note-enter"
              onMouseDown={e => onNoteMouseDown(e, note)}
              style={{
                position: "absolute",
                left: note.x,
                top: note.y,
                width: note.width,
                transform: `rotate(${note.rotation}deg)`,
                cursor: "grab",
                userSelect: "none",
                "--rot": `${note.rotation}deg`,
                zIndex: 2,
              } as React.CSSProperties}
            >
              {/* Tape on note */}
              <span
                className={`tape ${colorTape(note.color)}`}
                style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 48, height: 15, borderRadius: 2 }}
              />

              <div style={{
                background: colorBg(note.color),
                border: "1.5px solid var(--ink)",
                boxShadow: "3px 4px 0 rgba(28,28,28,0.12)",
                padding: "22px 14px 12px",
                position: "relative",
              }}>
                {/* Delete button */}
                {(isOwner || currentUser?.id === note.user_id) && (
                  <button onClick={() => deleteNote(note.id)}
                    style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", cursor: "pointer", color: "var(--ink3)", padding: 2, display: "flex", alignItems: "center", opacity: 0.6 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "0.6")}>
                    <Trash2 size={12} />
                  </button>
                )}

                <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", color: "var(--ink)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
                  {note.content}
                </p>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: "1px dashed rgba(28,28,28,0.18)" }}>
                  <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.72rem", color: "var(--ink3)" }}>— {note.author_name}</span>
                  <button onClick={() => upvote(note)}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      background: voted.has(note.id) ? "rgba(28,28,28,0.1)" : "none",
                      border: "1px solid rgba(28,28,28,0.15)",
                      borderRadius: 20, padding: "2px 8px", cursor: voted.has(note.id) ? "default" : "pointer",
                      fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink2)",
                      transition: "background 0.15s",
                    }}>
                    <ThumbsUp size={11} style={{ color: voted.has(note.id) ? "var(--ink)" : "var(--ink3)" }} />
                    {note.upvotes}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Zoom indicator */}
        <div style={{ position: "absolute", bottom: 16, right: 16, fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink3)", background: "rgba(250,249,246,0.85)", padding: "4px 10px", border: "1px solid rgba(28,28,28,0.1)" }}>
          {Math.round(scale * 100)}% · Ctrl+scroll to zoom · Alt+drag or middle-click to pan
        </div>
      </div>

      {/* ── Add modal (tabbed: Note | Review) ── */}
      {showAddForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,28,28,0.35)", backdropFilter: "blur(3px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setShowAddForm(false)}>
          <div style={{ position: "relative", maxWidth: 400, width: "100%" }} onClick={e => e.stopPropagation()}>
            <span
              className={`tape ${modalTab === "note" ? colorTape(newColor) : "tape-y"}`}
              style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 56, height: 17, borderRadius: 2, zIndex: 10 }}
            />
            <div className="sk" style={{ background: modalTab === "note" ? colorBg(newColor) : "var(--sticky-y)", padding: "0 0 22px" }}>
              <div className="sk-b" />
              <div className="sk-i">

                {/* Tabs — only show when ratings enabled */}
                {board.enable_ratings && (
                  <div style={{ display: "flex", borderBottom: "1.5px solid rgba(28,28,28,0.12)" }}>
                    {[
                      { key: "note",   label: "📌 Note" },
                      { key: "review", label: "⭐ Review" },
                    ].map(({ key, label }) => (
                      <button key={key}
                        onClick={() => setModalTab(key as "note" | "review")}
                        style={{
                          flex: 1, padding: "12px 0",
                          fontFamily: "var(--font-sketch), var(--font-kalam), serif",
                          fontSize: "1rem",
                          fontWeight: modalTab === key ? 700 : 400,
                          color: "var(--ink)",
                          background: "none", border: "none",
                          borderBottom: modalTab === key ? "2.5px solid var(--ink)" : "2.5px solid transparent",
                          cursor: "pointer",
                          marginBottom: -1.5,
                          transition: "border-color 0.15s",
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ padding: board.enable_ratings ? "20px 24px 0" : "28px 24px 0" }}>
                  {/* Close button */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <h3 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.1rem", color: "var(--ink)" }}>
                      {modalTab === "note" ? "New sticky note" : "Leave a review"}
                    </h3>
                    <button onClick={() => setShowAddForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink2)" }}><X size={18} /></button>
                  </div>

                  {/* Author name — shared */}
                  <input value={authorName} onChange={e => setAuthorName(e.target.value.slice(0, LIMITS.authorName.max))}
                    placeholder="Your name (optional)"
                    style={{ width: "100%", padding: "7px 10px", border: "1.5px solid rgba(28,28,28,0.2)", background: "rgba(255,255,255,0.6)", fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink)", outline: "none", marginBottom: 12 }} />

                  {modalTab === "note" ? (
                    <>
                      {/* Note text */}
                      <div style={{ position: "relative", marginBottom: 14 }}>
                        <textarea autoFocus value={newText}
                          onChange={e => { setAddError(""); setNewText(e.target.value.slice(0, LIMITS.noteContent.max)); }}
                          onKeyDown={e => { if (e.key === "Enter" && e.metaKey) addNote(); }}
                          placeholder="Write your note…" rows={4}
                          style={{ width: "100%", padding: "10px", border: `1.5px solid ${newText.length >= LIMITS.noteContent.max ? "#ef4444" : "rgba(28,28,28,0.2)"}`, background: "rgba(255,255,255,0.6)", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink)", outline: "none", resize: "vertical" }}
                        />
                        <span style={{ position: "absolute", bottom: 6, right: 8, fontFamily: "var(--font-kalam), serif", fontSize: "0.7rem", color: newText.length >= LIMITS.noteContent.max ? "#ef4444" : "var(--ink3)" }}>
                          {newText.length}/{LIMITS.noteContent.max}
                        </span>
                      </div>
                      {addError && <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "#ef4444", marginBottom: 10 }}>{addError}</p>}
                      {/* Color picker */}
                      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                        {COLORS.map(c => (
                          <button key={c.value} onClick={() => setNewColor(c.value)}
                            style={{ width: 28, height: 28, background: c.bg, border: newColor === c.value ? "2.5px solid var(--ink)" : "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", transform: newColor === c.value ? "scale(1.15)" : "scale(1)", transition: "transform 0.15s", borderRadius: 2 }} />
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={addNote} disabled={!newText.trim()}
                          style={{ flex: 1, padding: "10px", background: newText.trim() ? "var(--ink)" : "var(--ink3)", color: "white", border: "none", cursor: newText.trim() ? "pointer" : "default", fontFamily: "var(--font-kalam), serif", fontSize: "1rem" }}>
                          Pin it! 📌
                        </button>
                        <button onClick={() => setShowAddForm(false)}
                          style={{ padding: "10px 14px", background: "none", border: "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink2)" }}>
                          Cancel
                        </button>
                      </div>
                      <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.72rem", color: "var(--ink3)", marginTop: 8, textAlign: "center" }}>⌘+Enter to submit</p>
                    </>
                  ) : (
                    <>
                      {hasRated ? (
                        <div style={{ padding: "14px", background: "var(--sticky-g)", border: "1.5px solid rgba(28,28,28,0.12)", display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                          <Star size={16} fill="#16a34a" stroke="#16a34a" />
                          <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink)" }}>Thanks for your review!</p>
                        </div>
                      ) : (
                        <>
                          {/* Star picker */}
                          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                            {[1,2,3,4,5].map(s => (
                              <button key={s} type="button"
                                onClick={() => setReviewStars(s)}
                                onMouseEnter={() => setReviewHover(s)}
                                onMouseLeave={() => setReviewHover(0)}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, transform: reviewHover === s ? "scale(1.25)" : "scale(1)", transition: "transform 0.1s" }}>
                                <Star size={30}
                                  fill={s <= (reviewHover || reviewStars) ? "#f59e0b" : "none"}
                                  stroke={s <= (reviewHover || reviewStars) ? "#f59e0b" : "rgba(28,28,28,0.3)"}
                                  strokeWidth={1.8}
                                />
                              </button>
                            ))}
                          </div>
                          {/* Review text */}
                          <div style={{ position: "relative", marginBottom: 14 }}>
                            <textarea value={reviewText}
                              onChange={e => { setReviewError(""); setReviewText(e.target.value.slice(0, 300)); }}
                              placeholder="Share your thoughts… (optional)" rows={3}
                              style={{ width: "100%", padding: "10px", border: "1.5px solid rgba(28,28,28,0.2)", background: "rgba(255,255,255,0.6)", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink)", outline: "none", resize: "none" }}
                            />
                            <span style={{ position: "absolute", bottom: 6, right: 8, fontFamily: "var(--font-kalam), serif", fontSize: "0.7rem", color: "var(--ink3)" }}>
                              {reviewText.length}/300
                            </span>
                          </div>
                          {reviewError && <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "#ef4444", marginBottom: 10 }}>{reviewError}</p>}
                          <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={submitReview} disabled={reviewSubmitting || reviewStars === 0}
                              style={{ flex: 1, padding: "10px", background: reviewStars > 0 && !reviewSubmitting ? "var(--ink)" : "var(--ink3)", color: "white", border: "none", cursor: reviewStars > 0 && !reviewSubmitting ? "pointer" : "default", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                              <Star size={14} fill="white" stroke="white" />
                              {reviewSubmitting ? "Submitting…" : "Post review"}
                            </button>
                            <button onClick={() => setShowAddForm(false)}
                              style={{ padding: "10px 14px", background: "none", border: "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink2)" }}>
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings / Embed panel (owner only) ── */}
      {showSettings && isOwner && (
        <div style={{ position: "fixed", top: 60, right: 16, width: 340, zIndex: 60, maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
          <span className="tape tape-y" style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 52, height: 16, borderRadius: 2, zIndex: 10 }} />
          <div className="sk" style={{ background: "white", padding: "20px 18px" }}>
            <div className="sk-b" />
            <div className="sk-i" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)" }}>Embed this board</p>

              {/* Method 1 — iFrame */}
              <div>
                <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem", fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>📦 iFrame (recommended)</p>
                <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink3)", marginBottom: 6 }}>Drop this anywhere in your HTML</p>
                <div style={{ background: "var(--paper2)", padding: "8px 10px", border: "1px solid rgba(28,28,28,0.15)", fontFamily: "monospace", fontSize: "0.68rem", color: "var(--ink)", wordBreak: "break-all", lineHeight: 1.7 }}>
                  {`<iframe\n  src="${typeof window !== "undefined" ? window.location.origin : ""}/embed/${board.slug}"\n  width="100%" height="600"\n  frameborder="0"\n></iframe>`}
                </div>
                <button onClick={() => navigator.clipboard.writeText(`<iframe\n  src="${window.location.origin}/embed/${board.slug}"\n  width="100%" height="600"\n  frameborder="0"\n></iframe>`)}
                  style={{ marginTop: 6, width: "100%", padding: "7px", background: "var(--sticky-y)", border: "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink)" }}>
                  Copy iFrame code
                </button>
              </div>

              {/* Method 2 — Script tag */}
              <div>
                <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem", fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>🪄 Script tag (floating button)</p>
                <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink3)", marginBottom: 6 }}>Adds a sticky 📌 button — opens board in a slide-out drawer</p>
                <div style={{ background: "var(--paper2)", padding: "8px 10px", border: "1px solid rgba(28,28,28,0.15)", fontFamily: "monospace", fontSize: "0.68rem", color: "var(--ink)", wordBreak: "break-all", lineHeight: 1.7 }}>
                  {`<script\n  src="${typeof window !== "undefined" ? window.location.origin : ""}/embed.js"\n  data-board="${board.slug}"\n  data-url="${typeof window !== "undefined" ? window.location.origin : ""}"\n></script>`}
                </div>
                <button onClick={() => navigator.clipboard.writeText(`<script\n  src="${window.location.origin}/embed.js"\n  data-board="${board.slug}"\n  data-url="${window.location.origin}"\n></script>`)}
                  style={{ marginTop: 6, width: "100%", padding: "7px", background: "var(--sticky-b)", border: "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink)" }}>
                  Copy script tag
                </button>
              </div>

              {/* Method 3 — React component */}
              <div>
                <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem", fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>⚛️ React / Next.js component</p>
                <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink3)", marginBottom: 6 }}>Use in any React app (npm package coming soon)</p>
                <div style={{ background: "var(--paper2)", padding: "8px 10px", border: "1px solid rgba(28,28,28,0.15)", fontFamily: "monospace", fontSize: "0.68rem", color: "var(--ink)", wordBreak: "break-all", lineHeight: 1.7 }}>
                  {`// PostItBoard is just an iframe wrapper\nimport PostItBoard from "postitup";\n\n<PostItBoard\n  board="${board.slug}"\n  baseUrl="${typeof window !== "undefined" ? window.location.origin : ""}"\n  height={600}\n/>`}
                </div>
                <button onClick={() => navigator.clipboard.writeText(`import PostItBoard from "postitup";\n\n<PostItBoard\n  board="${board.slug}"\n  baseUrl="${window.location.origin}"\n  height={600}\n/>`)}
                  style={{ marginTop: 6, width: "100%", padding: "7px", background: "var(--sticky-p)", border: "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink)" }}>
                  Copy component snippet
                </button>
              </div>

              {/* Direct link */}
              <div>
                <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem", fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>🔗 Direct embed URL</p>
                <div style={{ background: "var(--paper2)", padding: "8px 10px", border: "1px solid rgba(28,28,28,0.15)", fontFamily: "monospace", fontSize: "0.68rem", color: "var(--ink)", wordBreak: "break-all" }}>
                  {typeof window !== "undefined" ? `${window.location.origin}/embed/${board.slug}` : ""}
                </div>
                <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/embed/${board.slug}`)}
                  style={{ marginTop: 6, width: "100%", padding: "7px", background: "var(--sticky-g)", border: "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink)" }}>
                  Copy embed URL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Ratings panel ── */}
      {showRatings && board.enable_ratings && (
        <RatingsPanel
          boardId={board.id}
          boardTitle={board.title}
          initialRatings={initialRatings}
          currentUser={currentUser}
          isOwner={isOwner}
          onClose={() => setShowRatings(false)}
        />
      )}
    </div>
  );
}
