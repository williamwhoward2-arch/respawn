"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type SetEntry = {
  weight: string;
  reps: string;
  completed?: boolean;
};

type Exercise = {
  id: string;
  name: string;
  bodyPart: string;
  sets: SetEntry[];
  favorite?: boolean;
};

type GeneratedWorkoutPayload = {
  workout_name: string;
  body_part: string;
  estimated_duration: number;
  exercises: {
    exercise_name: string;
    body_part: string;
    sets: {
      set_number: number;
      weight: string;
      reps: string;
    }[];
  }[];
};

const EXERCISE_LIBRARY = [
  { name: "Bench Press", bodyPart: "Chest" },
  { name: "Incline Bench Press", bodyPart: "Chest" },
  { name: "Machine Chest Press", bodyPart: "Chest" },
  { name: "Cable Fly", bodyPart: "Chest" },
  { name: "Lat Pulldown", bodyPart: "Back" },
  { name: "Barbell Row", bodyPart: "Back" },
  { name: "Seated Cable Row", bodyPart: "Back" },
  { name: "Pull-Up", bodyPart: "Back" },
  { name: "Squat", bodyPart: "Legs" },
  { name: "Leg Press", bodyPart: "Legs" },
  { name: "RDL", bodyPart: "Legs" },
  { name: "Leg Curl", bodyPart: "Legs" },
  { name: "Overhead Press", bodyPart: "Shoulders" },
  { name: "Lateral Raise", bodyPart: "Shoulders" },
  { name: "Rear Delt Fly", bodyPart: "Shoulders" },
  { name: "Barbell Curl", bodyPart: "Arms" },
  { name: "Hammer Curl", bodyPart: "Arms" },
  { name: "Tricep Pushdown", bodyPart: "Arms" },
  { name: "Skullcrusher", bodyPart: "Arms" },
  { name: "Crunch", bodyPart: "Core" },
  { name: "Plank", bodyPart: "Core" },
  { name: "Hip Thrust", bodyPart: "Glutes" },
  { name: "Glute Bridge", bodyPart: "Glutes" },
];

const BODY_PARTS = [
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
  "Core",
  "Glutes",
  "Push",
  "Pull",
  "Full Body",
  "Other",
];

function formatTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatBodyPart(value: string) {
  switch (value) {
    case "chest":
      return "Chest";
    case "back":
      return "Back";
    case "legs":
      return "Legs";
    case "shoulders":
      return "Shoulders";
    case "arms":
      return "Arms";
    case "core":
      return "Core";
    case "glutes":
      return "Glutes";
    case "push":
      return "Push";
    case "pull":
      return "Pull";
    case "full_body":
      return "Full Body";
    default:
      return value;
  }
}

