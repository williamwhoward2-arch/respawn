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
  created_at?: string;
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
  created_at?: string;
};

type Profile = {
  id?: number;
  user_id?: string | null;
  name?: string | null;
  bodyweight: string | number | null;
  goal: string | null;
  focus?: string | null;
  experience_level?: string | null;
};

type BodyPartSummary = {
  bodyPart: string;
  sets: number;
};

type WorkoutWithStats = Workout & {
  totalSets: number;
  exerciseCount: number;
  cardioEntries: number;
  cardioDurationSeconds: number;
  cardioMiles: number;
  displayName: string;
  autoNamed: boolean;
};

type GoalTile = {
  goalLabel: string;
  frequencyLabel: string;
  frequencyDetail: string;
  workloadLabel: string;
  workloadDetail: string;
  intensityLabel: string;
  intensityDetail: string;
  summary: string;
};

type AIInsights = {
  heroHeadline?: string;
  heroSummary?: string;
  topWin?: string;
  topConcern?: string;
  nextBestMove?: string;
  bodyPartCallout?: string;
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

function formatMinutesRounded(seconds?: number | null): string {
  if (!seconds) return "--";
  return `${Math.round(seconds / 60)} min`;
}

function formatMiles(miles: number): string {
  if (!miles) return "--";
  return Number.isInteger(miles) ? `${miles}` : miles.toFixed(1);
}

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeBodyPart(value: string | null | undefined): string {
  if (!value) return "Other";

  const cleaned = value.trim().toLowerCase();

  if (cleaned.includes("chest")) return "Chest";
  if (cleaned.includes("back")) return "Back";
  if (cleaned.includes("leg")) return "Legs";
  if (cleaned.includes("shoulder")) return "Shoulders";
  if (
    cleaned.includes("arm") ||
    cleaned.includes("bicep") ||
    cleaned.includes("tricep")
  ) {
    return "Arms";
  }
  if (cleaned.includes("core") || cleaned.includes("ab")) return "Core";
  if (cleaned.includes("glute")) return "Glutes";
  if (cleaned.includes("push")) return "Push";
  if (cleaned.includes("pull")) return "Pull";
  if (cleaned.includes("full")) return "Full Body";
  if (cleaned.includes("cardio")) return "Cardio";

  return titleCase(cleaned);
}

function normalizeGoal(
  value: string | null | undefined
): "hypertrophy" | "strength" | "fat_loss" | "general" {
  const cleaned = (value || "").trim().toLowerCase().replaceAll(" ", "_");

  if (["build_muscle", "hypertrophy", "muscle_gain", "gain_muscle"].includes(cleaned)) {
    return "hypertrophy";
  }

  if (["get_stronger", "strength", "build_strength", "stronger"].includes(cleaned)) {
    return "strength";
  }

  if (["burn_fat", "fat_loss", "lose_fat", "weight_loss", "cut"].includes(cleaned)) {
    return "fat_loss";
  }

  if (["general_fitness", "general", "fitness"].includes(cleaned)) {
    return "general";
  }

  return "general";
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

  const validSets = sets.filter(
    (set) => toNumber(set.weight) > 0 && toNumber(set.reps) > 0
  );

  const exerciseFrequency = new Map<string, number>();
  const bodyPartCounts = new Map<string, number>();
  const cardioMethods = new Map<string, number>();

  for (const set of validSets) {
    const name = (set.exercise_name || "Exercise").trim();
    exerciseFrequency.set(name, (exerciseFrequency.get(name) ?? 0) + 1);

    const bodyPart = normalizeBodyPart(set.body_part);
    bodyPartCounts.set(bodyPart, (bodyPartCounts.get(bodyPart) ?? 0) + 1);
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
    Array.from(bodyPartCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const topCardioMethod =
    Array.from(cardioMethods.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  if (validSets.length > 0) {
    if (topExercises.length >= 2) {
      return {
        name: `${topExercises[0]} + ${topExercises[1]}`,
        autoNamed: true,
      };
    }

    if (topBodyPart) {
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
    if (topCardioMethod) {
      return {
        name: `${topCardioMethod} Session`,
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

function getStrengthLevelLabel(e1rm: number, bodyweight: number): string {
  if (!e1rm || !bodyweight) return "Building";
  const ratio = e1rm / bodyweight;

  if (ratio >= 2) return "Elite";
  if (ratio >= 1.5) return "Advanced";
  if (ratio >= 1.15) return "Intermediate";
  if (ratio >= 0.8) return "Novice";
  return "Building";
}
export default function ProgressPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [cardio, setCardio] = useState<WorkoutCardio[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(null);
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [visibleWorkoutCount, setVisibleWorkoutCount] = useState(8);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<number | null>(null);
  const [aiInsights, setAiInsights] = useState<AIInsights | null>(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
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

  function toggleExercise(exerciseKey: string) {
    setExpandedExercises((prev) => ({
      ...prev,
      [exerciseKey]: !prev[exerciseKey],
    }));
  }

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

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, user_id, name, bodyweight, goal, focus, experience_level")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile load error:", profileError);
      setStatus(`Error loading profile: ${profileError.message}`);
      setLoading(false);
      return;
    }

    const { data: workoutsData, error: workoutsError } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (workoutsError) {
      console.error("Workouts load error:", workoutsError);
      setStatus(`Error loading workouts: ${workoutsError.message}`);
      setLoading(false);
      return;
    }

    const safeWorkouts = (workoutsData as Workout[]) ?? [];
    const workoutIds = safeWorkouts.map((w) => w.id);

    let safeSets: WorkoutSet[] = [];
    let safeCardio: WorkoutCardio[] = [];

    if (workoutIds.length > 0) {
      const [{ data: setsData, error: setsError }, { data: cardioData, error: cardioError }] =
        await Promise.all([
          supabase
            .from("workout_sets")
            .select("*")
            .in("workout_id", workoutIds)
            .order("created_at", { ascending: false }),
          supabase
            .from("workout_cardio")
            .select("*")
            .in("workout_id", workoutIds)
            .order("created_at", { ascending: false }),
        ]);

      if (setsError) {
        console.error("Sets load error:", setsError);
        setStatus(`Error loading workout sets: ${setsError.message}`);
        setLoading(false);
        return;
      }

      if (cardioError) {
        console.error("Cardio load error:", cardioError);
        setStatus(`Error loading cardio: ${cardioError.message}`);
        setLoading(false);
        return;
      }

      safeSets = (setsData as WorkoutSet[]) ?? [];
      safeCardio = (cardioData as WorkoutCardio[]) ?? [];
    }

    setProfile((profileData as Profile) ?? null);
    setWorkouts(safeWorkouts);
    setSets(safeSets);
    setCardio(safeCardio);
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

      setDeletingWorkoutId(null);
      setStatus("");
    } catch (error) {
      console.error("Unexpected delete error:", error);
      setStatus("Something went wrong while deleting that workout.");
      setDeletingWorkoutId(null);
    }
  }

  const computed = useMemo(() => {
    const goal = normalizeGoal(profile?.goal);

    const goalLabel =
      goal === "hypertrophy"
        ? "Build muscle"
        : goal === "strength"
        ? "Get stronger"
        : goal === "fat_loss"
        ? "Burn fat"
        : "General fitness";

    const strengthSets = sets.filter((set) => {
      const weight = toNumber(set.weight);
      const reps = toNumber(set.reps);
      return weight > 0 && reps > 0;
    });

    const totalWeightMoved = strengthSets.reduce(
      (sum, set) => sum + toNumber(set.weight) * toNumber(set.reps),
      0
    );

    const totalRepsCompleted = strengthSets.reduce(
      (sum, set) => sum + toNumber(set.reps),
      0
    );

    const totalSetsCompleted = strengthSets.length;

    const allSortedWorkouts = [...workouts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const recentWorkouts: WorkoutWithStats[] = allSortedWorkouts.map((workout) => {
      const workoutSets = sets.filter((set) => set.workout_id === workout.id);
      const workoutCardio = cardio.filter((entry) => entry.workout_id === workout.id);

      const cardioDurationSeconds = workoutCardio.reduce(
        (sum, entry) => sum + toNumber(entry.duration_seconds),
        0
      );

      const cardioMiles = workoutCardio.reduce((sum, entry) => sum + toNumber(entry.miles), 0);

      const exerciseCount = new Set(
        workoutSets.map((set) => (set.exercise_name?.trim() || "Unknown Exercise").trim())
      ).size;

      const workoutName = getWorkoutDisplayName({
        workout,
        sets: workoutSets,
        cardio: workoutCardio,
      });

      return {
        ...workout,
        totalSets: workoutSets.length,
        exerciseCount,
        cardioEntries: workoutCardio.length,
        cardioDurationSeconds,
        cardioMiles,
        displayName: workoutName.name,
        autoNamed: workoutName.autoNamed,
      };
    });

    const totalWorkouts = workouts.length;

    const avgSessionSeconds =
      workouts.length > 0
        ? Math.round(
            workouts.reduce((sum, workout) => sum + toNumber(workout.duration_seconds), 0) /
              workouts.length
          )
        : 0;

    const last14Days = new Date();
    last14Days.setDate(last14Days.getDate() - 13);

    const recent14Workouts = workouts.filter(
      (workout) => new Date(workout.created_at) >= last14Days
    ).length;

    const bodyPartMap = new Map<string, number>();

    for (const set of sets) {
      const bodyPart = normalizeBodyPart(set.body_part);
      bodyPartMap.set(bodyPart, (bodyPartMap.get(bodyPart) ?? 0) + 1);
    }

    const bodyPartSummary: BodyPartSummary[] = Array.from(bodyPartMap.entries())
      .map(([bodyPart, sets]) => ({
        bodyPart,
        sets,
      }))
      .sort((a, b) => b.sets - a.sets);

    const bodyweight = toNumber(profile?.bodyweight) || 205;
    const avgWeightPerSet =
      strengthSets.length > 0 ? totalWeightMoved / strengthSets.length : 0;
    const workloadScore = totalSetsCompleted + Math.round(totalRepsCompleted / 12);

    let frequencyLabel = "Needs Work";
    let frequencyDetail =
      "Your recent training frequency is below what usually works best for this goal.";

    let workloadLabel = "Needs Work";
    let workloadDetail =
      "Your current training output is still lighter than ideal for this goal.";

    let intensityLabel = "Needs Work";
    let intensityDetail =
      "Your logged loading is still on the lighter side for this goal.";

    if (goal === "hypertrophy") {
      if (recent14Workouts >= 8) {
        frequencyLabel = "Dialed In";
        frequencyDetail =
          "You’re training often enough to repeatedly stimulate muscle growth.";
      } else if (recent14Workouts >= 5) {
        frequencyLabel = "Strong";
        frequencyDetail =
          "Your training frequency is in a very good place for building muscle.";
      } else if (recent14Workouts >= 3) {
        frequencyLabel = "Decent";
        frequencyDetail =
          "This can support muscle growth, but another weekly session would help.";
      }

      if (workloadScore >= 180) {
        workloadLabel = "High";
        workloadDetail =
          "Your rep and set output is high enough to support a serious hypertrophy workload.";
      } else if (workloadScore >= 90) {
        workloadLabel = "Solid";
        workloadDetail =
          "Your total work is in a productive range for muscle-building.";
      } else if (workloadScore >= 40) {
        workloadLabel = "Building";
        workloadDetail =
          "You’ve started building a useful training base, but more weekly work would help.";
      }

      if (avgWeightPerSet >= 185) {
        intensityLabel = "High";
        intensityDetail =
          "You’re using heavy loading, which can work well as long as recovery stays on track.";
      } else if (avgWeightPerSet >= 105) {
        intensityLabel = "Optimal";
        intensityDetail =
          "Your loading looks well-suited for productive hypertrophy work.";
      } else if (avgWeightPerSet >= 65) {
        intensityLabel = "Moderate";
        intensityDetail =
          "Your loading is workable, but there’s room to keep progressing.";
      }
    } else if (goal === "strength") {
      if (recent14Workouts >= 6) {
        frequencyLabel = "Dialed In";
        frequencyDetail =
          "Your recent training frequency supports practicing key lifts often enough to build strength.";
      } else if (recent14Workouts >= 4) {
        frequencyLabel = "Strong";
        frequencyDetail =
          "You’re training frequently enough to make real strength progress.";
      } else if (recent14Workouts >= 2) {
        frequencyLabel = "Decent";
        frequencyDetail =
          "This can work for strength, but more exposure to your main lifts would help.";
      }

      if (workloadScore >= 160) {
        workloadLabel = "High";
        workloadDetail =
          "You’re doing a lot of total work. Just make sure recovery and lift quality stay high.";
      } else if (workloadScore >= 80) {
        workloadLabel = "Solid";
        workloadDetail =
          "Your workload is enough to support strength progress without looking excessive.";
      } else if (workloadScore >= 35) {
        workloadLabel = "Building";
        workloadDetail =
          "You have enough work logged to build from, but more structured exposure would help.";
      }

      if (avgWeightPerSet >= 185) {
        intensityLabel = "Strong";
        intensityDetail =
          "Your average loading fits a strength-oriented approach well.";
      } else if (avgWeightPerSet >= 125) {
        intensityLabel = "Moderate";
        intensityDetail =
          "You’re lifting with respectable load, but there may be room to push heavier work.";
      } else if (avgWeightPerSet >= 75) {
        intensityLabel = "Building";
        intensityDetail =
          "The loading is workable, but strength progress usually wants heavier exposure over time.";
      }
    } else if (goal === "fat_loss") {
      if (recent14Workouts >= 8) {
        frequencyLabel = "Dialed In";
        frequencyDetail = "Your training frequency is excellent for a fat-loss phase.";
      } else if (recent14Workouts >= 5) {
        frequencyLabel = "Strong";
        frequencyDetail =
          "You’re training often enough to support a strong fat-loss routine.";
      } else if (recent14Workouts >= 3) {
        frequencyLabel = "Decent";
        frequencyDetail =
          "This gives you a workable base, but more training frequency would help.";
      }

      if (workloadScore >= 170) {
        workloadLabel = "High";
        workloadDetail =
          "Your total output is high, which is a good sign for a productive fat-loss phase.";
      } else if (workloadScore >= 85) {
        workloadLabel = "Solid";
        workloadDetail =
          "Your workload is in a useful range for maintaining progress while cutting.";
      } else if (workloadScore >= 35) {
        workloadLabel = "Building";
        workloadDetail =
          "You’ve started building enough output, but more total work would help.";
      }

      if (avgWeightPerSet >= 165) {
        intensityLabel = "Strong";
        intensityDetail =
          "You’re keeping enough load in your training to help preserve performance.";
      } else if (avgWeightPerSet >= 85) {
        intensityLabel = "Optimal";
        intensityDetail =
          "Your loading is in a good range for preserving muscle while keeping training sustainable.";
      } else if (avgWeightPerSet >= 50) {
        intensityLabel = "Moderate";
        intensityDetail =
          "Your intensity is usable, but make sure you don’t let performance drop too low.";
      }
    } else {
      if (recent14Workouts >= 6) {
        frequencyLabel = "Dialed In";
        frequencyDetail =
          "Your training frequency is excellent for general fitness and consistency.";
      } else if (recent14Workouts >= 4) {
        frequencyLabel = "Strong";
        frequencyDetail =
          "You’re training often enough to support a strong general fitness base.";
      } else if (recent14Workouts >= 2) {
        frequencyLabel = "Decent";
        frequencyDetail =
          "You have a good start, and a little more consistency would improve results.";
      }

      if (workloadScore >= 140) {
        workloadLabel = "High";
        workloadDetail =
          "You’re putting together a lot of overall work across your training.";
      } else if (workloadScore >= 70) {
        workloadLabel = "Solid";
        workloadDetail =
          "Your workload is in a productive range for general fitness.";
      } else if (workloadScore >= 30) {
        workloadLabel = "Building";
        workloadDetail =
          "You’re building a base, but more training output would improve momentum.";
      }

      if (avgWeightPerSet >= 165) {
        intensityLabel = "Strong";
        intensityDetail =
          "Your loading is solid and supports broad fitness progress well.";
      } else if (avgWeightPerSet >= 85) {
        intensityLabel = "Balanced";
        intensityDetail =
          "Your loading looks balanced for general strength and fitness work.";
      } else if (avgWeightPerSet >= 50) {
        intensityLabel = "Moderate";
        intensityDetail =
          "Your loading is reasonable, with room to keep progressing over time.";
      }
    }

    const goalSummary = (() => {
      if (
        (frequencyLabel === "Dialed In" || frequencyLabel === "Strong") &&
        (workloadLabel === "High" || workloadLabel === "Solid") &&
        (intensityLabel === "Optimal" ||
          intensityLabel === "Strong" ||
          intensityLabel === "Balanced" ||
          intensityLabel === "High")
      ) {
        return "Your current training pattern is lining up well with your stated goal.";
      }

      if (frequencyLabel === "Needs Work") {
        return "Your goal fit would improve most by increasing how often you train each week.";
      }

      if (workloadLabel === "Needs Work" || workloadLabel === "Building") {
        return "You’re on the board, but your total training output still has room to climb.";
      }

      if (intensityLabel === "Needs Work" || intensityLabel === "Building") {
        return "Your overall loading could be pushed a bit more to better match your goal.";
      }

      return "Your training is moving in the right direction, with a few areas that can tighten up.";
    })();

    const goalTile: GoalTile = {
      goalLabel,
      frequencyLabel,
      frequencyDetail,
      workloadLabel,
      workloadDetail,
      intensityLabel,
      intensityDetail,
      summary: goalSummary,
    };

    const strongestExercise = (() => {
      const exerciseBestMap = new Map<string, { e1rm: number; bodyPart: string }>();

      for (const set of strengthSets) {
        const name = (set.exercise_name?.trim() || "Unknown Exercise").trim();
        const bodyPart = normalizeBodyPart(set.body_part);
        const e1rm = estimate1RM(toNumber(set.weight), toNumber(set.reps));
        const current = exerciseBestMap.get(name);

        if (!current || e1rm > current.e1rm) {
          exerciseBestMap.set(name, { e1rm, bodyPart });
        }
      }

      const best = Array.from(exerciseBestMap.entries()).sort((a, b) => b[1].e1rm - a[1].e1rm)[0];
      if (!best) return null;

      return {
        name: best[0],
        bestE1RM: Math.round(best[1].e1rm),
        bodyPart: best[1].bodyPart,
        strengthLevel: getStrengthLevelLabel(best[1].e1rm, bodyweight),
      };
    })();

    const aiInsightsFallback: string[] = [
      totalWorkouts > 0
        ? `You’ve logged ${totalWorkouts} total workouts so far, which gives you a real base for progress tracking.`
        : "Log a few workouts first so the review can become more useful.",
      strongestExercise
        ? `${strongestExercise.name} currently stands out as your strongest lift based on estimated 1RM.`
        : "You need more strength data before true lift trends become clear.",
      "Keep repeating key lifts, track honest reps, and let your progress page tell the story.",
    ];

    return {
      goalLabel,
      totalWorkouts,
      avgSessionSeconds,
      recentWorkouts,
      visibleRecentWorkouts: recentWorkouts.slice(0, visibleWorkoutCount),
      bodyPartSummary,
      goalTile,
      strongestExercise,
      aiInsightsFallback,
      hasMoreWorkouts: recentWorkouts.length > visibleWorkoutCount,
    };
  }, [profile, workouts, sets, cardio, visibleWorkoutCount]);

  useEffect(() => {
    if (!workouts.length && !sets.length && !cardio.length) return;

    const payload = {
      goal: computed.goalLabel,
      totalWorkouts: computed.totalWorkouts,
      avgSessionSeconds: computed.avgSessionSeconds,
      goalTile: computed.goalTile,
      bodyPartSummary: computed.bodyPartSummary.slice(0, 6),
      strongestExercise: computed.strongestExercise,
    };

    let cancelled = false;

    async function loadAIInsights() {
      try {
        setAiInsightsLoading(true);

        const res = await fetch("/api/progress-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error("Failed to fetch AI insights");
        }

        const data = (await res.json()) as AIInsights;

        if (!cancelled) {
          setAiInsights(data);
        }
      } catch (error) {
        console.error("AI insights fetch failed:", error);
      } finally {
        if (!cancelled) {
          setAiInsightsLoading(false);
        }
      }
    }

    void loadAIInsights();

    return () => {
      cancelled = true;
    };
  }, [workouts.length, sets.length, cardio.length, computed]);

  const selectedWorkoutReport = useMemo(() => {
    if (!selectedWorkoutId) return null;

    const workout = workouts.find((item) => item.id === selectedWorkoutId);
    if (!workout) return null;

    const workoutSets = sets.filter((set) => set.workout_id === selectedWorkoutId);
    const workoutCardio = cardio.filter((entry) => entry.workout_id === selectedWorkoutId);

    const groupedExercises = new Map<
      string,
      {
        name: string;
        bodyPart: string;
        sets: { setNumber: number; weight: number; reps: number }[];
      }
    >();

    for (const set of workoutSets) {
      const name = (set.exercise_name?.trim() || "Unknown Exercise").trim();
      const bodyPart = normalizeBodyPart(set.body_part);

      const current = groupedExercises.get(name) ?? {
        name,
        bodyPart,
        sets: [],
      };

      current.sets.push({
        setNumber: toNumber(set.set_number),
        weight: toNumber(set.weight),
        reps: toNumber(set.reps),
      });

      groupedExercises.set(name, current);
    }

    const exercises = Array.from(groupedExercises.values());

    const totalCardioDuration = workoutCardio.reduce(
      (sum, entry) => sum + toNumber(entry.duration_seconds),
      0
    );

    const totalCardioMiles = workoutCardio.reduce(
      (sum, entry) => sum + toNumber(entry.miles),
      0
    );

    const exerciseCount = new Set(
      workoutSets.map((set) => (set.exercise_name?.trim() || "Unknown Exercise").trim())
    ).size;

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
      totalSets: workoutSets.length,
      totalCardioDuration,
      totalCardioMiles,
      exerciseCount,
    };
  }, [selectedWorkoutId, workouts, sets, cardio]);
    if (loading) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <p style={eyebrowStyle}>RESPAWN PROGRESS REVIEW</p>
          <h1 style={heroTitleStyle}>Loading your review...</h1>
          <p style={heroSubStyle}>
            Reading your workouts, cardio sessions, and goal alignment data.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <p style={eyebrowStyle}>RESPAWN PROGRESS REVIEW</p>
        <h1 style={heroTitleStyle}>Your Progress Review</h1>
        <p style={heroSubStyle}>
          Goal: {computed.goalTile.goalLabel} • Built from your real training data
        </p>

        <div style={heroStatsRowStyle}>
          <div style={heroStatBoxStyle}>
            <div style={heroStatLabelStyle}>Total Workouts</div>
            <div style={heroStatValueStyle}>{computed.totalWorkouts}</div>
          </div>

          <div style={heroStatBoxStyle}>
            <div style={heroStatLabelStyle}>Avg Session</div>
            <div style={heroStatValueStyle}>
              {computed.avgSessionSeconds ? formatMinutesRounded(computed.avgSessionSeconds) : "--"}
            </div>
          </div>
        </div>
      </section>

      <section style={twoColumnGridStyle}>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Goal Alignment</h2>
          </div>

          <div style={goalHeroCardStyle}>
            <div style={goalHeroLabelStyle}>Current Goal</div>
            <div style={goalHeroValueStyle}>{computed.goalTile.goalLabel}</div>
            <p style={goalHeroSummaryStyle}>{computed.goalTile.summary}</p>
          </div>

          <div style={goalMetricGridStyle}>
            <div style={goalMetricCardStyle}>
              <div style={goalMetricLabelStyle}>Training Frequency</div>
              <div style={goalMetricValueStyle}>{computed.goalTile.frequencyLabel}</div>
              <div style={goalMetricSubStyle}>{computed.goalTile.frequencyDetail}</div>
            </div>

            <div style={goalMetricCardStyle}>
              <div style={goalMetricLabelStyle}>Workload</div>
              <div style={goalMetricValueStyle}>{computed.goalTile.workloadLabel}</div>
              <div style={goalMetricSubStyle}>{computed.goalTile.workloadDetail}</div>
            </div>

            <div style={goalMetricCardStyle}>
              <div style={goalMetricLabelStyle}>Intensity</div>
              <div style={goalMetricValueStyle}>{computed.goalTile.intensityLabel}</div>
              <div style={goalMetricSubStyle}>{computed.goalTile.intensityDetail}</div>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Body Part Split</h2>
          </div>

          {computed.bodyPartSummary.length > 0 ? (
            <div style={barChartListStyle}>
              {computed.bodyPartSummary.map((item) => {
                const maxSets = Math.max(...computed.bodyPartSummary.map((b) => b.sets), 1);
                const width = `${Math.max((item.sets / maxSets) * 100, 8)}%`;

                return (
                  <div key={item.bodyPart} style={barRowStyle}>
                    <div style={barRowTopStyle}>
                      <span style={barLabelStyle}>{item.bodyPart}</span>
                      <span style={barValueStyle}>{item.sets} sets</span>
                    </div>

                    <div style={barTrackStyle}>
                      <div style={{ ...barFillStyle, width }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={mutedStyle}>No body-part data yet.</p>
          )}
        </section>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Recent Workouts</h2>
        </div>

        {computed.visibleRecentWorkouts.length > 0 ? (
          <>
            <div style={workoutListStyle}>
              {computed.visibleRecentWorkouts.map((workout) => (
                <div key={workout.id} style={workoutCardStyle}>
                  <div style={workoutCardTopStyle}>
                    <div>
                      <div style={workoutNameStyle}>{workout.displayName}</div>
                      <div style={workoutMetaStyle}>{formatDateTime(workout.created_at)}</div>
                    </div>

                    <div style={workoutActionColumnStyle}>
                      <button
                        style={viewButtonStyle}
                        onClick={() =>
                          setSelectedWorkoutId(
                            selectedWorkoutId === workout.id ? null : workout.id
                          )
                        }
                      >
                        {selectedWorkoutId === workout.id ? "Close Report" : "Open Report"}
                      </button>

                      <button
                        onClick={() => handleDeleteWorkout(workout.id)}
                        disabled={deletingWorkoutId === workout.id}
                        style={{
                          ...deleteWorkoutButtonStyle,
                          opacity: deletingWorkoutId === workout.id ? 0.6 : 1,
                          cursor: deletingWorkoutId === workout.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {deletingWorkoutId === workout.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>

                  <div style={workoutBadgeRowStyle}>
                    <span style={workoutBadgeStyle}>
                      {workout.exerciseCount}{" "}
                      {workout.exerciseCount === 1 ? "exercise" : "exercises"}
                    </span>
                    <span style={workoutBadgeStyle}>{workout.totalSets} sets</span>

                    {workout.cardioEntries > 0 ? (
                      <span style={workoutBadgeStyle}>
                        {workout.cardioEntries} cardio{" "}
                        {workout.cardioEntries === 1 ? "entry" : "entries"}
                      </span>
                    ) : null}

                    {workout.cardioDurationSeconds > 0 ? (
                      <span style={workoutBadgeStyle}>
                        {formatMinutesRounded(workout.cardioDurationSeconds)}
                      </span>
                    ) : null}

                    {workout.cardioMiles > 0 ? (
                      <span style={workoutBadgeStyle}>{formatMiles(workout.cardioMiles)} mi</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div style={showMoreRowStyle}>
              {computed.hasMoreWorkouts ? (
                <button
                  onClick={() => setVisibleWorkoutCount((prev) => prev + 8)}
                  style={secondaryButtonStyle}
                >
                  Show Older Workouts
                </button>
              ) : workouts.length > 8 ? (
                <button
                  onClick={() => setVisibleWorkoutCount(8)}
                  style={secondaryButtonStyle}
                >
                  Show Less
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <p style={mutedStyle}>No workouts logged yet.</p>
        )}
      </section>

      {selectedWorkoutReport ? (
        <section ref={reportRef} style={selectedReportCardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>
              Workout Report — {selectedWorkoutReport.displayName}
            </h2>
            <button onClick={() => setSelectedWorkoutId(null)} style={viewButtonStyle}>
              Close
            </button>
          </div>

          <p style={reportIntroStyle}>
            Clean workout snapshot built from your logged lifting and cardio data.
          </p>

          <div style={heroStatsRowStyle}>
            <div style={heroStatBoxStyle}>
              <div style={heroStatLabelStyle}>Exercises</div>
              <div style={heroStatValueStyle}>{selectedWorkoutReport.exerciseCount}</div>
            </div>

            <div style={heroStatBoxStyle}>
              <div style={heroStatLabelStyle}>Sets</div>
              <div style={heroStatValueStyle}>{selectedWorkoutReport.totalSets}</div>
            </div>

            <div style={heroStatBoxStyle}>
              <div style={heroStatLabelStyle}>Session Time</div>
              <div style={heroStatValueStyle}>
                {selectedWorkoutReport.workout.duration_seconds
                  ? formatMinutesRounded(selectedWorkoutReport.workout.duration_seconds)
                  : "--"}
              </div>
            </div>

            {selectedWorkoutReport.totalCardioDuration > 0 ? (
              <div style={heroStatBoxStyle}>
                <div style={heroStatLabelStyle}>Cardio Time</div>
                <div style={heroStatValueStyle}>
                  {formatMinutesRounded(selectedWorkoutReport.totalCardioDuration)}
                </div>
              </div>
            ) : null}

            {selectedWorkoutReport.totalCardioMiles > 0 ? (
              <div style={heroStatBoxStyle}>
                <div style={heroStatLabelStyle}>Cardio Distance</div>
                <div style={heroStatValueStyle}>
                  {formatMiles(selectedWorkoutReport.totalCardioMiles)}
                </div>
              </div>
            ) : null}
          </div>

          <div style={reportGridStyle}>
            <section style={reportSubCardStyle}>
              <div style={reportSubTitleStyle}>Exercises Completed</div>

              {selectedWorkoutReport.exercises.length > 0 ? (
                <div style={exerciseListStyle}>
                  {selectedWorkoutReport.exercises.map((exercise) => {
                    const exerciseKey = `${selectedWorkoutReport.workout.id}-${exercise.name}`;
                    const isExpanded = !!expandedExercises[exerciseKey];

                    return (
                      <div key={exercise.name} style={exerciseCardStyle}>
                        <button
                          type="button"
                          onClick={() => toggleExercise(exerciseKey)}
                          style={exerciseToggleButtonStyle}
                        >
                          <div>
                            <div style={exerciseNameStyle}>{exercise.name}</div>
                            <div style={exerciseMetaStyle}>
                              {exercise.bodyPart} • {exercise.sets.length} sets
                            </div>
                          </div>

                          <div style={exerciseExpandLabelStyle}>
                            {isExpanded ? "Hide sets" : "View sets"}
                          </div>
                        </button>

                        {isExpanded ? (
                          <div style={setTableStyle}>
                            {exercise.sets.map((set, index) => (
                              <div key={`${exercise.name}-${index}`} style={setRowStyle}>
                                <span>Set {set.setNumber || index + 1}</span>
                                <span>{set.weight || "--"} lb</span>
                                <span>{set.reps || "--"} reps</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={mutedStyle}>No lifting sets logged in this workout.</p>
              )}
            </section>

            {selectedWorkoutReport.cardioEntries.length > 0 ? (
              <section style={reportSubCardStyle}>
                <div style={reportSubTitleStyle}>Cardio Inside This Workout</div>

                <div style={exerciseListStyle}>
                  {selectedWorkoutReport.cardioEntries.map((entry) => (
                    <div key={entry.id} style={exerciseCardStyle}>
                      <div style={exerciseHeaderStyle}>
                        <div>
                          <div style={exerciseNameStyle}>
                            {entry.method ? titleCase(entry.method) : "Cardio"}
                          </div>
                          <div style={exerciseMetaStyle}>Logged cardio entry</div>
                        </div>
                      </div>

                      <div style={cardioSummaryRowStyle}>
                        {entry.duration_seconds ? (
                          <span style={workoutBadgeStyle}>
                            {formatMinutesRounded(entry.duration_seconds)}
                          </span>
                        ) : null}

                        {toNumber(entry.miles) > 0 ? (
                          <span style={workoutBadgeStyle}>
                            {formatMiles(toNumber(entry.miles))} mi
                          </span>
                        ) : null}
                      </div>

                      {entry.notes ? (
                        <div style={exerciseMetaStyle}>{entry.notes}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </section>
      ) : null}

      <section style={twoColumnGridStyle}>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>AI Insights</h2>
          </div>

          <div style={insightListStyle}>
            <div style={insightCardStyle}>
              <div style={insightLabelStyle}>Top Win</div>
              <div style={insightTextStyle}>
                {aiInsights?.topWin || computed.aiInsightsFallback[0]}
              </div>
            </div>

            <div style={insightCardStyle}>
              <div style={insightLabelStyle}>Top Concern</div>
              <div style={insightTextStyle}>
                {aiInsights?.topConcern || computed.aiInsightsFallback[1]}
              </div>
            </div>

            <div style={insightCardStyle}>
              <div style={insightLabelStyle}>Next Best Move</div>
              <div style={insightTextStyle}>
                {aiInsights?.nextBestMove || computed.aiInsightsFallback[2]}
              </div>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Review Highlights</h2>
          </div>

          <div style={highlightGridStyle}>
            <div style={highlightCardStyle}>
              <div style={highlightLabelStyle}>Goal</div>
              <div style={highlightMainStyle}>{computed.goalTile.goalLabel}</div>
              <div style={highlightSubStyle}>Pulled from your saved profile</div>
            </div>

            <div style={highlightCardStyle}>
              <div style={highlightLabelStyle}>Frequency</div>
              <div style={highlightMainStyle}>{computed.goalTile.frequencyLabel}</div>
              <div style={highlightSubStyle}>{computed.goalTile.frequencyDetail}</div>
            </div>

            <div style={highlightCardStyle}>
              <div style={highlightLabelStyle}>Intensity</div>
              <div style={highlightMainStyle}>{computed.goalTile.intensityLabel}</div>
              <div style={highlightSubStyle}>{computed.goalTile.intensityDetail}</div>
            </div>
          </div>
        </section>
      </section>

      {status ? <p style={statusStyle}>{status}</p> : null}
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

const heroSubStyle: CSSProperties = {
  color: "#d0d0d0",
  fontSize: "15px",
  margin: 0,
};

const heroStatsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "10px",
  marginTop: "20px",
};

const heroStatBoxStyle: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "16px",
  padding: "14px 12px",
};

const heroStatLabelStyle: CSSProperties = {
  color: "#aaa",
  fontSize: "12px",
  marginBottom: "6px",
};

const heroStatValueStyle: CSSProperties = {
  color: "#fff",
  fontSize: "20px",
  fontWeight: 900,
};

const twoColumnGridStyle: CSSProperties = {
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

const selectedReportCardStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,26,26,0.10), rgba(18,18,18,1))",
  border: "1px solid rgba(255,107,107,0.25)",
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

const sectionTitleStyle: CSSProperties = {
  color: "#ff4d4d",
  margin: 0,
  fontSize: "18px",
  fontWeight: 800,
};

const goalHeroCardStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,26,26,0.10), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "18px",
  padding: "16px",
  marginBottom: "14px",
};

const goalHeroLabelStyle: CSSProperties = {
  color: "#ff9b9b",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: "8px",
};

const goalHeroValueStyle: CSSProperties = {
  color: "#fff",
  fontSize: "24px",
  fontWeight: 900,
  lineHeight: 1.2,
};

const goalHeroSummaryStyle: CSSProperties = {
  color: "#d8d8d8",
  fontSize: "14px",
  lineHeight: 1.55,
  marginTop: "10px",
  marginBottom: 0,
};

const goalMetricGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
};

const goalMetricCardStyle: CSSProperties = {
  background: "#171717",
  border: "1px solid #252525",
  borderRadius: "16px",
  padding: "14px",
};

const goalMetricLabelStyle: CSSProperties = {
  color: "#aaa",
  fontSize: "12px",
  marginBottom: "8px",
};

const goalMetricValueStyle: CSSProperties = {
  color: "#fff",
  fontSize: "22px",
  fontWeight: 900,
  marginBottom: "8px",
};

const goalMetricSubStyle: CSSProperties = {
  color: "#b8b8b8",
  fontSize: "13px",
  lineHeight: 1.45,
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

const workoutListStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
};

const workoutCardStyle: CSSProperties = {
  background: "#171717",
  border: "1px solid #252525",
  borderRadius: "16px",
  padding: "14px",
};

const workoutCardTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  marginBottom: "10px",
};

const workoutActionColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  alignItems: "flex-end",
  flexShrink: 0,
};

const workoutNameStyle: CSSProperties = {
  color: "#fff",
  fontWeight: 800,
  fontSize: "15px",
};

const workoutMetaStyle: CSSProperties = {
  color: "#8f8f8f",
  fontSize: "13px",
  marginTop: "4px",
};

const workoutBadgeRowStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const workoutBadgeStyle: CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.06)",
  color: "#dddddd",
  borderRadius: "999px",
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 700,
};

const viewButtonStyle: CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "8px 12px",
  fontSize: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const deleteWorkoutButtonStyle: CSSProperties = {
  background: "rgba(255, 77, 77, 0.10)",
  border: "1px solid rgba(255, 77, 77, 0.28)",
  color: "#ff9c9c",
  borderRadius: "10px",
  padding: "8px 12px",
  fontSize: "12px",
  fontWeight: 800,
};

const secondaryButtonStyle: CSSProperties = {
  background: "#222",
  border: "1px solid #333",
  padding: "12px 16px",
  borderRadius: "10px",
  color: "white",
  fontWeight: 700,
  fontSize: "14px",
  cursor: "pointer",
};

const showMoreRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: "16px",
};

const reportIntroStyle: CSSProperties = {
  color: "#d7d7d7",
  fontSize: "14px",
  lineHeight: 1.55,
  marginTop: 0,
  marginBottom: "16px",
};

const reportGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
  marginTop: "16px",
};

const reportSubCardStyle: CSSProperties = {
  background: "#171717",
  border: "1px solid #252525",
  borderRadius: "16px",
  padding: "16px",
};

const reportSubTitleStyle: CSSProperties = {
  color: "#ff4d4d",
  fontSize: "15px",
  fontWeight: 800,
  marginBottom: "12px",
};

const exerciseListStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
};

const exerciseCardStyle: CSSProperties = {
  background: "#141414",
  border: "1px solid #232323",
  borderRadius: "14px",
  padding: "12px",
};

const exerciseHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
  marginBottom: "10px",
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

const exerciseToggleButtonStyle: CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  color: "inherit",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
};

const exerciseExpandLabelStyle: CSSProperties = {
  color: "#ff9b9b",
  fontSize: "12px",
  fontWeight: 800,
  flexShrink: 0,
};

const setTableStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
  marginTop: "12px",
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

const cardioSummaryRowStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
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

const insightLabelStyle: CSSProperties = {
  color: "#ff9b9b",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: "8px",
};

const insightTextStyle: CSSProperties = {
  color: "#f0f0f0",
  lineHeight: 1.5,
};

const highlightGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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

const mutedStyle: CSSProperties = {
  color: "#9f9f9f",
  margin: 0,
};

const statusStyle: CSSProperties = {
  color: "#cccccc",
  marginTop: "18px",
  marginBottom: 0,
};