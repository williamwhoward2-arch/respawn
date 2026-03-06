import {
  exerciseLibrary,
  type Goal,
  type BodyPart as ImportedBodyPart,
  type ExperienceLevel,
  type EquipmentAccess,
  type Exercise,
  type ExerciseCategory,
  type MovementPattern,
  type Muscle,
  type WorkoutTag,
} from "./workoutGeneratorData";

type SupportedBodyPart =
  | ImportedBodyPart
  | "push"
  | "pull"
  | "full_body";

export type GeneratedSet = {
  set_number: number;
  weight: string;
  reps: string;
};

export type GeneratedExercise = {
  exercise_name: string;
  body_part: string;
  sets: GeneratedSet[];
};

export type GeneratedWorkout = {
  workout_name: string;
  body_part: string;
  estimated_duration: number;
  exercises: GeneratedExercise[];
};

type GenerateWorkoutInput = {
  bodyPart: SupportedBodyPart;
  goal: Goal;
  duration: number;
  experienceLevel: ExperienceLevel;
  equipmentAccess: EquipmentAccess;
};

type WorkoutRules = {
  targetMuscles: Muscle[];
  preferredTags: WorkoutTag[];
  template: MovementPattern[];
};

const repSchemes: Record<
  Goal,
  Record<ExerciseCategory, { sets: number; reps: string }>
> = {
  strength: {
    main: { sets: 5, reps: "3-5" },
    accessory: { sets: 4, reps: "5-8" },
    isolation: { sets: 3, reps: "8-12" },
  },
  hypertrophy: {
    main: { sets: 4, reps: "6-8" },
    accessory: { sets: 3, reps: "8-10" },
    isolation: { sets: 3, reps: "10-15" },
  },
  fat_loss: {
    main: { sets: 3, reps: "8-10" },
    accessory: { sets: 3, reps: "10-12" },
    isolation: { sets: 2, reps: "12-15" },
  },
  general: {
    main: { sets: 3, reps: "6-10" },
    accessory: { sets: 3, reps: "8-12" },
    isolation: { sets: 2, reps: "10-15" },
  },
};

const experienceRank: Record<ExperienceLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getExerciseCount(duration: number, level: ExperienceLevel): number {
  if (duration <= 30) return level === "advanced" ? 4 : 3;
  if (duration <= 45) return level === "advanced" ? 5 : 4;
  if (duration <= 60) return level === "advanced" ? 6 : 5;
  return level === "advanced" ? 7 : 6;
}

function getSetAdjustment(level: ExperienceLevel): number {
  return level === "advanced" ? 1 : 0;
}

function buildSets(baseSets: number, reps: string): GeneratedSet[] {
  return Array.from({ length: baseSets }, (_, index) => ({
    set_number: index + 1,
    weight: "",
    reps,
  }));
}

function getWorkoutRules(bodyPart: SupportedBodyPart): WorkoutRules {
  switch (bodyPart) {
    case "chest":
      return {
        targetMuscles: ["chest", "front_delts", "triceps"],
        preferredTags: ["push", "upper", "full_body"],
        template: [
          "horizontal_press",
          "horizontal_press",
          "fly",
          "bodyweight_push",
        ],
      };

    case "back":
      return {
        targetMuscles: ["back", "lats", "upper_back", "rear_delts", "biceps"],
        preferredTags: ["pull", "upper", "full_body"],
        template: [
          "vertical_pull",
          "horizontal_pull",
          "horizontal_pull",
          "raise",
        ],
      };

    case "legs":
      return {
        targetMuscles: ["quads", "glutes", "hamstrings", "calves"],
        preferredTags: ["lower", "full_body"],
        template: ["squat", "hinge", "lunge", "calves"],
      };

    case "shoulders":
      return {
        targetMuscles: ["shoulders", "front_delts", "side_delts", "rear_delts"],
        preferredTags: ["push", "upper"],
        template: ["vertical_press", "raise", "raise"],
      };

    case "arms":
      return {
        targetMuscles: ["biceps", "triceps", "forearms"],
        preferredTags: ["push", "pull", "upper"],
        template: ["curl", "tricep_extension", "curl"],
      };

    case "push":
      return {
        targetMuscles: ["chest", "shoulders", "triceps"],
        preferredTags: ["push", "upper"],
        template: [
          "horizontal_press",
          "vertical_press",
          "raise",
          "tricep_extension",
        ],
      };

    case "pull":
      return {
        targetMuscles: ["back", "lats", "biceps"],
        preferredTags: ["pull", "upper"],
        template: ["vertical_pull", "horizontal_pull", "curl"],
      };

    case "full_body":
      return {
        targetMuscles: [
          "quads",
          "glutes",
          "hamstrings",
          "chest",
          "back",
          "shoulders",
        ],
        preferredTags: ["full_body"],
        template: [
          "squat",
          "hinge",
          "horizontal_press",
          "horizontal_pull",
          "vertical_pull",
        ],
      };
  }
}

