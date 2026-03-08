"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { exerciseLibrary } from "@/lib/workoutGeneratorData";

type SetEntry = {
  weight: string;
  reps: string;
  completed?: boolean;
};

type CardioEntry = {
  id: string;
  method: string;
  miles: string;
  minutes: string;
  seconds: string;
  completed?: boolean;
  notes?: string;
};

type Exercise = {
  id: string;
  name: string;
  bodyPart: string;
  sets: SetEntry[];
  favorite?: boolean;
  restSeconds?: number;
  repRange?: string;
  coachingNote?: string;
  reason?: string;
  notes?: string | null;
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
    restSeconds?: number;
    repRange?: string;
    coachingNote?: string;
    reason?: string;
    notes?: string | null;
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

type ExerciseHistorySnapshot = {
  exerciseName: string;
  bodyPart: string;
  lastWeight: string;
  lastReps: string;
  bestWeight: string;
  bestReps: string;
};

type ExerciseHistoryMap = Record<string, ExerciseHistorySnapshot>;

type AiSuggestion = {
  weight: string;
  reps: string;
  reason: string;
};

type SavedWorkoutState = {
  workoutTitle: string;
  exercises: Exercise[];
  cardioEntries: CardioEntry[];
  secondsElapsed: number;
  timerRunning: boolean;
  libraryChoice: string;
  newExerciseName: string;
  newBodyPart: string;
  addExerciseMode: "library" | "custom" | "bodypart";
  bodyPartChoice: string;
};

const CARDIO_METHODS = [
  "Treadmill Walk",
  "Treadmill Run",
  "Jog",
  "Outdoor Run",
  "Bike",
  "Spin Bike",
  "Stairmaster",
  "Elliptical",
  "Rowing Machine",
  "Swimming",
  "Incline Walk",
  "Hiking",
  "Sled Push",
  "Jump Rope",
  "Assault Bike",
  "SkiErg",
  "Ruck Walk",
  "Prowler Push",
  "Other",
];

const WORKOUT_DRAFT_KEY = "respawn_active_workout_draft";

const EXPANDED_EXERCISE_LIBRARY: LibraryExercise[] = [
  { name: "Flat Barbell Bench Press", bodyPart: "Chest" },
  { name: "Incline Barbell Bench Press", bodyPart: "Chest" },
  { name: "Decline Bench Press", bodyPart: "Chest" },
  { name: "Machine Chest Press", bodyPart: "Chest" },
  { name: "Smith Machine Bench Press", bodyPart: "Chest" },
  { name: "Incline Dumbbell Press", bodyPart: "Chest" },
  { name: "Flat Dumbbell Press", bodyPart: "Chest" },
  { name: "Chest Fly Machine", bodyPart: "Chest" },
  { name: "Cable Fly", bodyPart: "Chest" },
  { name: "High to Low Cable Fly", bodyPart: "Chest" },
  { name: "Low to High Cable Fly", bodyPart: "Chest" },
  { name: "Pec Deck", bodyPart: "Chest" },
  { name: "Push-Up", bodyPart: "Chest" },
  { name: "Weighted Push-Up", bodyPart: "Chest" },

  { name: "Pull-Up", bodyPart: "Back" },
  { name: "Weighted Pull-Up", bodyPart: "Back" },
  { name: "Chin-Up", bodyPart: "Back" },
  { name: "Lat Pulldown", bodyPart: "Back" },
  { name: "Wide Grip Lat Pulldown", bodyPart: "Back" },
  { name: "Neutral Grip Pulldown", bodyPart: "Back" },
  { name: "Single Arm Lat Pulldown", bodyPart: "Back" },
  { name: "Barbell Row", bodyPart: "Back" },
  { name: "Pendlay Row", bodyPart: "Back" },
  { name: "Chest Supported Row", bodyPart: "Back" },
  { name: "Seated Cable Row", bodyPart: "Back" },
  { name: "T-Bar Row", bodyPart: "Back" },
  { name: "Machine Row", bodyPart: "Back" },
  { name: "Single Arm Dumbbell Row", bodyPart: "Back" },
  { name: "Straight Arm Pulldown", bodyPart: "Back" },
  { name: "Deadlift", bodyPart: "Back" },
  { name: "Rack Pull", bodyPart: "Back" },
  { name: "Back Extension", bodyPart: "Back" },

  { name: "Back Squat", bodyPart: "Legs" },
  { name: "Front Squat", bodyPart: "Legs" },
  { name: "Hack Squat", bodyPart: "Legs" },
  { name: "Leg Press", bodyPart: "Legs" },
  { name: "Bulgarian Split Squat", bodyPart: "Legs" },
  { name: "Walking Lunge", bodyPart: "Legs" },
  { name: "Reverse Lunge", bodyPart: "Legs" },
  { name: "Step-Up", bodyPart: "Legs" },
  { name: "Romanian Deadlift", bodyPart: "Legs" },
  { name: "Stiff Leg Deadlift", bodyPart: "Legs" },
  { name: "Leg Extension", bodyPart: "Legs" },
  { name: "Seated Leg Curl", bodyPart: "Legs" },
  { name: "Lying Leg Curl", bodyPart: "Legs" },
  { name: "Standing Calf Raise", bodyPart: "Legs" },
  { name: "Seated Calf Raise", bodyPart: "Legs" },
  { name: "Calf Press", bodyPart: "Legs" },

  { name: "Barbell Hip Thrust", bodyPart: "Glutes" },
  { name: "Glute Bridge", bodyPart: "Glutes" },
  { name: "Cable Kickback", bodyPart: "Glutes" },
  { name: "Hip Abduction Machine", bodyPart: "Glutes" },
  { name: "Frog Pump", bodyPart: "Glutes" },

  { name: "Barbell Shoulder Press", bodyPart: "Shoulders" },
  { name: "Dumbbell Shoulder Press", bodyPart: "Shoulders" },
  { name: "Machine Shoulder Press", bodyPart: "Shoulders" },
  { name: "Arnold Press", bodyPart: "Shoulders" },
  { name: "Dumbbell Lateral Raise", bodyPart: "Shoulders" },
  { name: "Cable Lateral Raise", bodyPart: "Shoulders" },
  { name: "Machine Lateral Raise", bodyPart: "Shoulders" },
  { name: "Rear Delt Fly", bodyPart: "Shoulders" },
  { name: "Reverse Pec Deck", bodyPart: "Shoulders" },
  { name: "Face Pull", bodyPart: "Shoulders" },
  { name: "Upright Row", bodyPart: "Shoulders" },
  { name: "Front Raise", bodyPart: "Shoulders" },

  { name: "Barbell Curl", bodyPart: "Arms" },
  { name: "EZ Bar Curl", bodyPart: "Arms" },
  { name: "Alternating Dumbbell Curl", bodyPart: "Arms" },
  { name: "Hammer Curl", bodyPart: "Arms" },
  { name: "Cable Curl", bodyPart: "Arms" },
  { name: "Preacher Curl", bodyPart: "Arms" },
  { name: "Concentration Curl", bodyPart: "Arms" },
  { name: "Close Grip Bench Press", bodyPart: "Arms" },
  { name: "Skull Crusher", bodyPart: "Arms" },
  { name: "Cable Triceps Pushdown", bodyPart: "Arms" },
  { name: "Overhead Triceps Extension", bodyPart: "Arms" },
  { name: "Dips", bodyPart: "Arms" },
  { name: "Weighted Dips", bodyPart: "Arms" },
  { name: "Wrist Curl", bodyPart: "Arms" },
  { name: "Reverse Curl", bodyPart: "Arms" },

  { name: "Cable Crunch", bodyPart: "Core" },
  { name: "Hanging Leg Raise", bodyPart: "Core" },
  { name: "Decline Sit-Up", bodyPart: "Core" },
  { name: "Ab Wheel", bodyPart: "Core" },
  { name: "Plank", bodyPart: "Core" },
  { name: "Weighted Plank", bodyPart: "Core" },
  { name: "Russian Twist", bodyPart: "Core" },
  { name: "Toe Touch", bodyPart: "Core" },
];

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
  "Cardio",
  "Other",
];

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

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

