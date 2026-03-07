import {
  exerciseLibrary,
  type Goal,
  type BodyPart,
  type ExperienceLevel,
  type EquipmentAccess,
  type Exercise,
  type ExerciseCategory,
  type MovementPattern,
  type Muscle,
  type WorkoutTag,
} from "./workoutGeneratorData";

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
  bodyPart: BodyPart;
  goal: Goal;
  duration: number;
  experienceLevel: ExperienceLevel;
  equipmentAccess: EquipmentAccess;
};

type WorkoutRules = {
  targetMuscles: Muscle[];
  preferredTags: WorkoutTag[];
  template: MovementPattern[];
  allowedPatterns: MovementPattern[];
  maxPatternRepeats: Partial<Record<MovementPattern, number>>;
  maxPrimaryRepeats: number;
  fillPriorityPatterns?: MovementPattern[];
};

const repSchemes: Record<
  Goal,
  Record<ExerciseCategory, { sets: number; reps: string }>
> = {
  strength: {
    main: { sets: 5, reps: "3-5" },
    accessory: { sets: 3, reps: "5-8" },
    isolation: { sets: 2, reps: "8-12" },
  },
  hypertrophy: {
    main: { sets: 4, reps: "6-8" },
    accessory: { sets: 3, reps: "8-12" },
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

const categoryPriority: Record<ExerciseCategory, number> = {
  main: 1,
  accessory: 2,
  isolation: 3,
};

const movementPatternPriority: Record<MovementPattern, number> = {
  squat: 1,
  hinge: 2,
  horizontal_press: 3,
  vertical_press: 4,
  vertical_pull: 5,
  horizontal_pull: 6,
  lunge: 7,
  bodyweight_push: 8,
  bodyweight_pull: 9,
  fly: 10,
  raise: 11,
  curl: 12,
  tricep_extension: 13,
  calves: 14,
  core: 15,
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

function getSetAdjustment(level: ExperienceLevel, goal: Goal): number {
  if (goal === "strength" && level === "advanced") return 1;
  return 0;
}

function buildSets(baseSets: number, reps: string): GeneratedSet[] {
  return Array.from({ length: baseSets }, (_, index) => ({
    set_number: index + 1,
    weight: "",
    reps,
  }));
}

function getWorkoutRules(bodyPart: BodyPart): WorkoutRules {
  switch (bodyPart) {
    case "chest":
      return {
        targetMuscles: ["chest", "front_delts", "triceps"],
        preferredTags: ["push", "upper", "full_body"],
        template: ["horizontal_press", "horizontal_press", "fly", "bodyweight_push"],
        allowedPatterns: [
          "horizontal_press",
          "vertical_press",
          "fly",
          "bodyweight_push",
          "tricep_extension",
          "raise",
        ],
        maxPatternRepeats: {
          horizontal_press: 2,
          fly: 1,
          bodyweight_push: 1,
          tricep_extension: 1,
          raise: 1,
        },
        maxPrimaryRepeats: 3,
        fillPriorityPatterns: ["fly", "tricep_extension", "raise"],
      };

    case "back":
      return {
        targetMuscles: ["back", "lats", "upper_back", "rear_delts", "biceps"],
        preferredTags: ["pull", "upper", "full_body"],
        template: ["vertical_pull", "horizontal_pull", "horizontal_pull", "raise"],
        allowedPatterns: [
          "vertical_pull",
          "horizontal_pull",
          "bodyweight_pull",
          "raise",
          "hinge",
          "curl",
          "core",
        ],
        maxPatternRepeats: {
          vertical_pull: 2,
          horizontal_pull: 2,
          raise: 1,
          curl: 1,
          hinge: 1,
        },
        maxPrimaryRepeats: 2,
        fillPriorityPatterns: ["raise", "curl", "vertical_pull"],
      };

    case "legs":
      return {
        targetMuscles: ["quads", "glutes", "hamstrings", "calves"],
        preferredTags: ["lower", "full_body"],
        template: ["squat", "hinge", "lunge", "calves"],
        allowedPatterns: ["squat", "hinge", "lunge", "calves", "core"],
        maxPatternRepeats: {
          squat: 2,
          hinge: 2,
          lunge: 2,
          calves: 1,
          core: 1,
        },
        maxPrimaryRepeats: 2,
        fillPriorityPatterns: ["lunge", "calves", "core"],
      };

    case "shoulders":
      return {
        targetMuscles: ["shoulders", "front_delts", "side_delts", "rear_delts"],
        preferredTags: ["push", "upper"],
        template: ["vertical_press", "raise", "raise"],
        allowedPatterns: [
          "vertical_press",
          "raise",
          "horizontal_press",
          "bodyweight_push",
        ],
        maxPatternRepeats: {
          vertical_press: 2,
          raise: 3,
          horizontal_press: 1,
          bodyweight_push: 1,
        },
        maxPrimaryRepeats: 2,
        fillPriorityPatterns: ["raise", "raise", "vertical_press"],
      };

    case "arms":
      return {
        targetMuscles: ["biceps", "triceps", "forearms"],
        preferredTags: ["push", "pull", "upper"],
        template: ["curl", "tricep_extension", "curl"],
        allowedPatterns: ["curl", "tricep_extension", "horizontal_press"],
        maxPatternRepeats: {
          curl: 3,
          tricep_extension: 2,
          horizontal_press: 1,
        },
        maxPrimaryRepeats: 2,
        fillPriorityPatterns: ["tricep_extension", "curl"],
      };

    case "push":
      return {
        targetMuscles: ["chest", "shoulders", "front_delts", "side_delts", "triceps"],
        preferredTags: ["push", "upper"],
        template: ["horizontal_press", "vertical_press", "raise", "tricep_extension"],
        allowedPatterns: [
          "horizontal_press",
          "vertical_press",
          "fly",
          "raise",
          "tricep_extension",
          "bodyweight_push",
        ],
        maxPatternRepeats: {
          horizontal_press: 2,
          vertical_press: 1,
          fly: 1,
          raise: 1,
          tricep_extension: 1,
          bodyweight_push: 1,
        },
        maxPrimaryRepeats: 2,
        fillPriorityPatterns: ["fly", "tricep_extension", "raise"],
      };

    case "pull":
      return {
        targetMuscles: ["back", "lats", "upper_back", "rear_delts", "biceps"],
        preferredTags: ["pull", "upper"],
        template: ["vertical_pull", "horizontal_pull", "raise", "curl"],
        allowedPatterns: [
          "vertical_pull",
          "horizontal_pull",
          "bodyweight_pull",
          "raise",
          "curl",
          "hinge",
        ],
        maxPatternRepeats: {
          vertical_pull: 2,
          horizontal_pull: 2,
          raise: 1,
          curl: 1,
          hinge: 1,
        },
        maxPrimaryRepeats: 2,
        fillPriorityPatterns: ["curl", "raise", "vertical_pull"],
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
        preferredTags: ["full_body"],
        template: ["squat", "hinge", "horizontal_press", "horizontal_pull", "vertical_pull"],
        allowedPatterns: [
          "squat",
          "hinge",
          "lunge",
          "horizontal_press",
          "vertical_press",
          "horizontal_pull",
          "vertical_pull",
          "bodyweight_push",
          "bodyweight_pull",
          "core",
          "calves",
        ],
        maxPatternRepeats: {
          squat: 1,
          hinge: 1,
          lunge: 1,
          horizontal_press: 1,
          vertical_press: 1,
          horizontal_pull: 1,
          vertical_pull: 1,
          bodyweight_push: 1,
          bodyweight_pull: 1,
          core: 1,
          calves: 1,
        },
        maxPrimaryRepeats: 2,
        fillPriorityPatterns: ["lunge", "core", "calves"],
      };
  }
}

function getDisplayBodyPart(exercise: Exercise, requestedBodyPart: BodyPart): string {
  if (requestedBodyPart === "push") {
    if (exercise.primaryMuscle === "chest") return "chest";
    if (exercise.primaryMuscle === "triceps") return "arms";
    return "shoulders";
  }

  if (requestedBodyPart === "pull") {
    if (
      ["back", "lats", "upper_back", "rear_delts", "lower_back"].includes(
        exercise.primaryMuscle
      )
    ) {
      return "back";
    }
    return "arms";
  }

  if (requestedBodyPart === "full_body") {
    if (["quads", "hamstrings", "glutes", "calves"].includes(exercise.primaryMuscle)) {
      return "legs";
    }
    if (exercise.primaryMuscle === "chest") return "chest";
    if (
      ["back", "lats", "upper_back", "lower_back", "rear_delts"].includes(
        exercise.primaryMuscle
      )
    ) {
      return "back";
    }
    if (["biceps", "triceps", "forearms"].includes(exercise.primaryMuscle)) {
      return "arms";
    }
    if (exercise.primaryMuscle === "core") return "core";
    return "shoulders";
  }

  return requestedBodyPart;
}

function getWorkoutTitle(bodyPart: BodyPart, goal: Goal): string {
  const map: Record<BodyPart, string> = {
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
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return `${map[bodyPart]} • ${goalLabel}`;
}

function isExerciseValidForUser(
  exercise: Exercise,
  equipmentAccess: EquipmentAccess,
  experienceLevel: ExperienceLevel
): boolean {
  const matchesEquipment = exercise.equipmentAccess.includes(equipmentAccess);
  const matchesLevel = exercise.levels.some(
    (level) => experienceRank[level] <= experienceRank[experienceLevel]
  );

  return matchesEquipment && matchesLevel;
}

function countMatchingSecondaryMuscles(
  exercise: Exercise,
  targetMuscles: Muscle[]
): number {
  return exercise.secondaryMuscles.filter((muscle) => targetMuscles.includes(muscle)).length;
}

function countMatchingTags(exercise: Exercise, preferredTags: WorkoutTag[]): number {
  return exercise.workoutTags.filter((tag) => preferredTags.includes(tag)).length;
}

function getPatternCount(selected: Exercise[], pattern: MovementPattern): number {
  return selected.filter((exercise) => exercise.movementPattern === pattern).length;
}

function getPrimaryCount(selected: Exercise[], primary: Muscle): number {
  return selected.filter((exercise) => exercise.primaryMuscle === primary).length;
}

function hasCategory(selected: Exercise[], category: ExerciseCategory): boolean {
  return selected.some((exercise) => exercise.category === category);
}

function hasPattern(selected: Exercise[], pattern: MovementPattern): boolean {
  return selected.some((exercise) => exercise.movementPattern === pattern);
}

function hasPrimary(selected: Exercise[], primary: Muscle): boolean {
  return selected.some((exercise) => exercise.primaryMuscle === primary);
}

function violatesRepeatRules(
  exercise: Exercise,
  selected: Exercise[],
  rules: WorkoutRules
): boolean {
  const maxPattern = rules.maxPatternRepeats[exercise.movementPattern];
  if (maxPattern !== undefined && getPatternCount(selected, exercise.movementPattern) >= maxPattern) {
    return true;
  }

  if (getPrimaryCount(selected, exercise.primaryMuscle) >= rules.maxPrimaryRepeats) {
    return true;
  }

  return false;
}

function getGoalAdjustedReps(
  goal: Goal,
  exercise: Exercise,
  defaultReps: string
): string {
  if (goal === "strength") {
    if (exercise.movementPattern === "hinge" || exercise.movementPattern === "squat") {
      return exercise.category === "main" ? "3-5" : "5-8";
    }
    if (
      exercise.movementPattern === "horizontal_press" ||
      exercise.movementPattern === "vertical_press" ||
      exercise.movementPattern === "horizontal_pull" ||
      exercise.movementPattern === "vertical_pull" ||
      exercise.movementPattern === "bodyweight_pull"
    ) {
      return exercise.category === "main" ? "4-6" : "6-8";
    }
  }

  if (goal === "hypertrophy") {
    if (
      exercise.movementPattern === "raise" ||
      exercise.movementPattern === "curl" ||
      exercise.movementPattern === "tricep_extension" ||
      exercise.movementPattern === "fly" ||
      exercise.movementPattern === "calves" ||
      exercise.movementPattern === "core"
    ) {
      return "10-15";
    }
  }

  if (goal === "fat_loss") {
    if (
      exercise.movementPattern === "core" ||
      exercise.movementPattern === "lunge" ||
      exercise.movementPattern === "bodyweight_push" ||
      exercise.movementPattern === "bodyweight_pull"
    ) {
      return "12-15";
    }
  }

  return defaultReps;
}

function getExerciseScore(params: {
  exercise: Exercise;
  rules: WorkoutRules;
  desiredPattern?: MovementPattern;
  selected: Exercise[];
  bodyPart: BodyPart;
  goal: Goal;
}): number {
  const { exercise, rules, desiredPattern, selected, bodyPart, goal } = params;

  let score = 0;

  if (desiredPattern && exercise.movementPattern === desiredPattern) {
    score += 14;
  }

  if (rules.allowedPatterns.includes(exercise.movementPattern)) {
    score += 4;
  }

  if (rules.targetMuscles.includes(exercise.primaryMuscle)) {
    score += 9;
  }

  score += countMatchingSecondaryMuscles(exercise, rules.targetMuscles) * 2;
  score += countMatchingTags(exercise, rules.preferredTags) * 2;

  if (!hasCategory(selected, "main") && exercise.category === "main") {
    score += 6;
  }

  if (goal === "strength") {
    if (exercise.category === "main") score += 7;
    if (
      [
        "squat",
        "hinge",
        "horizontal_press",
        "vertical_press",
        "horizontal_pull",
        "vertical_pull",
        "bodyweight_pull",
      ].includes(exercise.movementPattern)
    ) {
      score += 4;
    }
    if (exercise.category === "isolation") score -= 4;
  }

  if (goal === "hypertrophy") {
    if (exercise.category === "accessory") score += 3;
    if (exercise.category === "isolation") score += 4;
    if (["raise", "curl", "tricep_extension", "fly"].includes(exercise.movementPattern)) {
      score += 2;
    }
  }

  if (goal === "fat_loss") {
    if (exercise.category === "accessory") score += 3;
    if (exercise.category === "isolation") score += 1;
    if (
      ["lunge", "bodyweight_push", "bodyweight_pull", "core"].includes(
        exercise.movementPattern
      )
    ) {
      score += 3;
    }
    if (exercise.category === "main" && exercise.movementPattern === "hinge") {
      score -= 2;
    }
  }

  if (goal === "general") {
    if (exercise.category === "accessory") score += 2;
  }

  const samePatternCount = getPatternCount(selected, exercise.movementPattern);
  if (samePatternCount > 0) {
    score -= samePatternCount * 5;
  }

  const samePrimaryCount = getPrimaryCount(selected, exercise.primaryMuscle);
  if (samePrimaryCount > 0) {
    score -= samePrimaryCount * 3;
  }

  if (bodyPart === "chest" && exercise.primaryMuscle === "triceps") score -= 2;
  if (bodyPart === "back" && exercise.primaryMuscle === "biceps") score -= 2;
  if (bodyPart === "shoulders" && exercise.movementPattern === "horizontal_press") score -= 4;
  if (
    bodyPart === "arms" &&
    ["horizontal_press", "vertical_press", "hinge", "squat"].includes(
      exercise.movementPattern
    )
  ) {
    score -= 8;
  }

  if (bodyPart === "legs") {
    if (exercise.primaryMuscle === "calves" && selected.length < 2) {
      score -= 6;
    }
    if (
      selected.length < 2 &&
      ["calves", "core"].includes(exercise.movementPattern)
    ) {
      score -= 4;
    }
  }

  if (bodyPart === "full_body") {
    if (selected.length === 0 && !["squat", "hinge"].includes(exercise.movementPattern)) {
      score -= 6;
    }
    if (
      selected.length === 1 &&
      exercise.movementPattern === "hinge" &&
      hasPattern(selected, "hinge")
    ) {
      score -= 6;
    }
  }

  if (bodyPart === "push" && exercise.movementPattern === "curl") {
    score -= 10;
  }

  if (bodyPart === "pull" && exercise.movementPattern === "tricep_extension") {
    score -= 10;
  }

  return score;
}

function pickBestExercise(params: {
  candidates: Exercise[];
  rules: WorkoutRules;
  selected: Exercise[];
  usedIds: Set<string>;
  desiredPattern?: MovementPattern;
  bodyPart: BodyPart;
  goal: Goal;
}): Exercise | null {
  const { candidates, rules, selected, usedIds, desiredPattern, bodyPart, goal } = params;

  const available = candidates.filter(
    (exercise) =>
      !usedIds.has(exercise.id) && !violatesRepeatRules(exercise, selected, rules)
  );

  if (available.length === 0) return null;

  const scored = available.map((exercise) => ({
    exercise,
    score: getExerciseScore({
      exercise,
      rules,
      desiredPattern,
      selected,
      bodyPart,
      goal,
    }),
  }));

  scored.sort((a, b) => b.score - a.score);

  const topScore = scored[0]?.score ?? 0;
  const topTier = scored.filter((item) => item.score >= topScore - 2);
  const choice = shuffleArray(topTier)[0];

  return choice?.exercise ?? null;
}

function fillTemplateExercises(params: {
  pool: Exercise[];
  rules: WorkoutRules;
  usedIds: Set<string>;
  selected: Exercise[];
  bodyPart: BodyPart;
  goal: Goal;
}): void {
  const { pool, rules, usedIds, selected, bodyPart, goal } = params;

  for (const pattern of rules.template) {
    const exactCandidates = pool.filter((exercise) => exercise.movementPattern === pattern);

    let chosen = pickBestExercise({
      candidates: exactCandidates,
      rules,
      selected,
      usedIds,
      desiredPattern: pattern,
      bodyPart,
      goal,
    });

    if (!chosen) {
      const fallbackCandidates = pool.filter(
        (exercise) =>
          rules.allowedPatterns.includes(exercise.movementPattern) ||
          rules.targetMuscles.includes(exercise.primaryMuscle) ||
          exercise.secondaryMuscles.some((muscle) => rules.targetMuscles.includes(muscle))
      );

      chosen = pickBestExercise({
        candidates: fallbackCandidates,
        rules,
        selected,
        usedIds,
        desiredPattern: pattern,
        bodyPart,
        goal,
      });
    }

    if (chosen) {
      selected.push(chosen);
      usedIds.add(chosen.id);
    }
  }
}

function getFillCandidates(
  pool: Exercise[],
  rules: WorkoutRules,
  selected: Exercise[],
  usedIds: Set<string>,
  goal: Goal,
  fillPriorityPatterns?: MovementPattern[]
): Exercise[] {
  const priorities = fillPriorityPatterns ?? [];

  return pool.filter((exercise) => {
    if (usedIds.has(exercise.id)) return false;
    if (violatesRepeatRules(exercise, selected, rules)) return false;

    const targetsPrimary = rules.targetMuscles.includes(exercise.primaryMuscle);
    const targetsSecondary = exercise.secondaryMuscles.some((muscle) =>
      rules.targetMuscles.includes(muscle)
    );
    const hasPreferredTag = exercise.workoutTags.some((tag) =>
      rules.preferredTags.includes(tag)
    );
    const allowedPattern = rules.allowedPatterns.includes(exercise.movementPattern);

    if (!(targetsPrimary || targetsSecondary || hasPreferredTag || allowedPattern)) {
      return false;
    }

    if (goal === "strength" && exercise.category === "isolation") {
      const currentIsolationCount = selected.filter((item) => item.category === "isolation").length;
      if (currentIsolationCount >= 1) return false;
    }

    if (priorities.length > 0 && selected.length >= 3) {
      return priorities.includes(exercise.movementPattern);
    }

    return true;
  });
}

function enforceCoverage(
  selected: Exercise[],
  pool: Exercise[],
  usedIds: Set<string>,
  rules: WorkoutRules,
  bodyPart: BodyPart,
  goal: Goal
): void {
  const tryAddPattern = (pattern: MovementPattern) => {
    if (hasPattern(selected, pattern)) return;

    const candidates = pool.filter((exercise) => exercise.movementPattern === pattern);
    const chosen = pickBestExercise({
      candidates,
      rules,
      selected,
      usedIds,
      desiredPattern: pattern,
      bodyPart,
      goal,
    });

    if (chosen) {
      selected.push(chosen);
      usedIds.add(chosen.id);
    }
  };

  const tryAddPrimary = (primary: Muscle) => {
    if (hasPrimary(selected, primary)) return;

    const candidates = pool.filter((exercise) => exercise.primaryMuscle === primary);
    const chosen = pickBestExercise({
      candidates,
      rules,
      selected,
      usedIds,
      bodyPart,
      goal,
    });

    if (chosen) {
      selected.push(chosen);
      usedIds.add(chosen.id);
    }
  };

  if (bodyPart === "legs") {
    tryAddPattern("squat");
    tryAddPattern("hinge");
  }

  if (bodyPart === "push") {
    tryAddPattern("horizontal_press");
    tryAddPattern("vertical_press");
  }

  if (bodyPart === "pull" || bodyPart === "back") {
    tryAddPattern("vertical_pull");
    tryAddPattern("horizontal_pull");
  }

  if (bodyPart === "arms") {
    tryAddPattern("curl");
    tryAddPattern("tricep_extension");
  }

  if (bodyPart === "shoulders") {
    tryAddPattern("vertical_press");
    tryAddPattern("raise");
  }

  if (bodyPart === "full_body") {
    tryAddPattern("squat");
    tryAddPattern("horizontal_press");
    tryAddPattern("horizontal_pull");
  }

  if (bodyPart === "chest") {
    tryAddPrimary("chest");
  }
}

function trimToTargetCount(
  selected: Exercise[],
  targetCount: number,
  bodyPart: BodyPart
): Exercise[] {
  if (selected.length <= targetCount) return selected;

  const protectedPatterns: Partial<Record<BodyPart, MovementPattern[]>> = {
    chest: ["horizontal_press", "fly"],
    back: ["vertical_pull", "horizontal_pull"],
    legs: ["squat", "hinge", "lunge"],
    shoulders: ["vertical_press", "raise"],
    arms: ["curl", "tricep_extension"],
    push: ["horizontal_press", "vertical_press", "tricep_extension"],
    pull: ["vertical_pull", "horizontal_pull", "curl"],
    full_body: ["squat", "hinge", "horizontal_press", "horizontal_pull"],
  };

  const protectedSet = new Set(protectedPatterns[bodyPart] ?? []);

  const sortedForTrim = [...selected].sort((a, b) => {
    const aProtected = protectedSet.has(a.movementPattern) ? 1 : 0;
    const bProtected = protectedSet.has(b.movementPattern) ? 1 : 0;

    if (aProtected !== bProtected) return aProtected - bProtected;
    if (categoryPriority[a.category] !== categoryPriority[b.category]) {
      return categoryPriority[b.category] - categoryPriority[a.category];
    }

    return (movementPatternPriority[b.movementPattern] ?? 999) -
      (movementPatternPriority[a.movementPattern] ?? 999);
  });

  while (sortedForTrim.length > targetCount) {
    sortedForTrim.shift();
  }

  return selected.filter((exercise) => sortedForTrim.some((item) => item.id === exercise.id));
}

function fillRemainingExercises(params: {
  pool: Exercise[];
  rules: WorkoutRules;
  selected: Exercise[];
  usedIds: Set<string>;
  targetCount: number;
  bodyPart: BodyPart;
  goal: Goal;
}): void {
  const { pool, rules, selected, usedIds, targetCount, bodyPart, goal } = params;

  while (selected.length < targetCount) {
    const candidates = getFillCandidates(
      pool,
      rules,
      selected,
      usedIds,
      goal,
      rules.fillPriorityPatterns
    );

    const chosen = pickBestExercise({
      candidates,
      rules,
      selected,
      usedIds,
      bodyPart,
      goal,
    });

    if (!chosen) break;

    selected.push(chosen);
    usedIds.add(chosen.id);
  }
}

function sortExercisesForWorkout(exercises: Exercise[]): Exercise[] {
  return [...exercises].sort((a, b) => {
    const categoryDiff = categoryPriority[a.category] - categoryPriority[b.category];
    if (categoryDiff !== 0) return categoryDiff;

    const movementDiff =
      (movementPatternPriority[a.movementPattern] ?? 999) -
      (movementPatternPriority[b.movementPattern] ?? 999);

    if (movementDiff !== 0) return movementDiff;

    return a.name.localeCompare(b.name);
  });
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
  const setAdjustment = getSetAdjustment(experienceLevel, goal);
  const scheme = repSchemes[goal];

  const pool = exerciseLibrary.filter((exercise) =>
    isExerciseValidForUser(exercise, equipmentAccess, experienceLevel)
  );

  const selected: Exercise[] = [];
  const usedIds = new Set<string>();

  fillTemplateExercises({
    pool,
    rules,
    usedIds,
    selected,
    bodyPart,
    goal,
  });

  enforceCoverage(selected, pool, usedIds, rules, bodyPart, goal);

  fillRemainingExercises({
    pool,
    rules,
    selected,
    usedIds,
    targetCount: exerciseCount,
    bodyPart,
    goal,
  });

  const trimmedSelected = trimToTargetCount(selected, exerciseCount, bodyPart);
  const orderedExercises = sortExercisesForWorkout(trimmedSelected);

  const generatedExercises: GeneratedExercise[] = orderedExercises.map((exercise) => {
    const template = scheme[exercise.category];
    const totalSets =
      exercise.category === "main" ? template.sets + setAdjustment : template.sets;

    return {
      exercise_name: exercise.name,
      body_part: getDisplayBodyPart(exercise, bodyPart),
      sets: buildSets(totalSets, getGoalAdjustedReps(goal, exercise, template.reps)),
    };
  });

  return {
    workout_name: getWorkoutTitle(bodyPart, goal),
    body_part: bodyPart,
    estimated_duration: duration,
    exercises: generatedExercises,
  };
}