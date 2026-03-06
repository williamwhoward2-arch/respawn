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
  for (let i = copy.length - 1; i > 0; i -= 1) {
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
        preferredTags: ["lower", "full_body", "glute_friendly"],
        template: ["squat", "hinge", "lunge", "squat", "calves"],
      };

    case "shoulders":
      return {
        targetMuscles: [
          "shoulders",
          "front_delts",
          "side_delts",
          "rear_delts",
          "triceps",
        ],
        preferredTags: ["push", "pull", "upper", "full_body"],
        template: ["vertical_press", "raise", "raise", "raise"],
      };

    case "arms":
      return {
        targetMuscles: ["biceps", "triceps", "forearms"],
        preferredTags: ["push", "pull", "upper"],
        template: ["curl", "curl", "tricep_extension", "tricep_extension"],
      };

    case "push":
      return {
        targetMuscles: [
          "chest",
          "shoulders",
          "front_delts",
          "triceps",
          "side_delts",
        ],
        preferredTags: ["push", "upper", "full_body"],
        template: [
          "horizontal_press",
          "vertical_press",
          "raise",
          "tricep_extension",
          "bodyweight_push",
        ],
      };

    case "pull":
      return {
        targetMuscles: [
          "back",
          "lats",
          "upper_back",
          "rear_delts",
          "biceps",
          "forearms",
        ],
        preferredTags: ["pull", "upper", "full_body"],
        template: [
          "vertical_pull",
          "horizontal_pull",
          "horizontal_pull",
          "curl",
          "raise",
        ],
      };

    case "full_body":
      return {
        targetMuscles: [
          "quads",
          "glutes",
          "hamstrings",
          "chest",
          "back",
          "lats",
          "shoulders",
          "core",
        ],
        preferredTags: ["full_body", "upper", "lower", "push", "pull"],
        template: [
          "squat",
          "hinge",
          "horizontal_press",
          "horizontal_pull",
          "vertical_pull",
          "core",
        ],
      };
  }
}

function isExerciseAllowedForLevel(
  exercise: Exercise,
  experienceLevel: ExperienceLevel
): boolean {
  return exercise.levels.some(
    (level) => experienceRank[level] <= experienceRank[experienceLevel]
  );
}

function strictMatch(exercise: Exercise, rules: WorkoutRules): boolean {
  const matchesPrimary = rules.targetMuscles.includes(exercise.primaryMuscle);
  const matchesSecondary = exercise.secondaryMuscles.some((muscle) =>
    rules.targetMuscles.includes(muscle)
  );
  const matchesTag = exercise.workoutTags.some((tag) =>
    rules.preferredTags.includes(tag)
  );

  return matchesPrimary || matchesSecondary || matchesTag;
}

function looseMatch(exercise: Exercise, bodyPart: SupportedBodyPart): boolean {
  switch (bodyPart) {
    case "chest":
      return ["chest", "front_delts", "triceps"].includes(exercise.primaryMuscle);

    case "back":
      return [
        "back",
        "lats",
        "upper_back",
        "lower_back",
        "rear_delts",
        "biceps",
      ].includes(exercise.primaryMuscle);

    case "legs":
      return ["quads", "glutes", "hamstrings", "calves"].includes(
        exercise.primaryMuscle
      );

    case "shoulders":
      return ["shoulders", "front_delts", "side_delts", "rear_delts"].includes(
        exercise.primaryMuscle
      );

    case "arms":
      return ["biceps", "triceps", "forearms"].includes(exercise.primaryMuscle);

    case "push":
      return exercise.workoutTags.includes("push");

    case "pull":
      return exercise.workoutTags.includes("pull");

    case "full_body":
      return true;
  }
}

function pickByPattern(
  pattern: MovementPattern,
  pool: Exercise[],
  usedNames: Set<string>
): Exercise | null {
  const exact = shuffleArray(
    pool.filter(
      (exercise) =>
        exercise.movementPattern === pattern && !usedNames.has(exercise.name)
    )
  );

  return exact[0] ?? null;
}

function pickAny(pool: Exercise[], usedNames: Set<string>): Exercise | null {
  const available = shuffleArray(
    pool.filter((exercise) => !usedNames.has(exercise.name))
  );
  return available[0] ?? null;
}

