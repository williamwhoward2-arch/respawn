"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

type Candidate = {
  score: number;
  detail: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setStatus("Loading your dashboard...");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Get user error:", userError);
      setStatus(`Error: ${userError.message}`);
      setLoading(false);
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    const [
      { data: profileData, error: profileError },
      { data: workoutsData, error: workoutsError },
      { data: setsData, error: setsError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, user_id, name, age, sex, height, bodyweight, waist, goal, focus, experience_level, equipment_access"
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("workouts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("workout_sets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (profileError) console.error("Profile load error:", profileError);
    if (workoutsError) console.error("Workouts load error:", workoutsError);
    if (setsError) console.error("Sets load error:", setsError);

    setProfile((profileData as Profile) ?? null);
    setWorkouts((workoutsData as Workout[]) ?? []);
    setSets((setsData as WorkoutSet[]) ?? []);
    setStatus("");
    setLoading(false);
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign out error:", error);
      setStatus(`Error signing out: ${error.message}`);
      return;
    }

    router.replace("/login");
  }

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
    return value
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatCompact(value: number) {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return `${Math.round(value)}`;
  }

  function estimate1RM(weight: number, reps: number) {
    if (!weight || !reps) return 0;
    return weight * (1 + reps / 30);
  }

  function hashStringToInt(input: string) {
    let h = 0;
    for (let i = 0; i < input.length; i += 1) {
      h = (h << 5) - h + input.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function pickPerformanceHighlight(args: {
    completedSets: WorkoutSet[];
    workoutsById: Map<number, Workout>;
    weekStart: Date;
    weekEndExclusive: Date;
    today: Date;
    recentBodyPartSummary: BodyPartSummaryItem[];
    workoutsThisWeek: number;
    totalVolumeThisWeek: number;
    uniqueExercises: number;
  }): PerformanceHighlight | null {
    const {
      completedSets,
      workoutsById,
      weekStart,
      weekEndExclusive,
      today,
      recentBodyPartSummary,
      workoutsThisWeek,
      totalVolumeThisWeek,
      uniqueExercises,
    } = args;

    if (completedSets.length === 0) return null;

    const candidates: Candidate[] = [];

    let bestWeekSet: { name: string; weight: number; reps: number; e1rm: number } | null = null;

    for (const s of completedSets) {
      const w = workoutsById.get(s.workout_id);
      if (!w) continue;

      const wd = startOfDay(w.created_at);
      if (wd < weekStart || wd >= weekEndExclusive) continue;

      const weight = Number(s.weight) || 0;
      const reps = Number(s.reps) || 0;
      if (weight <= 0 || reps <= 0) continue;

      const e1rm = estimate1RM(weight, reps);
      if (!bestWeekSet || e1rm > bestWeekSet.e1rm) {
        bestWeekSet = { name: s.exercise_name ?? "Exercise", weight, reps, e1rm };
      }
    }

    if (bestWeekSet) {
      candidates.push({
        score: 160 + Math.min(80, Math.round(bestWeekSet.e1rm / 2)),
        detail: `Best set this week: ${bestWeekSet.weight} × ${bestWeekSet.reps} on ${bestWeekSet.name}.`,
      });
    }

    const setsByExercise = new Map<string, WorkoutSet[]>();
    for (const s of completedSets) {
      const name = (s.exercise_name ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!setsByExercise.has(key)) setsByExercise.set(key, []);
      setsByExercise.get(key)!.push(s);
    }

    let bestImprovement: { name: string; deltaPct: number; prev: number; curr: number } | null =
      null;

    for (const [key, arr] of setsByExercise.entries()) {
      if (arr.length < 4) continue;

      const sorted = [...arr].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const last = sorted[sorted.length - 1];
      const prev = sorted[sorted.length - 2];

      const lastE = estimate1RM(Number(last.weight) || 0, Number(last.reps) || 0);
      const prevE = estimate1RM(Number(prev.weight) || 0, Number(prev.reps) || 0);
      if (prevE <= 0 || lastE <= 0) continue;

      const deltaPct = ((lastE - prevE) / prevE) * 100;
      if (deltaPct >= 4) {
        if (!bestImprovement || deltaPct > bestImprovement.deltaPct) {
          bestImprovement = {
            name: arr[0].exercise_name ?? key,
            deltaPct,
            prev: Math.round(prevE),
            curr: Math.round(lastE),
          };
        }
      }
    }

    if (bestImprovement) {
      candidates.push({
        score: 190 + Math.min(60, Math.round(bestImprovement.deltaPct * 4)),
        detail: `Improved: ${bestImprovement.name} up ${Math.round(
          bestImprovement.deltaPct
        )}% (est. ${bestImprovement.prev} → ${bestImprovement.curr}).`,
      });
    }

    if (recentBodyPartSummary.length > 0) {
      const leader = [...recentBodyPartSummary].sort((a, b) => b.sets - a.sets)[0];
      if (leader && leader.sets >= 6) {
        candidates.push({
          score: 145 + Math.min(40, leader.sets * 2),
          detail: `${leader.bodyPart} is your most worked area this week.`,
        });
      }
    }

    if (workoutsThisWeek >= 4) {
      candidates.push({
        score: 140 + workoutsThisWeek * 4,
        detail: `Strong week: ${workoutsThisWeek} workouts logged so far.`,
      });
    }

    if (totalVolumeThisWeek >= 25000) {
      candidates.push({
        score: 135 + Math.min(40, Math.round(totalVolumeThisWeek / 20000)),
        detail: `Output: ${Math.round(totalVolumeThisWeek).toLocaleString()} total lbs moved this week.`,
      });
    }

    if (uniqueExercises >= 12) {
      candidates.push({
        score: 120 + Math.min(30, uniqueExercises),
        detail: `Variety: ${uniqueExercises} unique exercises logged recently.`,
      });
    }

    if (candidates.length === 0) return null;

    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    const topScore = sorted[0].score;
    const topPool = sorted.filter((c) => c.score >= topScore - 10).slice(0, 4);

    const dayKey = today.toISOString().slice(0, 10);
    const pickIndex = topPool.length > 1 ? hashStringToInt(dayKey) % topPool.length : 0;
    const chosen = topPool[pickIndex] ?? sorted[0];

    return { title: "Performance", detail: chosen.detail };
  }

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
    for (const workout of workouts) map.set(workout.id, workout);
    return map;
  }, [workouts]);

  const trainingWorkouts = useMemo(() => {
    return workouts.filter((workout) => (workout.day_type ?? "workout") !== "rest");
  }, [workouts]);

  const restDays = useMemo(() => {
    return workouts.filter((workout) => workout.day_type === "rest");
  }, [workouts]);

  const trainingWorkoutIds = useMemo(() => {
    return new Set(trainingWorkouts.map((workout) => workout.id));
  }, [trainingWorkouts]);

  const completedSets = useMemo(() => {
    return sets.filter((set) => {
      const weight = toNumber(set.weight);
      const reps = toNumber(set.reps);
      return trainingWorkoutIds.has(set.workout_id) && weight > 0 && reps > 0;
    });
  }, [sets, trainingWorkoutIds]);

  const workoutDays = useMemo(() => {
    const map = new Map<string, { count: number; volume: number }>();

    for (const workout of trainingWorkouts) {
      const key = startOfDay(workout.created_at).toISOString();
      if (!map.has(key)) map.set(key, { count: 0, volume: 0 });
      map.get(key)!.count += 1;
    }

    for (const set of completedSets) {
      const workout = workoutsById.get(set.workout_id);
      if (!workout || (workout.day_type ?? "workout") === "rest") continue;

      const key = startOfDay(workout.created_at).toISOString();
      const volume = toNumber(set.weight) * toNumber(set.reps);

      if (!map.has(key)) map.set(key, { count: 0, volume: 0 });
      map.get(key)!.volume += volume;
    }

    return map;
  }, [trainingWorkouts, completedSets, workoutsById]);

  const last30Start = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() - 29);
    return d;
  }, [today]);

  const workoutsThisWeek = useMemo(() => {
    return trainingWorkouts.filter((w) => {
      const d = startOfDay(w.created_at);
      return d >= weekStart && d < weekEndExclusive;
    }).length;
  }, [trainingWorkouts, weekStart, weekEndExclusive]);

  const workoutsLast30 = useMemo(() => {
    return trainingWorkouts.filter((w) => startOfDay(w.created_at) >= last30Start).length;
  }, [trainingWorkouts, last30Start]);

  const avgWorkoutDuration = useMemo(() => {
    const durations = trainingWorkouts
      .map((w) => toNumber(w.duration_seconds))
      .filter((x) => x > 0);

    if (durations.length === 0) return 0;

    return Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length / 60);
  }, [trainingWorkouts]);

  const currentStreak = useMemo(() => {
    if (workoutDays.size === 0) return 0;

    let streak = 0;

    for (let i = 0; i < 365; i += 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const key = day.toISOString();

      if (workoutDays.has(key)) {
        streak += 1;
      } else {
        if (i === 0) continue;
        break;
      }
    }

    return streak;
  }, [today, workoutDays]);

  const bestStreak = useMemo(() => {
    if (workoutDays.size === 0) return 0;

    const days = Array.from(workoutDays.keys()).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    let best = 1;
    let current = 1;

    for (let i = 1; i < days.length; i += 1) {
      const prev = startOfDay(days[i - 1]);
      const curr = startOfDay(days[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

      if (diff === 1) {
        current += 1;
        best = Math.max(best, current);
      } else {
        current = 1;
      }
    }

    return best;
  }, [workoutDays]);

  const lastWorkout = useMemo(() => {
    return [...trainingWorkouts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0] ?? null;
  }, [trainingWorkouts]);

  const daysSinceLastWorkout = useMemo(() => {
    if (!lastWorkout) return null;
    const diff = today.getTime() - startOfDay(lastWorkout.created_at).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, [today, lastWorkout]);

  const totalVolumeThisWeek = useMemo(() => {
    const weekIds = new Set(
      trainingWorkouts
        .filter((w) => {
          const d = startOfDay(w.created_at);
          return d >= weekStart && d < weekEndExclusive;
        })
        .map((w) => w.id)
    );

    return completedSets
      .filter((set) => weekIds.has(set.workout_id))
      .reduce((sum, set) => sum + toNumber(set.weight) * toNumber(set.reps), 0);
  }, [trainingWorkouts, completedSets, weekStart, weekEndExclusive]);

  const totalSetsThisWeek = useMemo(() => {
    const weekIds = new Set(
      trainingWorkouts
        .filter((w) => {
          const d = startOfDay(w.created_at);
          return d >= weekStart && d < weekEndExclusive;
        })
        .map((w) => w.id)
    );

    return completedSets.filter((set) => weekIds.has(set.workout_id)).length;
  }, [trainingWorkouts, completedSets, weekStart, weekEndExclusive]);

  const lifetimeVolume = useMemo(() => {
    return completedSets.reduce((sum, set) => sum + toNumber(set.weight) * toNumber(set.reps), 0);
  }, [completedSets]);

  const uniqueExercises = useMemo(() => {
    const unique = new Set(
      completedSets
        .map((set) => (set.exercise_name ?? "").trim())
        .filter(Boolean)
        .map((name) => name.toLowerCase())
    );
    return unique.size;
  }, [completedSets]);

  const bodyPartSummary = useMemo<BodyPartSummaryItem[]>(() => {
    const map = new Map<string, { sets: number; volume: number }>();

    for (const set of completedSets) {
      const bodyPart = set.body_part ? titleCase(set.body_part) : "Other";
      const current = map.get(bodyPart) ?? { sets: 0, volume: 0 };
      current.sets += 1;
      current.volume += toNumber(set.weight) * toNumber(set.reps);
      map.set(bodyPart, current);
    }

    return Array.from(map.entries())
      .map(([bodyPart, value]) => ({
        bodyPart,
        sets: value.sets,
        volume: value.volume,
      }))
      .sort((a, b) => b.sets - a.sets);
  }, [completedSets]);

  const weekBodyPartSummary = useMemo<BodyPartSummaryItem[]>(() => {
    const map = new Map<string, { sets: number; volume: number }>();

    for (const set of completedSets) {
      const workout = workoutsById.get(set.workout_id);
      if (!workout) continue;

      const d = startOfDay(workout.created_at);
      if (d < weekStart || d >= weekEndExclusive) continue;

      const bodyPart = set.body_part ? titleCase(set.body_part) : "Other";
      const current = map.get(bodyPart) ?? { sets: 0, volume: 0 };
      current.sets += 1;
      current.volume += toNumber(set.weight) * toNumber(set.reps);
      map.set(bodyPart, current);
    }

    return Array.from(map.entries())
      .map(([bodyPart, value]) => ({
        bodyPart,
        sets: value.sets,
        volume: value.volume,
      }))
      .sort((a, b) => a.sets - b.sets);
  }, [completedSets, workoutsById, weekStart, weekEndExclusive]);

  const bodyPartLastTrained = useMemo(() => {
    const map = new Map<string, Date>();

    for (const set of completedSets) {
      const workout = workoutsById.get(set.workout_id);
      if (!workout) continue;

      const bodyPart = set.body_part ? titleCase(set.body_part) : "Other";
      const workoutDate = startOfDay(workout.created_at);
      const existing = map.get(bodyPart);

      if (!existing || workoutDate > existing) map.set(bodyPart, workoutDate);
    }

    return map;
  }, [completedSets, workoutsById]);

  function getDaysSinceBodyPart(bodyPart: string) {
    const lastDate = bodyPartLastTrained.get(bodyPart);
    if (!lastDate) return 999;
    return Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  const readiness = useMemo(() => {
    if (completedSets.length === 0) return { label: "New Signal", tone: "neutral" as const };
    if (currentStreak >= 4) return { label: "Needs Recovery", tone: "warn" as const };
    if (currentStreak >= 3) return { label: "Moderate Fatigue", tone: "neutral" as const };
    if (daysSinceLastWorkout !== null && daysSinceLastWorkout >= 3) {
      return { label: "Fresh", tone: "good" as const };
    }
    return { label: "Train Ready", tone: "good" as const };
  }, [completedSets.length, currentStreak, daysSinceLastWorkout]);

  const weeklyChartData = useMemo(() => {
    const days: { label: string; volume: number; active: boolean }[] = [];

    for (let i = 0; i < 7; i += 1) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      day.setHours(0, 0, 0, 0);

      const key = day.toISOString();
      const info = workoutDays.get(key);

      days.push({
        label: day.toLocaleDateString(undefined, { weekday: "short" }),
        volume: info?.volume ?? 0,
        active: Boolean(info),
      });
    }

    return days;
  }, [weekStart, workoutDays]);

  const maxWeeklyVolume = useMemo(() => {
    return Math.max(1, ...weeklyChartData.map((d) => d.volume));
  }, [weeklyChartData]);

  const performanceHighlight = useMemo(() => {
    return pickPerformanceHighlight({
      completedSets,
      workoutsById,
      weekStart,
      weekEndExclusive,
      today,
      recentBodyPartSummary: weekBodyPartSummary.filter((x) => x.bodyPart !== "Other"),
      workoutsThisWeek,
      totalVolumeThisWeek,
      uniqueExercises,
    });
  }, [
    completedSets,
    workoutsById,
    weekStart,
    weekEndExclusive,
    today,
    weekBodyPartSummary,
    workoutsThisWeek,
    totalVolumeThisWeek,
    uniqueExercises,
  ]);

  const candidateBodyParts = useMemo(
    () => ["Chest", "Back", "Legs", "Shoulders", "Arms"],
    []
  );

  const rankedBodyParts = useMemo(() => {
    const weekMap = new Map<string, BodyPartSummaryItem>();
    for (const item of weekBodyPartSummary) weekMap.set(item.bodyPart, item);

    return candidateBodyParts
      .map((bodyPart) => {
        const daysSince = getDaysSinceBodyPart(bodyPart);
        const weekSets = weekMap.get(bodyPart)?.sets ?? 0;

        let score = 0;
        score += Math.min(daysSince, 7) * 2;
        score -= weekSets * 1.6;
        if (daysSince <= 1) score -= 12;
        else if (daysSince <= 2) score -= 8;
        if (currentStreak >= 3) score -= 3;

        return { bodyPart, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [candidateBodyParts, weekBodyPartSummary, currentStreak]);

  const suggestionBodyPart = useMemo(() => rankedBodyParts[0]?.bodyPart ?? null, [rankedBodyParts]);

  const recommendation = useMemo<Recommendation>(() => {
    if (completedSets.length === 0) {
      return {
        title: "Start your first session",
        detail:
          "Log a few workouts and ReSpawn will start giving smarter next-session suggestions automatically.",
        cta: "Go To Today",
        mode: "train",
        suggestedBodyPart: null,
        readinessLabel: readiness.label,
      };
    }

    if (currentStreak >= 4) {
      return {
        title: "Recovery Day",
        detail:
          "You’ve been consistent. A rest day helps you keep momentum without piling fatigue.",
        cta: "Log Recovery Day",
        mode: "rest",
        suggestedBodyPart: null,
        readinessLabel: "Needs Recovery",
      };
    }

    if (currentStreak >= 3) {
      return {
        title: "Keep it lighter",
        detail: suggestionBodyPart
          ? `${suggestionBodyPart} is a solid next session based on this week’s balance.`
          : "Keep your next session clean and lighter than usual.",
        cta: suggestionBodyPart ? `Build ${suggestionBodyPart} Workout` : "Start Workout",
        mode: "light",
        suggestedBodyPart: suggestionBodyPart,
        readinessLabel: readiness.label,
      };
    }

    if (daysSinceLastWorkout !== null && daysSinceLastWorkout >= 3) {
      return {
        title: "Next session",
        detail: suggestionBodyPart
          ? `${suggestionBodyPart} is a good next session based on this week’s balance.`
          : "Good day to train—keep it clean and build momentum.",
        cta: suggestionBodyPart ? `Build ${suggestionBodyPart} Workout` : "Start Workout",
        mode: "train",
        suggestedBodyPart: suggestionBodyPart,
        readinessLabel: "Fresh",
      };
    }

    return {
      title: "Next session",
      detail: suggestionBodyPart
        ? `${suggestionBodyPart} is a good next session based on this week’s balance.`
        : "Pick a clean session and keep the week moving.",
      cta: suggestionBodyPart ? `Build ${suggestionBodyPart} Workout` : "Generate Next Session",
      mode: "train",
      suggestedBodyPart: suggestionBodyPart,
      readinessLabel: readiness.label,
    };
  }, [
    completedSets.length,
    currentStreak,
    daysSinceLastWorkout,
    suggestionBodyPart,
    readiness.label,
  ]);

  const aiHeadline = useMemo(() => {
    if (completedSets.length === 0) return "Start building your training signal";
    if (recommendation.mode === "rest") return "Recovery keeps progress moving";
    if (recommendation.mode === "light") return "Momentum is building";
    return "Next workout suggestion";
  }, [completedSets.length, recommendation.mode]);

  const coachFeed = useMemo<CoachFeedItem[]>(() => {
    const items: CoachFeedItem[] = [];

    if (completedSets.length === 0) {
      items.push({
        title: "Consistency",
        detail: "Log a few workouts to unlock smarter insights.",
        tone: "neutral",
      });
    } else if (currentStreak >= 3) {
      items.push({
        title: "Consistency",
        detail: `${currentStreak}-day training streak. Momentum is building.`,
        tone: "good",
      });
    } else if (workoutsThisWeek > 0) {
      items.push({
        title: "Consistency",
        detail: `${workoutsThisWeek} workout${workoutsThisWeek === 1 ? "" : "s"} logged this week.`,
        tone: workoutsThisWeek >= 3 ? "good" : "neutral",
      });
    } else {
      items.push({
        title: "Consistency",
        detail: "Your next session is the one that restarts momentum.",
        tone: "neutral",
      });
    }

    items.push({
      title: "Performance",
      detail: performanceHighlight
        ? performanceHighlight.detail
        : "Repeat a few key lifts and ReSpawn will start calling out improvements.",
      tone: "neutral",
    });

    items.push({
      title: "Momentum",
      detail: "Every logged set sharpens your training signal. Keep stacking sessions.",
      tone: "good",
    });

    return items.slice(0, 3);
  }, [completedSets.length, currentStreak, workoutsThisWeek, performanceHighlight]);

  const bodyBalanceSegments = useMemo(() => {
    const items = bodyPartSummary.slice(0, 5);
    const total = items.reduce((sum, item) => sum + item.sets, 0) || 1;
    const colors = ["#ff4d4d", "#ff8b8b", "#ffa94d", "#7c5cff", "#29cc7a"];

    let currentAngle = 0;
    const segments = items.map((item, index) => {
      const pct = item.sets / total;
      const start = currentAngle;
      const end = currentAngle + pct * 360;
      currentAngle = end;

      return {
        ...item,
        color: colors[index % colors.length],
        start,
        end,
        pct: Math.round(pct * 100),
      };
    });

    const gradient = segments
      .map((segment) => `${segment.color} ${segment.start}deg ${segment.end}deg`)
      .join(", ");

    return {
      segments,
      gradient: gradient || "#252525 0deg 360deg",
    };
  }, [bodyPartSummary]);

  const displayName = profile?.name?.trim() || "Your";

  const primaryAction = () => {
    router.push("/Today");
  };

  const secondaryAction = () => {
    router.push("/Progress");
  };

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

  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <div style={heroTopRowStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={eyebrowStyle}>RESPAWN DASHBOARD</p>
            <h1 style={heroTitleStyle}>{displayName}&apos;s AI Coach</h1>
            <p style={heroSubStyle}>
              A clean read on your consistency, performance highlights, and one next-session
              suggestion.
            </p>

            <div style={heroCoachFeedWrapStyle}>
              <div style={heroCoachFeedLabelStyle}>Coach Feed</div>

              {coachFeed.length > 0 ? (
                <div style={heroCoachFeedListStyle}>
                  {coachFeed.map((item, index) => (
                    <div
                      key={`${item.title}-${index}`}
                      style={{
                        ...heroCoachFeedCardStyle,
                        border:
                          item.tone === "good"
                            ? "1px solid rgba(40, 199, 111, 0.22)"
                            : item.tone === "warn"
                              ? "1px solid rgba(255, 184, 0, 0.22)"
                              : "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <div style={heroCoachFeedTitleStyle}>{item.title}</div>
                      <div style={heroCoachFeedTextStyle}>{item.detail}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={heroCoachFeedEmptyStyle}>
                  Keep logging workouts and your coach feed will start filling in here.
                </div>
              )}
            </div>
          </div>

          <button onClick={handleSignOut} style={ghostButtonStyle}>
            Sign Out
          </button>
        </div>

        <div style={heroInsightCardStyle}>
          <div style={heroInsightLabelStyle}>Today&apos;s Coach Call</div>
          <div style={heroInsightTitleStyle}>{aiHeadline}</div>
          <div style={heroInsightTextStyle}>{recommendation.detail}</div>

          <div style={recommendationMetaRowStyle}>
            <div
              style={{
                ...readinessPillStyle,
                borderColor:
                  readiness.tone === "good"
                    ? "rgba(40, 199, 111, 0.24)"
                    : readiness.tone === "warn"
                      ? "rgba(255, 184, 0, 0.24)"
                      : "rgba(255,255,255,0.10)",
                color:
                  readiness.tone === "good"
                    ? "#7CFFB2"
                    : readiness.tone === "warn"
                      ? "#FFD66B"
                      : "#d7d7d7",
              }}
            >
              Readiness: {recommendation.readinessLabel}
            </div>

            <div style={metaHintStyle}>
              Streak: <span style={metaHintStrongStyle}>{currentStreak}d</span>
              {daysSinceLastWorkout !== null ? (
                <>
                  {" "}
                  • Last workout:{" "}
                  <span style={metaHintStrongStyle}>
                    {daysSinceLastWorkout === 0 ? "Today" : `${daysSinceLastWorkout}d ago`}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <div style={heroActionRowStyle}>
            <button onClick={primaryAction} style={primaryButtonStyle}>
              {recommendation.cta}
            </button>
            <button onClick={secondaryAction} style={secondaryButtonStyle}>
              View Workout Log
            </button>
          </div>
        </div>
      </section>

      <section style={dashboardGridStyle}>
        <section style={{ ...cardStyle, ...spanTwoStyle }}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>This Week (Mon–Sun)</h2>
            <span style={sectionBadgeStyle}>Pattern</span>
          </div>

          <div style={weeklyChartStyle}>
            {weeklyChartData.map((day) => {
              const heightPct = Math.max(8, Math.round((day.volume / maxWeeklyVolume) * 100));
              return (
                <div key={day.label} style={weeklyBarWrapStyle}>
                  <div style={weeklyBarTrackStyle}>
                    <div
                      style={{
                        ...weeklyBarFillStyle,
                        height: `${day.active ? heightPct : 8}%`,
                        background: day.active
                          ? "linear-gradient(180deg, #ff7a7a 0%, #ff4d4d 100%)"
                          : "#202020",
                      }}
                    />
                  </div>
                  <span style={weeklyBarLabelStyle}>{day.label.slice(0, 2)}</span>
                </div>
              );
            })}
          </div>

          <p style={cardFootnoteStyle}>
            Fixed week view (Mon–Sun). Older days drop off automatically when the week changes.
          </p>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Body Balance</h2>
          </div>

          {bodyBalanceSegments.segments.length > 0 ? (
            <>
              <div style={donutWrapStyle}>
                <div
                  style={{
                    ...donutStyle,
                    background: `conic-gradient(${bodyBalanceSegments.gradient})`,
                  }}
                >
                  <div style={donutInnerStyle}>
                    <div style={donutCenterBigStyle}>{bodyPartSummary.length}</div>
                    <div style={donutCenterSmallStyle}>areas trained</div>
                  </div>
                </div>
              </div>

              <div style={legendListStyle}>
                {bodyBalanceSegments.segments.map((segment) => (
                  <div key={segment.bodyPart} style={legendRowStyle}>
                    <div style={legendLeftStyle}>
                      <span style={{ ...legendDotStyle, background: segment.color }} />
                      <span style={legendNameStyle}>{segment.bodyPart}</span>
                    </div>
                    <span style={legendValueStyle}>
                      {segment.sets} sets • {segment.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={mutedStyle}>No body balance data yet.</p>
          )}
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Next Training Target</h2>
          </div>

          <div style={nextTargetTitleStyle}>{recommendation.title}</div>
          <div style={nextTargetTextStyle}>{recommendation.detail}</div>

          <button onClick={primaryAction} style={smallPrimaryButtonStyle}>
            {recommendation.cta}
          </button>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Performance Snapshot</h2>
          </div>

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
              <span style={miniStatLabelStyle}>Rest Days</span>
              <span style={miniStatValueStyle}>{restDays.length}</span>
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
              <span style={miniStatValueStyle}>
                {avgWorkoutDuration ? `${avgWorkoutDuration}m` : "--"}
              </span>
            </div>

            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Week Volume</span>
              <span style={miniStatValueStyleSmall}>
                {Math.round(totalVolumeThisWeek).toLocaleString()}
              </span>
            </div>
          </div>
        </section>
      </section>

      {status ? <p style={statusStyle}>{status}</p> : null}
    </main>
  );
}

/* ------------------ STYLES ------------------ */

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #050505 0%, #0a0a0a 42%, #111111 100%)",
  color: "#ffffff",
  padding: "20px 14px 120px",
  fontFamily: "sans-serif",
  overflowX: "hidden",
};

const heroCardStyle: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(255,48,48,0.14) 0%, rgba(18,18,18,1) 50%, rgba(10,10,10,1) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "24px",
  padding: "22px",
  marginBottom: "18px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
};

const heroTopRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  color: "#ff6b6b",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.14em",
  margin: "0 0 10px",
};

const heroTitleStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "34px",
  lineHeight: 1.03,
  fontWeight: 900,
  margin: "0 0 10px",
};

const heroSubStyle: CSSProperties = {
  color: "#d0d0d0",
  fontSize: "15px",
  lineHeight: 1.5,
  margin: 0,
  maxWidth: "760px",
};

const ghostButtonStyle: CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "999px",
  padding: "10px 14px",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "13px",
};

const heroCoachFeedWrapStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  marginTop: "18px",
  maxWidth: "860px",
};

const heroCoachFeedLabelStyle: CSSProperties = {
  color: "#ff9b9b",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const heroCoachFeedListStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
};

const heroCoachFeedCardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  borderRadius: "16px",
  padding: "12px 14px",
};

const heroCoachFeedTitleStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 800,
};

const heroCoachFeedTextStyle: CSSProperties = {
  color: "#cfcfcf",
  fontSize: "13px",
  lineHeight: 1.45,
  marginTop: "4px",
};

const heroCoachFeedEmptyStyle: CSSProperties = {
  color: "#bdbdbd",
  fontSize: "13px",
  lineHeight: 1.45,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "16px",
  padding: "12px 14px",
};

const heroInsightCardStyle: CSSProperties = {
  marginTop: "18px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "18px",
  padding: "18px",
};

const heroInsightLabelStyle: CSSProperties = {
  color: "#ff9b9b",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: "8px",
};

const heroInsightTitleStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: 900,
  lineHeight: 1.2,
};

const heroInsightTextStyle: CSSProperties = {
  color: "#d2d2d2",
  fontSize: "14px",
  lineHeight: 1.5,
  marginTop: "8px",
  maxWidth: "850px",
};

const heroActionRowStyle: CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "16px",
};

const primaryButtonStyle: CSSProperties = {
  background: "#ff4d4d",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#ffffff",
  borderRadius: "999px",
  padding: "12px 16px",
  fontWeight: 800,
  fontSize: "13px",
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#ffffff",
  borderRadius: "999px",
  padding: "12px 16px",
  fontWeight: 800,
  fontSize: "13px",
  cursor: "pointer",
};

const smallPrimaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  marginTop: "16px",
  width: "100%",
};

const recommendationMetaRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "12px",
};

const readinessPillStyle: CSSProperties = {
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.10)",
  padding: "8px 12px",
  fontSize: "12px",
  fontWeight: 900,
  background: "rgba(255,255,255,0.05)",
};

const metaHintStyle: CSSProperties = {
  color: "#bdbdbd",
  fontSize: "12px",
  fontWeight: 700,
};

const metaHintStrongStyle: CSSProperties = {
  color: "#ffffff",
  fontWeight: 900,
};

const dashboardGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px",
};

const cardStyle: CSSProperties = {
  background: "#121212",
  border: "1px solid #222",
  borderRadius: "22px",
  padding: "20px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  width: "100%",
  boxSizing: "border-box",
};

const spanTwoStyle: CSSProperties = {
  gridColumn: "1 / -1",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "14px",
  flexWrap: "wrap",
};

const sectionTitleStyle: CSSProperties = {
  color: "#ffffff",
  margin: 0,
  fontSize: "20px",
  fontWeight: 850,
};

const sectionBadgeStyle: CSSProperties = {
  color: "#ff9b9b",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const weeklyChartStyle: CSSProperties = {
  height: "180px",
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: "8px",
  alignItems: "end",
  marginTop: "8px",
};

const weeklyBarWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "10px",
  height: "100%",
};

const weeklyBarTrackStyle: CSSProperties = {
  height: "100%",
  width: "100%",
  borderRadius: "12px",
  background: "#171717",
  border: "1px solid #252525",
  display: "flex",
  alignItems: "flex-end",
  padding: "4px",
  boxSizing: "border-box",
};

const weeklyBarFillStyle: CSSProperties = {
  width: "100%",
  borderRadius: "10px",
};

const weeklyBarLabelStyle: CSSProperties = {
  color: "#9f9f9f",
  fontSize: "12px",
  fontWeight: 700,
};

const cardFootnoteStyle: CSSProperties = {
  color: "#8d8d8d",
  fontSize: "12px",
  marginTop: "12px",
  marginBottom: 0,
};

const mutedStyle: CSSProperties = {
  color: "#a5a5a5",
  margin: "6px 0",
  lineHeight: 1.5,
};

const donutWrapStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: "8px",
  marginBottom: "18px",
};

const donutStyle: CSSProperties = {
  width: "180px",
  height: "180px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const donutInnerStyle: CSSProperties = {
  width: "104px",
  height: "104px",
  borderRadius: "50%",
  background: "#121212",
  border: "1px solid #252525",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

const donutCenterBigStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "28px",
  fontWeight: 900,
  lineHeight: 1,
};

const donutCenterSmallStyle: CSSProperties = {
  color: "#9f9f9f",
  fontSize: "11px",
  marginTop: "6px",
  textAlign: "center",
};

const legendListStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
};

const legendRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
};

const legendLeftStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const legendDotStyle: CSSProperties = {
  width: "12px",
  height: "12px",
  borderRadius: "50%",
  display: "inline-block",
};

const legendNameStyle: CSSProperties = {
  color: "#ffffff",
  fontWeight: 700,
  fontSize: "14px",
};

const legendValueStyle: CSSProperties = {
  color: "#b8b8b8",
  fontSize: "13px",
};

const nextTargetTitleStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "24px",
  lineHeight: 1.25,
  fontWeight: 900,
};

const nextTargetTextStyle: CSSProperties = {
  color: "#cfcfcf",
  fontSize: "14px",
  lineHeight: 1.5,
  marginTop: "10px",
};

const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "10px",
};

const miniStatBoxStyle: CSSProperties = {
  background: "#171717",
  border: "1px solid #252525",
  borderRadius: "14px",
  padding: "14px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const miniStatLabelStyle: CSSProperties = {
  color: "#a9a9a9",
  fontSize: "12px",
};

const miniStatValueStyle: CSSProperties = {
  color: "#ffffff",
  fontWeight: 900,
  fontSize: "18px",
};

const miniStatValueStyleSmall: CSSProperties = {
  color: "#ffffff",
  fontWeight: 800,
  fontSize: "14px",
  lineHeight: 1.35,
};

const statusStyle: CSSProperties = {
  marginTop: "18px",
  color: "#cccccc",
};