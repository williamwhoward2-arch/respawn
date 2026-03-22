"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// ─── Constants ───────────────────────────────────────────────────────

const BODY_PART_OPTIONS = ["Chest", "Back", "Shoulders", "Arms", "Core / Abs", "Legs", "Full Body"];

// VersaClimber counts toward both Core / Abs and Legs in body part split
const VERSACLIMBER_BODY_PARTS = ["Core / Abs", "Legs"];

// ─── Types ───────────────────────────────────────────────────────────

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

// VersaClimber stored in workout_cardio with method = "versaclimber"
// miles field repurposed to store feet climbed
// duration_seconds stores time as usual
type WorkoutVersaClimber = {
  id: number;
  workout_id: number;
  duration_seconds: number | null;
  feet: string | number | null; // stored in miles column
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

type BodyPartSummary = { bodyPart: string; sets: number };

type WorkoutWithStats = Workout & {
  totalSets: number;
  exerciseCount: number;
  cardioEntries: number;
  cardioDurationSeconds: number;
  cardioMiles: number;
  hasVersaClimber: boolean;
  displayName: string;
  autoNamed: boolean;
};

type GoalTile = {
  goalLabel: string;
  frequencyLabel: string; frequencyDetail: string;
  workloadLabel: string; workloadDetail: string;
  intensityLabel: string; intensityDetail: string;
  summary: string;
};

type AIInsights = {
  topWin?: string;
  topConcern?: string;
  nextBestMove?: string;
};

// ─── Editable types ──────────────────────────────────────────────────

type EditableSet = {
  id: number;
  exercise_name: string;
  body_part: string;
  weight: string;
  reps: string;
  set_number: number;
};

type EditableCardio = {
  id: number;
  method: string;
  miles: string;
  duration_seconds: string; // UI: minutes
  notes: string;
};

type EditableVersaClimber = {
  id: number;
  duration_minutes: string;
  feet: string;
};

type EditState = {
  workoutName: string;
  sets: EditableSet[];
  cardio: EditableCardio[];
  versaClimber: EditableVersaClimber[];
};

type NewWorkoutState = EditState & { selectedDate: string };

// ─── Helpers ─────────────────────────────────────────────────────────

function toNumber(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function estimate1RM(w: number, r: number): number {
  if (!w || !r) return 0;
  return w * (1 + r / 30);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatMinutesRounded(seconds?: number | null): string {
  if (!seconds) return "--";
  return `${Math.round(seconds / 60)} min`;
}

function formatMiles(miles: number): string {
  if (!miles) return "--";
  return Number.isInteger(miles) ? `${miles}` : miles.toFixed(1);
}

function titleCase(v: string): string {
  return v.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toISODateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildLast30Days(): { label: string; value: string }[] {
  const now = new Date();
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const value = toISODateLocal(d);
    const label = i === 0 ? `Today — ${formatDateShort(d.toISOString())}` : i === 1 ? `Yesterday — ${formatDateShort(d.toISOString())}` : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    return { label, value };
  });
}

function normalizeBodyPart(v: string | null | undefined): string {
  if (!v) return "Other";
  const c = v.trim().toLowerCase();
  if (c.includes("chest")) return "Chest";
  if (c.includes("back")) return "Back";
  if (c.includes("leg")) return "Legs";
  if (c.includes("shoulder")) return "Shoulders";
  if (c.includes("arm") || c.includes("bicep") || c.includes("tricep")) return "Arms";
  if (c.includes("core") || c.includes("ab")) return "Core / Abs";
  if (c.includes("glute")) return "Glutes";
  if (c.includes("full")) return "Full Body";
  if (c.includes("push")) return "Push";
  if (c.includes("pull")) return "Pull";
  return titleCase(c);
}

function normalizeGoal(v: string | null | undefined): "hypertrophy" | "strength" | "fat_loss" | "general" {
  const c = (v || "").trim().toLowerCase().replaceAll(" ", "_");
  if (["build_muscle","hypertrophy","muscle_gain","gain_muscle"].includes(c)) return "hypertrophy";
  if (["get_stronger","strength","build_strength","stronger"].includes(c)) return "strength";
  if (["burn_fat","fat_loss","lose_fat","weight_loss","cut"].includes(c)) return "fat_loss";
  return "general";
}

function isGenericWorkoutName(name: string | null | undefined): boolean {
  const c = (name || "").trim().toLowerCase();
  return !c || ["workout","custom workout","my workout","session","training","lift","gym","today's workout","todays workout","new workout"].includes(c);
}

function getWorkoutDisplayName(p: { workout: Workout; sets: WorkoutSet[]; cardio: WorkoutCardio[] }): { name: string; autoNamed: boolean } {
  const { workout, sets, cardio } = p;
  if (!isGenericWorkoutName(workout.workout_name)) return { name: workout.workout_name!.trim(), autoNamed: false };

  const validSets = sets.filter((s) => toNumber(s.weight) > 0 && toNumber(s.reps) > 0);
  const exFreq = new Map<string, number>();
  const bpCount = new Map<string, number>();
  const cardioMethods = new Map<string, number>();

  for (const s of validSets) {
    const n = (s.exercise_name || "Exercise").trim();
    exFreq.set(n, (exFreq.get(n) ?? 0) + 1);
    const bp = normalizeBodyPart(s.body_part);
    bpCount.set(bp, (bpCount.get(bp) ?? 0) + 1);
  }
  for (const c of cardio) {
    if (c.method === "versaclimber") { cardioMethods.set("VersaClimber", (cardioMethods.get("VersaClimber") ?? 0) + 1); continue; }
    const m = titleCase(c.method || "Cardio");
    cardioMethods.set(m, (cardioMethods.get(m) ?? 0) + 1);
  }

  const topEx = Array.from(exFreq.entries()).sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 2);
  const topBp = Array.from(bpCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topCardio = Array.from(cardioMethods.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  if (validSets.length > 0) {
    if (topEx.length >= 2) return { name: `${topEx[0]} + ${topEx[1]}`, autoNamed: true };
    if (topBp) return { name: `${topBp} Session`, autoNamed: true };
    if (topEx.length > 0) return { name: `${topEx[0]} Session`, autoNamed: true };
  }
  if (cardio.length > 0) {
    if (topCardio) return { name: `${topCardio} Session`, autoNamed: true };
    return { name: "Cardio Session", autoNamed: true };
  }
  return { name: `Logged Session — ${formatDateShort(workout.created_at)}`, autoNamed: true };
}

function getStrengthLevelLabel(e1rm: number, bw: number): string {
  if (!e1rm || !bw) return "Building";
  const r = e1rm / bw;
  if (r >= 2) return "Elite";
  if (r >= 1.5) return "Advanced";
  if (r >= 1.15) return "Intermediate";
  if (r >= 0.8) return "Novice";
  return "Building";
}

let _tid = -1;
function nextTempId() { return _tid--; }
function emptySet(n: number): EditableSet { return { id: nextTempId(), exercise_name: "", body_part: "", weight: "", reps: "", set_number: n }; }
function emptyCardio(): EditableCardio { return { id: nextTempId(), method: "", miles: "", duration_seconds: "", notes: "" }; }
function emptyVersaClimber(): EditableVersaClimber { return { id: nextTempId(), duration_minutes: "", feet: "" }; }
function emptyNewWorkout(): NewWorkoutState { return { workoutName: "", selectedDate: toISODateLocal(new Date()), sets: [emptySet(1)], cardio: [], versaClimber: [] }; }

// ─── Body Part Dropdown ──────────────────────────────────────────────

function BodyPartSelect({ value, onChange, style }: { value: string; onChange: (v: string) => void; style?: CSSProperties }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...editSelectStyle, ...style }}
    >
      <option value="">Select body part</option>
      {BODY_PART_OPTIONS.map((bp) => (
        <option key={bp} value={bp}>{bp}</option>
      ))}
    </select>
  );
}

