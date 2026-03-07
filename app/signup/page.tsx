"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("");

    if (password !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setStatus("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      setStatus("Account created. You can now log in.");
    } else {
      setStatus("Check your email to confirm your account, then log in.");
    }

    setLoading(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <p style={eyebrowStyle}>RESPAWN</p>
        <h1 style={titleStyle}>Create account</h1>
        <p style={subStyle}>
          Set up your account so your workouts and profile stay tied to you.
        </p>

        <form onSubmit={handleSignup} style={formStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Email</span>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              required
              autoComplete="email"
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Password</span>
            <input
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              required
              autoComplete="new-password"
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Confirm password</span>
            <input
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
              required
              autoComplete="new-password"
            />
          </label>

          <button type="submit" style={primaryButtonStyle} disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        {status ? <p style={statusStyle}>{status}</p> : null}

        <div style={footerRowStyle}>
          <span style={footerTextStyle}>Already have an account?</span>
          <Link href="/login" style={linkStyle}>
            Log in
          </Link>
        </div>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "24px",
  background: "linear-gradient(180deg, #050505 0%, #0b0b0b 45%, #101010 100%)",
  color: "white",
  fontFamily: "sans-serif",
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "460px",
  background:
    "linear-gradient(135deg, rgba(255,26,26,0.14) 0%, rgba(18,18,18,1) 55%, rgba(10,10,10,1) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "24px",
  padding: "28px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
};

const eyebrowStyle: CSSProperties = {
  color: "#ff6b6b",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.14em",
  margin: "0 0 10px",
};

const titleStyle: CSSProperties = {
  fontSize: "34px",
  lineHeight: 1.05,
  fontWeight: 900,
  margin: "0 0 10px",
};

const subStyle: CSSProperties = {
  color: "#cfcfcf",
  fontSize: "15px",
  lineHeight: 1.5,
  margin: "0 0 22px",
};

const formStyle: CSSProperties = {
  display: "grid",
  gap: "14px",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "6px",
};

const labelStyle: CSSProperties = {
  color: "#ff8b8b",
  fontSize: "13px",
  fontWeight: 700,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "14px 12px",
  borderRadius: "12px",
  border: "1px solid #2a2a2a",
  backgroundColor: "#171717",
  color: "white",
  fontSize: "15px",
};

const primaryButtonStyle: CSSProperties = {
  marginTop: "6px",
  backgroundColor: "#ff1a1a",
  border: "none",
  padding: "14px 18px",
  borderRadius: "12px",
  color: "white",
  fontWeight: 800,
  fontSize: "15px",
  cursor: "pointer",
};

const statusStyle: CSSProperties = {
  marginTop: "16px",
  color: "#d6d6d6",
  fontSize: "14px",
};

const footerRowStyle: CSSProperties = {
  marginTop: "18px",
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  alignItems: "center",
};

const footerTextStyle: CSSProperties = {
  color: "#9f9f9f",
  fontSize: "14px",
};

const linkStyle: CSSProperties = {
  color: "#ff6b6b",
  fontWeight: 700,
  textDecoration: "none",
};