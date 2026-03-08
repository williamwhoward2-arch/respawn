import type { PostWorkoutRecap, Workout, WorkoutSet } from "./types";
import { formatDuration, parseNumber } from "./utils";

function findBestSet(sets: WorkoutSet[]): WorkoutSet | null {
  let best: WorkoutSet | null = null;
  let bestScore = 0;

  for (const set of sets) {
    const weight = parseNumber(set.weight);
    const reps = parseNumber(set.reps);
    const score = weight * reps;

    if (score > bestScore) {
      best = set;
      bestScore = score;
    }
  }

  return best;
}

function findTopExerciseByVolume(sets: WorkoutSet[]): string | null {
  const volumeByExercise = sets.reduce<Record<string, number>>((acc, set) => {
    const name = String(set.exerciseName ?? "").trim();
    if (!name) return acc;

    const weight = parseNumber(set.weight);
    const reps = parseNumber(set.reps);
    const volume = weight * reps;

    acc[name] = (acc[name] ?? 0) + volume;
    return acc;
  }, {});

  const entries = Object.entries(volumeByExercise).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}

export function buildPostWorkoutRecap(args: {
  workout: Workout;
  currentSets: WorkoutSet[];
  historicalSets: WorkoutSet[];
}): PostWorkoutRecap {
  const completedSets = args.currentSets.filter((set) => {
    const reps = parseNumber(set.reps);
    const weight = parseNumber(set.weight);
    return reps > 0 || weight > 0;
  });

  const totalSets = completedSets.length;
  const totalReps = completedSets.reduce((sum, set) => sum + parseNumber(set.reps), 0);

  const bestSet = findBestSet(completedSets);
  const topExercise = findTopExerciseByVolume(completedSets);

  const highlights: string[] = [];

  if (topExercise) {
    highlights.push(`${topExercise} carried the most productive work in this session.`);
  }

  if (bestSet?.exerciseName) {
    highlights.push(
      `Best set: ${bestSet.exerciseName} — ${bestSet.weight ?? "0"} x ${bestSet.reps ?? "0"}.`
    );
  }

  if (highlights.length === 0) {
    highlights.push("You logged another session and kept the momentum moving.");
  }

  return {
    workoutName: args.workout.workoutName ?? "Workout",
    durationText: formatDuration(args.workout.durationSeconds ?? 0),
    totalSets,
    totalReps,
    topExercise,
    bestSet:
      bestSet?.exerciseName
        ? `${bestSet.exerciseName} — ${bestSet.weight ?? "0"} x ${bestSet.reps ?? "0"}`
        : null,
    highlights,
    nextSuggestion: "Recover well and train the next underworked muscle group.",
  };
}