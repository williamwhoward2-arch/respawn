"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import WorkoutGenerator from "@/components/WorkoutGenerator";
import { supabase } from "@/lib/supabaseClient";

type AuthUser = {
  id: string;
  email?: string;
};

export default function TodayPage() {
  const router = useRouter();

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [restDayNote, setRestDayNote] = useState("");
  const [status, setStatus] = useState("");
  const [savingRestDay, setSavingRestDay] = useState(false);

  useEffect(() => {
    void initializeTodayPage();
  }, []);

  async function initializeTodayPage() {
    setLoading(true);
    setStatus("Checking account...");

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      const message = error.message || "";

      if (message.includes("Invalid Refresh Token")) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      setStatus(`Error: ${message}`);
      setLoading(false);
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    setAuthUser({
      id: user.id,
      email: user.email,
    });

    setStatus("");
    setLoading(false);
  }

  async function logRestDay() {
    if (!authUser?.id) {
      setStatus("You must be signed in to log a rest day.");
      return;
    }

    setSavingRestDay(true);
    setStatus("Logging rest day...");

    const { error } = await supabase.from("workouts").insert([
      {
        user_id: authUser.id,
        workout_name: "Rest Day",
        duration_seconds: 0,
        day_type: "rest",
        notes: restDayNote.trim() || null,
      },
    ]);

    if (error) {
      console.error("Rest day save error:", error);
      setStatus(`Error saving rest day: ${error.message}`);
      setSavingRestDay(false);
      return;
    }

    setRestDayNote("");
    setStatus("Rest day logged.");
    setSavingRestDay(false);
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <p style={eyebrowStyle}>RESPAWN TODAY</p>
          <h1 style={heroTitleStyle}>Loading today...</h1>
          <p style={heroSubStyle}>Checking your account and preparing your training options.</p>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <p style={eyebrowStyle}>RESPAWN TODAY</p>
        <h1 style={heroTitleStyle}>Choose Today’s Path</h1>
        <p style={heroSubStyle}>
          Generate a workout when you are training, or log a rest day when recovery
          is the move.
        </p>

        <div style={accountBarStyle}>
          <div style={accountInfoStyle}>
            <span style={accountLabelStyle}>Signed in as</span>
            <span style={accountValueStyle}>{authUser?.email || authUser?.id}</span>
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Train Today</h2>
        </div>
        <p style={sectionSubStyle}>
          Build a session based on your goal, experience, and equipment.
        </p>

        <div style={{ marginTop: 16 }}>
          <WorkoutGenerator />
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Log Rest Day</h2>
        </div>
        <p style={sectionSubStyle}>
          Save today as a recovery day so your app tracks consistency more honestly.
        </p>

        <textarea
          value={restDayNote}
          onChange={(e) => setRestDayNote(e.target.value)}
          placeholder="Optional note: sore, travel, active recovery, poor sleep, etc."
          style={textAreaStyle}
          rows={4}
        />

        <div style={restButtonRowStyle}>
          <button
            onClick={logRestDay}
            disabled={savingRestDay}
            style={savingRestDay ? disabledButtonStyle : secondaryButtonStyle}
          >
            {savingRestDay ? "Logging..." : "Log Rest Day"}
          </button>
        </div>

        {status ? <p style={statusStyle}>{status}</p> : null}
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #050505 0%, #0a0a0a 35%, #0f0f0f 100%)",
  color: "white",
  padding: "28px 20px 120px",
  fontFamily: "sans-serif",
};

const heroCardStyle: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(255,26,26,0.16) 0%, rgba(18,18,18,1) 55%, rgba(10,10,10,1) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "24px",
  padding: "24px",
  marginBottom: "18px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
};

const eyebrowStyle: CSSProperties = {
  color: "#ff6b6b",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.14em",
  margin: "0 0 10px",
};

const heroTitleStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "30px",
  lineHeight: 1.1,
  fontWeight: 800,
  margin: "0 0 8px",
};

const heroSubStyle: CSSProperties = {
  color: "#d0d0d0",
  fontSize: "15px",
  margin: 0,
};

const accountBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginTop: "18px",
  flexWrap: "wrap",
};

const accountInfoStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const accountLabelStyle: CSSProperties = {
  color: "#aaa",
  fontSize: "12px",
};

const accountValueStyle: CSSProperties = {
  color: "#fff",
  fontSize: "14px",
  fontWeight: 700,
};

const cardStyle: CSSProperties = {
  background: "#121212",
  border: "1px solid #222",
  borderRadius: "22px",
  padding: "20px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  marginBottom: "16px",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "10px",
};

const sectionTitle: CSSProperties = {
  color: "#ff4d4d",
  margin: 0,
  fontSize: "20px",
  fontWeight: 800,
};

const sectionSubStyle: CSSProperties = {
  color: "#b8b8b8",
  fontSize: "14px",
  lineHeight: 1.5,
  margin: 0,
};

const textAreaStyle: CSSProperties = {
  width: "100%",
  marginTop: "16px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #2a2a2a",
  backgroundColor: "#1c1c1c",
  color: "white",
  resize: "vertical",
  fontFamily: "sans-serif",
  fontSize: "14px",
  boxSizing: "border-box",
};

const restButtonRowStyle: CSSProperties = {
  display: "flex",
  gap: "10px",
  marginTop: "14px",
  flexWrap: "wrap",
};

const secondaryButtonStyle: CSSProperties = {
  backgroundColor: "#2a2a2a",
  border: "1px solid #3a3a3a",
  padding: "12px 18px",
  borderRadius: "10px",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const disabledButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  opacity: 0.6,
  cursor: "not-allowed",
};

const statusStyle: CSSProperties = {
  color: "#d0d0d0",
  marginTop: "12px",
  marginBottom: 0,
  fontSize: "14px",
};