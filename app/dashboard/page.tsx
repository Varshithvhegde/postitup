import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, LogOut } from "lucide-react";
import type { Board } from "@/types";
import BoardCard from "@/components/BoardCard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: boards } = await supabase
    .from("boards")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen" style={{ background: "var(--paper)" }}>
      <div className="fixed inset-0 bg-dot-grid -z-10" />

      {/* Nav */}
      <nav className="sticky top-0 z-50" style={{ borderBottom: "1.5px solid rgba(28,28,28,0.12)", background: "rgba(250,249,246,0.92)", backdropFilter: "blur(6px)" }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.3rem", fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}>
            PostItUp 📌
          </Link>
          <div className="flex items-center gap-4">
            <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink2)" }}>{user.email}</span>
            <Link href="/account" style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink2)", textDecoration: "none" }}>Account</Link>
            <form action="/auth/signout" method="post">
              <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink2)", display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem" }}>
                <LogOut size={15} /> Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-start justify-between mb-10 flex-wrap gap-4">
          <div>
            <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink3)", letterSpacing: "0.1em", marginBottom: 4 }}>YOUR BOARDS</p>
            <h1 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "2.2rem", color: "var(--ink)" }}>Dashboard</h1>
          </div>
          <Link href="/new" className="sk"
            style={{ fontFamily: "var(--font-kalam), serif", fontSize: "1rem", padding: "10px 22px", background: "var(--ink)", color: "white", textDecoration: "none", position: "relative", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <div className="sk-b" />
            <span className="sk-i flex items-center gap-2" style={{ color: "white" }}><Plus size={16} /> New board</span>
          </Link>
        </div>

        {/* Board grid */}
        {!boards || boards.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.4rem", color: "var(--ink2)", marginBottom: 12 }}>No boards yet</p>
            <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink3)", marginBottom: 24 }}>Create your first sticky note board</p>
            <Link href="/new" className="sk"
              style={{ fontFamily: "var(--font-kalam), serif", fontSize: "1rem", padding: "10px 24px", background: "var(--sticky-y)", color: "var(--ink)", textDecoration: "none", position: "relative" }}>
              <div className="sk-b" />
              <span className="sk-i">Create a board →</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {(boards as Board[]).map((board, i) => (
              <BoardCard key={board.id} board={board} index={i} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
