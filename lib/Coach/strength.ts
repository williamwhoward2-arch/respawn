import type { StrengthSnapshot, WorkoutSet } from "./types";
import { estimate1RM, parseNumber } from "./utils";

type ExercisePerformance = {
  liftName: string;
  bestWeight: number;
  bestReps: number;
  estimated1RM: number;
  lastPerformedAt: string | null;
};

function groupSetsByExercise(sets: WorkoutSet[]): Record<string, WorkoutSet[]> {
  return sets.reduce<Record<string, WorkoutSet[]>>((acc, set) => {
    const key = String(set.exerciseName ?? "").trim();
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(set);
    return acc;
  }, {});
}

function getBestPerformanceForExercise(exerciseName: string, sets: WorkoutSet[]): ExercisePerformance | null {
  let bestWeight = 0;
  let bestReps = 0;
  let bestE1RM = 0;
  let lastPerformedAt: string | null = null;

  for (const set of sets) {
    const weight = parseNumber(set.weight);
    const reps = parseNumber(set.reps);
    const e1rm = estimate1RM(weight, reps);

    if (e1rm > bestE1RM) {
      bestWeight = weight;
      bestReps = reps;
      bestE1RM = e1rm;
      lastPerformedAt = set.createdAt ?? null;
    }

    if (!lastPerformedAt || new Date(set.createdAt) > new Date(lastPerformedAt)) {
      lastPerformedAt = set.createdAt;
    }
  }

  if (!exerciseName || bestE1RM <= 0) return null;

  return {
    liftName: exerciseName,
    bestWeight,
    bestReps,
    estimated1RM: bestE1RM,
    lastPerformedAt,
  };
}

function calculateTrendForExercise(exerciseName: string, sets: WorkoutSet[]): "up" | "flat" | "down" {
  const relevant = sets
    .filter((s) => String(s.exerciseName ?? "").trim().toLowerCase() === exerciseName.toLowerCase())
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (relevant.length < 2) return "flat";

  const midpoint = Math.floor(relevant.length / 2);
  const older = relevant.slice(0, midpoint);
  const newer = relevant.slice(midpoint);

  const olderBest = Math.max(...older.map((s) => estimate1RM(parseNumber(s.weight), parseNumber(s.reps))), 0);
  const newerBest = Math.max(...newer.map((s) => estimate1RM(parseNumber(s.weight), parseNumber(s.reps))), 0);

  if (newerBest > olderBest + 3) return "up";
  if (newerBest < olderBest - 3) return "down";
  return "flat";
}

export function buildStrengthSnapshots(sets: WorkoutSet[]): StrengthSnapshot[] {
  const grouped = groupSetsByExercise(sets);

  return Object.entries(grouped)
    .map(([exerciseName, exerciseSets]) => {
      const best = getBestPerformanceForExercise(exerciseName, exerciseSets);
      if (!best) return null;

      return {
        ...best,
        trend: calculateTrendForExercise(exerciseName, exerciseSets),
      } satisfies StrengthSnapshot;
    })
    .filter((item): item is StrengthSnapshot => Boolean(item))
    .sort((a, b) => b.estimated1RM - a.estimated1RM);
}