"use client";

import WorkoutGenerator from "@/components/WorkoutGenerator";

export default function TodayPage() {
  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <p style={eyebrowStyle}>RESPAWN TODAY</p>
        <h1 style={heroTitleStyle}>Build Today’s Workout</h1>
        <p style={heroSubStyle}>
          Generate a session based on your training goal, experience, and equipment.
        </p>
      </section>

      <WorkoutGenerator />
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #050505 0%, #0a0a0a 35%, #0f0f0f 100%)",
  color: "white",
  padding: "28px 20px 120px",
  fontFamily: "sans-serif",
};

const heroCardStyle: React.CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(255,26,26,0.16) 0%, rgba(18,18,18,1) 55%, rgba(10,10,10,1) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "24px",
  padding: "24px",
  marginBottom: "18px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#ff6b6b",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.14em",
  margin: "0 0 10px",
};

const heroTitleStyle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "30px",
  lineHeight: 1.1,
  fontWeight: 800,
  margin: "0 0 8px",
};

const heroSubStyle: React.CSSProperties = {
  color: "#d0d0d0",
  fontSize: "15px",
  margin: 0,
};