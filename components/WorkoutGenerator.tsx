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

type WorkoutStyle =
  | "balanced"
  | "bodybuilding"
  | "high_volume"
  | "old_school_mass"
  | "intensity"
  | "pump"
  | "strength_size";

type VolumeTier = "moderate" | "high" | "brutal";

type MuscleEmphasis =
  | "upper_chest"
  | "mid_chest"
  | "lower_chest"
  | "lat_width"
  | "mid_back_thickness"
  | "upper_back_detail"
  | "quad_bias"
  | "glute_bias"
  | "hamstring_bias"
  | "front_delt_bias"
  | "side_delt_bias"
  | "rear_delt_bias"
  | "tricep_long_head"
  | "bicep_peak"
  | "core_stability";

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
  emphasis?: MuscleEmphasis | "";
  exercises: WorkoutExercise[];
};

type LastWorkoutSummary = {
  workoutName: string;
  durationSeconds: number;
  createdAt: string;
  totalVolume: number;
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

const STYLE_OPTIONS: { label: string; value: WorkoutStyle }[] = [
  { label: "Balanced Hypertrophy", value: "balanced" },
  { label: "Bodybuilding", value: "bodybuilding" },
  { label: "High Volume Mass", value: "high_volume" },
  { label: "Old School Mass", value: "old_school_mass" },
  { label: "Intensity Focus", value: "intensity" },
  { label: "Pump Focus", value: "pump" },
  { label: "Strength + Size", value: "strength_size" },
];

const VOLUME_OPTIONS: { label: string; value: VolumeTier }[] = [
  { label: "Standard", value: "moderate" },
  { label: "High", value: "high" },
  { label: "Brutal", value: "brutal" },
];

const DURATION_OPTIONS = [30, 45, 60, 75, 90];

const EMPHASIS_OPTIONS: Partial<
  Record<BodyPart, { label: string; value: MuscleEmphasis }[]>
> = {
  chest: [
    { label: "Upper Chest", value: "upper_chest" },
    { label: "Mid Chest", value: "mid_chest" },
    { label: "Lower Chest", value: "lower_chest" },
  ],
  back: [
    { label: "Lat Width", value: "lat_width" },
    { label: "Mid-Back Thickness", value: "mid_back_thickness" },
    { label: "Upper Back Detail", value: "upper_back_detail" },
  ],
  legs: [
    { label: "Quad Bias", value: "quad_bias" },
    { label: "Glute Bias", value: "glute_bias" },
    { label: "Hamstring Bias", value: "hamstring_bias" },
  ],
  shoulders: [
    { label: "Front Delt Bias", value: "front_delt_bias" },
    { label: "Side Delt Bias", value: "side_delt_bias" },
    { label: "Rear Delt Bias", value: "rear_delt_bias" },
  ],
  arms: [
    { label: "Bicep Peak", value: "bicep_peak" },
    { label: "Tricep Long Head", value: "tricep_long_head" },
  ],
};

function toTitleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDurationFromSeconds(totalSeconds: number) {
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
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
    emphasis: workout?.emphasis ?? "",
    exercises: normalizedExercises,
  };
}