function getWeightIncrement(weight: number, bodyPart?: string) {
  if (bodyPart === "Arms" || bodyPart === "Shoulders") {
    if (weight <= 20) return 2.5;
    if (weight <= 50) return 5;
    return 5;
  }

  if (weight <= 20) return 2.5;
  if (weight <= 60) return 5;
  if (weight <= 120) return 5;
  if (weight <= 220) return 10;
  return 10;
}

function roundToIncrement(value: number, increment: number) {
  if (!increment || increment <= 0) return value;
  return Math.round(value / increment) * increment;
}

function formatSmartNumber(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(/\.0$/, "");
}

function parseRepRange(repRange?: string) {
  if (!repRange) return { min: 8, max: 12 };
  const parts = repRange.split("-").map((part) => Number(part.trim()));
  if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return { min: parts[0], max: parts[1] };
  }
  const single = Number(repRange);
  if (Number.isFinite(single)) {
    return { min: single, max: single };
  }
  return { min: 8, max: 12 };
}

function formatRestLabel(restSeconds?: number) {
  if (!restSeconds) return "Rest as needed";
  if (restSeconds < 60) return `${restSeconds}s rest`;
  const minutes = Math.floor(restSeconds / 60);
  const seconds = restSeconds % 60;
  if (seconds === 0) return `${minutes} min rest`;
  return `${minutes}m ${seconds}s rest`;
}

function getWorkoutWarmupText(exercises: Exercise[]) {
  const compoundCount = exercises.filter((exercise) => {
    const lowerName = exercise.name.toLowerCase();
    return [
      "press",
      "squat",
      "row",
      "deadlift",
      "pulldown",
      "lung",
      "hip thrust",
      "shoulder press",
    ].some((term) => lowerName.includes(term));
  }).length;

  if (compoundCount >= 2) {
    return "Warm-up once for the session: 5–8 minutes of light movement, then 2–4 ramp-up sets for your first big lift. After that, only do feeler sets if a movement needs it.";
  }

  return "Warm-up once for the session: 3–5 minutes of easy movement plus 1–3 lighter ramp-up sets before your first working exercise.";
}