function getDisplayBodyPart(
  exercise: Exercise,
  requestedBodyPart: SupportedBodyPart
): string {
  if (requestedBodyPart === "push") {
    if (exercise.primaryMuscle === "chest") return "chest";
    if (
      ["shoulders", "front_delts", "side_delts", "rear_delts"].includes(
        exercise.primaryMuscle
      )
    ) {
      return "shoulders";
    }
    if (exercise.primaryMuscle === "triceps") return "arms";
    return "push";
  }

  if (requestedBodyPart === "pull") {
    if (
      ["back", "lats", "upper_back", "lower_back"].includes(
        exercise.primaryMuscle
      )
    ) {
      return "back";
    }
    if (exercise.primaryMuscle === "rear_delts") return "shoulders";
    if (["biceps", "forearms"].includes(exercise.primaryMuscle)) return "arms";
    return "pull";
  }

  if (requestedBodyPart === "full_body") {
    if (["quads", "hamstrings", "calves"].includes(exercise.primaryMuscle)) {
      return "legs";
    }
    if (exercise.primaryMuscle === "glutes") return "glutes";
    if (exercise.primaryMuscle === "core") return "core";
    if (exercise.primaryMuscle === "chest") return "chest";
    if (
      ["back", "lats", "upper_back", "lower_back"].includes(
        exercise.primaryMuscle
      )
    ) {
      return "back";
    }
    if (
      ["shoulders", "front_delts", "side_delts", "rear_delts"].includes(
        exercise.primaryMuscle
      )
    ) {
      return "shoulders";
    }
    if (["biceps", "triceps", "forearms"].includes(exercise.primaryMuscle)) {
      return "arms";
    }
    return "full_body";
  }

  switch (requestedBodyPart) {
    case "chest":
      return "chest";
    case "back":
      return "back";
    case "legs":
      return exercise.primaryMuscle === "glutes" ? "glutes" : "legs";
    case "shoulders":
      return "shoulders";
    case "arms":
      return "arms";
    case "push":
      return "push";
    case "pull":
      return "pull";
    case "full_body":
      return "full_body";
  }
}

function dedupeByName(exercises: Exercise[]): Exercise[] {
  const seen = new Set<string>();

  return exercises.filter((exercise) => {
    if (seen.has(exercise.name)) return false;
    seen.add(exercise.name);
    return true;
  });
}

function getWorkoutTitle(bodyPart: SupportedBodyPart, goal: Goal): string {
  const workoutTitleMap: Record<SupportedBodyPart, string> = {
    chest: "Chest Day",
    back: "Back Day",
    legs: "Leg Day",
    shoulders: "Shoulder Day",
    arms: "Arm Day",
    push: "Push Day",
    pull: "Pull Day",
    full_body: "Full Body",
  };

  const goalLabel = goal
    .replace("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return `${workoutTitleMap[bodyPart]} • ${goalLabel}`;
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
    const matchesLevel = isExerciseAllowedForLevel(exercise, experienceLevel);
    return matchesEquipment && matchesLevel;
  });

  if (basePool.length === 0) {
    throw new Error(
      "No exercises are available for that equipment and experience level yet."
    );
  }

  let filteredPool = basePool.filter((exercise) => strictMatch(exercise, rules));

  if (filteredPool.length === 0) {
    filteredPool = basePool.filter((exercise) => looseMatch(exercise, bodyPart));
  }

  if (filteredPool.length === 0) {
    filteredPool = basePool;
  }

  const selected: Exercise[] = [];
  const usedNames = new Set<string>();

  for (const pattern of rules.template) {
    if (selected.length >= exerciseCount) break;

    const picked = pickByPattern(pattern, filteredPool, usedNames);

    if (picked) {
      selected.push(picked);
      usedNames.add(picked.name);
    }
  }

  while (selected.length < exerciseCount) {
    const fallback = pickAny(filteredPool, usedNames);
    if (!fallback) break;

    selected.push(fallback);
    usedNames.add(fallback.name);
  }

  const finalExercises = dedupeByName(selected).slice(0, exerciseCount);

  if (finalExercises.length === 0) {
    throw new Error("No exercises matched the selected filters.");
  }

  const generatedExercises: GeneratedExercise[] = finalExercises.map(
    (exercise) => {
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
    }
  );

  return {
    workout_name: getWorkoutTitle(bodyPart, goal),
    body_part: bodyPart,
    estimated_duration: duration,
    exercises: generatedExercises,
  };
}