"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Board, Note, NoteColor, Rating } from "@/types";
import { sanitizeText, validateNoteContent, validateAuthorName, LIMITS } from "@/lib/sanitize";
import {
  Plus, X, ThumbsUp, Trash2, Link as LinkIcon,
  Settings, ChevronLeft, Copy, Check, Star, Pencil,
} from "lucide-react";
import RatingsPanel from "@/components/canvas/RatingsPanel";
import KofiButton from "@/components/KofiButton";

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
  // review state — lives inside the unified note modal
  const [reviewStars, setReviewStars] = useState(0);
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

  /* ── Dragging notes or rating cards ── */
  const dragging = useRef<{ id: string; type: "note" | "rating"; ox: number; oy: number; startX: number; startY: number; finalX: number; finalY: number } | null>(null);

  /* ── Inline editing — notes ── */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  /* ── Inline editing — ratings ── */
  const [editingRatingId, setEditingRatingId] = useState<string | null>(null);
  const [editRatingText, setEditRatingText] = useState("");
  const [editRatingStars, setEditRatingStars] = useState(0);
  const [editRatingHover, setEditRatingHover] = useState(0);

  /* ── Voted set ── */
  const [voted, setVoted] = useState<Set<string>>(new Set());

  /* ── Copied link ── */
  const [copied, setCopied] = useState(false);

  /* ── Settings panel ── */
  const [showSettings, setShowSettings] = useState(false);
  /* ── Mobile toolbar overflow menu ── */
  const [mobileMenu, setMobileMenu] = useState(false);

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

  /* ── Submit review — uses same newText + authorName as note form ── */
  const submitReview = async () => {
    if (reviewStars === 0) { setReviewError("Pick a star rating first"); return; }
    const contentErr = validateNoteContent(newText);
    if (contentErr) { setAddError(contentErr); return; }
    setReviewSubmitting(true);
    setReviewError("");
    const fp = getFingerprint();
    const name = sanitizeText(authorName) || "Anonymous";
    localStorage.setItem("piu_name", name);
    const { error } = await supabase.from("ratings").insert({
      board_id: board.id,
      stars: reviewStars,
      review: sanitizeText(newText).slice(0, 300),
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
    setNewText("");
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
      dragging.current.finalX = nx;
      dragging.current.finalY = ny;
      if (dragging.current.type === "note") {
        setNotes(ns => ns.map(n => n.id === dragging.current?.id ? { ...n, x: nx, y: ny } : n));
      } else {
        setRatings(rs => rs.map(r => r.id === dragging.current?.id ? { ...r, x: nx, y: ny } : r));
      }
    }
  }, [isPanning, scale, board.mode]);

  const onCanvasMouseUp = useCallback(async () => {
    setIsPanning(false);
    if (dragging.current) {
      const { id, type, finalX, finalY } = dragging.current;
      dragging.current = null;
      const table = type === "rating" ? "ratings" : "notes";
      const { error } = await supabase.from(table).update({ x: finalX, y: finalY }).eq("id", id);
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
    setShowAddForm(true);
  }, [pan, scale, board.mode]);

  /* ── Touch support ── */
  const lastTap        = useRef(0);
  const touchPanStart  = useRef({ tx: 0, ty: 0, px: 0, py: 0 });
  const pinchStart     = useRef<{ dist: number; scale: number } | null>(null);
  // true while a note/rating card is being dragged — used to block page scroll
  const isTouchDragging = useRef(false);

  const getTouchDist = (t: TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  // Register a non-passive touchmove on the canvas so we can call preventDefault()
  // React synthetic events are passive by default and cannot prevent scroll
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => {
      if (isTouchDragging.current || (pinchStart.current && e.touches.length === 2)) {
        e.preventDefault();
      }
    };
    el.addEventListener("touchmove", handler, { passive: false });
    return () => el.removeEventListener("touchmove", handler);
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStart.current = { dist: getTouchDist(e.touches as unknown as TouchList), scale };
      isTouchDragging.current = true;
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const target = t.target as HTMLElement;

      if (!target.closest(".note-card")) {
        const now = Date.now();
        if (now - lastTap.current < 300) {
          const rect = canvasRef.current!.getBoundingClientRect();
          const x = snap((t.clientX - rect.left - pan.x) / scale, board.mode);
          const y = snap((t.clientY - rect.top - pan.y) / scale, board.mode);
          setAddPos({ x, y });
          setShowAddForm(true);
          lastTap.current = 0;
          return;
        }
        lastTap.current = now;
        touchPanStart.current = { tx: t.clientX, ty: t.clientY, px: pan.x, py: pan.y };
        // background touch = canvas pan, block page scroll
        isTouchDragging.current = true;
        return;
      }
    }
  }, [pan, scale, board.mode]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart.current) {
      const newDist = getTouchDist(e.touches as unknown as TouchList);
      const newScale = Math.min(2, Math.max(0.4, pinchStart.current.scale * (newDist / pinchStart.current.dist)));
      setScale(newScale);
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      if (dragging.current) {
        // Note drag — preventDefault handled by native listener above
        const dx = (t.clientX - dragging.current.startX) / scale;
        const dy = (t.clientY - dragging.current.startY) / scale;
        const nx = snap(dragging.current.ox + dx, board.mode);
        const ny = snap(dragging.current.oy + dy, board.mode);
        dragging.current.finalX = nx;
        dragging.current.finalY = ny;
        if (dragging.current.type === "note") {
          setNotes(ns => ns.map(n => n.id === dragging.current?.id ? { ...n, x: nx, y: ny } : n));
        } else {
          setRatings(rs => rs.map(r => r.id === dragging.current?.id ? { ...r, x: nx, y: ny } : r));
        }
        return;
      }
      // Background pan
      setPan({
        x: touchPanStart.current.px + (t.clientX - touchPanStart.current.tx),
        y: touchPanStart.current.py + (t.clientY - touchPanStart.current.ty),
      });
    }
  }, [scale, board.mode]);

  const onTouchEnd = useCallback(async () => {
    pinchStart.current = null;
    isTouchDragging.current = false;
    if (dragging.current) {
      const { id, type, finalX, finalY } = dragging.current;
      dragging.current = null;
      const table = type === "rating" ? "ratings" : "notes";
      await supabase.from(table).update({ x: finalX, y: finalY }).eq("id", id);
    }
  }, [supabase]);

  /* touch start on a note/rating card */
  const onNoteTouchStart = (e: React.TouchEvent, note: Note) => {
    if (e.touches.length !== 1) return;
    e.stopPropagation();
    const t = e.touches[0];
    isTouchDragging.current = true;
    dragging.current = { id: note.id, type: "note", ox: note.x, oy: note.y, startX: t.clientX, startY: t.clientY, finalX: note.x, finalY: note.y };
  };

  const onRatingTouchStart = (e: React.TouchEvent, r: Rating) => {
    if (e.touches.length !== 1) return;
    e.stopPropagation();
    const t = e.touches[0];
    isTouchDragging.current = true;
    dragging.current = { id: r.id, type: "rating", ox: r.x, oy: r.y, startX: t.clientX, startY: t.clientY, finalX: r.x, finalY: r.y };
  };

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
    setNotes(n => n.filter(x => x.id !== id));
    await supabase.from("notes").delete().eq("id", id);
  };

  /* ── Edit note inline ── */
  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditText(note.content);
  };

  const saveEdit = async (id: string) => {
    const clean = sanitizeText(editText).trim();
    setEditingId(null);
    if (!clean) return;
    setNotes(ns => ns.map(n => n.id === id ? { ...n, content: clean } : n));
    await supabase.from("notes").update({ content: clean }).eq("id", id);
  };

  const startEditRating = (r: Rating) => {
    setEditingRatingId(r.id);
    setEditRatingText(r.review ?? "");
    setEditRatingStars(r.stars);
  };

  const saveRatingEdit = async (id: string) => {
    const clean = sanitizeText(editRatingText).trim();
    setEditingRatingId(null);
    setRatings(rs => rs.map(r => r.id === id ? { ...r, review: clean || null, stars: editRatingStars } : r));
    await supabase.from("ratings").update({ review: clean || null, stars: editRatingStars }).eq("id", id);
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
    dragging.current = { id: note.id, type: "note", ox: note.x, oy: note.y, startX: e.clientX, startY: e.clientY, finalX: note.x, finalY: note.y };
  };

  const onRatingMouseDown = (e: React.MouseEvent, r: Rating) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.stopPropagation();
    dragging.current = { id: r.id, type: "rating", ox: r.x, oy: r.y, startX: e.clientX, startY: e.clientY, finalX: r.x, finalY: r.y };
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
      <div style={{ flexShrink: 0, borderBottom: "1.5px solid rgba(28,28,28,0.12)", background: "rgba(250,249,246,0.95)", backdropFilter: "blur(6px)", zIndex: 50, position: "relative" }}>
        <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", gap: 8 }}>
          {/* Left: back + title */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
            <a href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--ink2)", textDecoration: "none", fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", flexShrink: 0 }}>
              <ChevronLeft size={16} /> Back
            </a>
            <div style={{ width: 1, height: 20, background: "rgba(28,28,28,0.15)", flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {board.title}
            </span>
          </div>

          {/* Right: always-visible actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {/* Add note — always visible */}
            <button onClick={() => { setAddPos({ x: Math.max(60, 120 - pan.x / scale), y: Math.max(60, 80 - pan.y / scale) }); setShowAddForm(true); }}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", background: "var(--ink)", border: "none", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem", color: "white" }}>
              <Plus size={14} /> {board.enable_ratings ? "Add" : "Add note"}
            </button>

            {/* Share — always visible */}
            <button onClick={copyLink}
              style={{ display: "flex", alignItems: "center", padding: "7px 10px", background: copied ? "var(--sticky-g)" : "var(--paper2)", border: "1.5px solid rgba(28,28,28,0.18)", cursor: "pointer", color: "var(--ink)", transition: "background 0.2s" }}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>

            {/* ⋯ overflow menu — hides on desktop, shows on mobile via JS */}
            <button onClick={() => setMobileMenu(m => !m)}
              style={{ display: "flex", alignItems: "center", padding: "7px 8px", background: mobileMenu ? "var(--sticky-y)" : "var(--paper2)", border: "1.5px solid rgba(28,28,28,0.18)", cursor: "pointer", color: "var(--ink)" }}
              aria-label="More options">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="13" cy="8" r="1.5"/></svg>
            </button>
          </div>
        </div>

        {/* Overflow menu dropdown — floats over canvas */}
        {mobileMenu && (
          <div style={{ position: "absolute", top: 52, right: 8, zIndex: 60, minWidth: 220, background: "rgba(250,249,246,0.98)", border: "1.5px solid rgba(28,28,28,0.15)", boxShadow: "4px 5px 0 rgba(28,28,28,0.12)", padding: "8px", display: "flex", flexDirection: "column", gap: 6 }}>
            <KofiButton size="sm" />
            <a href="https://github.com/Varshithvhegde/postitup/issues" target="_blank" rel="noopener noreferrer"
              onClick={() => setMobileMenu(false)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", color: "var(--ink2)", textDecoration: "none", fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem", borderRadius: 2, background: "none" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--paper2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              Feedback
            </a>
            {isOwner && (
              <>
                <a href={`/board/${board.slug}/settings`}
                  onClick={() => setMobileMenu(false)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", color: "var(--ink2)", textDecoration: "none", fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem", background: "none" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--paper2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                  <Settings size={14} /> Board settings
                </a>
                <button onClick={() => { setShowSettings(s => !s); setMobileMenu(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem", color: "var(--ink2)", textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--paper2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                  <LinkIcon size={14} /> Embed code
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Backdrop to close mobile menu on canvas tap */}
      {mobileMenu && (
        <div style={{ position: "fixed", inset: 0, zIndex: 55 }} onClick={() => setMobileMenu(false)} />
      )}

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
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Hint text */}
        {notes.length === 0 && ratings.length === 0 && (
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
              onMouseDown={e => editingRatingId === r.id ? e.stopPropagation() : onRatingMouseDown(e, r)}
              onTouchStart={e => editingRatingId === r.id ? e.stopPropagation() : onRatingTouchStart(e, r)}
              style={{
                position: "absolute",
                left: r.x, top: r.y,
                width: r.width,
                transform: `rotate(${r.rotation}deg)`,
                cursor: editingRatingId === r.id ? "default" : "grab",
                userSelect: "none",
                zIndex: editingRatingId === r.id ? 10 : 2,
              }}
            >
              <span className="tape tape-y" style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 48, height: 15, borderRadius: 2 }} />
              <div style={{ background: "var(--sticky-y)", border: "1.5px solid var(--ink)", boxShadow: "3px 4px 0 rgba(28,28,28,0.12)", padding: "22px 14px 12px", position: "relative" }}>

                {/* Action buttons */}
                <div style={{ position: "absolute", top: 5, right: 5, display: "flex", gap: 2 }}>
                  {(isOwner || currentUser?.id === r.user_id) && editingRatingId !== r.id && (
                    <button onClick={() => startEditRating(r)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink3)", padding: 2, opacity: 0.5 }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}>
                      <Pencil size={11} />
                    </button>
                  )}
                  {(isOwner || currentUser?.id === r.user_id) && (
                    <button onClick={() => deleteRating(r.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink3)", padding: 2, opacity: 0.5 }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}>
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>

                {/* Stars — editable when in edit mode */}
                <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
                  {[1,2,3,4,5].map(s => (
                    <button key={s} type="button"
                      onClick={() => editingRatingId === r.id && setEditRatingStars(s)}
                      onMouseEnter={() => editingRatingId === r.id && setEditRatingHover(s)}
                      onMouseLeave={() => setEditRatingHover(0)}
                      style={{ background: "none", border: "none", padding: 0, cursor: editingRatingId === r.id ? "pointer" : "default", transform: editingRatingId === r.id && editRatingHover === s ? "scale(1.2)" : "scale(1)", transition: "transform 0.1s" }}>
                      <Star size={14}
                        fill={s <= (editingRatingId === r.id ? (editRatingHover || editRatingStars) : r.stars) ? "#f59e0b" : "none"}
                        stroke={s <= (editingRatingId === r.id ? (editRatingHover || editRatingStars) : r.stars) ? "#f59e0b" : "rgba(28,28,28,0.25)"}
                        strokeWidth={1.8}
                      />
                    </button>
                  ))}
                </div>

                {/* Review text — editable inline */}
                {editingRatingId === r.id ? (
                  <>
                    <textarea
                      autoFocus
                      value={editRatingText}
                      onChange={e => setEditRatingText(e.target.value.slice(0, 300))}
                      onBlur={() => saveRatingEdit(r.id)}
                      onKeyDown={e => { if (e.key === "Enter" && e.metaKey) { e.preventDefault(); saveRatingEdit(r.id); } if (e.key === "Escape") setEditingRatingId(null); }}
                      placeholder="Add a review…"
                      rows={3}
                      style={{ width: "100%", background: "rgba(255,255,255,0.5)", border: "1.5px solid var(--ink)", fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", lineHeight: 1.6, resize: "none", outline: "none", padding: 4 }}
                    />
                    <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.68rem", color: "var(--ink3)", marginTop: 4 }}>⌘+Enter to save · Esc to cancel</p>
                  </>
                ) : (
                  r.review && (
                    <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", fontWeight: 400, color: "var(--ink)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
                      {r.review}
                    </p>
                  )
                )}

                <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px dashed rgba(28,28,28,0.18)" }}>
                  <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", fontWeight: 700, color: "var(--ink2)" }}>— {r.author_name}</span>
                </div>
              </div>
            </div>
          ))}

          {notes.map(note => (
            <div
              key={note.id}
              className="note-card note-enter"
              onMouseDown={e => editingId === note.id ? e.stopPropagation() : onNoteMouseDown(e, note)}
              onTouchStart={e => editingId === note.id ? e.stopPropagation() : onNoteTouchStart(e, note)}
              style={{
                position: "absolute",
                left: note.x, top: note.y, width: note.width,
                transform: `rotate(${note.rotation}deg)`,
                cursor: editingId === note.id ? "default" : "grab",
                userSelect: "none",
                "--rot": `${note.rotation}deg`,
                zIndex: editingId === note.id ? 10 : 2,
              } as React.CSSProperties}
            >
              <span className={`tape ${colorTape(note.color)}`}
                style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 48, height: 15, borderRadius: 2 }} />

              <div style={{ background: colorBg(note.color), border: "1.5px solid var(--ink)", boxShadow: "3px 4px 0 rgba(28,28,28,0.12)", padding: "22px 14px 12px", position: "relative" }}>

                {/* Action buttons — delete + edit */}
                <div style={{ position: "absolute", top: 5, right: 5, display: "flex", gap: 2 }}>
                  {(isOwner || currentUser?.id === note.user_id) && editingId !== note.id && (
                    <button onClick={() => startEdit(note)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink3)", padding: 2, display: "flex", alignItems: "center", opacity: 0.5 }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}>
                      <Pencil size={11} />
                    </button>
                  )}
                  {(isOwner || currentUser?.id === note.user_id) && (
                    <button onClick={() => deleteNote(note.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink3)", padding: 2, display: "flex", alignItems: "center", opacity: 0.5 }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}>
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>

                {/* Note content — editable inline or display */}
                {editingId === note.id ? (
                  <textarea
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value.slice(0, LIMITS.noteContent.max))}
                    onBlur={() => saveEdit(note.id)}
                    onKeyDown={e => { if (e.key === "Enter" && e.metaKey) { e.preventDefault(); saveEdit(note.id); } if (e.key === "Escape") { setEditingId(null); } }}
                    style={{ width: "100%", background: "rgba(255,255,255,0.5)", border: "1.5px solid var(--ink)", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", fontWeight: 700, color: "var(--ink)", lineHeight: 1.6, resize: "none", outline: "none", padding: 4, minHeight: 60 }}
                    rows={3}
                  />
                ) : (
                  /* Issue #3 — font-weight 700 makes text bold and easy to read */
                  <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "1rem", fontWeight: 400, color: "var(--ink)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
                    {note.content}
                  </p>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: "1px dashed rgba(28,28,28,0.18)" }}>
                  <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", fontWeight: 700, color: "var(--ink2)" }}>— {note.author_name}</span>
                  <button onClick={() => upvote(note)}
                    style={{ display: "flex", alignItems: "center", gap: 4, background: voted.has(note.id) ? "rgba(28,28,28,0.1)" : "none", border: "1px solid rgba(28,28,28,0.15)", borderRadius: 20, padding: "2px 8px", cursor: voted.has(note.id) ? "default" : "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink2)", transition: "background 0.15s" }}>
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

      {/* ── Add note modal — single unified form, stars optional when ratings enabled ── */}
      {showAddForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,28,28,0.35)", backdropFilter: "blur(3px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => { setShowAddForm(false); setReviewStars(0); setNewText(""); setAddError(""); setReviewError(""); }}>
          <div style={{ position: "relative", maxWidth: 390, width: "100%" }} onClick={e => e.stopPropagation()}>
            <span className={`tape ${colorTape(newColor)}`} style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 56, height: 17, borderRadius: 2, zIndex: 10 }} />
            <div className="sk" style={{ background: colorBg(newColor), padding: "28px 24px 22px" }}>
              <div className="sk-b" />
              <div className="sk-i">

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.1rem", color: "var(--ink)" }}>
                    New sticky note
                  </h3>
                  <button onClick={() => setShowAddForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink2)" }}>
                    <X size={18} />
                  </button>
                </div>

                {/* Author name */}
                <input value={authorName} onChange={e => setAuthorName(e.target.value.slice(0, LIMITS.authorName.max))}
                  placeholder="Your name (optional)"
                  style={{ width: "100%", padding: "7px 10px", border: "1.5px solid rgba(28,28,28,0.2)", background: "rgba(255,255,255,0.6)", fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink)", outline: "none", marginBottom: 10 }} />

                {/* Note text */}
                <div style={{ position: "relative", marginBottom: 10 }}>
                  <textarea autoFocus value={newText}
                    onChange={e => { setAddError(""); setNewText(e.target.value.slice(0, LIMITS.noteContent.max)); }}
                    onKeyDown={e => { if (e.key === "Enter" && e.metaKey) reviewStars > 0 ? submitReview() : addNote(); }}
                    placeholder="Write your note…" rows={3}
                    style={{ width: "100%", padding: "10px", border: `1.5px solid ${newText.length >= LIMITS.noteContent.max ? "#ef4444" : "rgba(28,28,28,0.2)"}`, background: "rgba(255,255,255,0.6)", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink)", outline: "none", resize: "vertical" }}
                  />
                  <span style={{ position: "absolute", bottom: 6, right: 8, fontFamily: "var(--font-kalam), serif", fontSize: "0.7rem", color: newText.length >= LIMITS.noteContent.max ? "#ef4444" : "var(--ink3)" }}>
                    {newText.length}/{LIMITS.noteContent.max}
                  </span>
                </div>

                {/* Color picker */}
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {COLORS.map(c => (
                    <button key={c.value} onClick={() => setNewColor(c.value)}
                      style={{ width: 26, height: 26, background: c.bg, border: newColor === c.value ? "2.5px solid var(--ink)" : "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", transform: newColor === c.value ? "scale(1.15)" : "scale(1)", transition: "transform 0.15s", borderRadius: 2 }} />
                  ))}
                </div>

                {/* Star rating — only when board has ratings enabled */}
                {board.enable_ratings && (
                  <div style={{ borderTop: "1px dashed rgba(28,28,28,0.18)", paddingTop: 12, marginBottom: 14 }}>
                    <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.82rem", color: "var(--ink3)", marginBottom: 8 }}>
                      Rate this board? (optional)
                    </p>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {[1, 2, 3, 4, 5].map(s => (
                        <button key={s} type="button"
                          onClick={() => setReviewStars(reviewStars === s ? 0 : s)}
                          onMouseEnter={() => setReviewHover(s)}
                          onMouseLeave={() => setReviewHover(0)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 1, transform: reviewHover === s ? "scale(1.3)" : "scale(1)", transition: "transform 0.1s" }}>
                          <Star size={24}
                            fill={s <= (reviewHover || reviewStars) ? "#f59e0b" : "none"}
                            stroke={s <= (reviewHover || reviewStars) ? "#f59e0b" : "rgba(28,28,28,0.25)"}
                            strokeWidth={1.8}
                          />
                        </button>
                      ))}
                      {reviewStars > 0 && (
                        <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.82rem", color: "var(--ink2)", marginLeft: 6 }}>
                          {["", "Poor", "Fair", "Good", "Great", "Amazing!"][reviewStars]}
                        </span>
                      )}
                    </div>
                    {reviewError && <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.82rem", color: "#ef4444", marginTop: 6 }}>{reviewError}</p>}
                  </div>
                )}

                {addError && <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "#ef4444", marginBottom: 10 }}>{addError}</p>}

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => reviewStars > 0 ? submitReview() : addNote()}
                    disabled={!newText.trim() || reviewSubmitting}
                    style={{ flex: 1, padding: "10px", background: newText.trim() && !reviewSubmitting ? "var(--ink)" : "var(--ink3)", color: "white", border: "none", cursor: newText.trim() && !reviewSubmitting ? "pointer" : "default", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    {reviewStars > 0
                      ? <><Star size={14} fill="white" stroke="white" />{reviewSubmitting ? "Posting…" : "Post review"}</>
                      : "Pin it! 📌"
                    }
                  </button>
                  <button onClick={() => { setShowAddForm(false); setReviewStars(0); setNewText(""); }}
                    style={{ padding: "10px 14px", background: "none", border: "1.5px solid rgba(28,28,28,0.2)", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink2)" }}>
                    Cancel
                  </button>
                </div>
                <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.72rem", color: "var(--ink3)", marginTop: 8, textAlign: "center" }}>⌘+Enter to submit</p>
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
