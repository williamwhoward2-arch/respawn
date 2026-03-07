"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id?: number;
  user_id?: string | null;
  name: string | null;
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
  created_at: string;
};

type AuthUser = {
  id: string;
  email?: string;
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

export default function DashboardPage() {
  const router = useRouter();

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
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
    setStatus("Checking account...");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      const message = userError.message || "";
      if (message.includes("Invalid Refresh Token")) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      console.error("Get user error:", userError);
      setStatus(`Error: ${message}`);
      setLoading(false);
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

    setStatus("Loading your dashboard...");

    const [
      { data: profileData, error: profileError },
      { data: workoutsData, error: workoutsError },
      { data: setsData, error: setsError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, user_id, name")
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
      last7Workouts: last7Workouts.length,
    };
  }, [trainingWorkouts, completedSets, last7Start, prev7Start, prev7End]);

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
        const firstHalf = sorted.slice(0, Math.max(1, Math.floor(sorted.length / 2)));
        const secondHalf = sorted.slice(Math.max(1, Math.floor(sorted.length / 2)));

        const firstAvg =
          firstHalf.reduce(
            (sum, set) => sum + estimate1RM(toNumber(set.weight), toNumber(set.reps)),
            0
          ) / firstHalf.length;

        const secondAvg =
          secondHalf.reduce(
            (sum, set) => sum + estimate1RM(toNumber(set.weight), toNumber(set.reps)),
            0
          ) / secondHalf.length;

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

  const readinessScore = useMemo(() => {
    let score = 72;

    if (daysSinceLastWorkout === null) score = 60;
    else if (daysSinceLastWorkout === 0) score -= 12;
    else if (daysSinceLastWorkout === 1) score += 10;
    else if (daysSinceLastWorkout === 2) score += 6;
    else if (daysSinceLastWorkout >= 4) score -= 8;

    if (workoutsThisWeek >= 5) score -= 6;
    else if (workoutsThisWeek >= 3) score += 6;
    else if (workoutsThisWeek === 0) score -= 10;

    if (volumeMomentum.deltaPct >= 10) score += 5;
    if (volumeMomentum.deltaPct <= -15) score -= 8;

    return Math.max(1, Math.min(100, score));
  }, [daysSinceLastWorkout, workoutsThisWeek, volumeMomentum.deltaPct]);

  const coachStatus = useMemo(() => {
    if (completedSets.length === 0) {
      return {
        label: "No baseline yet",
        tone: "neutral",
        summary: "Log a few real workouts and your coach will start learning your training patterns.",
      };
    }

    if (readinessScore >= 82) {
      return {
        label: "Primed",
        tone: "good",
        summary: "You look ready to push. Recovery and recent momentum suggest a high-output day.",
      };
    }

    if (readinessScore >= 68) {
      return {
        label: "Ready",
        tone: "good",
        summary: "You are in a solid training position. Good day for normal volume or a controlled progression.",
      };
    }

    if (readinessScore >= 50) {
      return {
        label: "Caution",
        tone: "warn",
        summary: "You can train today, but recovery and recent strain suggest being selective with intensity.",
      };
    }

    return {
      label: "Recover",
      tone: "bad",
      summary: "Your trend data suggests backing off today or using an easier session to stay consistent.",
    };
  }, [completedSets.length, readinessScore]);

  const recommendedAction = useMemo(() => {
    if (completedSets.length === 0) {
      return "Start with a simple full-body session and log every set so the coach can build your baseline.";
    }

    if (daysSinceLastWorkout === null || daysSinceLastWorkout >= 3) {
      return "Train today. Priority is re-establishing rhythm and getting quality volume in.";
    }

    if (readinessScore >= 80) {
      return "Push one main lift today. Aim to beat your last top set by weight, reps, or cleaner execution.";
    }

    if (readinessScore >= 60) {
      return "Train normally today. Focus on one primary movement and keep accessory work crisp.";
    }

    return "Take a lighter day or active recovery. Keep momentum without digging a deeper recovery hole.";
  }, [completedSets.length, daysSinceLastWorkout, readinessScore]);

  const nextFocus = useMemo(() => {
    if (bodyPartSummary.length === 0) {
      return "Build balanced volume across your main muscle groups.";
    }

    const sorted = [...bodyPartSummary].sort((a, b) => a.sets - b.sets);
    const lowest = sorted[0];
    const highest = [...bodyPartSummary].sort((a, b) => b.sets - a.sets)[0];

    if (!lowest || !highest) {
      return "Keep building balanced volume.";
    }

    if (highest.sets - lowest.sets >= 8) {
      return `${lowest.bodyPart} is underfed versus ${highest.bodyPart}. Good chance to bring it up next.`;
    }

    return "Your body-part distribution looks fairly balanced right now.";
  }, [bodyPartSummary]);

  const coachFeed = useMemo(() => {
    const items: { title: string; detail: string; tone: "good" | "warn" | "neutral" }[] = [];

    if (currentStreak >= 3) {
      items.push({
        title: "Consistency is compounding",
        detail: `You are on a ${currentStreak}-day streak. Protect the habit first, then chase performance.`,
        tone: "good",
      });
    } else if (daysSinceLastWorkout !== null && daysSinceLastWorkout >= 3) {
      items.push({
        title: "Momentum slipped",
        detail: `It has been ${daysSinceLastWorkout} days since your last workout. A simple session today resets the trend.`,
        tone: "warn",
      });
    }

    if (volumeMomentum.deltaPct >= 10) {
      items.push({
        title: "Training load is up",
        detail: `Your last 7 days are up ${volumeMomentum.deltaPct}% in volume versus the prior 7.`,
        tone: "good",
      });
    } else if (volumeMomentum.deltaPct <= -15) {
      items.push({
        title: "Training load dropped",
        detail: `Volume is down ${Math.abs(volumeMomentum.deltaPct)}% versus last week. Could be recovery, or you may be drifting.`,
        tone: "warn",
      });
    }

    if (repBias !== "Not enough data") {
      items.push({
        title: "Current training style",
        detail: `Your logged work is ${repBias.toLowerCase()}.`,
        tone: "neutral",
      });
    }

    if (bodyPartSummary[0]) {
      items.push({
        title: "Most emphasized area",
        detail: `${bodyPartSummary[0].bodyPart} currently leads your training volume.`,
        tone: "neutral",
      });
    }

    return items.slice(0, 4);
  }, [currentStreak, daysSinceLastWorkout, volumeMomentum.deltaPct, repBias, bodyPartSummary]);

  const heatmapDays = useMemo(() => {
    const arr: { label: string; active: boolean; intense: boolean }[] = [];

    for (let i = 13; i >= 0; i -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
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

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <p style={eyebrowStyle}>AI COACH</p>
          <h1 style={heroTitleStyle}>Loading your dashboard...</h1>
          <p style={heroSubStyle}>Pulling your workouts, sets, and trend data.</p>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <div style={heroTopRowStyle}>
          <div>
            <p style={eyebrowStyle}>RESPAWN AI COACH</p>
            <h1 style={heroTitleStyle}>
              {profile?.name ? `${profile.name}, here’s your coaching read` : "Here’s your coaching read"}
            </h1>
            <p style={heroSubStyle}>{coachStatus.summary}</p>
          </div>

          <div
            style={{
              ...statusPillStyle,
              background:
                coachStatus.tone === "good"
                  ? "rgba(40, 199, 111, 0.15)"
                  : coachStatus.tone === "warn"
                  ? "rgba(255, 184, 0, 0.15)"
                  : coachStatus.tone === "bad"
                  ? "rgba(255, 77, 77, 0.15)"
                  : "rgba(255,255,255,0.08)",
              borderColor:
                coachStatus.tone === "good"
                  ? "rgba(40, 199, 111, 0.35)"
                  : coachStatus.tone === "warn"
                  ? "rgba(255, 184, 0, 0.35)"
                  : coachStatus.tone === "bad"
                  ? "rgba(255, 77, 77, 0.35)"
                  : "rgba(255,255,255,0.12)",
            }}
          >
            {coachStatus.label}
          </div>
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

        <div style={heroStatsRowStyle}>
          <div style={heroStatBoxStyle}>
            <span style={heroStatLabelStyle}>Readiness</span>
            <span style={heroStatValueStyle}>{readinessScore}</span>
          </div>
          <div style={heroStatBoxStyle}>
            <span style={heroStatLabelStyle}>Current Streak</span>
            <span style={heroStatValueStyle}>{currentStreak}d</span>
          </div>
          <div style={heroStatBoxStyle}>
            <span style={heroStatLabelStyle}>Workouts This Week</span>
            <span style={heroStatValueStyle}>{workoutsThisWeek}</span>
          </div>
          <div style={heroStatBoxStyle}>
            <span style={heroStatLabelStyle}>Volume vs Last Week</span>
            <span style={heroStatValueStyle}>
              {volumeMomentum.deltaPct >= 0 ? "+" : ""}
              {volumeMomentum.deltaPct}%
            </span>
          </div>
        </div>

        <div style={coachCalloutStyle}>
          <div style={coachCalloutLabelStyle}>Coach recommendation</div>
          <div style={coachCalloutTextStyle}>{recommendedAction}</div>
        </div>
      </section>

      <section style={twoColGridStyle}>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Today’s Signals</h2>
          </div>

          <div style={miniStatGridStyle}>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Days since last workout</span>
              <span style={miniStatValueStyle}>
                {daysSinceLastWorkout === null ? "--" : daysSinceLastWorkout}
              </span>
            </div>

            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Best streak</span>
              <span style={miniStatValueStyle}>{bestStreak}d</span>
            </div>

            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Avg session</span>
              <span style={miniStatValueStyle}>
                {avgWorkoutDuration ? `${avgWorkoutDuration}m` : "--"}
              </span>
            </div>

            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Training style</span>
              <span style={miniStatValueStyleSmall}>{repBias}</span>
            </div>
          </div>

          <div style={insightCardStyle}>
            <div style={insightTitleStyle}>Focus area</div>
            <div style={insightBodyStyle}>{nextFocus}</div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Consistency Map</h2>
          </div>

          <div style={heatmapGridStyle}>
            {heatmapDays.map((day, index) => (
              <div key={`${day.label}-${index}`} style={heatmapDayWrapStyle}>
                <div
                  style={{
                    ...heatmapCellStyle,
                    background: !day.active ? "#1b1b1b" : day.intense ? "#ff4d4d" : "#4caf50",
                  }}
                />
                <span style={heatmapLabelStyle}>{day.label}</span>
              </div>
            ))}
          </div>

          <p style={cardFootnoteStyle}>
            Green means you trained. Red means especially high-output volume.
          </p>
        </section>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Performance Overview</h2>
        </div>

        <div style={statsGridFourStyle}>
          <div style={miniStatBoxStyle}>
            <span style={miniStatLabelStyle}>Last 30 days</span>
            <span style={miniStatValueStyle}>{workoutsLast30}</span>
          </div>

          <div style={miniStatBoxStyle}>
            <span style={miniStatLabelStyle}>Sets this week</span>
            <span style={miniStatValueStyle}>{totalSetsThisWeek}</span>
          </div>

          <div style={miniStatBoxStyle}>
            <span style={miniStatLabelStyle}>Volume this week</span>
            <span style={miniStatValueStyleSmall}>
              {Math.round(totalVolumeThisWeek).toLocaleString()}
            </span>
          </div>

          <div style={miniStatBoxStyle}>
            <span style={miniStatLabelStyle}>Unique exercises</span>
            <span style={miniStatValueStyle}>{uniqueExercises}</span>
          </div>

          <div style={miniStatBoxStyle}>
            <span style={miniStatLabelStyle}>Lifetime volume</span>
            <span style={miniStatValueStyleSmall}>
              {Math.round(lifetimeVolume).toLocaleString()}
            </span>
          </div>

          <div style={miniStatBoxStyle}>
            <span style={miniStatLabelStyle}>Tracked workouts</span>
            <span style={miniStatValueStyle}>{trainingWorkouts.length}</span>
          </div>

          <div style={miniStatBoxStyle}>
            <span style={miniStatLabelStyle}>Rest days logged</span>
            <span style={miniStatValueStyle}>{restDays.length}</span>
          </div>

          <div style={miniStatBoxStyle}>
            <span style={miniStatLabelStyle}>Strongest estimated lift</span>
            <span style={miniStatValueStyleSmall}>
              {strongestEstimatedLift
                ? `${strongestEstimatedLift.name} • ${strongestEstimatedLift.e1rm}`
                : "No data yet"}
            </span>
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Main Lift Intelligence</h2>
        </div>

        {liftInsights.length > 0 ? (
          <div style={personalizedLiftGridStyle}>
            {liftInsights.map((lift) => (
              <div key={lift.name} style={personalizedLiftCardStyle}>
                <div style={personalizedLiftTopRowStyle}>
                  <div>
                    <div style={personalizedLiftNameStyle}>{lift.name}</div>
                    <div style={personalizedLiftBodyPartStyle}>{lift.bodyPart}</div>
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

                <div style={personalizedLiftBestStyle}>{lift.bestE1RM} est. 1RM</div>
                <div style={personalizedLiftSubStyle}>
                  Last set: {lift.lastWeight || "--"} × {lift.lastReps || "--"}
                </div>
                <div style={personalizedLiftSubStyle}>Latest est. strength: {lift.lastE1RM}</div>
                <div style={personalizedLiftSubStyle}>{lift.timesLogged} logged sets</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={mutedStyle}>
            Log repeated lifts at least a few times and this section will turn into progression coaching.
          </p>
        )}
      </section>

      <section style={twoColGridStyle}>
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
                        ? "1px solid rgba(40, 199, 111, 0.25)"
                        : item.tone === "warn"
                        ? "1px solid rgba(255, 184, 0, 0.25)"
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

      {status && <p style={statusStyle}>{status}</p>}
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
    "linear-gradient(135deg, rgba(255,26,26,0.16) 0%, rgba(18,18,18,1) 55%, rgba(10,10,10,1) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "24px",
  padding: "24px",
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
  maxWidth: "720px",
};

const statusPillStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: "999px",
  fontSize: "13px",
  fontWeight: 800,
  border: "1px solid rgba(255,255,255,0.12)",
};

const accountBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginTop: "18px",
  marginBottom: "8px",
  flexWrap: "wrap",
};

const accountInfoStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const accountLabelStyle: CSSProperties = {
  color: "#a9a9a9",
  fontSize: "12px",
};

const accountValueStyle: CSSProperties = {
  color: "#ffffff",
  fontWeight: 700,
  fontSize: "14px",
};

const heroStatsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "10px",
  marginTop: "20px",
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
  fontWeight: 700,
  lineHeight: 1.4,
};

const cardStyle: CSSProperties = {
  background: "#121212",
  border: "1px solid #222",
  borderRadius: "22px",
  padding: "20px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  marginBottom: "16px",
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

const twoColGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
};

const statsGridFourStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "10px",
};

const miniStatGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
  marginBottom: "18px",
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
  color: "#fff",
  fontWeight: 900,
  fontSize: "18px",
};

const miniStatValueStyleSmall: CSSProperties = {
  color: "#fff",
  fontWeight: 800,
  fontSize: "14px",
  lineHeight: 1.35,
};

const insightCardStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,26,26,0.08), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "16px",
  padding: "16px",
};

