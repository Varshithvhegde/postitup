"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft, Download, Trash2, AlertTriangle, User, FileText, StickyNote } from "lucide-react";

interface Props {
  user: { id: string; email: string };
  profile: { display_name: string | null; created_at: string } | null;
  boardCount: number;
  noteCount: number;
}

export default function AccountPage({ user, profile, boardCount, noteCount }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [exporting, setExporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleExport = async () => {
    setExporting(true);
    const { data, error } = await supabase.rpc("export_user_data");
    setExporting(false);
    if (error) { setError("Export failed: " + error.message); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `postitup-data-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (deleteConfirm !== user.email) return;
    setDeleting(true);
    setError("");
    // Clear local storage first
    localStorage.removeItem("piu_fp");
    localStorage.removeItem("piu_name");

    const { error } = await supabase.rpc("delete_user_account");
    if (error) { setError("Deletion failed: " + error.message); setDeleting(false); return; }
    await supabase.auth.signOut();
    router.push("/?deleted=1");
  };

  return (
    <main className="min-h-screen px-6 py-12" style={{ background: "var(--paper)" }}>
      <div className="fixed inset-0 bg-dot-grid -z-10" />
      <div className="max-w-xl mx-auto">
        <Link href="/dashboard"
          style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink2)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 32 }}>
          <ChevronLeft size={15} /> Dashboard
        </Link>

        {/* Profile summary */}
        <div style={{ position: "relative", marginBottom: 24 }}>
          <span className="tape tape-b" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 64, height: 18, borderRadius: 2, zIndex: 10 }} />
          <div className="sk sn-b" style={{ padding: "28px 28px 24px", position: "relative" }}>
            <div className="sk-b" />
            <div className="sk-i">
              <h1 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.6rem", color: "var(--ink)", marginBottom: 20 }}>
                My Account
              </h1>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { icon: User,      label: "Email",       value: user.email },
                  { icon: User,      label: "Name",        value: profile?.display_name ?? "—" },
                  { icon: FileText,  label: "Boards",      value: `${boardCount} board${boardCount !== 1 ? "s" : ""}` },
                  { icon: StickyNote,label: "Notes posted",value: `${noteCount} note${noteCount !== 1 ? "s" : ""}` },
                  { icon: FileText,  label: "Member since",value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Icon size={14} style={{ color: "var(--ink3)", flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem", color: "var(--ink3)", width: 100, flexShrink: 0 }}>{label}</span>
                    <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", color: "var(--ink)" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Data export */}
        <div style={{ position: "relative", marginBottom: 24 }}>
          <span className="tape tape-g" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 64, height: 18, borderRadius: 2, zIndex: 10 }} />
          <div className="sk sn-g" style={{ padding: "24px 28px", position: "relative" }}>
            <div className="sk-b" />
            <div className="sk-i">
              <h2 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.2rem", color: "var(--ink)", marginBottom: 8 }}>
                Download your data
              </h2>
              <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink2)", marginBottom: 16, lineHeight: 1.6 }}>
                Export all your boards, notes, and profile data as a JSON file. You have the right to receive a copy of your data at any time (GDPR Art. 20).
              </p>
              <button onClick={handleExport} disabled={exporting}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", background: exporting ? "var(--ink3)" : "var(--ink)", color: "white", border: "none", cursor: exporting ? "default" : "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem" }}>
                <Download size={15} />
                {exporting ? "Exporting…" : "Export my data (JSON)"}
              </button>
            </div>
          </div>
        </div>

        {/* Legal links */}
        <div style={{ position: "relative", marginBottom: 24 }}>
          <span className="tape tape-y" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 64, height: 18, borderRadius: 2, zIndex: 10 }} />
          <div className="sk sn-y" style={{ padding: "20px 28px", position: "relative" }}>
            <div className="sk-b" />
            <div className="sk-i" style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <Link href="/legal/privacy" style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", color: "var(--ink)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}>
                📄 Privacy Policy
              </Link>
              <Link href="/legal/terms" style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", color: "var(--ink)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}>
                📋 Terms of Service
              </Link>
              <Link href="/legal/cookies" style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", color: "var(--ink)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}>
                🍪 Cookie Policy
              </Link>
            </div>
          </div>
        </div>

        {/* Danger zone — account deletion */}
        <div style={{ position: "relative" }}>
          <span className="tape tape-p" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 64, height: 18, borderRadius: 2, zIndex: 10 }} />
          <div className="sk sn-p" style={{ padding: "24px 28px", position: "relative" }}>
            <div className="sk-b" />
            <div className="sk-i">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <AlertTriangle size={17} style={{ color: "#dc2626" }} />
                <h2 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.2rem", color: "#dc2626" }}>Delete account</h2>
              </div>
              <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink2)", marginBottom: 16, lineHeight: 1.65 }}>
                This will permanently delete your account, all boards you own, and all notes on those boards.
                Notes you posted on other people's boards will be anonymised (author shown as "Deleted User").
                <br /><br />
                <strong style={{ color: "var(--ink)" }}>This cannot be undone.</strong>
              </p>

              {error && <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "#dc2626", marginBottom: 12 }}>{error}</p>}

              {!showDelete ? (
                <button onClick={() => setShowDelete(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", background: "white", border: "1.5px solid #dc2626", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", color: "#dc2626" }}>
                  <Trash2 size={14} /> Delete my account
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink)" }}>
                    Type your email <strong>{user.email}</strong> to confirm:
                  </p>
                  <input
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder={user.email}
                    style={{ padding: "10px 12px", border: "1.5px solid #dc2626", background: "white", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink)", outline: "none" }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={handleDelete}
                      disabled={deleteConfirm !== user.email || deleting}
                      style={{ flex: 1, padding: "10px", background: deleteConfirm === user.email ? "#dc2626" : "var(--ink3)", color: "white", border: "none", cursor: deleteConfirm === user.email && !deleting ? "pointer" : "default", fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                      <Trash2 size={14} /> {deleting ? "Deleting everything…" : "Permanently delete account"}
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