function getWorkoutFocusLine(title: string, exercises: Exercise[]) {
  const bodyPartCounts = exercises.reduce<Record<string, number>>((acc, exercise) => {
    acc[exercise.bodyPart] = (acc[exercise.bodyPart] || 0) + 1;
    return acc;
  }, {});

  const topBodyPart =
    Object.entries(bodyPartCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Workout";
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const volumeTag =
    totalSets >= 18 ? "High Volume" : totalSets >= 10 ? "Moderate Volume" : "Low Volume";
  const builderTag = title.toLowerCase().includes("strength")
    ? "Strength Builder"
    : "Bodybuilding Builder";

  return `${topBodyPart} • ${builderTag} • ${volumeTag}`;
}

function getMostLikelyWeight(
  exerciseName: string,
  exercises: Exercise[],
  historyMap?: ExerciseHistoryMap
) {
  for (const exercise of exercises) {
    if (normalizeName(exercise.name) !== normalizeName(exerciseName)) continue;

    for (let i = exercise.sets.length - 1; i >= 0; i -= 1) {
      const set = exercise.sets[i];
      if (String(set.weight).trim() !== "") return String(set.weight);
    }
  }

  const history = historyMap?.[normalizeName(exerciseName)];
  if (history?.lastWeight) return history.lastWeight;
  if (history?.bestWeight) return history.bestWeight;

  return "";
}

function getMostLikelyReps(
  exerciseName: string,
  exercises: Exercise[],
  historyMap?: ExerciseHistoryMap,
  fallback = ""
) {
  for (const exercise of exercises) {
    if (normalizeName(exercise.name) !== normalizeName(exerciseName)) continue;

    for (let i = exercise.sets.length - 1; i >= 0; i -= 1) {
      const set = exercise.sets[i];
      if (String(set.reps).trim() !== "") return String(set.reps);
    }
  }

  const history = historyMap?.[normalizeName(exerciseName)];
  if (history?.lastReps) return history.lastReps;
  if (history?.bestReps) return history.bestReps;

  return fallback;
}

function getExerciseBaseDefaults(
  exercise: Exercise,
  allExercises: Exercise[],
  historyMap: ExerciseHistoryMap
) {
  return {
    weight: getMostLikelyWeight(exercise.name, allExercises, historyMap),
    reps: getMostLikelyReps(exercise.name, allExercises, historyMap, "8"),
  };
}

function buildProgressionSuggestion(
  exercise: Exercise,
  setIndex: number,
  allExercises: Exercise[],
  historyMap: ExerciseHistoryMap
): AiSuggestion {
  const currentSet = exercise.sets[setIndex];
  const currentWeight = toNumber(currentSet?.weight);
  const currentReps = toNumber(currentSet?.reps);
  const repRange = parseRepRange(exercise.repRange);

  const priorCompletedSets = [...exercise.sets]
    .slice(0, setIndex + 1)
    .filter(
      (set) =>
        set.completed &&
        String(set.weight).trim() !== "" &&
        String(set.reps).trim() !== ""
    );

  const lastCompletedSet =
    priorCompletedSets.length > 0 ? priorCompletedSets[priorCompletedSets.length - 1] : null;

  const history = historyMap[normalizeName(exercise.name)];
  const baseDefaults = getExerciseBaseDefaults(exercise, allExercises, historyMap);

  const referenceWeight = lastCompletedSet
    ? toNumber(lastCompletedSet.weight)
    : currentWeight || toNumber(baseDefaults.weight) || toNumber(history?.lastWeight);

  const referenceReps = lastCompletedSet
    ? toNumber(lastCompletedSet.reps)
    : currentReps || toNumber(baseDefaults.reps) || toNumber(history?.lastReps) || repRange.min;

  if (!referenceWeight && !referenceReps) {
    return {
      weight: "",
      reps: String(repRange.min),
      reason: `Start near the bottom of your ${repRange.min}-${repRange.max} rep range and adjust after the first clean set.`,
    };
  }

  const increment = getWeightIncrement(referenceWeight || 20, exercise.bodyPart);
  let suggestedWeight = referenceWeight;
  let suggestedReps = Math.max(
    repRange.min,
    Math.min(referenceReps || repRange.min, repRange.max)
  );
  let reason = `Stay in the ${repRange.min}-${repRange.max} rep range and keep form tight.`;

  if (referenceReps >= repRange.max + 1) {
    suggestedWeight = roundToIncrement(referenceWeight + increment, increment);
    suggestedReps = repRange.min;
    reason = `You overshot the rep target. AI suggests a small bump of +${formatSmartNumber(
      increment
    )} and resetting to the bottom of the range.`;
  } else if (referenceReps === repRange.max) {
    suggestedWeight = roundToIncrement(referenceWeight + increment, increment);
    suggestedReps = repRange.min;
    reason = `Top of range hit cleanly. AI suggests a small load increase of ${formatSmartNumber(
      increment
    )}.`;
  } else if (referenceReps >= repRange.min && referenceReps < repRange.max) {
    suggestedWeight = referenceWeight;
    suggestedReps = Math.min(repRange.max, referenceReps + 1);
    reason = `Stay at the same load and try to add a rep while staying inside ${repRange.min}-${repRange.max}.`;
  } else if (referenceReps === repRange.min - 1) {
    suggestedWeight = referenceWeight;
    suggestedReps = repRange.min;
    reason = `Almost there. Hold the weight steady and bring the set into the target rep range.`;
  } else {
    suggestedWeight = Math.max(0, roundToIncrement(referenceWeight - increment, increment));
    suggestedReps = repRange.min;
    reason = `Reps fell below target. AI suggests a slight pullback so you can get back into the prescribed range.`;
  }

  return {
    weight: suggestedWeight ? formatSmartNumber(suggestedWeight) : "",
    reps: String(suggestedReps),
    reason,
  };
}

function sanitizeIntegerInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

function sanitizeDecimalInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return `${cleaned.slice(0, firstDot + 1)}${cleaned
    .slice(firstDot + 1)
    .replace(/\./g, "")}`;
}

function formatMilesValue(value: number) {
  return value <= 0 ? "" : formatSmartNumber(Math.max(0, value));
}

