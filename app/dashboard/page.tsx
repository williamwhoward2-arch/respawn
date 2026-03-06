"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  name: string | null;
};

type Workout = {
  id: number;
  workout_name: string | null;
  created_at: string;
  duration_seconds?: number | null;
};

type WorkoutSet = {
  id: number;
  workout_id: number;
  exercise_name: string | null;
  set_number: number | null;
  weight: string | null;
  reps: string | null;
  body_part?: string | null;
  created_at: string;
};

type LiftKey = "bench" | "squat" | "deadlift" | "ohp";

type LiftSnapshot = {
  key: LiftKey;
  label: string;
  current: number;
  average: number;
  percentile: number;
};

type PrFeedItem = {
  title: string;
  detail: string;
  value: number;
};

const LIFT_META: Record<
  LiftKey,
  {
    label: string;
    exerciseNames: string[];
    average: number;
    strongestVersion: number;
  }
> = {
  bench: {
    label: "Bench",
    exerciseNames: ["Bench Press", "Dumbbell Bench Press", "Incline Bench Press"],
    average: 185,
    strongestVersion: 365,
  },
  squat: {
    label: "Squat",
    exerciseNames: ["Back Squat", "Squat", "Front Squat"],
    average: 225,
    strongestVersion: 405,
  },
  deadlift: {
    label: "Deadlift",
    exerciseNames: ["Deadlift"],
    average: 275,
    strongestVersion: 495,
  },
  ohp: {
    label: "OHP",
    exerciseNames: ["Overhead Press", "Seated Dumbbell Press"],
    average: 115,
    strongestVersion: 185,
  },
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);

    const [
      { data: profileData, error: profileError },
      { data: workoutsData, error: workoutsError },
      { data: setsData, error: setsError },
    ] = await Promise.all([
      supabase.from("profiles").select("name").maybeSingle(),
      supabase.from("workouts").select("*").order("created_at", { ascending: false }),
      supabase.from("workout_sets").select("*").order("created_at", { ascending: false }),
    ]);

    if (profileError) {
      console.error("Profile load error:", {
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        code: profileError.code,
      });
    }

    if (workoutsError) {
      console.error("Workout load error:", {
        message: workoutsError.message,
        details: workoutsError.details,
        hint: workoutsError.hint,
        code: workoutsError.code,
      });
    }

    if (setsError) {
      console.error("Set load error:", {
        message: setsError.message,
        details: setsError.details,
        hint: setsError.hint,
        code: setsError.code,
      });
    }

    setProfile((profileData as Profile) ?? null);
    setWorkouts((workoutsData as Workout[]) ?? []);
    setSets((setsData as WorkoutSet[]) ?? []);
    setLoading(false);
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

  function percentileFromRatio(current: number, average: number) {
    if (!current || !average) return 50;
    const ratio = current / average;

    if (ratio >= 1.9) return 97;
    if (ratio >= 1.7) return 94;
    if (ratio >= 1.5) return 90;
    if (ratio >= 1.35) return 84;
    if (ratio >= 1.2) return 76;
    if (ratio >= 1.1) return 66;
    if (ratio >= 1.0) return 55;
    if (ratio >= 0.9) return 45;
    if (ratio >= 0.8) return 35;
    return 25;
  }

  function getTopPercentLabel(percentile: number) {
    return `Top ${Math.max(1, 100 - percentile)}%`;
  }

  function normalizeStrengthScore(rawScore: number) {
    return Math.max(0, Math.min(1000, Math.round(rawScore)));
  }

  const workoutsById = useMemo(() => {
    const map = new Map<number, Workout>();
    for (const workout of workouts) {
      map.set(workout.id, workout);
    }
    return map;
  }, [workouts]);

  const completedSets = useMemo(() => {
    return sets.filter((set) => {
      const weight = toNumber(set.weight);
      const reps = toNumber(set.reps);
      return weight > 0 && reps > 0;
    });
  }, [sets]);

  const liftHistories = useMemo(() => {
    const history: Record<LiftKey, { date: string; e1rm: number }[]> = {
      bench: [],
      squat: [],
      deadlift: [],
      ohp: [],
    };

    (Object.keys(LIFT_META) as LiftKey[]).forEach((liftKey) => {
      const meta = LIFT_META[liftKey];
      const relevantSets = completedSets.filter((set) =>
        meta.exerciseNames.includes(set.exercise_name ?? "")
      );

      const bestByWorkout = new Map<number, number>();

      for (const set of relevantSets) {
        const e1rm = estimate1RM(toNumber(set.weight), toNumber(set.reps));
        const currentBest = bestByWorkout.get(set.workout_id) ?? 0;
        if (e1rm > currentBest) {
          bestByWorkout.set(set.workout_id, e1rm);
        }
      }

      const points = Array.from(bestByWorkout.entries())
        .map(([workoutId, e1rm]) => ({
          date: workoutsById.get(workoutId)?.created_at ?? new Date().toISOString(),
          e1rm,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      history[liftKey] = points;
    });

    return history;
  }, [completedSets, workoutsById]);

  const bestLiftValues = useMemo(() => {
    const result: Record<LiftKey, number> = {
      bench: 0,
      squat: 0,
      deadlift: 0,
      ohp: 0,
    };

    (Object.keys(LIFT_META) as LiftKey[]).forEach((key) => {
      result[key] = Math.max(0, ...liftHistories[key].map((x) => x.e1rm));
    });

    return result;
  }, [liftHistories]);

  const bodyweight = 205;
  const age = 36;

  const strengthIndex = useMemo(() => {
    const raw =
      (bestLiftValues.bench * 1.2 +
        bestLiftValues.squat * 1.3 +
        bestLiftValues.deadlift * 1.5 +
        bestLiftValues.ohp * 1.0) /
      Math.max(1, bodyweight * 0.02);

    return normalizeStrengthScore(raw);
  }, [bestLiftValues, bodyweight]);

  const strengthIndexWeeklyChange = useMemo(() => {
    const today = startOfDay(new Date());
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const recentWorkoutIds = new Set(
      workouts
        .filter((w) => new Date(w.created_at) >= sevenDaysAgo)
        .map((w) => w.id)
    );

    const oldWorkoutIds = new Set(
      workouts
        .filter((w) => new Date(w.created_at) < sevenDaysAgo)
        .map((w) => w.id)
    );

    function bestForRange(liftKey: LiftKey, workoutIds: Set<number>) {
      const meta = LIFT_META[liftKey];
      const relevantSets = completedSets.filter(
        (set) =>
          workoutIds.has(set.workout_id) &&
          meta.exerciseNames.includes(set.exercise_name ?? "")
      );

      return Math.max(
        0,
        ...relevantSets.map((set) =>
          estimate1RM(toNumber(set.weight), toNumber(set.reps))
        )
      );
    }

    const recentScore = normalizeStrengthScore(
      (bestForRange("bench", recentWorkoutIds) * 1.2 +
        bestForRange("squat", recentWorkoutIds) * 1.3 +
        bestForRange("deadlift", recentWorkoutIds) * 1.5 +
        bestForRange("ohp", recentWorkoutIds) * 1.0) /
        Math.max(1, bodyweight * 0.02)
    );

    const priorScore = normalizeStrengthScore(
      (bestForRange("bench", oldWorkoutIds) * 1.2 +
        bestForRange("squat", oldWorkoutIds) * 1.3 +
        bestForRange("deadlift", oldWorkoutIds) * 1.5 +
        bestForRange("ohp", oldWorkoutIds) * 1.0) /
        Math.max(1, bodyweight * 0.02)
    );

    if (!recentScore) return 0;
    return recentScore - priorScore;
  }, [workouts, completedSets, bodyweight]);

  const liftSnapshots = useMemo<LiftSnapshot[]>(() => {
    return (Object.keys(LIFT_META) as LiftKey[]).map((key) => {
      const current = Math.round(bestLiftValues[key]);
      const average = LIFT_META[key].average;
      const percentile = percentileFromRatio(current, average);

      return {
        key,
        label: LIFT_META[key].label,
        current,
        average,
        percentile,
      };
    });
  }, [bestLiftValues]);

  const overallPercentile = useMemo(() => {
    const valid = liftSnapshots.filter((x) => x.current > 0);
    if (valid.length === 0) return 50;
    return Math.round(
      valid.reduce((sum, item) => sum + item.percentile, 0) / valid.length
    );
  }, [liftSnapshots]);

  const strongestVersionRows = useMemo(() => {
    return (Object.keys(LIFT_META) as LiftKey[]).map((key) => ({
      label: LIFT_META[key].label,
      current: Math.round(bestLiftValues[key]),
      target: LIFT_META[key].strongestVersion,
    }));
  }, [bestLiftValues]);

  const workoutDays = useMemo(() => {
    const map = new Map<string, { count: number; volume: number }>();

    for (const workout of workouts) {
      const key = startOfDay(workout.created_at).toISOString();
      if (!map.has(key)) {
        map.set(key, { count: 0, volume: 0 });
      }
      map.get(key)!.count += 1;
    }

    for (const set of completedSets) {
      const workout = workoutsById.get(set.workout_id);
      if (!workout) continue;
      const key = startOfDay(workout.created_at).toISOString();
      const volume = toNumber(set.weight) * toNumber(set.reps);

      if (!map.has(key)) {
        map.set(key, { count: 0, volume: 0 });
      }

      map.get(key)!.volume += volume;
    }

    return map;
  }, [workouts, completedSets, workoutsById]);

  const currentStreak = useMemo(() => {
    if (workoutDays.size === 0) return 0;

    let streak = 0;
    const today = startOfDay(new Date());

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
  }, [workoutDays]);

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
      const diff =
        (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

      if (diff === 1) {
        current += 1;
        best = Math.max(best, current);
      } else {
        current = 1;
      }
    }

    return best;
  }, [workoutDays]);

  const heatmapDays = useMemo(() => {
    const today = startOfDay(new Date());
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
  }, [workoutDays]);

  const prFeed = useMemo<PrFeedItem[]>(() => {
    const items: PrFeedItem[] = [];

    (Object.keys(LIFT_META) as LiftKey[]).forEach((key) => {
      const history = liftHistories[key];
      if (history.length < 2) return;

      const sorted = [...history].sort((a, b) => b.e1rm - a.e1rm);
      const best = sorted[0]?.e1rm ?? 0;
      const second = sorted[1]?.e1rm ?? 0;

      if (best > second) {
        items.push({
          title: `🏆 ${LIFT_META[key].label} PR`,
          detail: `${Math.round(second)} → ${Math.round(best)}`,
          value: best - second,
        });
      }
    });

    const volumeByWorkout = workouts.map((workout) => {
      const workoutVolume = completedSets
        .filter((set) => set.workout_id === workout.id)
        .reduce(
          (sum, set) => sum + toNumber(set.weight) * toNumber(set.reps),
          0
        );

      return {
        workoutId: workout.id,
        workoutName: workout.workout_name ?? "Workout",
        volume: workoutVolume,
      };
    });

    const bestVolumeWorkout = [...volumeByWorkout].sort((a, b) => b.volume - a.volume)[0];
    if (bestVolumeWorkout?.volume) {
      items.push({
        title: "🔥 Best Workout Volume",
        detail: `${bestVolumeWorkout.workoutName} • ${Math.round(
          bestVolumeWorkout.volume
        ).toLocaleString()} lbs`,
        value: bestVolumeWorkout.volume,
      });
    }

    const fastestWorkout = workouts
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

    return items.sort((a, b) => b.value - a.value).slice(0, 5);
  }, [liftHistories, workouts, completedSets]);

  const projection = useMemo(() => {
    function projectLift(key: LiftKey, months: number) {
      const history = liftHistories[key];
      if (history.length < 2) return Math.round(bestLiftValues[key]);

      const recent = history.slice(-8);
      const first = recent[0];
      const last = recent[recent.length - 1];

      if (!first || !last) return Math.round(bestLiftValues[key]);

      const daysDiff = Math.max(
        7,
        Math.round(
          (new Date(last.date).getTime() - new Date(first.date).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );

      const gain = last.e1rm - first.e1rm;
      const dailyRate = gain / daysDiff;
      const projected = last.e1rm + dailyRate * months * 30;

      return Math.max(Math.round(last.e1rm), Math.round(projected));
    }

    return {
      in3: {
        bench: projectLift("bench", 3),
        squat: projectLift("squat", 3),
        deadlift: projectLift("deadlift", 3),
      },
      in6: {
        bench: projectLift("bench", 6),
        squat: projectLift("squat", 6),
        deadlift: projectLift("deadlift", 6),
      },
    };
  }, [liftHistories, bestLiftValues]);

  const momentum = useMemo(() => {
    const today = startOfDay(new Date());

    const last7Start = new Date(today);
    last7Start.setDate(today.getDate() - 6);

    const prev7Start = new Date(today);
    prev7Start.setDate(today.getDate() - 13);

    const prev7End = new Date(today);
    prev7End.setDate(today.getDate() - 7);

    const last7Workouts = workouts.filter(
      (w) => startOfDay(w.created_at) >= last7Start
    );

    const prev7Workouts = workouts.filter((w) => {
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

    const recentPrCount = prFeed.filter(
      (item) =>
        item.title.includes("PR") ||
        item.title.includes("Volume") ||
        item.title.includes("Fastest")
    ).length;

    let mode = "Cold";
    if (last7Workouts.length >= 5 && volumeDeltaPct >= 10) mode = "Beast";
    else if (last7Workouts.length >= 4 || volumeDeltaPct >= 5) mode = "Strong";
    else if (last7Workouts.length >= 2) mode = "Building";

    return {
      mode,
      workouts: last7Workouts.length,
      volumeDeltaPct,
      prs: recentPrCount,
    };
  }, [workouts, completedSets, prFeed]);

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <p style={eyebrowStyle}>RESPAWN DASHBOARD</p>
          <h1 style={heroTitleStyle}>Loading dashboard...</h1>
          <p style={heroSubStyle}>Pulling your latest training data.</p>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <p style={eyebrowStyle}>RESPAWN STRENGTH DASHBOARD</p>
        <h1 style={heroTitleStyle}>
          {profile?.name ? `${profile.name}'s Strength Index` : "Strength Index"}
        </h1>
        <p style={heroSubStyle}>Am I getting stronger?</p>

        <div style={strengthIndexBlockStyle}>
          <div style={strengthIndexLabelStyle}>STRENGTH INDEX</div>
          <div style={strengthIndexValueStyle}>{strengthIndex}</div>
          <div
            style={{
              ...strengthDeltaStyle,
              color: strengthIndexWeeklyChange >= 0 ? "#7CFC98" : "#ff8b8b",
            }}
          >
            {strengthIndexWeeklyChange >= 0 ? "↑" : "↓"}{" "}
            {Math.abs(strengthIndexWeeklyChange)} this week
          </div>
        </div>

        <div style={mainLiftRowStyle}>
          {liftSnapshots.map((lift) => (
            <div key={lift.key} style={mainLiftBoxStyle}>
              <span style={mainLiftNameStyle}>{lift.label}</span>
              <span style={mainLiftValueStyle}>{lift.current || "--"}</span>
            </div>
          ))}
        </div>

        <p style={heroInsightStyle}>
          {getTopPercentLabel(overallPercentile)} of lifters around your age and
          bodyweight.
        </p>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Strongest Version of You</h2>
        </div>

        <div style={targetGridStyle}>
          {strongestVersionRows.map((row) => {
            const progress =
              row.target > 0
                ? Math.max(
                    0,
                    Math.min(100, Math.round((row.current / row.target) * 100))
                  )
                : 0;

            return (
              <div key={row.label} style={targetCardStyle}>
                <div style={targetTopRowStyle}>
                  <span style={targetLabelStyle}>{row.label}</span>
                  <span style={targetGoalStyle}>{row.target}</span>
                </div>
                <div style={targetCurrentStyle}>{row.current || "--"}</div>
                <div style={progressBarTrackStyle}>
                  <div
                    style={{ ...progressBarFillStyle, width: `${progress}%` }}
                  />
                </div>
                <div style={targetSubStyle}>{progress}% of target strength</div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={twoColGridStyle}>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Strength vs Average</h2>
          </div>

          <div style={comparisonListStyle}>
            {liftSnapshots.map((lift) => (
              <div key={lift.key} style={comparisonRowStyle}>
                <div>
                  <div style={comparisonLiftStyle}>{lift.label}</div>
                  <div style={comparisonSubStyle}>
                    You: {lift.current || "--"} • Average: {lift.average}
                  </div>
                </div>
                <div style={comparisonRankStyle}>
                  {getTopPercentLabel(lift.percentile)}
                </div>
              </div>
            ))}
          </div>

          <p style={cardFootnoteStyle}>
            Compared to men around age {age}. Benchmark numbers are editable
            placeholders.
          </p>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Momentum</h2>
          </div>

          <div style={momentumModeStyle}>
            Momentum:{" "}
            <span style={momentumModeValueStyle}>
              {momentum.mode.toUpperCase()}
              {momentum.mode === "Beast"
                ? " 🔥"
                : momentum.mode === "Strong"
                ? " ⚡"
                : ""}
            </span>
          </div>

          <div style={miniStatGridStyle}>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Last 7 days</span>
              <span style={miniStatValueStyle}>{momentum.workouts} workouts</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Volume</span>
              <span
                style={{
                  ...miniStatValueStyle,
                  color: momentum.volumeDeltaPct >= 0 ? "#7CFC98" : "#ff8b8b",
                }}
              >
                {momentum.volumeDeltaPct >= 0 ? "+" : ""}
                {momentum.volumeDeltaPct}%
              </span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>PR feed hits</span>
              <span style={miniStatValueStyle}>{momentum.prs}</span>
            </div>
          </div>
        </section>
      </section>

      <section style={twoColGridStyle}>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Consistency Engine</h2>
          </div>

          <div style={streakRowStyle}>
            <div style={streakBoxStyle}>
              <div style={streakEmojiStyle}>🔥</div>
              <div>
                <div style={streakLabelStyle}>Current Streak</div>
                <div style={streakValueStyle}>{currentStreak} days</div>
              </div>
            </div>

            <div style={streakBoxStyle}>
              <div style={streakEmojiStyle}>🏆</div>
              <div>
                <div style={streakLabelStyle}>Best Streak</div>
                <div style={streakValueStyle}>{bestStreak} days</div>
              </div>
            </div>
          </div>

          <div style={heatmapGridStyle}>
            {heatmapDays.map((day, index) => (
              <div key={`${day.label}-${index}`} style={heatmapDayWrapStyle}>
                <div
                  title={
                    day.active
                      ? day.intense
                        ? "Intense workout"
                        : "Workout logged"
                      : "No workout"
                  }
                  style={{
                    ...heatmapCellStyle,
                    background: !day.active
                      ? "#1b1b1b"
                      : day.intense
                      ? "#ff4d4d"
                      : "#4caf50",
                  }}
                />
                <span style={heatmapLabelStyle}>{day.label}</span>
              </div>
            ))}
          </div>
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
            <p style={mutedStyle}>
              No PR feed items yet. Log more workouts to build this out.
            </p>
          )}
        </section>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Future Strength Projection</h2>
        </div>

        <div style={projectionGridStyle}>
          <div style={projectionCardStyle}>
            <div style={projectionTitleStyle}>In 3 months</div>
            <div style={projectionLineStyle}>
              Bench → {projection.in3.bench || "--"}
            </div>
            <div style={projectionLineStyle}>
              Squat → {projection.in3.squat || "--"}
            </div>
            <div style={projectionLineStyle}>
              Deadlift → {projection.in3.deadlift || "--"}
            </div>
          </div>

          <div style={projectionCardStyle}>
            <div style={projectionTitleStyle}>In 6 months</div>
            <div style={projectionLineStyle}>
              Bench → {projection.in6.bench || "--"}
            </div>
            <div style={projectionLineStyle}>
              Squat → {projection.in6.squat || "--"}
            </div>
            <div style={projectionLineStyle}>
              Deadlift → {projection.in6.deadlift || "--"}
            </div>
          </div>
        </div>

        <p style={cardFootnoteStyle}>
          Projection is based on recent improvement trend from your logged lift
          history.
        </p>
      </section>
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
    "linear-gradient(135deg, rgba(255,26,26,0.16) 0%, rgba(18,18,18,1) 55%, rgba(10,10,10,1) 100%)",
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

const heroInsightStyle: CSSProperties = {
  color: "#efefef",
  fontSize: "14px",
  margin: "18px 0 0",
  fontWeight: 600,
};

const strengthIndexBlockStyle: CSSProperties = {
  marginTop: "22px",
  display: "grid",
  gap: "4px",
};

const strengthIndexLabelStyle: CSSProperties = {
  color: "#b5b5b5",
  fontSize: "12px",
  letterSpacing: "0.12em",
  fontWeight: 700,
};

const strengthIndexValueStyle: CSSProperties = {
  fontSize: "64px",
  lineHeight: 1,
  fontWeight: 900,
  color: "#fff",
};

const strengthDeltaStyle: CSSProperties = {
  fontSize: "14px",
  fontWeight: 700,
};

const mainLiftRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "10px",
  marginTop: "20px",
};

const mainLiftBoxStyle: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "16px",
  padding: "14px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const mainLiftNameStyle: CSSProperties = {
  color: "#aaaaaa",
  fontSize: "12px",
};

const mainLiftValueStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "24px",
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

const targetGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const targetCardStyle: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(255,26,26,0.08), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "16px",
  padding: "16px",
};

const targetTopRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "8px",
};

const targetLabelStyle: CSSProperties = {
  color: "#b0b0b0",
  fontSize: "13px",
};

const targetGoalStyle: CSSProperties = {
  color: "#ff8b8b",
  fontSize: "14px",
  fontWeight: 700,
};

const targetCurrentStyle: CSSProperties = {
  color: "#fff",
  fontSize: "30px",
  fontWeight: 900,
  marginBottom: "12px",
};

const progressBarTrackStyle: CSSProperties = {
  width: "100%",
  height: "10px",
  background: "#1c1c1c",
  borderRadius: "999px",
  overflow: "hidden",
};

const progressBarFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: "999px",
  background: "linear-gradient(90deg, #ff1a1a, #ff7a7a)",
};

const targetSubStyle: CSSProperties = {
  color: "#bdbdbd",
  fontSize: "12px",
  marginTop: "8px",
};

const comparisonListStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
};

const comparisonRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "12px 0",
  borderBottom: "1px solid #1f1f1f",
};