const insightTitleStyle: CSSProperties = {
  color: "#ff8b8b",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: "8px",
};

const insightBodyStyle: CSSProperties = {
  color: "#fff",
  fontSize: "15px",
  fontWeight: 700,
  lineHeight: 1.45,
};

const heatmapGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(14, minmax(0, 1fr))",
  gap: "8px",
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
  minHeight: "18px",
  borderRadius: "8px",
  border: "1px solid rgba(255,255,255,0.06)",
};

const heatmapLabelStyle: CSSProperties = {
  color: "#7f7f7f",
  fontSize: "10px",
};

const personalizedLiftGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const personalizedLiftCardStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,26,26,0.08), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "16px",
  padding: "16px",
};

const personalizedLiftTopRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "10px",
  marginBottom: "10px",
};

const personalizedLiftNameStyle: CSSProperties = {
  color: "#fff",
  fontSize: "16px",
  fontWeight: 800,
};

const personalizedLiftBodyPartStyle: CSSProperties = {
  color: "#a8a8a8",
  fontSize: "12px",
  marginTop: "4px",
};

const personalizedLiftBestStyle: CSSProperties = {
  color: "#fff",
  fontSize: "20px",
  fontWeight: 900,
  marginBottom: "8px",
};

const personalizedLiftSubStyle: CSSProperties = {
  color: "#c7c7c7",
  fontSize: "13px",
  marginTop: "6px",
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
  color: "#fff",
  fontWeight: 800,
  fontSize: "15px",
};

const bodyPartSubStyle: CSSProperties = {
  color: "#b8b8b8",
  fontSize: "13px",
  marginTop: "6px",
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
  color: "#fff",
  fontWeight: 800,
  fontSize: "15px",
};

const feedDetailStyle: CSSProperties = {
  color: "#bbbbbb",
  fontSize: "13px",
  marginTop: "6px",
  lineHeight: 1.45,
};

const cardFootnoteStyle: CSSProperties = {
  color: "#8d8d8d",
  fontSize: "12px",
  marginTop: "14px",
};

const mutedStyle: CSSProperties = {
  color: "#a5a5a5",
  margin: "6px 0",
};

const secondaryButtonStyle: CSSProperties = {
  backgroundColor: "#222",
  border: "1px solid #333",
  padding: "12px 16px",
  borderRadius: "10px",
  color: "white",
  fontWeight: 700,
  fontSize: "14px",
  cursor: "pointer",
};

const statusStyle: CSSProperties = {
  marginTop: "18px",
  marginBottom: "18px",
  color: "#cccccc",
};