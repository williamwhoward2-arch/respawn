import Link from "next/link";

export default function BottomNav() {
  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#111111",
        borderTop: "1px solid #222222",
        display: "flex",
        justifyContent: "space-around",
        padding: "14px 10px",
        zIndex: 1000,
      }}
    >
      <Link href="/dashboard" style={linkStyle}>
        Dashboard
      </Link>
      <Link href="/Progress" style={linkStyle}>
        Progress
      </Link>
      <Link href="/Today" style={linkStyle}>
        Today
      </Link>
      <Link href="/Workout" style={linkStyle}>
        Workout
      </Link>
      <Link href="/Profile" style={linkStyle}>
        Profile
      </Link>
    </nav>
  );
}

const linkStyle = {
  color: "white",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: 600,
};