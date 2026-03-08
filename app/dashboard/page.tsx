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

type LiftInsightCard = {
  name: string;
  bodyPart: string;
  bestE1RM: number;
  latestE1RM: number;
  trendPct: number;
  timesLogged: number;
  lastWeight: number;
  lastReps: number;
};

type StrengthCard = {
  label: string;
  value: string;
  sub: string;
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

  function estimate1RM(weight: number, reps: number) {
    if (!weight || !reps) return 0;
    return weight * (1 + reps / 30);
  }

  function startOfDay(dateInput: string | Date) {
    const d = new Date(dateInput);
    d.setHours(0, 0, 0, 0);
    return d;
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

  const today = startOfDay(new Date());

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

  const last7Start = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() - 6);
    return d;
  }, [today]);

  const prev7Start = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() - 13);
    return d;
  }, [today]);

  const prev7End = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() - 7);
    return d;
  }, [today]);

  const last30Start = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() - 29);
    return d;
  }, [today]);

  const workoutsThisWeek = useMemo(() => {
    return trainingWorkouts.filter((w) => startOfDay(w.created_at) >= last7Start).length;
  }, [trainingWorkouts, last7Start]);

  const workoutsLast30 = useMemo(() => {
    return trainingWorkouts.filter((w) => startOfDay(w.created_at) >= last30Start).length;
  }, [trainingWorkouts, last30Start]);

  const avgWorkoutDuration = useMemo(() => {
    const durations = trainingWorkouts
      .map((w) => toNumber(w.duration_seconds))
      .filter((x) => x > 0);

    if (durations.length === 0) return 0;

    return Math.round(
      durations.reduce((sum, value) => sum + value, 0) / durations.length / 60
    );
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

  const totalVolumeThisWeek = useMemo(() => {
    const last7Ids = new Set(
      trainingWorkouts
        .filter((w) => startOfDay(w.created_at) >= last7Start)
        .map((w) => w.id)
    );

    return completedSets
      .filter((set) => last7Ids.has(set.workout_id))
      .reduce((sum, set) => sum + toNumber(set.weight) * toNumber(set.reps), 0);
  }, [trainingWorkouts, completedSets, last7Start]);

  const totalSetsThisWeek = useMemo(() => {
    const last7Ids = new Set(
      trainingWorkouts
        .filter((w) => startOfDay(w.created_at) >= last7Start)
        .map((w) => w.id)
    );

    return completedSets.filter((set) => last7Ids.has(set.workout_id)).length;
  }, [trainingWorkouts, completedSets, last7Start]);

  const lifetimeVolume = useMemo(() => {
    return completedSets.reduce(
      (sum, set) => sum + toNumber(set.weight) * toNumber(set.reps),
      0
    );
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

  const repBias = useMemo(() => {
    if (completedSets.length === 0) return "Learning";

    const avgReps = Math.round(
      completedSets.reduce((sum, set) => sum + toNumber(set.reps), 0) / completedSets.length
    );

    if (avgReps <= 6) return "Strength";
    if (avgReps <= 12) return "Hypertrophy";
    return "Endurance";
  }, [completedSets]);

  const volumeMomentum = useMemo(() => {
    const last7Workouts = trainingWorkouts.filter(
      (w) => startOfDay(w.created_at) >= last7Start
    );

    const prev7Workouts = trainingWorkouts.filter((w) => {
      const d = startOfDay(w.created_at);
      return d >= prev7Start && d <= prev7End;
    });

    const last7Ids = new Set(last7Workouts.map((w) => w.id));
    const prev7Ids = new Set(prev7Workouts.map((w) => w.id));

    const last7Volume = completedSets
      .filter((s) => last7Ids.has(s.workout_id))
      .reduce((sum, s) => sum + toNumber(s.weight) * toNumber(s.reps), 0);

    const prev7Volume = completedSets
      .filter((s) => prev7Ids.has(s.workout_id))
      .reduce((sum, s) => sum + toNumber(s.weight) * toNumber(s.reps), 0);

    const deltaPct =
      prev7Volume > 0
        ? Math.round(((last7Volume - prev7Volume) / prev7Volume) * 100)
        : last7Volume > 0
        ? 100
        : 0;

    return {
      last7Volume,
      prev7Volume,
      deltaPct,
    };
  }, [trainingWorkouts, completedSets, last7Start, prev7Start, prev7End]);

  const strongestEstimatedLift = useMemo(() => {
    if (completedSets.length === 0) return null;

    const ranked = completedSets
      .map((set) => {
        const weight = toNumber(set.weight);
        const reps = toNumber(set.reps);
        return {
          name: set.exercise_name ?? "Exercise",
          e1rm: Math.round(estimate1RM(weight, reps)),
          weight,
          reps,
        };
      })
      .sort((a, b) => b.e1rm - a.e1rm);

    return ranked[0] ?? null;
  }, [completedSets]);

  const liftInsights = useMemo<LiftInsightCard[]>(() => {
    const map = new Map<
      string,
      {
        name: string;
        bodyPart: string;
        sets: WorkoutSet[];
      }
    >();

    for (const set of completedSets) {
      const name = (set.exercise_name ?? "").trim();
      if (!name) continue;

      const key = name.toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          name,
          bodyPart: set.body_part ? titleCase(set.body_part) : "Other",
          sets: [],
        });
      }

      map.get(key)!.sets.push(set);
    }

    return Array.from(map.values())
      .map((item) => {
        const sorted = [...item.sets].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        const last = sorted[sorted.length - 1];
        const splitIndex = Math.max(1, Math.floor(sorted.length / 2));
        const firstHalf = sorted.slice(0, splitIndex);
        const secondHalf = sorted.slice(splitIndex);

        const firstAvg =
          firstHalf.reduce(
            (sum, set) => sum + estimate1RM(toNumber(set.weight), toNumber(set.reps)),
            0
          ) / firstHalf.length;

        const secondSource = secondHalf.length > 0 ? secondHalf : firstHalf;

        const secondAvg =
          secondSource.reduce(
            (sum, set) => sum + estimate1RM(toNumber(set.weight), toNumber(set.reps)),
            0
          ) / secondSource.length;

        const bestE1RM = Math.round(
          Math.max(
            ...sorted.map((set) => estimate1RM(toNumber(set.weight), toNumber(set.reps)))
          )
        );

        const latestE1RM = Math.round(
          estimate1RM(toNumber(last?.weight), toNumber(last?.reps))
        );

        const trendPct =
          firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;

        return {
          name: item.name,
          bodyPart: item.bodyPart,
          bestE1RM,
          latestE1RM,
          trendPct,
          timesLogged: sorted.length,
          lastWeight: toNumber(last?.weight),
          lastReps: toNumber(last?.reps),
        };
      })
      .filter((item) => item.timesLogged >= 3)
      .sort((a, b) => b.bestE1RM - a.bestE1RM)
      .slice(0, 4);
  }, [completedSets]);

  const strengthCards = useMemo<StrengthCard[]>(() => {
    if (completedSets.length === 0) return [];

    const strongestByE1RM = [...completedSets]
      .map((set) => ({
        name: set.exercise_name ?? "Exercise",
        weight: toNumber(set.weight),
        reps: toNumber(set.reps),
        e1rm: Math.round(estimate1RM(toNumber(set.weight), toNumber(set.reps))),
      }))
      .sort((a, b) => b.e1rm - a.e1rm)[0];

    const heaviestWeight = [...completedSets]
      .map((set) => ({
        name: set.exercise_name ?? "Exercise",
        weight: toNumber(set.weight),
        reps: toNumber(set.reps),
      }))
      .sort((a, b) => b.weight - a.weight)[0];

    const highestRepSet = [...completedSets]
      .map((set) => ({
        name: set.exercise_name ?? "Exercise",
        weight: toNumber(set.weight),
        reps: toNumber(set.reps),
      }))
      .sort((a, b) => b.reps - a.reps)[0];

    const cards: StrengthCard[] = [];

    if (strongestByE1RM) {
      cards.push({
        label: "Top Strength Score",
        value: `${strongestByE1RM.e1rm}`,
        sub: `${strongestByE1RM.name} • ${strongestByE1RM.weight} × ${strongestByE1RM.reps}`,
      });
    }

    if (heaviestWeight) {
      cards.push({
        label: "Heaviest Set Logged",
        value: `${heaviestWeight.weight} lb`,
        sub: `${heaviestWeight.name} • ${heaviestWeight.reps} reps`,
      });
    }

    if (highestRepSet) {
      cards.push({
        label: "Highest Rep Set",
        value: `${highestRepSet.reps}`,
        sub: `${highestRepSet.name} • ${highestRepSet.weight} lb`,
      });
    }

    return cards;
  }, [completedSets]);

  const mostUndertrainedBodyPart = useMemo(() => {
    if (bodyPartSummary.length < 2) return null;

    const sortedAsc = [...bodyPartSummary].sort((a, b) => a.sets - b.sets);
    const sortedDesc = [...bodyPartSummary].sort((a, b) => b.sets - a.sets);

    const lowest = sortedAsc[0];
    const highest = sortedDesc[0];

    if (!lowest || !highest) return null;

    return {
      lowest,
      highest,
      gap: highest.sets - lowest.sets,
    };
  }, [bodyPartSummary]);

  const aiHeadline = useMemo(() => {
    if (completedSets.length === 0) return "Build your first real training signal";

    if (daysSinceLastWorkout !== null && daysSinceLastWorkout >= 3) {
      return "You’re due for a productive session";
    }

    if (mostUndertrainedBodyPart && mostUndertrainedBodyPart.gap >= 6) {
      return `${mostUndertrainedBodyPart.lowest.bodyPart} should be your next focus`;
    }

    if (currentStreak >= 3 && volumeMomentum.deltaPct >= 0) {
      return "You’re building momentum";
    }

    if (volumeMomentum.deltaPct <= -15) {
      return "Your output dipped a bit this week";
    }

    return "Your training is stable right now";
  }, [
    completedSets.length,
    daysSinceLastWorkout,
    mostUndertrainedBodyPart,
    currentStreak,
    volumeMomentum.deltaPct,
  ]);

  const aiSummary = useMemo(() => {
    if (completedSets.length === 0) {
      return "Log a few complete workouts and ReSpawn will start reading your strength trends, consistency, and body-part balance automatically.";
    }

    if (daysSinceLastWorkout !== null && daysSinceLastWorkout >= 3) {
      return "You’ve had enough time away from training that today should be about restarting rhythm, not overthinking the perfect session.";
    }

    if (mostUndertrainedBodyPart && mostUndertrainedBodyPart.gap >= 6) {
      return `${mostUndertrainedBodyPart.lowest.bodyPart} is trailing ${mostUndertrainedBodyPart.highest.bodyPart} by ${mostUndertrainedBodyPart.gap} sets. A focused session there would rebalance your recent training.`;
    }

    if (currentStreak >= 3 && volumeMomentum.deltaPct >= 0) {
      return "Recent consistency and volume are both moving in the right direction. Keep stacking quality sessions instead of chasing random changes.";
    }

    if (volumeMomentum.deltaPct <= -15) {
      return `Your last 7 days are down ${Math.abs(
        volumeMomentum.deltaPct
      )}% versus the previous 7. One solid session gets momentum back fast.`;
    }

    return "You’re active, but the main opportunity now is to keep the next few workouts intentional and balanced.";
  }, [
    completedSets.length,
    daysSinceLastWorkout,
    mostUndertrainedBodyPart,
    currentStreak,
    volumeMomentum.deltaPct,
  ]);

  const nextTrainingTarget = useMemo(() => {
    if (completedSets.length === 0) {
      return {
        title: "Start your first session",
        detail: "Once you log complete workouts, ReSpawn will recommend your next training target automatically.",
        cta: "Go To Today",
      };
    }

    if (daysSinceLastWorkout !== null && daysSinceLastWorkout >= 3) {
      return {
        title: "Train today",
        detail: "You’ve had enough recovery time. A clean, simple session is the fastest way to rebuild momentum.",
        cta: "Start Workout",
      };
    }

    if (mostUndertrainedBodyPart && mostUndertrainedBodyPart.gap >= 6) {
      return {
        title: `Bring up ${mostUndertrainedBodyPart.lowest.bodyPart}`,
        detail: `${mostUndertrainedBodyPart.lowest.bodyPart} is under-emphasized compared with ${mostUndertrainedBodyPart.highest.bodyPart}. ReSpawn should bias your next workout there.`,
        cta: `Train ${mostUndertrainedBodyPart.lowest.bodyPart}`,
      };
    }

    if (repBias === "Strength") {
      return {
        title: "Keep building strength",
        detail: "Your recent work leans heavier and lower rep. Stay focused on strong compounds and clean progression.",
        cta: "Generate Next Session",
      };
    }

    if (repBias === "Hypertrophy") {
      return {
        title: "Keep building size",
        detail: "Your recent training is in the hypertrophy zone. Push quality volume and clean execution next session.",
        cta: "Generate Next Session",
      };
    }

    return {
      title: "Keep the plan moving",
      detail: "Your training split looks reasonably balanced right now. The win is simply getting the next session done.",
      cta: "Generate Next Session",
    };
  }, [completedSets.length, daysSinceLastWorkout, mostUndertrainedBodyPart, repBias]);

  const coachFeed = useMemo<CoachFeedItem[]>(() => {
    const items: CoachFeedItem[] = [];

    if (currentStreak > 0) {
      items.push({
        title: "Consistency",
        detail: `You are on a ${currentStreak}-day streak. Your best streak so far is ${bestStreak} days.`,
        tone: currentStreak >= 3 ? "good" : "neutral",
      });
    }

    if (volumeMomentum.deltaPct >= 10) {
      items.push({
        title: "Volume trend",
        detail: `Your last 7 days are up ${volumeMomentum.deltaPct}% versus the previous week.`,
        tone: "good",
      });
    } else if (volumeMomentum.deltaPct <= -15) {
      items.push({
        title: "Volume trend",
        detail: `Your last 7 days are down ${Math.abs(volumeMomentum.deltaPct)}% versus the previous week.`,
        tone: "warn",
      });
    }

    if (strongestEstimatedLift) {
      items.push({
        title: "Top lift",
        detail: `${strongestEstimatedLift.name} is currently your highest estimated strength expression at ${strongestEstimatedLift.e1rm}.`,
        tone: "neutral",
      });
    }

    if (bodyPartSummary[0]) {
      items.push({
        title: "Most emphasized area",
        detail: `${bodyPartSummary[0].bodyPart} currently leads your logged training volume.`,
        tone: "neutral",
      });
    }

    if (bodyPartSummary.length > 1) {
      const lowest = [...bodyPartSummary].sort((a, b) => a.sets - b.sets)[0];
      if (lowest) {
        items.push({
          title: "Opportunity",
          detail: `${lowest.bodyPart} is your least-emphasized area right now.`,
          tone: "neutral",
        });
      }
    }

    return items.slice(0, 4);
  }, [
    currentStreak,
    bestStreak,
    volumeMomentum.deltaPct,
    strongestEstimatedLift,
    bodyPartSummary,
  ]);

  const heatmapDays = useMemo(() => {
    const arr: { label: string; active: boolean; intense: boolean }[] = [];

    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const key = day.toISOString();
      const info = workoutDays.get(key);

      arr.push({
        label: day.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1),
        active: Boolean(info),
        intense: (info?.volume ?? 0) >= 8000,
      });
    }

    return arr;
  }, [today, workoutDays]);

  const displayName = profile?.name?.trim() || "Your";

  const primaryAction = () => {
    router.push("/Today");
  };

  const secondaryAction = () => {
    router.push("/Workout");
  };

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <p style={eyebrowStyle}>RESPAWN DASHBOARD</p>
          <h1 style={heroTitleStyle}>Loading your AI coach...</h1>
          <p style={heroSubStyle}>Pulling workouts, sets, strength trends, and training signals.</p>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <div style={heroTopRowStyle}>
          <div>
            <p style={eyebrowStyle}>RESPAWN DASHBOARD</p>
            <h1 style={heroTitleStyle}>{displayName}&apos;s AI Coach</h1>
            <p style={heroSubStyle}>
              ReSpawn turns your recent workouts into a clear read on strength, consistency,
              momentum, and what to train next.
            </p>
          </div>

          <button onClick={handleSignOut} style={ghostButtonStyle}>
            Sign Out
          </button>
        </div>

        <div style={heroInsightCardStyle}>
          <div style={heroInsightLabelStyle}>AI Coach Insight</div>
          <div style={heroInsightTitleStyle}>{aiHeadline}</div>
          <div style={heroInsightTextStyle}>{aiSummary}</div>

          <div style={heroActionRowStyle}>
            <button onClick={primaryAction} style={primaryButtonStyle}>
              {nextTrainingTarget.cta}
            </button>
            <button onClick={secondaryAction} style={secondaryButtonStyle}>
              View Workout Log
            </button>
          </div>
        </div>

        <div style={heroStatsGridStyle}>
          <div style={heroStatCardStyle}>
            <span style={heroStatLabelStyle}>Current Streak</span>
            <span style={heroStatValueStyle}>{currentStreak}d</span>
          </div>

          <div style={heroStatCardStyle}>
            <span style={heroStatLabelStyle}>Workouts This Week</span>
            <span style={heroStatValueStyle}>{workoutsThisWeek}</span>
          </div>

          <div style={heroStatCardStyle}>
            <span style={heroStatLabelStyle}>Strength Trend</span>
            <span style={heroStatValueStyle}>
              {liftInsights[0]
                ? `${liftInsights[0].trendPct >= 0 ? "+" : ""}${liftInsights[0].trendPct}%`
                : "--"}
            </span>
          </div>

          <div style={heroStatCardStyle}>
            <span style={heroStatLabelStyle}>Volume vs Last Week</span>
            <span style={heroStatValueStyle}>
              {volumeMomentum.deltaPct >= 0 ? "+" : ""}
              {volumeMomentum.deltaPct}%
            </span>
          </div>
        </div>
      </section>

      <section style={dashboardGridStyle}>
        <section style={{ ...cardStyle, ...spanTwoStyle }}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Strength Progress</h2>
            <span style={sectionBadgeStyle}>Your strongest signals</span>
          </div>

          {strengthCards.length > 0 ? (
            <div style={strengthGridStyle}>
              {strengthCards.map((card) => (
                <div key={card.label} style={strengthCardStyle}>
                  <div style={strengthCardLabelStyle}>{card.label}</div>
                  <div style={strengthCardValueStyle}>{card.value}</div>
                  <div style={strengthCardSubStyle}>{card.sub}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={mutedStyle}>
              Log a few real sets with weight and reps, and your strength dashboard will come alive.
            </p>
          )}
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Consistency</h2>
          </div>

          <div style={consistencyBlockStyle}>
            <div style={consistencyStatRowStyle}>
              <div style={miniMetricStyle}>
                <span style={miniMetricLabelStyle}>Current</span>
                <span style={miniMetricValueStyle}>{currentStreak}d</span>
              </div>
              <div style={miniMetricStyle}>
                <span style={miniMetricLabelStyle}>Best</span>
                <span style={miniMetricValueStyle}>{bestStreak}d</span>
              </div>
              <div style={miniMetricStyle}>
                <span style={miniMetricLabelStyle}>Avg Session</span>
                <span style={miniMetricValueStyle}>
                  {avgWorkoutDuration ? `${avgWorkoutDuration}m` : "--"}
                </span>
              </div>
            </div>

            <div style={heatmapGridStyle}>
              {heatmapDays.map((day, index) => (
                <div key={`${day.label}-${index}`} style={heatmapDayWrapStyle}>
                  <div
                    style={{
                      ...heatmapCellStyle,
                      background: !day.active ? "#1b1b1b" : day.intense ? "#ff5b5b" : "#2ecc71",
                    }}
                  />
                  <span style={heatmapLabelStyle}>{day.label}</span>
                </div>
              ))}
            </div>

            <p style={cardFootnoteStyle}>
              Green means you trained. Red means a higher-volume day.
            </p>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Next Training Target</h2>
          </div>

          <div style={nextTargetTitleStyle}>{nextTrainingTarget.title}</div>
          <div style={nextTargetTextStyle}>{nextTrainingTarget.detail}</div>

          <button onClick={primaryAction} style={smallPrimaryButtonStyle}>
            {nextTrainingTarget.cta}
          </button>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Performance Snapshot</h2>
          </div>

          <div style={statsGridStyle}>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Last 30 Days</span>
              <span style={miniStatValueStyle}>{workoutsLast30}</span>
            </div>

            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Sets This Week</span>
              <span style={miniStatValueStyle}>{totalSetsThisWeek}</span>
            </div>

            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Weekly Volume</span>
              <span style={miniStatValueStyleSmall}>
                {Math.round(totalVolumeThisWeek).toLocaleString()}
              </span>
            </div>

            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Unique Exercises</span>
              <span style={miniStatValueStyle}>{uniqueExercises}</span>
            </div>

            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Tracked Workouts</span>
              <span style={miniStatValueStyle}>{trainingWorkouts.length}</span>
            </div>

            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Rest Days Logged</span>
              <span style={miniStatValueStyle}>{restDays.length}</span>
            </div>

            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Lifetime Volume</span>
              <span style={miniStatValueStyleSmall}>{formatCompact(lifetimeVolume)}</span>
            </div>

            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Training Style</span>
              <span style={miniStatValueStyleSmall}>{repBias}</span>
            </div>
          </div>
        </section>

        <section style={{ ...cardStyle, ...spanTwoStyle }}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Lift Intelligence</h2>
            <span style={sectionBadgeStyle}>Repeated lifts only</span>
          </div>

          {liftInsights.length > 0 ? (
            <div style={liftGridStyle}>
              {liftInsights.map((lift) => (
                <div key={lift.name} style={liftCardStyle}>
                  <div style={liftTopRowStyle}>
                    <div>
                      <div style={liftNameStyle}>{lift.name}</div>
                      <div style={liftBodyPartStyle}>{lift.bodyPart}</div>
                    </div>

                    <div
                      style={{
                        ...trendPillStyle,
                        color: lift.trendPct >= 0 ? "#7CFFB2" : "#FFB1B1",
                      }}
                    >
                      {lift.trendPct >= 0 ? "+" : ""}
                      {lift.trendPct}%
                    </div>
                  </div>

                  <div style={liftBigStatStyle}>{lift.bestE1RM} est. 1RM</div>
                  <div style={liftSubLineStyle}>
                    Latest: {lift.lastWeight || "--"} × {lift.lastReps || "--"}
                  </div>
                  <div style={liftSubLineStyle}>Latest est. strength: {lift.latestE1RM}</div>
                  <div style={liftSubLineStyle}>{lift.timesLogged} logged sets</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={mutedStyle}>
              Repeat the same lifts a few times and ReSpawn will start showing meaningful trends here.
            </p>
          )}
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Coach Feed</h2>
          </div>

          {coachFeed.length > 0 ? (
            <div style={feedListStyle}>
              {coachFeed.map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  style={{
                    ...feedCardStyle,
                    border:
                      item.tone === "good"
                        ? "1px solid rgba(40, 199, 111, 0.22)"
                        : item.tone === "warn"
                        ? "1px solid rgba(255, 184, 0, 0.22)"
                        : "1px solid #252525",
                  }}
                >
                  <div style={feedTitleStyle}>{item.title}</div>
                  <div style={feedDetailStyle}>{item.detail}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={mutedStyle}>No coaching signals yet. Keep logging training.</p>
          )}
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Body Balance</h2>
          </div>

          {bodyPartSummary.length > 0 ? (
            <div style={bodyBalanceListStyle}>
              {bodyPartSummary.slice(0, 6).map((item) => {
                const maxSets = bodyPartSummary[0]?.sets || 1;
                const widthPct = Math.max(10, Math.round((item.sets / maxSets) * 100));

                return (
                  <div key={item.bodyPart} style={bodyBalanceRowStyle}>
                    <div style={bodyBalanceTopStyle}>
                      <span style={bodyPartNameStyle}>{item.bodyPart}</span>
                      <span style={bodyPartSubStyle}>
                        {item.sets} sets • {formatCompact(item.volume)} vol
                      </span>
                    </div>
                    <div style={barTrackStyle}>
                      <div style={{ ...barFillStyle, width: `${widthPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={mutedStyle}>No body-part balance data yet.</p>
          )}
        </section>
      </section>

      {status ? <p style={statusStyle}>{status}</p> : null}
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #050505 0%, #0a0a0a 42%, #111111 100%)",
  color: "#ffffff",
  padding: "24px 18px 120px",
  fontFamily: "sans-serif",
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

const heroStatsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "10px",
  marginTop: "18px",
};

const heroStatCardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "16px",
  padding: "14px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const heroStatLabelStyle: CSSProperties = {
  color: "#aaaaaa",
  fontSize: "12px",
};

const heroStatValueStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: 900,
};

const dashboardGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
};

const cardStyle: CSSProperties = {
  background: "#121212",
  border: "1px solid #222",
  borderRadius: "22px",
  padding: "20px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
};

const spanTwoStyle: CSSProperties = {
  gridColumn: "span 2",
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

const strengthGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const strengthCardStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,26,26,0.08), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "18px",
  padding: "16px",
};

const strengthCardLabelStyle: CSSProperties = {
  color: "#ff9b9b",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: "8px",
};

const strengthCardValueStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "30px",
  fontWeight: 900,
  lineHeight: 1.1,
};

const strengthCardSubStyle: CSSProperties = {
  color: "#bbbbbb",
  fontSize: "13px",
  lineHeight: 1.4,
  marginTop: "8px",
};

const consistencyBlockStyle: CSSProperties = {
  display: "grid",
  gap: "16px",
};

const consistencyStatRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "10px",
};

const miniMetricStyle: CSSProperties = {
  background: "#171717",
  border: "1px solid #252525",
  borderRadius: "14px",
  padding: "14px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const miniMetricLabelStyle: CSSProperties = {
  color: "#a9a9a9",
  fontSize: "12px",
};

const miniMetricValueStyle: CSSProperties = {
  color: "#ffffff",
  fontWeight: 900,
  fontSize: "18px",
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

const heatmapGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: "10px",
};

const heatmapDayWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "6px",
};

const heatmapCellStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "1 / 1",
  minHeight: "24px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.06)",
};

const heatmapLabelStyle: CSSProperties = {
  color: "#7f7f7f",
  fontSize: "11px",
  fontWeight: 700,
};

const cardFootnoteStyle: CSSProperties = {
  color: "#8d8d8d",
  fontSize: "12px",
  margin: 0,
};

const liftGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const liftCardStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,26,26,0.08), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "16px",
  padding: "16px",
};

const liftTopRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "10px",
  marginBottom: "10px",
};

const liftNameStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: 800,
};

const liftBodyPartStyle: CSSProperties = {
  color: "#a8a8a8",
  fontSize: "12px",
  marginTop: "4px",
};

const trendPillStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 900,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "999px",
  padding: "6px 10px",
  whiteSpace: "nowrap",
};

const liftBigStatStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: 900,
  marginBottom: "8px",
};

const liftSubLineStyle: CSSProperties = {
  color: "#c7c7c7",
  fontSize: "13px",
  marginTop: "6px",
};

const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
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

const feedListStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
};

const feedCardStyle: CSSProperties = {
  background: "#171717",
  borderRadius: "16px",
  padding: "14px",
};

const feedTitleStyle: CSSProperties = {
  color: "#ffffff",
  fontWeight: 800,
  fontSize: "15px",
};

const feedDetailStyle: CSSProperties = {
  color: "#bbbbbb",
  fontSize: "13px",
  marginTop: "6px",
  lineHeight: 1.45,
};

const bodyBalanceListStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
};

const bodyBalanceRowStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
};

const bodyBalanceTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
};

const bodyPartNameStyle: CSSProperties = {
  color: "#ffffff",
  fontWeight: 800,
  fontSize: "15px",
};

const bodyPartSubStyle: CSSProperties = {
  color: "#b8b8b8",
  fontSize: "13px",
};

const barTrackStyle: CSSProperties = {
  width: "100%",
  height: "10px",
  borderRadius: "999px",
  background: "#1c1c1c",
  overflow: "hidden",
  border: "1px solid #252525",
};

const barFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: "999px",
  background: "linear-gradient(90deg, #ff4d4d 0%, #ff8b8b 100%)",
};

const mutedStyle: CSSProperties = {
  color: "#a5a5a5",
  margin: "6px 0",
  lineHeight: 1.5,
};

const statusStyle: CSSProperties = {
  marginTop: "18px",
  color: "#cccccc",
};