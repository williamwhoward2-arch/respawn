import type { UserProfile, Workout, WorkoutSet } from "./types";

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

export function mapProfileRowToUserProfile(
  profile: ProfileRow | null | undefined,
  userId: string
): UserProfile {
  return {
    userId,
    name: profile?.name ?? null,
    age: profile?.age ?? null,
    sex: profile?.sex ?? null,
    height: profile?.height ?? null,
    bodyweight: profile?.bodyweight ?? null,
    waist: profile?.waist ?? null,
    goal: normalizeGoal(profile?.goal),
    focus: profile?.focus ?? null,
    experienceLevel: normalizeExperienceLevel(profile?.experience_level),
    equipmentAccess: normalizeEquipmentAccess(profile?.equipment_access),
  };
}

export function mapWorkoutRows(rows: WorkoutRow[] | null | undefined): Workout[] {
  if (!rows) return [];

  return rows.map((row) => ({
    id: row.id,
    workoutName: row.workout_name,
    createdAt: row.created_at,
    durationSeconds: row.duration_seconds ?? null,
    dayType: row.day_type ?? null,
    notes: row.notes ?? null,
  }));
}

export function mapWorkoutSetRows(rows: WorkoutSetRow[] | null | undefined): WorkoutSet[] {
  if (!rows) return [];

  return rows.map((row) => ({
    id: row.id,
    workoutId: row.workout_id,
    exerciseName: row.exercise_name,
    bodyPart: row.body_part ?? null,
    setNumber: row.set_number,
    weight: row.weight,
    reps: row.reps,
    completed: row.completed ?? null,
    createdAt: row.created_at,
  }));
}

function normalizeGoal(value?: string | null): UserProfile["goal"] {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "strength") return "strength";
  if (v === "hypertrophy") return "hypertrophy";
  if (v === "fat_loss") return "fat_loss";
  if (v === "general") return "general";
  return "general";
}

function normalizeExperienceLevel(value?: string | null): UserProfile["experienceLevel"] {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "beginner") return "beginner";
  if (v === "intermediate") return "intermediate";
  if (v === "advanced") return "advanced";
  return "intermediate";
}

function normalizeEquipmentAccess(value?: string | null): UserProfile["equipmentAccess"] {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "full_gym") return "full_gym";
  if (v === "dumbbells_only") return "dumbbells_only";
  if (v === "barbell_rack") return "barbell_rack";
  if (v === "machines_only") return "machines_only";
  if (v === "bodyweight_only") return "bodyweight_only";
  if (v === "minimal_home_gym") return "minimal_home_gym";
  return "full_gym";
}