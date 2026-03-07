"use client";

import { useMemo, useState, type CSSProperties } from "react";
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

type WorkoutSet = {
  weight: string;
  reps: string;
  completed?: boolean;
};

type WorkoutExercise = {
  id: string;
  exercise_name: string;
  name?: string;
  body_part: string;
  bodyPart?: string;
  sets: WorkoutSet[];
  favorite?: boolean;
  coachingNote?: string;
  reason?: string;
  restSeconds?: number;
  targetWeight?: number | null;
};

type WorkoutPayload = {
  workout_name: string;
  workoutName?: string;
  estimated_duration: number;
  estimatedDurationMinutes?: number;
  coachNote?: string;
  intensityLabel?: "easy" | "moderate" | "hard";
  progressionAdvice?: string[];
  exercises: WorkoutExercise[];
};

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

function toTitleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getIntensityLabel(duration: number, goal: Goal): "easy" | "moderate" | "hard" {
  if (duration <= 30) return "easy";
  if (goal === "strength" || duration >= 60) return "hard";
  return "moderate";
}

function buildCoachNote(params: {
  goal: Goal;
  bodyPart: BodyPart;
  experienceLevel: ExperienceLevel;
  duration: number;
  equipmentAccess: EquipmentAccess;
  soreAreas: string[];
  fatiguedAreas: string[];
}) {
  const { goal, bodyPart, experienceLevel, duration, equipmentAccess, soreAreas, fatiguedAreas } = params;

  const intro =
    goal === "strength"
      ? "Today is built around heavier compound work and quality execution."
      : goal === "hypertrophy"
      ? "Today is built around strong muscle stimulus, controlled reps, and repeatable progression."
      : goal === "fat_loss"
      ? "Today keeps training density high while still preserving good lifting quality."
      : "Today balances performance, volume, and consistency.";

  const focus = ` Focus is ${toTitleCase(bodyPart)} with a ${toTitleCase(
    equipmentAccess
  )} setup for a ${duration}-minute session.`;

  const level = ` Programming is adjusted for a ${experienceLevel} lifter.`;

  const recovery =
    soreAreas.length || fatiguedAreas.length
      ? ` Recovery inputs were considered${soreAreas.length ? `, especially soreness around ${soreAreas.join(", ")}` : ""}${
          fatiguedAreas.length ? `${soreAreas.length ? " and" : ""} fatigue in ${fatiguedAreas.join(", ")}` : ""
        }.`
      : "";

  return `${intro}${focus}${level}${recovery}`;
}

function buildProgressionAdvice(goal: Goal, exercises: WorkoutExercise[]): string[] {
  const base = [
    "Try to beat last session by 1 rep on at least one or two exercises.",
    "When all sets hit the top of the rep target with clean form, increase the load next time.",
  ];

  if (goal === "strength") {
    base.push("Keep your compound lifts crisp and avoid grinding every set to failure.");
  } else if (goal === "hypertrophy") {
    base.push("Control the eccentric and keep tension on the target muscle instead of rushing reps.");
  } else if (goal === "fat_loss") {
    base.push("Keep rest honest and move with purpose to maintain training density.");
  } else {
    base.push("Aim for clean form and steady consistency before chasing heavier loads.");
  }

  if (exercises.some((exercise) => exercise.body_part === "core")) {
    base.push("For core work, add reps or time before making the movement more difficult.");
  }

  return base;
}

function normalizeLocalWorkout(
  workout: any,
  params: {
    goal: Goal;
    bodyPart: BodyPart;
    experienceLevel: ExperienceLevel;
    duration: number;
    equipmentAccess: EquipmentAccess;
    soreAreas: string[];
    fatiguedAreas: string[];
  }
): WorkoutPayload {
  const normalizedExercises: WorkoutExercise[] = Array.isArray(workout?.exercises)
    ? workout.exercises.map((exercise: any, index: number) => ({
        id: exercise?.id ?? `${exercise?.exercise_name ?? "exercise"}-${index}`,
        exercise_name: exercise?.exercise_name ?? exercise?.name ?? "Exercise",
        name: exercise?.exercise_name ?? exercise?.name ?? "Exercise",
        body_part: exercise?.body_part ?? exercise?.bodyPart ?? "general",
        bodyPart: exercise?.body_part ?? exercise?.bodyPart ?? "general",
        coachingNote:
          exercise?.coachingNote ??
          (exercise?.sets?.length >= 4
            ? "Main movement. Push performance while keeping form tight."
            : exercise?.sets?.length === 3
            ? "Controlled working sets. Own the tempo and range."
            : "Use this to finish with quality reps and tension."),
        reason: exercise?.reason ?? `Selected for ${toTitleCase(params.bodyPart)} ${params.goal.replaceAll("_", " ")} training.`,
        restSeconds:
          exercise?.restSeconds ??
          (params.goal === "strength" ? 120 : exercise?.sets?.length >= 4 ? 90 : 60),
        targetWeight: exercise?.targetWeight ?? null,
        sets: Array.isArray(exercise?.sets)
          ? exercise.sets.map((set: any) => ({
              weight: String(set?.weight ?? ""),
              reps: String(set?.reps ?? ""),
              completed: Boolean(set?.completed),
            }))
          : [],
      }))
    : [];

  return {
    workout_name: workout?.workout_name ?? workout?.workoutName ?? "Generated Workout",
    workoutName: workout?.workout_name ?? workout?.workoutName ?? "Generated Workout",
    estimated_duration: workout?.estimated_duration ?? workout?.estimatedDurationMinutes ?? params.duration,
    estimatedDurationMinutes: workout?.estimated_duration ?? workout?.estimatedDurationMinutes ?? params.duration,
    coachNote:
      workout?.coachNote ??
      buildCoachNote({
        goal: params.goal,
        bodyPart: params.bodyPart,
        experienceLevel: params.experienceLevel,
        duration: params.duration,
        equipmentAccess: params.equipmentAccess,
        soreAreas: params.soreAreas,
        fatiguedAreas: params.fatiguedAreas,
      }),
    intensityLabel: workout?.intensityLabel ?? getIntensityLabel(params.duration, params.goal),
    progressionAdvice:
      workout?.progressionAdvice ?? buildProgressionAdvice(params.goal, normalizedExercises),
    exercises: normalizedExercises,
  };
}