export default function WorkoutGenerator() {
  const router = useRouter();

  const [bodyPart, setBodyPart] = useState<BodyPart>("chest");
  const [goal, setGoal] = useState<Goal>("hypertrophy");
  const [duration, setDuration] = useState<number>(60);
  const [experienceLevel, setExperienceLevel] =
    useState<ExperienceLevel>("intermediate");
  const [equipmentAccess, setEquipmentAccess] =
    useState<EquipmentAccess>("full_gym");
  const [style, setStyle] = useState<WorkoutStyle>("bodybuilding");
  const [volumeTier, setVolumeTier] = useState<VolumeTier>("high");
  const [emphasis, setEmphasis] = useState<MuscleEmphasis | "">("");

  const [variationIndex, setVariationIndex] = useState(0);

  const [generatedWorkout, setGeneratedWorkout] = useState<WorkoutPayload | null>(null);
  const [lastWorkout, setLastWorkout] = useState<LastWorkoutSummary | null>(null);
  const [lastWorkoutLoading, setLastWorkoutLoading] = useState(true);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const readableEquipment = useMemo(() => toTitleCase(equipmentAccess), [equipmentAccess]);
  const emphasisOptions = EMPHASIS_OPTIONS[bodyPart] ?? [];

  useEffect(() => {
    void loadLastWorkout();
  }, []);

  useEffect(() => {
    setVariationIndex(0);
    setGeneratedWorkout(null);
  }, [bodyPart, goal, duration, experienceLevel, equipmentAccess, style, volumeTier, emphasis]);

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
      .select("id, workout_name, duration_seconds, created_at")
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
      .select("weight, reps")
      .eq("workout_id", workoutRow.id);

    let totalVolume = 0;
    let totalSets = 0;

    if (!setsError && Array.isArray(setRows)) {
      totalSets = setRows.length;
      totalVolume = setRows.reduce((sum, row) => {
        const weight = Number(row.weight ?? 0);
        const reps = Number(row.reps ?? 0);
        const volume = Number.isFinite(weight) && Number.isFinite(reps) ? weight * reps : 0;
        return sum + volume;
      }, 0);
    }

    setLastWorkout({
      workoutName: workoutRow.workout_name || "Previous Workout",
      durationSeconds: workoutRow.duration_seconds || 0,
      createdAt: workoutRow.created_at || "",
      totalVolume,
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
        duration,
        experienceLevel,
        equipmentAccess,
        style,
        volumeTier,
        emphasis,
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
        <h1 style={heroTitleStyle}>Your body decides the path.</h1>
        <p style={heroSubStyle}>
          Train hard and generate a session built for progression, or take the day to
          recover so tomorrow’s performance stays elite.
        </p>
        <p style={heroStrongLineStyle}>
          Training builds the strength. Recovery unlocks it.
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
                <span style={previousWorkoutStatLabelStyle}>Volume</span>
                <span style={previousWorkoutStatValueStyle}>
                  {lastWorkout.totalVolume.toLocaleString()}
                </span>
              </div>
              <div style={previousWorkoutStatStyle}>
                <span style={previousWorkoutStatLabelStyle}>Duration</span>
                <span style={previousWorkoutStatValueStyle}>
                  {formatDurationFromSeconds(lastWorkout.durationSeconds)}
                </span>
              </div>
              <div style={previousWorkoutStatStyle}>
                <span style={previousWorkoutStatLabelStyle}>Sets</span>
                <span style={previousWorkoutStatValueStyle}>{lastWorkout.totalSets}</span>
              </div>
            </div>
          </div>
        ) : (
          <p style={mutedStyle}>
            No previous workout logged yet. Generate your first session and start building
            momentum.
          </p>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Workout Generator</h2>
        </div>

        <p style={mutedStyle}>
          Choose your focus, training style, and setup. Respawn will build a smarter
          session designed for progression.
        </p>

        <div style={formGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Body Part</span>
            <select
              value={bodyPart}
              onChange={(e) => {
                const nextBodyPart = e.target.value as BodyPart;
                setBodyPart(nextBodyPart);
                setEmphasis("");
              }}
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
            <span style={labelStyle}>Workout Style</span>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value as WorkoutStyle)}
              style={inputStyle}
            >
              {STYLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Volume</span>
            <select
              value={volumeTier}
              onChange={(e) => setVolumeTier(e.target.value as VolumeTier)}
              style={inputStyle}
            >
              {VOLUME_OPTIONS.map((option) => (
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
            <span style={labelStyle}>Focus / Emphasis</span>
            <select
              value={emphasis}
              onChange={(e) => setEmphasis(e.target.value as MuscleEmphasis | "")}
              style={inputStyle}
              disabled={emphasisOptions.length === 0}
            >
              <option value="">No special focus</option>
              {emphasisOptions.map((option) => (
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
            Variation {variationIndex}. Same inputs, different valid exercise mix.
          </p>
        )}

        {error && <p style={errorStyle}>{error}</p>}

        {generatedWorkout && (
          <div style={previewCardStyle}>
            <div style={previewHeaderRowStyle}>
              <div>
                <h3 style={previewTitleStyle}>{generatedWorkout.workout_name}</h3>
                <p style={mutedStyle}>
                  {generatedWorkout.estimated_duration} min
                  {generatedWorkout.totalWorkingSets
                    ? ` • ${generatedWorkout.totalWorkingSets} working sets`
                    : ""}
                  {generatedWorkout.workoutStyle
                    ? ` • ${generatedWorkout.workoutStyle}`
                    : ""}
                  {" • "}
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
            Respawn generates workouts using your goal, training style, experience level,
            time available, and equipment access.
          </p>
          <p style={explanationTextStyle}>
            Each session balances compound lifts and accessory work, sets rep ranges for
            progression, and recommends rest times so you can train effectively and improve
            week to week.
          </p>
          <p style={explanationTextStyle}>
            Respawn also looks at your previous workouts to understand what you trained last
            and helps structure the next session to keep your training balanced and
            progressing.
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
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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