"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Rating } from "@/types";
import { X, Star } from "lucide-react";
import { sanitizeText } from "@/lib/sanitize";

function getFingerprint() {
  let fp = localStorage.getItem("piu_fp");
  if (!fp) { fp = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("piu_fp", fp); }
  return fp;
}

function StarPicker({ value, onChange, readonly = false, size = 28 }: { value: number; onChange?: (v: number) => void; readonly?: boolean; size?: number }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          onClick={() => !readonly && onChange?.(s)}
          onMouseEnter={() => !readonly && setHover(s)}
          onMouseLeave={() => !readonly && setHover(0)}
          style={{
            background: "none", border: "none",
            cursor: readonly ? "default" : "pointer",
            padding: 0, lineHeight: 1,
            transform: !readonly && hover === s ? "scale(1.25)" : "scale(1)",
            transition: "transform 0.1s",
          }}
          aria-label={`${s} star${s !== 1 ? "s" : ""}`}
        >
          <Star
            size={size}
            fill={s <= active ? "#f59e0b" : "none"}
            stroke={s <= active ? "#f59e0b" : "rgba(28,28,28,0.3)"}
            strokeWidth={1.8}
          />
        </button>
      ))}
    </div>
  );
}

function avg(ratings: Rating[]) {
  if (!ratings.length) return 0;
  return ratings.reduce((s, r) => s + r.stars, 0) / ratings.length;
}

interface Props {
  boardId: string;
  boardTitle: string;
  initialRatings: Rating[];
  currentUser: { id: string; email: string } | null;
  isOwner: boolean;
  onClose: () => void;
}

