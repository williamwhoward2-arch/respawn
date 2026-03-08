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
  lastE1RM: number;
  trendPct: number;
  timesLogged: number;
  lastWeight: number;
  lastReps: number;
};

type BestLiftTile = {
  title: string;
  main: string;
  sub: string;
};

type CoachFeedItem = {
  title: string;
  detail: string;
  tone: "good" | "warn" | "neutral";
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

  const bodyPartSummary = useMemo(() => {
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
    if (completedSets.length === 0) return "Not enough data";

    const avgReps = Math.round(
      completedSets.reduce((sum, set) => sum + toNumber(set.reps), 0) / completedSets.length
    );

    if (avgReps <= 6) return "Strength biased";
    if (avgReps <= 12) return "Hypertrophy biased";
    return "High-rep endurance";
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

  const bestLiftTiles = useMemo<BestLiftTile[]>(() => {
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

    const tiles: BestLiftTile[] = [];

    if (strongestByE1RM) {
      tiles.push({
        title: "Best Strength Score",
        main: `${strongestByE1RM.e1rm}`,
        sub: `${strongestByE1RM.name} • ${strongestByE1RM.weight} × ${strongestByE1RM.reps}`,
      });
    }

    if (heaviestWeight) {
      tiles.push({
        title: "Most Weight Pushed",
        main: `${heaviestWeight.weight} lb`,
        sub: `${heaviestWeight.name} • ${heaviestWeight.reps} reps`,
      });
    }

    if (highestRepSet) {
      tiles.push({
        title: "Most Reps Completed",
        main: `${highestRepSet.reps}`,
        sub: `${highestRepSet.name} • ${highestRepSet.weight} lb`,
      });
    }

    return tiles;
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

        const lastE1RM = Math.round(
          estimate1RM(toNumber(last?.weight), toNumber(last?.reps))
        );

        const trendPct =
          firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;

        return {
          name: item.name,
          bodyPart: item.bodyPart,
          bestE1RM,
          lastE1RM,
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

  const overviewText = useMemo(() => {
    if (completedSets.length === 0) {
      return "This page turns your logged workouts into simple training signals so you can see strength, consistency, and momentum at a glance.";
    }

    if (currentStreak >= 3 && volumeMomentum.deltaPct >= 0) {
      return "You’re building momentum. This dashboard highlights how consistently you are training, where your strength is showing up, and what to focus on next.";
    }

    if (daysSinceLastWorkout !== null && daysSinceLastWorkout >= 3) {
      return "This dashboard shows where your training currently stands and makes it easy to see when it is time to get back in rhythm.";
    }

    return "This page gives you a quick read on your recent training, strongest lifts, and where your volume is leaning right now.";
  }, [completedSets.length, currentStreak, volumeMomentum.deltaPct, daysSinceLastWorkout]);

  const coachRecommendationText = useMemo(() => {
    if (completedSets.length === 0) return "Start Logging Workouts";

    if (daysSinceLastWorkout === null || daysSinceLastWorkout >= 3) {
      return "Train Today";
    }

    if (volumeMomentum.deltaPct <= -15) {
      return "Rebuild Momentum";
    }

    if (currentStreak >= 3 && volumeMomentum.deltaPct >= 0) {
      return "Keep Pushing";
    }

    return "Stay Consistent";
  }, [completedSets.length, daysSinceLastWorkout, currentStreak, volumeMomentum.deltaPct]);

  const coachReasonText = useMemo(() => {
    if (completedSets.length === 0) {
      return "Once you log full workouts, this dashboard starts showing real patterns in your training.";
    }

    if (daysSinceLastWorkout === null || daysSinceLastWorkout >= 3) {
      return "You have had a little space since your last session, so today is a good chance to get moving again.";
    }

    if (currentStreak >= 3 && volumeMomentum.deltaPct >= 0) {
      return "Your recent training has been steady, so the goal now is to keep stacking quality sessions.";
    }

    if (volumeMomentum.deltaPct <= -15) {
      return "Your recent output dipped a bit, so a solid session now helps restore rhythm fast.";
    }

    return "Your training looks fairly stable right now. Keep the next session simple and productive.";
  }, [completedSets.length, daysSinceLastWorkout, currentStreak, volumeMomentum.deltaPct]);

  const nextFocus = useMemo(() => {
    if (bodyPartSummary.length === 0) {
      return "Log a few more real sessions so your dashboard can start spotting patterns.";
    }

    const sorted = [...bodyPartSummary].sort((a, b) => a.sets - b.sets);
    const lowest = sorted[0];
    const highest = [...bodyPartSummary].sort((a, b) => b.sets - a.sets)[0];

    if (!lowest || !highest) {
      return "Keep building balanced training volume across your main movements.";
    }

    if (highest.sets - lowest.sets >= 8) {
      return `${lowest.bodyPart} is trailing behind ${highest.bodyPart}. Good opportunity to bring it up next.`;
    }

    return "Your body-part distribution looks pretty balanced right now. Keep stacking quality sessions.";
  }, [bodyPartSummary]);

  const coachFeed = useMemo<CoachFeedItem[]>(() => {
    const items: CoachFeedItem[] = [];

    items.push({
      title: "What you are looking at",
      detail:
        "This dashboard summarizes your recent training, strongest lifts, volume trends, and body-part emphasis.",
      tone: "neutral",
    });

    if (currentStreak >= 3) {
      items.push({
        title: "Consistency is building",
        detail: `You are on a ${currentStreak}-day streak. Protect the habit and let progress compound.`,
        tone: "good",
      });
    }

    if (volumeMomentum.deltaPct >= 10) {
      items.push({
        title: "Volume is climbing",
        detail: `Your last 7 days are up ${volumeMomentum.deltaPct}% compared to the previous 7.`,
        tone: "good",
      });
    } else if (volumeMomentum.deltaPct <= -15) {
      items.push({
        title: "Recent output dropped",
        detail: `Volume is down ${Math.abs(volumeMomentum.deltaPct)}% compared to the previous week.`,
        tone: "warn",
      });
    }

    if (repBias !== "Not enough data") {
      items.push({
        title: "Current training style",
        detail: `Your logged work is mostly ${repBias.toLowerCase()}.`,
        tone: "neutral",
      });
    }

    if (bodyPartSummary[0]) {
      items.push({
        title: "Most emphasized body part",
        detail: `${bodyPartSummary[0].bodyPart} is leading your training volume right now.`,
        tone: "neutral",
      });
    }

    return items.slice(0, 4);
  }, [currentStreak, volumeMomentum.deltaPct, repBias, bodyPartSummary]);

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

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <p style={eyebrowStyle}>RESPAWN DASHBOARD</p>
          <h1 style={heroTitleStyle}>Loading your dashboard...</h1>
          <p style={heroSubStyle}>Pulling your workouts, sets, and progress data.</p>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <div style={heroHeaderRowStyle}>
          <div>
            <p style={eyebrowStyle}>RESPAWN DASHBOARD</p>
            <h1 style={heroTitleStyle}>{displayName}&apos;s Training Dashboard</h1>
            <p style={heroSubStyle}>{overviewText}</p>
          </div>

          <button onClick={handleSignOut} style={ghostButtonStyle}>
            Sign Out
          </button>
        </div>

        <div style={coachCalloutStyle}>
          <div style={coachCalloutLabelStyle}>Today&apos;s focus</div>
          <div style={coachCalloutTextStyle}>{coachRecommendationText}</div>
          <div style={coachCalloutReasonStyle}>{coachReasonText}</div>
        </div>

        <div style={heroStatsRowStyle}>
          <div style={heroStatBoxStyle}>
            <span style={heroStatLabelStyle}>Current Streak</span>
            <span style={heroStatValueStyle}>{currentStreak}d</span>
          </div>

          <div style={heroStatBoxStyle}>
            <span style={heroStatLabelStyle}>Workouts This Week</span>
            <span style={heroStatValueStyle}>{workoutsThisWeek}</span>
          </div>

          <div style={heroStatBoxStyle}>
            <span style={heroStatLabelStyle}>Strongest Lift</span>
            <span style={heroStatValueStyleSmall}>
              {strongestEstimatedLift
                ? `${strongestEstimatedLift.name} • ${strongestEstimatedLift.e1rm}`
                : "No data yet"}
            </span>
          </div>

          <div style={heroStatBoxStyle}>
            <span style={heroStatLabelStyle}>Volume vs Last Week</span>
            <span style={heroStatValueStyle}>
              {volumeMomentum.deltaPct >= 0 ? "+" : ""}
              {volumeMomentum.deltaPct}%
            </span>
          </div>
        </div>
      </section>

      <section style={mainGridStyle}>
        <section style={{ ...cardStyle, ...featureCardStyle }}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Quick Read</h2>
          </div>

          <div style={featureTextStyle}>{coachRecommendationText}</div>
          <div style={featureSupportTextStyle}>{coachReasonText}</div>

          <div style={chipRowStyle}>
            <span style={metricChipStyle}>Best streak: {bestStreak}d</span>
            <span style={metricChipStyle}>
              Avg session: {avgWorkoutDuration ? `${avgWorkoutDuration}m` : "--"}
            </span>
            <span style={metricChipStyle}>
              Days since last: {daysSinceLastWorkout === null ? "--" : daysSinceLastWorkout}
            </span>
            <span style={metricChipStyle}>
              Style: {repBias === "Not enough data" ? "Learning" : repBias}
            </span>
          </div>

          <div style={subFeatureBoxStyle}>
            <div style={subFeatureLabelStyle}>Next focus</div>
            <div style={subFeatureTextStyle}>{nextFocus}</div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Last 7 Days</h2>
          </div>

          <div style={heatmapGridStyle}>
            {heatmapDays.map((day, index) => (
              <div key={`${day.label}-${index}`} style={heatmapDayWrapStyle}>
                <div
                  style={{
                    ...heatmapCellStyle,
                    background: !day.active ? "#1b1b1b" : day.intense ? "#ff5b5b" : "#33c46b",
                  }}
                />
                <span style={heatmapLabelStyle}>{day.label}</span>
              </div>
            ))}
          </div>

          <p style={cardFootnoteStyle}>
            Green means you trained. Red means a higher-volume day.
          </p>
        </section>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Best Lift Tiles</h2>
        </div>

        {bestLiftTiles.length > 0 ? (
          <div style={bestLiftGridStyle}>
            {bestLiftTiles.map((tile) => (
              <div key={tile.title} style={bestLiftCardStyle}>
                <div style={bestLiftTitleStyle}>{tile.title}</div>
                <div style={bestLiftMainStyle}>{tile.main}</div>
                <div style={bestLiftSubStyle}>{tile.sub}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={mutedStyle}>Log a few real sets and this section will fill in automatically.</p>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Main Lift Intelligence</h2>
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
                      color: lift.trendPct >= 0 ? "#7CFFB2" : "#FF9C9C",
                    }}
                  >
                    {lift.trendPct >= 0 ? "+" : ""}
                    {lift.trendPct}%
                  </div>
                </div>

                <div style={liftBigStatStyle}>{lift.bestE1RM} est. 1RM</div>
                <div style={liftSubLineStyle}>
                  Last set: {lift.lastWeight || "--"} × {lift.lastReps || "--"}
                </div>
                <div style={liftSubLineStyle}>Latest est. strength: {lift.lastE1RM}</div>
                <div style={liftSubLineStyle}>{lift.timesLogged} logged sets</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={mutedStyle}>
            Repeat the same lifts a few times and this section will turn into real progression coaching.
          </p>
        )}
      </section>

      <section style={twoColGridStyle}>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Performance Overview</h2>
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
              <span style={miniStatLabelStyle}>Volume This Week</span>
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
              <span style={miniStatValueStyleSmall}>
                {Math.round(lifetimeVolume).toLocaleString()}
              </span>
            </div>

            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Current Style</span>
              <span style={miniStatValueStyleSmall}>
                {repBias === "Not enough data" ? "Learning" : repBias}
              </span>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Coach Feed</h2>
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
            <p style={mutedStyle}>No coaching notes yet. Keep logging sessions.</p>
          )}
        </section>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Body Part Emphasis</h2>
        </div>

        {bodyPartSummary.length > 0 ? (
          <div style={bodyPartGridStyle}>
            {bodyPartSummary.slice(0, 6).map((item) => (
              <div key={item.bodyPart} style={bodyPartCardStyle}>
                <div style={bodyPartNameStyle}>{item.bodyPart}</div>
                <div style={bodyPartSubStyle}>{item.sets} sets</div>
                <div style={bodyPartSubStyle}>
                  {Math.round(item.volume).toLocaleString()} volume
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={mutedStyle}>No body-part data yet.</p>
        )}
      </section>

      {status ? <p style={statusStyle}>{status}</p> : null}
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #050505 0%, #0a0a0a 38%, #101010 100%)",
  color: "#ffffff",
  padding: "28px 20px 120px",
  fontFamily: "sans-serif",
};

const heroCardStyle: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(255,36,36,0.14) 0%, rgba(18,18,18,1) 54%, rgba(10,10,10,1) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "24px",
  padding: "24px",
  marginBottom: "18px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
};

const heroHeaderRowStyle: CSSProperties = {
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
  lineHeight: 1.05,
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
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "999px",
  padding: "10px 14px",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "13px",
};

const coachCalloutStyle: CSSProperties = {
  marginTop: "18px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "18px",
  padding: "16px",
};

const coachCalloutLabelStyle: CSSProperties = {
  color: "#ff9b9b",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: "8px",
};

const coachCalloutTextStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: 800,
  lineHeight: 1.45,
};

const coachCalloutReasonStyle: CSSProperties = {
  color: "#cfcfcf",
  fontSize: "14px",
  lineHeight: 1.45,
  marginTop: "8px",
};

const heroStatsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "10px",
  marginTop: "18px",
};

const heroStatBoxStyle: CSSProperties = {
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

const heroStatValueStyleSmall: CSSProperties = {
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 800,
  lineHeight: 1.35,
};

const mainGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
  marginBottom: "16px",
};

const twoColGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
  marginBottom: "16px",
};

const cardStyle: CSSProperties = {
  background: "#121212",
  border: "1px solid #222",
  borderRadius: "22px",
  padding: "20px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  marginBottom: "16px",
};

const featureCardStyle: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(255,26,26,0.08), rgba(255,255,255,0.02) 55%, rgba(255,255,255,0.01))",
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

const featureTextStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "24px",
  lineHeight: 1.3,
  fontWeight: 800,
};

const featureSupportTextStyle: CSSProperties = {
  color: "#cfcfcf",
  fontSize: "14px",
  lineHeight: 1.5,
  marginTop: "10px",
  fontWeight: 600,
};

const chipRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "14px",
};