export default function WorkoutGenerator() {
  const router = useRouter();

  const [bodyPart, setBodyPart] = useState<BodyPart>("push");
  const [goal, setGoal] = useState<Goal>("hypertrophy");
  const [duration, setDuration] = useState<number>(45);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("intermediate");
  const [equipmentAccess, setEquipmentAccess] = useState<EquipmentAccess>("full_gym");

  const [soreAreasInput, setSoreAreasInput] = useState("");
  const [fatiguedAreasInput, setFatiguedAreasInput] = useState("");
  const [preferredExercisesInput, setPreferredExercisesInput] = useState("");
  const [excludedExercisesInput, setExcludedExercisesInput] = useState("");

  const [generatedWorkout, setGeneratedWorkout] = useState<WorkoutPayload | null>(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const readableEquipment = useMemo(() => toTitleCase(equipmentAccess), [equipmentAccess]);

  function handleGenerate() {
    try {
      setIsGenerating(true);
      setError("");
      setGeneratedWorkout(null);

      const soreAreas = parseCommaList(soreAreasInput);
      const fatiguedAreas = parseCommaList(fatiguedAreasInput);
      const preferredExercises = parseCommaList(preferredExercisesInput);
      const excludedExercises = parseCommaList(excludedExercisesInput);

      const workout = generateWorkout({
        bodyPart,
        goal,
        duration,
        experienceLevel,
        equipmentAccess,
        fatiguedAreas,
        preferredExercises,
        excludedExercises,
      });

      const normalizedWorkout = normalizeLocalWorkout(workout, {
        goal,
        bodyPart,
        experienceLevel,
        duration,
        equipmentAccess,
        soreAreas,
        fatiguedAreas,
      });

      setGeneratedWorkout(normalizedWorkout);
    } catch (err) {
      console.error(err);
      setGeneratedWorkout(null);
      setError("Could not generate a workout for those settings.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleStartWorkout() {
    if (!generatedWorkout) return;

    localStorage.setItem("respawn_generated_workout", JSON.stringify(generatedWorkout));
    router.push("/Workout");
  }

  return (
    <section style={cardStyle}>
      <div style={sectionHeaderStyle}>
        <h2 style={sectionTitle}>Workout Generator</h2>
      </div>

      <p style={mutedStyle}>
        Generate a smarter workout based on your goal, time, experience, equipment, and recovery inputs.
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
            onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
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
            onChange={(e) => setEquipmentAccess(e.target.value as EquipmentAccess)}
            style={inputStyle}
          >
            {EQUIPMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Sore Areas (optional)</span>
          <input
            value={soreAreasInput}
            onChange={(e) => setSoreAreasInput(e.target.value)}
            placeholder="shoulders, knees, lower_back"
            style={inputStyle}
          />
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Fatigued Muscles (optional)</span>
          <input
            value={fatiguedAreasInput}
            onChange={(e) => setFatiguedAreasInput(e.target.value)}
            placeholder="chest, quads, triceps"
            style={inputStyle}
          />
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Preferred Exercises (optional)</span>
          <input
            value={preferredExercisesInput}
            onChange={(e) => setPreferredExercisesInput(e.target.value)}
            placeholder="bench_press, lat_pulldown"
            style={inputStyle}
          />
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Exclude Exercises (optional)</span>
          <input
            value={excludedExercisesInput}
            onChange={(e) => setExcludedExercisesInput(e.target.value)}
            placeholder="deadlift, skull_crushers"
            style={inputStyle}
          />
        </label>
      </div>

      <div style={actionRowStyle}>
        <button
          onClick={handleGenerate}
          style={isGenerating ? disabledButtonStyle : primaryButtonStyle}
          disabled={isGenerating}
        >
          {isGenerating ? "Generating..." : "Generate Workout"}
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
          <div style={previewHeaderRowStyle}>
            <div>
              <h3 style={previewTitleStyle}>{generatedWorkout.workout_name}</h3>
              <p style={mutedStyle}>
                {generatedWorkout.estimated_duration} min • {toTitleCase(experienceLevel)} • {readableEquipment}
              </p>
            </div>

            {generatedWorkout.intensityLabel && (
              <span style={badgeStyle}>{toTitleCase(generatedWorkout.intensityLabel)}</span>
            )}
          </div>

          {generatedWorkout.coachNote && (
            <div style={coachCardStyle}>
              <div style={coachLabelStyle}>Coach Note</div>
              <div style={coachTextStyle}>{generatedWorkout.coachNote}</div>
            </div>
          )}

          <div style={previewListStyle}>
            {generatedWorkout.exercises.map((exercise, index) => (
              <div key={`${exercise.exercise_name}-${index}`} style={previewItemStyle}>
                <div style={previewItemTopRowStyle}>
                  <div>
                    <div style={previewExerciseStyle}>{exercise.exercise_name}</div>
                    <div style={previewSubStyle}>
                      {exercise.sets.length} sets • {exercise.sets[0]?.reps || "--"} reps
                      {exercise.restSeconds ? ` • ${exercise.restSeconds}s rest` : ""}
                    </div>
                  </div>

                  <div style={miniMuscleTagStyle}>{toTitleCase(exercise.body_part)}</div>
                </div>

                {(exercise.coachingNote || exercise.reason) && (
                  <div style={exerciseMetaStyle}>
                    {exercise.coachingNote && (
                      <div style={exerciseNoteStyle}>{exercise.coachingNote}</div>
                    )}
                    {exercise.reason && (
                      <div style={exerciseReasonStyle}>{exercise.reason}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {!!generatedWorkout.progressionAdvice?.length && (
            <div style={tipsCardStyle}>
              <div style={tipsTitleStyle}>Progression Tips</div>
              <div style={tipsListStyle}>
                {generatedWorkout.progressionAdvice.map((tip, index) => (
                  <div key={`${tip}-${index}`} style={tipItemStyle}>
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

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
  marginBottom: "12px",
};

const sectionTitle: CSSProperties = {
  color: "#ff4d4d",
  margin: 0,
  fontSize: "18px",
  fontWeight: 800,
};

const mutedStyle: CSSProperties = {
  color: "#a5a5a5",
  margin: "6px 0 14px",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
  outline: "none",
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  marginTop: "16px",
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

const disabledButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  opacity: 0.6,
  cursor: "not-allowed",
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

const previewCardStyle: CSSProperties = {
  marginTop: "18px",
  background: "linear-gradient(135deg, rgba(255,26,26,0.10), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "18px",
  padding: "16px",
};

const previewHeaderRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  flexWrap: "wrap",
};

const previewTitleStyle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: "20px",
  fontWeight: 900,
  color: "#fff",
};

const badgeStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: "999px",
  background: "rgba(255, 77, 77, 0.14)",
  border: "1px solid rgba(255, 77, 77, 0.35)",
  color: "#ff8b8b",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const coachCardStyle: CSSProperties = {
  marginTop: "10px",
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "14px",
  padding: "12px",
};

const coachLabelStyle: CSSProperties = {
  color: "#ff6b6b",
  fontSize: "12px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: "6px",
};

const coachTextStyle: CSSProperties = {
  color: "#ececec",
  fontSize: "14px",
  lineHeight: 1.5,
};

const previewListStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  marginTop: "12px",
};

const previewItemStyle: CSSProperties = {
  padding: "12px",
  borderRadius: "14px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.05)",
};

const previewItemTopRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "10px",
};

const previewExerciseStyle: CSSProperties = {
  color: "#fff",
  fontWeight: 800,
  fontSize: "15px",
};

const previewSubStyle: CSSProperties = {
  color: "#bcbcbc",
  fontSize: "13px",
  marginTop: "4px",
};

const miniMuscleTagStyle: CSSProperties = {
  flexShrink: 0,
  padding: "6px 8px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#d6d6d6",
  fontSize: "11px",
  fontWeight: 700,
};

const exerciseMetaStyle: CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gap: "4px",
};

const exerciseNoteStyle: CSSProperties = {
  color: "#efefef",
  fontSize: "13px",
};

const exerciseReasonStyle: CSSProperties = {
  color: "#9f9f9f",
  fontSize: "12px",
};

const tipsCardStyle: CSSProperties = {
  marginTop: "14px",
  background: "rgba(0,0,0,0.18)",
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.05)",
  padding: "12px",
};

const tipsTitleStyle: CSSProperties = {
  color: "#fff",
  fontWeight: 900,
  fontSize: "14px",
  marginBottom: "8px",
};

const tipsListStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
};

const tipItemStyle: CSSProperties = {
  color: "#c9c9c9",
  fontSize: "13px",
  lineHeight: 1.45,
};

const errorStyle: CSSProperties = {
  marginTop: "12px",
  color: "#ff8b8b",
  fontWeight: 600,
};