export default function RatingsPanel({ boardId, boardTitle, initialRatings, currentUser, isOwner, onClose }: Props) {
  const supabase = createClient();
  const [ratings, setRatings] = useState<Rating[]>(initialRatings);
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState("");
  const [authorName, setAuthorName] = useState(() => typeof window !== "undefined" ? localStorage.getItem("piu_name") ?? "" : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [hasRated, setHasRated] = useState(() => {
    if (typeof window === "undefined") return false;
    const fp = localStorage.getItem("piu_fp");
    return fp ? initialRatings.some(r => r.voter_fingerprint === fp) : false;
  });

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`ratings:${boardId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ratings", filter: `board_id=eq.${boardId}` },
        p => setRatings(r => r.find(x => x.id === p.new.id) ? r : [...r, p.new as Rating]))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "ratings", filter: `board_id=eq.${boardId}` },
        p => setRatings(r => r.filter(x => x.id !== p.old.id)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [boardId, supabase]);

  const submit = async () => {
    if (stars === 0) { setError("Pick a star rating first"); return; }
    setSubmitting(true);
    setError("");
    const fp = getFingerprint();
    const name = sanitizeText(authorName) || "Anonymous";
    localStorage.setItem("piu_name", name);
    const { error: err } = await supabase.from("ratings").insert({
      board_id: boardId,
      stars,
      review: review.trim() ? sanitizeText(review).slice(0, 300) : null,
      author_name: name,
      user_id: currentUser?.id ?? null,
      voter_fingerprint: fp,
    });
    setSubmitting(false);
    if (err) {
      if (err.code === "23505") { setError("You've already rated this board"); setHasRated(true); }
      else setError("Failed to submit. Try again.");
      return;
    }
    setHasRated(true);
    setStars(0);
    setReview("");
  };

  const deleteRating = async (id: string) => {
    setRatings(r => r.filter(x => x.id !== id));
    await supabase.from("ratings").delete().eq("id", id);
  };

  const average = avg(ratings);
  const distribution = [5, 4, 3, 2, 1].map(s => ({
    s,
    count: ratings.filter(r => r.stars === s).length,
    pct: ratings.length ? Math.round((ratings.filter(r => r.stars === s).length / ratings.length) * 100) : 0,
  }));

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(28,28,28,0.4)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ position: "relative", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Tape */}
        <span className="tape tape-y" style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 60, height: 18, borderRadius: 2, zIndex: 10 }} />

        <div className="sk" style={{ background: "white", padding: "28px 26px 24px", position: "relative" }}>
          <div className="sk-b" />
          <div className="sk-i">

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.4rem", color: "var(--ink)", marginBottom: 2 }}>
                  Ratings
                </h2>
                <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink3)" }}>{boardTitle}</p>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink2)", padding: 4, transition: "transform 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.transform = "rotate(90deg)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "")}>
                <X size={18} />
              </button>
            </div>

            {/* Summary */}
            {ratings.length > 0 && (
              <div style={{ display: "flex", gap: 20, alignItems: "center", padding: "16px", background: "var(--sticky-y)", border: "1.5px solid rgba(28,28,28,0.12)", marginBottom: 20 }}>
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "2.8rem", fontWeight: 700, color: "var(--ink)", lineHeight: 1 }}>
                    {average.toFixed(1)}
                  </div>
                  <StarPicker value={Math.round(average)} readonly size={16} />
                  <div style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink3)", marginTop: 4 }}>
                    {ratings.length} review{ratings.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  {distribution.map(({ s, count, pct }) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.75rem", color: "var(--ink3)", width: 8, textAlign: "right" }}>{s}</span>
                      <Star size={11} fill="#f59e0b" stroke="#f59e0b" strokeWidth={1.5} />
                      <div style={{ flex: 1, height: 7, background: "rgba(28,28,28,0.1)", borderRadius: 0, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "#f59e0b", transition: "width 0.4s ease" }} />
                      </div>
                      <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.72rem", color: "var(--ink3)", width: 22 }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit form */}
            {!hasRated ? (
              <div style={{ marginBottom: 24, padding: "16px", background: "var(--paper)", border: "1.5px solid rgba(28,28,28,0.15)" }}>
                <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem", color: "var(--ink2)", marginBottom: 12 }}>Leave your review</p>

                <div style={{ marginBottom: 12 }}>
                  <StarPicker value={stars} onChange={setStars} />
                </div>

                <input value={authorName} onChange={e => setAuthorName(e.target.value.slice(0, 60))}
                  placeholder="Your name (optional)"
                  style={{ width: "100%", padding: "7px 10px", border: "1.5px solid rgba(28,28,28,0.2)", background: "white", fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink)", outline: "none", marginBottom: 8 }} />

                <textarea value={review} onChange={e => setReview(e.target.value.slice(0, 300))}
                  placeholder="Write something about your experience… (optional)"
                  rows={3}
                  style={{ width: "100%", padding: "8px 10px", border: "1.5px solid rgba(28,28,28,0.2)", background: "white", fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink)", outline: "none", resize: "none", marginBottom: 4 }} />
                <div style={{ textAlign: "right", fontFamily: "var(--font-kalam), serif", fontSize: "0.7rem", color: "var(--ink3)", marginBottom: 10 }}>{review.length}/300</div>

                {error && <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "#ef4444", marginBottom: 8 }}>{error}</p>}

                <button onClick={submit} disabled={submitting || stars === 0}
                  style={{ width: "100%", padding: "10px", background: stars > 0 && !submitting ? "var(--ink)" : "var(--ink3)", color: "white", border: "none", cursor: stars > 0 && !submitting ? "pointer" : "default", fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  <Star size={14} fill="white" stroke="white" />
                  {submitting ? "Submitting…" : "Submit review"}
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: 20, padding: "14px 16px", background: "var(--sticky-g)", border: "1.5px solid rgba(28,28,28,0.12)", display: "flex", alignItems: "center", gap: 10 }}>
                <Star size={16} fill="#16a34a" stroke="#16a34a" />
                <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink)" }}>Thanks for your review!</p>
              </div>
            )}

            {/* Reviews list */}
            {ratings.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.82rem", color: "var(--ink3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                  All reviews
                </p>
                {[...ratings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(r => (
                  <div key={r.id} style={{ padding: "12px 14px", background: "var(--paper)", border: "1.5px solid rgba(28,28,28,0.12)", position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <StarPicker value={r.stars} readonly size={14} />
                        <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.82rem", fontWeight: 700, color: "var(--ink)" }}>{r.author_name}</span>
                      </div>
                      {(isOwner || currentUser?.id === r.user_id) && (
                        <button onClick={() => deleteRating(r.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink3)", padding: 2, fontSize: "0.7rem", fontFamily: "var(--font-kalam), serif" }}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    {r.review && (
                      <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem", color: "var(--ink2)", lineHeight: 1.6, margin: 0 }}>{r.review}</p>
                    )}
                    <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.7rem", color: "var(--ink3)", marginTop: 6 }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {ratings.length === 0 && hasRated && (
              <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink3)", textAlign: "center", padding: "20px 0" }}>No reviews yet. Be the first!</p>
            )}
            {ratings.length === 0 && !hasRated && (
              <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink3)", textAlign: "center", marginTop: 8 }}>No reviews yet. Be the first!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
