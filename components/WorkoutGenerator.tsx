"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
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
  repRange?: string;
  category?: string;
  notes?: string | null;
};

type WorkoutPayload = {
  workout_name: string;
  workoutName?: string;
  estimated_duration: number;
  estimatedDurationMinutes?: number;
  coachNote?: string;
  intensityLabel?: "easy" | "moderate" | "hard";
  progressionAdvice?: string[];
  totalWorkingSets?: number;
  workoutStyle?: string;
  exercises: WorkoutExercise[];
};

type LastWorkoutSummary = {
  workoutName: string;
  totalSets: number;
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

function toTitleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeLocalWorkout(workout: any): WorkoutPayload {
  const normalizedExercises: WorkoutExercise[] = Array.isArray(workout?.exercises)
    ? workout.exercises.map((exercise: any, index: number) => ({
        id: exercise?.id ?? `${exercise?.exercise_name ?? "exercise"}-${index}`,
        exercise_name: exercise?.exercise_name ?? exercise?.name ?? "Exercise",
        name: exercise?.exercise_name ?? exercise?.name ?? "Exercise",
        body_part: exercise?.body_part ?? exercise?.bodyPart ?? "general",
        bodyPart: exercise?.body_part ?? exercise?.bodyPart ?? "general",
        coachingNote: exercise?.coachingNote ?? "",
        reason: exercise?.reason ?? "",
        restSeconds: exercise?.restSeconds ?? null,
        targetWeight: exercise?.targetWeight ?? null,
        repRange: exercise?.repRange ?? "",
        category: exercise?.category ?? "",
        notes: exercise?.notes ?? null,
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
    estimated_duration:
      workout?.estimated_duration ?? workout?.estimatedDurationMinutes ?? 45,
    estimatedDurationMinutes:
      workout?.estimated_duration ?? workout?.estimatedDurationMinutes ?? 45,
    coachNote: workout?.coachNote ?? "",
    intensityLabel: workout?.intensityLabel ?? "moderate",
    progressionAdvice: workout?.progressionAdvice ?? [],
    totalWorkingSets: workout?.totalWorkingSets ?? 0,
    workoutStyle: workout?.workoutStyle ?? "",
    exercises: normalizedExercises,
  };
}

function getBodyPartCoachingLine(bodyPart: BodyPart) {
  if (bodyPart === "legs") {
    return "Respawn will choose the right lower-body session identity for today — quad dominant, glute + ham dominant, balanced lower, or unilateral lower.";
  }

  if (bodyPart === "back") {
    return "Respawn will choose whether today should feel more like a width day, thickness day, or balanced pull session.";
  }

  if (bodyPart === "chest") {
    return "Respawn will decide whether today should be a press-led session, upper-chest biased session, or a cleaner hypertrophy pump session.";
  }

  if (bodyPart === "shoulders") {
    return "Respawn will shape the workout around delt growth, shoulder pressing, and arm overlap when it makes sense.";
  }

  if (bodyPart === "arms") {
    return "Respawn will build an arm-focused session with enough variety to feel productive, not repetitive.";
  }

  if (bodyPart === "push") {
    return "Respawn will combine chest, shoulders, and triceps into a smarter push session built around one strong anchor.";
  }

  if (bodyPart === "pull") {
    return "Respawn will combine rows, pulldowns, rear delts, and biceps into a more complete pull workout.";
  }

  return "Respawn will build a full-body session with a strong training identity instead of random exercise filler.";
}

export default function WorkoutGenerator() {
  const router = useRouter();

  const [bodyPart, setBodyPart] = useState<BodyPart>("legs");
  const [goal, setGoal] = useState<Goal>("hypertrophy");
  const [experienceLevel, setExperienceLevel] =
    useState<ExperienceLevel>("intermediate");
  const [equipmentAccess, setEquipmentAccess] =
    useState<EquipmentAccess>("full_gym");

  const [variationIndex, setVariationIndex] = useState(0);

  const [generatedWorkout, setGeneratedWorkout] = useState<WorkoutPayload | null>(null);
  const [lastWorkout, setLastWorkout] = useState<LastWorkoutSummary | null>(null);
  const [lastWorkoutLoading, setLastWorkoutLoading] = useState(true);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const readableEquipment = useMemo(
    () => toTitleCase(equipmentAccess),
    [equipmentAccess]
  );

  const bodyPartCoachingLine = useMemo(
    () => getBodyPartCoachingLine(bodyPart),
    [bodyPart]
  );

  useEffect(() => {
    void loadLastWorkout();
  }, []);

  useEffect(() => {
    setVariationIndex(0);
    setGeneratedWorkout(null);
  }, [bodyPart, goal, experienceLevel, equipmentAccess]);

  async function loadLastWorkout() {
    setLastWorkoutLoading(true);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setLastWorkoutLoading(false);
      return;
    }

    const { data: workoutRow, error: workoutError } = await supabase
      .from("workouts")
      .select("id, workout_name")
      .eq("user_id", user.id)
      .eq("day_type", "workout")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (workoutError || !workoutRow?.id) {
      setLastWorkoutLoading(false);
      return;
    }

    const { data: setRows, error: setsError } = await supabase
      .from("workout_sets")
      .select("id")
      .eq("workout_id", workoutRow.id);

    let totalSets = 0;

    if (!setsError && Array.isArray(setRows)) {
      totalSets = setRows.length;
    }

    setLastWorkout({
      workoutName: workoutRow.workout_name || "Previous Workout",
      totalSets,
    });

    setLastWorkoutLoading(false);
  }

  function handleGenerate() {
    try {
      setIsGenerating(true);
      setError("");
      setGeneratedWorkout(null);

      const nextVariation = variationIndex + 1;
      setVariationIndex(nextVariation);

      const workout = generateWorkout({
        bodyPart,
        goal,
        duration: 60,
        experienceLevel,
        equipmentAccess,
        variationIndex: nextVariation,
      });

      setGeneratedWorkout(normalizeLocalWorkout(workout));
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

    localStorage.removeItem("respawn_active_workout_draft");
    localStorage.setItem("respawn_generated_workout", JSON.stringify(generatedWorkout));
    router.push("/Workout");
  }

  return (
    <section style={pageWrapStyle}>
      <section style={heroCardStyle}>
        <p style={eyebrowStyle}>RESPAWN TODAY</p>
        <h1 style={heroTitleStyle}>Tell Respawn what you want to train.</h1>
        <p style={heroSubStyle}>
          You choose the goal, training focus, and equipment. Respawn chooses the
          workout identity, exercise mix, and session structure.
        </p>
        <p style={heroStrongLineStyle}>
          Less guessing. Better sessions. More real progression.
        </p>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Previous Workout</h2>
        </div>

        {lastWorkoutLoading ? (
          <p style={mutedStyle}>Loading your latest session...</p>
        ) : lastWorkout ? (
          <div style={previousWorkoutCardStyle}>
            <div style={previousWorkoutTopStyle}>
              <div>
                <p style={smallMutedLabelStyle}>Last session</p>
                <h3 style={previousWorkoutTitleStyle}>{lastWorkout.workoutName}</h3>
              </div>

              <div style={previousWorkoutBadgeStyle}>Ready to beat it?</div>
            </div>

            <div style={previousWorkoutStatsRowStyle}>
              <div style={previousWorkoutStatStyle}>
                <span style={previousWorkoutStatLabelStyle}>Sets</span>
                <span style={previousWorkoutStatValueStyle}>{lastWorkout.totalSets}</span>
              </div>
            </div>
          </div>
        ) : (
          <p style={mutedStyle}>
            No previous workout logged yet. Generate your first session and start
            building momentum.
          </p>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Coach-Led Workout Generator</h2>
        </div>

        <p style={mutedStyle}>
          Pick the essentials. Respawn will choose the session identity, build the
          exercise order, and vary the workout intelligently from session to session.
        </p>

        <div style={coachExplainerStyle}>
          <div style={coachExplainerLabelStyle}>Today’s setup</div>
          <div style={coachExplainerTextStyle}>{bodyPartCoachingLine}</div>
        </div>

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
        </div>

        <div style={actionRowStyle}>
          <button
            onClick={handleGenerate}
            style={isGenerating ? disabledButtonStyle : primaryButtonStyle}
            disabled={isGenerating}
          >
            {isGenerating
              ? "Generating..."
              : generatedWorkout
              ? "Generate Another Variation"
              : "Generate Workout"}
          </button>

          {generatedWorkout && (
            <button onClick={handleStartWorkout} style={secondaryButtonStyle}>
              Start This Workout
            </button>
          )}
        </div>

        {generatedWorkout && (
          <p style={variationHintStyle}>
            Variation {variationIndex}. Same goal and setup, different valid session
            identity or exercise mix.
          </p>
        )}

        {error && <p style={errorStyle}>{error}</p>}

        {generatedWorkout && (
          <div style={previewCardStyle}>
            <div style={previewHeaderRowStyle}>
              <div>
                <h3 style={previewTitleStyle}>{generatedWorkout.workout_name}</h3>
                <p style={mutedStyle}>
                  {generatedWorkout.totalWorkingSets
                    ? `${generatedWorkout.totalWorkingSets} working sets • `
                    : ""}
                  {toTitleCase(experienceLevel)}
                  {" • "}
                  {readableEquipment}
                </p>
              </div>

              {generatedWorkout.intensityLabel && (
                <span style={badgeStyle}>
                  {toTitleCase(generatedWorkout.intensityLabel)}
                </span>
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
                        {exercise.sets.length} sets
                        {exercise.repRange
                          ? ` • ${exercise.repRange} reps`
                          : exercise.sets[0]?.reps
                          ? ` • ${exercise.sets[0]?.reps} reps`
                          : ""}
                        {exercise.restSeconds ? ` • ${exercise.restSeconds}s rest` : ""}
                      </div>
                    </div>

                    <div style={miniMuscleTagStyle}>
                      {toTitleCase(exercise.body_part)}
                    </div>
                  </div>

                  {(exercise.coachingNote || exercise.reason || exercise.notes) && (
                    <div style={exerciseMetaStyle}>
                      {exercise.coachingNote && (
                        <div style={exerciseNoteStyle}>{exercise.coachingNote}</div>
                      )}
                      {exercise.reason && (
                        <div style={exerciseReasonStyle}>{exercise.reason}</div>
                      )}
                      {exercise.notes && (
                        <div style={exerciseSpecialNoteStyle}>{exercise.notes}</div>
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

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>How Respawn Builds Your Workout</h2>
        </div>

        <div style={explanationBlockStyle}>
          <p style={explanationTextStyle}>
            Respawn now chooses the workout identity for you based on your goal,
            training focus, experience level, and equipment access.
          </p>
          <p style={explanationTextStyle}>
            Instead of forcing you to configure extra settings, Respawn handles the
            workout structure internally and builds a session that makes more sense for
            the day.
          </p>
          <p style={explanationTextStyle}>
            That means your workouts should feel more intentional, more balanced, and
            more like something a real coach would program.
          </p>
        </div>
      </section>
    </section>
  );
}

const pageWrapStyle: CSSProperties = {
  display: "grid",
  gap: "16px",
};

const heroCardStyle: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(255,26,26,0.18) 0%, rgba(20,20,20,1) 55%, rgba(10,10,10,1) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "24px",
  padding: "24px",
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
  lineHeight: 1.08,
  fontWeight: 800,
  margin: "0 0 10px",
};

const heroSubStyle: CSSProperties = {
  color: "#d4d4d4",
  fontSize: "15px",
  lineHeight: 1.55,
  margin: 0,
  maxWidth: "760px",
};

const heroStrongLineStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 700,
  margin: "14px 0 0",
};

const cardStyle: CSSProperties = {
  background: "#121212",
  border: "1px solid #222",
  borderRadius: "22px",
  padding: "20px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
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

const smallMutedLabelStyle: CSSProperties = {
  color: "#a5a5a5",
  fontSize: "12px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: "0 0 6px",
};

const previousWorkoutCardStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,255,255,0.035), rgba(255,26,26,0.04))",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "18px",
  padding: "16px",
};

const previousWorkoutTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  flexWrap: "wrap",
};

const previousWorkoutTitleStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: 800,
  margin: 0,
};

const previousWorkoutBadgeStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: "999px",
  background: "rgba(255,77,77,0.14)",
  border: "1px solid rgba(255,77,77,0.35)",
  color: "#ff8b8b",
  fontSize: "12px",
  fontWeight: 800,
};

const previousWorkoutStatsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: "10px",
  marginTop: "16px",
};

const previousWorkoutStatStyle: CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: "14px",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const previousWorkoutStatLabelStyle: CSSProperties = {
  color: "#a8a8a8",
  fontSize: "12px",
};

const previousWorkoutStatValueStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "18px",
  fontWeight: 800,
};

const coachExplainerStyle: CSSProperties = {
  marginBottom: "16px",
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "14px",
  padding: "14px",
};

const coachExplainerLabelStyle: CSSProperties = {
  color: "#ff6b6b",
  fontSize: "12px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: "6px",
};

const coachExplainerTextStyle: CSSProperties = {
  color: "#e5e5e5",
  fontSize: "14px",
  lineHeight: 1.5,
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

const variationHintStyle: CSSProperties = {
  marginTop: "12px",
  color: "#bdbdbd",
  fontSize: "13px",
};

const previewCardStyle: CSSProperties = {
  marginTop: "18px",
  background:
    "linear-gradient(135deg, rgba(255,26,26,0.10), rgba(255,255,255,0.02))",
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

const exerciseSpecialNoteStyle: CSSProperties = {
  color: "#ffb0b0",
  fontSize: "12px",
  fontWeight: 700,
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

const explanationBlockStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
};

const explanationTextStyle: CSSProperties = {
  color: "#d5d5d5",
  fontSize: "14px",
  lineHeight: 1.6,
  margin: 0,
};

const errorStyle: CSSProperties = {
  marginTop: "12px",
  color: "#ff8b8b",
  fontWeight: 600,
};