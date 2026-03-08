import { buildCoachSummary, toUserFacingCoachSummary } from "@/lib/coach/coachEngine";
import {
  mapProfileRowToUserProfile,
  mapWorkoutRows,
  mapWorkoutSetRows,
} from "@/lib/coach/mappers";

type ProfileRow = {
  user_id?: string | null;
  name?: string | null;
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

type WorkoutRow = {
  id: number;
  workout_name: string | null;
  created_at: string;
  duration_seconds?: number | null;
  day_type?: string | null;
  notes?: string | null;
};

type WorkoutSetRow = {
  id: number;
  workout_id: number;
  exercise_name: string | null;
  body_part?: string | null;
  set_number: number | null;
  weight: string | null;
  reps: string | null;
  completed?: boolean | null;
  created_at: string;
};

export function buildDashboardCoachData(args: {
  userId: string;
  profile: ProfileRow | null;
  workouts: WorkoutRow[];
  workoutSets: WorkoutSetRow[];
}) {
  const profile = mapProfileRowToUserProfile(args.profile, args.userId);
  const workouts = mapWorkoutRows(args.workouts);
  const sets = mapWorkoutSetRows(args.workoutSets);

  const internalSummary = buildCoachSummary({
    profile,
    workouts,
    sets,
  });

  const coach = toUserFacingCoachSummary(internalSummary);

  return {
    coach,
    internalSummary,
  };
}