"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

const navItems = [
  { label: "AI Coach", href: "/dashboard" },
  { label: "Build", href: "/Today" },
  { label: "Track", href: "/Workout" },
  { label: "Progress", href: "/Progress" },
  { label: "Nutrition", href: "/Nutrition" },
  { label: "Profile", href: "/Profile" },
];

const PUBLIC_PATHS = ["/", "/login", "/signup"];

export default function TopNav() {
  const pathname = usePathname();
  const [isAuthed, setIsAuthed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    void checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(Boolean(session?.user));
      setCheckingAuth(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkAuth() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setIsAuthed(Boolean(user));
    setCheckingAuth(false);
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    return null;
  }

  if (checkingAuth || !isAuthed) {
    return null;
  }

  return (
    <nav style={navStyle}>
      <div style={navInnerStyle}>
        <div style={logoStyle}>ReSpawn</div>

        <div style={linksWrapStyle}>
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

const navStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  width: "100%",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  background: "rgba(10,10,10,0.85)",
  borderBottom: "1px solid #222",
  zIndex: 100,
};

const navInnerStyle: CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 20px",
  gap: "16px",
  flexWrap: "wrap",
};

const logoStyle: CSSProperties = {
  fontWeight: 900,
  fontSize: "18px",
  color: "#ff1a1a",
};

const linksWrapStyle: CSSProperties = {
  display: "flex",
  gap: "18px",
  flexWrap: "wrap",
};

const linkStyle: CSSProperties = {
  textDecoration: "none",
  color: "#ddd",
  fontWeight: 600,
  fontSize: "15px",
};

const activeStyle: CSSProperties = {
  color: "#ff1a1a",
};