export default function WorkoutPage() {
  const router = useRouter();

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [finished, setFinished] = useState(false);
  const [status, setStatus] = useState("");

  const [libraryChoice, setLibraryChoice] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("All");
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newBodyPart, setNewBodyPart] = useState("");
  const [addExerciseMode, setAddExerciseMode] = useState<
    "library" | "custom" | "bodypart"
  >("library");
  const [bodyPartChoice, setBodyPartChoice] = useState("");

  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  const [recentExercises, setRecentExercises] = useState<string[]>([]);
  const [favoriteExercises, setFavoriteExercises] = useState<string[]>([]);
  const [customLibrary, setCustomLibrary] = useState<LibraryExercise[]>([]);
  const [workoutTitle, setWorkoutTitle] = useState("Build Your Session");

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [cardioEntries, setCardioEntries] = useState<CardioEntry[]>([]);
  const [historyMap, setHistoryMap] = useState<ExerciseHistoryMap>({});

  const exerciseCardRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    void initializeWorkoutPage();
  }, []);

  async function loadExerciseHistory(userId: string) {
    const { data, error } = await supabase
      .from("workout_sets")
      .select("exercise_name, body_part, weight, reps, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Failed to load exercise history:", error);
      return {};
    }

    const rows = data || [];
    const nextHistory: ExerciseHistoryMap = {};

    for (const row of rows) {
      const name = String(row.exercise_name || "").trim();
      if (!name) continue;

      const key = normalizeName(name);
      const weight = String(row.weight ?? "").trim();
      const reps = String(row.reps ?? "").trim();

      if (!nextHistory[key]) {
        nextHistory[key] = {
          exerciseName: name,
          bodyPart: String(row.body_part || "Other"),
          lastWeight: weight,
          lastReps: reps,
          bestWeight: weight,
          bestReps: reps,
        };
        continue;
      }

      const currentBestWeight = toNumber(nextHistory[key].bestWeight);
      const currentRowWeight = toNumber(weight);

      if (currentRowWeight > currentBestWeight) {
        nextHistory[key].bestWeight = weight;
        nextHistory[key].bestReps = reps;
      }
    }

    return nextHistory;
  }

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

    const loadedHistoryMap = await loadExerciseHistory(user.id);
    setHistoryMap(loadedHistoryMap);

    const rawGeneratedWorkout = localStorage.getItem("respawn_generated_workout");

    if (rawGeneratedWorkout) {
      try {
        const parsed: GeneratedWorkoutPayload = JSON.parse(rawGeneratedWorkout);

        const mappedExercises: Exercise[] = parsed.exercises.map((exercise) => {
          const history = loadedHistoryMap[normalizeName(exercise.exercise_name)];

          return {
            id: makeId(),
            name: exercise.exercise_name,
            bodyPart: formatBodyPart(exercise.body_part),
            restSeconds: exercise.restSeconds,
            repRange: exercise.repRange,
            coachingNote: exercise.coachingNote,
            reason: exercise.reason,
            notes: exercise.notes ?? null,
            sets:
              exercise.sets.length > 0
                ? exercise.sets.map((set, setIndex) => ({
                    weight:
                      String(set.weight ?? "").trim() !== ""
                        ? String(set.weight)
                        : setIndex === 0
                        ? history?.lastWeight || ""
                        : "",
                    reps:
                      String(set.reps ?? "").trim() !== ""
                        ? String(set.reps)
                        : setIndex === 0
                        ? history?.lastReps || exercise.repRange?.split("-")[0] || "8"
                        : exercise.repRange?.split("-")[0] || "8",
                    completed: false,
                  }))
                : [
                    {
                      weight: history?.lastWeight || "",
                      reps: history?.lastReps || exercise.repRange?.split("-")[0] || "8",
                      completed: false,
                    },
                  ],
            favorite: parsedFavorites.includes(exercise.exercise_name),
          };
        });

        if (mappedExercises.length > 0) {
          setExercises(mappedExercises);
          setWorkoutTitle(parsed.workout_name || "Generated Workout");
          setCardioEntries([]);
          setSecondsElapsed(0);
          setTimerRunning(false);
          setLibraryChoice("");
          setLibrarySearch("");
          setLibraryFilter("All");
          setNewExerciseName("");
          setNewBodyPart("");
          setAddExerciseMode("library");
          setBodyPartChoice("");
          setStatus(`${parsed.workout_name} loaded.`);
        }

        localStorage.removeItem("respawn_generated_workout");
        localStorage.removeItem(WORKOUT_DRAFT_KEY);
        setAuthLoading(false);
        return;
      } catch (loadError) {
        console.error("Failed to load generated workout:", loadError);
        setStatus("Could not load generated workout.");
      }
    }

    const savedDraft = localStorage.getItem(WORKOUT_DRAFT_KEY);

    if (savedDraft) {
      try {
        const parsedDraft: SavedWorkoutState = JSON.parse(savedDraft);
        setWorkoutTitle(parsedDraft.workoutTitle || "Build Your Session");
        setExercises(Array.isArray(parsedDraft.exercises) ? parsedDraft.exercises : []);
        setCardioEntries(Array.isArray(parsedDraft.cardioEntries) ? parsedDraft.cardioEntries : []);
        setSecondsElapsed(parsedDraft.secondsElapsed || 0);
        setTimerRunning(false);
        setLibraryChoice(parsedDraft.libraryChoice || "");
        setNewExerciseName(parsedDraft.newExerciseName || "");
        setNewBodyPart(parsedDraft.newBodyPart || "");
        setAddExerciseMode(parsedDraft.addExerciseMode || "library");
        setBodyPartChoice(parsedDraft.bodyPartChoice || "");
        setStatus("Recovered your in-progress workout.");
        setAuthLoading(false);
        return;
      } catch (draftError) {
        console.error("Failed to load workout draft:", draftError);
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

  useEffect(() => {
    if (authLoading || finished) return;

    const draft: SavedWorkoutState = {
      workoutTitle,
      exercises,
      cardioEntries,
      secondsElapsed,
      timerRunning: false,
      libraryChoice,
      newExerciseName,
      newBodyPart,
      addExerciseMode,
      bodyPartChoice,
    };

    localStorage.setItem(WORKOUT_DRAFT_KEY, JSON.stringify(draft));
  }, [
    authLoading,
    finished,
    workoutTitle,
    exercises,
    cardioEntries,
    secondsElapsed,
    libraryChoice,
    newExerciseName,
    newBodyPart,
    addExerciseMode,
    bodyPartChoice,
  ]);

  const allExerciseLibrary = useMemo(() => {
    const merged = [...customLibrary, ...EXPANDED_EXERCISE_LIBRARY, ...BASE_EXERCISE_LIBRARY];
    const seen = new Set<string>();

    return merged.filter((item) => {
      const key = normalizeName(item.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [customLibrary]);

  const filteredExerciseLibrary = useMemo(() => {
    return allExerciseLibrary.filter((item) => {
      const matchesBodyPart = libraryFilter === "All" || item.bodyPart === libraryFilter;
      const matchesSearch =
        librarySearch.trim() === "" ||
        item.name.toLowerCase().includes(librarySearch.trim().toLowerCase());
      return matchesBodyPart && matchesSearch;
    });
  }, [allExerciseLibrary, libraryFilter, librarySearch]);

  const bodyPartFilteredLibrary = useMemo(() => {
    return allExerciseLibrary.filter((item) => {
      const matchesBodyPart = bodyPartChoice ? item.bodyPart === bodyPartChoice : true;
      const matchesSearch =
        librarySearch.trim() === "" ||
        item.name.toLowerCase().includes(librarySearch.trim().toLowerCase());
      return matchesBodyPart && matchesSearch;
    });
  }, [allExerciseLibrary, bodyPartChoice, librarySearch]);

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

  const completedCardio = useMemo(() => {
    return cardioEntries.filter(
      (entry) =>
        entry.completed &&
        (String(entry.minutes).trim() !== "" ||
          String(entry.seconds).trim() !== "" ||
          String(entry.miles).trim() !== "")
    );
  }, [cardioEntries]);

  const totalSets = completedSets.length;
  const totalReps = completedSets.reduce((sum, set) => sum + toNumber(set.reps), 0);
  const totalVolume = completedSets.reduce((sum, set) => sum + set.volume, 0);

  const cardioMinutesTotal = completedCardio.reduce(
    (sum, entry) => sum + toNumber(entry.minutes) + toNumber(entry.seconds) / 60,
    0
  );
  const cardioMilesTotal = completedCardio.reduce((sum, entry) => sum + toNumber(entry.miles), 0);

  const workoutFocusLine = useMemo(
    () => getWorkoutFocusLine(workoutTitle, exercises),
    [workoutTitle, exercises]
  );

  const warmupText = useMemo(() => getWorkoutWarmupText(exercises), [exercises]);

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
    cardioMinutesTotal > 0
      ? `Cardio completed: ${formatSmartNumber(cardioMinutesTotal)} min${
          cardioMilesTotal > 0 ? ` • ${formatSmartNumber(cardioMilesTotal)} miles` : ""
        }`
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

  function applySuggestionToSet(exerciseIndex: number, setIndex: number) {
    setExercises((prev) => {
      const updated = [...prev];
      const exercise = { ...updated[exerciseIndex] };
      const sets = [...exercise.sets];

      const suggestion = buildProgressionSuggestion(exercise, setIndex, prev, historyMap);

      sets[setIndex] = {
        ...sets[setIndex],
        weight: suggestion.weight,
        reps: suggestion.reps,
        completed: false,
      };

      exercise.sets = sets;
      updated[exerciseIndex] = exercise;
      return updated;
    });

    setStatus("AI suggestion applied.");
  }

  function resetSetValues(exerciseIndex: number, setIndex: number) {
    setExercises((prev) => {
      const updated = [...prev];
      const exercise = { ...updated[exerciseIndex] };
      const sets = [...exercise.sets];

      sets[setIndex] = {
        ...sets[setIndex],
        weight: "",
        reps: "",
        completed: false,
      };

      exercise.sets = sets;
      updated[exerciseIndex] = exercise;
      return updated;
    });

    setStatus("Set values cleared.");
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

      const willComplete = !currentSet.completed;

      sets[setIndex] = {
        ...currentSet,
        completed: willComplete,
      };

      if (willComplete && sets[setIndex + 1]) {
        const nextSet = sets[setIndex + 1];
        const nextBlank =
          String(nextSet.weight).trim() === "" && String(nextSet.reps).trim() === "";

        if (nextBlank) {
          const tempExercise = { ...exercise, sets };
          const suggestion = buildProgressionSuggestion(
            tempExercise,
            setIndex,
            updated,
            historyMap
          );

          sets[setIndex + 1] = {
            ...nextSet,
            weight: suggestion.weight,
            reps: suggestion.reps,
            completed: false,
          };
        }
      }

      exercise.sets = sets;
      updated[exerciseIndex] = exercise;
      return updated;
    });

    if (blocked) {
      setStatus("Enter both weight and reps before marking a set complete.");
      return;
    }

    setStatus("Set updated.");
  }

  function addSet(exerciseIndex: number) {
    setExercises((prev) => {
      const updated = [...prev];
      const exercise = { ...updated[exerciseIndex] };
      const nextSetIndex = exercise.sets.length;

      const suggestion = buildProgressionSuggestion(
        exercise,
        Math.max(0, nextSetIndex - 1),
        updated,
        historyMap
      );

      exercise.sets = [
        ...exercise.sets,
        {
          weight: suggestion.weight,
          reps: suggestion.reps,
          completed: false,
        },
      ];

      updated[exerciseIndex] = exercise;
      return updated;
    });

    setStatus("Set added with AI prefill.");
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

      updated[exerciseIndex] = {
        ...exercise,
        sets: exercise.sets.map(() => ({
          weight: "",
          reps: "",
          completed: false,
        })),
      };

      return updated;
    });

    setStatus("All set values cleared.");
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
      return next.slice(0, 10);
    });
  }

  function saveCustomExerciseToLibrary(name: string, bodyPart: string) {
    const cleanName = name.trim();
    if (!cleanName) return;

    const existsInFullLibrary = [...BASE_EXERCISE_LIBRARY, ...EXPANDED_EXERCISE_LIBRARY].some(
      (item) => normalizeName(item.name) === normalizeName(cleanName)
    );

    if (existsInFullLibrary) return;

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

    const defaultWeight = getMostLikelyWeight(cleanName, exercises, historyMap);
    const defaultReps = getMostLikelyReps(cleanName, exercises, historyMap, "8");

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
    setLibrarySearch("");
    setStatus("Exercise added at the top.");

    setTimeout(() => {
      exerciseCardRefs.current[newExercise.id]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  function addExercise() {
    if (addExerciseMode === "library") {
      if (!libraryChoice) {
        setStatus("Choose an exercise from the library.");
        return;
      }

      addExerciseFromInput(libraryChoice, libraryMap.get(libraryChoice) || "Other");
      return;
    }

    if (addExerciseMode === "custom") {
      if (!newExerciseName.trim()) {
        setStatus("Enter a custom exercise name.");
        return;
      }

      if (!newBodyPart) {
        setStatus("Select a body part for your custom exercise.");
        return;
      }

      addExerciseFromInput(newExerciseName, newBodyPart || "Other");
      return;
    }

    if (addExerciseMode === "bodypart") {
      if (!libraryChoice) {
        setStatus("Choose an exercise after selecting a body part.");
        return;
      }

      addExerciseFromInput(libraryChoice, libraryMap.get(libraryChoice) || bodyPartChoice || "Other");
    }
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

  function adjustTimer(seconds: number) {
    setSecondsElapsed((prev) => Math.max(0, prev + seconds));
    setStatus("Timer adjusted.");
  }

  function addCardioEntry() {
    setCardioEntries((prev) => [
      ...prev,
      {
        id: makeId(),
        method: "Treadmill Walk",
        miles: "",
        minutes: "",
        seconds: "",
        completed: false,
        notes: "",
      },
    ]);
    setStatus("Cardio entry added.");
  }

  function updateCardioField(
    cardioId: string,
    field: "method" | "miles" | "minutes" | "seconds" | "notes",
    value: string
  ) {
    setCardioEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== cardioId) return entry;

        if (field === "minutes" || field === "seconds") {
          return {
            ...entry,
            [field]: sanitizeIntegerInput(value),
            completed: false,
          };
        }

        if (field === "miles") {
          return {
            ...entry,
            miles: sanitizeDecimalInput(value),
            completed: false,
          };
        }

        return { ...entry, [field]: value, completed: false };
      })
    );
  }

  function adjustCardioMinutes(cardioId: string, delta: number) {
    setCardioEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== cardioId) return entry;

        const currentTotalSeconds =
          toNumber(entry.minutes) * 60 + Math.min(59, toNumber(entry.seconds));
        const nextTotalSeconds = Math.max(0, currentTotalSeconds + delta * 60);
        const nextMinutes = Math.floor(nextTotalSeconds / 60);
        const nextSeconds = nextTotalSeconds % 60;

        return {
          ...entry,
          minutes: nextMinutes > 0 ? String(nextMinutes) : "",
          seconds: nextSeconds > 0 ? String(nextSeconds) : "",
          completed: false,
        };
      })
    );

    setStatus("Cardio time adjusted.");
  }

  function adjustCardioSeconds(cardioId: string, delta: number) {
    setCardioEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== cardioId) return entry;

        const currentTotalSeconds =
          toNumber(entry.minutes) * 60 + Math.min(59, toNumber(entry.seconds));
        const nextTotalSeconds = Math.max(0, currentTotalSeconds + delta);
        const nextMinutes = Math.floor(nextTotalSeconds / 60);
        const nextSeconds = nextTotalSeconds % 60;

        return {
          ...entry,
          minutes: nextMinutes > 0 ? String(nextMinutes) : "",
          seconds: nextSeconds > 0 ? String(nextSeconds) : "",
          completed: false,
        };
      })
    );

    setStatus("Cardio time adjusted.");
  }

  function adjustCardioMiles(cardioId: string, delta: number) {
    setCardioEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== cardioId) return entry;

        const currentMiles = toNumber(entry.miles);
        const nextMiles = Math.max(0, Math.round((currentMiles + delta) * 100) / 100);

        return {
          ...entry,
          miles: formatMilesValue(nextMiles),
          completed: false,
        };
      })
    );

    setStatus("Cardio distance adjusted.");
  }

  function toggleCardioCompleted(cardioId: string) {
    let blocked = false;

    setCardioEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== cardioId) return entry;

        const hasData =
          String(entry.minutes).trim() !== "" ||
          String(entry.seconds).trim() !== "" ||
          String(entry.miles).trim() !== "";

        if (!hasData) {
          blocked = true;
          return entry;
        }

        return { ...entry, completed: !entry.completed };
      })
    );

    if (blocked) {
      setStatus("Add time or miles before marking cardio complete.");
      return;
    }

    setStatus("Cardio updated.");
  }

  function removeCardioEntry(cardioId: string) {
    setCardioEntries((prev) => prev.filter((entry) => entry.id !== cardioId));
    setStatus("Cardio removed.");
  }

  async function persistCardioEntries(workoutId: number) {
    if (!authUser?.id || completedCardio.length === 0) return { saved: false, skipped: true };

    const rows = completedCardio.map((entry, index) => ({
      workout_id: workoutId,
      user_id: authUser.id,
      entry_number: index + 1,
      method: entry.method,
      miles: toNumber(entry.miles) || null,
      duration_seconds: toNumber(entry.minutes) * 60 + toNumber(entry.seconds),
      notes: entry.notes?.trim() || null,
    }));

    const { error } = await supabase.from("workout_cardio").insert(rows);

    if (error) {
      console.warn("Cardio table insert skipped:", error.message);
      return { saved: false, skipped: true, error };
    }

    return { saved: true, skipped: false };
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

    if (completedSets.length === 0 && completedCardio.length === 0) {
      setStatus("Complete at least one set or cardio entry before finishing the workout.");
      return;
    }

    setStatus("Saving workout...");

    const cardioSummary =
      completedCardio.length > 0
        ? `Cardio: ${completedCardio
            .map((entry) => {
              const minutes = toNumber(entry.minutes);
              const seconds = toNumber(entry.seconds);
              const total = minutes + seconds / 60;
              const miles = toNumber(entry.miles);
              return `${entry.method}${
                total > 0 ? ` ${formatSmartNumber(total)} min` : ""
              }${miles > 0 ? ` ${formatSmartNumber(miles)} mi` : ""}`;
            })
            .join(", ")}`
        : null;

    const workoutPayload = {
      user_id: authUser.id,
      workout_name: workoutTitle === "Build Your Session" ? "Custom Workout" : workoutTitle,
      duration_seconds: secondsElapsed,
      day_type: exercises.length === 0 && completedCardio.length > 0 ? "cardio" : "workout",
      notes: [...workoutHighlights, cardioSummary].filter(Boolean).join(" • ") || null,
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

    if (allSets.length > 0) {
      const { error: setsError } = await supabase.from("workout_sets").insert(allSets);

      if (setsError) {
        setStatus(`Error saving sets: ${setsError.message}`);
        return;
      }
    }

    const cardioResult = await persistCardioEntries(workoutId);

    setTimerRunning(false);
    exercises.forEach((exercise) => pushRecent(exercise.name));
    localStorage.removeItem(WORKOUT_DRAFT_KEY);
    setStatus(
      cardioResult.saved
        ? "Workout and cardio saved successfully."
        : "Workout saved successfully. Cardio summary was preserved in notes."
    );
    setFinished(true);
  }

  function renderAddExercisePanel() {
    if (addExerciseMode === "library") {
      return (
        <div style={addExercisePanelStyle}>
          <div style={inputGridStyle}>
            <input
              placeholder="Search exercise library"
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              style={inputStyle}
            />

            <select
              value={libraryFilter}
              onChange={(e) => {
                setLibraryFilter(e.target.value);
                setLibraryChoice("");
              }}
              style={selectStyle}
            >
              <option value="All">All body parts</option>
              {BODY_PARTS.filter(
                (part) => part !== "Push" && part !== "Pull" && part !== "Full Body"
              ).map((part) => (
                <option key={part} value={part}>
                  {part}
                </option>
              ))}
            </select>

            <select
              value={libraryChoice}
              onChange={(e) => setLibraryChoice(e.target.value)}
              style={selectStyle}
            >
              <option value="">
                Choose from library ({filteredExerciseLibrary.length})
              </option>
              {filteredExerciseLibrary.slice(0, 250).map((exercise) => (
                <option key={exercise.name} value={exercise.name}>
                  {exercise.name} • {exercise.bodyPart}
                  {exercise.custom ? " • Custom" : ""}
                </option>
              ))}
            </select>

            <button onClick={addExercise} style={primaryButtonStyle}>
              Add Exercise
            </button>
          </div>

          <p style={helperTextStyle}>
            Fastest option. Search, choose, add.
          </p>
        </div>
      );
    }

    if (addExerciseMode === "custom") {
      return (
        <div style={addExercisePanelStyle}>
          <div style={inputGridStyle}>
            <input
              placeholder="Custom exercise name"
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
              Add Custom Exercise
            </button>
          </div>

          <p style={helperTextStyle}>
            Custom exercises are saved locally on this device and will show up in your library.
          </p>
        </div>
      );
    }

    return (
      <div style={addExercisePanelStyle}>
        <div style={inputGridStyle}>
          <select
            value={bodyPartChoice}
            onChange={(e) => {
              setBodyPartChoice(e.target.value);
              setLibraryChoice("");
            }}
            style={selectStyle}
          >
            <option value="">Select body part</option>
            {BODY_PARTS.filter((part) => part !== "Push" && part !== "Pull").map((part) => (
              <option key={part} value={part}>
                {part}
              </option>
            ))}
          </select>

          <input
            placeholder="Search within body part"
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            style={inputStyle}
          />

          <select
            value={libraryChoice}
            onChange={(e) => setLibraryChoice(e.target.value)}
            style={selectStyle}
            disabled={!bodyPartChoice}
          >
            <option value="">
              {bodyPartChoice
                ? `Choose ${bodyPartChoice} exercise (${bodyPartFilteredLibrary.length})`
                : "Select a body part first"}
            </option>
            {bodyPartFilteredLibrary.slice(0, 250).map((exercise) => (
              <option key={exercise.name} value={exercise.name}>
                {exercise.name}
                {exercise.custom ? " • Custom" : ""}
              </option>
            ))}
          </select>

          <button onClick={addExercise} style={primaryButtonStyle}>
            Add Exercise
          </button>
        </div>

        <p style={helperTextStyle}>
          Choose the muscle group first, then pick the movement.
        </p>
      </div>
    );
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
          <p style={heroMetaStyle}>{workoutFocusLine}</p>
          <p style={heroSubStyle}>
            {totalSets} sets • {totalReps} reps • {totalVolume} total volume
          </p>
          <p style={{ ...heroSubStyle, marginTop: 8 }}>Duration {formatTime(secondsElapsed)}</p>
          {cardioMinutesTotal > 0 && (
            <p style={{ ...heroSubStyle, marginTop: 8 }}>
              Cardio {formatSmartNumber(cardioMinutesTotal)} min
              {cardioMilesTotal > 0 ? ` • ${formatSmartNumber(cardioMilesTotal)} miles` : ""}
            </p>
          )}
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
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <p style={eyebrowStyle}>RESPAWN WORKOUT</p>
        <h1 style={heroTitleStyle}>{workoutTitle}</h1>
        <p style={heroMetaStyle}>{workoutFocusLine}</p>
        <p style={heroSubStyle}>
          Log your real working sets, use AI to stay in the right rep ranges, and keep your session protected even if you refresh.
        </p>

        <div style={warmupHeroCardStyle}>
          <div style={warmupTitleStyle}>Warm-Up</div>
          <div style={warmupTextStyle}>{warmupText}</div>
        </div>

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

        <div style={{ ...buttonRowStyle, marginTop: 10 }}>
          <button onClick={() => adjustTimer(-60)} style={secondaryButtonStyle}>
            -1 min
          </button>
          <button onClick={() => adjustTimer(60)} style={secondaryButtonStyle}>
            +1 min
          </button>
          <button onClick={() => adjustTimer(300)} style={secondaryButtonStyle}>
            +5 min
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Add Exercise</h2>
        </div>

        <div style={modeButtonRowStyle}>
          <button
            onClick={() => {
              setAddExerciseMode("library");
              setLibraryChoice("");
              setStatus("Choose from library.");
            }}
            style={addExerciseMode === "library" ? modeButtonActiveStyle : modeButtonStyle}
          >
            Choose from Lib
          </button>
          <button
            onClick={() => {
              setAddExerciseMode("custom");
              setStatus("Enter a custom exercise.");
            }}
            style={addExerciseMode === "custom" ? modeButtonActiveStyle : modeButtonStyle}
          >
            Enter Custom
          </button>
          <button
            onClick={() => {
              setAddExerciseMode("bodypart");
              setLibraryChoice("");
              setStatus("Pick a body part first.");
            }}
            style={addExerciseMode === "bodypart" ? modeButtonActiveStyle : modeButtonStyle}
          >
            Body Part
          </button>
        </div>

        {renderAddExercisePanel()}

        {favoriteExercises.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <p style={subtleLabelStyle}>Favorites</p>
            <div style={chipWrapStyle}>
              {favoriteExercises.map((name) => (
                <button key={name} onClick={() => addRecentExercise(name)} style={chipButtonStyle}>
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
                <button key={name} onClick={() => addRecentExercise(name)} style={chipButtonStyle}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Add Cardio</h2>
        </div>

        <div style={buttonRowStyle}>
          <button onClick={addCardioEntry} style={primaryButtonStyle}>
            Add Cardio
          </button>
        </div>

        <p style={helperTextStyle}>
          Faster cardio logging: quick time controls, 0.5 mile steps, and manual entry whenever needed.
        </p>

        {cardioEntries.length > 0 ? (
          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {cardioEntries.map((entry, index) => {
              const totalSeconds =
                toNumber(entry.minutes) * 60 + Math.min(59, toNumber(entry.seconds));
              const displayMinutes = Math.floor(totalSeconds / 60);
              const displaySeconds = totalSeconds % 60;

              return (
                <div key={entry.id} style={cardioCardStyle}>
                  <div style={cardioHeaderStyle}>
                    <div style={cardioTitleStyle}>Cardio {index + 1}</div>
                    <div style={buttonRowStyle}>
                      <button
                        onClick={() => toggleCardioCompleted(entry.id)}
                        style={entry.completed ? completeButtonActiveStyle : completeButtonStyle}
                      >
                        {entry.completed ? "Completed" : "Complete Cardio"}
                      </button>
                      <button
                        onClick={() => removeCardioEntry(entry.id)}
                        style={dangerButtonStyle}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div style={inputGridStyle}>
                    <select
                      value={entry.method}
                      onChange={(e) => updateCardioField(entry.id, "method", e.target.value)}
                      style={selectStyle}
                    >
                      {CARDIO_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={cardioQuickSectionStyle}>
                    <div style={cardioSectionTitleStyle}>Time</div>

                    <div style={cardioPillRowStyle}>
                      <button
                        onClick={() => adjustCardioMinutes(entry.id, -5)}
                        style={secondaryButtonStyle}
                      >
                        -5 min
                      </button>
                      <button
                        onClick={() => adjustCardioMinutes(entry.id, -1)}
                        style={secondaryButtonStyle}
                      >
                        -1 min
                      </button>
                      <button
                        onClick={() => adjustCardioMinutes(entry.id, 1)}
                        style={secondaryButtonStyle}
                      >
                        +1 min
                      </button>
                      <button
                        onClick={() => adjustCardioMinutes(entry.id, 5)}
                        style={secondaryButtonStyle}
                      >
                        +5 min
                      </button>
                    </div>

                    <div style={cardioPillRowStyle}>
                      <button
                        onClick={() => adjustCardioSeconds(entry.id, -15)}
                        style={secondaryButtonStyle}
                      >
                        -15 sec
                      </button>
                      <button
                        onClick={() => adjustCardioSeconds(entry.id, 15)}
                        style={secondaryButtonStyle}
                      >
                        +15 sec
                      </button>
                      <div style={cardioValuePillStyle}>
                        {String(displayMinutes).padStart(2, "0")}:
                        {String(displaySeconds).padStart(2, "0")}
                      </div>
                    </div>

                    <div style={inputGridStyle}>
                      <input
                        placeholder="Minutes"
                        value={entry.minutes}
                        onChange={(e) =>
                          updateCardioField(entry.id, "minutes", e.target.value)
                        }
                        style={smallInputStyle}
                        inputMode="numeric"
                      />

                      <input
                        placeholder="Seconds"
                        value={entry.seconds}
                        onChange={(e) =>
                          updateCardioField(entry.id, "seconds", e.target.value)
                        }
                        style={smallInputStyle}
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  <div style={cardioQuickSectionStyle}>
                    <div style={cardioSectionTitleStyle}>Miles</div>

                    <div style={cardioPillRowStyle}>
                      <button
                        onClick={() => adjustCardioMiles(entry.id, -0.5)}
                        style={secondaryButtonStyle}
                      >
                        -0.5
                      </button>
                      <div style={cardioValuePillStyle}>
                        {entry.miles && toNumber(entry.miles) > 0 ? entry.miles : "0"} mi
                      </div>
                      <button
                        onClick={() => adjustCardioMiles(entry.id, 0.5)}
                        style={secondaryButtonStyle}
                      >
                        +0.5
                      </button>
                    </div>

                    <div style={inputGridStyle}>
                      <input
                        placeholder="Miles"
                        value={entry.miles}
                        onChange={(e) => updateCardioField(entry.id, "miles", e.target.value)}
                        style={smallInputStyle}
                        inputMode="decimal"
                      />
                    </div>
                  </div>

                  <div style={inputGridStyle}>
                    <input
                      placeholder="Notes (optional)"
                      value={entry.notes || ""}
                      onChange={(e) => updateCardioField(entry.id, "notes", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ ...helperTextStyle, marginTop: 12 }}>
            Track treadmill work, jogging, swimming, biking, stairmaster, SkiErg, sled pushes, and more with quick inputs.
          </p>
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
                <button onClick={() => removeExercise(index)} style={dangerButtonStyle}>
                  Remove
                </button>
              </div>
            </div>

            {!!exercise.restSeconds && (
              <div style={restTagStyle}>
                Recommended rest: {formatRestLabel(exercise.restSeconds)}
              </div>
            )}

            {(exercise.coachingNote ||
              exercise.reason ||
              exercise.notes ||
              exercise.repRange) && (
              <div style={exerciseInfoCardStyle}>
                {exercise.repRange && (
                  <div style={exerciseInfoLineStyle}>
                    Target rep range: {exercise.repRange}
                  </div>
                )}
                {exercise.coachingNote && (
                  <div style={exerciseInfoLineStyle}>{exercise.coachingNote}</div>
                )}
                {exercise.reason && (
                  <div style={exerciseMutedLineStyle}>{exercise.reason}</div>
                )}
                {exercise.notes && (
                  <div style={exerciseSpecialLineStyle}>{exercise.notes}</div>
                )}
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <h3 style={setsHeaderStyle}>Sets</h3>

              {exercise.sets.map((set, setIndex) => {
                const suggestion = buildProgressionSuggestion(
                  exercise,
                  setIndex,
                  exercises,
                  historyMap
                );

                return (
                  <div key={setIndex} style={setBlockStyle}>
                    <div style={editableSetRowStyle}>
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
                        onClick={() => applySuggestionToSet(index, setIndex)}
                        style={secondaryButtonStyle}
                      >
                        Apply AI
                      </button>

                      <button
                        onClick={() => resetSetValues(index, setIndex)}
                        style={secondaryButtonStyle}
                      >
                        Reset Values
                      </button>

                      <button
                        onClick={() => removeSet(index, setIndex)}
                        style={dangerButtonStyle}
                      >
                        Remove Set
                      </button>
                    </div>

                    <div style={aiHintCardStyle}>
                      <span style={aiHintTitleStyle}>
                        AI Suggestion: {suggestion.weight || "-"} lbs × {suggestion.reps}
                      </span>
                      <span style={aiHintTextStyle}>{suggestion.reason}</span>
                    </div>
                  </div>
                );
              })}
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

const heroMetaStyle: CSSProperties = {
  color: "#ffb8b8",
  fontSize: "14px",
  fontWeight: 700,
  margin: "0 0 8px",
};

const heroSubStyle: CSSProperties = {
  color: "#d0d0d0",
  fontSize: "15px",
  margin: 0,
};

const warmupHeroCardStyle: CSSProperties = {
  marginTop: "14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "16px",
  padding: "12px 14px",
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

const cardioCardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "16px",
  padding: "14px",
  display: "grid",
  gap: "14px",
};

const cardioHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  marginBottom: "2px",
};

const cardioTitleStyle: CSSProperties = {
  color: "#fff",
  fontWeight: 800,
  fontSize: "15px",
};

const cardioQuickSectionStyle: CSSProperties = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: "14px",
  padding: "12px",
  display: "grid",
  gap: "10px",
};

const cardioSectionTitleStyle: CSSProperties = {
  color: "#efefef",
  fontSize: "13px",
  fontWeight: 800,
};

const cardioPillRowStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  alignItems: "center",
};

const cardioValuePillStyle: CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "12px",
  color: "#fff",
  fontSize: "13px",
  fontWeight: 800,
  padding: "10px 14px",
  minWidth: "96px",
  textAlign: "center",
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

const addExercisePanelStyle: CSSProperties = {
  marginTop: "14px",
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

const modeButtonRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "10px",
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

const modeButtonStyle: CSSProperties = {
  backgroundColor: "#1b1b1b",
  border: "1px solid #2c2c2c",
  padding: "12px 14px",
  borderRadius: "12px",
  color: "#efefef",
  fontWeight: 800,
  cursor: "pointer",
};

const modeButtonActiveStyle: CSSProperties = {
  backgroundColor: "rgba(255,26,26,0.16)",
  border: "1px solid rgba(255,77,77,0.45)",
  padding: "12px 14px",
  borderRadius: "12px",
  color: "#ffffff",
  fontWeight: 800,
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

const warmupTitleStyle: CSSProperties = {
  color: "#ff8b8b",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: "6px",
};

const warmupTextStyle: CSSProperties = {
  color: "#efefef",
  fontSize: "13px",
  lineHeight: 1.45,
};

const restTagStyle: CSSProperties = {
  display: "inline-flex",
  marginTop: "12px",
  padding: "7px 10px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#d8d8d8",
  fontSize: "12px",
  fontWeight: 700,
};

const exerciseInfoCardStyle: CSSProperties = {
  marginTop: "12px",
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: "14px",
  padding: "12px",
  display: "grid",
  gap: "6px",
};

const exerciseInfoLineStyle: CSSProperties = {
  color: "#ededed",
  fontSize: "13px",
};

const exerciseMutedLineStyle: CSSProperties = {
  color: "#a7a7a7",
  fontSize: "12px",
};

const exerciseSpecialLineStyle: CSSProperties = {
  color: "#ffb0b0",
  fontSize: "12px",
  fontWeight: 700,
};

const setsHeaderStyle: CSSProperties = {
  marginBottom: "10px",
  color: "#ffffff",
};

const setBlockStyle: CSSProperties = {
  borderBottom: "1px solid #222",
  padding: "10px 0 14px",
};

const editableSetRowStyle: CSSProperties = {
  color: "#ddd",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
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

const aiHintCardStyle: CSSProperties = {
  marginTop: "10px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "12px",
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const aiHintTitleStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 700,
};

const aiHintTextStyle: CSSProperties = {
  color: "#9e9e9e",
  fontSize: "12px",
  lineHeight: 1.4,
};