function toNumber(value: string | null | undefined) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export default function WorkoutPage() {
  const [finished, setFinished] = useState(false);
  const [status, setStatus] = useState("");

  const [libraryChoice, setLibraryChoice] = useState("");
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newBodyPart, setNewBodyPart] = useState("");

  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  const [recentExercises, setRecentExercises] = useState<string[]>([]);
  const [favoriteExercises, setFavoriteExercises] = useState<string[]>([]);
  const [workoutTitle, setWorkoutTitle] = useState("Build Your Session");

  const [exercises, setExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    const savedRecent = localStorage.getItem("respawn_recent_exercises");
    const savedFavorites = localStorage.getItem("respawn_favorite_exercises");

    const parsedRecent: string[] = savedRecent ? JSON.parse(savedRecent) : [];
    const parsedFavorites: string[] = savedFavorites ? JSON.parse(savedFavorites) : [];

    setRecentExercises(parsedRecent);
    setFavoriteExercises(parsedFavorites);

    const rawGeneratedWorkout = localStorage.getItem("respawn_generated_workout");

    if (!rawGeneratedWorkout) return;

    try {
      const parsed: GeneratedWorkoutPayload = JSON.parse(rawGeneratedWorkout);

      const mappedExercises: Exercise[] = parsed.exercises.map((exercise) => ({
        id: makeId(),
        name: exercise.exercise_name,
        bodyPart: formatBodyPart(exercise.body_part),
        sets:
          exercise.sets.length > 0
            ? exercise.sets.map((set) => ({
                weight: set.weight ?? "",
                reps: set.reps ?? "",
                completed: false,
              }))
            : [{ weight: "", reps: "", completed: false }],
        favorite: parsedFavorites.includes(exercise.exercise_name),
      }));

      if (mappedExercises.length > 0) {
        setExercises(mappedExercises);
        setWorkoutTitle(parsed.workout_name || "Generated Workout");
        setStatus(`${parsed.workout_name} loaded.`);
      }

      localStorage.removeItem("respawn_generated_workout");
    } catch (error) {
      console.error("Failed to load generated workout:", error);
      setStatus("Could not load generated workout.");
    }
  }, []);

  useEffect(() => {
    if (!timerRunning) return;

    const interval = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    localStorage.setItem("respawn_recent_exercises", JSON.stringify(recentExercises));
  }, [recentExercises]);

  useEffect(() => {
    localStorage.setItem("respawn_favorite_exercises", JSON.stringify(favoriteExercises));
  }, [favoriteExercises]);

  const libraryMap = useMemo(() => {
    const map = new Map<string, string>();
    EXERCISE_LIBRARY.forEach((item) => map.set(item.name, item.bodyPart));
    return map;
  }, []);

  const completedSets = useMemo(() => {
    return exercises.flatMap((exercise) =>
      exercise.sets
        .filter(
          (set) =>
            set.completed &&
            String(set.weight).trim() !== "" &&
            String(set.reps).trim() !== ""
        )
        .map((set) => ({
          exerciseName: exercise.name,
          bodyPart: exercise.bodyPart,
          weight: set.weight,
          reps: set.reps,
          volume: toNumber(set.weight) * toNumber(set.reps),
        }))
    );
  }, [exercises]);

  const totalSets = completedSets.length;
  const totalReps = completedSets.reduce((sum, set) => sum + toNumber(set.reps), 0);
  const totalVolume = completedSets.reduce((sum, set) => sum + set.volume, 0);

  const topSet = completedSets.reduce<(typeof completedSets)[number] | null>(
    (best, current) => {
      if (!best || current.volume > best.volume) return current;
      return best;
    },
    null
  );

  const topExerciseByVolume = Object.entries(
    completedSets.reduce<Record<string, number>>((acc, set) => {
      acc[set.exerciseName] = (acc[set.exerciseName] || 0) + set.volume;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0];

  const workoutHighlights = [
    topSet
      ? `Best set: ${topSet.exerciseName} ${topSet.weight} × ${topSet.reps}`
      : null,
    topExerciseByVolume
      ? `Top volume exercise: ${topExerciseByVolume[0]} (${topExerciseByVolume[1]} total volume)`
      : null,
  ].filter(Boolean) as string[];

  function updateSetField(
    exerciseIndex: number,
    setIndex: number,
    field: "weight" | "reps",
    value: string
  ) {
    setExercises((prev) => {
      const updated = [...prev];
      const exercise = { ...updated[exerciseIndex] };
      const sets = [...exercise.sets];

      sets[setIndex] = {
        ...sets[setIndex],
        [field]: value,
        completed: false,
      };

      exercise.sets = sets;
      updated[exerciseIndex] = exercise;
      return updated;
    });
  }

  function toggleSetCompleted(exerciseIndex: number, setIndex: number) {
    setExercises((prev) => {
      const updated = [...prev];
      const exercise = { ...updated[exerciseIndex] };
      const sets = [...exercise.sets];
      const currentSet = sets[setIndex];

      const hasWeight = String(currentSet.weight).trim() !== "";
      const hasReps = String(currentSet.reps).trim() !== "";

      if (!hasWeight || !hasReps) {
        setStatus("Enter both weight and reps before marking a set complete.");
        return prev;
      }

      sets[setIndex] = {
        ...currentSet,
        completed: !currentSet.completed,
      };

      exercise.sets = sets;
      updated[exerciseIndex] = exercise;
      return updated;
    });
  }

  function addSet(exerciseIndex: number) {
    setExercises((prev) => {
      const updated = [...prev];
      const exercise = { ...updated[exerciseIndex] };
      exercise.sets = [...exercise.sets, { weight: "", reps: "", completed: false }];
      updated[exerciseIndex] = exercise;
      return updated;
    });

    setStatus("Set added.");
  }

  function removeSet(exerciseIndex: number, setIndex: number) {
    setExercises((prev) => {
      const updated = [...prev];
      const exercise = { ...updated[exerciseIndex] };
      exercise.sets = exercise.sets.filter((_, i) => i !== setIndex);

      if (exercise.sets.length === 0) {
        exercise.sets = [{ weight: "", reps: "", completed: false }];
      }

      updated[exerciseIndex] = exercise;
      return updated;
    });

    setStatus("Set removed.");
  }

  function resetExerciseSets(exerciseIndex: number) {
    setExercises((prev) => {
      const updated = [...prev];
      updated[exerciseIndex] = {
        ...updated[exerciseIndex],
        sets: [{ weight: "", reps: "", completed: false }],
      };
      return updated;
    });

    setStatus("Exercise sets reset.");
  }

  function removeExercise(exerciseIndex: number) {
    setExercises((prev) => {
      const removed = prev[exerciseIndex]?.name;
      const updated = prev.filter((_, i) => i !== exerciseIndex);
      setStatus(removed ? `${removed} removed.` : "Exercise removed.");
      return updated;
    });
  }

  function pushRecent(name: string) {
    setRecentExercises((prev) => {
      const next = [name, ...prev.filter((item) => item !== name)];
      return next.slice(0, 8);
    });
  }

  function addExerciseFromInput(name: string, bodyPart: string) {
    const cleanName = name.trim();

    if (!cleanName) {
      setStatus("Enter an exercise name.");
      return;
    }

    const exists = exercises.some(
      (ex) => ex.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (exists) {
      setStatus("That exercise is already in this workout.");
      return;
    }

    const newExercise: Exercise = {
      id: makeId(),
      name: cleanName,
      bodyPart: bodyPart || "Other",
      sets: [{ weight: "", reps: "", completed: false }],
      favorite: favoriteExercises.includes(cleanName),
    };

    setExercises((prev) => [...prev, newExercise]);
    pushRecent(cleanName);
    setNewExerciseName("");
    setNewBodyPart("");
    setLibraryChoice("");
    setStatus("Exercise added.");
  }

  function addExercise() {
    if (libraryChoice) {
      addExerciseFromInput(libraryChoice, libraryMap.get(libraryChoice) || "Other");
      return;
    }

    addExerciseFromInput(newExerciseName, newBodyPart || "Other");
  }

  function addRecentExercise(name: string) {
    addExerciseFromInput(name, libraryMap.get(name) || "Other");
  }

  function toggleFavorite(name: string) {
    setFavoriteExercises((prev) => {
      const exists = prev.includes(name);

      if (exists) {
        setStatus(`${name} removed from favorites.`);
        return prev.filter((item) => item !== name);
      }

      setStatus(`${name} added to favorites.`);
      return [name, ...prev];
    });
  }

  function startTimer() {
    setTimerRunning(true);
    setStatus("Timer started.");
  }

  function stopTimer() {
    setTimerRunning(false);
    setStatus("Timer stopped.");
  }

  function resetTimer() {
    setTimerRunning(false);
    setSecondsElapsed(0);
    setStatus("Timer reset.");
  }

  async function finishWorkout() {
    setStatus("Saving workout...");

    if (completedSets.length === 0) {
      setStatus("Complete at least one full set before finishing the workout.");
      return;
    }

    const workoutPayload = {
      workout_name:
        workoutTitle === "Build Your Session" ? "Custom Workout" : workoutTitle,
      duration_seconds: secondsElapsed,
    };

    const { data: workoutData, error: workoutError } = await supabase
      .from("workouts")
      .insert([workoutPayload])
      .select();

    if (workoutError) {
      console.error("Workout save error:", workoutError);
      setStatus(`Error saving workout: ${workoutError.message}`);
      return;
    }

    const workoutId = workoutData?.[0]?.id;

    if (!workoutId) {
      setStatus("Workout saved, but no workout ID was returned.");
      return;
    }

    const allSets = exercises.flatMap((exercise) =>
      exercise.sets
        .filter(
          (set) =>
            set.completed &&
            String(set.weight).trim() !== "" &&
            String(set.reps).trim() !== ""
        )
        .map((set, index) => ({
          workout_id: workoutId,
          exercise_name: exercise.name,
          body_part: exercise.bodyPart,
          set_number: index + 1,
          weight: set.weight,
          reps: set.reps,
        }))
    );

    if (allSets.length === 0) {
      setStatus("No completed sets to save.");
      return;
    }

    const { error: setsError } = await supabase.from("workout_sets").insert(allSets);

    if (setsError) {
      console.error("Set save error:", setsError);
      setStatus(`Error saving sets: ${setsError.message}`);
      return;
    }

    setTimerRunning(false);
    exercises.forEach((exercise) => pushRecent(exercise.name));
    setStatus("Workout saved to Supabase.");
    setFinished(true);
  }

  if (finished) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <p style={eyebrowStyle}>WORKOUT COMPLETE</p>
          <h1 style={heroTitleStyle}>Session Logged</h1>
          <p style={heroSubStyle}>
            {totalSets} sets • {totalReps} reps • {totalVolume} total volume
          </p>
          <p style={{ ...heroSubStyle, marginTop: 8 }}>Duration {formatTime(secondsElapsed)}</p>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Workout Results</h2>
          </div>

          <div style={heroStatsRow}>
            <div style={heroStatBox}>
              <span style={heroStatLabel}>Sets</span>
              <span style={heroStatValue}>{totalSets}</span>
            </div>
            <div style={heroStatBox}>
              <span style={heroStatLabel}>Reps</span>
              <span style={heroStatValue}>{totalReps}</span>
            </div>
            <div style={heroStatBox}>
              <span style={heroStatLabel}>Volume</span>
              <span style={heroStatValue}>{totalVolume}</span>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Highlights</h2>
          </div>

          {workoutHighlights.length > 0 ? (
            <div style={listStyle}>
              {workoutHighlights.map((item, index) => (
                <div key={index} style={listItemStyle}>
                  <div style={listLineStyle} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={mutedStyle}>No highlights yet.</p>
          )}
        </section>

        <section style={cardStyle}>
          {exercises.map((exercise) => {
            const completedExerciseSets = exercise.sets.filter(
              (set) =>
                set.completed &&
                String(set.weight).trim() !== "" &&
                String(set.reps).trim() !== ""
            );

            return (
              <div key={exercise.id} style={{ marginBottom: 18 }}>
                <h2 style={exerciseTitleStyle}>{exercise.name}</h2>
                <p style={exerciseBodyPartStyle}>{exercise.bodyPart}</p>

                {completedExerciseSets.length === 0 ? (
                  <p style={mutedStyle}>No completed sets logged.</p>
                ) : (
                  completedExerciseSets.map((set, index) => (
                    <div key={index} style={setRowStyle}>
                      <span>Set {index + 1}</span>
                      <span>
                        {set.weight} lbs × {set.reps}
                      </span>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </section>

        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <Link href="/dashboard" style={navButtonPrimary}>
            Back to Dashboard
          </Link>
          <Link href="/Today" style={navButtonSecondary}>
            Back to Today
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <p style={eyebrowStyle}>RESPAWN WORKOUT</p>
        <h1 style={heroTitleStyle}>{workoutTitle}</h1>
        <p style={heroSubStyle}>
          Add exercises, enter your actual sets, then confirm each set when it is done.
        </p>

        <div style={heroStatsRow}>
          <div style={heroStatBox}>
            <span style={heroStatLabel}>Duration</span>
            <span style={heroStatValue}>{formatTime(secondsElapsed)}</span>
          </div>
          <div style={heroStatBox}>
            <span style={heroStatLabel}>Exercises</span>
            <span style={heroStatValue}>{exercises.length}</span>
          </div>
          <div style={heroStatBox}>
            <span style={heroStatLabel}>Completed Sets</span>
            <span style={heroStatValue}>{totalSets}</span>
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Workout Timer</h2>
        </div>

        <div style={timerDisplayStyle}>{formatTime(secondsElapsed)}</div>

        <div style={buttonRowStyle}>
          <button onClick={startTimer} style={primaryButtonStyle}>
            Start
          </button>
          <button onClick={stopTimer} style={secondaryButtonStyle}>
            Stop
          </button>
          <button onClick={resetTimer} style={dangerButtonStyle}>
            Reset
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Add Exercise</h2>
        </div>

        <div style={inputGridStyle}>
          <select
            value={libraryChoice}
            onChange={(e) => setLibraryChoice(e.target.value)}
            style={selectStyle}
          >
            <option value="">Choose from library</option>
            {EXERCISE_LIBRARY.map((exercise) => (
              <option key={exercise.name} value={exercise.name}>
                {exercise.name} • {exercise.bodyPart}
              </option>
            ))}
          </select>

          <input
            placeholder="Or type custom exercise"
            value={newExerciseName}
            onChange={(e) => setNewExerciseName(e.target.value)}
            style={inputStyle}
          />

          <select
            value={newBodyPart}
            onChange={(e) => setNewBodyPart(e.target.value)}
            style={selectStyle}
          >
            <option value="">Select body part</option>
            {BODY_PARTS.map((part) => (
              <option key={part} value={part}>
                {part}
              </option>
            ))}
          </select>

          <button onClick={addExercise} style={primaryButtonStyle}>
            Add Exercise
          </button>
        </div>

        {favoriteExercises.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <p style={subtleLabelStyle}>Favorites</p>
            <div style={chipWrapStyle}>
              {favoriteExercises.map((name) => (
                <button
                  key={name}
                  onClick={() => addRecentExercise(name)}
                  style={chipButtonStyle}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {recentExercises.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <p style={subtleLabelStyle}>Recent</p>
            <div style={chipWrapStyle}>
              {recentExercises.map((name) => (
                <button
                  key={name}
                  onClick={() => addRecentExercise(name)}
                  style={chipButtonStyle}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {exercises.length === 0 ? (
        <section style={emptyStateCardStyle}>
          <h2 style={emptyStateTitleStyle}>No exercises added yet</h2>
          <p style={emptyStateTextStyle}>
            Start by adding an exercise above. Then log weight, reps, and confirm each completed set.
          </p>
        </section>
      ) : (
        exercises.map((exercise, index) => (
          <section key={exercise.id} style={exerciseCardStyle}>
            <div style={exerciseTopRowStyle}>
              <div>
                <h2 style={exerciseTitleStyle}>{exercise.name}</h2>
                <p style={exerciseBodyPartStyle}>{exercise.bodyPart}</p>
              </div>

              <div style={buttonRowStyle}>
                <button
                  onClick={() => toggleFavorite(exercise.name)}
                  style={secondaryButtonStyle}
                >
                  {favoriteExercises.includes(exercise.name) ? "Unfavorite" : "Favorite"}
                </button>
                <button
                  onClick={() => resetExerciseSets(index)}
                  style={secondaryButtonStyle}
                >
                  Reset Sets
                </button>
                <button
                  onClick={() => removeExercise(index)}
                  style={dangerButtonStyle}
                >
                  Remove
                </button>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <h3 style={setsHeaderStyle}>Sets</h3>

              {exercise.sets.map((set, setIndex) => (
                <div key={setIndex} style={editableSetRowStyle}>
                  <span style={setNumberStyle}>Set {setIndex + 1}</span>

                  <input
                    placeholder="Weight"
                    value={set.weight}
                    onChange={(e) =>
                      updateSetField(index, setIndex, "weight", e.target.value)
                    }
                    style={smallInputStyle}
                  />

                  <input
                    placeholder="Reps"
                    value={set.reps}
                    onChange={(e) =>
                      updateSetField(index, setIndex, "reps", e.target.value)
                    }
                    style={smallInputStyle}
                  />

                  <button
                    onClick={() => toggleSetCompleted(index, setIndex)}
                    style={set.completed ? completeButtonActiveStyle : completeButtonStyle}
                  >
                    {set.completed ? "Completed" : "Complete Set"}
                  </button>

                  <button
                    onClick={() => removeSet(index, setIndex)}
                    style={dangerButtonStyle}
                  >
                    Remove Set
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <button onClick={() => addSet(index)} style={primaryButtonStyle}>
                Add Set
              </button>
            </div>
          </section>
        ))
      )}

      {status && <p style={statusStyle}>{status}</p>}

      <button onClick={finishWorkout} style={finishButtonStyle}>
        Finish Workout
      </button>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #050505 0%, #0a0a0a 35%, #0f0f0f 100%)",
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
  display: "flex",
  flexDirection: "column",
};

const heroStatLabel: CSSProperties = {
  color: "#aaaaaa",
  fontSize: "12px",
  marginBottom: "6px",
};

const heroStatValue: CSSProperties = {
  color: "#ffffff",
  fontSize: "18px",
  fontWeight: 800,
};

const cardStyle: CSSProperties = {
  background: "#121212",
  border: "1px solid #222",
  borderRadius: "22px",
  padding: "20px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  marginBottom: "16px",
};

const exerciseCardStyle: CSSProperties = {
  background: "#121212",
  border: "1px solid #222",
  borderRadius: "22px",
  padding: "20px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  marginBottom: "16px",
};

const emptyStateCardStyle: CSSProperties = {
  background: "#121212",
  border: "1px dashed #333",
  borderRadius: "22px",
  padding: "28px 20px",
  textAlign: "center",
  marginBottom: "16px",
};

const emptyStateTitleStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: 800,
  margin: "0 0 8px",
};

const emptyStateTextStyle: CSSProperties = {
  color: "#9d9d9d",
  fontSize: "15px",
  margin: 0,
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

const timerDisplayStyle: CSSProperties = {
  fontSize: "36px",
  fontWeight: 900,
  color: "#ffffff",
  marginTop: "8px",
  marginBottom: "16px",
  letterSpacing: "0.04em",
};

const inputGridStyle: CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "12px",
};

const inputStyle: CSSProperties = {
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #2a2a2a",
  backgroundColor: "#1c1c1c",
  color: "white",
  minWidth: "140px",
};

const smallInputStyle: CSSProperties = {
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #2a2a2a",
  backgroundColor: "#1c1c1c",
  color: "white",
  minWidth: "90px",
};

const selectStyle: CSSProperties = {
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #2a2a2a",
  backgroundColor: "#1c1c1c",
  color: "white",
  minWidth: "180px",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const primaryButtonStyle: CSSProperties = {
  backgroundColor: "#ff1a1a",
  border: "none",
  padding: "10px 16px",
  borderRadius: "10px",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  backgroundColor: "#2a2a2a",
  border: "1px solid #3a3a3a",
  padding: "10px 16px",
  borderRadius: "10px",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerButtonStyle: CSSProperties = {
  backgroundColor: "#661111",
  border: "1px solid #772222",
  padding: "10px 16px",
  borderRadius: "10px",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const completeButtonStyle: CSSProperties = {
  backgroundColor: "#1f3b2d",
  border: "1px solid #2f5a43",
  padding: "10px 16px",
  borderRadius: "10px",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const completeButtonActiveStyle: CSSProperties = {
  backgroundColor: "#28a745",
  border: "1px solid #34c759",
  padding: "10px 16px",
  borderRadius: "10px",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const navButtonPrimary: CSSProperties = {
  backgroundColor: "#ff1a1a",
  color: "white",
  padding: "12px 18px",
  borderRadius: "10px",
  textDecoration: "none",
  fontWeight: 700,
};

const navButtonSecondary: CSSProperties = {
  backgroundColor: "#222",
  color: "white",
  padding: "12px 18px",
  borderRadius: "10px",
  textDecoration: "none",
  fontWeight: 700,
};

const exerciseTopRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  flexWrap: "wrap",
};

const exerciseTitleStyle: CSSProperties = {
  color: "#ff4d4d",
  margin: "0 0 4px",
  fontSize: "22px",
  fontWeight: 800,
};

const exerciseBodyPartStyle: CSSProperties = {
  color: "#999",
  margin: 0,
};

const setsHeaderStyle: CSSProperties = {
  marginBottom: "10px",
  color: "#ffffff",
};

const editableSetRowStyle: CSSProperties = {
  marginTop: "10px",
  color: "#ddd",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  padding: "10px 0",
  borderBottom: "1px solid #222",
};

const setRowStyle: CSSProperties = {
  marginTop: "8px",
  color: "#ddd",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  padding: "10px 0",
  borderBottom: "1px solid #222",
};

const setNumberStyle: CSSProperties = {
  minWidth: "60px",
  color: "#efefef",
  fontWeight: 700,
};

const chipWrapStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const chipButtonStyle: CSSProperties = {
  backgroundColor: "#1d1d1d",
  border: "1px solid #333",
  color: "#efefef",
  padding: "8px 12px",
  borderRadius: "999px",
  cursor: "pointer",
};

const subtleLabelStyle: CSSProperties = {
  color: "#a8a8a8",
  fontSize: "13px",
  marginBottom: "8px",
};

const mutedStyle: CSSProperties = {
  color: "#999",
};

const statusStyle: CSSProperties = {
  color: "#cccccc",
  marginBottom: "16px",
};

const finishButtonStyle: CSSProperties = {
  width: "100%",
  backgroundColor: "#ff1a1a",
  border: "none",
  padding: "16px 18px",
  borderRadius: "12px",
  color: "white",
  fontWeight: 800,
  fontSize: "16px",
  cursor: "pointer",
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
};

const listItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  color: "#efefef",
};

const listLineStyle: CSSProperties = {
  width: "10px",
  height: "2px",
  background: "#ff4d4d",
  borderRadius: "999px",
  flexShrink: 0,
};