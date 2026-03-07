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

type PersonalizedLiftCard = {
  name: string;
  bodyPart: string;
  timesLogged: number;
  bestSetWeight: number;
  bestSetReps: number;
  bestE1RM: number;
  lastWeight: number;
  lastReps: number;
  totalVolume: number;
};

type AuthUser = {
  id: string;
  email?: string;
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
    if (workoutsError) console.error("Workout load error:", workoutsError);
    if (setsError) console.error("Set load error:", setsError);

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

  const today = startOfDay(new Date());

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

  const restDaysThisWeek = useMemo(() => {
    return restDays.filter((w) => startOfDay(w.created_at) >= last7Start).length;
  }, [restDays, last7Start]);

  const workoutsLast30 = useMemo(() => {
    return trainingWorkouts.filter((w) => startOfDay(w.created_at) >= last30Start).length;
  }, [trainingWorkouts, last30Start]);

  const monthlyPace = useMemo(() => {
    const daysTracked = Math.max(
      1,
      Math.round((today.getTime() - last30Start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
    return Math.round((workoutsLast30 / daysTracked) * 30);
  }, [today, last30Start, workoutsLast30]);

  const avgWorkoutDuration = useMemo(() => {
    const durations = trainingWorkouts
      .map((w) => toNumber(w.duration_seconds))
      .filter((x) => x > 0);

    if (durations.length === 0) return 0;

    return Math.round(
      durations.reduce((sum, value) => sum + value, 0) / durations.length / 60
    );
  }, [trainingWorkouts]);

  const lastWorkout = useMemo(() => {
    return [...trainingWorkouts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0] ?? null;
  }, [trainingWorkouts]);

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

  const lifetimeSets = completedSets.length;

  const uniqueExercises = useMemo(() => {
    const unique = new Set(
      completedSets
        .map((set) => (set.exercise_name ?? "").trim())
        .filter(Boolean)
        .map((name) => name.toLowerCase())
    );
    return unique.size;
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

  const momentum = useMemo(() => {
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

    const volumeDeltaPct =
      prev7Volume > 0
        ? Math.round(((last7Volume - prev7Volume) / prev7Volume) * 100)
        : last7Volume > 0
        ? 100
        : 0;

    let mode = "Cold";
    if (last7Workouts.length >= 5 && volumeDeltaPct >= 10) mode = "Beast";
    else if (last7Workouts.length >= 4 || volumeDeltaPct >= 5) mode = "Strong";
    else if (last7Workouts.length >= 2) mode = "Building";

    return {
      mode,
      workouts: last7Workouts.length,
      volumeDeltaPct,
    };
  }, [trainingWorkouts, completedSets, last7Start, prev7Start, prev7End]);

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

  const personalizedMainLifts = useMemo<PersonalizedLiftCard[]>(() => {
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
        const sortedByDateDesc = [...item.sets].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        const bestSet = [...item.sets].sort((a, b) => {
          const aE1 = estimate1RM(toNumber(a.weight), toNumber(a.reps));
          const bE1 = estimate1RM(toNumber(b.weight), toNumber(b.reps));
          return bE1 - aE1;
        })[0];

        const lastSet = sortedByDateDesc[0];

        const totalVolume = item.sets.reduce(
          (sum, set) => sum + toNumber(set.weight) * toNumber(set.reps),
          0
        );

        return {
          name: item.name,
          bodyPart: item.bodyPart,
          timesLogged: item.sets.length,
          bestSetWeight: toNumber(bestSet?.weight),
          bestSetReps: toNumber(bestSet?.reps),
          bestE1RM: Math.round(
            estimate1RM(toNumber(bestSet?.weight), toNumber(bestSet?.reps))
          ),
          lastWeight: toNumber(lastSet?.weight),
          lastReps: toNumber(lastSet?.reps),
          totalVolume,
        };
      })
      .filter((item) => item.timesLogged >= 3)
      .sort((a, b) => b.timesLogged * 1000 + b.totalVolume - (a.timesLogged * 1000 + a.totalVolume))
      .slice(0, 4);
  }, [completedSets]);

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
      .sort((a, b) => b.volume - a.volume);
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

  const prFeed = useMemo(() => {
    const items: { title: string; detail: string; value: number }[] = [];

    const volumeByWorkout = trainingWorkouts.map((workout) => {
      const workoutVolume = completedSets
        .filter((set) => set.workout_id === workout.id)
        .reduce((sum, set) => sum + toNumber(set.weight) * toNumber(set.reps), 0);

      return {
        workoutName: workout.workout_name ?? "Workout",
        volume: workoutVolume,
      };
    });

    const bestVolumeWorkout = [...volumeByWorkout].sort((a, b) => b.volume - a.volume)[0];
    if (bestVolumeWorkout?.volume) {
      items.push({
        title: "🔥 Best Workout Volume",
        detail: `${bestVolumeWorkout.workoutName} • ${Math.round(bestVolumeWorkout.volume).toLocaleString()} total volume`,
        value: bestVolumeWorkout.volume,
      });
    }

    const topLift = personalizedMainLifts[0];
    if (topLift) {
      items.push({
        title: "🏆 Main Lift Leader",
        detail: `${topLift.name} • best ${topLift.bestSetWeight} × ${topLift.bestSetReps}`,
        value: topLift.bestE1RM,
      });
    }

    const fastestWorkout = trainingWorkouts
      .filter((w) => toNumber(w.duration_seconds) > 0)
      .sort((a, b) => toNumber(a.duration_seconds) - toNumber(b.duration_seconds))[0];

    if (fastestWorkout) {
      items.push({
        title: "⚡ Fastest Workout",
        detail: `${fastestWorkout.workout_name ?? "Workout"} • ${Math.round(
          toNumber(fastestWorkout.duration_seconds) / 60
        )} min`,
        value: 1,
      });
    }

    const strongestBodyPart = bodyPartSummary[0];
    if (strongestBodyPart) {
      items.push({
        title: "💪 Top Focus Area",
        detail: `${strongestBodyPart.bodyPart} • ${strongestBodyPart.sets} sets logged`,
        value: strongestBodyPart.volume,
      });
    }

    return items.slice(0, 4);
  }, [trainingWorkouts, completedSets, personalizedMainLifts, bodyPartSummary]);

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <p style={eyebrowStyle}>RESPAWN DASHBOARD</p>
          <h1 style={heroTitleStyle}>Loading dashboard...</h1>
          <p style={heroSubStyle}>Checking your session and loading your data.</p>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <p style={eyebrowStyle}>RESPAWN DASHBOARD</p>
        <h1 style={heroTitleStyle}>
          {profile?.name ? `${profile.name}'s Momentum` : "Your Momentum"}
        </h1>
        <p style={heroSubStyle}>
          Show up, build consistency, then let strength data stack over time.
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

        <div style={heroStatsRowStyle}>
          <div style={heroStatBoxStyle}>
            <span style={heroStatLabelStyle}>Workouts This Week</span>
            <span style={heroStatValueStyle}>{workoutsThisWeek}</span>
          </div>
          <div style={heroStatBoxStyle}>
            <span style={heroStatLabelStyle}>Current Streak</span>
            <span style={heroStatValueStyle}>{currentStreak}d</span>
          </div>
          <div style={heroStatBoxStyle}>
            <span style={heroStatLabelStyle}>Monthly Pace</span>
            <span style={heroStatValueStyle}>{monthlyPace}</span>
          </div>
          <div style={heroStatBoxStyle}>
            <span style={heroStatLabelStyle}>Rest Days This Week</span>
            <span style={heroStatValueStyle}>{restDaysThisWeek}</span>
          </div>
        </div>

        <p style={heroInsightStyle}>
          Momentum: <span style={heroInsightValueStyle}>{momentum.mode}</span>
          {" • "}
          {momentum.volumeDeltaPct >= 0 ? "+" : ""}
          {momentum.volumeDeltaPct}% volume vs last week
        </p>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Performance Snapshot</h2>
        </div>

        <div style={miniStatGridStyle}>
          <div style={miniStatBoxStyle}>
            <span style={miniStatLabelStyle}>Last 30 days</span>
            <span style={miniStatValueStyle}>{workoutsLast30}</span>
          </div>

          <div style={miniStatBoxStyle}>
            <span style={miniStatLabelStyle}>Avg workout</span>
            <span style={miniStatValueStyle}>
              {avgWorkoutDuration ? `${avgWorkoutDuration} min` : "--"}
            </span>
          </div>

          <div style={miniStatBoxStyle}>
            <span style={miniStatLabelStyle}>Lifetime sets</span>
            <span style={miniStatValueStyle}>{lifetimeSets}</span>
          </div>

          <div style={miniStatBoxStyle}>
            <span style={miniStatLabelStyle}>Unique exercises</span>
            <span style={miniStatValueStyle}>{uniqueExercises}</span>
          </div>
        </div>

        <div style={miniStatGridStyle}>
          <div style={miniStatBoxStyle}>
            <span style={miniStatLabelStyle}>Lifetime volume</span>
            <span style={miniStatValueStyleSmall}>
              {Math.round(lifetimeVolume).toLocaleString()}
            </span>
          </div>

          <div style={miniStatBoxStyle}>
            <span style={miniStatLabelStyle}>Strongest est. lift</span>
            <span style={miniStatValueStyleSmall}>
              {strongestEstimatedLift
                ? `${strongestEstimatedLift.name} • ${strongestEstimatedLift.e1rm}`
                : "No data yet"}
            </span>
          </div>

          <div style={miniStatBoxStyle}>
            <span style={miniStatLabelStyle}>Top body part</span>
            <span style={miniStatValueStyleSmall}>
              {bodyPartSummary[0]?.bodyPart ?? "No data yet"}
            </span>
          </div>

          <div style={miniStatBoxStyle}>
            <span style={miniStatLabelStyle}>Rep bias</span>
            <span style={miniStatValueStyleSmall}>{repBias}</span>
          </div>
        </div>

        <p style={cardFootnoteStyle}>
          This dashboard now prioritizes progress data over navigation shortcuts.
        </p>
      </section>

      <section style={twoColGridStyle}>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Consistency Engine</h2>
          </div>

          <div style={miniStatGridStyle}>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Best streak</span>
              <span style={miniStatValueStyle}>{bestStreak} days</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Avg session</span>
              <span style={miniStatValueStyle}>
                {avgWorkoutDuration ? `${avgWorkoutDuration} min` : "--"}
              </span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Last workout</span>
              <span style={miniStatValueStyleSmall}>
                {lastWorkout?.workout_name ?? "No data yet"}
              </span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Last 7 days</span>
              <span style={miniStatValueStyle}>{momentum.workouts} workouts</span>
            </div>
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
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Training Snapshot</h2>
          </div>

          <div style={miniStatGridStyle}>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Sets this week</span>
              <span style={miniStatValueStyle}>{totalSetsThisWeek}</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Volume this week</span>
              <span style={miniStatValueStyle}>
                {Math.round(totalVolumeThisWeek).toLocaleString()}
              </span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Rep bias</span>
              <span style={miniStatValueStyleSmall}>{repBias}</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Tracked workouts</span>
              <span style={miniStatValueStyle}>{trainingWorkouts.length}</span>
            </div>
          </div>

          <p style={cardFootnoteStyle}>
            The dashboard prioritizes consistency first, then personal lift trends once enough data exists.
          </p>
        </section>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Your Main Lifts</h2>
        </div>

        {personalizedMainLifts.length > 0 ? (
          <div style={personalizedLiftGridStyle}>
            {personalizedMainLifts.map((lift) => (
              <div key={lift.name} style={personalizedLiftCardStyle}>
                <div style={personalizedLiftTopRowStyle}>
                  <div>
                    <div style={personalizedLiftNameStyle}>{lift.name}</div>
                    <div style={personalizedLiftBodyPartStyle}>{lift.bodyPart}</div>
                  </div>
                  <div style={personalizedLiftCountStyle}>{lift.timesLogged} logs</div>
                </div>

                <div style={personalizedLiftBestStyle}>
                  Best: {lift.bestSetWeight || "--"} × {lift.bestSetReps || "--"}
                </div>
                <div style={personalizedLiftSubStyle}>
                  Last: {lift.lastWeight || "--"} × {lift.lastReps || "--"}
                </div>
                <div style={personalizedLiftSubStyle}>
                  Est. strength: {lift.bestE1RM || "--"}
                </div>
                <div style={personalizedLiftSubStyle}>
                  Total volume: {Math.round(lift.totalVolume).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={mutedStyle}>
            Log a few repeated lifts and this section will automatically swap in your actual main movements.
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
            <h2 style={sectionTitle}>PR Feed</h2>
          </div>

          {prFeed.length > 0 ? (
            <div style={feedListStyle}>
              {prFeed.map((item, index) => (
                <div key={`${item.title}-${index}`} style={feedCardStyle}>
                  <div style={feedTitleStyle}>{item.title}</div>
                  <div style={feedDetailStyle}>{item.detail}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={mutedStyle}>No highlights yet. Keep logging sessions.</p>
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
  background: "linear-gradient(135deg, rgba(255,26,26,0.16) 0%, rgba(18,18,18,1) 55%, rgba(10,10,10,1) 100%)",
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

const heroInsightStyle: CSSProperties = {
  color: "#efefef",
  fontSize: "14px",
  margin: "18px 0 0",
  fontWeight: 600,
};

const heroInsightValueStyle: CSSProperties = {
  color: "#ffffff",
  fontWeight: 900,
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

const personalizedLiftCountStyle: CSSProperties = {
  color: "#ff8b8b",
  fontSize: "12px",
  fontWeight: 800,
  whiteSpace: "nowrap",
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
  border: "1px solid #252525",
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