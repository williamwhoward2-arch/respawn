import type { RecoverySnapshot, Workout, WorkoutSet } from "./types";
import { clamp, daysBetween, getExerciseBodyPart, isSetCompleted } from "./utils";

export function buildRecoverySnapshot(workouts: Workout[], sets: WorkoutSet[]): RecoverySnapshot {
  const now = new Date();
  const reasons: string[] = [];

  let readinessScore = 80;
  let fatigueScore = 20;

  const recent4DayWorkouts = workouts.filter((w) => daysBetween(now, new Date(w.createdAt)) <= 4);
  const recent3DaySets = sets.filter((s) => daysBetween(now, new Date(s.createdAt)) <= 3 && isSetCompleted(s));
  const recent2DaySets = sets.filter((s) => daysBetween(now, new Date(s.createdAt)) <= 2 && isSetCompleted(s));

  if (recent4DayWorkouts.length >= 3) {
    readinessScore -= 20;
    fatigueScore += 20;
    reasons.push("Training frequency has been high over the last few days.");
  }

  const lowerRecentCount = recent2DaySets.filter((s) => getExerciseBodyPart(s) === "legs").length;
  if (lowerRecentCount >= 8) {
    readinessScore -= 15;
    fatigueScore += 15;
    reasons.push("Lower body has taken a solid amount of recent workload.");
  }

  const upperRecentCount = recent2DaySets.filter((s) => {
    const bp = getExerciseBodyPart(s);
    return bp === "chest" || bp === "back" || bp === "shoulders" || bp === "arms";
  }).length;

  if (upperRecentCount >= 12) {
    readinessScore -= 10;
    fatigueScore += 10;
    reasons.push("Upper body volume has been elevated recently.");
  }

  const avgRecentDuration =
    recent4DayWorkouts.length > 0
      ? recent4DayWorkouts.reduce((sum, w) => sum + (w.durationSeconds ?? 0), 0) / recent4DayWorkouts.length
      : 0;

  if (avgRecentDuration > 90 * 60) {
    readinessScore -= 10;
    fatigueScore += 8;
    reasons.push("Recent sessions have been running long.");
  }

  const lastWorkout = [...workouts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];

  if (lastWorkout) {
    const daysSinceLastWorkout = daysBetween(now, new Date(lastWorkout.createdAt));

    if (daysSinceLastWorkout >= 3) {
      readinessScore += 10;
      fatigueScore -= 5;
      reasons.push("You have had some time to recover since your last session.");
    }

    if (daysSinceLastWorkout >= 5) {
      readinessScore += 5;
      reasons.push("You look relatively fresh from a training-frequency standpoint.");
    }
  } else {
    readinessScore += 10;
    reasons.push("No recent workout history means fatigue is likely low.");
  }

  if (recent3DaySets.length === 0) {
    readinessScore += 5;
    fatigueScore -= 5;
  }

  readinessScore = clamp(readinessScore, 0, 100);
  fatigueScore = clamp(fatigueScore, 0, 100);

  let recoveryLabel: "high" | "moderate" | "low" = "moderate";
  if (readinessScore >= 75) recoveryLabel = "high";
  else if (readinessScore < 50) recoveryLabel = "low";

  return {
    readinessScore,
    fatigueScore,
    recoveryLabel,
    reasons,
  };
}