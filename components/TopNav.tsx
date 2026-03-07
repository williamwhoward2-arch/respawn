"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TopNav() {
  const pathname = usePathname();
  const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Today", href: "/Today" },
  { label: "Workout", href: "/Workout" },
  { label: "Progress", href: "/Progress" },
  { label: "Profile", href: "/Profile" },
];

  return (
    <nav style={navStyle}>
      <div style={navInner}>
        <div style={logoStyle}>ReSpawn</div>

        <div style={linksWrap}>
          {navItems.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  ...linkStyle,
                  ...(active ? activeStyle : {}),
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

const navStyle = {
  position: "sticky",
  top: 0,
  width: "100%",
  backdropFilter: "blur(12px)",
  background: "rgba(10,10,10,0.85)",
  borderBottom: "1px solid #222",
  zIndex: 100,
};

const navInner = {
  maxWidth: "1100px",
  margin: "0 auto",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 20px",
};

const logoStyle = {
  fontWeight: 900,
  fontSize: "18px",
  color: "#ff1a1a",
};

const linksWrap = {
  display: "flex",
  gap: "18px",
};

const linkStyle = {
  textDecoration: "none",
  color: "#ddd",
  fontWeight: 600,
};

const activeStyle = {
  color: "#ff1a1a",
};