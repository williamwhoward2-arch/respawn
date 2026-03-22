"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = {
  id?: number;
  user_id?: string | null;
  name: string | null;
  age?: number | null;
  sex?: string | null;
  height?: string | null;
  bodyweight?: string | null;
  waist?: string | null;
  goal?: string | null;
  focus?: string | null;
  experience_level?: string | null;
  equipment_access?: string | null;
};

type Workout = {
  id: number;
  user_id?: string | null;
  workout_name: string | null;
  created_at: string;
  duration_seconds?: number | null;
  day_type?: string | null;
  notes?: string | null;
};

type WorkoutSet = {
  id: number;
  user_id?: string | null;
  workout_id: number;
  exercise_name: string | null;
  set_number: number | null;
  weight: string | null;
  reps: string | null;
  body_part?: string | null;
  completed?: boolean | null;
  created_at: string;
};

type WorkoutCardio = {
  id: number;
  workout_id: number;
  user_id?: string | null;
  entry_number?: number | null;
  method: string;
  miles: string | number | null;   // VersaClimber stores feet here
  duration_seconds: number | null;
  notes?: string | null;
  created_at?: string | null;
};

type CoachFeedItem = {
  title: string;
  detail: string;
  tone: "good" | "warn" | "neutral";
};

type BodyPartSummaryItem = {
  bodyPart: string;
  sets: number;
  volume: number;
};

type Recommendation = {
  title: string;
  detail: string;
  cta: string;
  mode: "train" | "rest" | "light";
  suggestedBodyPart?: string | null;
  readinessLabel: string;
};

type PerformanceHighlight = {
  title: "Performance";
  detail: string;
};

type Candidate = { score: number; detail: string };

