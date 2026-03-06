"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateWorkout } from "@/lib/generateWorkout";

type Goal = "strength" | "hypertrophy" | "fat_loss" | "general";
type BodyPart =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "push"
  | "pull"
  | "full_body";
type ExperienceLevel = "beginner" | "intermediate" | "advanced";
type EquipmentAccess =
  | "full_gym"
  | "dumbbells_only"
  | "barbell_rack"
  | "machines_only"
  | "bodyweight_only"
  | "minimal_home_gym";

const BODY_PART_OPTIONS: { label: string; value: BodyPart }[] = [
  { label: "Chest", value: "chest" },
  { label: "Back", value: "back" },
  { label: "Legs", value: "legs" },
  { label: "Shoulders", value: "shoulders" },
  { label: "Arms", value: "arms" },
  { label: "Push", value: "push" },
  { label: "Pull", value: "pull" },
  { label: "Full Body", value: "full_body" },
];

const GOAL_OPTIONS: { label: string; value: Goal }[] = [
  { label: "Strength", value: "strength" },
  { label: "Build Muscle", value: "hypertrophy" },
  { label: "Burn Fat", value: "fat_loss" },
  { label: "General Fitness", value: "general" },
];

const EXPERIENCE_OPTIONS: { label: string; value: ExperienceLevel }[] = [
  { label: "Beginner", value: "beginner" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Advanced", value: "advanced" },
];

const EQUIPMENT_OPTIONS: { label: string; value: EquipmentAccess }[] = [
  { label: "Full gym", value: "full_gym" },
  { label: "Dumbbells only", value: "dumbbells_only" },
  { label: "Barbell + rack", value: "barbell_rack" },
  { label: "Machines only", value: "machines_only" },
  { label: "Bodyweight only", value: "bodyweight_only" },
  { label: "Minimal home gym", value: "minimal_home_gym" },
];

const DURATION_OPTIONS = [30, 45, 60, 75];

export default function WorkoutGenerator() {
  const router = useRouter();

  const [bodyPart, setBodyPart] = useState<BodyPart>("push");
  const [goal, setGoal] = useState<Goal>("hypertrophy");
  const [duration, setDuration] = useState<number>(45);
  const [experienceLevel, setExperienceLevel] =
    useState<ExperienceLevel>("intermediate");
  const [equipmentAccess, setEquipmentAccess] =
    useState<EquipmentAccess>("full_gym");
  const [generatedWorkout, setGeneratedWorkout] = useState<any>(null);
  const [error, setError] = useState("");

  function handleGenerate() {
    try {
      setError("");

      const workout = generateWorkout({
        bodyPart,
        goal,
        duration,
        experienceLevel,
        equipmentAccess,
      });

      setGeneratedWorkout(workout);
    } catch (err) {
      console.error(err);
      setGeneratedWorkout(null);
      setError("Could not generate a workout for those settings.");
    }
  }

  function handleStartWorkout() {
    if (!generatedWorkout) return;

    localStorage.setItem(
      "respawn_generated_workout",
      JSON.stringify(generatedWorkout)
    );

    router.push("/Workout");
  }

  return (
    <section style={cardStyle}>
      <div style={sectionHeaderStyle}>
        <h2 style={sectionTitle}>Workout Generator</h2>
      </div>

      <p style={mutedStyle}>
        Generate a workout based on your goal, experience, time, and available equipment.
      </p>

      <div style={formGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Body Part</span>
          <select
            value={bodyPart}
            onChange={(e) => setBodyPart(e.target.value as BodyPart)}
            style={inputStyle}
          >
            {BODY_PART_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Goal</span>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as Goal)}
            style={inputStyle}
          >
            {GOAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Duration</span>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={inputStyle}
          >
            {DURATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min
              </option>
            ))}
          </select>
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Experience Level</span>
          <select
            value={experienceLevel}
            onChange={(e) =>
              setExperienceLevel(e.target.value as ExperienceLevel)
            }
            style={inputStyle}
          >
            {EXPERIENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Equipment Access</span>
          <select
            value={equipmentAccess}
            onChange={(e) =>
              setEquipmentAccess(e.target.value as EquipmentAccess)
            }
            style={inputStyle}
          >
            {EQUIPMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={actionRowStyle}>
        <button onClick={handleGenerate} style={primaryButtonStyle}>
          Generate Workout
        </button>

        {generatedWorkout && (
          <button onClick={handleStartWorkout} style={secondaryButtonStyle}>
            Start This Workout
          </button>
        )}
      </div>

      {error && <p style={errorStyle}>{error}</p>}

      {generatedWorkout && (
        <div style={previewCardStyle}>
          <h3 style={previewTitleStyle}>{generatedWorkout.workout_name}</h3>
          <p style={mutedStyle}>
            {generatedWorkout.estimated_duration} min • {experienceLevel} •{" "}
            {equipmentAccess.replaceAll("_", " ")}
          </p>

          <div style={previewListStyle}>
            {generatedWorkout.exercises.map((exercise: any, index: number) => (
              <div key={`${exercise.exercise_name}-${index}`} style={previewItemStyle}>
                <div>
                  <div style={previewExerciseStyle}>{exercise.exercise_name}</div>
                  <div style={previewSubStyle}>
                    {exercise.sets.length} sets • {exercise.sets[0]?.reps || "--"} reps
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#121212",
  border: "1px solid #222",
  borderRadius: "22px",
  padding: "20px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  marginBottom: "16px",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "12px",
};

const sectionTitle: React.CSSProperties = {
  color: "#ff4d4d",
  margin: 0,
  fontSize: "18px",
  fontWeight: 800,
};

const mutedStyle: React.CSSProperties = {
  color: "#a5a5a5",
  margin: "6px 0 14px",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
};

const labelStyle: React.CSSProperties = {
  color: "#ff6b6b",
  fontSize: "13px",
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #2a2a2a",
  backgroundColor: "#1c1c1c",
  color: "white",
  fontSize: "15px",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  marginTop: "16px",
};

const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: "#ff1a1a",
  border: "none",
  padding: "14px 18px",
  borderRadius: "10px",
  color: "white",
  fontWeight: 700,
  fontSize: "16px",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  backgroundColor: "#222",
  border: "1px solid #333",
  padding: "14px 18px",
  borderRadius: "10px",
  color: "white",
  fontWeight: 700,
  fontSize: "16px",
  cursor: "pointer",
};

const previewCardStyle: React.CSSProperties = {
  marginTop: "18px",
  background: "linear-gradient(135deg, rgba(255,26,26,0.10), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "18px",
  padding: "16px",
};

const previewTitleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: "20px",
  fontWeight: 900,
  color: "#fff",
};

const previewListStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
  marginTop: "12px",
};

const previewItemStyle: React.CSSProperties = {
  padding: "12px",
  borderRadius: "14px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.05)",
};

const previewExerciseStyle: React.CSSProperties = {
  color: "#fff",
  fontWeight: 800,
  fontSize: "15px",
};

const previewSubStyle: React.CSSProperties = {
  color: "#bcbcbc",
  fontSize: "13px",
  marginTop: "4px",
};

const errorStyle: React.CSSProperties = {
  marginTop: "12px",
  color: "#ff8b8b",
  fontWeight: 600,
};