"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, User, ArrowRight } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) { setError("You must agree to the Terms of Service and Privacy Policy to continue."); return; }
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name } },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/dashboard");
  };

  const handleGithub = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo: `${location.origin}/auth/callback` } });
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--paper)" }}>
      <div className="fixed inset-0 bg-dot-grid -z-10" />
      <div style={{ position: "relative", maxWidth: 400, width: "100%" }}>
        <span className="tape tape-b" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 64, height: 18, borderRadius: 2, zIndex: 10 }} />
        <div className="sk" style={{ padding: "36px 32px", background: "white" }}>
          <div className="sk-b" />
          <div className="sk-i">
            <h1 style={{ fontFamily: "var(--font-sketch), var(--font-kalam), serif", fontSize: "1.8rem", color: "var(--ink)", marginBottom: 6 }}>Create account</h1>
            <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.95rem", color: "var(--ink2)", marginBottom: 28 }}>Start pinning ideas together</p>

            <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "Name", value: name, set: setName, type: "text", icon: User },
                { label: "Email", value: email, set: setEmail, type: "email", icon: Mail },
                { label: "Password", value: password, set: setPassword, type: "password", icon: Lock },
              ].map(({ label, value, set, type, icon: Icon }) => (
                <label key={label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem", color: "var(--ink3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
                  <div style={{ position: "relative" }}>
                    <Icon size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink3)" }} />
                    <input type={type} value={value} onChange={e => set(e.target.value)} required
                      style={{ width: "100%", padding: "9px 10px 9px 32px", border: "1.5px solid rgba(28,28,28,0.2)", background: "var(--paper)", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink)", outline: "none" }} />
                  </div>
                </label>
              ))}
              {/* Terms agreement */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => { setAgreed(e.target.checked); setError(""); }}
                  style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, cursor: "pointer", accentColor: "var(--ink)" }}
                />
                <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.88rem", color: "var(--ink2)", lineHeight: 1.5 }}>
                  I agree to the{" "}
                  <Link href="/legal/terms" target="_blank" style={{ color: "var(--ink)", fontWeight: 700, textDecoration: "none" }}>Terms of Service</Link>
                  {" "}and{" "}
                  <Link href="/legal/privacy" target="_blank" style={{ color: "var(--ink)", fontWeight: 700, textDecoration: "none" }}>Privacy Policy</Link>
                </span>
              </label>

              {error && <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "#ef4444" }}>{error}</p>}
              <button type="submit" disabled={loading || !agreed}
                style={{ padding: "11px", background: "var(--ink)", color: "white", border: "none", cursor: loading || !agreed ? "default" : "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", opacity: loading || !agreed ? 0.45 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {loading ? "Creating account…" : <><span>Create account</span><ArrowRight size={16} /></>}
              </button>
            </form>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(28,28,28,0.12)" }} />
              <span style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.85rem", color: "var(--ink3)" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "rgba(28,28,28,0.12)" }} />
            </div>

            <button onClick={handleGithub} className="sk"
              style={{ width: "100%", padding: "10px", background: "var(--sticky-b)", border: "none", cursor: "pointer", fontFamily: "var(--font-kalam), serif", fontSize: "1rem", color: "var(--ink)", position: "relative" }}>
              <div className="sk-b" />
              <span className="sk-i">Continue with GitHub</span>
            </button>
            <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.78rem", color: "var(--ink3)", marginTop: 8, textAlign: "center", lineHeight: 1.5 }}>
              By continuing with GitHub you agree to our{" "}
              <Link href="/legal/terms" target="_blank" style={{ color: "var(--ink2)", textDecoration: "underline" }}>Terms</Link>
              {" "}&amp;{" "}
              <Link href="/legal/privacy" target="_blank" style={{ color: "var(--ink2)", textDecoration: "underline" }}>Privacy Policy</Link>
            </p>

            <p style={{ fontFamily: "var(--font-kalam), serif", fontSize: "0.9rem", color: "var(--ink2)", marginTop: 20, textAlign: "center" }}>
              Have an account? <Link href="/auth/login" style={{ color: "var(--ink)", fontWeight: 700, textDecoration: "none" }}>Sign in →</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
