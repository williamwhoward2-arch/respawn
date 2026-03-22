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

// ─── Types ────────────────────────────────────────────────────────────────────

type WeightMode = "total" | "per_side";

type SetEntry = {
  weight: string;
  reps: string;
  completed?: boolean;
  weightMode?: WeightMode;
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

type VersaClimberEntry = {
  id: string;
  minutes: string;
  seconds: string;
  feet: string;
  completed?: boolean;
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
  exerciseCompleted?: boolean;
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
    sets: { set_number: number; weight: string; reps: string }[];
  }[];
};

type AuthUser = { id: string; email?: string };

type ExerciseHistorySnapshot = {
  exerciseName: string;
  bodyPart: string;
  lastWeight: string;
  lastReps: string;
  bestWeight: string;
  bestReps: string;
};

type ExerciseHistoryMap = Record<string, ExerciseHistorySnapshot>;

type AiSuggestion = { weight: string; reps: string; reason: string };

type SavedWorkoutState = {
  workoutTitle: string;
  exercises: Exercise[];
  cardioEntries: CardioEntry[];
  versaClimberEntries: VersaClimberEntry[];
  secondsElapsed: number;
  timerRunning: boolean;
  timerStartedAt: number | null; // epoch ms when timer last started
  libraryChoice: string;
  newExerciseName: string;
  newBodyPart: string;
  addExerciseMode: "library" | "custom";
  activeExerciseId: string | null;
};

type ConfirmAction = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: null | (() => void);
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CARDIO_METHODS = [
  "Walking","Treadmill Walk","Incline Walk","Treadmill Run","Jog","Outdoor Run",
  "Bike","Spin Bike","Stairmaster","Elliptical","Rowing Machine","Swimming",
  "Hiking","Sled Push","Jump Rope","Assault Bike","SkiErg","Ruck Walk",
  "Prowler Push","Other",
];

const WORKOUT_DRAFT_KEY = "respawn_active_workout_draft";
// Key that stores the epoch ms when the timer was last started (survives refresh)
const TIMER_START_KEY = "respawn_timer_started_at";
const MAX_TIMER_SECONDS = 86400; // 24 hours

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

