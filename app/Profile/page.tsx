"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  id: number;
  user_id: string | null;
  name: string | null;
  sex: string | null;
  height: string | null;
  bodyweight: string | null;
  waist: string | null;
  goal: string | null;
  focus: string | null;
  experience_level: string | null;
  equipment_access: string | null;
  age?: number | null;
};

type AuthUser = {
  id: string;
  email?: string;
};

export default function ProfilePage() {
  const router = useRouter();

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [sex, setSex] = useState("");
  const [height, setHeight] = useState("");
  const [bodyweight, setBodyweight] = useState("");
  const [waist, setWaist] = useState("");
  const [goal, setGoal] = useState("");
  const [focus, setFocus] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [equipmentAccess, setEquipmentAccess] = useState("");

  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    void initializeProfilePage();
  }, []);

  async function initializeProfilePage() {
    setLoading(true);
    setStatus("Checking account...");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Get user error:", userError);
      setStatus(`Error: ${userError.message}`);
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

    await loadUserProfile(user.id);
    setLoading(false);
  }

  async function loadUserProfile(userId?: string) {
    const activeUserId = userId || authUser?.id;

    if (!activeUserId) {
      setStatus("No signed-in user found.");
      return;
    }

    setStatus("Loading your profile...");

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", activeUserId)
      .maybeSingle();

    if (error) {
      console.error("Load profile error:", error);
      setStatus(`Error: ${error.message}`);
      return;
    }

    const profile = data as ProfileRow | null;

    if (profile) {
      setProfileId(profile.id);
      setName(profile.name || "");
      setSex(profile.sex || "");
      setHeight(profile.height || "");
      setBodyweight(profile.bodyweight || "");
      setWaist(profile.waist || "");
      setGoal(profile.goal || "");
      setFocus(profile.focus || "");
      setExperienceLevel(profile.experience_level || "");
      setEquipmentAccess(profile.equipment_access || "");
      setSaved(true);
      setStatus("Your profile loaded.");
    } else {
      resetFormState();
      setStatus("No profile found for this account. Create one below.");
    }
  }

  function resetFormState() {
    setProfileId(null);
    setName("");
    setSex("");
    setHeight("");
    setBodyweight("");
    setWaist("");
    setGoal("");
    setFocus("");
    setExperienceLevel("");
    setEquipmentAccess("");
    setSaved(false);
  }

  function clearFormOnly() {
    resetFormState();
    setStatus("Form cleared. Your saved profile is still in Supabase until you save again.");
  }

  async function saveProfile() {
    if (!authUser?.id) {
      setStatus("You must be signed in to save your profile.");
      return;
    }

    setStatus(profileId ? "Updating your profile..." : "Saving your profile...");
    setSaved(false);

    const payload = {
      user_id: authUser.id,
      name: name || null,
      sex: sex || null,
      height: height || null,
      bodyweight: bodyweight || null,
      waist: waist || null,
      goal: goal || null,
      focus: focus || null,
      experience_level: experienceLevel || null,
      equipment_access: equipmentAccess || null,
    };

    if (profileId) {
      const { data, error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", profileId)
        .eq("user_id", authUser.id)
        .select()
        .single();

      if (error) {
        console.error("Update profile error:", error);
        setStatus(`Error: ${error.message}`);
        return;
      }

      const updated = data as ProfileRow;
      setProfileId(updated.id);
      setSaved(true);
      setStatus("Profile updated successfully.");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Insert profile error:", error);
      setStatus(`Error: ${error.message}`);
      return;
    }

    const inserted = data as ProfileRow;
    setProfileId(inserted.id);
    setSaved(true);
    setStatus("Profile saved successfully.");
  }

  async function handleResetAccount() {
    if (!authUser?.id) {
      setStatus("You must be signed in to reset your account.");
      return;
    }

    const confirmed = window.confirm(
      "This will permanently delete only your profile, workouts, workout sets, and local app data on this device. Do you want to continue?"
    );

    if (!confirmed) return;

    setResetting(true);
    setStatus("Resetting your account...");

    try {
      const { error: setsError } = await supabase
        .from("workout_sets")
        .delete()
        .eq("user_id", authUser.id);

      if (setsError) {
        setStatus(`Error clearing workout sets: ${setsError.message}`);
        setResetting(false);
        return;
      }

      const { error: workoutsError } = await supabase
        .from("workouts")
        .delete()
        .eq("user_id", authUser.id);

      if (workoutsError) {
        setStatus(`Error clearing workouts: ${workoutsError.message}`);
        setResetting(false);
        return;
      }

      const { error: profilesError } = await supabase
        .from("profiles")
        .delete()
        .eq("user_id", authUser.id);

      if (profilesError) {
        setStatus(`Error clearing profile: ${profilesError.message}`);
        setResetting(false);
        return;
      }

      localStorage.removeItem("respawn_recent_exercises");
      localStorage.removeItem("respawn_favorite_exercises");
      localStorage.removeItem("respawn_generated_workout");

      resetFormState();
      setStatus("Your account data was reset successfully.");
      setResetting(false);
      window.location.reload();
    } catch (error) {
      console.error("Reset account failed:", error);
      setStatus("Something went wrong while resetting your account.");
      setResetting(false);
    }
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setStatus(`Error signing out: ${error.message}`);
      return;
    }

    router.replace("/login");
  }

  function testSupabaseConnection() {
    console.log("Supabase client:", supabase);
    console.log("Current auth user:", authUser);
    alert("Supabase client loaded. Check browser console.");
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <p style={eyebrowStyle}>RESPAWN PROFILE</p>
          <h1 style={heroTitleStyle}>Loading your profile...</h1>
          <p style={heroSubStyle}>Pulling your current account and profile settings.</p>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <p style={eyebrowStyle}>RESPAWN PROFILE</p>
        <h1 style={heroTitleStyle}>
          {name ? `${name}'s Profile` : "Build Your Profile"}
        </h1>
        <p style={heroSubStyle}>
          Update your stats, goal, experience, and available equipment without losing your progress history.
        </p>

        <div style={heroStatsRow}>
          <div style={heroStatBox}>
            <div style={heroStatLabel}>Goal</div>
            <div style={heroStatValueSmall}>{goal || "--"}</div>
          </div>
          <div style={heroStatBox}>
            <div style={heroStatLabel}>Experience</div>
            <div style={heroStatValueSmall}>{experienceLevel || "--"}</div>
          </div>
          <div style={heroStatBox}>
            <div style={heroStatLabel}>Equipment</div>
            <div style={heroStatValueSmall}>
              {formatEquipmentLabel(equipmentAccess) || "--"}
            </div>
          </div>
        </div>

        <div style={accountBarStyle}>
          <div style={accountInfoStyle}>
            <span style={accountLabelStyle}>Signed in as</span>
            <span style={accountValueStyle}>{authUser?.email || authUser?.id || "Not signed in"}</span>
          </div>

          <button onClick={handleSignOut} style={secondaryButtonStyle}>
            Sign Out
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Profile Details</h2>
        </div>

        <div style={formGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Name</span>
            <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Sex</span>
            <select value={sex} onChange={(e) => setSex(e.target.value)} style={inputStyle}>
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Height</span>
            <input
              placeholder="Example: 5'10 or 178 cm"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Bodyweight</span>
            <input
              placeholder="Example: 205"
              value={bodyweight}
              onChange={(e) => setBodyweight(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Waist (optional)</span>
            <input
              placeholder="Example: 36"
              value={waist}
              onChange={(e) => setWaist(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Goal</span>
            <select value={goal} onChange={(e) => setGoal(e.target.value)} style={inputStyle}>
              <option value="">Select</option>
              <option value="Get stronger">Get stronger</option>
              <option value="Build muscle">Build muscle</option>
              <option value="Burn fat">Burn fat</option>
              <option value="General fitness">General fitness</option>
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Training focus</span>
            <select value={focus} onChange={(e) => setFocus(e.target.value)} style={inputStyle}>
              <option value="">Select</option>
              <option value="Balanced">Balanced</option>
              <option value="Lower body focus">Lower body focus</option>
              <option value="Upper body focus">Upper body focus</option>
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Experience level</span>
            <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)} style={inputStyle}>
              <option value="">Select</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Equipment access</span>
            <select value={equipmentAccess} onChange={(e) => setEquipmentAccess(e.target.value)} style={inputStyle}>
              <option value="">Select</option>
              <option value="full_gym">Full gym</option>
              <option value="dumbbells_only">Dumbbells only</option>
              <option value="barbell_rack">Barbell + rack</option>
              <option value="machines_only">Machines only</option>
              <option value="bodyweight_only">Bodyweight only</option>
              <option value="minimal_home_gym">Minimal home gym</option>
            </select>
          </label>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Actions</h2>
        </div>

        <div style={actionGridStyle}>
          <button onClick={saveProfile} style={primaryButtonStyle}>
            {profileId ? "Update Profile" : "Save Profile"}
          </button>

          <button onClick={clearFormOnly} style={secondaryButtonStyle}>
            Clear Form Only
          </button>

          <button onClick={() => loadUserProfile()} style={secondaryButtonStyle}>
            Reload My Profile
          </button>

          <button onClick={testSupabaseConnection} style={secondaryButtonStyle}>
            Test Supabase
          </button>
        </div>
      </section>

      <section style={dangerCardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={dangerSectionTitle}>Danger Zone</h2>
        </div>

        <p style={dangerTextStyle}>
          Resetting your account will permanently delete your saved profile, workouts,
          completed sets, and local app data so you can start fresh.
        </p>

        <button onClick={handleResetAccount} style={resetButtonStyle} disabled={resetting}>
          {resetting ? "Resetting Account..." : "Reset Account"}
        </button>
      </section>

      {status && <p style={statusStyle}>{status}</p>}

      {saved && (
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Current Profile</h2>
          </div>

          <div style={summaryGridStyle}>
            <div style={summaryCardStyle}>
              <span style={summaryLabelStyle}>Name</span>
              <span style={summaryValueStyle}>{name || "--"}</span>
            </div>
            <div style={summaryCardStyle}>
              <span style={summaryLabelStyle}>Goal</span>
              <span style={summaryValueStyle}>{goal || "--"}</span>
            </div>
            <div style={summaryCardStyle}>
              <span style={summaryLabelStyle}>Focus</span>
              <span style={summaryValueStyle}>{focus || "--"}</span>
            </div>
            <div style={summaryCardStyle}>
              <span style={summaryLabelStyle}>Experience</span>
              <span style={summaryValueStyle}>{experienceLevel || "--"}</span>
            </div>
            <div style={summaryCardStyle}>
              <span style={summaryLabelStyle}>Equipment</span>
              <span style={summaryValueStyle}>{formatEquipmentLabel(equipmentAccess) || "--"}</span>
            </div>
            <div style={summaryCardStyle}>
              <span style={summaryLabelStyle}>Bodyweight</span>
              <span style={summaryValueStyle}>{bodyweight || "--"}</span>
            </div>
            <div style={summaryCardStyle}>
              <span style={summaryLabelStyle}>Waist</span>
              <span style={summaryValueStyle}>{waist || "--"}</span>
            </div>
            <div style={summaryCardStyle}>
              <span style={summaryLabelStyle}>Profile ID</span>
              <span style={summaryValueStyle}>{profileId ?? "--"}</span>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function formatEquipmentLabel(value: string) {
  switch (value) {
    case "full_gym":
      return "Full gym";
    case "dumbbells_only":
      return "Dumbbells only";
    case "barbell_rack":
      return "Barbell + rack";
    case "machines_only":
      return "Machines only";
    case "bodyweight_only":
      return "Bodyweight only";
    case "minimal_home_gym":
      return "Minimal home gym";
    default:
      return value;
  }
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #050505 0%, #0a0a0a 35%, #0f0f0f 100%)",
  color: "white",
  padding: "28px 20px 120px",
  fontFamily: "sans-serif",
};
const heroCardStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,26,26,0.18) 0%, rgba(20,20,20,1) 55%, rgba(10,10,10,1) 100%)",
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
const heroStatsRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "10px",
  marginTop: "20px",
};
const heroStatBox: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "16px",
  padding: "14px 12px",
};
const heroStatLabel: CSSProperties = {
  color: "#aaa",
  fontSize: "12px",
  marginBottom: "6px",
};
const heroStatValueSmall: CSSProperties = {
  color: "#fff",
  fontSize: "16px",
  fontWeight: 800,
};
const accountBarStyle: CSSProperties = {
  marginTop: "18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
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
const dangerCardStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(90,16,16,0.35), rgba(18,18,18,1))",
  border: "1px solid rgba(255,80,80,0.18)",
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
  marginBottom: "12px",
};
const sectionTitle: CSSProperties = {
  color: "#ff4d4d",
  margin: 0,
  fontSize: "18px",
  fontWeight: 800,
};
const dangerSectionTitle: CSSProperties = {
  color: "#ff7b7b",
  margin: 0,
  fontSize: "18px",
  fontWeight: 800,
};
const dangerTextStyle: CSSProperties = {
  color: "#d7bcbc",
  fontSize: "14px",
  lineHeight: 1.5,
  marginTop: 0,
  marginBottom: "16px",
};
const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "14px",
};
const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "6px",
};
const labelStyle: CSSProperties = {
  color: "#ff6b6b",
  fontSize: "13px",
  fontWeight: 700,
};
const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #2a2a2a",
  backgroundColor: "#1c1c1c",
  color: "white",
  fontSize: "15px",
};
const actionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};
const primaryButtonStyle: CSSProperties = {
  backgroundColor: "#ff1a1a",
  border: "none",
  padding: "14px 18px",
  borderRadius: "10px",
  color: "white",
  fontWeight: 700,
  fontSize: "16px",
  cursor: "pointer",
};
const secondaryButtonStyle: CSSProperties = {
  backgroundColor: "#222",
  border: "1px solid #333",
  padding: "14px 18px",
  borderRadius: "10px",
  color: "white",
  fontWeight: 700,
  fontSize: "16px",
  cursor: "pointer",
};
const resetButtonStyle: CSSProperties = {
  width: "100%",
  backgroundColor: "#5a1010",
  border: "1px solid #7a1a1a",
  padding: "14px 18px",
  borderRadius: "12px",
  color: "white",
  fontWeight: 800,
  fontSize: "15px",
  cursor: "pointer",
};
const statusStyle: CSSProperties = {
  marginTop: "18px",
  marginBottom: "18px",
  color: "#cccccc",
};
const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
};
const summaryCardStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,26,26,0.10), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "18px",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};
const summaryLabelStyle: CSSProperties = {
  color: "#aaa",
  fontSize: "13px",
};
const summaryValueStyle: CSSProperties = {
  color: "#fff",
  fontSize: "22px",
  fontWeight: 900,
};