function getDisplayBodyPart(
  exercise: Exercise,
  requestedBodyPart: SupportedBodyPart
): string {
  if (requestedBodyPart === "push") {
    if (exercise.primaryMuscle === "chest") return "chest";
    if (exercise.primaryMuscle === "triceps") return "arms";
    return "shoulders";
  }

  if (requestedBodyPart === "pull") {
    if (["back", "lats"].includes(exercise.primaryMuscle)) return "back";
    return "arms";
  }

  if (requestedBodyPart === "full_body") {
    if (["quads", "hamstrings", "glutes"].includes(exercise.primaryMuscle))
      return "legs";
    if (exercise.primaryMuscle === "chest") return "chest";
    if (["back", "lats"].includes(exercise.primaryMuscle)) return "back";
    return "shoulders";
  }

  switch (requestedBodyPart) {
    case "chest":
      return "chest";
    case "back":
      return "back";
    case "legs":
      return "legs";
    case "shoulders":
      return "shoulders";
    case "arms":
      return "arms";
    default:
      return "full_body";
  }
}

function getWorkoutTitle(bodyPart: SupportedBodyPart, goal: Goal): string {
  const map: Record<SupportedBodyPart, string> = {
    chest: "Chest Day",
    back: "Back Day",
    legs: "Leg Day",
    shoulders: "Shoulder Day",
    arms: "Arm Day",
    push: "Push Day",
    pull: "Pull Day",
    full_body: "Full Body",
  };

  const goalLabel = goal.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return `${map[bodyPart]} • ${goalLabel}`;
}

export function generateWorkout({
  bodyPart,
  goal,
  duration,
  experienceLevel,
  equipmentAccess,
}: GenerateWorkoutInput): GeneratedWorkout {
  const rules = getWorkoutRules(bodyPart);
  const exerciseCount = getExerciseCount(duration, experienceLevel);
  const setAdjustment = getSetAdjustment(experienceLevel);
  const scheme = repSchemes[goal];

  const basePool = exerciseLibrary.filter((exercise) => {
    const matchesEquipment = exercise.equipmentAccess.includes(equipmentAccess);
    const matchesLevel = exercise.levels.some(
      (level) => experienceRank[level] <= experienceRank[experienceLevel]
    );
    return matchesEquipment && matchesLevel;
  });

  const selected = shuffleArray(basePool).slice(0, exerciseCount);

  const generatedExercises: GeneratedExercise[] = selected.map((exercise) => {
    const template = scheme[exercise.category];
    const totalSets =
      exercise.category === "main"
        ? template.sets + setAdjustment
        : template.sets;

    return {
      exercise_name: exercise.name,
      body_part: getDisplayBodyPart(exercise, bodyPart),
      sets: buildSets(totalSets, template.reps),
    };
  });

  return {
    workout_name: getWorkoutTitle(bodyPart, goal),
    body_part: bodyPart,
    estimated_duration: duration,
    exercises: generatedExercises,
  };
}