// Day summary shown when a chart bar is tapped
type DaySummary = {
  dateLabel: string;
  workoutNames: string[];
  totalSets: number;
  totalVolume: number;
  cardioMinutes: number;
  versaFeet: number;
  versaMinutes: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNumber(value: string | number | null | undefined) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function startOfDay(dateInput: string | Date) {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMonday(d: Date) {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${Math.round(value)}`;
}

function formatMinutes(seconds: number | null | undefined) {
  if (!seconds) return "--";
  return `${Math.round(seconds / 60)} min`;
}

function estimate1RM(weight: number, reps: number) {
  if (!weight || !reps) return 0;
  return weight * (1 + reps / 30);
}

function hashStringToInt(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getStrengthLabel(e1rm: number, bodyweight: number): string {
  if (!e1rm || !bodyweight) return "Building";
  const r = e1rm / bodyweight;
  if (r >= 2.0) return "Elite";
  if (r >= 1.5) return "Advanced";
  if (r >= 1.15) return "Intermediate";
  if (r >= 0.8) return "Novice";
  return "Building";
}

function getStrengthLabelColor(label: string): string {
  switch (label) {
    case "Elite": return "#FFD700";
    case "Advanced": return "#a78bfa";
    case "Intermediate": return "#5AFFA0";
    case "Novice": return "#60a5fa";
    default: return "#888";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [cardioRows, setCardioRows] = useState<WorkoutCardio[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  // Which day bar is selected (ISO date string or null)
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  useEffect(() => { void loadDashboard(); }, []);

  async function loadDashboard() {
    setLoading(true);
    setStatus("Loading your dashboard...");

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error("Get user error:", userError);
      setStatus(`Error: ${userError.message}`);
      setLoading(false);
      return;
    }
    if (!user) { router.replace("/login"); return; }

    const [
      { data: profileData, error: profileError },
      { data: workoutsData, error: workoutsError },
      { data: setsData, error: setsError },
    ] = await Promise.all([
      supabase.from("profiles").select("id, user_id, name, age, sex, height, bodyweight, waist, goal, focus, experience_level, equipment_access").eq("user_id", user.id).maybeSingle(),
      supabase.from("workouts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("workout_sets").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    if (profileError) console.error("Profile load error:", profileError);
    if (workoutsError) console.error("Workouts load error:", workoutsError);
    if (setsError) console.error("Sets load error:", setsError);

    const safeWorkouts = (workoutsData as Workout[]) ?? [];
    const workoutIds = safeWorkouts.map((w) => w.id);

    // Load cardio + versaclimber rows directly by user_id — avoids broken .order() on tables
    // without created_at, and works even if workout list is large.
    let safeCardio: WorkoutCardio[] = [];
    if (workoutIds.length > 0) {
      const { data: cardioData, error: cardioError } = await supabase
        .from("workout_cardio")
        .select("id, workout_id, user_id, entry_number, method, miles, duration_seconds, notes")
        .eq("user_id", user.id);
      if (cardioError) console.error("Cardio load error:", cardioError);
      safeCardio = (cardioData as WorkoutCardio[]) ?? [];
    }

    setProfile((profileData as Profile) ?? null);
    setWorkouts(safeWorkouts);
    setSets((setsData as WorkoutSet[]) ?? []);
    setCardioRows(safeCardio);
    setStatus("");
    setLoading(false);
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) { setStatus(`Error signing out: ${error.message}`); return; }
    router.replace("/login");
  }

  // ─── Derived data ──────────────────────────────────────────────────────────

  const today = useMemo(() => startOfDay(new Date()), []);
  const weekStart = useMemo(() => startOfWeekMonday(today), [today]);
  const weekEndExclusive = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekStart]);

  const workoutsById = useMemo(() => {
    const map = new Map<number, Workout>();
    for (const w of workouts) map.set(w.id, w);
    return map;
  }, [workouts]);

  const trainingWorkouts = useMemo(() =>
    workouts.filter((w) => (w.day_type ?? "workout") !== "rest"),
  [workouts]);

  const trainingWorkoutIds = useMemo(() =>
    new Set(trainingWorkouts.map((w) => w.id)),
  [trainingWorkouts]);

  const completedSets = useMemo(() =>
    sets.filter((s) => trainingWorkoutIds.has(s.workout_id) && toNumber(s.weight) > 0 && toNumber(s.reps) > 0),
  [sets, trainingWorkoutIds]);

  // Separate regular cardio from versaclimber
  const regularCardio = useMemo(() =>
    cardioRows.filter((c) => c.method !== "versaclimber"),
  [cardioRows]);

  const versaRows = useMemo(() =>
    cardioRows.filter((c) => c.method === "versaclimber"),
  [cardioRows]);

  // ─── Per-day workout data (for chart + click summary) ──────────────────────

  const workoutDays = useMemo(() => {
    const map = new Map<string, {
      count: number;
      volume: number;
      cardioSeconds: number;
      versaFeet: number;
      versaSeconds: number;
      workoutIds: Set<number>;
    }>();

    for (const w of trainingWorkouts) {
      const key = startOfDay(w.created_at).toISOString();
      if (!map.has(key)) map.set(key, { count: 0, volume: 0, cardioSeconds: 0, versaFeet: 0, versaSeconds: 0, workoutIds: new Set() });
      const entry = map.get(key)!;
      entry.count += 1;
      entry.workoutIds.add(w.id);
    }

    for (const s of completedSets) {
      const w = workoutsById.get(s.workout_id);
      if (!w) continue;
      const key = startOfDay(w.created_at).toISOString();
      if (!map.has(key)) map.set(key, { count: 0, volume: 0, cardioSeconds: 0, versaFeet: 0, versaSeconds: 0, workoutIds: new Set() });
      map.get(key)!.volume += toNumber(s.weight) * toNumber(s.reps);
    }

    for (const c of regularCardio) {
      const w = workoutsById.get(c.workout_id);
      if (!w) continue;
      const key = startOfDay(w.created_at).toISOString();
      if (!map.has(key)) map.set(key, { count: 0, volume: 0, cardioSeconds: 0, versaFeet: 0, versaSeconds: 0, workoutIds: new Set() });
      map.get(key)!.cardioSeconds += toNumber(c.duration_seconds);
    }

    for (const v of versaRows) {
      const w = workoutsById.get(v.workout_id);
      if (!w) continue;
      const key = startOfDay(w.created_at).toISOString();
      if (!map.has(key)) map.set(key, { count: 0, volume: 0, cardioSeconds: 0, versaFeet: 0, versaSeconds: 0, workoutIds: new Set() });
      map.get(key)!.versaFeet += toNumber(v.miles); // feet stored in miles column
      map.get(key)!.versaSeconds += toNumber(v.duration_seconds);
    }

    return map;
  }, [trainingWorkouts, completedSets, regularCardio, versaRows, workoutsById]);

  // ─── Week stats ────────────────────────────────────────────────────────────

  const last30Start = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() - 29);
    return d;
  }, [today]);

  const workoutsThisWeek = useMemo(() =>
    trainingWorkouts.filter((w) => { const d = startOfDay(w.created_at); return d >= weekStart && d < weekEndExclusive; }).length,
  [trainingWorkouts, weekStart, weekEndExclusive]);

  const workoutsLast30 = useMemo(() =>
    trainingWorkouts.filter((w) => startOfDay(w.created_at) >= last30Start).length,
  [trainingWorkouts, last30Start]);

  const avgWorkoutDuration = useMemo(() => {
    const durations = trainingWorkouts.map((w) => toNumber(w.duration_seconds)).filter((x) => x > 0);
    if (!durations.length) return 0;
    return Math.round(durations.reduce((s, v) => s + v, 0) / durations.length / 60);
  }, [trainingWorkouts]);

  const currentStreak = useMemo(() => {
    if (!workoutDays.size) return 0;
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);
      if (workoutDays.has(d.toISOString())) { streak++; }
      else { if (i === 0) continue; break; }
    }
    return streak;
  }, [today, workoutDays]);

  const bestStreak = useMemo(() => {
    if (!workoutDays.size) return 0;
    const days = Array.from(workoutDays.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    let best = 1, current = 1;
    for (let i = 1; i < days.length; i++) {
      const diff = (startOfDay(days[i]).getTime() - startOfDay(days[i-1]).getTime()) / 86400000;
      if (diff === 1) { current++; best = Math.max(best, current); } else { current = 1; }
    }
    return best;
  }, [workoutDays]);

  const lastWorkout = useMemo(() =>
    [...trainingWorkouts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null,
  [trainingWorkouts]);

  const daysSinceLastWorkout = useMemo(() => {
    if (!lastWorkout) return null;
    return Math.floor((today.getTime() - startOfDay(lastWorkout.created_at).getTime()) / 86400000);
  }, [today, lastWorkout]);

  const totalVolumeThisWeek = useMemo(() => {
    const weekIds = new Set(trainingWorkouts.filter((w) => { const d = startOfDay(w.created_at); return d >= weekStart && d < weekEndExclusive; }).map((w) => w.id));
    return completedSets.filter((s) => weekIds.has(s.workout_id)).reduce((sum, s) => sum + toNumber(s.weight) * toNumber(s.reps), 0);
  }, [trainingWorkouts, completedSets, weekStart, weekEndExclusive]);

  const totalSetsThisWeek = useMemo(() => {
    const weekIds = new Set(trainingWorkouts.filter((w) => { const d = startOfDay(w.created_at); return d >= weekStart && d < weekEndExclusive; }).map((w) => w.id));
    return completedSets.filter((s) => weekIds.has(s.workout_id)).length;
  }, [trainingWorkouts, completedSets, weekStart, weekEndExclusive]);

  const lifetimeVolume = useMemo(() =>
    completedSets.reduce((sum, s) => sum + toNumber(s.weight) * toNumber(s.reps), 0),
  [completedSets]);

  const uniqueExercises = useMemo(() => {
    const u = new Set(completedSets.map((s) => (s.exercise_name ?? "").trim().toLowerCase()).filter(Boolean));
    return u.size;
  }, [completedSets]);

  // ─── VersaClimber stats ────────────────────────────────────────────────────

  const versaStats = useMemo(() => {
    const totalSessions = versaRows.length;
    const totalFeet = versaRows.reduce((s, v) => s + toNumber(v.miles), 0);
    const totalSeconds = versaRows.reduce((s, v) => s + toNumber(v.duration_seconds), 0);
    const bestSession = versaRows.reduce((best, v) => {
      const ft = toNumber(v.miles);
      return ft > best ? ft : best;
    }, 0);
    return { totalSessions, totalFeet, totalSeconds, bestSession };
  }, [versaRows]);

  // ─── Body part data ────────────────────────────────────────────────────────

  const bodyPartSummary = useMemo<BodyPartSummaryItem[]>(() => {
    const map = new Map<string, { sets: number; volume: number }>();
    for (const s of completedSets) {
      const bp = s.body_part ? titleCase(s.body_part) : "Other";
      const cur = map.get(bp) ?? { sets: 0, volume: 0 };
      cur.sets++; cur.volume += toNumber(s.weight) * toNumber(s.reps);
      map.set(bp, cur);
    }
    return Array.from(map.entries()).map(([bodyPart, v]) => ({ bodyPart, sets: v.sets, volume: v.volume })).sort((a, b) => b.sets - a.sets);
  }, [completedSets]);

  const weekBodyPartSummary = useMemo<BodyPartSummaryItem[]>(() => {
    const map = new Map<string, { sets: number; volume: number }>();
    for (const s of completedSets) {
      const w = workoutsById.get(s.workout_id);
      if (!w) continue;
      const d = startOfDay(w.created_at);
      if (d < weekStart || d >= weekEndExclusive) continue;
      const bp = s.body_part ? titleCase(s.body_part) : "Other";
      const cur = map.get(bp) ?? { sets: 0, volume: 0 };
      cur.sets++; cur.volume += toNumber(s.weight) * toNumber(s.reps);
      map.set(bp, cur);
    }
    return Array.from(map.entries()).map(([bodyPart, v]) => ({ bodyPart, sets: v.sets, volume: v.volume })).sort((a, b) => a.sets - b.sets);
  }, [completedSets, workoutsById, weekStart, weekEndExclusive]);

  const bodyPartLastTrained = useMemo(() => {
    const map = new Map<string, Date>();
    for (const s of completedSets) {
      const w = workoutsById.get(s.workout_id);
      if (!w) continue;
      const bp = s.body_part ? titleCase(s.body_part) : "Other";
      const d = startOfDay(w.created_at);
      if (!map.has(bp) || d > map.get(bp)!) map.set(bp, d);
    }
    return map;
  }, [completedSets, workoutsById]);

  function getDaysSinceBodyPart(bp: string) {
    const last = bodyPartLastTrained.get(bp);
    if (!last) return 999;
    return Math.floor((today.getTime() - last.getTime()) / 86400000);
  }

  // ─── Readiness + recommendation ───────────────────────────────────────────

  const readiness = useMemo(() => {
    if (!completedSets.length) return { label: "New Signal", tone: "neutral" as const };
    if (currentStreak >= 4) return { label: "Needs Recovery", tone: "warn" as const };
    if (currentStreak >= 3) return { label: "Moderate Fatigue", tone: "neutral" as const };
    if (daysSinceLastWorkout !== null && daysSinceLastWorkout >= 3) return { label: "Fresh", tone: "good" as const };
    return { label: "Train Ready", tone: "good" as const };
  }, [completedSets.length, currentStreak, daysSinceLastWorkout]);

  const rankedBodyParts = useMemo(() => {
    const candidates = ["Chest", "Back", "Legs", "Shoulders", "Arms"];
    const weekMap = new Map(weekBodyPartSummary.map((i) => [i.bodyPart, i]));
    return candidates.map((bp) => {
      const daysSince = getDaysSinceBodyPart(bp);
      const weekSets = weekMap.get(bp)?.sets ?? 0;
      let score = Math.min(daysSince, 7) * 2 - weekSets * 1.6;
      if (daysSince <= 1) score -= 12;
      else if (daysSince <= 2) score -= 8;
      if (currentStreak >= 3) score -= 3;
      return { bodyPart: bp, score };
    }).sort((a, b) => b.score - a.score);
  }, [weekBodyPartSummary, currentStreak]);

  const suggestionBodyPart = useMemo(() => rankedBodyParts[0]?.bodyPart ?? null, [rankedBodyParts]);

  const recommendation = useMemo<Recommendation>(() => {
    if (!completedSets.length) return { title: "Start your first session", detail: "Log a few workouts and ReSpawn will start giving smarter next-session suggestions automatically.", cta: "Go To Today", mode: "train", suggestedBodyPart: null, readinessLabel: readiness.label };
    if (currentStreak >= 4) return { title: "Light or Rest Day", detail: "You've been consistent. A lighter session or full rest helps you keep momentum without piling fatigue.", cta: suggestionBodyPart ? `Build ${suggestionBodyPart} Workout` : "Start Workout", mode: "rest", suggestedBodyPart: null, readinessLabel: "Needs Recovery" };
    if (currentStreak >= 3) return { title: "Keep it lighter", detail: suggestionBodyPart ? `${suggestionBodyPart} is a solid next session based on this week's balance.` : "Keep your next session clean and lighter than usual.", cta: suggestionBodyPart ? `Build ${suggestionBodyPart} Workout` : "Start Workout", mode: "light", suggestedBodyPart: suggestionBodyPart, readinessLabel: readiness.label };
    if (daysSinceLastWorkout !== null && daysSinceLastWorkout >= 3) return { title: "Next session", detail: suggestionBodyPart ? `${suggestionBodyPart} is a good next session based on this week's balance.` : "Good day to train — keep it clean and build momentum.", cta: suggestionBodyPart ? `Build ${suggestionBodyPart} Workout` : "Start Workout", mode: "train", suggestedBodyPart: suggestionBodyPart, readinessLabel: "Fresh" };
    return { title: "Next session", detail: suggestionBodyPart ? `${suggestionBodyPart} is a good next session based on this week's balance.` : "Pick a clean session and keep the week moving.", cta: suggestionBodyPart ? `Build ${suggestionBodyPart} Workout` : "Generate Next Session", mode: "train", suggestedBodyPart: suggestionBodyPart, readinessLabel: readiness.label };
  }, [completedSets.length, currentStreak, daysSinceLastWorkout, suggestionBodyPart, readiness.label]);

  const aiHeadline = useMemo(() => {
    if (!completedSets.length) return "Start building your training signal";
    if (recommendation.mode === "rest") return "Recovery keeps progress moving";
    if (recommendation.mode === "light") return "Momentum is building";
    return "Next workout suggestion";
  }, [completedSets.length, recommendation.mode]);

  // ─── Performance highlight ─────────────────────────────────────────────────

  const performanceHighlight = useMemo((): PerformanceHighlight | null => {
    if (!completedSets.length) return null;
    const candidates: Candidate[] = [];

    // Best set this week
    let bestWeek: { name: string; weight: number; reps: number; e1rm: number } | null = null;
    for (const s of completedSets) {
      const w = workoutsById.get(s.workout_id);
      if (!w) continue;
      const d = startOfDay(w.created_at);
      if (d < weekStart || d >= weekEndExclusive) continue;
      const e1rm = estimate1RM(toNumber(s.weight), toNumber(s.reps));
      if (!bestWeek || e1rm > bestWeek.e1rm) bestWeek = { name: s.exercise_name ?? "Exercise", weight: toNumber(s.weight), reps: toNumber(s.reps), e1rm };
    }
    if (bestWeek) candidates.push({ score: 160 + Math.min(80, Math.round(bestWeek.e1rm / 2)), detail: `Best set this week: ${bestWeek.weight} × ${bestWeek.reps} on ${bestWeek.name}.` });

    // Improvement trend
    const byExercise = new Map<string, WorkoutSet[]>();
    for (const s of completedSets) {
      const k = (s.exercise_name ?? "").trim().toLowerCase();
      if (!k) continue;
      if (!byExercise.has(k)) byExercise.set(k, []);
      byExercise.get(k)!.push(s);
    }
    let bestImp: { name: string; deltaPct: number } | null = null;
    for (const [, arr] of byExercise) {
      if (arr.length < 4) continue;
      const sorted = [...arr].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const last = sorted[sorted.length - 1], prev = sorted[sorted.length - 2];
      const lastE = estimate1RM(toNumber(last.weight), toNumber(last.reps));
      const prevE = estimate1RM(toNumber(prev.weight), toNumber(prev.reps));
      if (prevE <= 0 || lastE <= 0) continue;
      const delta = ((lastE - prevE) / prevE) * 100;
      if (delta >= 4 && (!bestImp || delta > bestImp.deltaPct)) bestImp = { name: arr[0].exercise_name ?? "", deltaPct: delta };
    }
    if (bestImp) candidates.push({ score: 190 + Math.min(60, Math.round(bestImp.deltaPct * 4)), detail: `Improved: ${bestImp.name} up ${Math.round(bestImp.deltaPct)}% recently.` });

    if (workoutsThisWeek >= 4) candidates.push({ score: 140 + workoutsThisWeek * 4, detail: `Strong week: ${workoutsThisWeek} workouts logged so far.` });
    if (totalVolumeThisWeek >= 25000) candidates.push({ score: 135, detail: `Output: ${Math.round(totalVolumeThisWeek).toLocaleString()} total lbs moved this week.` });

    if (!candidates.length) return null;
    const sortedC = [...candidates].sort((a, b) => b.score - a.score);
    const topScore = sortedC[0].score;
    const pool = sortedC.filter((c) => c.score >= topScore - 10).slice(0, 4);
    const dayKey = today.toISOString().slice(0, 10);
    const chosen = pool[pool.length > 1 ? hashStringToInt(dayKey) % pool.length : 0] ?? sortedC[0];
    return { title: "Performance", detail: chosen.detail };
  }, [completedSets, workoutsById, weekStart, weekEndExclusive, workoutsThisWeek, totalVolumeThisWeek, today]);

  // ─── Coach feed ────────────────────────────────────────────────────────────

  const coachFeed = useMemo<CoachFeedItem[]>(() => {
    const items: CoachFeedItem[] = [];
    if (!completedSets.length) {
      items.push({ title: "Consistency", detail: "Log a few workouts to unlock smarter insights.", tone: "neutral" });
    } else if (currentStreak >= 3) {
      items.push({ title: "Consistency", detail: `${currentStreak}-day training streak. Momentum is building.`, tone: "good" });
    } else if (workoutsThisWeek > 0) {
      items.push({ title: "Consistency", detail: `${workoutsThisWeek} workout${workoutsThisWeek === 1 ? "" : "s"} logged this week.`, tone: workoutsThisWeek >= 3 ? "good" : "neutral" });
    } else {
      items.push({ title: "Consistency", detail: "Your next session is the one that restarts momentum.", tone: "neutral" });
    }
    items.push({ title: "Performance", detail: performanceHighlight ? performanceHighlight.detail : "Repeat a few key lifts and ReSpawn will start calling out improvements.", tone: "neutral" });
    items.push({ title: "Momentum", detail: "Every logged set sharpens your training signal. Keep stacking sessions.", tone: "good" });
    return items.slice(0, 3);
  }, [completedSets.length, currentStreak, workoutsThisWeek, performanceHighlight]);

  // ─── Weekly chart ──────────────────────────────────────────────────────────

  const weeklyChartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      day.setHours(0, 0, 0, 0);
      const key = day.toISOString();
      const info = workoutDays.get(key);
      return {
        key,
        label: day.toLocaleDateString(undefined, { weekday: "short" }),
        fullLabel: day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
        volume: info?.volume ?? 0,
        active: Boolean(info),
        cardioSeconds: info?.cardioSeconds ?? 0,
        versaFeet: info?.versaFeet ?? 0,
        workoutIds: info?.workoutIds ?? new Set<number>(),
      };
    });
  }, [weekStart, workoutDays]);

  const maxWeeklyVolume = useMemo(() => Math.max(1, ...weeklyChartData.map((d) => d.volume)), [weeklyChartData]);

  // Build click-summary for selected day
  const selectedDaySummary = useMemo((): DaySummary | null => {
    if (!selectedDayKey) return null;
    const dayData = weeklyChartData.find((d) => d.key === selectedDayKey);
    if (!dayData || !dayData.active) return null;

    const workoutNames = Array.from(dayData.workoutIds)
      .map((id) => workoutsById.get(id)?.workout_name ?? "Workout")
      .filter(Boolean);

    const totalSets = completedSets.filter((s) => dayData.workoutIds.has(s.workout_id)).length;

    const cardioSeconds = regularCardio
      .filter((c) => dayData.workoutIds.has(c.workout_id))
      .reduce((s, c) => s + toNumber(c.duration_seconds), 0);

    const versaFeet = versaRows
      .filter((v) => dayData.workoutIds.has(v.workout_id))
      .reduce((s, v) => s + toNumber(v.miles), 0);

    const versaSeconds = versaRows
      .filter((v) => dayData.workoutIds.has(v.workout_id))
      .reduce((s, v) => s + toNumber(v.duration_seconds), 0);

    return {
      dateLabel: dayData.fullLabel,
      workoutNames,
      totalSets,
      totalVolume: dayData.volume,
      cardioMinutes: Math.round(cardioSeconds / 60),
      versaFeet: Math.round(versaFeet),
      versaMinutes: Math.round(versaSeconds / 60),
    };
  }, [selectedDayKey, weeklyChartData, completedSets, regularCardio, versaRows, workoutsById]);

  // ─── Top-3 lift leaderboard ────────────────────────────────────────────────

  const topLifts = useMemo(() => {
    const bw = toNumber(profile?.bodyweight) || 185;
    const bestMap = new Map<string, { e1rm: number; weight: number; reps: number; bodyPart: string }>();

    for (const s of completedSets) {
      const name = (s.exercise_name ?? "").trim();
      if (!name) continue;
      const e1rm = estimate1RM(toNumber(s.weight), toNumber(s.reps));
      const cur = bestMap.get(name);
      if (!cur || e1rm > cur.e1rm) {
        bestMap.set(name, { e1rm, weight: toNumber(s.weight), reps: toNumber(s.reps), bodyPart: s.body_part ? titleCase(s.body_part) : "Other" });
      }
    }

    return Array.from(bestMap.entries())
      .map(([name, v]) => ({
        name,
        e1rm: Math.round(v.e1rm),
        weight: v.weight,
        reps: v.reps,
        bodyPart: v.bodyPart,
        strengthLabel: getStrengthLabel(v.e1rm, bw),
      }))
      .sort((a, b) => b.e1rm - a.e1rm)
      .slice(0, 3);
  }, [completedSets, profile]);

  // ─── Body balance donut ────────────────────────────────────────────────────

  const bodyBalanceSegments = useMemo(() => {
    const items = bodyPartSummary.slice(0, 5);
    const total = items.reduce((s, i) => s + i.sets, 0) || 1;
    const colors = ["#ff4d4d", "#ff8b8b", "#ffa94d", "#7c5cff", "#29cc7a"];
    let currentAngle = 0;
    const segments = items.map((item, idx) => {
      const pct = item.sets / total;
      const start = currentAngle;
      const end = currentAngle + pct * 360;
      currentAngle = end;
      return { ...item, color: colors[idx % colors.length], start, end, pct: Math.round(pct * 100) };
    });
    const gradient = segments.map((s) => `${s.color} ${s.start}deg ${s.end}deg`).join(", ");
    return { segments, gradient: gradient || "#252525 0deg 360deg" };
  }, [bodyPartSummary]);

  const displayName = profile?.name?.trim() || "Your";

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <p style={eyebrowStyle}>RESPAWN DASHBOARD</p>
          <h1 style={heroTitleStyle}>Loading...</h1>
          <p style={heroSubStyle}>Pulling your training history and highlights.</p>
        </section>
      </main>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main style={pageStyle}>

      {/* ── Hero ── */}
      <section style={heroCardStyle}>
        <div style={heroTopRowStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={eyebrowStyle}>RESPAWN DASHBOARD</p>
            <h1 style={heroTitleStyle}>{displayName}&apos;s AI Coach</h1>
            <p style={heroSubStyle}>A clean read on your consistency, performance highlights, and one next-session suggestion.</p>

            {/* Coach feed */}
            <div style={heroCoachFeedWrapStyle}>
              <div style={heroCoachFeedLabelStyle}>Coach Feed</div>
              {coachFeed.length > 0 ? (
                <div style={heroCoachFeedListStyle}>
                  {coachFeed.map((item, idx) => (
                    <div key={`${item.title}-${idx}`} style={{ ...heroCoachFeedCardStyle, border: item.tone === "good" ? "1px solid rgba(40,199,111,0.22)" : item.tone === "warn" ? "1px solid rgba(255,184,0,0.22)" : "1px solid rgba(255,255,255,0.07)" }}>
                      <div style={heroCoachFeedTitleStyle}>{item.title}</div>
                      <div style={heroCoachFeedTextStyle}>{item.detail}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={heroCoachFeedEmptyStyle}>Keep logging workouts and your coach feed will start filling in here.</div>
              )}
            </div>
          </div>

          <button onClick={handleSignOut} style={ghostButtonStyle}>Sign Out</button>
        </div>

        {/* Today's coach call */}
        <div style={heroInsightCardStyle}>
          <div style={heroInsightLabelStyle}>Today&apos;s Coach Call</div>
          <div style={heroInsightTitleStyle}>{aiHeadline}</div>
          <div style={heroInsightTextStyle}>{recommendation.detail}</div>

          <div style={recommendationMetaRowStyle}>
            <div style={{
              ...readinessPillStyle,
              borderColor: readiness.tone === "good" ? "rgba(40,199,111,0.24)" : readiness.tone === "warn" ? "rgba(255,184,0,0.24)" : "rgba(255,255,255,0.10)",
              color: readiness.tone === "good" ? "#7CFFB2" : readiness.tone === "warn" ? "#FFD66B" : "#d7d7d7",
            }}>
              Readiness: {recommendation.readinessLabel}
            </div>
            <div style={metaHintStyle}>
              Streak: <span style={metaHintStrongStyle}>{currentStreak}d</span>
              {daysSinceLastWorkout !== null && <> • Last workout: <span style={metaHintStrongStyle}>{daysSinceLastWorkout === 0 ? "Today" : `${daysSinceLastWorkout}d ago`}</span></>}
            </div>
          </div>

          <div style={heroActionRowStyle}>
            {/* Primary shortcut — straight to Today */}
            <button onClick={() => router.push("/Today")} style={startWorkoutButtonStyle}>
              🏋️ Start Today&apos;s Workout
            </button>
            <button onClick={() => router.push("/Today")} style={primaryButtonStyle}>
              {recommendation.cta}
            </button>
            <button onClick={() => router.push("/Progress")} style={secondaryButtonStyle}>
              View Workout Log
            </button>
          </div>
        </div>
      </section>

      <section style={dashboardGridStyle}>

        {/* ── Weekly chart ── */}
        <section style={{ ...cardStyle, ...spanTwoStyle }}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>This Week (Mon–Sun)</h2>
            <span style={sectionBadgeStyle}>Tap a bar for details</span>
          </div>

          <div style={weeklyChartStyle}>
            {weeklyChartData.map((day) => {
              const heightPct = Math.max(8, Math.round((day.volume / maxWeeklyVolume) * 100));
              const isSelected = day.key === selectedDayKey;
              return (
                <button
                  key={day.key}
                  onClick={() => setSelectedDayKey(isSelected ? null : day.key)}
                  style={weeklyBarButtonStyle}
                  title={day.fullLabel}
                >
                  <div style={{
                    ...weeklyBarTrackStyle,
                    borderColor: isSelected ? "rgba(255,77,77,0.5)" : "#252525",
                    boxShadow: isSelected ? "0 0 0 2px rgba(255,77,77,0.30)" : "none",
                  }}>
                    <div style={{
                      ...weeklyBarFillStyle,
                      height: `${day.active ? heightPct : 8}%`,
                      background: isSelected
                        ? "linear-gradient(180deg, #ff9b9b 0%, #ff4d4d 100%)"
                        : day.active
                        ? "linear-gradient(180deg, #ff7a7a 0%, #ff4d4d 100%)"
                        : "#202020",
                    }} />
                  </div>
                  <span style={{ ...weeklyBarLabelStyle, color: isSelected ? "#ff9b9b" : "#9f9f9f" }}>
                    {day.label.slice(0, 2)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Day summary panel */}
          {selectedDaySummary && (
            <div style={daySummaryCardStyle}>
              <div style={daySummaryHeaderStyle}>
                <div style={daySummaryDateStyle}>{selectedDaySummary.dateLabel}</div>
                <button onClick={() => setSelectedDayKey(null)} style={daySummaryCloseStyle}>✕</button>
              </div>
              <div style={daySummaryNamesStyle}>
                {selectedDaySummary.workoutNames.map((n, i) => <span key={i} style={daySummaryNamePillStyle}>{n}</span>)}
              </div>
              <div style={daySummaryStatsRowStyle}>
                <div style={daySummaryStatStyle}>
                  <div style={daySummaryStatLabelStyle}>Sets</div>
                  <div style={daySummaryStatValueStyle}>{selectedDaySummary.totalSets}</div>
                </div>
                <div style={daySummaryStatStyle}>
                  <div style={daySummaryStatLabelStyle}>Volume</div>
                  <div style={daySummaryStatValueStyle}>{formatCompact(selectedDaySummary.totalVolume)}</div>
                </div>
                {selectedDaySummary.cardioMinutes > 0 && (
                  <div style={daySummaryStatStyle}>
                    <div style={daySummaryStatLabelStyle}>Cardio</div>
                    <div style={daySummaryStatValueStyle}>{selectedDaySummary.cardioMinutes} min</div>
                  </div>
                )}
                {selectedDaySummary.versaFeet > 0 && (
                  <div style={daySummaryStatStyle}>
                    <div style={daySummaryStatLabelStyle}>VersaClimber</div>
                    <div style={{ ...daySummaryStatValueStyle, color: "#c4b5fd" }}>
                      {selectedDaySummary.versaFeet.toLocaleString()} ft
                      {selectedDaySummary.versaMinutes > 0 ? ` • ${selectedDaySummary.versaMinutes} min` : ""}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedDayKey && !selectedDaySummary && (
            <div style={daySummaryCardStyle}>
              <div style={daySummaryDateStyle}>
                {weeklyChartData.find((d) => d.key === selectedDayKey)?.fullLabel ?? ""}
              </div>
              <p style={{ color: "#888", fontSize: "13px", margin: "8px 0 0" }}>No workout logged this day.</p>
            </div>
          )}

          <p style={cardFootnoteStyle}>Fixed week view (Mon–Sun). Older days drop off automatically when the week changes.</p>
        </section>

        {/* ── Body Balance donut ── */}
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}><h2 style={sectionTitleStyle}>Body Balance</h2></div>
          {bodyBalanceSegments.segments.length > 0 ? (
            <>
              <div style={donutWrapStyle}>
                <div style={{ ...donutStyle, background: `conic-gradient(${bodyBalanceSegments.gradient})` }}>
                  <div style={donutInnerStyle}>
                    <div style={donutCenterBigStyle}>{bodyPartSummary.length}</div>
                    <div style={donutCenterSmallStyle}>areas trained</div>
                  </div>
                </div>
              </div>
              <div style={legendListStyle}>
                {bodyBalanceSegments.segments.map((seg) => (
                  <div key={seg.bodyPart} style={legendRowStyle}>
                    <div style={legendLeftStyle}>
                      <span style={{ ...legendDotStyle, background: seg.color }} />
                      <span style={legendNameStyle}>{seg.bodyPart}</span>
                    </div>
                    <span style={legendValueStyle}>{seg.sets} sets • {seg.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p style={mutedStyle}>No body balance data yet.</p>}
        </section>

        {/* ── Next Training Target ── */}
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}><h2 style={sectionTitleStyle}>Next Training Target</h2></div>
          <div style={nextTargetTitleStyle}>{recommendation.title}</div>
          <div style={nextTargetTextStyle}>{recommendation.detail}</div>
          <button onClick={() => router.push("/Today")} style={smallPrimaryButtonStyle}>{recommendation.cta}</button>
        </section>

        {/* ── Top Lifts Leaderboard ── */}
        <section style={{ ...cardStyle, ...spanTwoStyle }}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Top Lifts</h2>
            <span style={sectionBadgeStyle}>Est. 1RM</span>
          </div>

          {topLifts.length > 0 ? (
            <div style={leaderboardListStyle}>
              {topLifts.map((lift, idx) => (
                <div key={lift.name} style={leaderboardRowStyle}>
                  <div style={leaderboardRankStyle}>#{idx + 1}</div>
                  <div style={leaderboardInfoStyle}>
                    <div style={leaderboardNameStyle}>{lift.name}</div>
                    <div style={leaderboardMetaStyle}>{lift.bodyPart} • Best set: {lift.weight} × {lift.reps}</div>
                  </div>
                  <div style={leaderboardRightStyle}>
                    <div style={leaderboardE1RMStyle}>{lift.e1rm} lbs</div>
                    <div style={{ ...leaderboardLevelStyle, color: getStrengthLabelColor(lift.strengthLabel) }}>
                      {lift.strengthLabel}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={mutedStyle}>Log sets with weight and reps to build your lift leaderboard.</p>
          )}
        </section>

        {/* ── VersaClimber Stats ── */}
        {versaStats.totalSessions > 0 && (
          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={{ ...sectionTitleStyle, color: "#c4b5fd" }}>🧗 VersaClimber</h2>
              <span style={{ ...sectionBadgeStyle, color: "#a78bfa" }}>Lifetime</span>
            </div>
            <div style={statsGridStyle}>
              <div style={miniStatBoxStyle}>
                <span style={miniStatLabelStyle}>Sessions</span>
                <span style={miniStatValueStyle}>{versaStats.totalSessions}</span>
              </div>
              <div style={miniStatBoxStyle}>
                <span style={miniStatLabelStyle}>Total Feet</span>
                <span style={miniStatValueStyleSmall}>{versaStats.totalFeet.toLocaleString()} ft</span>
              </div>
              <div style={miniStatBoxStyle}>
                <span style={miniStatLabelStyle}>Best Session</span>
                <span style={miniStatValueStyleSmall}>{versaStats.bestSession.toLocaleString()} ft</span>
              </div>
              <div style={miniStatBoxStyle}>
                <span style={miniStatLabelStyle}>Total Time</span>
                <span style={miniStatValueStyleSmall}>{formatMinutes(versaStats.totalSeconds)}</span>
              </div>
            </div>
          </section>
        )}

        {/* ── Quick stats ── */}
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}><h2 style={sectionTitleStyle}>Training Stats</h2></div>
          <div style={statsGridStyle}>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Workouts (30d)</span>
              <span style={miniStatValueStyle}>{workoutsLast30}</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Workouts (week)</span>
              <span style={miniStatValueStyle}>{workoutsThisWeek}</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Sets (week)</span>
              <span style={miniStatValueStyle}>{totalSetsThisWeek}</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Unique Exercises</span>
              <span style={miniStatValueStyle}>{uniqueExercises}</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Lifetime Volume</span>
              <span style={miniStatValueStyleSmall}>{formatCompact(lifetimeVolume)}</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Current Streak</span>
              <span style={miniStatValueStyle}>{currentStreak}d</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Best Streak</span>
              <span style={miniStatValueStyle}>{bestStreak}d</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Avg Session</span>
              <span style={miniStatValueStyle}>{avgWorkoutDuration ? `${avgWorkoutDuration}m` : "--"}</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Week Volume</span>
              <span style={miniStatValueStyleSmall}>{Math.round(totalVolumeThisWeek).toLocaleString()}</span>
            </div>
          </div>
        </section>

      </section>

      {status && <p style={statusStyle}>{status}</p>}
    </main>
  );
}

/* ─── STYLES ──────────────────────────────────────────────────────────────── */

const pageStyle: CSSProperties = { minHeight: "100vh", background: "linear-gradient(180deg, #050505 0%, #0a0a0a 42%, #111111 100%)", color: "#ffffff", padding: "20px 14px 120px", fontFamily: "sans-serif", overflowX: "hidden" };
const heroCardStyle: CSSProperties = { background: "linear-gradient(135deg, rgba(255,48,48,0.14) 0%, rgba(18,18,18,1) 50%, rgba(10,10,10,1) 100%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "24px", padding: "22px", marginBottom: "18px", boxShadow: "0 10px 30px rgba(0,0,0,0.35)" };
const heroTopRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" };
const eyebrowStyle: CSSProperties = { color: "#ff6b6b", fontSize: "12px", fontWeight: 800, letterSpacing: "0.14em", margin: "0 0 10px" };
const heroTitleStyle: CSSProperties = { color: "#ffffff", fontSize: "34px", lineHeight: 1.03, fontWeight: 900, margin: "0 0 10px" };
const heroSubStyle: CSSProperties = { color: "#d0d0d0", fontSize: "15px", lineHeight: 1.5, margin: 0, maxWidth: "760px" };
const ghostButtonStyle: CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "999px", padding: "10px 14px", color: "#ffffff", cursor: "pointer", fontWeight: 700, fontSize: "13px" };
const heroCoachFeedWrapStyle: CSSProperties = { display: "grid", gap: "10px", marginTop: "18px", maxWidth: "860px" };
const heroCoachFeedLabelStyle: CSSProperties = { color: "#ff9b9b", fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" };
const heroCoachFeedListStyle: CSSProperties = { display: "grid", gap: "10px" };
const heroCoachFeedCardStyle: CSSProperties = { background: "rgba(255,255,255,0.05)", borderRadius: "16px", padding: "12px 14px" };
const heroCoachFeedTitleStyle: CSSProperties = { color: "#ffffff", fontSize: "14px", fontWeight: 800 };
const heroCoachFeedTextStyle: CSSProperties = { color: "#cfcfcf", fontSize: "13px", lineHeight: 1.45, marginTop: "4px" };
const heroCoachFeedEmptyStyle: CSSProperties = { color: "#bdbdbd", fontSize: "13px", lineHeight: 1.45, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "12px 14px" };
const heroInsightCardStyle: CSSProperties = { marginTop: "18px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px", padding: "18px" };
const heroInsightLabelStyle: CSSProperties = { color: "#ff9b9b", fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" };
const heroInsightTitleStyle: CSSProperties = { color: "#ffffff", fontSize: "22px", fontWeight: 900, lineHeight: 1.2 };
const heroInsightTextStyle: CSSProperties = { color: "#d2d2d2", fontSize: "14px", lineHeight: 1.5, marginTop: "8px", maxWidth: "850px" };
const heroActionRowStyle: CSSProperties = { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "16px" };
const startWorkoutButtonStyle: CSSProperties = { background: "linear-gradient(135deg, #ff4d4d, #ff1a1a)", border: "none", color: "#ffffff", borderRadius: "999px", padding: "13px 20px", fontWeight: 900, fontSize: "14px", cursor: "pointer", boxShadow: "0 4px 16px rgba(255,26,26,0.35)" };
const primaryButtonStyle: CSSProperties = { background: "#ff4d4d", border: "1px solid rgba(255,255,255,0.08)", color: "#ffffff", borderRadius: "999px", padding: "12px 16px", fontWeight: 800, fontSize: "13px", cursor: "pointer" };
const secondaryButtonStyle: CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#ffffff", borderRadius: "999px", padding: "12px 16px", fontWeight: 800, fontSize: "13px", cursor: "pointer" };
const smallPrimaryButtonStyle: CSSProperties = { ...primaryButtonStyle, marginTop: "16px", width: "100%" };
const recommendationMetaRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginTop: "12px" };
const readinessPillStyle: CSSProperties = { borderRadius: "999px", border: "1px solid rgba(255,255,255,0.10)", padding: "8px 12px", fontSize: "12px", fontWeight: 900, background: "rgba(255,255,255,0.05)" };
const metaHintStyle: CSSProperties = { color: "#bdbdbd", fontSize: "12px", fontWeight: 700 };
const metaHintStrongStyle: CSSProperties = { color: "#ffffff", fontWeight: 900 };
const dashboardGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" };
const cardStyle: CSSProperties = { background: "#121212", border: "1px solid #222", borderRadius: "22px", padding: "20px", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", width: "100%", boxSizing: "border-box" };
const spanTwoStyle: CSSProperties = { gridColumn: "1 / -1" };
const sectionHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "14px", flexWrap: "wrap" };
const sectionTitleStyle: CSSProperties = { color: "#ffffff", margin: 0, fontSize: "20px", fontWeight: 850 };
const sectionBadgeStyle: CSSProperties = { color: "#ff9b9b", fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" };

// Weekly chart
const weeklyChartStyle: CSSProperties = { height: "180px", display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px", alignItems: "end", marginTop: "8px" };
const weeklyBarButtonStyle: CSSProperties = { background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", height: "100%", width: "100%" };
const weeklyBarTrackStyle: CSSProperties = { height: "100%", width: "100%", borderRadius: "12px", background: "#171717", border: "1px solid #252525", display: "flex", alignItems: "flex-end", padding: "4px", boxSizing: "border-box", transition: "border-color 0.15s, box-shadow 0.15s" };
const weeklyBarFillStyle: CSSProperties = { width: "100%", borderRadius: "10px", transition: "height 0.2s ease" };
const weeklyBarLabelStyle: CSSProperties = { fontSize: "12px", fontWeight: 700, transition: "color 0.15s" };
const cardFootnoteStyle: CSSProperties = { color: "#8d8d8d", fontSize: "12px", marginTop: "12px", marginBottom: 0 };

// Day summary panel
const daySummaryCardStyle: CSSProperties = { marginTop: "14px", background: "rgba(255,77,77,0.07)", border: "1px solid rgba(255,77,77,0.20)", borderRadius: "16px", padding: "14px 16px" };
const daySummaryHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" };
const daySummaryDateStyle: CSSProperties = { color: "#ff9b9b", fontSize: "13px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" };
const daySummaryCloseStyle: CSSProperties = { background: "transparent", border: "none", color: "#888", fontSize: "14px", cursor: "pointer", padding: "2px 6px" };
const daySummaryNamesStyle: CSSProperties = { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" };
const daySummaryNamePillStyle: CSSProperties = { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "999px", padding: "5px 10px", color: "#ffffff", fontSize: "12px", fontWeight: 700 };
const daySummaryStatsRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: "10px" };
const daySummaryStatStyle: CSSProperties = { background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "10px 12px" };
const daySummaryStatLabelStyle: CSSProperties = { color: "#aaa", fontSize: "11px", marginBottom: "4px" };
const daySummaryStatValueStyle: CSSProperties = { color: "#ffffff", fontSize: "16px", fontWeight: 900 };

// Body balance donut
const mutedStyle: CSSProperties = { color: "#a5a5a5", margin: "6px 0", lineHeight: 1.5 };
const donutWrapStyle: CSSProperties = { display: "flex", justifyContent: "center", marginTop: "8px", marginBottom: "18px" };
const donutStyle: CSSProperties = { width: "180px", height: "180px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" };
const donutInnerStyle: CSSProperties = { width: "104px", height: "104px", borderRadius: "50%", background: "#121212", border: "1px solid #252525", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" };
const donutCenterBigStyle: CSSProperties = { color: "#ffffff", fontSize: "28px", fontWeight: 900, lineHeight: 1 };
const donutCenterSmallStyle: CSSProperties = { color: "#9f9f9f", fontSize: "11px", marginTop: "6px", textAlign: "center" };
const legendListStyle: CSSProperties = { display: "grid", gap: "10px" };
const legendRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" };
const legendLeftStyle: CSSProperties = { display: "flex", alignItems: "center", gap: "10px" };
const legendDotStyle: CSSProperties = { width: "12px", height: "12px", borderRadius: "50%", display: "inline-block" };
const legendNameStyle: CSSProperties = { color: "#ffffff", fontWeight: 700, fontSize: "14px" };
const legendValueStyle: CSSProperties = { color: "#b8b8b8", fontSize: "13px" };

// Next target
const nextTargetTitleStyle: CSSProperties = { color: "#ffffff", fontSize: "24px", lineHeight: 1.25, fontWeight: 900 };
const nextTargetTextStyle: CSSProperties = { color: "#cfcfcf", fontSize: "14px", lineHeight: 1.5, marginTop: "10px" };

// Leaderboard
const leaderboardListStyle: CSSProperties = { display: "grid", gap: "12px" };
const leaderboardRowStyle: CSSProperties = { background: "#171717", border: "1px solid #252525", borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "14px" };
const leaderboardRankStyle: CSSProperties = { color: "#ff9b9b", fontSize: "20px", fontWeight: 900, minWidth: "36px", flexShrink: 0 };
const leaderboardInfoStyle: CSSProperties = { flex: 1, minWidth: 0 };
const leaderboardNameStyle: CSSProperties = { color: "#ffffff", fontSize: "16px", fontWeight: 800 };
const leaderboardMetaStyle: CSSProperties = { color: "#888", fontSize: "12px", marginTop: "3px" };
const leaderboardRightStyle: CSSProperties = { textAlign: "right", flexShrink: 0 };
const leaderboardE1RMStyle: CSSProperties = { color: "#ffffff", fontSize: "18px", fontWeight: 900 };
const leaderboardLevelStyle: CSSProperties = { fontSize: "12px", fontWeight: 800, marginTop: "3px" };

// Stats grid
const statsGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" };
const miniStatBoxStyle: CSSProperties = { background: "#171717", border: "1px solid #252525", borderRadius: "14px", padding: "14px 12px", display: "flex", flexDirection: "column", gap: "6px" };
const miniStatLabelStyle: CSSProperties = { color: "#a9a9a9", fontSize: "12px" };
const miniStatValueStyle: CSSProperties = { color: "#ffffff", fontWeight: 900, fontSize: "18px" };
const miniStatValueStyleSmall: CSSProperties = { color: "#ffffff", fontWeight: 800, fontSize: "14px", lineHeight: 1.35 };
const statusStyle: CSSProperties = { marginTop: "18px", color: "#cccccc" };
