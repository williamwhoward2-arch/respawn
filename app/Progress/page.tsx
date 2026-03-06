"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

type Workout = {
  id: number;
  workout_name: string | null;
  created_at: string;
  duration_seconds?: number | null;
};

type WorkoutSet = {
  id: number;
  workout_id: number;
  exercise_name: string | null;
  body_part?: string | null;
  set_number: number | null;
  weight: string | null;
  reps: string | null;
  created_at: string;
};

type Profile = {
  name: string | null;
  bodyweight: string | null;
  goal: string | null;
  focus?: string | null;
  experience_level?: string | null;
};

type BodyPartSummary = {
  bodyPart: string;
  sets: number;
  volume: number;
};

function toNumber(value: string | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function estimate1RM(weight: number, reps: number) {
  if (!weight || !reps) return 0;
  return weight * (1 + reps / 30);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString();
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeBodyPart(value: string | null | undefined) {
  if (!value) return "Other";

  const cleaned = value.toLowerCase();

  if (cleaned === "chest") return "Chest";
  if (cleaned === "back") return "Back";
  if (cleaned === "legs") return "Legs";
  if (cleaned === "shoulders") return "Shoulders";
  if (cleaned === "arms") return "Arms";
  if (cleaned === "core") return "Core";
  if (cleaned === "glutes") return "Glutes";
  if (cleaned === "push") return "Push";
  if (cleaned === "pull") return "Pull";
  if (cleaned === "full_body") return "Full Body";

  return titleCase(cleaned);
}

export default function ProgressPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadProgress();
  }, []);

  async function loadProgress() {
    setLoading(true);

    const [
      { data: profileData, error: profileError },
      { data: workoutsData, error: workoutsError },
      { data: setsData, error: setsError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("name, bodyweight, goal, focus, experience_level")
        .maybeSingle(),
      supabase.from("workouts").select("*").order("created_at", { ascending: false }),
      supabase.from("workout_sets").select("*").order("created_at", { ascending: false }),
    ]);

    if (profileError) {
      console.error("Profile load error:", {
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        code: profileError.code,
      });
    }

    if (workoutsError) {
      console.error("Workouts load error:", {
        message: workoutsError.message,
        details: workoutsError.details,
        hint: workoutsError.hint,
        code: workoutsError.code,
      });
    }

    if (setsError) {
      console.error("Sets load error:", {
        message: setsError.message,
        details: setsError.details,
        hint: setsError.hint,
        code: setsError.code,
      });
    }

    setProfile((profileData as Profile) ?? null);
    setWorkouts((workoutsData as Workout[]) ?? []);
    setSets((setsData as WorkoutSet[]) ?? []);
    setLoading(false);
  }

  const computed = useMemo(() => {
    const bodyweight = toNumber(profile?.bodyweight) || 205;
    const goal = (profile?.goal || "general").toLowerCase();

    const validSets = sets.filter((set) => {
      const weight = toNumber(set.weight);
      const reps = toNumber(set.reps);
      return weight > 0 && reps > 0;
    });

    const totalVolume = validSets.reduce(
      (sum, set) => sum + toNumber(set.weight) * toNumber(set.reps),
      0
    );

    const avgReps =
      validSets.length > 0
        ? Math.round(
            validSets.reduce((sum, set) => sum + toNumber(set.reps), 0) /
              validSets.length
          )
        : 0;

    const avgWeight =
      validSets.length > 0
        ? Math.round(
            validSets.reduce((sum, set) => sum + toNumber(set.weight), 0) /
              validSets.length
          )
        : 0;

    const recentWorkouts = [...workouts]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6);

    const recentWorkoutIds = new Set(recentWorkouts.map((w) => w.id));
    const recentSets = validSets.filter((set) => recentWorkoutIds.has(set.workout_id));

    const bodyPartMap = new Map<string, { sets: number; volume: number }>();
    for (const set of recentSets) {
      const bodyPart = normalizeBodyPart(set.body_part);
      const current = bodyPartMap.get(bodyPart) ?? { sets: 0, volume: 0 };
      current.sets += 1;
      current.volume += toNumber(set.weight) * toNumber(set.reps);
      bodyPartMap.set(bodyPart, current);
    }

    const bodyPartSummary: BodyPartSummary[] = Array.from(bodyPartMap.entries())
      .map(([bodyPart, value]) => ({
        bodyPart,
        sets: value.sets,
        volume: value.volume,
      }))
      .sort((a, b) => b.volume - a.volume);

    const strongestBodyParts = bodyPartSummary.slice(0, 2);
    const undertrainedBodyParts = bodyPartSummary
      .filter((item) => item.sets > 0)
      .slice(-2)
      .reverse();

    const benchSets = validSets.filter((set) =>
      ["Bench Press", "Dumbbell Bench Press", "Incline Bench Press"].includes(
        set.exercise_name ?? ""
      )
    );

    const squatSets = validSets.filter((set) =>
      ["Squat", "Back Squat", "Front Squat"].includes(set.exercise_name ?? "")
    );

    const deadliftSets = validSets.filter((set) =>
      ["Deadlift", "Romanian Deadlift"].includes(set.exercise_name ?? "")
    );

    const bestBench = Math.max(
      0,
      ...benchSets.map((set) => estimate1RM(toNumber(set.weight), toNumber(set.reps)))
    );

    const bestSquat = Math.max(
      0,
      ...squatSets.map((set) => estimate1RM(toNumber(set.weight), toNumber(set.reps)))
    );

    const bestDeadlift = Math.max(
      0,
      ...deadliftSets.map((set) => estimate1RM(toNumber(set.weight), toNumber(set.reps)))
    );

    const exerciseFrequencyMap = new Map<string, number>();
    for (const set of recentSets) {
      const name = set.exercise_name || "Unknown";
      exerciseFrequencyMap.set(name, (exerciseFrequencyMap.get(name) ?? 0) + 1);
    }

    const topExercises = Array.from(exerciseFrequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);

    const avgWorkoutDuration =
      recentWorkouts.length > 0
        ? Math.round(
            recentWorkouts.reduce(
              (sum, workout) => sum + toNumber(workout.duration_seconds),
              0
            ) / recentWorkouts.length / 60
          )
        : 0;

    const last14Days = new Date();
    last14Days.setDate(last14Days.getDate() - 13);

    const recent14Workouts = workouts.filter(
      (workout) => new Date(workout.created_at) >= last14Days
    ).length;

    let repRangeSummary = "mixed";
    if (avgReps > 0 && avgReps <= 6) repRangeSummary = "strength_biased";
    else if (avgReps >= 7 && avgReps <= 12) repRangeSummary = "hypertrophy_biased";
    else if (avgReps >= 13) repRangeSummary = "high_rep_endurance";

    const strengths: string[] = [];
    const focusNext: string[] = [];
    const trainingGuidance: string[] = [];
    const nutritionGuidance: string[] = [];
    const balanceInsights: string[] = [];

    if (recent14Workouts >= 4) {
      strengths.push("Your recent training consistency is strong.");
    } else if (recent14Workouts >= 2) {
      strengths.push("You are keeping enough weekly frequency to build momentum.");
    }

    if (repRangeSummary === "hypertrophy_biased") {
      strengths.push(
        "Most of your recent work is sitting in productive muscle-building rep ranges."
      );
    }

    if (bestBench >= bodyweight * 1.1) {
      strengths.push("Your pressing strength is a real strength right now.");
    }

    if (strongestBodyParts.length > 0) {
      strengths.push(
        `Your recent training emphasis is strongest in ${strongestBodyParts
          .map((part) => part.bodyPart.toLowerCase())
          .join(" and ")}.`
      );
    }

    if (bodyPartSummary.some((item) => item.bodyPart === "Legs" && item.sets < 6)) {
      focusNext.push(
        "Bring lower-body volume up slightly to stay balanced and support full-body progress."
      );
    }

    if (!bodyPartSummary.some((item) => item.bodyPart === "Back" && item.sets >= 6)) {
      focusNext.push(
        "Add more upper-back and pulling volume to support posture, size, and overall strength."
      );
    }

    if (repRangeSummary === "strength_biased") {
      focusNext.push(
        "Keep one heavy compound focus, but add more 8–12 and 10–15 rep work for growth and joint-friendly volume."
      );
    }

    if (goal === "hypertrophy") {
      focusNext.push(
        "Keep compounds progressing, but let most accessories live in moderate to higher rep ranges."
      );
    }

    if (goal === "strength") {
      focusNext.push(
        "Prioritize fewer main lifts and progress them more deliberately week to week."
      );
    }

    if (goal === "fat_loss") {
      focusNext.push(
        "Keep strength work in place while tightening workout density and recovery habits."
      );
    }

    if (goal === "hypertrophy") {
      trainingGuidance.push("Main compounds: 5–8 reps with progressive overload.");
      trainingGuidance.push("Secondary compounds: 6–10 reps with controlled tempo.");
      trainingGuidance.push(
        "Isolation lifts: 10–15 reps, pushing close to technical failure."
      );
    } else if (goal === "strength") {
      trainingGuidance.push(
        "Main compounds: 3–6 reps with cleaner progression and longer rest."
      );
      trainingGuidance.push("Secondary compounds: 5–8 reps to support your main lifts.");
      trainingGuidance.push(
        "Isolation lifts: 8–12 reps to keep joints healthy and weak points moving."
      );
    } else if (goal === "fat_loss") {
      trainingGuidance.push(
        "Main compounds: 5–8 reps to preserve strength while dieting."
      );
      trainingGuidance.push(
        "Accessories: 8–12 reps with shorter rest and solid effort."
      );
      trainingGuidance.push("Isolation lifts: 10–15 reps to keep training density high.");
    } else {
      trainingGuidance.push("Main compounds: 5–8 reps.");
      trainingGuidance.push("Secondary work: 6–10 reps.");
      trainingGuidance.push("Isolation lifts: 10–15 reps.");
    }

    if (topExercises.length > 0) {
      trainingGuidance.push(
        `Best exercise focus right now: ${topExercises.slice(0, 5).join(", ")}.`
      );
    }

    if (goal === "hypertrophy") {
      nutritionGuidance.push(
        `Aim for roughly ${Math.round(bodyweight * 0.8)}–${Math.round(
          bodyweight * 1.0
        )}g of protein per day.`
      );
      nutritionGuidance.push(
        "Stay in a small calorie surplus and keep carbs higher around training sessions."
      );
      nutritionGuidance.push(
        "Avoid under-eating on hard training days if size and recovery are the priority."
      );
    } else if (goal === "strength") {
      nutritionGuidance.push(
        `Keep protein around ${Math.round(bodyweight * 0.8)}–${Math.round(
          bodyweight * 1.0
        )}g per day.`
      );
      nutritionGuidance.push(
        "Eat enough carbs before and after heavy sessions so performance stays high."
      );
      nutritionGuidance.push(
        "Maintenance calories or a slight surplus usually supports strength progress best."
      );
    } else if (goal === "fat_loss") {
      nutritionGuidance.push(
        `Keep protein high at roughly ${Math.round(bodyweight * 0.9)}–${Math.round(
          bodyweight * 1.1
        )}g per day.`
      );
      nutritionGuidance.push(
        "Use a moderate calorie deficit rather than cutting too aggressively."
      );
      nutritionGuidance.push(
        "Keep training performance as stable as possible while bodyweight trends down."
      );
    } else {
      nutritionGuidance.push(
        `A practical protein target is around ${Math.round(bodyweight * 0.8)}–${Math.round(
          bodyweight * 1.0
        )}g per day.`
      );
      nutritionGuidance.push(
        "Match calories to your goal and keep meal timing consistent around training."
      );
    }

    if (strongestBodyParts.length > 0) {
      balanceInsights.push(
        `Current bias: ${strongestBodyParts.map((x) => x.bodyPart).join(" and ")} are getting the most recent training attention.`
      );
    }

    if (undertrainedBodyParts.length > 0) {
      balanceInsights.push(
        `Needs more work: ${undertrainedBodyParts.map((x) => x.bodyPart).join(" and ")} are trailing behind your other body parts.`
      );
    }

    const storyParts: string[] = [];

    if (goal === "hypertrophy") {
      storyParts.push(
        "Your recent training is trending toward muscle-building work with a strong mix of moderate reps and repeatable volume."
      );
    } else if (goal === "strength") {
      storyParts.push(
        "Your recent training is telling a strength-focused story, with your best progress tied to heavier compound work."
      );
    } else if (goal === "fat_loss") {
      storyParts.push(
        "Your recent training shows you are maintaining useful performance while building work capacity."
      );
    } else {
      storyParts.push(
        "Your recent training is building a balanced base of strength and general fitness."
      );
    }

    if (bestBench > 0 || bestSquat > 0 || bestDeadlift > 0) {
      const strongestLift =
        [
          { label: "bench", value: bestBench },
          { label: "squat", value: bestSquat },
          { label: "deadlift", value: bestDeadlift },
        ].sort((a, b) => b.value - a.value)[0]?.label ?? "training";

      storyParts.push(
        `Your current strength profile is led most by your ${strongestLift} work.`
      );
    }

    if (strongestBodyParts.length > 0 && undertrainedBodyParts.length > 0) {
      storyParts.push(
        `${strongestBodyParts[0].bodyPart} volume is ahead right now, while ${undertrainedBodyParts[0].bodyPart.toLowerCase()} could use more attention next.`
      );
    }

    if (avgWorkoutDuration > 0) {
      storyParts.push(
        `Your recent sessions are averaging about ${avgWorkoutDuration} minutes, which is enough time to make focused progress if exercise selection stays tight.`
      );
    }

    return {
      bodyweight,
      totalVolume,
      avgReps,
      avgWeight,
      recent14Workouts,
      repRangeSummary,
      bestBench: Math.round(bestBench),
      bestSquat: Math.round(bestSquat),
      bestDeadlift: Math.round(bestDeadlift),
      strongestBodyParts,
      undertrainedBodyParts,
      strengths,
      focusNext,
      trainingGuidance,
      nutritionGuidance,
      balanceInsights,
      story: storyParts.join(" "),
      recentWorkouts,
      bodyPartSummary,
    };
  }, [profile, workouts, sets]);

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <p style={eyebrowStyle}>RESPAWN PROGRESS</p>
          <h1 style={heroTitleStyle}>Loading your progress story...</h1>
          <p style={heroSubStyle}>Reading your recent training and profile data.</p>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <p style={eyebrowStyle}>RESPAWN PROGRESS</p>
        <h1 style={heroTitleStyle}>
          {profile?.name ? `${profile.name}'s Progress Story` : "Your Progress Story"}
        </h1>
        <p style={heroSubStyle}>
          Goal: {profile?.goal ? titleCase(profile.goal) : "General"} • Bodyweight:{" "}
          {profile?.bodyweight || "--"}
        </p>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Your Progress Story</h2>
        </div>
        <p style={storyTextStyle}>{computed.story}</p>
      </section>

      <section style={twoColGridStyle}>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>What’s Working</h2>
          </div>

          {computed.strengths.length > 0 ? (
            <div style={listStyle}>
              {computed.strengths.map((item, index) => (
                <div key={index} style={listItemStyle}>
                  <div style={listLineStyle} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={mutedStyle}>Log a bit more training and this section will sharpen up.</p>
          )}
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>What To Focus On Next</h2>
          </div>

          {computed.focusNext.length > 0 ? (
            <div style={listStyle}>
              {computed.focusNext.map((item, index) => (
                <div key={index} style={listItemStyle}>
                  <div style={listLineStyle} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={mutedStyle}>
              Your training looks balanced right now. Keep progressing your main lifts.
            </p>
          )}
        </section>
      </section>

      <section style={twoColGridStyle}>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Training Recommendations</h2>
          </div>

          <div style={recommendationGridStyle}>
            {computed.trainingGuidance.map((item, index) => (
              <div key={index} style={recommendationCardStyle}>
                {item}
              </div>
            ))}
          </div>

          <div style={miniStatsRowStyle}>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Avg reps</span>
              <span style={miniStatValueStyle}>{computed.avgReps || "--"}</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Avg working weight</span>
              <span style={miniStatValueStyle}>{computed.avgWeight || "--"}</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Rep bias</span>
              <span style={miniStatValueStyleSmall}>
                {titleCase(computed.repRangeSummary)}
              </span>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Nutrition Guidance</h2>
          </div>

          <div style={recommendationGridStyle}>
            {computed.nutritionGuidance.map((item, index) => (
              <div key={index} style={nutritionCardStyle}>
                {item}
              </div>
            ))}
          </div>
        </section>
      </section>

      <section style={twoColGridStyle}>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Balance Check</h2>
          </div>

          {computed.balanceInsights.length > 0 ? (
            <div style={listStyle}>
              {computed.balanceInsights.map((item, index) => (
                <div key={index} style={listItemStyle}>
                  <div style={listLineStyle} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={mutedStyle}>Not enough body-part data yet.</p>
          )}

          {computed.bodyPartSummary.length > 0 && (
            <div style={bodyPartGridStyle}>
              {computed.bodyPartSummary.map((item) => (
                <div key={item.bodyPart} style={bodyPartCardStyle}>
                  <div style={bodyPartNameStyle}>{item.bodyPart}</div>
                  <div style={bodyPartSubStyle}>
                    {item.sets} sets • {Math.round(item.volume).toLocaleString()} volume
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Recent Training Snapshot</h2>
          </div>

          <div style={miniStatsRowStyle}>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Recent workouts</span>
              <span style={miniStatValueStyle}>{computed.recent14Workouts}</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Best bench e1RM</span>
              <span style={miniStatValueStyle}>{computed.bestBench || "--"}</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Best squat e1RM</span>
              <span style={miniStatValueStyle}>{computed.bestSquat || "--"}</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Best deadlift e1RM</span>
              <span style={miniStatValueStyle}>{computed.bestDeadlift || "--"}</span>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            {computed.recentWorkouts.length > 0 ? (
              computed.recentWorkouts.map((workout) => (
                <div key={workout.id} style={sessionRowStyle}>
                  <div>
                    <div style={sessionNameStyle}>{workout.workout_name || "Workout"}</div>
                    <div style={sessionMetaStyle}>{formatDateTime(workout.created_at)}</div>
                  </div>
                  <div style={sessionDurationStyle}>
                    {formatDuration(workout.duration_seconds)}
                  </div>
                </div>
              ))
            ) : (
              <p style={mutedStyle}>No recent workouts yet.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg,#050505,#0a0a0a,#0f0f0f)",
  color: "white",
  padding: "28px 20px 120px",
  fontFamily: "sans-serif",
};

const heroCardStyle: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(255,26,26,0.18) 0%, rgba(20,20,20,1) 55%, rgba(10,10,10,1) 100%)",
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
  fontSize: "34px",
  lineHeight: 1.05,
  fontWeight: 900,
  margin: "0 0 8px",
};

const heroSubStyle: CSSProperties = {
  color: "#d0d0d0",
  fontSize: "15px",
  margin: 0,
};

const cardStyle: CSSProperties = {
  background: "#121212",
  border: "1px solid #222",
  borderRadius: "20px",
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

const storyTextStyle: CSSProperties = {
  color: "#f0f0f0",
  fontSize: "16px",
  lineHeight: 1.7,
  margin: 0,
};

const twoColGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
  gap: "16px",
  marginBottom: "16px",
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
};

const listItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
  color: "#efefef",
  lineHeight: 1.5,
};

const listLineStyle: CSSProperties = {
  width: "10px",
  height: "2px",
  background: "#ff4d4d",
  borderRadius: "999px",
  flexShrink: 0,
  marginTop: "10px",
};

const recommendationGridStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
};

const recommendationCardStyle: CSSProperties = {
  background: "linear-gradient(135deg,rgba(255,26,26,.10),rgba(255,255,255,.02))",
  borderRadius: "16px",
  padding: "14px",
  border: "1px solid rgba(255,255,255,.05)",
  color: "#f0f0f0",
  lineHeight: 1.5,
};

const nutritionCardStyle: CSSProperties = {
  background: "linear-gradient(135deg,rgba(255,255,255,.05),rgba(255,26,26,.04))",
  borderRadius: "16px",
  padding: "14px",
  border: "1px solid rgba(255,255,255,.05)",
  color: "#f0f0f0",
  lineHeight: 1.5,
};

const miniStatsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
  gap: "10px",
  marginTop: "16px",
};

const miniStatBoxStyle: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "14px",
  padding: "14px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const miniStatLabelStyle: CSSProperties = {
  color: "#aaaaaa",
  fontSize: "12px",
};

const miniStatValueStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: 900,
};

const miniStatValueStyleSmall: CSSProperties = {
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 800,
  lineHeight: 1.3,
};

const bodyPartGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
  gap: "10px",
  marginTop: "16px",
};

const bodyPartCardStyle: CSSProperties = {
  background: "#171717",
  border: "1px solid #252525",
  borderRadius: "16px",
  padding: "14px",
};

const bodyPartNameStyle: CSSProperties = {
  color: "#fff",
  fontWeight: 800,
  fontSize: "15px",
};

const bodyPartSubStyle: CSSProperties = {
  color: "#b8b8b8",
  fontSize: "13px",
  marginTop: "6px",
};

const sessionRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  padding: "12px 0",
  borderBottom: "1px solid #1d1d1d",
};

const sessionNameStyle: CSSProperties = {
  color: "#fff",
  fontWeight: 700,
};

const sessionMetaStyle: CSSProperties = {
  color: "#8f8f8f",
  fontSize: "13px",
  marginTop: "4px",
};

const sessionDurationStyle: CSSProperties = {
  color: "#ff7a7a",
  fontWeight: 800,
};

const mutedStyle: CSSProperties = {
  color: "#9f9f9f",
  margin: 0,
};