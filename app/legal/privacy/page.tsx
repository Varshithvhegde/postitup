import Link from "next/link";

export const metadata = { title: "Privacy Policy — PostItUp" };

const LAST_UPDATED = "June 2, 2026";

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen px-6 py-16" style={{ background: "var(--paper)" }}>
      <div className="fixed inset-0 bg-dot-grid -z-10" />
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <Link href="/" style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink2)", textDecoration: "none", display: "inline-block", marginBottom: 32 }}>
          ← PostItUp
        </Link>

        <div style={{ position: "relative" }}>
          <span className="tape tape-y" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 80, height: 20, borderRadius: 2, zIndex: 10 }} />
          <div className="sk" style={{ padding: "40px 36px", background: "white" }}>
            <div className="sk-b" />
            <div className="sk-i" style={{ fontFamily: "var(--font-kalam), serif", color: "var(--ink)" }}>
              <h1 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "2rem", marginBottom: 6 }}>Privacy Policy</h1>
              <p style={{ fontSize: "0.85rem", color: "var(--ink3)", marginBottom: 32 }}>Last updated: {LAST_UPDATED}</p>

              {[
                {
                  title: "1. Who we are",
                  body: "PostItUp is a collaborative sticky note board application. We are not a large corporation — this is a personal project. Contact: varshithvh@gmail.com",
                },
                {
                  title: "2. What data we collect",
                  body: `When you create an account we collect:
• Email address (required for authentication)
• Display name (derived from your email, editable)
• Boards you create: title, description, prompt, settings
• Notes you post: content, color, position, author name
• Vote fingerprint: a random string stored in localStorage to prevent duplicate votes — it is NOT linked to your identity

When you use the app without an account (anonymous):
• Author name you type (stored in your browser's localStorage only)
• Vote fingerprint (localStorage only — never sent to our server linked to you personally)`,
                },
                {
                  title: "3. How we use your data",
                  body: `• To provide the PostItUp service
• To display your boards and notes
• To attribute notes to your account when you are signed in
• We do NOT sell your data
• We do NOT use your data for advertising
• We do NOT share your data with third parties except Supabase (our database infrastructure provider)`,
                },
                {
                  title: "4. Data storage",
                  body: "Your data is stored in Supabase, hosted on AWS infrastructure in the ap-south-1 (Mumbai, India) region. Data is encrypted at rest and in transit.",
                },
                {
                  title: "5. Your rights (GDPR / DPDP)",
                  body: `You have the right to:
• Access your data — download a full JSON export from your Account page
• Correct your data — edit your display name from your Account page
• Delete your data — delete your account and all associated data from your Account page. Notes you posted on other boards will be anonymised.
• Withdraw consent — you can delete your account at any time
• Lodge a complaint with your supervisory authority

To exercise any of these rights, visit your Account page or email us at varshithvh@gmail.com.`,
                },
                {
                  title: "6. Cookies & local storage",
                  body: `We use:
• Supabase session cookies (essential) — required for authentication, expire when you sign out
• localStorage: "piu_name" — your preferred author name (cleared when you delete your account)
• localStorage: "piu_fp" — a random vote fingerprint (cleared when you delete your account)

We do not use tracking cookies, analytics cookies, or advertising cookies.`,
                },
                {
                  title: "7. Data retention",
                  body: "We keep your data as long as your account exists. When you delete your account, all your data is permanently deleted immediately. Anonymised contributions (notes on other boards) retain only the text content with no link to your identity.",
                },
                {
                  title: "8. Children's privacy",
                  body: "PostItUp is not directed at children under 13. We do not knowingly collect data from children.",
                },
                {
                  title: "9. Changes to this policy",
                  body: "We may update this policy. We will update the 'Last updated' date at the top. Continued use after changes constitutes acceptance.",
                },
                {
                  title: "10. Contact",
                  body: "Questions about this policy? Email varshithvh@gmail.com",
                },
              ].map(({ title, body }) => (
                <div key={title} style={{ marginBottom: 28 }}>
                  <h2 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.1rem", marginBottom: 8, color: "var(--ink)" }}>{title}</h2>
                  <p style={{ fontSize: "0.95rem", lineHeight: 1.8, color: "var(--ink2)", whiteSpace: "pre-line" }}>{body}</p>
                </div>
              ))}

              <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px dashed rgba(28,28,28,0.15)", display: "flex", gap: 20, flexWrap: "wrap" }}>
                <Link href="/legal/terms"   style={{ color: "var(--ink2)", textDecoration: "none", fontSize: "0.88rem" }}>Terms of Service</Link>
                <Link href="/legal/cookies" style={{ color: "var(--ink2)", textDecoration: "none", fontSize: "0.88rem" }}>Cookie Policy</Link>
                <Link href="/account"       style={{ color: "var(--ink2)", textDecoration: "none", fontSize: "0.88rem" }}>Manage my data</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
