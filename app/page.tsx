import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#0a0a0a",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "56px", color: "#ff1a1a", marginBottom: "20px" }}>
          ReSpawn
        </h1>

        <p style={{ color: "#cccccc", fontSize: "18px", maxWidth: "400px" }}>
          Track workouts, burn fat, build strength, and level up your progress.
        </p>

        <Link
          href="/dashboard"
          style={{
            display: "inline-block",
            marginTop: "40px",
            backgroundColor: "#ff1a1a",
            color: "white",
            padding: "14px 28px",
            borderRadius: "8px",
            textDecoration: "none",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          Get Started
        </Link>
      </div>
    </main>
  );
}