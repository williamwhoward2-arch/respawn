import type { Workout, WorkoutSet } from "./types";
import { daysBetween, getExerciseBodyPart, isSetCompleted } from "./utils";

export type TrainingHistorySummary = {
  workoutsLast7Days: number;
  workoutsLast14Days: number;
  daysSinceLastWorkout: number | null;
  recentBodyParts: string[];
  weeklySetVolumeByBodyPart: Record<string, number>;
  consistencyStreak: number;
};

export function buildHistorySummary(workouts: Workout[], sets: WorkoutSet[]): TrainingHistorySummary {
  const now = new Date();

  const workoutsLast7Days = workouts.filter((w) => daysBetween(now, new Date(w.createdAt)) <= 7).length;
  const workoutsLast14Days = workouts.filter((w) => daysBetween(now, new Date(w.createdAt)) <= 14).length;

  const sortedWorkouts = [...workouts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const lastWorkout = sortedWorkouts[0];
  const daysSinceLastWorkout = lastWorkout ? Math.floor(daysBetween(now, new Date(lastWorkout.createdAt))) : null;

  const weeklySets = sets.filter((s) => daysBetween(now, new Date(s.createdAt)) <= 7 && isSetCompleted(s));

  const weeklySetVolumeByBodyPart = weeklySets.reduce<Record<string, number>>((acc, set) => {
    const bodyPart = getExerciseBodyPart(set);
    acc[bodyPart] = (acc[bodyPart] ?? 0) + 1;
    return acc;
  }, {});

  const recentBodyParts = Array.from(
    new Set(
      sets
        .filter((s) => daysBetween(now, new Date(s.createdAt)) <= 5)
        .map((s) => getExerciseBodyPart(s))
        .filter((bp) => bp !== "unknown")
    )
  );

  const activeDays = new Set(
    workouts
      .filter((w) => daysBetween(now, new Date(w.createdAt)) <= 14)
      .map((w) => new Date(w.createdAt).toISOString().slice(0, 10))
  );

  const consistencyStreak = activeDays.size;

  return {
    workoutsLast7Days,
    workoutsLast14Days,
    daysSinceLastWorkout,
    recentBodyParts,
    weeklySetVolumeByBodyPart,
    consistencyStreak,
  };
}