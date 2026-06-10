"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Board, Note, NoteColor, Rating } from "@/types";
import { sanitizeText, validateNoteContent, validateAuthorName, LIMITS } from "@/lib/sanitize";
import { Plus, X, ThumbsUp, Trash2, Star } from "lucide-react";

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
  initialRatings: Rating[];
  currentUser: { id: string; email: string } | null;
}

export default function EmbedCanvas({ board, initialNotes, initialRatings, currentUser }: Props) {
  const supabase = createClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [ratings, setRatings] = useState<Rating[]>(initialRatings);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const dragging = useRef<{ id: string; type: "note" | "rating"; ox: number; oy: number; startX: number; startY: number; finalX: number; finalY: number } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addPos, setAddPos] = useState({ x: 100, y: 100 });
  const [newText, setNewText] = useState("");
  const [newColor, setNewColor] = useState<NoteColor>("yellow");
  const [authorName, setAuthorName] = useState(() => typeof window !== "undefined" ? localStorage.getItem("piu_name") ?? "" : "");
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState("");

  // Review state
  const [reviewStars, setReviewStars] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewError, setReviewError] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [hasRated, setHasRated] = useState(() => {
    if (typeof window === "undefined") return false;
    const fp = localStorage.getItem("piu_fp");
    return fp ? initialRatings.some(r => r.voter_fingerprint === fp) : false;
  });

  const bgClass = board.mode === "grid" ? "bg-grid" : board.mode === "ruled" ? "bg-ruled" : "bg-dot-grid";

  // Notes realtime
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

  // Ratings realtime
  useEffect(() => {
    if (!board.enable_ratings) return;
    const ch = supabase.channel(`embed-ratings:${board.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ratings", filter: `board_id=eq.${board.id}` },
        p => setRatings(r => r.find(x => x.id === p.new.id) ? r : [...r, p.new as Rating]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ratings", filter: `board_id=eq.${board.id}` },
        p => setRatings(r => r.map(x => x.id === p.new.id ? { ...x, ...p.new } : x)))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "ratings", filter: `board_id=eq.${board.id}` },
        p => setRatings(r => r.filter(x => x.id !== p.old.id)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [board.id, board.enable_ratings, supabase]);

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
      if (dragging.current.type === "note") {
        setNotes(ns => ns.map(n => n.id === dragging.current?.id ? { ...n, x: nx, y: ny } : n));
      } else {
        setRatings(rs => rs.map(r => r.id === dragging.current?.id ? { ...r, x: nx, y: ny } : r));
      }
    }
  }, [isPanning, scale, board.mode]);

  const onMouseUp = useCallback(async () => {
    setIsPanning(false);
    if (dragging.current) {
      const { id, type, finalX, finalY } = dragging.current;
      dragging.current = null;
      const table = type === "rating" ? "ratings" : "notes";
      await supabase.from(table).update({ x: finalX, y: finalY }).eq("id", id);
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

  /* ── Touch support ── */
  const lastTap = useRef(0);
  const touchPanStart = useRef({ tx: 0, ty: 0, px: 0, py: 0 });
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const getTouchDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStart.current = { dist: getTouchDist(e.touches), scale };
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      if (!(t.target as HTMLElement).closest(".note-card")) {
        const now = Date.now();
        if (now - lastTap.current < 300) {
          const rect = canvasRef.current!.getBoundingClientRect();
          setAddPos({ x: snap((t.clientX - rect.left - pan.x) / scale, board.mode), y: snap((t.clientY - rect.top - pan.y) / scale, board.mode) });
          setShowAdd(true);
          lastTap.current = 0;
          return;
        }
        lastTap.current = now;
        touchPanStart.current = { tx: t.clientX, ty: t.clientY, px: pan.x, py: pan.y };
      }
    }
  }, [pan, scale, board.mode]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart.current) {
      e.preventDefault();
      const newScale = Math.min(2, Math.max(0.4, pinchStart.current.scale * (getTouchDist(e.touches) / pinchStart.current.dist)));
      setScale(newScale);
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      if (dragging.current) {
        const nx = snap(dragging.current.ox + (t.clientX - dragging.current.startX) / scale, board.mode);
        const ny = snap(dragging.current.oy + (t.clientY - dragging.current.startY) / scale, board.mode);
        dragging.current.finalX = nx; dragging.current.finalY = ny;
        if (dragging.current.type === "note") setNotes(ns => ns.map(n => n.id === dragging.current?.id ? { ...n, x: nx, y: ny } : n));
        else setRatings(rs => rs.map(r => r.id === dragging.current?.id ? { ...r, x: nx, y: ny } : r));
        return;
      }
      setPan({ x: touchPanStart.current.px + t.clientX - touchPanStart.current.tx, y: touchPanStart.current.py + t.clientY - touchPanStart.current.ty });
    }
  }, [scale, board.mode]);

  const onTouchEnd = useCallback(async () => {
    pinchStart.current = null;
    if (dragging.current) {
      const { id, type, finalX, finalY } = dragging.current;
      dragging.current = null;
      await supabase.from(type === "rating" ? "ratings" : "notes").update({ x: finalX, y: finalY }).eq("id", id);
    }
  }, [supabase]);

  const addNote = async () => {
    setAddError("");
    const contentErr = validateNoteContent(newText);
    if (contentErr) { setAddError(contentErr); return; }
    const nameErr = validateAuthorName(authorName);
    if (nameErr) { setAddError(nameErr); return; }
    const cleanContent = sanitizeText(newText);
    const cleanName = sanitizeText(authorName) || "Anonymous";
    localStorage.setItem("piu_name", cleanName);
    const { error } = await supabase.from("notes").insert({ board_id: board.id, content: cleanContent, color: newColor, x: addPos.x, y: addPos.y, width: 200, rotation: randRot(), author_name: cleanName, user_id: currentUser?.id ?? null });
    if (error) { setAddError("Failed to save. Try again."); return; }
    setNewText(""); setShowAdd(false); setReviewStars(0);
  };

  const submitReview = async () => {
    if (reviewStars === 0) { setReviewError("Pick a star rating first"); return; }
    const contentErr = validateNoteContent(newText);
    if (contentErr) { setAddError(contentErr); return; }
    setReviewSubmitting(true);
    setReviewError("");
    const fp = getFingerprint();
    const cleanName = sanitizeText(authorName) || "Anonymous";
    localStorage.setItem("piu_name", cleanName);
    const { error } = await supabase.from("ratings").insert({
      board_id: board.id, stars: reviewStars,
      review: sanitizeText(newText).slice(0, 300),
      author_name: cleanName,
      user_id: currentUser?.id ?? null,
      voter_fingerprint: fp,
      x: addPos.x, y: addPos.y, width: 220, rotation: randRot(),
    });
    setReviewSubmitting(false);
    if (error) {
      if (error.code === "23505") { setReviewError("You've already reviewed this board"); setHasRated(true); }
      else setReviewError("Failed to submit. Try again.");
      return;
    }
    setHasRated(true); setReviewStars(0); setNewText(""); setShowAdd(false);
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

  const isEmpty = notes.length === 0 && ratings.length === 0;

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
          {board.prompt && <span style={{ fontSize: "0.75rem", color: "var(--ink3)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{board.prompt}</span>}
          <button onClick={() => { setAddPos({ x: 80, y: 60 }); setShowAdd(true); }}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", background: "var(--ink)", border: "none", cursor: "pointer", color: "white", fontSize: "0.85rem", fontFamily: "inherit" }}>
            <Plus size={13} /> {board.enable_ratings ? "Add" : "Add note"}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={canvasRef} className={bgClass}
        style={{ flex: 1, position: "relative", overflow: "hidden", cursor: isPanning ? "grabbing" : "default" }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp} onDoubleClick={onDblClick} onWheel={onWheel}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

        {isEmpty && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
            <p style={{ fontSize: "1.1rem", color: "var(--ink3)" }}>Double-click to add a note</p>
          </div>
        )}

        <div style={{ position: "absolute", top: 0, left: 0, transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`, transformOrigin: "0 0" }}>

          {/* Rating cards */}
          {board.enable_ratings && ratings.map(r => (
            <div key={r.id} className="note-card"
              onMouseDown={e => { if ((e.target as HTMLElement).closest("button")) return; e.stopPropagation(); dragging.current = { id: r.id, type: "rating", ox: r.x, oy: r.y, startX: e.clientX, startY: e.clientY, finalX: r.x, finalY: r.y }; }}
              onTouchStart={e => { if ((e.target as HTMLElement).closest("button")) return; e.stopPropagation(); const t = e.touches[0]; dragging.current = { id: r.id, type: "rating", ox: r.x, oy: r.y, startX: t.clientX, startY: t.clientY, finalX: r.x, finalY: r.y }; }}
              style={{ position: "absolute", left: r.x, top: r.y, width: r.width, transform: `rotate(${r.rotation}deg)`, cursor: "grab", userSelect: "none", zIndex: 2 }}>
              <span className="tape tape-y" style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 44, height: 14, borderRadius: 2 }} />
              <div style={{ background: "var(--sticky-y)", border: "1.5px solid var(--ink)", boxShadow: "2px 3px 0 rgba(28,28,28,0.1)", padding: "20px 12px 10px" }}>
                <div style={{ display: "flex", gap: 2, marginBottom: 6 }}>
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={13} fill={s <= r.stars ? "#f59e0b" : "none"} stroke={s <= r.stars ? "#f59e0b" : "rgba(28,28,28,0.25)"} strokeWidth={1.8} />
                  ))}
                </div>
                {r.review && <p style={{ fontSize: "0.88rem", color: "var(--ink)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{r.review}</p>}
                <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px dashed rgba(28,28,28,0.18)" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink2)" }}>— {r.author_name}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Note cards */}
          {notes.map(note => (
            <div key={note.id} className="note-card"
              onMouseDown={e => { if ((e.target as HTMLElement).closest("button")) return; e.stopPropagation(); dragging.current = { id: note.id, type: "note", ox: note.x, oy: note.y, startX: e.clientX, startY: e.clientY, finalX: note.x, finalY: note.y }; }}
              onTouchStart={e => { if ((e.target as HTMLElement).closest("button")) return; e.stopPropagation(); const t = e.touches[0]; dragging.current = { id: note.id, type: "note", ox: note.x, oy: note.y, startX: t.clientX, startY: t.clientY, finalX: note.x, finalY: note.y }; }}
              style={{ position: "absolute", left: note.x, top: note.y, width: note.width, transform: `rotate(${note.rotation}deg)`, cursor: "grab", userSelect: "none", zIndex: 2 }}>
              <span className={`tape ${colorTape(note.color)}`} style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 44, height: 14, borderRadius: 2 }} />
              <div style={{ background: colorBg(note.color), border: "1.5px solid var(--ink)", boxShadow: "2px 3px 0 rgba(28,28,28,0.1)", padding: "20px 12px 10px" }}>
                <p style={{ fontSize: "0.9rem", color: "var(--ink)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{note.content}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 6, borderTop: "1px dashed rgba(28,28,28,0.18)" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink2)" }}>— {note.author_name}</span>
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

      {/* Add modal — unified with optional stars */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,28,28,0.3)", backdropFilter: "blur(2px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
          onClick={() => { setShowAdd(false); setReviewStars(0); setNewText(""); setAddError(""); setReviewError(""); }}>
          <div style={{ maxWidth: 360, width: "100%", position: "relative" }} onClick={e => e.stopPropagation()}>
            <span className={`tape ${colorTape(newColor)}`} style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 52, height: 16, borderRadius: 2, zIndex: 10 }} />
            <div className="sk" style={{ background: colorBg(newColor), padding: "22px 18px 18px" }}>
              <div className="sk-b" />
              <div className="sk-i">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.05rem", color: "var(--ink)" }}>New note</span>
                  <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink2)" }}><X size={16} /></button>
                </div>

                {/* Name */}
                <input value={authorName} onChange={e => setAuthorName(e.target.value.slice(0, LIMITS.authorName.max))}
                  placeholder="Your name (optional)"
                  style={{ width: "100%", padding: "6px 9px", border: "1.5px solid rgba(28,28,28,0.2)", background: "rgba(255,255,255,0.6)", fontSize: "0.88rem", fontFamily: "inherit", color: "var(--ink)", outline: "none", marginBottom: 8 }} />

                {/* Text */}
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <textarea autoFocus value={newText}
                    onChange={e => { setAddError(""); setNewText(e.target.value.slice(0, LIMITS.noteContent.max)); }}
                    onKeyDown={e => { if (e.key === "Enter" && e.metaKey) reviewStars > 0 ? submitReview() : addNote(); }}
                    placeholder="Write your note…" rows={3}
                    style={{ width: "100%", padding: "8px", border: "1.5px solid rgba(28,28,28,0.2)", background: "rgba(255,255,255,0.6)", fontSize: "0.95rem", fontFamily: "inherit", color: "var(--ink)", outline: "none", resize: "none" }} />
                  <span style={{ position: "absolute", bottom: 5, right: 7, fontSize: "0.68rem", color: "var(--ink3)" }}>{newText.length}/{LIMITS.noteContent.max}</span>
                </div>

                {/* Color picker */}
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {COLORS.map(c => (
                    <button key={c.value} onClick={() => setNewColor(c.value)}
                      style={{ width: 22, height: 22, background: c.bg, border: newColor === c.value ? "2.5px solid var(--ink)" : "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", borderRadius: 2, transform: newColor === c.value ? "scale(1.15)" : "scale(1)", transition: "transform 0.15s" }} />
                  ))}
                </div>

                {/* Star rating — only when enabled */}
                {board.enable_ratings && (
                  <div style={{ borderTop: "1px dashed rgba(28,28,28,0.18)", paddingTop: 10, marginBottom: 10 }}>
                    <p style={{ fontSize: "0.78rem", color: "var(--ink3)", marginBottom: 7 }}>Rate this board? (optional)</p>
                    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                      {[1,2,3,4,5].map(s => (
                        <button key={s} type="button"
                          onClick={() => setReviewStars(reviewStars === s ? 0 : s)}
                          onMouseEnter={() => setReviewHover(s)}
                          onMouseLeave={() => setReviewHover(0)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 1, transform: reviewHover === s ? "scale(1.3)" : "scale(1)", transition: "transform 0.1s" }}>
                          <Star size={22} fill={s <= (reviewHover || reviewStars) ? "#f59e0b" : "none"} stroke={s <= (reviewHover || reviewStars) ? "#f59e0b" : "rgba(28,28,28,0.25)"} strokeWidth={1.8} />
                        </button>
                      ))}
                      {reviewStars > 0 && (
                        <span style={{ fontSize: "0.78rem", color: "var(--ink2)", marginLeft: 5 }}>
                          {["","Poor","Fair","Good","Great","Amazing!"][reviewStars]}
                        </span>
                      )}
                    </div>
                    {reviewError && <p style={{ fontSize: "0.78rem", color: "#ef4444", marginTop: 5 }}>{reviewError}</p>}
                  </div>
                )}

                {addError && <p style={{ fontSize: "0.82rem", color: "#ef4444", marginBottom: 8 }}>{addError}</p>}

                <button
                  onClick={() => reviewStars > 0 ? submitReview() : addNote()}
                  disabled={!newText.trim() || reviewSubmitting}
                  style={{ width: "100%", padding: "9px", background: newText.trim() && !reviewSubmitting ? "var(--ink)" : "var(--ink3)", color: "white", border: "none", cursor: newText.trim() && !reviewSubmitting ? "pointer" : "default", fontSize: "0.95rem", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {reviewStars > 0
                    ? <><Star size={13} fill="white" stroke="white" />{reviewSubmitting ? "Posting…" : "Post review"}</>
                    : "Pin it! 📌"
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