const metricChipStyle: CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "999px",
  padding: "9px 12px",
  color: "#e8e8e8",
  fontSize: "12px",
  fontWeight: 700,
};

const subFeatureBoxStyle: CSSProperties = {
  marginTop: "16px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "16px",
  padding: "14px 16px",
};

const subFeatureLabelStyle: CSSProperties = {
  color: "#ff9b9b",
  fontSize: "11px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: "8px",
};

const subFeatureTextStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "15px",
  lineHeight: 1.45,
  fontWeight: 700,
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
  marginTop: "14px",
};

const bestLiftGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "12px",
};

const bestLiftCardStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,26,26,0.08), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "18px",
  padding: "16px",
};

const bestLiftTitleStyle: CSSProperties = {
  color: "#ff9b9b",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: "8px",
};

const bestLiftMainStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "30px",
  fontWeight: 900,
  lineHeight: 1.1,
};

const bestLiftSubStyle: CSSProperties = {
  color: "#bbbbbb",
  fontSize: "13px",
  marginTop: "8px",
  lineHeight: 1.4,
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
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
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

const bodyPartGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "10px",
};

const bodyPartCardStyle: CSSProperties = {
  background: "#171717",
  border: "1px solid #252525",
  borderRadius: "16px",
  padding: "14px",
};

const bodyPartNameStyle: CSSProperties = {
  color: "#ffffff",
  fontWeight: 800,
  fontSize: "15px",
};

const bodyPartSubStyle: CSSProperties = {
  color: "#b8b8b8",
  fontSize: "13px",
  marginTop: "6px",
};

const mutedStyle: CSSProperties = {
  color: "#a5a5a5",
  margin: "6px 0",
};

const statusStyle: CSSProperties = {
  marginTop: "18px",
  marginBottom: "18px",
  color: "#cccccc",
};