const BODY_PARTS = [
  "Chest","Back","Legs","Shoulders","Arms","Core","Glutes",
  "Push","Pull","Full Body","Cardio","Other",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatBodyPart(value: string) {
  const map: Record<string, string> = {
    chest: "Chest", back: "Back", legs: "Legs", shoulders: "Shoulders",
    arms: "Arms", core: "Core", glutes: "Glutes", push: "Push",
    pull: "Pull", full_body: "Full Body",
  };
  return map[value] ?? value;
}

function toNumber(value: string | number | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeName(v: string) { return v.trim().toLowerCase(); }

function getWeightIncrement(weight: number, bodyPart?: string) {
  if (bodyPart === "Arms" || bodyPart === "Shoulders") {
    return weight <= 20 ? 2.5 : 5;
  }
  if (weight <= 20) return 2.5;
  if (weight <= 220) return 5;
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
  const parts = repRange.split("-").map((p) => Number(p.trim()));
  if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return { min: parts[0], max: parts[1] };
  }
  const single = Number(repRange);
  return Number.isFinite(single) ? { min: single, max: single } : { min: 8, max: 12 };
}

function formatRestLabel(restSeconds?: number) {
  if (!restSeconds) return "Rest as needed";
  if (restSeconds < 60) return `${restSeconds}s rest`;
  const m = Math.floor(restSeconds / 60);
  const s = restSeconds % 60;
  return s === 0 ? `${m} min rest` : `${m}m ${s}s rest`;
}

function getWorkoutWarmupText(exercises: Exercise[]) {
  const compoundCount = exercises.filter((ex) => {
    const l = ex.name.toLowerCase();
    return ["press","squat","row","deadlift","pulldown","lung","hip thrust","shoulder press"]
      .some((t) => l.includes(t));
  }).length;
  return compoundCount >= 2
    ? "Warm-up once for the session: 5–8 minutes of light movement, then 2–4 ramp-up sets for your first big lift. After that, only do feeler sets if a movement needs it."
    : "Warm-up once for the session: 3–5 minutes of easy movement plus 1–3 lighter ramp-up sets before your first working exercise.";
}

function getWorkoutFocusLine(title: string, exercises: Exercise[]) {
  if (exercises.length === 0) return "Track • Progress";
  const bpCounts = exercises.reduce<Record<string, number>>((acc, ex) => {
    acc[ex.bodyPart] = (acc[ex.bodyPart] || 0) + 1;
    return acc;
  }, {});
  const topBp = Object.entries(bpCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Workout";
  const totalSets = exercises.reduce((s, ex) => s + ex.sets.length, 0);
  const volumeTag = totalSets >= 18 ? "High Volume" : totalSets >= 10 ? "Moderate Volume" : "Low Volume";
  const builderTag = title.toLowerCase().includes("strength") ? "Strength Builder" : "Bodybuilding Builder";
  return `${topBp} • ${builderTag} • ${volumeTag}`;
}

function getMostLikelyWeight(name: string, exercises: Exercise[], historyMap?: ExerciseHistoryMap) {
  for (const ex of exercises) {
    if (normalizeName(ex.name) !== normalizeName(name)) continue;
    for (let i = ex.sets.length - 1; i >= 0; i--) {
      if (String(ex.sets[i].weight).trim() !== "") return String(ex.sets[i].weight);
    }
  }
  const h = historyMap?.[normalizeName(name)];
  return h?.lastWeight || h?.bestWeight || "";
}

function getMostLikelyReps(name: string, exercises: Exercise[], historyMap?: ExerciseHistoryMap, fallback = "") {
  for (const ex of exercises) {
    if (normalizeName(ex.name) !== normalizeName(name)) continue;
    for (let i = ex.sets.length - 1; i >= 0; i--) {
      if (String(ex.sets[i].reps).trim() !== "") return String(ex.sets[i].reps);
    }
  }
  const h = historyMap?.[normalizeName(name)];
  return h?.lastReps || h?.bestReps || fallback;
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

  const priorCompleted = exercise.sets
    .slice(0, setIndex + 1)
    .filter((s) => s.completed && String(s.weight).trim() !== "" && String(s.reps).trim() !== "");
  const lastCompleted = priorCompleted.length > 0 ? priorCompleted[priorCompleted.length - 1] : null;

  const history = historyMap[normalizeName(exercise.name)];
  const refWeight = lastCompleted ? toNumber(lastCompleted.weight) : currentWeight || toNumber(history?.lastWeight) || 0;
  const refReps = lastCompleted ? toNumber(lastCompleted.reps) : currentReps || toNumber(history?.lastReps) || repRange.min;

  if (!refWeight && !refReps) {
    return { weight: "", reps: String(repRange.min), reason: `Start near the bottom of your ${repRange.min}-${repRange.max} rep range.` };
  }

  const inc = getWeightIncrement(refWeight || 20, exercise.bodyPart);
  let sugWeight = refWeight;
  let sugReps = Math.max(repRange.min, Math.min(refReps || repRange.min, repRange.max));
  let reason = `Stay in the ${repRange.min}-${repRange.max} rep range and keep form tight.`;

  if (refReps >= repRange.max + 1) {
    sugWeight = roundToIncrement(refWeight + inc, inc);
    sugReps = repRange.min;
    reason = `You overshot the rep target. AI suggests +${formatSmartNumber(inc)} and reset to the bottom of the range.`;
  } else if (refReps === repRange.max) {
    sugWeight = roundToIncrement(refWeight + inc, inc);
    sugReps = repRange.min;
    reason = `Top of range hit cleanly. AI suggests a small load increase of ${formatSmartNumber(inc)}.`;
  } else if (refReps >= repRange.min && refReps < repRange.max) {
    sugReps = Math.min(repRange.max, refReps + 1);
    reason = `Same load, try to add a rep inside ${repRange.min}-${repRange.max}.`;
  } else if (refReps === repRange.min - 1) {
    reason = `Almost there — hold weight and bring set into the target range.`;
  } else {
    sugWeight = Math.max(0, roundToIncrement(refWeight - inc, inc));
    sugReps = repRange.min;
    reason = `Reps fell below target. Slight pullback to get back in range.`;
  }

  return { weight: sugWeight ? formatSmartNumber(sugWeight) : "", reps: String(sugReps), reason };
}

function sanitizeIntegerInput(v: string) { return v.replace(/[^\d]/g, ""); }
function sanitizeDecimalInput(v: string) {
  const c = v.replace(/[^\d.]/g, "");
  const dot = c.indexOf(".");
  if (dot === -1) return c;
  return `${c.slice(0, dot + 1)}${c.slice(dot + 1).replace(/\./g, "")}`;
}
function formatMilesValue(v: number) { return v <= 0 ? "" : formatSmartNumber(Math.max(0, v)); }

function mapPrimaryMuscleToLibraryBodyPart(muscle: string): string {
  if (muscle === "chest") return "Chest";
  if (["back","lats","upper_back","lower_back"].includes(muscle)) return "Back";
  if (["quads","hamstrings","calves"].includes(muscle)) return "Legs";
  if (muscle === "glutes") return "Glutes";
  if (["shoulders","front_delts","side_delts","rear_delts"].includes(muscle)) return "Shoulders";
  if (["biceps","triceps","forearms"].includes(muscle)) return "Arms";
  if (muscle === "core") return "Core";
  return "Other";
}

const BASE_EXERCISE_LIBRARY: LibraryExercise[] = exerciseLibrary.map((ex) => ({
  name: ex.name,
  bodyPart: mapPrimaryMuscleToLibraryBodyPart(ex.primaryMuscle),
}));

// ─── Component ────────────────────────────────────────────────────────────────

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
  const [addExerciseMode, setAddExerciseMode] = useState<"library" | "custom">("library");

  // ── Timer state
  // secondsElapsed = elapsed seconds as of last stop (or current elapsed if running)
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  // Epoch ms when the timer was most recently started (null if stopped)
  const timerStartedAtRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [recentExercises, setRecentExercises] = useState<string[]>([]);
  const [favoriteExercises, setFavoriteExercises] = useState<string[]>([]);
  const [customLibrary, setCustomLibrary] = useState<LibraryExercise[]>([]);
  const [workoutTitle, setWorkoutTitle] = useState("Track Your Session");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [cardioEntries, setCardioEntries] = useState<CardioEntry[]>([]);
  const [versaClimberEntries, setVersaClimberEntries] = useState<VersaClimberEntry[]>([]);
  const [historyMap, setHistoryMap] = useState<ExerciseHistoryMap>({});
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>({
    open: false, title: "", message: "", confirmLabel: "Yes", onConfirm: null,
  });

  const exerciseCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const queueSectionRef = useRef<HTMLElement | null>(null);

  // ── Derived
  const activeExerciseIndex = useMemo(() => {
    if (!activeExerciseId) return exercises.length > 0 ? 0 : -1;
    return exercises.findIndex((ex) => ex.id === activeExerciseId);
  }, [activeExerciseId, exercises]);

  const activeExercise = activeExerciseIndex >= 0 ? exercises[activeExerciseIndex] : null;

  const completedExerciseCount = useMemo(
    () => exercises.filter((ex) => ex.exerciseCompleted).length,
    [exercises]
  );

  // ── Timer: persistent across refresh ──────────────────────────────────────
  // Strategy: store the epoch-ms start time in localStorage + state ref.
  // On tick, calculate elapsed = base + (now - startedAt). Capped at 24h.
  // On Stop, store accumulated elapsed. On Start, record new startedAt.

  function getElapsedSeconds(base: number, startedAt: number | null): number {
    if (startedAt === null) return base;
    const extra = Math.floor((Date.now() - startedAt) / 1000);
    return Math.min(base + extra, MAX_TIMER_SECONDS);
  }

  function startTimer(baseSeconds?: number) {
    const base = baseSeconds ?? secondsElapsed;
    const now = Date.now();
    timerStartedAtRef.current = now;
    localStorage.setItem(TIMER_START_KEY, JSON.stringify({ startedAt: now, base }));
    setTimerRunning(true);
    setStatus("Timer started.");
  }

  function stopTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    const elapsed = getElapsedSeconds(secondsElapsed, timerStartedAtRef.current);
    timerStartedAtRef.current = null;
    localStorage.removeItem(TIMER_START_KEY);
    setSecondsElapsed(elapsed);
    setTimerRunning(false);
    setStatus("Timer stopped.");
  }

  function resetTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    timerStartedAtRef.current = null;
    localStorage.removeItem(TIMER_START_KEY);
    setSecondsElapsed(0);
    setTimerRunning(false);
    setStatus("Timer reset.");
  }

  function adjustTimer(seconds: number) {
    if (timerRunning) {
      // Adjust the base by shifting the startedAt backwards/forwards
      const currentElapsed = getElapsedSeconds(secondsElapsed, timerStartedAtRef.current);
      const newBase = Math.max(0, currentElapsed + seconds);
      const now = Date.now();
      timerStartedAtRef.current = now;
      // Store new base so refresh also reflects it
      localStorage.setItem(TIMER_START_KEY, JSON.stringify({ startedAt: now, base: newBase }));
      setSecondsElapsed(newBase);
    } else {
      setSecondsElapsed((prev) => Math.max(0, prev + seconds));
    }
    setStatus("Timer adjusted.");
  }

  // Ticker — runs every second while timerRunning
  useEffect(() => {
    if (!timerRunning) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsElapsed(getElapsedSeconds(
        // read base from ref to avoid stale closure
        JSON.parse(localStorage.getItem(TIMER_START_KEY) || "null")?.base ?? 0,
        timerStartedAtRef.current
      ));
    }, 1000);
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRunning]);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => { void initializeWorkoutPage(); }, []);

  useEffect(() => {
    localStorage.setItem("respawn_recent_exercises", JSON.stringify(recentExercises));
  }, [recentExercises]);

  useEffect(() => {
    localStorage.setItem("respawn_custom_exercise_library", JSON.stringify(customLibrary));
  }, [customLibrary]);

  // Persist draft (timer state handled via TIMER_START_KEY separately)
  useEffect(() => {
    if (authLoading || finished) return;
    const draft: SavedWorkoutState = {
      workoutTitle, exercises, cardioEntries, versaClimberEntries,
      secondsElapsed, timerRunning: false, timerStartedAt: null,
      libraryChoice, newExerciseName, newBodyPart, addExerciseMode, activeExerciseId,
    };
    localStorage.setItem(WORKOUT_DRAFT_KEY, JSON.stringify(draft));
  }, [authLoading, finished, workoutTitle, exercises, cardioEntries, versaClimberEntries,
      secondsElapsed, libraryChoice, newExerciseName, newBodyPart, addExerciseMode, activeExerciseId]);

  useEffect(() => {
    if (exercises.length === 0 && cardioEntries.length === 0 && versaClimberEntries.length === 0) {
      if (workoutTitle !== "Track Your Session") setWorkoutTitle("Track Your Session");
    }
  }, [exercises.length, cardioEntries.length, versaClimberEntries.length, workoutTitle]);

  useEffect(() => {
    if (exercises.length === 0) { setActiveExerciseId(null); return; }
    if (activeExerciseId === null) return;
    const stillExists = exercises.some((ex) => ex.id === activeExerciseId);
    if (!stillExists) {
      const firstIncomplete = exercises.find((ex) => !ex.exerciseCompleted) ?? exercises[0];
      setActiveExerciseId(firstIncomplete.id);
    }
  }, [exercises, activeExerciseId]);

  async function loadExerciseHistory(userId: string): Promise<ExerciseHistoryMap> {
    const { data, error } = await supabase
      .from("workout_sets")
      .select("exercise_name, body_part, weight, reps, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) { console.error("Failed to load history:", error); return {}; }
    const nextHistory: ExerciseHistoryMap = {};
    for (const row of data || []) {
      const name = String(row.exercise_name || "").trim();
      if (!name) continue;
      const key = normalizeName(name);
      const weight = String(row.weight ?? "").trim();
      const reps = String(row.reps ?? "").trim();
      if (!nextHistory[key]) {
        nextHistory[key] = { exerciseName: name, bodyPart: String(row.body_part || "Other"), lastWeight: weight, lastReps: reps, bestWeight: weight, bestReps: reps };
        continue;
      }
      if (toNumber(weight) > toNumber(nextHistory[key].bestWeight)) {
        nextHistory[key].bestWeight = weight;
        nextHistory[key].bestReps = reps;
      }
    }
    return nextHistory;
  }

  async function loadUserFavorites(userId: string): Promise<string[]> {
    const { data, error } = await supabase.from("user_favorite_exercises").select("exercise_name").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) { console.error("Failed to load favorites:", error); return []; }
    return (data || []).map((r) => String(r.exercise_name || ""));
  }

  async function addFavoriteForUser(userId: string, name: string) {
    const { error } = await supabase.from("user_favorite_exercises").insert({ user_id: userId, exercise_name: name });
    if (error && !error.message.toLowerCase().includes("duplicate")) throw error;
  }

  async function removeFavoriteForUser(userId: string, name: string) {
    const { error } = await supabase.from("user_favorite_exercises").delete().eq("user_id", userId).eq("exercise_name", name);
    if (error) throw error;
  }

  async function initializeWorkoutPage() {
    setAuthLoading(true);
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      if (error.message.includes("Invalid Refresh Token")) { await supabase.auth.signOut(); router.replace("/login"); return; }
      setStatus(`Error loading account: ${error.message}`); setAuthLoading(false); return;
    }
    if (!user) { router.replace("/login"); return; }
    setAuthUser({ id: user.id, email: user.email });

    const savedRecent = localStorage.getItem("respawn_recent_exercises");
    const savedCustomLib = localStorage.getItem("respawn_custom_exercise_library");
    setRecentExercises(savedRecent ? JSON.parse(savedRecent) : []);
    setCustomLibrary(savedCustomLib ? JSON.parse(savedCustomLib) : []);

    const [loadedHistory, loadedFavorites] = await Promise.all([
      loadExerciseHistory(user.id),
      loadUserFavorites(user.id),
    ]);
    setHistoryMap(loadedHistory);
    setFavoriteExercises(loadedFavorites);

    // Restore timer from localStorage (survives refresh)
    const savedTimer = localStorage.getItem(TIMER_START_KEY);
    if (savedTimer) {
      try {
        const { startedAt, base } = JSON.parse(savedTimer) as { startedAt: number; base: number };
        const elapsed = getElapsedSeconds(base, startedAt);
        if (elapsed < MAX_TIMER_SECONDS) {
          timerStartedAtRef.current = startedAt;
          setSecondsElapsed(elapsed);
          setTimerRunning(true);
        } else {
          localStorage.removeItem(TIMER_START_KEY);
        }
      } catch { localStorage.removeItem(TIMER_START_KEY); }
    }

    // Generated workout
    const rawGenerated = localStorage.getItem("respawn_generated_workout");
    if (rawGenerated) {
      try {
        const parsed: GeneratedWorkoutPayload = JSON.parse(rawGenerated);
        const mappedExercises: Exercise[] = parsed.exercises.map((ex) => {
          const history = loadedHistory[normalizeName(ex.exercise_name)];
          return {
            id: makeId(),
            name: ex.exercise_name,
            bodyPart: formatBodyPart(ex.body_part),
            restSeconds: ex.restSeconds,
            repRange: ex.repRange,
            coachingNote: ex.coachingNote,
            reason: ex.reason,
            notes: ex.notes ?? null,
            sets: ex.sets.length > 0
              ? ex.sets.map((s, i) => ({
                  weight: String(s.weight ?? "").trim() !== "" ? String(s.weight) : i === 0 ? history?.lastWeight || "" : "",
                  reps: String(s.reps ?? "").trim() !== "" ? String(s.reps) : i === 0 ? history?.lastReps || ex.repRange?.split("-")[0] || "8" : ex.repRange?.split("-")[0] || "8",
                  completed: false, weightMode: "total" as WeightMode,
                }))
              : [{ weight: history?.lastWeight || "", reps: history?.lastReps || ex.repRange?.split("-")[0] || "8", completed: false, weightMode: "total" as WeightMode }],
            favorite: loadedFavorites.includes(ex.exercise_name),
          };
        });
        if (mappedExercises.length > 0) {
          setExercises(mappedExercises);
          setWorkoutTitle(parsed.workout_name || "Generated Workout");
          setCardioEntries([]); setVersaClimberEntries([]);
          setStatus(`${parsed.workout_name} loaded.`);
        }
        localStorage.removeItem("respawn_generated_workout");
        localStorage.removeItem(WORKOUT_DRAFT_KEY);
        setAuthLoading(false);
        return;
      } catch (err) { console.error("Failed to load generated workout:", err); }
    }

    // Restore draft
    const savedDraft = localStorage.getItem(WORKOUT_DRAFT_KEY);
    if (savedDraft) {
      try {
        const d: SavedWorkoutState = JSON.parse(savedDraft);
        setWorkoutTitle(d.workoutTitle || "Track Your Session");
        setExercises(Array.isArray(d.exercises) ? d.exercises : []);
        setCardioEntries(Array.isArray(d.cardioEntries) ? d.cardioEntries : []);
        setVersaClimberEntries(Array.isArray(d.versaClimberEntries) ? d.versaClimberEntries : []);
        // Don't restore secondsElapsed from draft — timer handles it above
        setLibraryChoice(d.libraryChoice || "");
        setNewExerciseName(d.newExerciseName || "");
        setNewBodyPart(d.newBodyPart || "");
        setAddExerciseMode(d.addExerciseMode || "library");
        setActiveExerciseId(d.activeExerciseId || null);
        setStatus("Recovered your in-progress workout.");
        setAuthLoading(false);
        return;
      } catch (err) { console.error("Failed to load draft:", err); }
    }

    setAuthLoading(false);
  }

  // ── Confirm dialog ──────────────────────────────────────────────────────

  function openConfirm(options: Omit<ConfirmAction, "open">) {
    setConfirmAction({ open: true, ...options });
  }
  function closeConfirm() {
    setConfirmAction({ open: false, title: "", message: "", confirmLabel: "Yes", onConfirm: null });
  }
  function runConfirmedAction() { confirmAction.onConfirm?.(); closeConfirm(); }

  // ── Exercise library ─────────────────────────────────────────────────────

  const allExerciseLibrary = useMemo(() => {
    const merged = [...customLibrary, ...EXPANDED_EXERCISE_LIBRARY, ...BASE_EXERCISE_LIBRARY];
    const seen = new Set<string>();
    return merged.filter((item) => {
      const key = normalizeName(item.name);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }, [customLibrary]);

  const filteredExerciseLibrary = useMemo(() => {
    return allExerciseLibrary.filter((item) => {
      const matchesBp = libraryFilter === "All" || item.bodyPart === libraryFilter;
      const matchesSearch = librarySearch.trim() === "" || item.name.toLowerCase().includes(librarySearch.trim().toLowerCase());
      return matchesBp && matchesSearch;
    });
  }, [allExerciseLibrary, libraryFilter, librarySearch]);

  const libraryMap = useMemo(() => {
    const map = new Map<string, string>();
    allExerciseLibrary.forEach((item) => map.set(item.name, item.bodyPart));
    return map;
  }, [allExerciseLibrary]);

  // ── Computed workout stats ───────────────────────────────────────────────

  const completedSets = useMemo(() => {
    return exercises.flatMap((ex) =>
      ex.sets
        .filter((s) => s.completed && String(s.weight).trim() !== "" && String(s.reps).trim() !== "")
        .map((s) => ({
          exerciseName: ex.name,
          bodyPart: ex.bodyPart,
          weight: s.weight,
          reps: s.reps,
          weightMode: s.weightMode ?? "total",
          // For volume calculation, per-side weight × 2
          effectiveWeight: s.weightMode === "per_side" ? toNumber(s.weight) * 2 : toNumber(s.weight),
          volume: (s.weightMode === "per_side" ? toNumber(s.weight) * 2 : toNumber(s.weight)) * toNumber(s.reps),
        }))
    );
  }, [exercises]);

  const completedCardio = useMemo(() => {
    return cardioEntries.filter((e) => e.completed && (String(e.minutes).trim() !== "" || String(e.seconds).trim() !== "" || String(e.miles).trim() !== ""));
  }, [cardioEntries]);

  const completedVersa = useMemo(() => {
    return versaClimberEntries.filter((v) => v.completed && (String(v.minutes).trim() !== "" || String(v.feet).trim() !== ""));
  }, [versaClimberEntries]);

  const totalSets = completedSets.length;
  const totalReps = completedSets.reduce((s, set) => s + toNumber(set.reps), 0);
  const totalVolume = completedSets.reduce((s, set) => s + set.volume, 0);
  const cardioMinutesTotal = completedCardio.reduce((s, e) => s + toNumber(e.minutes) + toNumber(e.seconds) / 60, 0);
  const cardioMilesTotal = completedCardio.reduce((s, e) => s + toNumber(e.miles), 0);
  const versaTotalFeet = completedVersa.reduce((s, v) => s + toNumber(v.feet), 0);
  const versaTotalMinutes = completedVersa.reduce((s, v) => s + toNumber(v.minutes) + toNumber(v.seconds) / 60, 0);

  const displayWorkoutTitle = exercises.length === 0 && cardioEntries.length === 0 && versaClimberEntries.length === 0 ? "Track Your Session" : workoutTitle;
  const workoutFocusLine = useMemo(() => getWorkoutFocusLine(displayWorkoutTitle, exercises), [displayWorkoutTitle, exercises]);
  const warmupText = useMemo(() => getWorkoutWarmupText(exercises), [exercises]);

  const topSet = completedSets.reduce<(typeof completedSets)[number] | null>((best, cur) => !best || cur.volume > best.volume ? cur : best, null);
  const topExerciseByVolume = Object.entries(completedSets.reduce<Record<string, number>>((acc, s) => { acc[s.exerciseName] = (acc[s.exerciseName] || 0) + s.volume; return acc; }, {})).sort((a, b) => b[1] - a[1])[0];
  const workoutHighlights = [
    topSet ? `Best set: ${topSet.exerciseName} ${topSet.weight}${topSet.weightMode === "per_side" ? " per side" : ""} × ${topSet.reps}` : null,
    topExerciseByVolume ? `Top volume: ${topExerciseByVolume[0]} (${topExerciseByVolume[1]})` : null,
    cardioMinutesTotal > 0 ? `Cardio: ${formatSmartNumber(cardioMinutesTotal)} min${cardioMilesTotal > 0 ? ` • ${formatSmartNumber(cardioMilesTotal)} mi` : ""}` : null,
    versaTotalFeet > 0 ? `VersaClimber: ${versaTotalFeet.toLocaleString()} ft${versaTotalMinutes > 0 ? ` • ${formatSmartNumber(versaTotalMinutes)} min` : ""}` : null,
  ].filter(Boolean) as string[];

  // ── Exercise helpers ──────────────────────────────────────────────────────

  function getExerciseCompletionSummary(ex: Exercise) {
    const done = ex.sets.filter((s) => s.completed).length;
    const total = ex.sets.length;
    if (ex.exerciseCompleted) return "Complete";
    if (total === 0) return "Not started";
    if (done === 0) return `${total} sets queued`;
    return `${done}/${total} sets done`;
  }

  function completeExercise(exerciseIndex: number) {
    const target = exercises[exerciseIndex];
    if (!target) return;
    setExercises((prev) => {
      const updated = [...prev];
      updated[exerciseIndex] = { ...updated[exerciseIndex], exerciseCompleted: true };
      return updated;
    });
    setActiveExerciseId(null);
    setStatus(`${target.name} marked complete.`);
    setTimeout(() => queueSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function moveToNextExercise() {
    if (activeExerciseIndex < 0) return;
    setActiveExerciseId(exercises[Math.min(exercises.length - 1, activeExerciseIndex + 1)]?.id ?? null);
  }

  function moveToPreviousExercise() {
    if (activeExerciseIndex < 0) return;
    setActiveExerciseId(exercises[Math.max(0, activeExerciseIndex - 1)]?.id ?? null);
  }

  function updateSetField(exerciseIndex: number, setIndex: number, field: "weight" | "reps", value: string) {
    setExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[exerciseIndex] };
      const sets = [...ex.sets];
      sets[setIndex] = { ...sets[setIndex], [field]: value, completed: false };
      ex.sets = sets; updated[exerciseIndex] = ex;
      return updated;
    });
  }

  function updateSetWeightMode(exerciseIndex: number, setIndex: number, mode: WeightMode) {
    setExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[exerciseIndex] };
      const sets = [...ex.sets];
      sets[setIndex] = { ...sets[setIndex], weightMode: mode, completed: false };
      ex.sets = sets; updated[exerciseIndex] = ex;
      return updated;
    });
  }

  function applySuggestionToSet(exerciseIndex: number, setIndex: number) {
    setExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[exerciseIndex] };
      const sets = [...ex.sets];
      const suggestion = buildProgressionSuggestion(ex, setIndex, prev, historyMap);
      sets[setIndex] = { ...sets[setIndex], weight: suggestion.weight, reps: suggestion.reps, completed: false };
      ex.sets = sets; updated[exerciseIndex] = ex;
      return updated;
    });
    setStatus("AI suggestion applied.");
  }

  function resetSetValues(exerciseIndex: number, setIndex: number) {
    setExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[exerciseIndex] };
      const sets = [...ex.sets];
      sets[setIndex] = { ...sets[setIndex], weight: "", reps: "", completed: false };
      ex.sets = sets; updated[exerciseIndex] = ex;
      return updated;
    });
    setStatus("Set values cleared.");
  }

  function toggleSetCompleted(exerciseIndex: number, setIndex: number) {
    let blocked = false;
    setExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[exerciseIndex] };
      const sets = [...ex.sets];
      const cur = sets[setIndex];
      if (!String(cur.weight).trim() || !String(cur.reps).trim()) { blocked = true; return prev; }
      const willComplete = !cur.completed;
      sets[setIndex] = { ...cur, completed: willComplete };
      if (willComplete && sets[setIndex + 1]) {
        const next = sets[setIndex + 1];
        if (!String(next.weight).trim() && !String(next.reps).trim()) {
          const tempEx = { ...ex, sets };
          const sug = buildProgressionSuggestion(tempEx, setIndex, updated, historyMap);
          sets[setIndex + 1] = { ...next, weight: sug.weight, reps: sug.reps, completed: false };
        }
      }
      ex.sets = sets; updated[exerciseIndex] = ex;
      return updated;
    });
    if (blocked) { setStatus("Enter both weight and reps before marking a set complete."); return; }
    setStatus("Set updated.");
  }

  function addSet(exerciseIndex: number) {
    setExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[exerciseIndex] };
      const nextIndex = ex.sets.length;
      const sug = buildProgressionSuggestion(ex, Math.max(0, nextIndex - 1), updated, historyMap);
      const prevMode = ex.sets[ex.sets.length - 1]?.weightMode ?? "total";
      ex.sets = [...ex.sets, { weight: sug.weight, reps: sug.reps, completed: false, weightMode: prevMode }];
      updated[exerciseIndex] = ex;
      return updated;
    });
    setStatus("Set added with AI prefill.");
  }

  function removeSet(exerciseIndex: number, setIndex: number) {
    openConfirm({
      title: "Remove set?",
      message: `This will remove Set ${setIndex + 1}.`,
      confirmLabel: "Yes, remove",
      onConfirm: () => {
        setExercises((prev) => {
          const updated = [...prev];
          const ex = { ...updated[exerciseIndex] };
          ex.sets = ex.sets.filter((_, i) => i !== setIndex);
          updated[exerciseIndex] = ex;
          return updated.filter((item) => item.sets.length > 0);
        });
        setStatus("Set removed.");
      },
    });
  }

  function resetExerciseSets(exerciseIndex: number) {
    openConfirm({
      title: "Clear all sets?",
      message: "This will clear all weight, reps, and completion marks.",
      confirmLabel: "Yes, clear",
      onConfirm: () => {
        setExercises((prev) => {
          const updated = [...prev];
          updated[exerciseIndex] = { ...updated[exerciseIndex], sets: updated[exerciseIndex].sets.map(() => ({ weight: "", reps: "", completed: false, weightMode: "total" as WeightMode })) };
          return updated;
        });
        setStatus("All set values cleared.");
      },
    });
  }

  function removeExercise(exerciseIndex: number) {
    const name = exercises[exerciseIndex]?.name || "this exercise";
    openConfirm({
      title: "Remove exercise?",
      message: `This will remove ${name} and all of its sets.`,
      confirmLabel: "Yes, remove",
      onConfirm: () => {
        setExercises((prev) => prev.filter((_, i) => i !== exerciseIndex));
        setStatus(`${name} removed.`);
      },
    });
  }

  function pushRecent(name: string) {
    setRecentExercises((prev) => [name, ...prev.filter((n) => n !== name)].slice(0, 10));
  }

  function saveCustomExerciseToLibrary(name: string, bodyPart: string) {
    const clean = name.trim();
    if (!clean) return;
    const existsInFull = [...BASE_EXERCISE_LIBRARY, ...EXPANDED_EXERCISE_LIBRARY].some((i) => normalizeName(i.name) === normalizeName(clean));
    if (existsInFull) return;
    setCustomLibrary((prev) => {
      if (prev.some((i) => normalizeName(i.name) === normalizeName(clean))) return prev;
      return [{ name: clean, bodyPart: bodyPart || "Other", custom: true }, ...prev];
    });
  }

  function addExerciseFromInput(name: string, bodyPart: string) {
    const cleanName = name.trim();
    if (!cleanName) { setStatus("Enter an exercise name."); return; }
    if (exercises.some((ex) => normalizeName(ex.name) === normalizeName(cleanName))) {
      setStatus("That exercise is already in this workout."); return;
    }
    const defaultWeight = getMostLikelyWeight(cleanName, exercises, historyMap);
    const defaultReps = getMostLikelyReps(cleanName, exercises, historyMap, "8");
    const newEx: Exercise = {
      id: makeId(), name: cleanName, bodyPart: bodyPart || "Other",
      sets: [{ weight: defaultWeight, reps: defaultReps, completed: false, weightMode: "total" }],
      favorite: favoriteExercises.includes(cleanName),
    };
    setExercises((prev) => [newEx, ...prev]);
    setActiveExerciseId(newEx.id);
    saveCustomExerciseToLibrary(cleanName, bodyPart || "Other");
    pushRecent(cleanName);
    setNewExerciseName(""); setNewBodyPart(""); setLibraryChoice(""); setLibrarySearch("");
    setStatus("Exercise added at the top.");
    setTimeout(() => exerciseCardRefs.current[newEx.id]?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function addExercise() {
    if (addExerciseMode === "library") {
      if (!libraryChoice) { setStatus("Choose an exercise from the library."); return; }
      addExerciseFromInput(libraryChoice, libraryMap.get(libraryChoice) || "Other");
    } else {
      if (!newExerciseName.trim()) { setStatus("Enter a custom exercise name."); return; }
      if (!newBodyPart) { setStatus("Select a body part."); return; }
      addExerciseFromInput(newExerciseName, newBodyPart || "Other");
    }
  }

  function addRecentExercise(name: string) {
    addExerciseFromInput(name, libraryMap.get(name) || "Other");
  }

  async function toggleFavorite(name: string) {
    if (!authUser?.id) { setStatus("You must be signed in to save favorites."); return; }
    const exists = favoriteExercises.includes(name);
    try {
      if (exists) {
        await removeFavoriteForUser(authUser.id, name);
        setFavoriteExercises((prev) => prev.filter((n) => n !== name));
        setStatus(`${name} removed from favorites.`);
      } else {
        await addFavoriteForUser(authUser.id, name);
        setFavoriteExercises((prev) => [name, ...prev]);
        setStatus(`${name} added to favorites.`);
      }
    } catch (err) { console.error("Favorite update failed:", err); setStatus("Could not update favorite."); }
  }

  // ── Cardio helpers ──────────────────────────────────────────────────────

  function addCardioEntry() {
    setCardioEntries((prev) => [...prev, { id: makeId(), method: "Walking", miles: "", minutes: "", seconds: "", completed: false, notes: "" }]);
    setStatus("Cardio entry added.");
  }

  function updateCardioField(id: string, field: "method" | "miles" | "minutes" | "seconds" | "notes", value: string) {
    setCardioEntries((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      if (field === "minutes" || field === "seconds") return { ...e, [field]: sanitizeIntegerInput(value), completed: false };
      if (field === "miles") return { ...e, miles: sanitizeDecimalInput(value), completed: false };
      return { ...e, [field]: value, completed: false };
    }));
  }

  function adjustCardioMinutes(id: string, delta: number) {
    setCardioEntries((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      const total = toNumber(e.minutes) * 60 + Math.min(59, toNumber(e.seconds));
      const next = Math.max(0, total + delta * 60);
      return { ...e, minutes: Math.floor(next / 60) > 0 ? String(Math.floor(next / 60)) : "", seconds: next % 60 > 0 ? String(next % 60) : "", completed: false };
    }));
  }

  function adjustCardioSeconds(id: string, delta: number) {
    setCardioEntries((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      const total = toNumber(e.minutes) * 60 + Math.min(59, toNumber(e.seconds));
      const next = Math.max(0, total + delta);
      return { ...e, minutes: Math.floor(next / 60) > 0 ? String(Math.floor(next / 60)) : "", seconds: next % 60 > 0 ? String(next % 60) : "", completed: false };
    }));
  }

  function adjustCardioMiles(id: string, delta: number) {
    setCardioEntries((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      const next = Math.max(0, Math.round((toNumber(e.miles) + delta) * 100) / 100);
      return { ...e, miles: formatMilesValue(next), completed: false };
    }));
  }

  function toggleCardioCompleted(id: string) {
    let blocked = false;
    setCardioEntries((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      const hasData = String(e.minutes).trim() !== "" || String(e.seconds).trim() !== "" || String(e.miles).trim() !== "";
      if (!hasData) { blocked = true; return e; }
      return { ...e, completed: !e.completed };
    }));
    if (blocked) setStatus("Add time or miles before marking cardio complete.");
    else setStatus("Cardio updated.");
  }

  function removeCardioEntry(id: string) {
    openConfirm({
      title: "Remove cardio entry?", message: "This cardio entry will be removed.", confirmLabel: "Yes, remove",
      onConfirm: () => { setCardioEntries((prev) => prev.filter((e) => e.id !== id)); setStatus("Cardio removed."); },
    });
  }

  // ── VersaClimber helpers ─────────────────────────────────────────────────

  function addVersaClimberEntry() {
    setVersaClimberEntries((prev) => [...prev, { id: makeId(), minutes: "", seconds: "", feet: "", completed: false }]);
    setStatus("VersaClimber entry added.");
  }

  function updateVersaField(id: string, field: "minutes" | "seconds" | "feet", value: string) {
    setVersaClimberEntries((prev) => prev.map((v) => {
      if (v.id !== id) return v;
      return { ...v, [field]: field === "feet" ? sanitizeIntegerInput(value) : sanitizeIntegerInput(value), completed: false };
    }));
  }

  function adjustVersaMinutes(id: string, delta: number) {
    setVersaClimberEntries((prev) => prev.map((v) => {
      if (v.id !== id) return v;
      const total = toNumber(v.minutes) * 60 + Math.min(59, toNumber(v.seconds));
      const next = Math.max(0, total + delta * 60);
      return { ...v, minutes: Math.floor(next / 60) > 0 ? String(Math.floor(next / 60)) : "", seconds: next % 60 > 0 ? String(next % 60) : "", completed: false };
    }));
  }

  function adjustVersaSeconds(id: string, delta: number) {
    setVersaClimberEntries((prev) => prev.map((v) => {
      if (v.id !== id) return v;
      const total = toNumber(v.minutes) * 60 + Math.min(59, toNumber(v.seconds));
      const next = Math.max(0, total + delta);
      return { ...v, minutes: Math.floor(next / 60) > 0 ? String(Math.floor(next / 60)) : "", seconds: next % 60 > 0 ? String(next % 60) : "", completed: false };
    }));
  }

  function adjustVersaFeet(id: string, delta: number) {
    setVersaClimberEntries((prev) => prev.map((v) => {
      if (v.id !== id) return v;
      const next = Math.max(0, toNumber(v.feet) + delta);
      return { ...v, feet: next > 0 ? String(next) : "", completed: false };
    }));
  }

  function toggleVersaCompleted(id: string) {
    let blocked = false;
    setVersaClimberEntries((prev) => prev.map((v) => {
      if (v.id !== id) return v;
      const hasData = String(v.minutes).trim() !== "" || String(v.feet).trim() !== "";
      if (!hasData) { blocked = true; return v; }
      return { ...v, completed: !v.completed };
    }));
    if (blocked) setStatus("Add time or feet before marking VersaClimber complete.");
    else setStatus("VersaClimber updated.");
  }

  function removeVersaEntry(id: string) {
    openConfirm({
      title: "Remove VersaClimber entry?", message: "This entry will be removed.", confirmLabel: "Yes, remove",
      onConfirm: () => { setVersaClimberEntries((prev) => prev.filter((v) => v.id !== id)); setStatus("VersaClimber entry removed."); },
    });
  }

  // ── Save workout ──────────────────────────────────────────────────────────

  async function persistCardioEntries(workoutId: number) {
    if (!authUser?.id) return;
    const rows: object[] = [];

    completedCardio.forEach((e, i) => {
      rows.push({ workout_id: workoutId, user_id: authUser.id, entry_number: i + 1, method: e.method, miles: toNumber(e.miles) || null, duration_seconds: toNumber(e.minutes) * 60 + toNumber(e.seconds), notes: e.notes?.trim() || null });
    });

    // VersaClimber stored in workout_cardio with method="versaclimber", feet in miles col
    completedVersa.forEach((v, i) => {
      rows.push({ workout_id: workoutId, user_id: authUser.id, entry_number: completedCardio.length + i + 1, method: "versaclimber", miles: toNumber(v.feet) || null, duration_seconds: toNumber(v.minutes) * 60 + toNumber(v.seconds), notes: null });
    });

    if (rows.length === 0) return;
    const { error } = await supabase.from("workout_cardio").insert(rows);
    if (error) console.warn("Cardio insert warning:", error.message);
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) { setStatus(`Error signing out: ${error.message}`); return; }
    router.replace("/login");
  }

  async function finishWorkout() {
    if (!authUser?.id) { setStatus("You must be signed in to save a workout."); return; }
    if (completedSets.length === 0 && completedCardio.length === 0 && completedVersa.length === 0) {
      setStatus("Complete at least one set, cardio, or VersaClimber entry before finishing."); return;
    }
    setStatus("Saving workout...");

    // Capture elapsed before stopping timer
    const finalSeconds = getElapsedSeconds(secondsElapsed, timerStartedAtRef.current);
    stopTimer();

    const cardioSummary = completedCardio.length > 0
      ? `Cardio: ${completedCardio.map((e) => { const m = toNumber(e.minutes) + toNumber(e.seconds) / 60; const mi = toNumber(e.miles); return `${e.method}${m > 0 ? ` ${formatSmartNumber(m)} min` : ""}${mi > 0 ? ` ${formatSmartNumber(mi)} mi` : ""}`; }).join(", ")}`
      : null;

    const versaSummary = completedVersa.length > 0
      ? `VersaClimber: ${completedVersa.map((v) => { const m = toNumber(v.minutes) + toNumber(v.seconds) / 60; const ft = toNumber(v.feet); return `${ft > 0 ? `${ft} ft` : ""}${m > 0 ? ` ${formatSmartNumber(m)} min` : ""}`; }).join(", ")}`
      : null;

    const { data: workoutData, error: workoutError } = await supabase.from("workouts").insert({
      user_id: authUser.id,
      workout_name: displayWorkoutTitle === "Track Your Session" ? "Custom Workout" : displayWorkoutTitle,
      duration_seconds: finalSeconds,
      day_type: exercises.length === 0 && completedCardio.length > 0 ? "cardio" : "workout",
      notes: [...workoutHighlights, cardioSummary, versaSummary].filter(Boolean).join(" • ") || null,
    }).select().single();

    if (workoutError) { setStatus(`Error saving workout: ${workoutError.message}`); return; }
    const workoutId = workoutData?.id;
    if (!workoutId) { setStatus("Workout saved but no ID returned."); return; }

    const allSets = exercises.flatMap((ex) =>
      ex.sets
        .filter((s) => s.completed && String(s.weight).trim() !== "" && String(s.reps).trim() !== "")
        .map((s, i) => ({
          workout_id: workoutId, user_id: authUser.id,
          exercise_name: ex.name, body_part: ex.bodyPart,
          set_number: i + 1, weight: s.weight, reps: s.reps,
          // Store a note about per-side in the weight field if applicable
          notes: s.weightMode === "per_side" ? `${s.weight} per side` : null,
        }))
    );

    if (allSets.length > 0) {
      const { error: setsError } = await supabase.from("workout_sets").insert(allSets);
      if (setsError) { setStatus(`Error saving sets: ${setsError.message}`); return; }
    }

    await persistCardioEntries(workoutId);
    exercises.forEach((ex) => pushRecent(ex.name));
    localStorage.removeItem(WORKOUT_DRAFT_KEY);
    setStatus("Workout saved successfully.");
    setFinished(true);
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderAddExercisePanel() {
    if (addExerciseMode === "library") {
      return (
        <div style={addExercisePanelStyle}>
          <div style={inputGridStyle}>
            <input placeholder="Search exercise library" value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)} style={inputStyle} />
            <select value={libraryFilter} onChange={(e) => { setLibraryFilter(e.target.value); setLibraryChoice(""); }} style={selectStyle}>
              <option value="All">All body parts</option>
              {BODY_PARTS.filter((p) => !["Push","Pull","Full Body"].includes(p)).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={libraryChoice} onChange={(e) => setLibraryChoice(e.target.value)} style={selectStyle}>
              <option value="">Choose from library ({filteredExerciseLibrary.length})</option>
              {filteredExerciseLibrary.slice(0, 250).map((ex) => (
                <option key={ex.name} value={ex.name}>{ex.name} • {ex.bodyPart}{ex.custom ? " • Custom" : ""}</option>
              ))}
            </select>
            <button onClick={addExercise} style={primaryButtonStyle}>Add Exercise</button>
          </div>
          <p style={helperTextStyle}>Search, choose, add.</p>
        </div>
      );
    }
    return (
      <div style={addExercisePanelStyle}>
        <div style={inputGridStyle}>
          <input placeholder="Custom exercise name" value={newExerciseName} onChange={(e) => setNewExerciseName(e.target.value)} style={inputStyle} />
          <select value={newBodyPart} onChange={(e) => setNewBodyPart(e.target.value)} style={selectStyle}>
            <option value="">Select body part</option>
            {BODY_PARTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={addExercise} style={primaryButtonStyle}>Add Custom Exercise</button>
        </div>
        <p style={helperTextStyle}>Custom exercises are saved to your local library on this device.</p>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────

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

  // ── Finished screen ───────────────────────────────────────────────────────

  if (finished) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <p style={eyebrowStyle}>WORKOUT COMPLETE</p>
          <h1 style={heroTitleStyle}>Session Logged</h1>
          <p style={heroMetaStyle}>{workoutFocusLine}</p>
          <p style={heroSubStyle}>{totalSets} sets • {totalReps} reps • {totalVolume} total volume</p>
          <p style={{ ...heroSubStyle, marginTop: 8 }}>Duration {formatTime(secondsElapsed)}</p>
          {cardioMinutesTotal > 0 && <p style={{ ...heroSubStyle, marginTop: 8 }}>Cardio {formatSmartNumber(cardioMinutesTotal)} min{cardioMilesTotal > 0 ? ` • ${formatSmartNumber(cardioMilesTotal)} miles` : ""}</p>}
          {versaTotalFeet > 0 && <p style={{ ...heroSubStyle, marginTop: 8 }}>VersaClimber {versaTotalFeet.toLocaleString()} ft{versaTotalMinutes > 0 ? ` • ${formatSmartNumber(versaTotalMinutes)} min` : ""}</p>}
        </section>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}><h2 style={sectionTitle}>Workout Results</h2></div>
          <div style={heroStatsRow}>
            <div style={heroStatBox}><span style={heroStatLabel}>Sets</span><span style={heroStatValue}>{totalSets}</span></div>
            <div style={heroStatBox}><span style={heroStatLabel}>Reps</span><span style={heroStatValue}>{totalReps}</span></div>
            <div style={heroStatBox}><span style={heroStatLabel}>Volume</span><span style={heroStatValue}>{totalVolume}</span></div>
          </div>
        </section>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}><h2 style={sectionTitle}>Highlights</h2></div>
          {workoutHighlights.length > 0
            ? <div style={listStyle}>{workoutHighlights.map((h, i) => <div key={i} style={listItemStyle}><div style={listLineStyle} /><span>{h}</span></div>)}</div>
            : <p style={mutedStyle}>No highlights yet.</p>}
        </section>
      </main>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <main style={pageStyle}>
      {/* Hero */}
      <section style={heroCardStyle}>
        <p style={eyebrowStyle}>RESPAWN WORKOUT</p>
        <h1 style={heroTitleStyle}>{displayWorkoutTitle}</h1>
        <p style={heroMetaStyle}>{workoutFocusLine}</p>
        <p style={heroSubStyle}>Log your real working sets, use AI to stay in the right rep ranges, and keep your session protected even if you refresh.</p>
        <div style={warmupHeroCardStyle}>
          <div style={warmupTitleStyle}>Warm-Up</div>
          <div style={warmupTextStyle}>{warmupText}</div>
        </div>
        <div style={accountBarStyle}>
          <div style={accountInfoStyle}>
            <span style={accountLabelStyle}>Signed in as</span>
            <span style={accountValueStyle}>{authUser?.email || authUser?.id}</span>
          </div>
          <button onClick={handleSignOut} style={secondaryButtonStyle}>Sign Out</button>
        </div>
        <div style={heroStatsRow}>
          <div style={heroStatBox}><span style={heroStatLabel}>Duration</span><span style={heroStatValue}>{formatTime(secondsElapsed)}</span></div>
          <div style={heroStatBox}><span style={heroStatLabel}>Exercises</span><span style={heroStatValue}>{exercises.length}</span></div>
          <div style={heroStatBox}><span style={heroStatLabel}>Completed Sets</span><span style={heroStatValue}>{totalSets}</span></div>
        </div>
      </section>

      {/* Timer */}
      <section style={cardStyle}>
        <div style={sectionHeaderStyle}><h2 style={sectionTitle}>Workout Timer</h2></div>
        <div style={timerDisplayStyle}>{formatTime(secondsElapsed)}</div>
        {timerRunning && <div style={timerRunningPillStyle}>● Running — tap Stop to pause</div>}
        <div style={buttonRowStyle}>
          <button onClick={() => startTimer()} disabled={timerRunning} style={timerRunning ? timerButtonDisabledStyle : primaryButtonStyle}>Start</button>
          <button onClick={stopTimer} disabled={!timerRunning} style={!timerRunning ? timerButtonDisabledStyle : secondaryButtonStyle}>Stop</button>
          <button onClick={resetTimer} style={dangerButtonStyle}>Reset</button>
        </div>
        <div style={{ ...buttonRowStyle, marginTop: 10 }}>
          <button onClick={() => adjustTimer(-60)} style={secondaryButtonStyle}>-1 min</button>
          <button onClick={() => adjustTimer(60)} style={secondaryButtonStyle}>+1 min</button>
          <button onClick={() => adjustTimer(300)} style={secondaryButtonStyle}>+5 min</button>
        </div>
        <p style={helperTextStyle}>Timer survives page refresh for up to 24 hours. Only stops when you click Stop or finish the workout.</p>
      </section>

      {/* Add Exercise */}
      <section style={cardStyle}>
        <div style={sectionHeaderStyle}><h2 style={sectionTitle}>Add Exercise</h2></div>
        <div style={modeButtonRowTwoStyle}>
          <button onClick={() => { setAddExerciseMode("library"); setLibraryChoice(""); }} style={addExerciseMode === "library" ? modeButtonActiveStyle : modeButtonStyle}>Choose from Library</button>
          <button onClick={() => setAddExerciseMode("custom")} style={addExerciseMode === "custom" ? modeButtonActiveStyle : modeButtonStyle}>Custom Add</button>
        </div>
        {renderAddExercisePanel()}
        {favoriteExercises.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <p style={subtleLabelStyle}>Favorites</p>
            <div style={chipWrapStyle}>{favoriteExercises.map((n) => <button key={n} onClick={() => addRecentExercise(n)} style={chipButtonStyle}>{n}</button>)}</div>
          </div>
        )}
        {recentExercises.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <p style={subtleLabelStyle}>Recent</p>
            <div style={chipWrapStyle}>{recentExercises.map((n) => <button key={n} onClick={() => addRecentExercise(n)} style={chipButtonStyle}>{n}</button>)}</div>
          </div>
        )}
      </section>

      {/* Cardio + VersaClimber */}
      <section style={cardStyle}>
        <div style={sectionHeaderStyle}><h2 style={sectionTitle}>Add Cardio</h2></div>

        <div style={buttonRowStyle}>
          <button onClick={addCardioEntry} style={primaryButtonStyle}>Add Cardio</button>
          <button onClick={addVersaClimberEntry} style={versaButtonStyle}>🧗 VersaClimber</button>
        </div>
        <p style={helperTextStyle}>Cardio: quick time controls, 0.5 mile steps, and manual entry. VersaClimber: time + feet climbed, auto-tags Legs & Core.</p>

        {/* Cardio entries */}
        {cardioEntries.length > 0 && (
          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {cardioEntries.map((entry, index) => {
              const totalSec = toNumber(entry.minutes) * 60 + Math.min(59, toNumber(entry.seconds));
              const dispMin = Math.floor(totalSec / 60);
              const dispSec = totalSec % 60;
              return (
                <div key={entry.id} style={cardioCardStyle}>
                  <div style={cardioHeaderStyle}>
                    <div style={cardioTitleStyle}>Cardio {index + 1}</div>
                    <div style={buttonRowStyle}>
                      <button onClick={() => toggleCardioCompleted(entry.id)} style={entry.completed ? completeButtonActiveStyle : completeButtonStyle}>{entry.completed ? "Completed" : "Complete Cardio"}</button>
                      <button onClick={() => removeCardioEntry(entry.id)} style={dangerButtonStyle}>Remove</button>
                    </div>
                  </div>
                  <div style={inputGridStyle}>
                    <select value={entry.method} onChange={(e) => updateCardioField(entry.id, "method", e.target.value)} style={selectStyle}>
                      {CARDIO_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div style={cardioQuickSectionStyle}>
                    <div style={cardioSectionTitleStyle}>Time</div>
                    <div style={cardioPillRowStyle}>
                      <button onClick={() => adjustCardioMinutes(entry.id, -5)} style={secondaryButtonStyle}>-5 min</button>
                      <button onClick={() => adjustCardioMinutes(entry.id, -1)} style={secondaryButtonStyle}>-1 min</button>
                      <button onClick={() => adjustCardioMinutes(entry.id, 1)} style={secondaryButtonStyle}>+1 min</button>
                      <button onClick={() => adjustCardioMinutes(entry.id, 5)} style={secondaryButtonStyle}>+5 min</button>
                    </div>
                    <div style={cardioPillRowStyle}>
                      <button onClick={() => adjustCardioSeconds(entry.id, -15)} style={secondaryButtonStyle}>-15 sec</button>
                      <button onClick={() => adjustCardioSeconds(entry.id, 15)} style={secondaryButtonStyle}>+15 sec</button>
                      <div style={cardioValuePillStyle}>{String(dispMin).padStart(2,"0")}:{String(dispSec).padStart(2,"0")}</div>
                    </div>
                    <div style={inputGridStyle}>
                      <input placeholder="Minutes" value={entry.minutes} onChange={(e) => updateCardioField(entry.id, "minutes", e.target.value)} style={smallInputStyle} inputMode="numeric" />
                      <input placeholder="Seconds" value={entry.seconds} onChange={(e) => updateCardioField(entry.id, "seconds", e.target.value)} style={smallInputStyle} inputMode="numeric" />
                    </div>
                  </div>
                  <div style={cardioQuickSectionStyle}>
                    <div style={cardioSectionTitleStyle}>Miles</div>
                    <div style={cardioPillRowStyle}>
                      <button onClick={() => adjustCardioMiles(entry.id, -0.5)} style={secondaryButtonStyle}>-0.5</button>
                      <div style={cardioValuePillStyle}>{entry.miles && toNumber(entry.miles) > 0 ? entry.miles : "0"} mi</div>
                      <button onClick={() => adjustCardioMiles(entry.id, 0.5)} style={secondaryButtonStyle}>+0.5</button>
                    </div>
                    <div style={inputGridStyle}>
                      <input placeholder="Miles" value={entry.miles} onChange={(e) => updateCardioField(entry.id, "miles", e.target.value)} style={smallInputStyle} inputMode="decimal" />
                    </div>
                  </div>
                  <div style={inputGridStyle}>
                    <input placeholder="Notes (optional)" value={entry.notes || ""} onChange={(e) => updateCardioField(entry.id, "notes", e.target.value)} style={inputStyle} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VersaClimber entries */}
        {versaClimberEntries.length > 0 && (
          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {versaClimberEntries.map((v, index) => {
              const totalSec = toNumber(v.minutes) * 60 + Math.min(59, toNumber(v.seconds));
              const dispMin = Math.floor(totalSec / 60);
              const dispSec = totalSec % 60;
              return (
                <div key={v.id} style={versaCardStyle}>
                  <div style={cardioHeaderStyle}>
                    <div>
                      <div style={versaCardTitleStyle}>🧗 VersaClimber {versaClimberEntries.length > 1 ? index + 1 : ""}</div>
                      <div style={versaBodyPartTagStyle}>Legs + Core</div>
                    </div>
                    <div style={buttonRowStyle}>
                      <button onClick={() => toggleVersaCompleted(v.id)} style={v.completed ? completeButtonActiveStyle : completeButtonStyle}>{v.completed ? "Completed" : "Mark Complete"}</button>
                      <button onClick={() => removeVersaEntry(v.id)} style={dangerButtonStyle}>Remove</button>
                    </div>
                  </div>

                  {/* Time */}
                  <div style={cardioQuickSectionStyle}>
                    <div style={cardioSectionTitleStyle}>Time</div>
                    <div style={cardioPillRowStyle}>
                      <button onClick={() => adjustVersaMinutes(v.id, -5)} style={secondaryButtonStyle}>-5 min</button>
                      <button onClick={() => adjustVersaMinutes(v.id, -1)} style={secondaryButtonStyle}>-1 min</button>
                      <button onClick={() => adjustVersaMinutes(v.id, 1)} style={secondaryButtonStyle}>+1 min</button>
                      <button onClick={() => adjustVersaMinutes(v.id, 5)} style={secondaryButtonStyle}>+5 min</button>
                    </div>
                    <div style={cardioPillRowStyle}>
                      <button onClick={() => adjustVersaSeconds(v.id, -15)} style={secondaryButtonStyle}>-15 sec</button>
                      <button onClick={() => adjustVersaSeconds(v.id, 15)} style={secondaryButtonStyle}>+15 sec</button>
                      <div style={{ ...cardioValuePillStyle, borderColor: "rgba(124,92,255,0.35)" }}>{String(dispMin).padStart(2,"0")}:{String(dispSec).padStart(2,"0")}</div>
                    </div>
                    <div style={inputGridStyle}>
                      <input placeholder="Minutes" value={v.minutes} onChange={(e) => updateVersaField(v.id, "minutes", e.target.value)} style={smallInputStyle} inputMode="numeric" />
                      <input placeholder="Seconds" value={v.seconds} onChange={(e) => updateVersaField(v.id, "seconds", e.target.value)} style={smallInputStyle} inputMode="numeric" />
                    </div>
                  </div>

                  {/* Feet climbed */}
                  <div style={cardioQuickSectionStyle}>
                    <div style={cardioSectionTitleStyle}>Feet Climbed</div>
                    <div style={cardioPillRowStyle}>
                      <button onClick={() => adjustVersaFeet(v.id, -100)} style={secondaryButtonStyle}>-100</button>
                      <button onClick={() => adjustVersaFeet(v.id, -50)} style={secondaryButtonStyle}>-50</button>
                      <div style={{ ...cardioValuePillStyle, borderColor: "rgba(124,92,255,0.35)", minWidth: "110px" }}>
                        {toNumber(v.feet) > 0 ? toNumber(v.feet).toLocaleString() : "0"} ft
                      </div>
                      <button onClick={() => adjustVersaFeet(v.id, 50)} style={secondaryButtonStyle}>+50</button>
                      <button onClick={() => adjustVersaFeet(v.id, 100)} style={secondaryButtonStyle}>+100</button>
                    </div>
                    <div style={inputGridStyle}>
                      <input placeholder="Feet climbed" value={v.feet} onChange={(e) => updateVersaField(v.id, "feet", e.target.value)} style={smallInputStyle} inputMode="numeric" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {cardioEntries.length === 0 && versaClimberEntries.length === 0 && (
          <p style={{ ...helperTextStyle, marginTop: 12 }}>Track walking, treadmill work, jogging, swimming, biking, stairmaster, SkiErg, sled pushes, VersaClimber, and more.</p>
        )}
      </section>

      {/* Workout Queue */}
      <section style={cardStyle} ref={(n) => { queueSectionRef.current = n; }}>
        <div style={sectionHeaderStyle}><h2 style={sectionTitle}>Workout Queue</h2></div>
        <div style={queueSummaryStyle}>
          <div style={queueSummaryPillStyle}>{completedExerciseCount}/{exercises.length} exercises complete</div>
          {activeExercise && <div style={queueSummaryActiveStyle}>Active: {activeExercise.name}</div>}
        </div>
        {exercises.length === 0
          ? <p style={mutedStyle}>Add exercises above to build your workout queue.</p>
          : (
            <div style={queueListStyle}>
              {exercises.map((ex) => {
                const isActive = ex.id === activeExerciseId;
                return (
                  <button key={ex.id} onClick={() => setActiveExerciseId(ex.id)} style={isActive ? queueItemActiveStyle : queueItemStyle}>
                    <div style={queueItemLeftStyle}>
                      <div style={queueItemTitleStyle}>{ex.name}</div>
                      <div style={queueItemSubStyle}>{ex.bodyPart} • {ex.sets.length} sets{ex.repRange ? ` • ${ex.repRange}` : ""}</div>
                    </div>
                    <div style={queueItemRightStyle}><div style={queueStatusStyle}>{getExerciseCompletionSummary(ex)}</div></div>
                  </button>
                );
              })}
            </div>
          )}
      </section>

      {/* Active exercise card */}
      {exercises.length === 0
        ? (
          <section style={emptyStateCardStyle}>
            <h2 style={emptyStateTitleStyle}>No exercises added yet</h2>
            <p style={emptyStateTextStyle}>Start by adding an exercise above. Then log weight, reps, and confirm each completed set.</p>
          </section>
        )
        : activeExercise && activeExerciseIndex >= 0
        ? (
          <section key={activeExercise.id} style={exerciseCardOuterStyle}>
            <div style={exerciseTopRowStyle}>
              <div>
                <h2 style={exerciseTitleStyle}>{activeExercise.name}</h2>
                <p style={exerciseBodyPartStyle}>{activeExercise.bodyPart}</p>
              </div>
              <div style={buttonRowStyle}>
                <button onClick={() => toggleFavorite(activeExercise.name)} style={secondaryButtonStyle}>{favoriteExercises.includes(activeExercise.name) ? "Unfavorite" : "Favorite"}</button>
                <button onClick={() => resetExerciseSets(activeExerciseIndex)} style={secondaryButtonStyle}>Reset Sets</button>
                <button onClick={() => removeExercise(activeExerciseIndex)} style={dangerButtonStyle}>Remove</button>
              </div>
            </div>

            {!!activeExercise.restSeconds && <div style={restTagStyle}>Recommended rest: {formatRestLabel(activeExercise.restSeconds)}</div>}

            {(activeExercise.coachingNote || activeExercise.reason || activeExercise.notes || activeExercise.repRange) && (
              <div style={exerciseInfoCardStyle}>
                {activeExercise.repRange && <div style={exerciseInfoLineStyle}>Target rep range: {activeExercise.repRange}</div>}
                {activeExercise.coachingNote && <div style={exerciseInfoLineStyle}>{activeExercise.coachingNote}</div>}
                {activeExercise.reason && <div style={exerciseMutedLineStyle}>{activeExercise.reason}</div>}
                {activeExercise.notes && <div style={exerciseSpecialLineStyle}>{activeExercise.notes}</div>}
              </div>
            )}

            <div style={exerciseNavRowStyle}>
              <button onClick={moveToPreviousExercise} style={secondaryButtonStyle} disabled={activeExerciseIndex === 0}>Previous</button>
              <div style={exerciseNavMetaStyle}>Exercise {activeExerciseIndex + 1} of {exercises.length}</div>
              <button onClick={moveToNextExercise} style={secondaryButtonStyle} disabled={activeExerciseIndex === exercises.length - 1}>Next</button>
            </div>

            <div style={{ marginTop: 18 }}>
              <h3 style={setsHeaderStyle}>Sets</h3>
              {activeExercise.sets.map((set, setIndex) => {
                const suggestion = buildProgressionSuggestion(activeExercise, setIndex, exercises, historyMap);
                const mode = set.weightMode ?? "total";
                const isPerSide = mode === "per_side";

                return (
                  <div key={setIndex} style={setBlockStyle}>
                    <div style={editableSetRowStyle}>
                      <span style={setNumberStyle}>Set {setIndex + 1}</span>

                      {/* Weight input + per-side toggle */}
                      <div style={weightInputGroupStyle}>
                        <input
                          placeholder="Weight"
                          value={set.weight}
                          onChange={(e) => updateSetField(activeExerciseIndex, setIndex, "weight", e.target.value)}
                          style={smallInputStyle}
                          inputMode="decimal"
                        />
                        <select
                          value={mode}
                          onChange={(e) => updateSetWeightMode(activeExerciseIndex, setIndex, e.target.value as WeightMode)}
                          style={weightModeSelectStyle}
                          title="Weight logging mode"
                        >
                          <option value="total">Total</option>
                          <option value="per_side">Per Side</option>
                        </select>
                        {isPerSide && set.weight && (
                          <span style={perSideHintStyle}>= {formatSmartNumber(toNumber(set.weight) * 2)} total</span>
                        )}
                      </div>

                      <input
                        placeholder="Reps"
                        value={set.reps}
                        onChange={(e) => updateSetField(activeExerciseIndex, setIndex, "reps", e.target.value)}
                        style={smallInputStyle}
                        inputMode="numeric"
                      />

                      <button onClick={() => toggleSetCompleted(activeExerciseIndex, setIndex)} style={set.completed ? completeButtonActiveStyle : completeButtonStyle}>
                        {set.completed ? "Completed" : "Complete Set"}
                      </button>
                      <button onClick={() => applySuggestionToSet(activeExerciseIndex, setIndex)} style={secondaryButtonStyle}>Apply AI</button>
                      <button onClick={() => resetSetValues(activeExerciseIndex, setIndex)} style={secondaryButtonStyle}>Reset</button>
                      <button onClick={() => removeSet(activeExerciseIndex, setIndex)} style={dangerButtonStyle}>Remove</button>
                    </div>

                    <div style={aiHintCardStyle}>
                      <span style={aiHintTitleStyle}>AI Suggestion: {suggestion.weight || "-"} lbs × {suggestion.reps}</span>
                      <span style={aiHintTextStyle}>{suggestion.reason}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={() => addSet(activeExerciseIndex)} style={primaryButtonStyle}>Add Set</button>
              <button onClick={() => completeExercise(activeExerciseIndex)} style={completeExerciseButtonStyle}>Complete Exercise</button>
            </div>
          </section>
        )
        : null}

      {/* Confirm dialog */}
      {confirmAction.open && (
        <div style={confirmOverlayStyle}>
          <div style={confirmCardStyle}>
            <h3 style={confirmTitleStyle}>{confirmAction.title}</h3>
            <p style={confirmMessageStyle}>{confirmAction.message}</p>
            <div style={buttonRowStyle}>
              <button onClick={closeConfirm} style={secondaryButtonStyle}>No</button>
              <button onClick={runConfirmedAction} style={dangerButtonStyle}>{confirmAction.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      {status && <p style={statusStyle}>{status}</p>}

      <button onClick={finishWorkout} style={finishButtonStyle}>Finish Workout</button>
    </main>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = { minHeight: "100vh", background: "linear-gradient(180deg, #050505 0%, #0a0a0a 35%, #0f0f0f 100%)", color: "white", padding: "28px 20px 140px", fontFamily: "sans-serif" };
const heroCardStyle: CSSProperties = { background: "linear-gradient(135deg, rgba(255,26,26,0.18) 0%, rgba(20,20,20,1) 55%, rgba(10,10,10,1) 100%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "24px", padding: "24px", marginBottom: "18px", boxShadow: "0 10px 30px rgba(0,0,0,0.35)" };
const eyebrowStyle: CSSProperties = { color: "#ff6b6b", fontSize: "12px", fontWeight: 700, letterSpacing: "0.14em", margin: "0 0 10px" };
const heroTitleStyle: CSSProperties = { color: "#ffffff", fontSize: "30px", lineHeight: 1.1, fontWeight: 800, margin: "0 0 8px" };
const heroMetaStyle: CSSProperties = { color: "#ffb8b8", fontSize: "14px", fontWeight: 700, margin: "0 0 8px" };
const heroSubStyle: CSSProperties = { color: "#d0d0d0", fontSize: "15px", margin: 0 };
const warmupHeroCardStyle: CSSProperties = { marginTop: "14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "12px 14px" };
const warmupTitleStyle: CSSProperties = { color: "#ff8b8b", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" };
const warmupTextStyle: CSSProperties = { color: "#efefef", fontSize: "13px", lineHeight: 1.45 };
const accountBarStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "18px" };
const accountInfoStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: "4px" };
const accountLabelStyle: CSSProperties = { color: "#aaa", fontSize: "12px" };
const accountValueStyle: CSSProperties = { color: "#fff", fontSize: "14px", fontWeight: 700 };
const heroStatsRow: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginTop: "20px" };
const heroStatBox: CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "14px 12px", display: "flex", flexDirection: "column" };
const heroStatLabel: CSSProperties = { color: "#aaaaaa", fontSize: "12px", marginBottom: "6px" };
const heroStatValue: CSSProperties = { color: "#ffffff", fontSize: "18px", fontWeight: 800 };
const cardStyle: CSSProperties = { background: "#121212", border: "1px solid #222", borderRadius: "22px", padding: "20px", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", marginBottom: "16px" };
const exerciseCardOuterStyle: CSSProperties = { ...cardStyle };
const cardioCardStyle: CSSProperties = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "14px", display: "grid", gap: "14px" };
const versaCardStyle: CSSProperties = { background: "rgba(124,92,255,0.07)", border: "1px solid rgba(124,92,255,0.28)", borderRadius: "16px", padding: "14px", display: "grid", gap: "14px" };
const cardioHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "2px" };
const cardioTitleStyle: CSSProperties = { color: "#fff", fontWeight: 800, fontSize: "15px" };
const versaCardTitleStyle: CSSProperties = { color: "#c4b5fd", fontWeight: 800, fontSize: "15px" };
const versaBodyPartTagStyle: CSSProperties = { color: "#a78bfa", fontSize: "11px", fontWeight: 700, marginTop: "3px" };
const cardioQuickSectionStyle: CSSProperties = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "14px", padding: "12px", display: "grid", gap: "10px" };
const cardioSectionTitleStyle: CSSProperties = { color: "#efefef", fontSize: "13px", fontWeight: 800 };
const cardioPillRowStyle: CSSProperties = { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" };
const cardioValuePillStyle: CSSProperties = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", color: "#fff", fontSize: "13px", fontWeight: 800, padding: "10px 14px", minWidth: "96px", textAlign: "center" };
const emptyStateCardStyle: CSSProperties = { background: "#121212", border: "1px dashed #333", borderRadius: "22px", padding: "28px 20px", textAlign: "center", marginBottom: "16px" };
const emptyStateTitleStyle: CSSProperties = { color: "#ffffff", fontSize: "22px", fontWeight: 800, margin: "0 0 8px" };
const emptyStateTextStyle: CSSProperties = { color: "#9d9d9d", fontSize: "15px", margin: 0 };
const sectionHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "12px" };
const sectionTitle: CSSProperties = { color: "#ff4d4d", margin: 0, fontSize: "18px", fontWeight: 800 };
const timerDisplayStyle: CSSProperties = { fontSize: "48px", fontWeight: 900, color: "#ffffff", marginTop: "8px", marginBottom: "8px", letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums" };
const timerRunningPillStyle: CSSProperties = { display: "inline-block", background: "rgba(40,199,111,0.15)", border: "1px solid rgba(40,199,111,0.35)", borderRadius: "999px", color: "#5AFFA0", fontSize: "12px", fontWeight: 800, padding: "5px 12px", marginBottom: "12px" };
const timerButtonDisabledStyle: CSSProperties = { backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a", padding: "10px 16px", borderRadius: "10px", color: "#555", fontWeight: 700, cursor: "not-allowed" };
const inputGridStyle: CSSProperties = { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" };
const addExercisePanelStyle: CSSProperties = { marginTop: "14px" };
const inputStyle: CSSProperties = { padding: "10px", borderRadius: "10px", border: "1px solid #2a2a2a", backgroundColor: "#1c1c1c", color: "white", minWidth: "140px" };
const smallInputStyle: CSSProperties = { padding: "10px", borderRadius: "10px", border: "1px solid #2a2a2a", backgroundColor: "#1c1c1c", color: "white", minWidth: "90px" };
const selectStyle: CSSProperties = { padding: "10px", borderRadius: "10px", border: "1px solid #2a2a2a", backgroundColor: "#1c1c1c", color: "white", minWidth: "180px" };
const weightModeSelectStyle: CSSProperties = { padding: "8px 10px", borderRadius: "8px", border: "1px solid #333", backgroundColor: "#1a1a1a", color: "#d0d0d0", fontSize: "12px", fontWeight: 700, cursor: "pointer", minWidth: "90px" };
const weightInputGroupStyle: CSSProperties = { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" };
const perSideHintStyle: CSSProperties = { color: "#a78bfa", fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" };
const buttonRowStyle: CSSProperties = { display: "flex", gap: "8px", flexWrap: "wrap" };
const modeButtonRowTwoStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" };
const primaryButtonStyle: CSSProperties = { backgroundColor: "#ff1a1a", border: "none", padding: "10px 16px", borderRadius: "10px", color: "white", fontWeight: 700, cursor: "pointer" };
const versaButtonStyle: CSSProperties = { backgroundColor: "rgba(124,92,255,0.18)", border: "1px solid rgba(124,92,255,0.45)", padding: "10px 16px", borderRadius: "10px", color: "#c4b5fd", fontWeight: 800, cursor: "pointer" };
const secondaryButtonStyle: CSSProperties = { backgroundColor: "#2a2a2a", border: "1px solid #3a3a3a", padding: "10px 16px", borderRadius: "10px", color: "white", fontWeight: 700, cursor: "pointer" };
const dangerButtonStyle: CSSProperties = { backgroundColor: "#661111", border: "1px solid #772222", padding: "10px 16px", borderRadius: "10px", color: "white", fontWeight: 700, cursor: "pointer" };
const modeButtonStyle: CSSProperties = { backgroundColor: "#1b1b1b", border: "1px solid #2c2c2c", padding: "12px 14px", borderRadius: "12px", color: "#efefef", fontWeight: 800, cursor: "pointer" };
const modeButtonActiveStyle: CSSProperties = { backgroundColor: "rgba(255,26,26,0.16)", border: "1px solid rgba(255,77,77,0.45)", padding: "12px 14px", borderRadius: "12px", color: "#ffffff", fontWeight: 800, cursor: "pointer" };
const completeButtonStyle: CSSProperties = { backgroundColor: "#1f3b2d", border: "1px solid #2f5a43", padding: "10px 16px", borderRadius: "10px", color: "white", fontWeight: 700, cursor: "pointer" };
const completeButtonActiveStyle: CSSProperties = { backgroundColor: "#28a745", border: "1px solid #34c759", padding: "10px 16px", borderRadius: "10px", color: "white", fontWeight: 800, cursor: "pointer" };
const completeExerciseButtonStyle: CSSProperties = { backgroundColor: "#1f3b2d", border: "1px solid #2f5a43", padding: "10px 16px", borderRadius: "10px", color: "white", fontWeight: 800, cursor: "pointer" };
const exerciseTopRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" };
const exerciseTitleStyle: CSSProperties = { color: "#ff4d4d", margin: "0 0 4px", fontSize: "22px", fontWeight: 800 };
const exerciseBodyPartStyle: CSSProperties = { color: "#999", margin: 0 };
const restTagStyle: CSSProperties = { display: "inline-flex", marginTop: "12px", padding: "7px 10px", borderRadius: "999px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#d8d8d8", fontSize: "12px", fontWeight: 700 };
const exerciseInfoCardStyle: CSSProperties = { marginTop: "12px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "14px", padding: "12px", display: "grid", gap: "6px" };
const exerciseInfoLineStyle: CSSProperties = { color: "#ededed", fontSize: "13px" };
const exerciseMutedLineStyle: CSSProperties = { color: "#a7a7a7", fontSize: "12px" };
const exerciseSpecialLineStyle: CSSProperties = { color: "#ffb0b0", fontSize: "12px", fontWeight: 700 };
const setsHeaderStyle: CSSProperties = { marginBottom: "10px", color: "#ffffff" };
const setBlockStyle: CSSProperties = { borderBottom: "1px solid #222", padding: "10px 0 14px" };
const editableSetRowStyle: CSSProperties = { color: "#ddd", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" };
const setNumberStyle: CSSProperties = { minWidth: "60px", color: "#efefef", fontWeight: 700 };
const chipWrapStyle: CSSProperties = { display: "flex", gap: "8px", flexWrap: "wrap" };
const chipButtonStyle: CSSProperties = { backgroundColor: "#1d1d1d", border: "1px solid #333", color: "#efefef", padding: "8px 12px", borderRadius: "999px", cursor: "pointer" };
const subtleLabelStyle: CSSProperties = { color: "#a8a8a8", fontSize: "13px", marginBottom: "8px" };
const mutedStyle: CSSProperties = { color: "#999" };
const statusStyle: CSSProperties = { color: "#cccccc", marginBottom: "16px" };
const helperTextStyle: CSSProperties = { color: "#8f8f8f", fontSize: "13px", marginTop: "12px", marginBottom: 0 };
const finishButtonStyle: CSSProperties = { width: "100%", backgroundColor: "#ff1a1a", border: "none", padding: "16px 18px", borderRadius: "12px", color: "white", fontWeight: 800, fontSize: "16px", cursor: "pointer" };
const listStyle: CSSProperties = { display: "grid", gap: "10px" };
const listItemStyle: CSSProperties = { display: "flex", alignItems: "center", gap: "12px", color: "#efefef" };
const listLineStyle: CSSProperties = { width: "10px", height: "2px", background: "#ff4d4d", borderRadius: "999px", flexShrink: 0 };
const aiHintCardStyle: CSSProperties = { marginTop: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "4px" };
const aiHintTitleStyle: CSSProperties = { color: "#ffffff", fontSize: "13px", fontWeight: 700 };
const aiHintTextStyle: CSSProperties = { color: "#9e9e9e", fontSize: "12px", lineHeight: 1.4 };
const confirmOverlayStyle: CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 1000 };
const confirmCardStyle: CSSProperties = { width: "100%", maxWidth: "420px", background: "#121212", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "20px", boxShadow: "0 20px 50px rgba(0,0,0,0.45)" };
const confirmTitleStyle: CSSProperties = { margin: "0 0 10px", color: "#fff", fontSize: "20px", fontWeight: 800 };
const confirmMessageStyle: CSSProperties = { margin: "0 0 18px", color: "#bdbdbd", fontSize: "14px", lineHeight: 1.5 };
const queueSummaryStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "14px" };
const queueSummaryPillStyle: CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "999px", padding: "8px 12px", color: "#ffffff", fontSize: "12px", fontWeight: 800 };
const queueSummaryActiveStyle: CSSProperties = { color: "#bdbdbd", fontSize: "13px", fontWeight: 700 };
const queueListStyle: CSSProperties = { display: "grid", gap: "10px" };
const queueItemStyle: CSSProperties = { width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", textAlign: "left", cursor: "pointer", color: "#ffffff" };
const queueItemActiveStyle: CSSProperties = { ...queueItemStyle, background: "rgba(255,26,26,0.10)", border: "1px solid rgba(255,77,77,0.35)" };
const queueItemLeftStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 };
const queueItemTitleStyle: CSSProperties = { color: "#ffffff", fontSize: "15px", fontWeight: 800 };
const queueItemSubStyle: CSSProperties = { color: "#a9a9a9", fontSize: "12px", lineHeight: 1.4 };
const queueItemRightStyle: CSSProperties = { flexShrink: 0 };
const queueStatusStyle: CSSProperties = { color: "#ffb8b8", fontSize: "12px", fontWeight: 800 };
const exerciseNavRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginTop: "16px", padding: "12px 0 4px" };
const exerciseNavMetaStyle: CSSProperties = { color: "#bdbdbd", fontSize: "13px", fontWeight: 700 };