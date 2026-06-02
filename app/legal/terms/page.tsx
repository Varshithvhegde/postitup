import Link from "next/link";

export const metadata = { title: "Terms of Service — PostItUp" };
const LAST_UPDATED = "June 2, 2026";

export default function Terms() {
  return (
    <main className="min-h-screen px-6 py-16" style={{ background: "var(--paper)" }}>
      <div className="fixed inset-0 bg-dot-grid -z-10" />
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <Link href="/" style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink2)", textDecoration: "none", display: "inline-block", marginBottom: 32 }}>
          ← PostItUp
        </Link>
        <div style={{ position: "relative" }}>
          <span className="tape tape-b" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 80, height: 20, borderRadius: 2, zIndex: 10 }} />
          <div className="sk" style={{ padding: "40px 36px", background: "white" }}>
            <div className="sk-b" />
            <div className="sk-i" style={{ fontFamily: "var(--font-kalam), serif", color: "var(--ink)" }}>
              <h1 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "2rem", marginBottom: 6 }}>Terms of Service</h1>
              <p style={{ fontSize: "0.85rem", color: "var(--ink3)", marginBottom: 32 }}>Last updated: {LAST_UPDATED}</p>

              {[
                { title: "1. Acceptance", body: "By using PostItUp you agree to these terms. If you disagree, please do not use the service." },
                { title: "2. The service", body: "PostItUp provides a collaborative sticky note board tool. We reserve the right to modify, suspend, or discontinue the service at any time with reasonable notice." },
                { title: "3. Your account", body: "You are responsible for maintaining the security of your account and all activity under it. You must be at least 13 years old to create an account." },
                { title: "4. Acceptable use", body: `You agree NOT to:
• Post illegal, harmful, harassing, or abusive content
• Spam or flood boards with meaningless content
• Attempt to access other users' private boards or data
• Use the service to scrape or harvest data
• Attempt to reverse-engineer or attack the service` },
                { title: "5. Your content", body: "You retain ownership of content you post. By posting, you grant PostItUp a licence to store and display that content to operate the service. You can delete your content at any time." },
                { title: "6. Moderation", body: "Board owners can delete any note on their board. We reserve the right to remove content that violates these terms." },
                { title: "7. Availability", body: "We provide the service 'as is' without warranty. We are not liable for data loss or downtime. For important data, use the data export feature." },
                { title: "8. Termination", body: "You can delete your account at any time from the Account page. We may terminate accounts that violate these terms." },
                { title: "9. Contact", body: "Questions? Email varshithvh@gmail.com" },
              ].map(({ title, body }) => (
                <div key={title} style={{ marginBottom: 28 }}>
                  <h2 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.1rem", marginBottom: 8 }}>{title}</h2>
                  <p style={{ fontSize: "0.95rem", lineHeight: 1.8, color: "var(--ink2)", whiteSpace: "pre-line" }}>{body}</p>
                </div>
              ))}

              <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px dashed rgba(28,28,28,0.15)", display: "flex", gap: 20, flexWrap: "wrap" }}>
                <Link href="/legal/privacy" style={{ color: "var(--ink2)", textDecoration: "none", fontSize: "0.88rem" }}>Privacy Policy</Link>
                <Link href="/legal/cookies" style={{ color: "var(--ink2)", textDecoration: "none", fontSize: "0.88rem" }}>Cookie Policy</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