// ─── Component ───────────────────────────────────────────────────────

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
  const reportRef = useRef<HTMLElement | null>(null);
  const addFormRef = useRef<HTMLDivElement | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [newWorkout, setNewWorkout] = useState<NewWorkoutState>(emptyNewWorkout());
  const [isAddingSaving, setIsAddingSaving] = useState(false);

  const last30Days = useMemo(() => buildLast30Days(), []);

  useEffect(() => { void loadProgress(); }, []);

  useEffect(() => {
    if (selectedWorkoutId && reportRef.current) reportRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedWorkoutId]);

  useEffect(() => {
    if (isAdding && addFormRef.current) setTimeout(() => addFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [isAdding]);

  useEffect(() => { setIsEditing(false); setEditState(null); }, [selectedWorkoutId]);

  function toggleExercise(key: string) { setExpandedExercises((p) => ({ ...p, [key]: !p[key] })); }

  // ─── Add helpers ─────────────────────────────────────────────────

  function openAddForm() { setNewWorkout(emptyNewWorkout()); setIsAdding(true); }
  function closeAddForm() { setIsAdding(false); setNewWorkout(emptyNewWorkout()); }

  function updateNew<K extends keyof NewWorkoutState>(field: K, value: NewWorkoutState[K]) {
    setNewWorkout((p) => ({ ...p, [field]: value }));
  }
  function updateNewSet(id: number, field: keyof EditableSet, value: string) {
    setNewWorkout((p) => ({ ...p, sets: p.sets.map((s) => s.id === id ? { ...s, [field]: value } : s) }));
  }
  function addNewSet() { setNewWorkout((p) => ({ ...p, sets: [...p.sets, emptySet(p.sets.length + 1)] })); }
  function removeNewSet(id: number) { setNewWorkout((p) => ({ ...p, sets: p.sets.filter((s) => s.id !== id).map((s, i) => ({ ...s, set_number: i + 1 })) })); }

  function updateNewCardio(id: number, field: keyof EditableCardio, value: string) {
    setNewWorkout((p) => ({ ...p, cardio: p.cardio.map((c) => c.id === id ? { ...c, [field]: value } : c) }));
  }
  function addNewCardio() { setNewWorkout((p) => ({ ...p, cardio: [...p.cardio, emptyCardio()] })); }
  function removeNewCardio(id: number) { setNewWorkout((p) => ({ ...p, cardio: p.cardio.filter((c) => c.id !== id) })); }

  function updateNewVersa(id: number, field: keyof EditableVersaClimber, value: string) {
    setNewWorkout((p) => ({ ...p, versaClimber: p.versaClimber.map((v) => v.id === id ? { ...v, [field]: value } : v) }));
  }
  function addNewVersa() { setNewWorkout((p) => ({ ...p, versaClimber: [...p.versaClimber, emptyVersaClimber()] })); }
  function removeNewVersa(id: number) { setNewWorkout((p) => ({ ...p, versaClimber: p.versaClimber.filter((v) => v.id !== id) })); }

  async function saveNewWorkout() {
    setIsAddingSaving(true);
    setStatus("Saving new workout...");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const [year, month, day] = newWorkout.selectedDate.split("-").map(Number);
      const workoutDate = new Date(year, month - 1, day, 12, 0, 0);

      const { data: inserted, error: wErr } = await supabase
        .from("workouts")
        .insert({ user_id: user.id, workout_name: newWorkout.workoutName.trim() || null, created_at: workoutDate.toISOString(), day_type: "workout" })
        .select().single();
      if (wErr || !inserted) throw new Error(wErr?.message ?? "Failed to insert workout");
      const workoutId = (inserted as Workout).id;

      // Sets
      const validSets = newWorkout.sets.filter((s) => s.exercise_name.trim() || s.weight.trim() || s.reps.trim());
      if (validSets.length > 0) {
        const { data: insertedSets, error: sErr } = await supabase.from("workout_sets")
          .insert(validSets.map((s, i) => ({ user_id: user.id, workout_id: workoutId, exercise_name: s.exercise_name.trim() || null, body_part: s.body_part.trim() || null, weight: s.weight.trim() || null, reps: s.reps.trim() || null, set_number: i + 1 })))
          .select();
        if (sErr) throw new Error(sErr.message);
        setSets((p) => [...(insertedSets as WorkoutSet[]), ...p]);
      }

      // Cardio
      const validCardio = newWorkout.cardio.filter((c) => c.method.trim());
      // VersaClimber entries (stored as cardio rows with method = "versaclimber", feet in miles column)
      const validVersa = newWorkout.versaClimber.filter((v) => v.duration_minutes.trim() || v.feet.trim());

      const allCardioRows = [
        ...validCardio.map((c, i) => ({ user_id: user.id, workout_id: workoutId, entry_number: i + 1, method: c.method.trim(), miles: c.miles.trim() || null, duration_seconds: c.duration_seconds ? Math.round(parseFloat(c.duration_seconds) * 60) : null, notes: c.notes.trim() || null })),
        ...validVersa.map((v, i) => ({ user_id: user.id, workout_id: workoutId, entry_number: validCardio.length + i + 1, method: "versaclimber", miles: v.feet.trim() || null, duration_seconds: v.duration_minutes ? Math.round(parseFloat(v.duration_minutes) * 60) : null, notes: null })),
      ];

      if (allCardioRows.length > 0) {
        const { data: insertedCardio, error: cErr } = await supabase.from("workout_cardio").insert(allCardioRows).select();
        if (cErr) throw new Error(cErr.message);
        setCardio((p) => [...(insertedCardio as WorkoutCardio[]), ...p]);
      }

      setWorkouts((p) => [inserted as Workout, ...p].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setIsAdding(false);
      setNewWorkout(emptyNewWorkout());
      setStatus("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Something went wrong saving the workout.");
    } finally { setIsAddingSaving(false); }
  }

  // ─── Edit helpers ─────────────────────────────────────────────────

  function enterEditMode() {
    if (!selectedWorkoutId) return;
    const workout = workouts.find((w) => w.id === selectedWorkoutId);
    if (!workout) return;
    const ws = sets.filter((s) => s.workout_id === selectedWorkoutId);
    const wc = cardio.filter((c) => c.workout_id === selectedWorkoutId);
    const regularCardio = wc.filter((c) => c.method !== "versaclimber");
    const versaRows = wc.filter((c) => c.method === "versaclimber");

    setEditState({
      workoutName: workout.workout_name ?? "",
      sets: ws.map((s) => ({ id: s.id, exercise_name: s.exercise_name ?? "", body_part: normalizeBodyPart(s.body_part), weight: String(s.weight ?? ""), reps: String(s.reps ?? ""), set_number: toNumber(s.set_number) })),
      cardio: regularCardio.map((c) => ({ id: c.id, method: c.method ?? "", miles: String(c.miles ?? ""), duration_seconds: c.duration_seconds ? String(Math.round(c.duration_seconds / 60)) : "", notes: c.notes ?? "" })),
      versaClimber: versaRows.map((v) => ({ id: v.id, duration_minutes: v.duration_seconds ? String(Math.round(v.duration_seconds / 60)) : "", feet: String(v.miles ?? "") })),
    });
    setIsEditing(true);
  }

  function cancelEdit() { setIsEditing(false); setEditState(null); }

  function updateEditSet(id: number, field: keyof EditableSet, value: string) {
    setEditState((p) => p ? { ...p, sets: p.sets.map((s) => s.id === id ? { ...s, [field]: value } : s) } : p);
  }
  function updateEditCardio(id: number, field: keyof EditableCardio, value: string) {
    setEditState((p) => p ? { ...p, cardio: p.cardio.map((c) => c.id === id ? { ...c, [field]: value } : c) } : p);
  }
  function updateEditVersa(id: number, field: keyof EditableVersaClimber, value: string) {
    setEditState((p) => p ? { ...p, versaClimber: p.versaClimber.map((v) => v.id === id ? { ...v, [field]: value } : v) } : p);
  }

  async function saveEdits() {
    if (!editState || !selectedWorkoutId) return;
    setIsSaving(true); setStatus("Saving changes...");
    try {
      await supabase.from("workouts").update({ workout_name: editState.workoutName || null }).eq("id", selectedWorkoutId);
      for (const s of editState.sets) {
        await supabase.from("workout_sets").update({ exercise_name: s.exercise_name || null, body_part: s.body_part || null, weight: s.weight || null, reps: s.reps || null }).eq("id", s.id);
      }
      for (const c of editState.cardio) {
        await supabase.from("workout_cardio").update({ method: c.method || "cardio", miles: c.miles || null, duration_seconds: c.duration_seconds ? Math.round(parseFloat(c.duration_seconds) * 60) : null, notes: c.notes || null }).eq("id", c.id);
      }
      for (const v of editState.versaClimber) {
        await supabase.from("workout_cardio").update({ method: "versaclimber", miles: v.feet || null, duration_seconds: v.duration_minutes ? Math.round(parseFloat(v.duration_minutes) * 60) : null }).eq("id", v.id);
      }
      setWorkouts((p) => p.map((w) => w.id === selectedWorkoutId ? { ...w, workout_name: editState.workoutName || null } : w));
      setSets((p) => p.map((s) => { const e = editState.sets.find((es) => es.id === s.id); return e ? { ...s, exercise_name: e.exercise_name || null, body_part: e.body_part || null, weight: e.weight || null, reps: e.reps || null } : s; }));
      setCardio((p) => p.map((c) => {
        const ec = editState.cardio.find((x) => x.id === c.id);
        if (ec) return { ...c, method: ec.method || "cardio", miles: ec.miles || null, duration_seconds: ec.duration_seconds ? Math.round(parseFloat(ec.duration_seconds) * 60) : null, notes: ec.notes || null };
        const ev = editState.versaClimber.find((x) => x.id === c.id);
        if (ev) return { ...c, method: "versaclimber", miles: ev.feet || null, duration_seconds: ev.duration_minutes ? Math.round(parseFloat(ev.duration_minutes) * 60) : null };
        return c;
      }));
      setIsEditing(false); setEditState(null); setStatus("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Something went wrong saving your edits.");
    } finally { setIsSaving(false); }
  }

  // ─── Load data ───────────────────────────────────────────────────

  async function loadProgress() {
    setLoading(true); setStatus("Loading...");
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr) { if (uErr.message.includes("Invalid Refresh Token")) { await supabase.auth.signOut(); router.replace("/login"); return; } setStatus(uErr.message); setLoading(false); return; }
    if (!user) { router.replace("/login"); return; }

    const { data: profileData } = await supabase.from("profiles").select("id, user_id, name, bodyweight, goal, focus, experience_level").eq("user_id", user.id).maybeSingle();
    const { data: workoutsData, error: wErr } = await supabase.from("workouts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (wErr) { setStatus(wErr.message); setLoading(false); return; }

    const safeWorkouts = (workoutsData as Workout[]) ?? [];
    const wids = safeWorkouts.map((w) => w.id);
    let safeSets: WorkoutSet[] = [], safeCardio: WorkoutCardio[] = [];

    if (wids.length > 0) {
      const [{ data: sd, error: se }, { data: cd, error: ce }] = await Promise.all([
        supabase.from("workout_sets").select("*").in("workout_id", wids).order("created_at", { ascending: false }),
        supabase.from("workout_cardio").select("*").in("workout_id", wids).order("created_at", { ascending: false }),
      ]);
      if (se) { setStatus(se.message); setLoading(false); return; }
      if (ce) { setStatus(ce.message); setLoading(false); return; }
      safeSets = (sd as WorkoutSet[]) ?? [];
      safeCardio = (cd as WorkoutCardio[]) ?? [];
    }

    setProfile((profileData as Profile) ?? null);
    setWorkouts(safeWorkouts); setSets(safeSets); setCardio(safeCardio);
    setStatus(""); setLoading(false);
  }

  async function handleDeleteWorkout(id: number) {
    if (!window.confirm("Delete this workout and all its data?")) return;
    setDeletingWorkoutId(id);
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (error) { setStatus(error.message); setDeletingWorkoutId(null); return; }
    setWorkouts((p) => p.filter((w) => w.id !== id));
    setSets((p) => p.filter((s) => s.workout_id !== id));
    setCardio((p) => p.filter((c) => c.workout_id !== id));
    if (selectedWorkoutId === id) setSelectedWorkoutId(null);
    setDeletingWorkoutId(null);
  }

  // ─── Computed ────────────────────────────────────────────────────

  const computed = useMemo(() => {
    const goal = normalizeGoal(profile?.goal);
    const goalLabel = goal === "hypertrophy" ? "Build muscle" : goal === "strength" ? "Get stronger" : goal === "fat_loss" ? "Burn fat" : "General fitness";
    const strengthSets = sets.filter((s) => toNumber(s.weight) > 0 && toNumber(s.reps) > 0);
    const totalWeightMoved = strengthSets.reduce((sum, s) => sum + toNumber(s.weight) * toNumber(s.reps), 0);
    const totalReps = strengthSets.reduce((sum, s) => sum + toNumber(s.reps), 0);
    const totalSetsCompleted = strengthSets.length;

    const allSorted = [...workouts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const recentWorkouts: WorkoutWithStats[] = allSorted.map((workout) => {
      const ws = sets.filter((s) => s.workout_id === workout.id);
      const wc = cardio.filter((c) => c.workout_id === workout.id);
      const regularCardio = wc.filter((c) => c.method !== "versaclimber");
      const hasVersaClimber = wc.some((c) => c.method === "versaclimber");
      const dn = getWorkoutDisplayName({ workout, sets: ws, cardio: wc });
      return { ...workout, totalSets: ws.length, exerciseCount: new Set(ws.map((s) => s.exercise_name?.trim() || "Unknown")).size, cardioEntries: regularCardio.length, cardioDurationSeconds: regularCardio.reduce((s, c) => s + toNumber(c.duration_seconds), 0), cardioMiles: regularCardio.reduce((s, c) => s + toNumber(c.miles), 0), hasVersaClimber, displayName: dn.name, autoNamed: dn.autoNamed };
    });

    const totalWorkouts = workouts.length;
    const avgSessionSeconds = workouts.length > 0 ? Math.round(workouts.reduce((s, w) => s + toNumber(w.duration_seconds), 0) / workouts.length) : 0;
    const last14Days = new Date(); last14Days.setDate(last14Days.getDate() - 13);
    const recent14 = workouts.filter((w) => new Date(w.created_at) >= last14Days).length;

    // Body part summary — VersaClimber contributes to both Core / Abs and Legs
    const bpMap = new Map<string, number>();
    for (const s of sets) {
      const bp = normalizeBodyPart(s.body_part);
      bpMap.set(bp, (bpMap.get(bp) ?? 0) + 1);
    }
    // Each VersaClimber session counts as 1 set toward each of its body parts
    const versaEntries = cardio.filter((c) => c.method === "versaclimber");
    for (const _ of versaEntries) {
      for (const bp of VERSACLIMBER_BODY_PARTS) {
        bpMap.set(bp, (bpMap.get(bp) ?? 0) + 1);
      }
    }
    const bodyPartSummary: BodyPartSummary[] = Array.from(bpMap.entries()).map(([bodyPart, sets]) => ({ bodyPart, sets })).sort((a, b) => b.sets - a.sets);

    const bw = toNumber(profile?.bodyweight) || 205;
    const avgWeight = strengthSets.length > 0 ? totalWeightMoved / strengthSets.length : 0;
    const workloadScore = totalSetsCompleted + Math.round(totalReps / 12);

    let fL = "Needs Work", fD = "Your recent training frequency is below what usually works best for this goal.";
    let wL = "Needs Work", wD = "Your current training output is still lighter than ideal for this goal.";
    let iL = "Needs Work", iD = "Your logged loading is still on the lighter side for this goal.";

    if (goal === "hypertrophy") {
      if (recent14 >= 8) { fL = "Dialed In"; fD = "You're training often enough to repeatedly stimulate muscle growth."; } else if (recent14 >= 5) { fL = "Strong"; fD = "Your training frequency is in a very good place for building muscle."; } else if (recent14 >= 3) { fL = "Decent"; fD = "This can support muscle growth, but another session per week would help."; }
      if (workloadScore >= 180) { wL = "High"; wD = "Your rep and set output supports a serious hypertrophy workload."; } else if (workloadScore >= 90) { wL = "Solid"; wD = "Your total work is in a productive range for muscle-building."; } else if (workloadScore >= 40) { wL = "Building"; wD = "You've started a useful training base, but more weekly work would help."; }
      if (avgWeight >= 185) { iL = "High"; iD = "Heavy loading — works well as long as recovery stays on track."; } else if (avgWeight >= 105) { iL = "Optimal"; iD = "Your loading looks well-suited for productive hypertrophy work."; } else if (avgWeight >= 65) { iL = "Moderate"; iD = "Your loading is workable, but there's room to keep progressing."; }
    } else if (goal === "strength") {
      if (recent14 >= 6) { fL = "Dialed In"; fD = "Your frequency supports practicing key lifts often enough."; } else if (recent14 >= 4) { fL = "Strong"; fD = "You're training frequently enough for real strength progress."; } else if (recent14 >= 2) { fL = "Decent"; fD = "This can work, but more exposure to your main lifts would help."; }
      if (workloadScore >= 160) { wL = "High"; wD = "Lots of total work — keep recovery and lift quality high."; } else if (workloadScore >= 80) { wL = "Solid"; wD = "Your workload supports strength progress without being excessive."; } else if (workloadScore >= 35) { wL = "Building"; wD = "Good base, but more structured exposure would help."; }
      if (avgWeight >= 185) { iL = "Strong"; iD = "Your average loading fits a strength-oriented approach well."; } else if (avgWeight >= 125) { iL = "Moderate"; iD = "Respectable load, but there may be room to push heavier."; } else if (avgWeight >= 75) { iL = "Building"; iD = "Strength progress usually wants heavier exposure over time."; }
    } else if (goal === "fat_loss") {
      if (recent14 >= 8) { fL = "Dialed In"; fD = "Excellent frequency for a fat-loss phase."; } else if (recent14 >= 5) { fL = "Strong"; fD = "You're training often enough for a strong fat-loss routine."; } else if (recent14 >= 3) { fL = "Decent"; fD = "Good base, but more frequency would help."; }
      if (workloadScore >= 170) { wL = "High"; wD = "High output — great sign for a productive fat-loss phase."; } else if (workloadScore >= 85) { wL = "Solid"; wD = "Useful range for maintaining progress while cutting."; } else if (workloadScore >= 35) { wL = "Building"; wD = "Building output, but more total work would help."; }
      if (avgWeight >= 165) { iL = "Strong"; iD = "Enough load to help preserve performance."; } else if (avgWeight >= 85) { iL = "Optimal"; iD = "Good range for preserving muscle while staying sustainable."; } else if (avgWeight >= 50) { iL = "Moderate"; iD = "Don't let performance drop too low."; }
    } else {
      if (recent14 >= 6) { fL = "Dialed In"; fD = "Excellent for general fitness and consistency."; } else if (recent14 >= 4) { fL = "Strong"; fD = "Training often enough for a strong general fitness base."; } else if (recent14 >= 2) { fL = "Decent"; fD = "Good start — a bit more consistency would improve results."; }
      if (workloadScore >= 140) { wL = "High"; wD = "A lot of overall work across your training."; } else if (workloadScore >= 70) { wL = "Solid"; wD = "Productive range for general fitness."; } else if (workloadScore >= 30) { wL = "Building"; wD = "Building a base — more output would improve momentum."; }
      if (avgWeight >= 165) { iL = "Strong"; iD = "Loading supports broad fitness progress well."; } else if (avgWeight >= 85) { iL = "Balanced"; iD = "Balanced for general strength and fitness."; } else if (avgWeight >= 50) { iL = "Moderate"; iD = "Reasonable loading with room to progress."; }
    }

    const goalSummary = (fL === "Dialed In" || fL === "Strong") && (wL === "High" || wL === "Solid") && ["Optimal","Strong","Balanced","High"].includes(iL) ? "Your current training pattern is lining up well with your stated goal." : fL === "Needs Work" ? "Your goal fit would improve most by increasing how often you train each week." : wL === "Needs Work" || wL === "Building" ? "You're on the board, but your total training output still has room to climb." : iL === "Needs Work" || iL === "Building" ? "Your overall loading could be pushed a bit more to better match your goal." : "Your training is moving in the right direction, with a few areas that can tighten up.";
    const goalTile: GoalTile = { goalLabel, frequencyLabel: fL, frequencyDetail: fD, workloadLabel: wL, workloadDetail: wD, intensityLabel: iL, intensityDetail: iD, summary: goalSummary };

    const strongestExercise = (() => {
      const map = new Map<string, { e1rm: number; bodyPart: string }>();
      for (const s of strengthSets) {
        const name = s.exercise_name?.trim() || "Unknown";
        const bp = normalizeBodyPart(s.body_part);
        const e1rm = estimate1RM(toNumber(s.weight), toNumber(s.reps));
        const cur = map.get(name);
        if (!cur || e1rm > cur.e1rm) map.set(name, { e1rm, bodyPart: bp });
      }
      const best = Array.from(map.entries()).sort((a, b) => b[1].e1rm - a[1].e1rm)[0];
      if (!best) return null;
      return { name: best[0], bestE1RM: Math.round(best[1].e1rm), bodyPart: best[1].bodyPart, strengthLevel: getStrengthLevelLabel(best[1].e1rm, bw) };
    })();

    const aiInsightsFallback = [
      totalWorkouts > 0 ? `You've logged ${totalWorkouts} total workouts so far.` : "Log a few workouts so the review can become more useful.",
      strongestExercise ? `${strongestExercise.name} currently stands out as your strongest lift.` : "You need more strength data before lift trends become clear.",
      "Keep repeating key lifts, track honest reps, and let your progress page tell the story.",
    ];

    return { goalLabel, totalWorkouts, avgSessionSeconds, recentWorkouts, visibleRecentWorkouts: recentWorkouts.slice(0, visibleWorkoutCount), bodyPartSummary, goalTile, strongestExercise, aiInsightsFallback, hasMoreWorkouts: recentWorkouts.length > visibleWorkoutCount };
  }, [profile, workouts, sets, cardio, visibleWorkoutCount]);

  useEffect(() => {
    if (!workouts.length && !sets.length && !cardio.length) return;
    let cancelled = false;
    async function loadAI() {
      try {
        const res = await fetch("/api/progress-insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: computed.goalLabel, totalWorkouts: computed.totalWorkouts, avgSessionSeconds: computed.avgSessionSeconds, goalTile: computed.goalTile, bodyPartSummary: computed.bodyPartSummary.slice(0, 6), strongestExercise: computed.strongestExercise }) });
        if (!res.ok) return;
        const data = (await res.json()) as AIInsights;
        if (!cancelled) setAiInsights(data);
      } catch { /* silent */ }
    }
    void loadAI();
    return () => { cancelled = true; };
  }, [workouts.length, sets.length, cardio.length, computed]);

  const selectedWorkoutReport = useMemo(() => {
    if (!selectedWorkoutId) return null;
    const workout = workouts.find((w) => w.id === selectedWorkoutId);
    if (!workout) return null;
    const ws = sets.filter((s) => s.workout_id === selectedWorkoutId);
    const wc = cardio.filter((c) => c.workout_id === selectedWorkoutId);
    const regularCardio = wc.filter((c) => c.method !== "versaclimber");
    const versaEntries = wc.filter((c) => c.method === "versaclimber");

    const grouped = new Map<string, { name: string; bodyPart: string; sets: { id: number; setNumber: number; weight: number; reps: number }[] }>();
    for (const s of ws) {
      const name = s.exercise_name?.trim() || "Unknown Exercise";
      const bp = normalizeBodyPart(s.body_part);
      const cur = grouped.get(name) ?? { name, bodyPart: bp, sets: [] };
      cur.sets.push({ id: s.id, setNumber: toNumber(s.set_number), weight: toNumber(s.weight), reps: toNumber(s.reps) });
      grouped.set(name, cur);
    }
    const dn = getWorkoutDisplayName({ workout, sets: ws, cardio: wc });
    return { workout, displayName: dn.name, exercises: Array.from(grouped.values()), cardioEntries: regularCardio, versaEntries, totalSets: ws.length, totalCardioDuration: regularCardio.reduce((s, c) => s + toNumber(c.duration_seconds), 0), totalCardioMiles: regularCardio.reduce((s, c) => s + toNumber(c.miles), 0), exerciseCount: new Set(ws.map((s) => s.exercise_name?.trim() || "Unknown")).size };
  }, [selectedWorkoutId, workouts, sets, cardio]);

  // ─── Set editor ──────────────────────────────────────────────────

  function renderSetEditor(
    editSets: EditableSet[],
    onUpdate: (id: number, field: keyof EditableSet, value: string) => void,
    onAdd?: () => void,
    onRemove?: (id: number) => void,
  ) {
    if (onAdd) {
      // Add mode — flat list, mobile-friendly stacked cards
      return (
        <div style={{ display: "grid", gap: "12px" }}>
          {editSets.map((s, idx) => (
            <div key={s.id} style={setCardStyle}>
              <div style={setCardHeaderStyle}>
                <span style={setCardNumberStyle}>Set {idx + 1}</span>
                <button onClick={() => onRemove?.(s.id)} style={removeRowButtonStyle} title="Remove">×</button>
              </div>
              <div style={setCardFieldsStyle}>
                <div style={fieldGroupStyle}>
                  <div style={editFieldLabelStyle}>Exercise</div>
                  <input style={editInputStyle} value={s.exercise_name} onChange={(e) => onUpdate(s.id, "exercise_name", e.target.value)} placeholder="e.g. Bench Press" />
                </div>
                <div style={fieldGroupStyle}>
                  <div style={editFieldLabelStyle}>Body Part</div>
                  <BodyPartSelect value={s.body_part} onChange={(v) => onUpdate(s.id, "body_part", v)} />
                </div>
                <div style={setCardTwoColStyle}>
                  <div style={fieldGroupStyle}>
                    <div style={editFieldLabelStyle}>Weight (lb)</div>
                    <input style={editInputStyle} type="number" inputMode="decimal" value={s.weight} onChange={(e) => onUpdate(s.id, "weight", e.target.value)} placeholder="lbs" />
                  </div>
                  <div style={fieldGroupStyle}>
                    <div style={editFieldLabelStyle}>Reps</div>
                    <input style={editInputStyle} type="number" inputMode="numeric" value={s.reps} onChange={(e) => onUpdate(s.id, "reps", e.target.value)} placeholder="reps" />
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button onClick={onAdd} style={addRowButtonStyle}>+ Add Set</button>
        </div>
      );
    }

    // Edit mode — grouped by exercise, also card-style
    const groups = new Map<string, EditableSet[]>();
    for (const s of editSets) {
      const key = s.exercise_name || `__empty_${s.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return (
      <div style={{ display: "grid", gap: "14px" }}>
        {Array.from(groups.entries()).map(([key, gs]) => (
          <div key={key} style={editExerciseGroupStyle}>
            <div style={setCardTwoColStyle}>
              <div style={fieldGroupStyle}>
                <div style={editFieldLabelStyle}>Exercise Name</div>
                <input style={editInputStyle} value={gs[0].exercise_name} onChange={(e) => gs.forEach((s) => onUpdate(s.id, "exercise_name", e.target.value))} placeholder="Exercise name" />
              </div>
              <div style={fieldGroupStyle}>
                <div style={editFieldLabelStyle}>Body Part</div>
                <BodyPartSelect value={gs[0].body_part} onChange={(v) => gs.forEach((s) => onUpdate(s.id, "body_part", v))} />
              </div>
            </div>
            <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
              {gs.map((s, i) => (
                <div key={s.id} style={editSetRowStyle}>
                  <span style={editSetNumberStyle}>{s.set_number || i + 1}</span>
                  <div style={fieldGroupStyle}>
                    <input style={editInputStyle} type="number" inputMode="decimal" value={s.weight} onChange={(e) => onUpdate(s.id, "weight", e.target.value)} placeholder="lbs" />
                  </div>
                  <div style={fieldGroupStyle}>
                    <input style={editInputStyle} type="number" inputMode="numeric" value={s.reps} onChange={(e) => onUpdate(s.id, "reps", e.target.value)} placeholder="reps" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ─── Cardio editor ───────────────────────────────────────────────

  function renderCardioEditor(
    editCardio: EditableCardio[],
    onUpdate: (id: number, field: keyof EditableCardio, value: string) => void,
    onAdd?: () => void,
    onRemove?: (id: number) => void,
  ) {
    return (
      <div style={{ display: "grid", gap: "12px" }}>
        {editCardio.map((c) => (
          <div key={c.id} style={setCardStyle}>
            <div style={setCardHeaderStyle}>
              <span style={setCardNumberStyle}>Cardio Entry</span>
              {onRemove && <button onClick={() => onRemove(c.id)} style={removeRowButtonStyle} title="Remove">×</button>}
            </div>
            <div style={setCardFieldsStyle}>
              <div style={fieldGroupStyle}>
                <div style={editFieldLabelStyle}>Method</div>
                <input style={editInputStyle} value={c.method} onChange={(e) => onUpdate(c.id, "method", e.target.value)} placeholder="e.g. Running, Bike, Rowing" />
              </div>
              <div style={setCardTwoColStyle}>
                <div style={fieldGroupStyle}>
                  <div style={editFieldLabelStyle}>Duration (min)</div>
                  <input style={editInputStyle} type="number" inputMode="decimal" value={c.duration_seconds} onChange={(e) => onUpdate(c.id, "duration_seconds", e.target.value)} placeholder="min" />
                </div>
                <div style={fieldGroupStyle}>
                  <div style={editFieldLabelStyle}>Miles</div>
                  <input style={editInputStyle} type="number" inputMode="decimal" value={c.miles} onChange={(e) => onUpdate(c.id, "miles", e.target.value)} placeholder="mi" />
                </div>
              </div>
              <div style={fieldGroupStyle}>
                <div style={editFieldLabelStyle}>Notes (optional)</div>
                <input style={editInputStyle} value={c.notes} onChange={(e) => onUpdate(c.id, "notes", e.target.value)} placeholder="Optional notes" />
              </div>
            </div>
          </div>
        ))}
        {onAdd && <button onClick={onAdd} style={addRowButtonStyle}>+ Add Cardio Entry</button>}
      </div>
    );
  }

  // ─── VersaClimber editor ─────────────────────────────────────────

  function renderVersaEditor(
    versaList: EditableVersaClimber[],
    onUpdate: (id: number, field: keyof EditableVersaClimber, value: string) => void,
    onAdd?: () => void,
    onRemove?: (id: number) => void,
  ) {
    return (
      <div style={{ display: "grid", gap: "12px" }}>
        {versaList.map((v, idx) => (
          <div key={v.id} style={{ ...setCardStyle, borderColor: "rgba(124,92,255,0.30)" }}>
            <div style={setCardHeaderStyle}>
              <div>
                <span style={{ ...setCardNumberStyle, color: "#b09dff" }}>VersaClimber Session {versaList.length > 1 ? idx + 1 : ""}</span>
                <div style={{ color: "#888", fontSize: "11px", marginTop: "2px" }}>Targets Core / Abs + Legs</div>
              </div>
              {onRemove && <button onClick={() => onRemove(v.id)} style={removeRowButtonStyle} title="Remove">×</button>}
            </div>
            <div style={setCardTwoColStyle}>
              <div style={fieldGroupStyle}>
                <div style={editFieldLabelStyle}>Duration (min)</div>
                <input style={editInputStyle} type="number" inputMode="decimal" value={v.duration_minutes} onChange={(e) => onUpdate(v.id, "duration_minutes", e.target.value)} placeholder="min" />
              </div>
              <div style={fieldGroupStyle}>
                <div style={editFieldLabelStyle}>Feet Climbed</div>
                <input style={editInputStyle} type="number" inputMode="numeric" value={v.feet} onChange={(e) => onUpdate(v.id, "feet", e.target.value)} placeholder="ft" />
              </div>
            </div>
          </div>
        ))}
        {onAdd && <button onClick={onAdd} style={{ ...addRowButtonStyle, borderColor: "rgba(124,92,255,0.30)", color: "#b09dff" }}>+ Add VersaClimber Session</button>}
      </div>
    );
  }

  // ─── Loading ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <p style={eyebrowStyle}>RESPAWN PROGRESS REVIEW</p>
          <h1 style={heroTitleStyle}>Loading your review...</h1>
          <p style={heroSubStyle}>Reading your workouts, cardio sessions, and goal alignment data.</p>
        </section>
      </main>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <p style={eyebrowStyle}>RESPAWN PROGRESS REVIEW</p>
        <h1 style={heroTitleStyle}>Your Progress Review</h1>
        <p style={heroSubStyle}>Goal: {computed.goalTile.goalLabel} • Built from your real training data</p>
        <div style={heroStatsRowStyle}>
          <div style={heroStatBoxStyle}><div style={heroStatLabelStyle}>Total Workouts</div><div style={heroStatValueStyle}>{computed.totalWorkouts}</div></div>
          <div style={heroStatBoxStyle}><div style={heroStatLabelStyle}>Avg Session</div><div style={heroStatValueStyle}>{computed.avgSessionSeconds ? formatMinutesRounded(computed.avgSessionSeconds) : "--"}</div></div>
        </div>
      </section>

      <section style={twoColumnGridStyle}>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}><h2 style={sectionTitleStyle}>Goal Alignment</h2></div>
          <div style={goalHeroCardStyle}>
            <div style={goalHeroLabelStyle}>Current Goal</div>
            <div style={goalHeroValueStyle}>{computed.goalTile.goalLabel}</div>
            <p style={goalHeroSummaryStyle}>{computed.goalTile.summary}</p>
          </div>
          <div style={goalMetricGridStyle}>
            <div style={goalMetricCardStyle}><div style={goalMetricLabelStyle}>Frequency</div><div style={goalMetricValueStyle}>{computed.goalTile.frequencyLabel}</div><div style={goalMetricSubStyle}>{computed.goalTile.frequencyDetail}</div></div>
            <div style={goalMetricCardStyle}><div style={goalMetricLabelStyle}>Workload</div><div style={goalMetricValueStyle}>{computed.goalTile.workloadLabel}</div><div style={goalMetricSubStyle}>{computed.goalTile.workloadDetail}</div></div>
            <div style={goalMetricCardStyle}><div style={goalMetricLabelStyle}>Intensity</div><div style={goalMetricValueStyle}>{computed.goalTile.intensityLabel}</div><div style={goalMetricSubStyle}>{computed.goalTile.intensityDetail}</div></div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}><h2 style={sectionTitleStyle}>Body Part Split</h2></div>
          {computed.bodyPartSummary.length > 0 ? (
            <div style={barChartListStyle}>
              {computed.bodyPartSummary.map((item) => {
                const max = Math.max(...computed.bodyPartSummary.map((b) => b.sets), 1);
                return (
                  <div key={item.bodyPart} style={barRowStyle}>
                    <div style={barRowTopStyle}><span style={barLabelStyle}>{item.bodyPart}</span><span style={barValueStyle}>{item.sets} sets</span></div>
                    <div style={barTrackStyle}><div style={{ ...barFillStyle, width: `${Math.max((item.sets / max) * 100, 8)}%` }} /></div>
                  </div>
                );
              })}
            </div>
          ) : <p style={mutedStyle}>No body-part data yet.</p>}
        </section>
      </section>

      {/* ─── Recent Workouts ─────────────────────────────────────────── */}
      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Recent Workouts</h2>
          {!isAdding && <button onClick={openAddForm} style={addWorkoutButtonStyle}>+ Log Missed Workout</button>}
        </div>

        {/* Add form */}
        {isAdding && (
          <div ref={addFormRef} style={addFormCardStyle}>
            <div style={addFormHeaderStyle}>
              <div style={addFormTitleStyle}>➕ Log a Missed Workout</div>
              <button onClick={closeAddForm} style={viewButtonStyle}>Cancel</button>
            </div>
            <p style={addFormSubStyle}>Pick the day it happened, fill in what you remember, and save.</p>

            <div style={editModeWrapStyle}>
              {/* Date */}
              <div style={editSectionStyle}>
                <div style={editSectionLabelStyle}>Workout Date</div>
                <select style={editSelectStyle} value={newWorkout.selectedDate} onChange={(e) => updateNew("selectedDate", e.target.value)}>
                  {last30Days.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Name */}
              <div style={editSectionStyle}>
                <div style={editSectionLabelStyle}>Workout Name <span style={optionalLabelStyle}>(optional)</span></div>
                <input style={editInputStyle} value={newWorkout.workoutName} onChange={(e) => updateNew("workoutName", e.target.value)} placeholder="e.g. Push Day, Leg Session" />
              </div>

              {/* Sets */}
              <div style={editSectionStyle}>
                <div style={editSectionLabelStyle}>Sets <span style={optionalLabelStyle}>(one card per set)</span></div>
                {renderSetEditor(newWorkout.sets, updateNewSet, addNewSet, removeNewSet)}
              </div>

              {/* VersaClimber */}
              <div style={editSectionStyle}>
                <div style={versaSectionLabelStyle}>
                  <span style={editSectionLabelStyle}>VersaClimber</span>
                  <span style={versaTagStyle}>Core / Abs + Legs</span>
                </div>
                {newWorkout.versaClimber.length === 0
                  ? <button onClick={addNewVersa} style={{ ...addRowButtonStyle, borderColor: "rgba(124,92,255,0.30)", color: "#b09dff" }}>+ Add VersaClimber Session</button>
                  : renderVersaEditor(newWorkout.versaClimber, updateNewVersa, addNewVersa, removeNewVersa)}
              </div>

              {/* Cardio */}
              <div style={editSectionStyle}>
                <div style={editSectionLabelStyle}>Cardio <span style={optionalLabelStyle}>(other cardio)</span></div>
                {newWorkout.cardio.length === 0
                  ? <button onClick={addNewCardio} style={addRowButtonStyle}>+ Add Cardio Entry</button>
                  : renderCardioEditor(newWorkout.cardio, updateNewCardio, addNewCardio, removeNewCardio)}
              </div>

              <div style={editActionRowStyle}>
                <button onClick={saveNewWorkout} disabled={isAddingSaving} style={{ ...saveButtonStyle, opacity: isAddingSaving ? 0.6 : 1, cursor: isAddingSaving ? "not-allowed" : "pointer" }}>
                  {isAddingSaving ? "Saving..." : "Save Workout"}
                </button>
                <button onClick={closeAddForm} disabled={isAddingSaving} style={cancelButtonStyle}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Workout list */}
        {computed.visibleRecentWorkouts.length > 0 ? (
          <>
            <div style={workoutListStyle}>
              {computed.visibleRecentWorkouts.map((workout) => (
                <div key={workout.id} style={workoutCardStyle}>
                  <div style={workoutCardTopStyle}>
                    <div style={{ minWidth: 0 }}>
                      <div style={workoutNameStyle}>{workout.displayName}</div>
                      <div style={workoutMetaStyle}>{formatDateTime(workout.created_at)}</div>
                    </div>
                    <div style={workoutActionColumnStyle}>
                      <button style={viewButtonStyle} onClick={() => setSelectedWorkoutId(selectedWorkoutId === workout.id ? null : workout.id)}>
                        {selectedWorkoutId === workout.id ? "Close" : "Open Report"}
                      </button>
                      <button onClick={() => handleDeleteWorkout(workout.id)} disabled={deletingWorkoutId === workout.id} style={{ ...deleteWorkoutButtonStyle, opacity: deletingWorkoutId === workout.id ? 0.6 : 1 }}>
                        {deletingWorkoutId === workout.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>
                  <div style={workoutBadgeRowStyle}>
                    <span style={workoutBadgeStyle}>{workout.exerciseCount} {workout.exerciseCount === 1 ? "exercise" : "exercises"}</span>
                    <span style={workoutBadgeStyle}>{workout.totalSets} sets</span>
                    {workout.cardioEntries > 0 && <span style={workoutBadgeStyle}>{workout.cardioEntries} cardio</span>}
                    {workout.cardioDurationSeconds > 0 && <span style={workoutBadgeStyle}>{formatMinutesRounded(workout.cardioDurationSeconds)}</span>}
                    {workout.cardioMiles > 0 && <span style={workoutBadgeStyle}>{formatMiles(workout.cardioMiles)} mi</span>}
                    {workout.hasVersaClimber && <span style={{ ...workoutBadgeStyle, borderColor: "rgba(124,92,255,0.35)", color: "#c4b5fd" }}>VersaClimber</span>}
                  </div>
                </div>
              ))}
            </div>
            <div style={showMoreRowStyle}>
              {computed.hasMoreWorkouts
                ? <button onClick={() => setVisibleWorkoutCount((p) => p + 8)} style={secondaryButtonStyle}>Show Older Workouts</button>
                : workouts.length > 8
                ? <button onClick={() => setVisibleWorkoutCount(8)} style={secondaryButtonStyle}>Show Less</button>
                : null}
            </div>
          </>
        ) : !isAdding ? <p style={mutedStyle}>No workouts logged yet.</p> : null}
      </section>

      {/* ─── Workout Report ──────────────────────────────────────────── */}
      {selectedWorkoutReport && (
        <section ref={reportRef} style={selectedReportCardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>
              {isEditing ? "Editing — " : "Report — "}
              {isEditing && editState ? editState.workoutName || selectedWorkoutReport.displayName : selectedWorkoutReport.displayName}
            </h2>
            <div style={reportHeaderActionsStyle}>
              {!isEditing && <button onClick={enterEditMode} style={editButtonStyle}>✏️ Edit</button>}
              <button onClick={() => setSelectedWorkoutId(null)} style={viewButtonStyle}>Close</button>
            </div>
          </div>

          {isEditing && editState ? (
            <div style={editModeWrapStyle}>
              <div style={editSectionStyle}>
                <div style={editSectionLabelStyle}>Workout Name</div>
                <input style={editInputStyle} value={editState.workoutName} onChange={(e) => setEditState((p) => p ? { ...p, workoutName: e.target.value } : p)} placeholder="Workout name" />
              </div>
              {editState.sets.length > 0 && (
                <div style={editSectionStyle}>
                  <div style={editSectionLabelStyle}>Sets</div>
                  {renderSetEditor(editState.sets, updateEditSet)}
                </div>
              )}
              {editState.versaClimber.length > 0 && (
                <div style={editSectionStyle}>
                  <div style={versaSectionLabelStyle}>
                    <span style={editSectionLabelStyle}>VersaClimber</span>
                    <span style={versaTagStyle}>Core / Abs + Legs</span>
                  </div>
                  {renderVersaEditor(editState.versaClimber, updateEditVersa)}
                </div>
              )}
              {editState.cardio.length > 0 && (
                <div style={editSectionStyle}>
                  <div style={editSectionLabelStyle}>Cardio</div>
                  {renderCardioEditor(editState.cardio, updateEditCardio)}
                </div>
              )}
              <div style={editActionRowStyle}>
                <button onClick={saveEdits} disabled={isSaving} style={{ ...saveButtonStyle, opacity: isSaving ? 0.6 : 1, cursor: isSaving ? "not-allowed" : "pointer" }}>{isSaving ? "Saving..." : "Save Changes"}</button>
                <button onClick={cancelEdit} disabled={isSaving} style={cancelButtonStyle}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <p style={reportIntroStyle}>Snapshot built from your logged lifting and cardio data.</p>
              <div style={heroStatsRowStyle}>
                <div style={heroStatBoxStyle}><div style={heroStatLabelStyle}>Exercises</div><div style={heroStatValueStyle}>{selectedWorkoutReport.exerciseCount}</div></div>
                <div style={heroStatBoxStyle}><div style={heroStatLabelStyle}>Sets</div><div style={heroStatValueStyle}>{selectedWorkoutReport.totalSets}</div></div>
                <div style={heroStatBoxStyle}><div style={heroStatLabelStyle}>Session Time</div><div style={heroStatValueStyle}>{selectedWorkoutReport.workout.duration_seconds ? formatMinutesRounded(selectedWorkoutReport.workout.duration_seconds) : "--"}</div></div>
                {selectedWorkoutReport.totalCardioDuration > 0 && <div style={heroStatBoxStyle}><div style={heroStatLabelStyle}>Cardio Time</div><div style={heroStatValueStyle}>{formatMinutesRounded(selectedWorkoutReport.totalCardioDuration)}</div></div>}
                {selectedWorkoutReport.totalCardioMiles > 0 && <div style={heroStatBoxStyle}><div style={heroStatLabelStyle}>Cardio Miles</div><div style={heroStatValueStyle}>{formatMiles(selectedWorkoutReport.totalCardioMiles)}</div></div>}
                {selectedWorkoutReport.versaEntries.length > 0 && <div style={heroStatBoxStyle}><div style={heroStatLabelStyle}>VersaClimber</div><div style={{ ...heroStatValueStyle, color: "#c4b5fd" }}>{selectedWorkoutReport.versaEntries.reduce((s, v) => s + toNumber(v.miles), 0).toLocaleString()} ft</div></div>}
              </div>

              <div style={reportGridStyle}>
                {/* Exercises */}
                {selectedWorkoutReport.exercises.length > 0 && (
                  <section style={reportSubCardStyle}>
                    <div style={reportSubTitleStyle}>Exercises</div>
                    <div style={exerciseListStyle}>
                      {selectedWorkoutReport.exercises.map((ex) => {
                        const key = `${selectedWorkoutReport.workout.id}-${ex.name}`;
                        const expanded = !!expandedExercises[key];
                        return (
                          <div key={ex.name} style={exerciseCardStyle}>
                            <button type="button" onClick={() => toggleExercise(key)} style={exerciseToggleButtonStyle}>
                              <div><div style={exerciseNameStyle}>{ex.name}</div><div style={exerciseMetaStyle}>{ex.bodyPart} • {ex.sets.length} sets</div></div>
                              <div style={exerciseExpandLabelStyle}>{expanded ? "Hide" : "View sets"}</div>
                            </button>
                            {expanded && (
                              <div style={setTableStyle}>
                                {ex.sets.map((set, i) => (
                                  <div key={`${ex.name}-${i}`} style={setRowStyle}>
                                    <span>Set {set.setNumber || i + 1}</span>
                                    <span>{set.weight || "--"} lb</span>
                                    <span>{set.reps || "--"} reps</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* VersaClimber */}
                {selectedWorkoutReport.versaEntries.length > 0 && (
                  <section style={{ ...reportSubCardStyle, borderColor: "rgba(124,92,255,0.25)" }}>
                    <div style={{ ...reportSubTitleStyle, color: "#b09dff" }}>VersaClimber</div>
                    <div style={exerciseListStyle}>
                      {selectedWorkoutReport.versaEntries.map((v, i) => (
                        <div key={v.id} style={exerciseCardStyle}>
                          <div style={exerciseNameStyle}>Session {selectedWorkoutReport.versaEntries.length > 1 ? i + 1 : ""}</div>
                          <div style={exerciseMetaStyle}>Core / Abs + Legs</div>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                            {v.duration_seconds && <span style={{ ...workoutBadgeStyle, borderColor: "rgba(124,92,255,0.30)", color: "#c4b5fd" }}>{formatMinutesRounded(v.duration_seconds)}</span>}
                            {toNumber(v.miles) > 0 && <span style={{ ...workoutBadgeStyle, borderColor: "rgba(124,92,255,0.30)", color: "#c4b5fd" }}>{toNumber(v.miles).toLocaleString()} ft</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Cardio */}
                {selectedWorkoutReport.cardioEntries.length > 0 && (
                  <section style={reportSubCardStyle}>
                    <div style={reportSubTitleStyle}>Cardio</div>
                    <div style={exerciseListStyle}>
                      {selectedWorkoutReport.cardioEntries.map((entry) => (
                        <div key={entry.id} style={exerciseCardStyle}>
                          <div style={exerciseNameStyle}>{entry.method ? titleCase(entry.method) : "Cardio"}</div>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                            {entry.duration_seconds && <span style={workoutBadgeStyle}>{formatMinutesRounded(entry.duration_seconds)}</span>}
                            {toNumber(entry.miles) > 0 && <span style={workoutBadgeStyle}>{formatMiles(toNumber(entry.miles))} mi</span>}
                          </div>
                          {entry.notes && <div style={exerciseMetaStyle}>{entry.notes}</div>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </>
          )}
        </section>
      )}

      <section style={twoColumnGridStyle}>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}><h2 style={sectionTitleStyle}>AI Insights</h2></div>
          <div style={insightListStyle}>
            <div style={insightCardStyle}><div style={insightLabelStyle}>Top Win</div><div style={insightTextStyle}>{aiInsights?.topWin || computed.aiInsightsFallback[0]}</div></div>
            <div style={insightCardStyle}><div style={insightLabelStyle}>Top Concern</div><div style={insightTextStyle}>{aiInsights?.topConcern || computed.aiInsightsFallback[1]}</div></div>
            <div style={insightCardStyle}><div style={insightLabelStyle}>Next Best Move</div><div style={insightTextStyle}>{aiInsights?.nextBestMove || computed.aiInsightsFallback[2]}</div></div>
          </div>
        </section>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}><h2 style={sectionTitleStyle}>Review Highlights</h2></div>
          <div style={highlightGridStyle}>
            <div style={highlightCardStyle}><div style={highlightLabelStyle}>Goal</div><div style={highlightMainStyle}>{computed.goalTile.goalLabel}</div><div style={highlightSubStyle}>Pulled from your saved profile</div></div>
            <div style={highlightCardStyle}><div style={highlightLabelStyle}>Frequency</div><div style={highlightMainStyle}>{computed.goalTile.frequencyLabel}</div><div style={highlightSubStyle}>{computed.goalTile.frequencyDetail}</div></div>
            <div style={highlightCardStyle}><div style={highlightLabelStyle}>Intensity</div><div style={highlightMainStyle}>{computed.goalTile.intensityLabel}</div><div style={highlightSubStyle}>{computed.goalTile.intensityDetail}</div></div>
          </div>
        </section>
      </section>

      {status && <p style={statusStyle}>{status}</p>}
    </main>
  );
}

/* ─── STYLES ──────────────────────────────────────────────────────── */

const pageStyle: CSSProperties = { minHeight: "100vh", background: "linear-gradient(180deg, #050505 0%, #0a0a0a 35%, #0f0f0f 100%)", color: "white", padding: "20px 14px 140px", fontFamily: "sans-serif" };
const heroCardStyle: CSSProperties = { background: "linear-gradient(135deg, rgba(255,26,26,0.18) 0%, rgba(20,20,20,1) 55%, rgba(10,10,10,1) 100%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "24px", padding: "20px 18px", marginBottom: "16px", boxShadow: "0 10px 30px rgba(0,0,0,0.35)" };
const eyebrowStyle: CSSProperties = { color: "#ff6b6b", fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", margin: "0 0 8px" };
const heroTitleStyle: CSSProperties = { color: "#ffffff", fontSize: "26px", lineHeight: 1.1, fontWeight: 800, margin: "0 0 6px" };
const heroSubStyle: CSSProperties = { color: "#d0d0d0", fontSize: "14px", margin: 0 };
const heroStatsRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginTop: "16px" };
const heroStatBoxStyle: CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "12px" };
const heroStatLabelStyle: CSSProperties = { color: "#aaa", fontSize: "11px", marginBottom: "4px" };
const heroStatValueStyle: CSSProperties = { color: "#fff", fontSize: "20px", fontWeight: 900 };
const twoColumnGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "14px", marginBottom: "14px" };
const cardStyle: CSSProperties = { background: "#121212", border: "1px solid #222", borderRadius: "20px", padding: "18px", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", marginBottom: "14px" };
const selectedReportCardStyle: CSSProperties = { background: "linear-gradient(135deg, rgba(255,26,26,0.10), rgba(18,18,18,1))", border: "1px solid rgba(255,107,107,0.25)", borderRadius: "20px", padding: "18px", marginBottom: "14px" };
const sectionHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" };
const sectionTitleStyle: CSSProperties = { color: "#ff4d4d", margin: 0, fontSize: "17px", fontWeight: 800 };
const reportHeaderActionsStyle: CSSProperties = { display: "flex", gap: "8px", alignItems: "center" };
const goalHeroCardStyle: CSSProperties = { background: "linear-gradient(135deg, rgba(255,26,26,0.10), rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "14px", marginBottom: "12px" };
const goalHeroLabelStyle: CSSProperties = { color: "#ff9b9b", fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" };
const goalHeroValueStyle: CSSProperties = { color: "#fff", fontSize: "22px", fontWeight: 900, lineHeight: 1.2 };
const goalHeroSummaryStyle: CSSProperties = { color: "#d8d8d8", fontSize: "13px", lineHeight: 1.5, marginTop: "8px", marginBottom: 0 };
const goalMetricGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" };
const goalMetricCardStyle: CSSProperties = { background: "#171717", border: "1px solid #252525", borderRadius: "14px", padding: "12px" };
const goalMetricLabelStyle: CSSProperties = { color: "#aaa", fontSize: "11px", marginBottom: "6px" };
const goalMetricValueStyle: CSSProperties = { color: "#fff", fontSize: "20px", fontWeight: 900, marginBottom: "6px" };
const goalMetricSubStyle: CSSProperties = { color: "#b8b8b8", fontSize: "12px", lineHeight: 1.4 };
const barChartListStyle: CSSProperties = { display: "grid", gap: "10px" };
const barRowStyle: CSSProperties = { display: "grid", gap: "6px" };
const barRowTopStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const barLabelStyle: CSSProperties = { color: "#ffffff", fontSize: "13px", fontWeight: 700 };
const barValueStyle: CSSProperties = { color: "#9f9f9f", fontSize: "12px", fontWeight: 700 };
const barTrackStyle: CSSProperties = { width: "100%", height: "10px", borderRadius: "999px", background: "rgba(255,255,255,0.06)", overflow: "hidden" };
const barFillStyle: CSSProperties = { height: "100%", borderRadius: "999px", background: "linear-gradient(90deg, rgba(34,197,94,0.70), rgba(74,222,128,1))" };
const workoutListStyle: CSSProperties = { display: "grid", gap: "10px" };
const workoutCardStyle: CSSProperties = { background: "#171717", border: "1px solid #252525", borderRadius: "14px", padding: "14px" };
const workoutCardTopStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "10px" };
const workoutActionColumnStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end", flexShrink: 0 };
const workoutNameStyle: CSSProperties = { color: "#fff", fontWeight: 800, fontSize: "15px", wordBreak: "break-word" };
const workoutMetaStyle: CSSProperties = { color: "#8f8f8f", fontSize: "12px", marginTop: "3px" };
const workoutBadgeRowStyle: CSSProperties = { display: "flex", gap: "6px", flexWrap: "wrap" };
const workoutBadgeStyle: CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", color: "#dddddd", borderRadius: "999px", padding: "5px 10px", fontSize: "11px", fontWeight: 700 };
const viewButtonStyle: CSSProperties = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "#ffffff", borderRadius: "10px", padding: "8px 12px", fontSize: "12px", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" };
const editButtonStyle: CSSProperties = { background: "rgba(255,180,0,0.12)", border: "1px solid rgba(255,180,0,0.30)", color: "#FFD66B", borderRadius: "10px", padding: "8px 14px", fontSize: "12px", fontWeight: 800, cursor: "pointer" };
const addWorkoutButtonStyle: CSSProperties = { background: "rgba(41,204,112,0.12)", border: "1px solid rgba(41,204,112,0.30)", color: "#5AFFA0", borderRadius: "10px", padding: "8px 14px", fontSize: "12px", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" };
const deleteWorkoutButtonStyle: CSSProperties = { background: "rgba(255,77,77,0.10)", border: "1px solid rgba(255,77,77,0.28)", color: "#ff9c9c", borderRadius: "10px", padding: "8px 12px", fontSize: "12px", fontWeight: 800, cursor: "pointer" };
const secondaryButtonStyle: CSSProperties = { background: "#222", border: "1px solid #333", padding: "12px 16px", borderRadius: "10px", color: "white", fontWeight: 700, fontSize: "14px", cursor: "pointer" };
const showMoreRowStyle: CSSProperties = { display: "flex", justifyContent: "center", marginTop: "14px" };
const reportIntroStyle: CSSProperties = { color: "#d7d7d7", fontSize: "13px", lineHeight: 1.5, marginTop: 0, marginBottom: "14px" };
const reportGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px", marginTop: "14px" };
const reportSubCardStyle: CSSProperties = { background: "#171717", border: "1px solid #252525", borderRadius: "14px", padding: "14px" };
const reportSubTitleStyle: CSSProperties = { color: "#ff4d4d", fontSize: "14px", fontWeight: 800, marginBottom: "10px" };
const exerciseListStyle: CSSProperties = { display: "grid", gap: "10px" };
const exerciseCardStyle: CSSProperties = { background: "#141414", border: "1px solid #232323", borderRadius: "12px", padding: "12px" };
const exerciseNameStyle: CSSProperties = { color: "#fff", fontWeight: 800, fontSize: "14px" };
const exerciseMetaStyle: CSSProperties = { color: "#999", fontSize: "12px", marginTop: "3px" };
const exerciseToggleButtonStyle: CSSProperties = { width: "100%", background: "transparent", border: "none", color: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: 0, cursor: "pointer", textAlign: "left" };
const exerciseExpandLabelStyle: CSSProperties = { color: "#ff9b9b", fontSize: "12px", fontWeight: 800, flexShrink: 0 };
const setTableStyle: CSSProperties = { display: "grid", gap: "6px", marginTop: "10px" };
const setRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", color: "#d8d8d8", fontSize: "12px", padding: "7px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.03)" };
const insightListStyle: CSSProperties = { display: "grid", gap: "10px" };
const insightCardStyle: CSSProperties = { background: "linear-gradient(135deg, rgba(255,26,26,0.08), rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "14px" };
const insightLabelStyle: CSSProperties = { color: "#ff9b9b", fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" };
const insightTextStyle: CSSProperties = { color: "#f0f0f0", lineHeight: 1.5, fontSize: "14px" };
const highlightGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" };
const highlightCardStyle: CSSProperties = { background: "linear-gradient(135deg, rgba(255,26,26,0.08), rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "14px" };
const highlightLabelStyle: CSSProperties = { color: "#ff9b9b", fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" };
const highlightMainStyle: CSSProperties = { color: "#fff", fontSize: "18px", fontWeight: 900, lineHeight: 1.2 };
const highlightSubStyle: CSSProperties = { color: "#bbbbbb", fontSize: "12px", marginTop: "6px", lineHeight: 1.4 };
const mutedStyle: CSSProperties = { color: "#9f9f9f", margin: 0 };
const statusStyle: CSSProperties = { color: "#cccccc", marginTop: "16px", marginBottom: 0 };

// Add form
const addFormCardStyle: CSSProperties = { background: "linear-gradient(135deg, rgba(41,204,112,0.08), rgba(18,18,18,1))", border: "1px solid rgba(41,204,112,0.20)", borderRadius: "18px", padding: "18px", marginBottom: "16px" };
const addFormHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" };
const addFormTitleStyle: CSSProperties = { color: "#5AFFA0", fontSize: "15px", fontWeight: 900 };
const addFormSubStyle: CSSProperties = { color: "#b0b0b0", fontSize: "13px", lineHeight: 1.5, margin: "0 0 16px" };

// Edit / shared fields
const editModeWrapStyle: CSSProperties = { display: "grid", gap: "20px" };
const editSectionStyle: CSSProperties = { display: "grid", gap: "10px" };
const editSectionLabelStyle: CSSProperties = { color: "#ff9b9b", fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" };
const optionalLabelStyle: CSSProperties = { color: "#555", fontWeight: 600, textTransform: "none", letterSpacing: 0, fontSize: "11px" };
const versaSectionLabelStyle: CSSProperties = { display: "flex", alignItems: "center", gap: "8px" };
const versaTagStyle: CSSProperties = { background: "rgba(124,92,255,0.15)", border: "1px solid rgba(124,92,255,0.30)", color: "#b09dff", borderRadius: "999px", padding: "3px 8px", fontSize: "10px", fontWeight: 800 };
const editExerciseGroupStyle: CSSProperties = { background: "#171717", border: "1px solid #2a2a2a", borderRadius: "14px", padding: "14px" };
const editFieldLabelStyle: CSSProperties = { color: "#777", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "5px" };
const editInputStyle: CSSProperties = { width: "100%", background: "#0e0e0e", border: "1px solid #333", borderRadius: "10px", padding: "12px", color: "#fff", fontSize: "15px", fontFamily: "sans-serif", outline: "none", boxSizing: "border-box" };
const editSelectStyle: CSSProperties = { width: "100%", background: "#0e0e0e", border: "1px solid #333", borderRadius: "10px", padding: "12px", color: "#fff", fontSize: "15px", fontFamily: "sans-serif", outline: "none", boxSizing: "border-box", cursor: "pointer", appearance: "auto" };
const editSetRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "32px 1fr 1fr", gap: "8px", alignItems: "center" };
const editSetNumberStyle: CSSProperties = { color: "#777", fontSize: "13px", fontWeight: 700, textAlign: "center" };
const editActionRowStyle: CSSProperties = { display: "flex", gap: "10px", flexWrap: "wrap" };
const saveButtonStyle: CSSProperties = { background: "#28C76F", border: "none", color: "#000", borderRadius: "12px", padding: "14px 24px", fontSize: "15px", fontWeight: 900, flex: 1, minWidth: "120px" };
const cancelButtonStyle: CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#fff", borderRadius: "12px", padding: "14px 24px", fontSize: "15px", fontWeight: 800, cursor: "pointer" };

// Mobile-first set card styles
const setCardStyle: CSSProperties = { background: "#171717", border: "1px solid #2a2a2a", borderRadius: "14px", padding: "14px" };
const setCardHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" };
const setCardNumberStyle: CSSProperties = { color: "#ff9b9b", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" };
const setCardFieldsStyle: CSSProperties = { display: "grid", gap: "10px" };
const setCardTwoColStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" };
const fieldGroupStyle: CSSProperties = { display: "grid", gap: "5px" };
const addRowButtonStyle: CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: "12px", padding: "12px 14px", color: "#aaa", fontSize: "14px", fontWeight: 700, cursor: "pointer", textAlign: "left" as const, width: "100%" };
const removeRowButtonStyle: CSSProperties = { background: "rgba(255,77,77,0.10)", border: "1px solid rgba(255,77,77,0.25)", color: "#ff9c9c", borderRadius: "8px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "18px", fontWeight: 900, flexShrink: 0, padding: 0 };