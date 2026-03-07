"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    void checkUser();
  }, []);

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setLoggedIn(true);
    }

    setLoading(false);
  }

  function handlePrimaryClick() {
    router.push(loggedIn ? "/dashboard" : "/signup");
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <h1 style={titleStyle}>ReSpawn</h1>
          <p style={subtitleStyle}>Loading...</p>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <p style={eyebrowStyle}>RESPAWN FIT APP</p>
        <h1 style={titleStyle}>Train smarter. Track workouts. Stay consistent.</h1>
        <p style={subtitleStyle}>
          ReSpawn uses AI to help athletes log workouts, track momentum, monitor progress,
          and build consistency over time with a clean, fast experience on desktop and phone.
        </p>

        <div style={buttonRowStyle}>
          <button onClick={handlePrimaryClick} style={primaryButtonStyle}>
            {loggedIn ? "Go to Dashboard" : "Create Account"}
          </button>

          {!loggedIn && (
            <Link href="/login" style={secondaryLinkStyle}>
              Log In
            </Link>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={gridStyle}>
          <div style={featureCardStyle}>
            <h2 style={featureTitleStyle}>Log workouts fast</h2>
            <p style={featureTextStyle}>
              Add exercises, enter sets, track reps and weight, and save completed sessions in seconds.
            </p>
          </div>

          <div style={featureCardStyle}>
            <h2 style={featureTitleStyle}>Track your momentum</h2>
            <p style={featureTextStyle}>
              See streaks, workout frequency, volume trends, and progress over time.
            </p>
          </div>

          <div style={featureCardStyle}>
            <h2 style={featureTitleStyle}>Built for Performance</h2>
            <p style={featureTextStyle}>
              Whether your goal is strength, hypertrophy, fat loss, or general fitness and consistency, ReSpawn keeps it simple.
            </p>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={bottomCardStyle}>
          <h2 style={bottomTitleStyle}>Use it anywhere</h2>
          <p style={bottomTextStyle}>
            ReSpawn is web-based, so users can open it on laptop, tablet, or phone browser without downloading anything.
          </p>
        </div>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #050505 0%, #0b0b0b 45%, #101010 100%)",
  color: "white",
  fontFamily: "sans-serif",
  padding: "24px 20px 80px",
};

const heroCardStyle: CSSProperties = {
  maxWidth: "980px",
  margin: "0 auto 20px",
  background:
    "linear-gradient(135deg, rgba(255,26,26,0.14) 0%, rgba(18,18,18,1) 55%, rgba(10,10,10,1) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "24px",
  padding: "32px 24px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
};

const eyebrowStyle: CSSProperties = {
  color: "#ff6b6b",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.14em",
  margin: "0 0 12px",
};

const titleStyle: CSSProperties = {
  fontSize: "42px",
  lineHeight: 1.05,
  fontWeight: 900,
  margin: "0 0 14px",
};

const subtitleStyle: CSSProperties = {
  color: "#d0d0d0",
  fontSize: "17px",
  lineHeight: 1.6,
  maxWidth: "720px",
  margin: 0,
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  marginTop: "24px",
};

const primaryButtonStyle: CSSProperties = {
  backgroundColor: "#ff1a1a",
  border: "none",
  padding: "14px 18px",
  borderRadius: "12px",
  color: "white",
  fontWeight: 800,
  fontSize: "15px",
  cursor: "pointer",
};

const secondaryLinkStyle: CSSProperties = {
  backgroundColor: "#1c1c1c",
  border: "1px solid #333",
  padding: "14px 18px",
  borderRadius: "12px",
  color: "white",
  textDecoration: "none",
  fontWeight: 800,
  fontSize: "15px",
};

const sectionStyle: CSSProperties = {
  maxWidth: "980px",
  margin: "0 auto 20px",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "14px",
};

const featureCardStyle: CSSProperties = {
  background: "#121212",
  border: "1px solid #222",
  borderRadius: "20px",
  padding: "20px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
};

const featureTitleStyle: CSSProperties = {
  color: "#ff4d4d",
  fontSize: "18px",
  fontWeight: 800,
  margin: "0 0 10px",
};

const featureTextStyle: CSSProperties = {
  color: "#c8c8c8",
  fontSize: "14px",
  lineHeight: 1.6,
  margin: 0,
};

const bottomCardStyle: CSSProperties = {
  background: "#121212",
  border: "1px solid #222",
  borderRadius: "20px",
  padding: "22px",
};

const bottomTitleStyle: CSSProperties = {
  color: "#fff",
  fontSize: "22px",
  fontWeight: 900,
  margin: "0 0 10px",
};

const bottomTextStyle: CSSProperties = {
  color: "#c8c8c8",
  fontSize: "15px",
  lineHeight: 1.6,
  margin: 0,
};