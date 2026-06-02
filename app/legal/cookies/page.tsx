import Link from "next/link";

export const metadata = { title: "Cookie Policy — PostItUp" };
const LAST_UPDATED = "June 2, 2026";

export default function CookiePolicy() {
  return (
    <main className="min-h-screen px-6 py-16" style={{ background: "var(--paper)" }}>
      <div className="fixed inset-0 bg-dot-grid -z-10" />
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <Link href="/" style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink2)", textDecoration: "none", display: "inline-block", marginBottom: 32 }}>
          ← PostItUp
        </Link>
        <div style={{ position: "relative" }}>
          <span className="tape tape-g" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 80, height: 20, borderRadius: 2, zIndex: 10 }} />
          <div className="sk" style={{ padding: "40px 36px", background: "white" }}>
            <div className="sk-b" />
            <div className="sk-i" style={{ fontFamily: "var(--font-kalam), serif", color: "var(--ink)" }}>
              <h1 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "2rem", marginBottom: 6 }}>Cookie Policy</h1>
              <p style={{ fontSize: "0.85rem", color: "var(--ink3)", marginBottom: 32 }}>Last updated: {LAST_UPDATED}</p>

              <p style={{ fontSize: "0.95rem", lineHeight: 1.8, color: "var(--ink2)", marginBottom: 28 }}>
                PostItUp uses only essential cookies and local storage. We do not use advertising, analytics, or tracking cookies.
              </p>

              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 28 }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid rgba(28,28,28,0.15)" }}>
                    {["Name", "Type", "Purpose", "Expires"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "0.88rem", color: "var(--ink)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "sb-*-auth-token", type: "Cookie (essential)", purpose: "Supabase authentication session", expires: "Session / sign out" },
                    { name: "piu_name",         type: "localStorage",       purpose: "Remembers your preferred author name", expires: "Until you clear it or delete account" },
                    { name: "piu_fp",           type: "localStorage",       purpose: "Random vote fingerprint to prevent duplicate upvotes — not linked to your identity", expires: "Until you clear it or delete account" },
                  ].map(row => (
                    <tr key={row.name} style={{ borderBottom: "1px dashed rgba(28,28,28,0.1)" }}>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "0.8rem", color: "var(--ink)" }}>{row.name}</td>
                      <td style={{ padding: "10px 12px", fontSize: "0.85rem", color: "var(--ink2)" }}>{row.type}</td>
                      <td style={{ padding: "10px 12px", fontSize: "0.85rem", color: "var(--ink2)" }}>{row.purpose}</td>
                      <td style={{ padding: "10px 12px", fontSize: "0.85rem", color: "var(--ink2)" }}>{row.expires}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p style={{ fontSize: "0.95rem", lineHeight: 1.8, color: "var(--ink2)", marginBottom: 16 }}>
                You can clear localStorage at any time in your browser settings or by deleting your account. Essential authentication cookies cannot be disabled without logging out.
              </p>
              <p style={{ fontSize: "0.95rem", lineHeight: 1.8, color: "var(--ink2)" }}>
                Questions? Email varshithvh@gmail.com
              </p>

              <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px dashed rgba(28,28,28,0.15)", display: "flex", gap: 20, flexWrap: "wrap" }}>
                <Link href="/legal/privacy" style={{ color: "var(--ink2)", textDecoration: "none", fontSize: "0.88rem" }}>Privacy Policy</Link>
                <Link href="/legal/terms"   style={{ color: "var(--ink2)", textDecoration: "none", fontSize: "0.88rem" }}>Terms of Service</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
