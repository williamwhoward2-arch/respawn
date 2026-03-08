"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
  body_part?: string | null;
  set_number: number | null;
  weight: string | number | null;
  reps: string | number | null;
  created_at: string;
};

type WorkoutCardio = {
  id: number;
  workout_id: number;
  user_id?: string | null;
  entry_number: number | null;
  method: string;
  miles: string | number | null;
  duration_seconds: number | null;
  notes: string | null;
  created_at: string;
};

type Profile = {
  id?: number;
  user_id?: string | null;
  name: string | null;
  bodyweight: string | number | null;
  goal: string | null;
  focus?: string | null;
  experience_level?: string | null;
};

type BodyPartSummary = {
  bodyPart: string;
  sets: number;
  volume: number;
};

type ExerciseSummary = {
  name: string;
  sets: number;
  volume: number;
  bestWeight: number;
  bestE1RM: number;
};

type WorkoutWithStats = Workout & {
  totalVolume: number;
  totalSets: number;
  cardioEntries: number;
  cardioDurationSeconds: number;
  cardioMiles: number;
  displayName: string;
  autoNamed: boolean;
};

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function estimate1RM(weight: number, reps: number): number {
  if (!weight || !reps) return 0;
  return weight * (1 + reps / 30);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatMiles(miles: number): string {
  if (!miles) return "--";
  return Number.isInteger(miles) ? `${miles}` : miles.toFixed(2);
}

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeBodyPart(value: string | null | undefined): string {
  if (!value) return "Other";

  const cleaned = value.toLowerCase();

  if (cleaned === "chest") return "Chest";
  if (cleaned === "back") return "Back";
  if (cleaned === "legs") return "Legs";
  if (cleaned === "shoulders") return "Shoulders";
  if (cleaned === "arms") return "Arms";
  if (cleaned === "core") return "Core";
  if (cleaned === "glutes") return "Glutes";
  if (cleaned === "push") return "Push";
  if (cleaned === "pull") return "Pull";
  if (cleaned === "full_body") return "Full Body";
  if (cleaned === "cardio") return "Cardio";

  return titleCase(cleaned);
}

function isGenericWorkoutName(name: string | null | undefined): boolean {
  const cleaned = (name || "").trim().toLowerCase();
  if (!cleaned) return true;

  return [
    "workout",
    "custom workout",
    "my workout",
    "session",
    "training",
    "lift",
    "gym",
    "today's workout",
    "todays workout",
    "new workout",
  ].includes(cleaned);
}

function getWorkoutDisplayName(params: {
  workout: Workout;
  sets: WorkoutSet[];
  cardio: WorkoutCardio[];
}): { name: string; autoNamed: boolean } {
  const { workout, sets, cardio } = params;

  if (!isGenericWorkoutName(workout.workout_name)) {
    return {
      name: workout.workout_name!.trim(),
      autoNamed: false,
    };
  }

  const validStrengthSets = sets.filter(
    (set) => toNumber(set.weight) > 0 && toNumber(set.reps) > 0
  );

  const totalSets = validStrengthSets.length;
  const totalVolume = validStrengthSets.reduce(
    (sum, set) => sum + toNumber(set.weight) * toNumber(set.reps),
    0
  );

  const totalCardioDuration = cardio.reduce(
    (sum, entry) => sum + toNumber(entry.duration_seconds),
    0
  );

  const exerciseFrequency = new Map<string, number>();
  const bodyPartVolume = new Map<string, number>();
  const cardioMethods = new Map<string, number>();

  for (const set of validStrengthSets) {
    const name = (set.exercise_name || "Exercise").trim();
    exerciseFrequency.set(name, (exerciseFrequency.get(name) ?? 0) + 1);

    const bodyPart = normalizeBodyPart(set.body_part);
    const volume = toNumber(set.weight) * toNumber(set.reps);
    bodyPartVolume.set(bodyPart, (bodyPartVolume.get(bodyPart) ?? 0) + volume);
  }

  for (const entry of cardio) {
    const method = titleCase(entry.method || "Cardio");
    cardioMethods.set(method, (cardioMethods.get(method) ?? 0) + 1);
  }

  const topExercises = Array.from(exerciseFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .slice(0, 2);

  const topBodyPart =
    Array.from(bodyPartVolume.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const topCardioMethod =
    Array.from(cardioMethods.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  if (validStrengthSets.length > 0) {
    if (topExercises.length >= 2 && totalSets <= 12) {
      return {
        name: `${topExercises[0]} + ${topExercises[1]}`,
        autoNamed: true,
      };
    }

    if (topBodyPart) {
      if (totalVolume >= 12000) {
        return {
          name: `${topBodyPart} Volume Day`,
          autoNamed: true,
        };
      }

      if (totalSets >= 14) {
        return {
          name: `${topBodyPart} Builder`,
          autoNamed: true,
        };
      }

      return {
        name: `${topBodyPart} Session`,
        autoNamed: true,
      };
    }

    if (topExercises.length > 0) {
      return {
        name: `${topExercises[0]} Session`,
        autoNamed: true,
      };
    }
  }

  if (cardio.length > 0) {
    if (topCardioMethod && totalCardioDuration > 0) {
      return {
        name: `${topCardioMethod} Cardio • ${formatDuration(totalCardioDuration)}`,
        autoNamed: true,
      };
    }

    if (topCardioMethod) {
      return {
        name: `${topCardioMethod} Cardio`,
        autoNamed: true,
      };
    }

    return {
      name: "Cardio Session",
      autoNamed: true,
    };
  }

  return {
    name: `Logged Session • ${formatDateShort(workout.created_at)}`,
    autoNamed: true,
  };
}

function VolumeTrendChart({
  data,
}: {
  data: { label: string; value: number; sets: number }[];
}) {
  if (!data.length) {
    return <p style={mutedStyle}>Not enough workout data yet.</p>;
  }

  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const width = 100;
  const height = 48;

  const points = data
    .map((item, index) => {
      const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
      const y = height - (item.value / maxValue) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div style={chartWrapStyle}>
      <div style={chartHeaderMiniStyle}>
        <div>
          <div style={chartTitleStyle}>Recent Volume Trend</div>
          <div style={chartSubtitleStyle}>Last {data.length} workouts</div>
        </div>
        <div style={chartBadgeGreenStyle}>Progression</div>
      </div>

      <div style={lineChartShellStyle}>
        <svg viewBox="0 0 100 56" preserveAspectRatio="none" style={svgChartStyle}>
          <defs>
            <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(34,197,94,0.40)" />
              <stop offset="100%" stopColor="rgba(34,197,94,0.02)" />
            </linearGradient>
          </defs>

          <polyline
            fill="none"
            stroke="rgba(34,197,94,0.95)"
            strokeWidth="2.5"
            points={points}
          />

          <polygon fill="url(#volumeFill)" points={`0,56 ${points} 100,56`} />

          {data.map((item, index) => {
            const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
            const y = height - (item.value / maxValue) * height;

            return (
              <circle
                key={`${item.label}-${index}`}
                cx={x}
                cy={y}
                r="1.8"
                fill="rgba(34,197,94,1)"
              />
            );
          })}
        </svg>
      </div>

      <div style={chartXAxisStyle}>
        {data.map((item) => (
          <div key={item.label} style={chartXAxisLabelStyle}>
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function BodyPartVolumeChart({
  data,
}: {
  data: { label: string; value: number; sets: number }[];
}) {
  if (!data.length) {
    return <p style={mutedStyle}>No body-part data yet.</p>;
  }

  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div style={chartWrapStyle}>
      <div style={chartHeaderMiniStyle}>
        <div>
          <div style={chartTitleStyle}>Body Part Volume Split</div>
          <div style={chartSubtitleStyle}>Recent workload distribution</div>
        </div>
        <div style={chartBadgeGreenStyle}>Balanced</div>
      </div>

      <div style={barChartListStyle}>
        {data.map((item) => {
          const widthPercent = `${Math.max((item.value / maxValue) * 100, 8)}%`;

          return (
            <div key={item.label} style={barRowStyle}>
              <div style={barRowTopStyle}>
                <span style={barLabelStyle}>{item.label}</span>
                <span style={barValueStyle}>
                  {item.value.toLocaleString()} • {item.sets} sets
                </span>
              </div>

              <div style={barTrackStyle}>
                <div
                  style={{
                    ...barFillStyle,
                    width: widthPercent,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [cardio, setCardio] = useState<WorkoutCardio[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<number | null>(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(null);
  const reportRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    void loadProgress();
  }, []);

  useEffect(() => {
    if (selectedWorkoutId && reportRef.current) {
      reportRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [selectedWorkoutId]);

  async function loadProgress() {
    setLoading(true);
    setStatus("Loading your progress review...");

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

    const [
      { data: profileData, error: profileError },
      { data: workoutsData, error: workoutsError },
      { data: setsData, error: setsError },
      { data: cardioData, error: cardioError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, user_id, name, bodyweight, goal, focus, experience_level")
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
      supabase
        .from("workout_cardio")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (profileError) console.error("Profile load error:", profileError);
    if (workoutsError) console.error("Workouts load error:", workoutsError);
    if (setsError) console.error("Sets load error:", setsError);
    if (cardioError) console.error("Cardio load error:", cardioError);

    setProfile((profileData as Profile) ?? null);
    setWorkouts((workoutsData as Workout[]) ?? []);
    setSets((setsData as WorkoutSet[]) ?? []);
    setCardio((cardioData as WorkoutCardio[]) ?? []);
    setStatus("");
    setLoading(false);
  }

  async function handleDeleteWorkout(workoutId: number) {
    const confirmed = window.confirm(
      "Delete this workout? This will also remove all sets and cardio tied to it."
    );
    if (!confirmed) return;

    try {
      setDeletingWorkoutId(workoutId);
      setStatus("Deleting workout...");

      const { error: workoutDeleteError } = await supabase
        .from("workouts")
        .delete()
        .eq("id", workoutId);

      if (workoutDeleteError) {
        console.error("Delete workout error:", workoutDeleteError);
        setStatus(`Error deleting workout: ${workoutDeleteError.message}`);
        setDeletingWorkoutId(null);
        return;
      }

      setWorkouts((prev) => prev.filter((workout) => workout.id !== workoutId));
      setSets((prev) => prev.filter((set) => set.workout_id !== workoutId));
      setCardio((prev) => prev.filter((entry) => entry.workout_id !== workoutId));

      if (selectedWorkoutId === workoutId) {
        setSelectedWorkoutId(null);
      }

      setStatus("");
      setDeletingWorkoutId(null);
    } catch (error) {
      console.error("Unexpected delete error:", error);
      setStatus("Something went wrong while deleting that workout.");
      setDeletingWorkoutId(null);
    }
  }

  const computed = useMemo(() => {
    const bodyweight = toNumber(profile?.bodyweight) || 205;
    const goal = (profile?.goal || "general").toLowerCase();

    const strengthSets = sets.filter((set) => {
      const weight = toNumber(set.weight);
      const reps = toNumber(set.reps);
      return weight > 0 && reps > 0;
    });

    const totalVolume = strengthSets.reduce(
      (sum, set) => sum + toNumber(set.weight) * toNumber(set.reps),
      0
    );

    const avgReps =
      strengthSets.length > 0
        ? Math.round(
            strengthSets.reduce((sum, set) => sum + toNumber(set.reps), 0) /
              strengthSets.length
          )
        : 0;

    const avgWeight =
      strengthSets.length > 0
        ? Math.round(
            strengthSets.reduce((sum, set) => sum + toNumber(set.weight), 0) /
              strengthSets.length
          )
        : 0;

    const recentWorkoutsBase = [...workouts]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);

    const recentWorkouts: WorkoutWithStats[] = recentWorkoutsBase.map((workout) => {
      const workoutSets = strengthSets.filter((set) => set.workout_id === workout.id);
      const workoutCardio = cardio.filter((entry) => entry.workout_id === workout.id);

      const volume = workoutSets.reduce(
        (sum, set) => sum + toNumber(set.weight) * toNumber(set.reps),
        0
      );

      const cardioDurationSeconds = workoutCardio.reduce(
        (sum, entry) => sum + toNumber(entry.duration_seconds),
        0
      );

      const cardioMiles = workoutCardio.reduce(
        (sum, entry) => sum + toNumber(entry.miles),
        0
      );

      const workoutName = getWorkoutDisplayName({
        workout,
        sets: workoutSets,
        cardio: workoutCardio,
      });

      return {
        ...workout,
        totalVolume: volume,
        totalSets: workoutSets.length,
        cardioEntries: workoutCardio.length,
        cardioDurationSeconds,
        cardioMiles,
        displayName: workoutName.name,
        autoNamed: workoutName.autoNamed,
      };
    });

    const recentWorkoutIds = new Set(recentWorkouts.map((w) => w.id));
    const recentSets = strengthSets.filter((set) => recentWorkoutIds.has(set.workout_id));

    const last14Days = new Date();
    last14Days.setDate(last14Days.getDate() - 13);

    const recent14Workouts = workouts.filter(
      (workout) => new Date(workout.created_at) >= last14Days
    ).length;

    const recent14CardioEntries = cardio.filter(
      (entry) => new Date(entry.created_at) >= last14Days
    ).length;

    const recent14CardioDuration = cardio
      .filter((entry) => new Date(entry.created_at) >= last14Days)
      .reduce((sum, entry) => sum + toNumber(entry.duration_seconds), 0);

    const bodyPartMap = new Map<string, { sets: number; volume: number }>();

    for (const set of recentSets) {
      const bodyPart = normalizeBodyPart(set.body_part);
      const current = bodyPartMap.get(bodyPart) ?? { sets: 0, volume: 0 };
      current.sets += 1;
      current.volume += toNumber(set.weight) * toNumber(set.reps);
      bodyPartMap.set(bodyPart, current);
    }

    const bodyPartSummary: BodyPartSummary[] = Array.from(bodyPartMap.entries())
      .map(([bodyPart, value]) => ({
        bodyPart,
        sets: value.sets,
        volume: value.volume,
      }))
      .sort((a, b) => b.volume - a.volume);

    const exerciseMap = new Map<
      string,
      { sets: number; volume: number; bestWeight: number; bestE1RM: number }
    >();

    for (const set of strengthSets) {
      const name = set.exercise_name?.trim() || "Unknown Exercise";
      const weight = toNumber(set.weight);
      const reps = toNumber(set.reps);
      const volume = weight * reps;
      const e1rm = estimate1RM(weight, reps);

      const current = exerciseMap.get(name) ?? {
        sets: 0,
        volume: 0,
        bestWeight: 0,
        bestE1RM: 0,
      };

      current.sets += 1;
      current.volume += volume;
      current.bestWeight = Math.max(current.bestWeight, weight);
      current.bestE1RM = Math.max(current.bestE1RM, e1rm);

      exerciseMap.set(name, current);
    }

    const topExercises: ExerciseSummary[] = Array.from(exerciseMap.entries())
      .map(([name, value]) => ({
        name,
        sets: value.sets,
        volume: value.volume,
        bestWeight: Math.round(value.bestWeight),
        bestE1RM: Math.round(value.bestE1RM),
      }))
      .sort((a, b) => b.sets - a.sets)
      .slice(0, 8);

    const strongestExercise =
      [...topExercises].sort((a, b) => b.bestE1RM - a.bestE1RM)[0] ?? null;

    const mostUsedExercise = topExercises[0] ?? null;

    const avgWorkoutDuration =
      recentWorkouts.length > 0
        ? Math.round(
            recentWorkouts.reduce(
              (sum, workout) => sum + toNumber(workout.duration_seconds),
              0
            ) /
              recentWorkouts.length /
              60
          )
        : 0;

    let repRangeSummary = "mixed";
    if (avgReps > 0 && avgReps <= 6) repRangeSummary = "strength_biased";
    else if (avgReps >= 7 && avgReps <= 12) repRangeSummary = "hypertrophy_biased";
    else if (avgReps >= 13) repRangeSummary = "high_rep_endurance";

    const bestWorkout =
      [...recentWorkouts].sort((a, b) => b.totalVolume - a.totalVolume)[0] ?? null;

    const aiInsights: string[] = [];
    const repTips: string[] = [];
    const didYouKnow: string[] = [];

    if (recent14Workouts >= 4) {
      aiInsights.push(
        "You’ve trained frequently enough in the last 14 days to build real momentum. Consistency is starting to compound."
      );
    } else if (recent14Workouts >= 2) {
      aiInsights.push(
        "Your recent training frequency is enough to maintain progress, but one extra session per week would likely improve results."
      );
    } else {
      aiInsights.push(
        "Your progress will sharpen once weekly frequency becomes more repeatable. Right now, consistency is the biggest lever."
      );
    }

    if (recent14CardioEntries > 0) {
      aiInsights.push(
        `You also logged ${recent14CardioEntries} cardio ${
          recent14CardioEntries === 1 ? "entry" : "entries"
        } in the last 14 days, totaling ${formatDuration(recent14CardioDuration)} of conditioning work.`
      );
    }

    if (mostUsedExercise) {
      aiInsights.push(
        `${mostUsedExercise.name} is currently your most logged movement. That usually means it is either a priority lift or a comfort-zone staple.`
      );
    }

    if (strongestExercise) {
      aiInsights.push(
        `${strongestExercise.name} currently leads your strength profile based on estimated 1RM.`
      );
    }

    if (bodyPartSummary.length > 1) {
      const strongest = bodyPartSummary[0];
      const weakest = bodyPartSummary[bodyPartSummary.length - 1];

      if (strongest && weakest && strongest.bodyPart !== weakest.bodyPart) {
        aiInsights.push(
          `${strongest.bodyPart} is getting the most recent training attention, while ${weakest.bodyPart.toLowerCase()} is trailing behind.`
        );
      }
    }

    if (repRangeSummary === "strength_biased") {
      repTips.push(
        "Most of your logged sets are in lower rep ranges. That is great for strength, but adding more 8–12 and 10–15 rep work can improve size and joint-friendly volume."
      );
      repTips.push(
        "Heavy compounds usually live well in the 3–6 or 5–8 rep ranges when technique stays sharp."
      );
    } else if (repRangeSummary === "hypertrophy_biased") {
      repTips.push(
        "Your data leans toward hypertrophy-friendly rep ranges. That is usually ideal for building muscle while still progressing load."
      );
      repTips.push(
        "A strong hypertrophy setup is often compounds in the 5–8 or 6–10 range, with accessories around 8–15 reps."
      );
    } else if (repRangeSummary === "high_rep_endurance") {
      repTips.push(
        "A lot of your work is landing in higher rep ranges. That can build work capacity well, but make sure at least some compounds stay heavier too."
      );
      repTips.push(
        "Higher-rep work is excellent for machines, cables, and isolation lifts, but your main compounds should still progress with enough load."
      );
    } else {
      repTips.push(
        "Your rep ranges are mixed, which can be useful, but clearer intent per exercise usually creates faster progress."
      );
      repTips.push(
        "Use lower reps for compounds, moderate reps for secondary lifts, and higher reps for isolations."
      );
    }

    if (goal === "hypertrophy") {
      repTips.push(
        "For a muscle-building goal, most accessory work tends to perform best in the 8–15 rep zone pushed close to technical failure."
      );
    } else if (goal === "strength") {
      repTips.push(
        "For a strength goal, prioritize fewer main lifts and progress them deliberately in lower rep ranges."
      );
    } else if (goal === "fat_loss") {
      repTips.push(
        "For fat loss, keep strength work heavy enough to preserve performance, then use accessories to drive training density."
      );
    }

    didYouKnow.push(
      "Moderate rep ranges usually create the best mix of progression, fatigue control, and muscle-building volume."
    );
    didYouKnow.push(
      "Repeating key lifts consistently makes progress easier to track than constantly changing exercises."
    );
    didYouKnow.push(
      "More volume is not always better. Productive volume is volume you can recover from and improve on next week."
    );
    didYouKnow.push(
      "A lift becoming more stable and repeatable is progress too, even before the weight jumps."
    );

    const storyParts: string[] = [];

    if (goal === "hypertrophy") {
      storyParts.push(
        "Your recent training review looks geared toward muscle-building, especially if you keep compounds progressing and accessory volume consistent."
      );
    } else if (goal === "strength") {
      storyParts.push(
        "Your recent training review reads like a strength-focused block, where cleaner main-lift progression matters most."
      );
    } else if (goal === "fat_loss") {
      storyParts.push(
        "Your recent training review shows a good opportunity to preserve strength while tightening consistency and workout density."
      );
    } else {
      storyParts.push(
        "Your recent training review shows a balanced base of general strength and productive work."
      );
    }

    if (strongestExercise) {
      storyParts.push(
        `Your strongest current movement is ${strongestExercise.name}, while ${
          mostUsedExercise?.name || "your main lifts"
        } appears most often in your logs.`
      );
    }

    if (recent14CardioEntries > 0) {
      storyParts.push(
        "You are also layering in cardio work, which adds conditioning without distorting your lifting metrics."
      );
    }

    if (avgWorkoutDuration > 0) {
      storyParts.push(
        `Your recent sessions are averaging about ${avgWorkoutDuration} minutes, which is enough time to build real progress when exercise selection stays focused.`
      );
    }

    return {
      bodyweight,
      goal,
      totalVolume,
      avgReps,
      avgWeight,
      avgWorkoutDuration,
      recent14Workouts,
      recent14CardioEntries,
      recent14CardioDuration,
      repRangeSummary,
      recentWorkouts,
      bodyPartSummary,
      topExercises,
      strongestExercise,
      mostUsedExercise,
      bestWorkout,
      aiInsights,
      repTips,
      didYouKnow,
      story: storyParts.join(" "),
    };
  }, [profile, workouts, sets, cardio]);

  const chartData = useMemo(() => {
    const recentVolumeTrend = [...computed.recentWorkouts]
      .slice()
      .reverse()
      .map((workout) => ({
        label: formatDateShort(workout.created_at),
        value: Math.round(workout.totalVolume),
        sets: workout.totalSets,
      }));

    const bodyPartVolumeBars = computed.bodyPartSummary.slice(0, 6).map((item) => ({
      label: item.bodyPart,
      value: Math.round(item.volume),
      sets: item.sets,
    }));

    return {
      recentVolumeTrend,
      bodyPartVolumeBars,
    };
  }, [computed]);

  const selectedWorkoutReport = useMemo(() => {
    if (!selectedWorkoutId) return null;

    const workout = workouts.find((item) => item.id === selectedWorkoutId);
    if (!workout) return null;

    const workoutSets = sets.filter(
      (set) =>
        set.workout_id === selectedWorkoutId &&
        toNumber(set.weight) > 0 &&
        toNumber(set.reps) > 0
    );

    const workoutCardio = cardio.filter((entry) => entry.workout_id === selectedWorkoutId);

    const groupedExercises = new Map<
      string,
      {
        name: string;
        bodyPart: string;
        sets: { setNumber: number; weight: number; reps: number; volume: number }[];
        totalVolume: number;
        bestWeight: number;
        bestE1RM: number;
      }
    >();

    for (const set of workoutSets) {
      const name = set.exercise_name?.trim() || "Unknown Exercise";
      const bodyPart = normalizeBodyPart(set.body_part);
      const weight = toNumber(set.weight);
      const reps = toNumber(set.reps);
      const volume = weight * reps;
      const e1rm = estimate1RM(weight, reps);

      const current = groupedExercises.get(name) ?? {
        name,
        bodyPart,
        sets: [],
        totalVolume: 0,
        bestWeight: 0,
        bestE1RM: 0,
      };

      current.sets.push({
        setNumber: toNumber(set.set_number),
        weight,
        reps,
        volume,
      });

      current.totalVolume += volume;
      current.bestWeight = Math.max(current.bestWeight, weight);
      current.bestE1RM = Math.max(current.bestE1RM, e1rm);

      groupedExercises.set(name, current);
    }

    const exercises = Array.from(groupedExercises.values()).sort(
      (a, b) => b.totalVolume - a.totalVolume
    );

    const totalVolume = workoutSets.reduce(
      (sum, set) => sum + toNumber(set.weight) * toNumber(set.reps),
      0
    );

    const totalSets = workoutSets.length;

    const totalCardioDuration = workoutCardio.reduce(
      (sum, entry) => sum + toNumber(entry.duration_seconds),
      0
    );

    const totalCardioMiles = workoutCardio.reduce(
      (sum, entry) => sum + toNumber(entry.miles),
      0
    );

    const strongestSet =
      workoutSets
        .map((set) => {
          const weight = toNumber(set.weight);
          const reps = toNumber(set.reps);
          return {
            exercise: set.exercise_name || "Exercise",
            weight,
            reps,
            e1rm: Math.round(estimate1RM(weight, reps)),
          };
        })
        .sort((a, b) => b.e1rm - a.e1rm)[0] ?? null;

    const avgReps =
      workoutSets.length > 0
        ? Math.round(
            workoutSets.reduce((sum, set) => sum + toNumber(set.reps), 0) /
              workoutSets.length
          )
        : 0;

    let repStyle = "Mixed";
    if (avgReps > 0 && avgReps <= 6) repStyle = "Strength biased";
    else if (avgReps >= 7 && avgReps <= 12) repStyle = "Hypertrophy biased";
    else if (avgReps >= 13) repStyle = "High-rep endurance";

    const aiNotes: string[] = [];

    if (strongestSet) {
      aiNotes.push(`${strongestSet.exercise} was your strongest movement in this workout.`);
    }

    if (repStyle === "Hypertrophy biased") {
      aiNotes.push("Most sets landed in productive hypertrophy-friendly rep ranges.");
    } else if (repStyle === "Strength biased") {
      aiNotes.push("This workout leaned more toward strength-focused loading.");
    } else if (repStyle === "High-rep endurance") {
      aiNotes.push("This session emphasized higher-rep work and training density.");
    }

    if (totalSets >= 20) {
      aiNotes.push("This was a high-workload session based on total completed sets.");
    }

    if (workoutCardio.length > 0) {
      aiNotes.push(
        `This session also included ${workoutCardio.length} cardio ${
          workoutCardio.length === 1 ? "entry" : "entries"
        } for ${formatDuration(totalCardioDuration)} total conditioning work.`
      );
    }

    const displayName = getWorkoutDisplayName({
      workout,
      sets: workoutSets,
      cardio: workoutCardio,
    });

    return {
      workout,
      displayName: displayName.name,
      autoNamed: displayName.autoNamed,
      exercises,
      cardioEntries: workoutCardio,
      totalVolume,
      totalSets,
      totalCardioDuration,
      totalCardioMiles,
      strongestSet,
      avgReps,
      repStyle,
      aiNotes,
    };
  }, [selectedWorkoutId, workouts, sets, cardio]);

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <p style={eyebrowStyle}>RESPAWN PROGRESS REVIEW</p>
          <h1 style={heroTitleStyle}>Loading your review...</h1>
          <p style={heroSubStyle}>
            Reading your workouts, exercise history, and training patterns.
          </p>
        </section>
      </main>
    );
  }

  const displayName = profile?.name?.trim() || "Your";

  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <p style={eyebrowStyle}>RESPAWN PROGRESS REVIEW</p>
        <h1 style={heroTitleStyle}>{displayName}&apos;s Progress Review</h1>
        <p style={heroSubStyle}>
          Goal: {profile?.goal ? titleCase(profile.goal) : "General"} • Bodyweight:{" "}
          {profile?.bodyweight || "--"}
        </p>

        <div style={heroReviewCardStyle}>
          <div style={heroReviewLabelStyle}>AI review summary</div>
          <div style={heroReviewTextStyle}>{computed.story}</div>
        </div>

        <div style={heroStatsRowStyle}>
          <div style={heroStatBoxStyle}>
            <span style={heroStatLabelStyle}>Recent Workouts</span>
            <span style={heroStatValueStyle}>{computed.recent14Workouts}</span>
          </div>
          <div style={heroStatBoxStyle}>
            <span style={heroStatLabelStyle}>Cardio Entries</span>
            <span style={heroStatValueStyle}>{computed.recent14CardioEntries}</span>
          </div>
          <div style={heroStatBoxStyle}>
            <span style={heroStatLabelStyle}>Avg Session</span>
            <span style={heroStatValueStyle}>
              {computed.avgWorkoutDuration ? `${computed.avgWorkoutDuration}m` : "--"}
            </span>
          </div>
          <div style={heroStatBoxStyle}>
            <span style={heroStatLabelStyle}>Total Volume</span>
            <span style={heroStatValueStyleSmall}>
              {Math.round(computed.totalVolume).toLocaleString()}
            </span>
          </div>
        </div>
      </section>

      <section style={twoColGridStyle}>
        <section style={cardStyle}>
          <VolumeTrendChart data={chartData.recentVolumeTrend} />
        </section>

        <section style={cardStyle}>
          <BodyPartVolumeChart data={chartData.bodyPartVolumeBars} />
        </section>
      </section>

      <section style={twoColGridStyle}>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Recent Workouts</h2>
          </div>

          {computed.recentWorkouts.length > 0 ? (
            <div style={sessionListStyle}>
              {computed.recentWorkouts.map((workout) => (
                <div key={workout.id} style={sessionCardStyle}>
                  <div style={sessionCardTopStyle}>
                    <div>
                      <div style={sessionNameRowStyle}>
                        <div style={sessionNameStyle}>{workout.displayName}</div>
                        {workout.autoNamed ? (
                          <span style={autoNamedBadgeStyle}>Auto-named</span>
                        ) : null}
                      </div>
                      <div style={sessionMetaStyle}>{formatDateTime(workout.created_at)}</div>
                    </div>

                    <div style={sessionActionsStyle}>
                      <div style={sessionDurationStyle}>
                        {formatDuration(workout.duration_seconds)}
                      </div>

                      <div style={sessionButtonRowStyle}>
                        <button
                          onClick={() => setSelectedWorkoutId(workout.id)}
                          style={viewWorkoutButtonStyle}
                        >
                          Open Report
                        </button>

                        <button
                          onClick={() => handleDeleteWorkout(workout.id)}
                          disabled={deletingWorkoutId === workout.id}
                          style={{
                            ...deleteWorkoutButtonStyle,
                            opacity: deletingWorkoutId === workout.id ? 0.6 : 1,
                            cursor:
                              deletingWorkoutId === workout.id ? "not-allowed" : "pointer",
                          }}
                        >
                          {deletingWorkoutId === workout.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={sessionMiniRowStyle}>
                    <span style={sessionMiniBadgeStyle}>{workout.totalSets} lifting sets</span>
                    <span style={sessionMiniBadgeStyle}>
                      {Math.round(workout.totalVolume).toLocaleString()} volume
                    </span>
                    {workout.cardioEntries > 0 ? (
                      <span style={sessionMiniBadgeStyle}>
                        {workout.cardioEntries} cardio{" "}
                        {workout.cardioEntries === 1 ? "entry" : "entries"}
                      </span>
                    ) : null}
                    {workout.cardioDurationSeconds > 0 ? (
                      <span style={sessionMiniBadgeStyle}>
                        {formatDuration(workout.cardioDurationSeconds)} cardio
                      </span>
                    ) : null}
                    {workout.cardioMiles > 0 ? (
                      <span style={sessionMiniBadgeStyle}>
                        {formatMiles(workout.cardioMiles)} mi
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={mutedStyle}>No recent workouts yet.</p>
          )}
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Most Used Exercises</h2>
          </div>

          {computed.topExercises.length > 0 ? (
            <div style={exerciseListStyle}>
              {computed.topExercises.map((exercise) => (
                <div key={exercise.name} style={exerciseRowStyle}>
                  <div>
                    <div style={exerciseNameStyle}>{exercise.name}</div>
                    <div style={exerciseMetaStyle}>
                      {exercise.sets} sets • {Math.round(exercise.volume).toLocaleString()} volume
                    </div>
                  </div>

                  <div style={exerciseRightStyle}>
                    <div style={exerciseBestStyle}>{exercise.bestWeight} lb</div>
                    <div style={exerciseBestSubStyle}>{exercise.bestE1RM} est</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={mutedStyle}>No exercise history yet.</p>
          )}
        </section>
      </section>

      {selectedWorkoutReport ? (
        <section
          ref={reportRef}
          style={{
            ...cardStyle,
            border: "1px solid rgba(255, 107, 107, 0.35)",
            boxShadow:
              "0 0 0 1px rgba(255, 107, 107, 0.08), 0 12px 32px rgba(0,0,0,0.35)",
          }}
        >
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>
              Workout Report — {selectedWorkoutReport.displayName}
            </h2>
            <button onClick={() => setSelectedWorkoutId(null)} style={closeReportButtonStyle}>
              Close
            </button>
          </div>

          <div style={reportHelperTextStyle}>Reviewing your selected workout below.</div>

          <div style={reportHeroStyle}>
            <div style={reportWorkoutNameRowStyle}>
              <div style={reportWorkoutNameStyle}>{selectedWorkoutReport.displayName}</div>
              {selectedWorkoutReport.autoNamed ? (
                <span style={autoNamedBadgeStyle}>Auto-named</span>
              ) : null}
            </div>
            <div style={reportWorkoutMetaStyle}>
              {formatDateTime(selectedWorkoutReport.workout.created_at)} •{" "}
              {formatDuration(selectedWorkoutReport.workout.duration_seconds)}
            </div>
          </div>

          <div style={heroStatsRowStyle}>
            <div style={heroStatBoxStyle}>
              <span style={heroStatLabelStyle}>Lifting Sets</span>
              <span style={heroStatValueStyle}>{selectedWorkoutReport.totalSets}</span>
            </div>

            <div style={heroStatBoxStyle}>
              <span style={heroStatLabelStyle}>Lifting Volume</span>
              <span style={heroStatValueStyleSmall}>
                {Math.round(selectedWorkoutReport.totalVolume).toLocaleString()}
              </span>
            </div>

            <div style={heroStatBoxStyle}>
              <span style={heroStatLabelStyle}>Cardio Time</span>
              <span style={heroStatValueStyleSmall}>
                {formatDuration(selectedWorkoutReport.totalCardioDuration)}
              </span>
            </div>

            <div style={heroStatBoxStyle}>
              <span style={heroStatLabelStyle}>Cardio Miles</span>
              <span style={heroStatValueStyleSmall}>
                {selectedWorkoutReport.totalCardioMiles > 0
                  ? formatMiles(selectedWorkoutReport.totalCardioMiles)
                  : "--"}
              </span>
            </div>
          </div>

          {selectedWorkoutReport.strongestSet ? (
            <div style={reportHighlightCardStyle}>
              <div style={reportHighlightLabelStyle}>Strongest Set</div>
              <div style={reportHighlightTextStyle}>
                {selectedWorkoutReport.strongestSet.exercise} •{" "}
                {selectedWorkoutReport.strongestSet.weight} ×{" "}
                {selectedWorkoutReport.strongestSet.reps} •{" "}
                {selectedWorkoutReport.strongestSet.e1rm} est.
              </div>
            </div>
          ) : null}

          <div style={twoColGridStyle}>
            <section style={subCardStyle}>
              <div style={subSectionTitleStyle}>AI Notes</div>
              <div style={didYouKnowListStyle}>
                {selectedWorkoutReport.aiNotes.map((note, index) => (
                  <div key={index} style={didYouKnowItemStyle}>
                    <div style={didYouKnowBulletStyle} />
                    <span>{note}</span>
                  </div>
                ))}
              </div>

              {selectedWorkoutReport.cardioEntries.length > 0 ? (
                <>
                  <div style={{ ...subSectionTitleStyle, marginTop: 18 }}>Cardio</div>
                  <div style={exerciseReportListStyle}>
                    {selectedWorkoutReport.cardioEntries.map((entry) => (
                      <div key={entry.id} style={exerciseReportCardStyle}>
                        <div style={exerciseReportTopStyle}>
                          <div>
                            <div style={exerciseNameStyle}>{titleCase(entry.method)}</div>
                            <div style={exerciseMetaStyle}>
                              Entry {entry.entry_number || 1}
                            </div>
                          </div>

                          <div style={exerciseRightStyle}>
                            <div style={exerciseBestStyle}>
                              {formatDuration(entry.duration_seconds)}
                            </div>
                            <div style={exerciseBestSubStyle}>
                              {toNumber(entry.miles) > 0
                                ? `${formatMiles(toNumber(entry.miles))} mi`
                                : "cardio"}
                            </div>
                          </div>
                        </div>

                        {entry.notes ? (
                          <div style={reportCardioNotesStyle}>{entry.notes}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </section>

            <section style={subCardStyle}>
              <div style={subSectionTitleStyle}>Exercises</div>

              {selectedWorkoutReport.exercises.length > 0 ? (
                <div style={exerciseReportListStyle}>
                  {selectedWorkoutReport.exercises.map((exercise) => (
                    <div key={exercise.name} style={exerciseReportCardStyle}>
                      <div style={exerciseReportTopStyle}>
                        <div>
                          <div style={exerciseNameStyle}>{exercise.name}</div>
                          <div style={exerciseMetaStyle}>{exercise.bodyPart}</div>
                        </div>

                        <div style={exerciseRightStyle}>
                          <div style={exerciseBestStyle}>
                            {Math.round(exercise.totalVolume).toLocaleString()}
                          </div>
                          <div style={exerciseBestSubStyle}>volume</div>
                        </div>
                      </div>

                      <div style={setTableStyle}>
                        {exercise.sets.map((set, idx) => (
                          <div key={`${exercise.name}-${idx}`} style={setRowStyle}>
                            <span>Set {set.setNumber || idx + 1}</span>
                            <span>{set.weight} lb</span>
                            <span>{set.reps} reps</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={mutedStyle}>No lifting sets logged in this workout.</p>
              )}
            </section>
          </div>
        </section>
      ) : null}

      <section style={twoColGridStyle}>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>AI Insights</h2>
          </div>

          {computed.aiInsights.length > 0 ? (
            <div style={insightListStyle}>
              {computed.aiInsights.map((item, index) => (
                <div key={index} style={insightCardStyle}>
                  <div style={insightCardLabelStyle}>Insight</div>
                  <div style={insightCardTextStyle}>{item}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={mutedStyle}>Log more sessions and your insights will get sharper.</p>
          )}
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Did You Know?</h2>
          </div>

          <div style={didYouKnowListStyle}>
            {computed.didYouKnow.map((tip, index) => (
              <div key={index} style={didYouKnowItemStyle}>
                <div style={didYouKnowBulletStyle} />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section style={twoColGridStyle}>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Rep Range Guidance</h2>
          </div>

          <div style={tipGridStyle}>
            {computed.repTips.map((tip, index) => (
              <div key={index} style={repTipCardStyle}>
                {tip}
              </div>
            ))}
          </div>

          <div style={miniStatsRowStyle}>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Avg Weight</span>
              <span style={miniStatValueStyle}>{computed.avgWeight || "--"}</span>
            </div>
            <div style={miniStatBoxStyle}>
              <span style={miniStatLabelStyle}>Rep Bias</span>
              <span style={miniStatValueStyleSmall}>
                {titleCase(computed.repRangeSummary)}
              </span>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitle}>Body Part Review</h2>
          </div>

          {computed.bodyPartSummary.length > 0 ? (
            <div style={bodyPartGridStyle}>
              {computed.bodyPartSummary.map((item) => (
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
            <p style={mutedStyle}>Not enough body-part data yet.</p>
          )}
        </section>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitle}>Review Highlights</h2>
        </div>

        <div style={highlightGridStyle}>
          <div style={highlightCardStyle}>
            <div style={highlightLabelStyle}>Strongest Exercise</div>
            <div style={highlightMainStyle}>
              {computed.strongestExercise?.name || "No data yet"}
            </div>
            <div style={highlightSubStyle}>
              {computed.strongestExercise
                ? `${computed.strongestExercise.bestE1RM} est. 1RM`
                : "Log more heavy sets"}
            </div>
          </div>

          <div style={highlightCardStyle}>
            <div style={highlightLabelStyle}>Most Used Movement</div>
            <div style={highlightMainStyle}>
              {computed.mostUsedExercise?.name || "No data yet"}
            </div>
            <div style={highlightSubStyle}>
              {computed.mostUsedExercise
                ? `${computed.mostUsedExercise.sets} logged sets`
                : "Track a few sessions"}
            </div>
          </div>

          <div style={highlightCardStyle}>
            <div style={highlightLabelStyle}>Best Recent Workout</div>
            <div style={highlightMainStyle}>
              {computed.bestWorkout?.displayName || "No data yet"}
            </div>
            <div style={highlightSubStyle}>
              {computed.bestWorkout
                ? `${formatDateShort(computed.bestWorkout.created_at)} • ${Math.round(
                    computed.bestWorkout.totalVolume
                  ).toLocaleString()} volume`
                : "Complete more sessions"}
            </div>
          </div>
        </div>
      </section>

      {status ? <p style={statusStyle}>{status}</p> : null}
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg,#050505,#0a0a0a,#0f0f0f)",
  color: "white",
  padding: "28px 20px 120px",
  fontFamily: "sans-serif",
};

const heroCardStyle: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(255,26,26,0.16) 0%, rgba(20,20,20,1) 56%, rgba(10,10,10,1) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "24px",
  padding: "24px",
  marginBottom: "18px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
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
  margin: "0 0 8px",
};

const heroSubStyle: CSSProperties = {
  color: "#d0d0d0",
  fontSize: "15px",
  margin: 0,
};

const heroReviewCardStyle: CSSProperties = {
  marginTop: "18px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "18px",
  padding: "16px",
};

const heroReviewLabelStyle: CSSProperties = {
  color: "#86efac",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: "8px",
};

const heroReviewTextStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: 700,
  lineHeight: 1.5,
};

const heroStatsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
  gap: "10px",
  marginTop: "18px",
};

const heroStatBoxStyle: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "14px",
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
  fontSize: "22px",
  fontWeight: 900,
};

const heroStatValueStyleSmall: CSSProperties = {
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 800,
  lineHeight: 1.3,
};

const twoColGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
  gap: "16px",
  marginBottom: "16px",
};

const cardStyle: CSSProperties = {
  background: "#121212",
  border: "1px solid #222",
  borderRadius: "20px",
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

const sessionListStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
};

const sessionCardStyle: CSSProperties = {
  background: "#171717",
  border: "1px solid #252525",
  borderRadius: "16px",
  padding: "14px",
};

const sessionCardTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
};

const sessionActionsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "8px",
  flexShrink: 0,
};

const sessionButtonRowStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const sessionNameRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const sessionNameStyle: CSSProperties = {
  color: "#fff",
  fontWeight: 800,
  fontSize: "15px",
};

const sessionMetaStyle: CSSProperties = {
  color: "#8f8f8f",
  fontSize: "13px",
  marginTop: "4px",
};

const sessionDurationStyle: CSSProperties = {
  color: "#ff7a7a",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const sessionMiniRowStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginTop: "12px",
};

const sessionMiniBadgeStyle: CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.06)",
  color: "#dddddd",
  borderRadius: "999px",
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 700,
};

const autoNamedBadgeStyle: CSSProperties = {
  background: "rgba(255, 107, 107, 0.10)",
  border: "1px solid rgba(255, 107, 107, 0.22)",
  color: "#ffb0b0",
  borderRadius: "999px",
  padding: "4px 8px",
  fontSize: "11px",
  fontWeight: 800,
};

const viewWorkoutButtonStyle: CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "8px 10px",
  fontSize: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const deleteWorkoutButtonStyle: CSSProperties = {
  background: "rgba(255, 77, 77, 0.10)",
  border: "1px solid rgba(255, 77, 77, 0.28)",
  color: "#ff9c9c",
  borderRadius: "10px",
  padding: "8px 10px",
  fontSize: "12px",
  fontWeight: 800,
};

const closeReportButtonStyle: CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "8px 12px",
  fontSize: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const exerciseListStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
};

const exerciseRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  padding: "12px 0",
  borderBottom: "1px solid #1f1f1f",
};

const exerciseNameStyle: CSSProperties = {
  color: "#fff",
  fontWeight: 800,
};

const exerciseMetaStyle: CSSProperties = {
  color: "#999",
  fontSize: "13px",
  marginTop: "4px",
};

const exerciseRightStyle: CSSProperties = {
  textAlign: "right",
  flexShrink: 0,
};

const exerciseBestStyle: CSSProperties = {
  color: "#fff",
  fontWeight: 900,
};

const exerciseBestSubStyle: CSSProperties = {
  color: "#86efac",
  fontSize: "12px",
  marginTop: "4px",
};

const reportHelperTextStyle: CSSProperties = {
  color: "#ffb0b0",
  fontSize: "13px",
  fontWeight: 700,
  marginBottom: "12px",
};

const reportHeroStyle: CSSProperties = {
  marginBottom: "16px",
};

const reportWorkoutNameRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const reportWorkoutNameStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: 900,
};

const reportWorkoutMetaStyle: CSSProperties = {
  color: "#a0a0a0",
  fontSize: "14px",
  marginTop: "6px",
};

const reportHighlightCardStyle: CSSProperties = {
  marginTop: "16px",
  marginBottom: "16px",
  background: "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "16px",
  padding: "14px",
};

const reportHighlightLabelStyle: CSSProperties = {
  color: "#86efac",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: "8px",
};

const reportHighlightTextStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 800,
  lineHeight: 1.45,
};

const subCardStyle: CSSProperties = {
  background: "#171717",
  border: "1px solid #252525",
  borderRadius: "16px",
  padding: "16px",
};

const subSectionTitleStyle: CSSProperties = {
  color: "#ff4d4d",
  fontSize: "15px",
  fontWeight: 800,
  marginBottom: "12px",
};

const exerciseReportListStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
};

const exerciseReportCardStyle: CSSProperties = {
  background: "#141414",
  border: "1px solid #232323",
  borderRadius: "14px",
  padding: "12px",
};

const exerciseReportTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
  marginBottom: "10px",
};

const setTableStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
};

const setRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: "8px",
  color: "#d8d8d8",
  fontSize: "13px",
  padding: "8px 10px",
  borderRadius: "10px",
  background: "rgba(255,255,255,0.03)",
};

const reportCardioNotesStyle: CSSProperties = {
  color: "#cfcfcf",
  fontSize: "13px",
  lineHeight: 1.45,
  marginTop: "8px",
};

const insightListStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
};

const insightCardStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,26,26,0.08), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "16px",
  padding: "14px",
};

const insightCardLabelStyle: CSSProperties = {
  color: "#ff9b9b",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: "8px",
};

const insightCardTextStyle: CSSProperties = {
  color: "#f0f0f0",
  lineHeight: 1.5,
};

const tipGridStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
};

const repTipCardStyle: CSSProperties = {
  background: "linear-gradient(135deg,rgba(255,26,26,.10),rgba(255,255,255,.02))",
  borderRadius: "16px",
  padding: "14px",
  border: "1px solid rgba(255,255,255,.05)",
  color: "#f0f0f0",
  lineHeight: 1.5,
};

const didYouKnowListStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
};

const didYouKnowItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
  color: "#f0f0f0",
  lineHeight: 1.55,
};

const didYouKnowBulletStyle: CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "999px",
  background: "#ff6b6b",
  flexShrink: 0,
  marginTop: "8px",
};

const miniStatsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
  gap: "10px",
  marginTop: "16px",
};

const miniStatBoxStyle: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "14px",
  padding: "14px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const miniStatLabelStyle: CSSProperties = {
  color: "#aaaaaa",
  fontSize: "12px",
};

const miniStatValueStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: 900,
};

const miniStatValueStyleSmall: CSSProperties = {
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 800,
  lineHeight: 1.3,
};

const bodyPartGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
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

const highlightGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: "12px",
};

const highlightCardStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,26,26,0.08), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "18px",
  padding: "16px",
};

const highlightLabelStyle: CSSProperties = {
  color: "#ff9b9b",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: "8px",
};

const highlightMainStyle: CSSProperties = {
  color: "#fff",
  fontSize: "20px",
  fontWeight: 900,
  lineHeight: 1.2,
};

const highlightSubStyle: CSSProperties = {
  color: "#bbbbbb",
  fontSize: "13px",
  marginTop: "8px",
  lineHeight: 1.4,
};

const chartWrapStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
};

const chartHeaderMiniStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  flexWrap: "wrap",
};

const chartTitleStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: 800,
};

const chartSubtitleStyle: CSSProperties = {
  color: "#9f9f9f",
  fontSize: "13px",
  marginTop: "4px",
};

const chartBadgeGreenStyle: CSSProperties = {
  background: "rgba(34,197,94,0.14)",
  border: "1px solid rgba(34,197,94,0.35)",
  color: "#86efac",
  borderRadius: "999px",
  padding: "6px 10px",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const lineChartShellStyle: CSSProperties = {
  height: "180px",
  borderRadius: "16px",
  background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
  border: "1px solid rgba(255,255,255,0.05)",
  padding: "12px",
};

const svgChartStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
};

const chartXAxisStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(40px, 1fr))",
  gap: "6px",
};

const chartXAxisLabelStyle: CSSProperties = {
  color: "#8f8f8f",
  fontSize: "11px",
  textAlign: "center",
};

const barChartListStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
};

const barRowStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
};

const barRowTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
};

const barLabelStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 700,
};

const barValueStyle: CSSProperties = {
  color: "#9f9f9f",
  fontSize: "12px",
  fontWeight: 700,
};

const barTrackStyle: CSSProperties = {
  width: "100%",
  height: "12px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.06)",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.04)",
};

const barFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: "999px",
  background: "linear-gradient(90deg, rgba(34,197,94,0.70), rgba(74,222,128,1))",
  boxShadow: "0 0 14px rgba(34,197,94,0.25)",
};

const mutedStyle: CSSProperties = {
  color: "#9f9f9f",
  margin: 0,
};

const statusStyle: CSSProperties = {
  color: "#cccccc",
  marginTop: "18px",
  marginBottom: 0,
};