const comparisonLiftStyle: CSSProperties = {
  color: "#fff",
  fontSize: "16px",
  fontWeight: 800,
};

const comparisonSubStyle: CSSProperties = {
  color: "#b5b5b5",
  fontSize: "13px",
  marginTop: "4px",
};

const comparisonRankStyle: CSSProperties = {
  color: "#7CFC98",
  fontSize: "14px",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const cardFootnoteStyle: CSSProperties = {
  color: "#8d8d8d",
  fontSize: "12px",
  marginTop: "14px",
};

const momentumModeStyle: CSSProperties = {
  color: "#d9d9d9",
  fontSize: "16px",
  marginBottom: "16px",
};

const momentumModeValueStyle: CSSProperties = {
  color: "#fff",
  fontWeight: 900,
};

const miniStatGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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
  color: "#fff",
  fontWeight: 900,
  fontSize: "18px",
};

const streakRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
  marginBottom: "18px",
};

const streakBoxStyle: CSSProperties = {
  background: "#171717",
  border: "1px solid #252525",
  borderRadius: "16px",
  padding: "16px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const streakEmojiStyle: CSSProperties = {
  fontSize: "24px",
};

const streakLabelStyle: CSSProperties = {
  color: "#b0b0b0",
  fontSize: "13px",
};

const streakValueStyle: CSSProperties = {
  color: "#fff",
  fontSize: "24px",
  fontWeight: 900,
  marginTop: "2px",
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

const projectionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "12px",
};

const projectionCardStyle: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(255,26,26,0.08), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "18px",
  padding: "18px",
};

const projectionTitleStyle: CSSProperties = {
  color: "#ff9d9d",
  fontSize: "15px",
  fontWeight: 800,
  marginBottom: "10px",
};

const projectionLineStyle: CSSProperties = {
  color: "#fff",
  fontSize: "16px",
  fontWeight: 700,
  marginTop: "8px",
};

const mutedStyle: CSSProperties = {
  color: "#a5a5a5",
  margin: "6px 0",
};