"use client";

import type { CSSProperties } from "react";

type Props = {
  onClose: () => void;
};

export default function UpdateModal({ onClose }: Props) {
  function handleClose() {
    localStorage.setItem("respawn-update-dismissed", "true");
    onClose();
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2>Workout Page Updated</h2>
        <p>
          We made improvements to the workout experience. Refresh your browser
          to ensure everything loads correctly.
        </p>

        <div style={{ marginTop: 20 }}>
          <button onClick={() => window.location.reload()}>
            Refresh Now
          </button>

          <button onClick={handleClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.75)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9999,
};

const modal: CSSProperties = {
  background: "#111",
  padding: 24,
  borderRadius: 16,
  maxWidth: 420,
  color: "white",
};