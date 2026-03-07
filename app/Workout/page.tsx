"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { exerciseLibrary } from "@/lib/workoutGeneratorData";

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

type LibraryExercise = {
  name: string;
  bodyPart: string;
  custom?: boolean;
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

type AuthUser = {
  id: string;
  email?: string;
};

function mapPrimaryMuscleToLibraryBodyPart(muscle: string): string {
  if (muscle === "chest") return "Chest";
  if (["back", "lats", "upper_back", "lower_back"].includes(muscle)) return "Back";
  if (["quads", "hamstrings", "calves"].includes(muscle)) return "Legs";
  if (muscle === "glutes") return "Glutes";
  if (["shoulders", "front_delts", "side_delts", "rear_delts"].includes(muscle)) {
    return "Shoulders";
  }
  if (["biceps", "triceps", "forearms"].includes(muscle)) return "Arms";
  if (muscle === "core") return "Core";
  return "Other";
}

const BASE_EXERCISE_LIBRARY: LibraryExercise[] = exerciseLibrary.map((exercise) => ({
  name: exercise.name,
  bodyPart: mapPrimaryMuscleToLibraryBodyPart(exercise.primaryMuscle),
}));

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

function toNumber(value: string | number | null | undefined) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function getMostLikelyWeight(exerciseName: string, exercises: Exercise[]) {
  for (const exercise of exercises) {
    if (normalizeName(exercise.name) !== normalizeName(exerciseName)) continue;

    for (let i = exercise.sets.length - 1; i >= 0; i -= 1) {
      const set = exercise.sets[i];
      if (String(set.weight).trim() !== "") return String(set.weight);
    }
  }

  return "";
}

function getMostLikelyReps(exerciseName: string, exercises: Exercise[], fallback = "") {
  for (const exercise of exercises) {
    if (normalizeName(exercise.name) !== normalizeName(exerciseName)) continue;

    for (let i = exercise.sets.length - 1; i >= 0; i -= 1) {
      const set = exercise.sets[i];
      if (String(set.reps).trim() !== "") return String(set.reps);
    }
  }

  return fallback;
}

export default function WorkoutPage() {
  const router = useRouter();

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [finished, setFinished] = useState(false);
  const [status, setStatus] = useState("");

  const [libraryChoice, setLibraryChoice] = useState("");
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newBodyPart, setNewBodyPart] = useState("");

  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  const [recentExercises, setRecentExercises] = useState<string[]>([]);
  const [favoriteExercises, setFavoriteExercises] = useState<string[]>([]);
  const [customLibrary, setCustomLibrary] = useState<LibraryExercise[]>([]);
  const [workoutTitle, setWorkoutTitle] = useState("Build Your Session");

  const [exercises, setExercises] = useState<Exercise[]>([]);

  const exerciseCardRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    void initializeWorkoutPage();
  }, []);

  async function initializeWorkoutPage() {
    setAuthLoading(true);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      const message = error.message || "";
      if (message.includes("Invalid Refresh Token")) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      console.error("Get user error:", error);
      setStatus(`Error loading account: ${message}`);
      setAuthLoading(false);
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

    const savedRecent = localStorage.getItem("respawn_recent_exercises");
    const savedFavorites = localStorage.getItem("respawn_favorite_exercises");
    const savedCustomLibrary = localStorage.getItem("respawn_custom_exercise_library");

    const parsedRecent: string[] = savedRecent ? JSON.parse(savedRecent) : [];
    const parsedFavorites: string[] = savedFavorites ? JSON.parse(savedFavorites) : [];
    const parsedCustomLibrary: LibraryExercise[] = savedCustomLibrary
      ? JSON.parse(savedCustomLibrary)
      : [];

    setRecentExercises(parsedRecent);
    setFavoriteExercises(parsedFavorites);
    setCustomLibrary(parsedCustomLibrary);

    const rawGeneratedWorkout = localStorage.getItem("respawn_generated_workout");

    if (rawGeneratedWorkout) {
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
      } catch (loadError) {
        console.error("Failed to load generated workout:", loadError);
        setStatus("Could not load generated workout.");
      }
    }

    setAuthLoading(false);
  }

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

  useEffect(() => {
    localStorage.setItem("respawn_custom_exercise_library", JSON.stringify(customLibrary));
  }, [customLibrary]);

  const allExerciseLibrary = useMemo(() => {
    const merged = [...customLibrary, ...BASE_EXERCISE_LIBRARY];
    const seen = new Set<string>();

    return merged.filter((item) => {
      const key = normalizeName(item.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [customLibrary]);

  const libraryMap = useMemo(() => {
    const map = new Map<string, string>();
    allExerciseLibrary.forEach((item) => map.set(item.name, item.bodyPart));
    return map;
  }, [allExerciseLibrary]);

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
    topSet ? `Best set: ${topSet.exerciseName} ${topSet.weight} × ${topSet.reps}` : null,
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
    let blocked = false;

    setExercises((prev) => {
      const updated = [...prev];
      const exercise = { ...updated[exerciseIndex] };
      const sets = [...exercise.sets];
      const currentSet = sets[setIndex];

      const hasWeight = String(currentSet.weight).trim() !== "";
      const hasReps = String(currentSet.reps).trim() !== "";

      if (!hasWeight || !hasReps) {
        blocked = true;
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

    if (blocked) setStatus("Enter both weight and reps before marking a set complete.");
  }

  function addSet(exerciseIndex: number) {
    setExercises((prev) => {
      const updated = [...prev];
      const exercise = { ...updated[exerciseIndex] };

      let copiedWeight = "";
      let copiedReps = "";

      for (let i = exercise.sets.length - 1; i >= 0; i -= 1) {
        const set = exercise.sets[i];
        const hasWeight = String(set.weight).trim() !== "";
        const hasReps = String(set.reps).trim() !== "";

        if (set.completed && (hasWeight || hasReps)) {
          copiedWeight = set.weight ?? "";
          copiedReps = set.reps ?? "";
          break;
        }
      }

      if (!copiedWeight && !copiedReps) {
        for (let i = exercise.sets.length - 1; i >= 0; i -= 1) {
          const set = exercise.sets[i];
          const hasWeight = String(set.weight).trim() !== "";
          const hasReps = String(set.reps).trim() !== "";

          if (hasWeight || hasReps) {
            copiedWeight = set.weight ?? "";
            copiedReps = set.reps ?? "";
            break;
          }
        }
      }

      exercise.sets = [
        ...exercise.sets,
        {
          weight: copiedWeight,
          reps: copiedReps,
          completed: false,
        },
      ];

      updated[exerciseIndex] = exercise;
      return updated;
    });

    setStatus("Set added and copied from your previous set.");
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
      const exercise = updated[exerciseIndex];

      const defaultWeight = getMostLikelyWeight(exercise.name, prev);
      const defaultReps = getMostLikelyReps(exercise.name, prev);

      updated[exerciseIndex] = {
        ...exercise,
        sets: [{ weight: defaultWeight, reps: defaultReps, completed: false }],
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

  function saveCustomExerciseToLibrary(name: string, bodyPart: string) {
    const cleanName = name.trim();
    if (!cleanName) return;

    const alreadyExistsInBase = BASE_EXERCISE_LIBRARY.some(
      (item) => normalizeName(item.name) === normalizeName(cleanName)
    );

    if (alreadyExistsInBase) return;

    setCustomLibrary((prev) => {
      const exists = prev.some((item) => normalizeName(item.name) === normalizeName(cleanName));
      if (exists) return prev;

      return [{ name: cleanName, bodyPart: bodyPart || "Other", custom: true }, ...prev];
    });
  }

  function addExerciseFromInput(name: string, bodyPart: string) {
    const cleanName = name.trim();
    const cleanBodyPart = bodyPart || "Other";

    if (!cleanName) {
      setStatus("Enter an exercise name.");
      return;
    }

    const existsInWorkout = exercises.some(
      (ex) => normalizeName(ex.name) === normalizeName(cleanName)
    );

    if (existsInWorkout) {
      setStatus("That exercise is already in this workout.");
      return;
    }

    const defaultWeight = getMostLikelyWeight(cleanName, exercises);
    const defaultReps = getMostLikelyReps(cleanName, exercises);

    const newExercise: Exercise = {
      id: makeId(),
      name: cleanName,
      bodyPart: cleanBodyPart,
      sets: [{ weight: defaultWeight, reps: defaultReps, completed: false }],
      favorite: favoriteExercises.includes(cleanName),
    };

    setExercises((prev) => [newExercise, ...prev]);
    saveCustomExerciseToLibrary(cleanName, cleanBodyPart);
    pushRecent(cleanName);
    setNewExerciseName("");
    setNewBodyPart("");
    setLibraryChoice("");
    setStatus("Exercise added at the top.");

    setTimeout(() => {
      exerciseCardRefs.current[newExercise.id]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
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

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setStatus(`Error signing out: ${error.message}`);
      return;
    }

    router.replace("/login");
  }

  async function finishWorkout() {
    if (!authUser?.id) {
      setStatus("You must be signed in to save a workout.");
      return;
    }

    if (completedSets.length === 0) {
      setStatus("Complete at least one full set before finishing the workout.");
      return;
    }

    setStatus("Saving workout...");

    const workoutPayload = {
      user_id: authUser.id,
      workout_name: workoutTitle === "Build Your Session" ? "Custom Workout" : workoutTitle,
      duration_seconds: secondsElapsed,
      day_type: "workout",
      notes: workoutHighlights.join(" • ") || null,
    };

    const { data: workoutData, error: workoutError } = await supabase
      .from("workouts")
      .insert(workoutPayload)
      .select()
      .single();

    if (workoutError) {
      setStatus(`Error saving workout: ${workoutError.message}`);
      return;
    }

    const workoutId = workoutData?.id;

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
          user_id: authUser.id,
          exercise_name: exercise.name,
          body_part: exercise.bodyPart,
          set_number: index + 1,
          weight: set.weight,
          reps: set.reps,
        }))
    );

    const { error: setsError } = await supabase.from("workout_sets").insert(allSets);

    if (setsError) {
      setStatus(`Error saving sets: ${setsError.message}`);
      return;
    }

    setTimerRunning(false);
    exercises.forEach((exercise) => pushRecent(exercise.name));
    setStatus("Workout saved successfully.");
    setFinished(true);
  }

  if (authLoading) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <p style={eyebrowStyle}>RESPAWN WORKOUT</p>
          <h1 style={heroTitleStyle}>Loading workout...</h1>
          <p style={heroSubStyle}>Checking your account and session.</p>
        </section>
      </main>
    );
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
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Go To</h2>
          </div>

          <div style={stackedButtonWrapStyle}>
            <Link href="/dashboard" style={largePrimaryNavButtonStyle}>
              Back to Dashboard
            </Link>

            <Link href="/Profile" style={largeSecondaryNavButtonStyle}>
              Open Profile
            </Link>
          </div>
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

        <div style={accountBarStyle}>
          <div style={accountInfoStyle}>
            <span style={accountLabelStyle}>Signed in as</span>
            <span style={accountValueStyle}>{authUser?.email || authUser?.id}</span>
          </div>

          <button onClick={handleSignOut} style={secondaryButtonStyle}>
            Sign Out
          </button>
        </div>

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
          <h2 style={sectionTitle}>Go To</h2>
        </div>

        <div style={stackedButtonWrapStyle}>
          <Link href="/dashboard" style={largeSecondaryNavButtonStyle}>
            Back to Dashboard
          </Link>

          <Link href="/Profile" style={largeSecondaryNavButtonStyle}>
            Open Profile
          </Link>
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
            {allExerciseLibrary.map((exercise) => (
              <option key={exercise.name} value={exercise.name}>
                {exercise.name} • {exercise.bodyPart}
                {exercise.custom ? " • Custom" : ""}
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

        <p style={helperTextStyle}>
          New custom exercises are saved into your library automatically on this device.
        </p>

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
            Start by adding an exercise above. Then log weight, reps, and confirm each
            completed set.
          </p>
        </section>
      ) : (
        exercises.map((exercise, index) => (
          <section
            key={exercise.id}
            style={exerciseCardStyle}
            ref={(node) => {
              exerciseCardRefs.current[exercise.id] = node;
            }}
          >
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
                    inputMode="decimal"
                  />

                  <input
                    placeholder="Reps"
                    value={set.reps}
                    onChange={(e) =>
                      updateSetField(index, setIndex, "reps", e.target.value)
                    }
                    style={smallInputStyle}
                    inputMode="numeric"
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
  padding: "28px 20px 140px",
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

const accountBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginTop: "18px",
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

const stackedButtonWrapStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
};

const largePrimaryNavButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "64px",
  backgroundColor: "#ff1a1a",
  borderRadius: "14px",
  color: "white",
  textDecoration: "none",
  fontWeight: 800,
  fontSize: "16px",
};

const largeSecondaryNavButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "64px",
  backgroundColor: "#1c1c1c",
  border: "1px solid #333",
  borderRadius: "14px",
  color: "white",
  textDecoration: "none",
  fontWeight: 800,
  fontSize: "16px",
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

const helperTextStyle: CSSProperties = {
  color: "#8f8f8f",
  fontSize: "13px",
  marginTop: "12px",
  marginBottom: 0,
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