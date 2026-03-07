"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    void initializeLoginPage();
  }, []);

  async function initializeLoginPage() {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);

      if (params.get("created") === "true") {
        setStatus("Account created successfully. Please sign in.");
      }
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      const message = error.message || "";

      if (message.includes("Invalid Refresh Token")) {
        await supabase.auth.signOut();
        setCheckingSession(false);
        return;
      }

      setStatus(message);
      setCheckingSession(false);
      return;
    }

    if (!user) {
      setCheckingSession(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      setStatus(profileError.message);
      setCheckingSession(false);
      return;
    }

    router.replace(profile ? "/dashboard" : "/Profile?onboarding=true");
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setStatus("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;

    if (!userId) {
      setStatus("Logged in, but no user ID was found.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      setStatus(profileError.message);
      setLoading(false);
      return;
    }

    router.push(profile ? "/dashboard" : "/Profile?onboarding=true");
  }

  if (checkingSession) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <p style={eyebrowStyle}>RESPAWN</p>
          <h1 style={titleStyle}>Checking session...</h1>
          <p style={subStyle}>
            Making sure you go to the right place.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <p style={eyebrowStyle}>RESPAWN</p>
        <h1 style={titleStyle}>Log in</h1>
        <p style={subStyle}>
          Sign in to access your workouts, profile, dashboard, and progress.
        </p>

        <form onSubmit={handleLogin} style={formStyle}>
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
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              required
              autoComplete="current-password"
            />
          </label>

          <button type="submit" style={primaryButtonStyle} disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        {status ? <p style={statusStyle}>{status}</p> : null}

        <div style={footerRowStyle}>
          <span style={footerTextStyle}>Need an account?</span>
          <Link href="/signup" style={linkStyle}>
            Create one
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