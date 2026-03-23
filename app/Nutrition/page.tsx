"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type MacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
};

type FoodEntry = {
  id: string;
  food_name: string;
  brand?: string | null;
  serving_size?: string | null;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  logged_at: string;
  logged_date: string;
};

type SearchResult = {
  name: string;
  brand: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  serving_size: string;
};

type OFFProduct = {
  product_name?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: {
    "energy-kcal_serving"?: number;
    "energy-kcal_100g"?: number;
    proteins_serving?: number;
    proteins_100g?: number;
    carbohydrates_serving?: number;
    carbohydrates_100g?: number;
    fat_serving?: number;
    fat_100g?: number;
    sugars_serving?: number;
    sugars_100g?: number;
  };
};

type USDAFood = {
  description: string;
  brandOwner?: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients: { nutrientName: string; value: number }[];
};

type Profile = {
  goal?: string | null;
  bodyweight?: string | null;
  experience_level?: string | null;
};

type AddMode = "search" | "barcode" | "quick" | "custom";
type ViewMode = "today" | "history";
type MealSlot = "Breakfast" | "Lunch" | "Dinner" | "Snacks";

// ─── Constants ────────────────────────────────────────────────────────────────

const USDA_API_KEY = process.env.NEXT_PUBLIC_USDA_API_KEY ?? "";
const TARGETS_KEY  = "respawn_nutrition_targets";
const RECENT_KEY   = "respawn_recent_foods";

const DEFAULT_TARGETS: MacroTargets = {
  calories: 2200,
  protein: 160,
  carbs: 220,
  fat: 70,
  sugar: 50,
};

const MEAL_SLOTS: MealSlot[] = ["Breakfast", "Lunch", "Dinner", "Snacks"];

function getMealSlot(isoTimestamp: string): MealSlot {
  const hour = new Date(isoTimestamp).getHours();
  if (hour < 11) return "Breakfast";
  if (hour < 15) return "Lunch";
  if (hour < 20) return "Dinner";
  return "Snacks";
}

const QUICK_FOODS: SearchResult[] = [
  { name: "Chicken Breast (4oz)", brand: "Generic", calories: 185, protein: 35, carbs: 0, fat: 4, sugar: 0, serving_size: "4 oz" },
  { name: "White Rice (1 cup cooked)", brand: "Generic", calories: 206, protein: 4, carbs: 45, fat: 0, sugar: 0, serving_size: "1 cup" },
  { name: "Whole Egg", brand: "Generic", calories: 78, protein: 6, carbs: 1, fat: 5, sugar: 1, serving_size: "1 large" },
  { name: "Greek Yogurt (1 cup)", brand: "Generic", calories: 130, protein: 22, carbs: 9, fat: 0, sugar: 7, serving_size: "1 cup" },
  { name: "Oats (1/2 cup dry)", brand: "Generic", calories: 150, protein: 5, carbs: 27, fat: 3, sugar: 1, serving_size: "1/2 cup" },
  { name: "Banana", brand: "Generic", calories: 105, protein: 1, carbs: 27, fat: 0, sugar: 14, serving_size: "1 medium" },
  { name: "Almonds (1oz)", brand: "Generic", calories: 164, protein: 6, carbs: 6, fat: 14, sugar: 1, serving_size: "1 oz" },
  { name: "Salmon (4oz)", brand: "Generic", calories: 233, protein: 25, carbs: 0, fat: 14, sugar: 0, serving_size: "4 oz" },
  { name: "Sweet Potato (medium)", brand: "Generic", calories: 103, protein: 2, carbs: 24, fat: 0, sugar: 7, serving_size: "1 medium" },
  { name: "Cottage Cheese (1/2 cup)", brand: "Generic", calories: 110, protein: 14, carbs: 6, fat: 5, sugar: 4, serving_size: "1/2 cup" },
  { name: "Protein Shake (1 scoop)", brand: "Generic", calories: 120, protein: 25, carbs: 3, fat: 2, sugar: 1, serving_size: "1 scoop" },
  { name: "Brown Rice (1 cup cooked)", brand: "Generic", calories: 216, protein: 5, carbs: 45, fat: 2, sugar: 0, serving_size: "1 cup" },
  { name: "Broccoli (1 cup)", brand: "Generic", calories: 55, protein: 4, carbs: 11, fat: 1, sugar: 3, serving_size: "1 cup" },
  { name: "Ground Beef 90/10 (4oz)", brand: "Generic", calories: 196, protein: 24, carbs: 0, fat: 11, sugar: 0, serving_size: "4 oz" },
  { name: "Whole Milk (1 cup)", brand: "Generic", calories: 149, protein: 8, carbs: 12, fat: 8, sugar: 12, serving_size: "1 cup" },
  { name: "Avocado (half)", brand: "Generic", calories: 120, protein: 2, carbs: 6, fat: 11, sugar: 0, serving_size: "1/2 medium" },
  { name: "Tuna (3oz canned)", brand: "Generic", calories: 100, protein: 22, carbs: 0, fat: 1, sugar: 0, serving_size: "3 oz" },
  { name: "Peanut Butter (2 tbsp)", brand: "Generic", calories: 188, protein: 8, carbs: 6, fat: 16, sugar: 3, serving_size: "2 tbsp" },
  { name: "Apple", brand: "Generic", calories: 95, protein: 0, carbs: 25, fat: 0, sugar: 19, serving_size: "1 medium" },
  { name: "Bread (1 slice whole wheat)", brand: "Generic", calories: 81, protein: 4, carbs: 14, fat: 1, sugar: 2, serving_size: "1 slice" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function toNum(v: string | number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === todayDate()) return "Today";
  if (dateStr === yesterday.toISOString().slice(0, 10)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// Pull a nutrient value from USDA food nutrients array
function usdaNutrient(food: USDAFood, ...names: string[]): number {
  for (const name of names) {
    const found = food.foodNutrients.find((n) =>
      n.nutrientName.toLowerCase().includes(name.toLowerCase())
    );
    if (found && found.value > 0) return found.value;
  }
  return 0;
}

// Extract macros from Open Food Facts product (used for barcode)
function offMacros(p: OFFProduct): Omit<SearchResult, "name" | "brand" | "serving_size"> {
  const n = p.nutriments ?? {};
  return {
    calories: round1(toNum(n["energy-kcal_serving"]) || toNum(n["energy-kcal_100g"])),
    protein:  round1(toNum(n.proteins_serving)        || toNum(n.proteins_100g)),
    carbs:    round1(toNum(n.carbohydrates_serving)   || toNum(n.carbohydrates_100g)),
    fat:      round1(toNum(n.fat_serving)             || toNum(n.fat_100g)),
    sugar:    round1(toNum(n.sugars_serving)          || toNum(n.sugars_100g)),
  };
}

function getTips(
  goal: string | null | undefined,
  targets: MacroTargets,
  totals: MacroTargets
): string[] {
  const tips: string[] = [];
  const g = (goal || "").toLowerCase();
  const proteinLeft = targets.protein - totals.protein;
  const calsLeft    = targets.calories - totals.calories;

  if (proteinLeft > 40) {
    tips.push(`${Math.round(proteinLeft)}g protein still to go — a shake, chicken, or Greek yogurt will close the gap.`);
  } else if (proteinLeft < -10) {
    tips.push(`Protein target hit. Let your training do the rest today.`);
  }

  if (g.includes("cut") || g.includes("fat_loss") || g.includes("burn")) {
    if (calsLeft < 0) tips.push(`You're ${Math.abs(Math.round(calsLeft))} kcal over today. Keep tomorrow lighter to rebalance.`);
    else if (calsLeft > 400) tips.push(`${Math.round(calsLeft)} kcal left — stay in your window and lead with protein.`);
    if (totals.sugar > targets.sugar) tips.push(`Sugar is over target. Swap processed snacks for whole foods.`);
  } else if (g.includes("build") || g.includes("muscle") || g.includes("hypertrophy") || g.includes("bulk")) {
    if (calsLeft > 300) tips.push(`You need ${Math.round(calsLeft)} more kcal to hit your bulk target — add a meal or a dense snack.`);
    if (targets.carbs - totals.carbs > 50) tips.push(`Carbs fuel your lifts. Top up with rice, oats, or fruit.`);
  } else {
    if (Math.abs(calsLeft) < 100) tips.push(`Right on track with calories today — solid consistency.`);
    else if (calsLeft > 200) tips.push(`${Math.round(calsLeft)} kcal left. Eat enough to support recovery.`);
  }

  if (tips.length === 0) tips.push(`Macros look solid. Stay consistent and keep logging.`);
  return tips.slice(0, 2);
}

// ─── Macro Bar ────────────────────────────────────────────────────────────────

function MacroBar({ label, value, target, color }: {
  label: string; value: number; target: number; color: string;
}) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  const over = value > target;
  return (
    <div style={macroBarWrapStyle}>
      <div style={macroBarTopStyle}>
        <span style={macroBarLabelStyle}>{label}</span>
        <span style={{ ...macroBarValueStyle, color: over ? "#ff6b6b" : "#fff" }}>
          {Math.round(value)}g
          <span style={macroBarTargetStyle}> / {target}g</span>
        </span>
      </div>
      <div style={macroBarTrackStyle}>
        <div style={{
          ...macroBarFillStyle,
          width: `${pct}%`,
          background: over ? "#ff4d4d" : color,
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NutritionPage() {
  const router = useRouter();

  const [userId, setUserId]     = useState<string | null>(null);
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [status, setStatus]     = useState("");

  const [targets, setTargets]               = useState<MacroTargets>(DEFAULT_TARGETS);
  const [showTargetEditor, setShowTargetEditor] = useState(false);
  const [draftTargets, setDraftTargets]     = useState<MacroTargets>(DEFAULT_TARGETS);

  const [foodLog, setFoodLog]         = useState<FoodEntry[]>([]);
  const [recentFoods, setRecentFoods] = useState<SearchResult[]>([]);

  const [viewMode, setViewMode]   = useState<ViewMode>("today");
  const [addMode, setAddMode]     = useState<AddMode>("search");
  const [showAddPanel, setShowAddPanel] = useState(false);

  // Search
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Barcode
  const [barcodeInput, setBarcodeInput]   = useState("");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [cameraActive, setCameraActive]   = useState(false);
  const [cameraError, setCameraError]     = useState("");
  const videoRef       = useRef<HTMLVideoElement | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchTimeout  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Custom
  const [customFood, setCustomFood] = useState({
    name: "", calories: "", protein: "", carbs: "", fat: "", sugar: "", serving_size: "",
  });

  // Pending confirm
  const [pendingFood, setPendingFood]       = useState<SearchResult | null>(null);
  const [pendingServings, setPendingServings] = useState("1");

  const [aiTips, setAiTips] = useState<string[]>([]);

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    void init();
    return () => stopCamera();
  }, []);

  async function init() {
    setLoading(true);
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) { router.replace("/login"); return; }
    setUserId(user.id);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("goal, bodyweight, experience_level")
      .eq("user_id", user.id)
      .maybeSingle();
    setProfile((profileData as Profile) ?? null);

    const savedTargets = localStorage.getItem(TARGETS_KEY);
    if (savedTargets) {
      try {
        const t = JSON.parse(savedTargets) as MacroTargets;
        setTargets(t);
        setDraftTargets(t);
      } catch { /* ignore */ }
    }

    const savedRecent = localStorage.getItem(RECENT_KEY);
    if (savedRecent) {
      try { setRecentFoods(JSON.parse(savedRecent) as SearchResult[]); } catch { /* ignore */ }
    }

    await loadLogs(user.id);
    setLoading(false);
  }

  async function loadLogs(uid: string) {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data, error } = await supabase
      .from("nutrition_logs")
      .select("id, food_name, brand, serving_size, servings, calories, protein, carbs, fat, sugar, logged_at, logged_date")
      .eq("user_id", uid)
      .gte("logged_date", since.toISOString().slice(0, 10))
      .order("logged_at", { ascending: false });

    if (error) { console.error("Nutrition load error:", error); return; }

    setFoodLog(
      (data ?? []).map((r) => ({
        ...r,
        id: String(r.id),
        servings:  toNum(r.servings),
        calories:  toNum(r.calories),
        protein:   toNum(r.protein),
        carbs:     toNum(r.carbs),
        fat:       toNum(r.fat),
        sugar:     toNum(r.sugar),
      })) as FoodEntry[]
    );
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const today = todayDate();

  const todayEntries = useMemo(() =>
    foodLog.filter((e) => e.logged_date === today),
  [foodLog, today]);

  const todayTotals = useMemo((): MacroTargets => ({
    calories: round1(todayEntries.reduce((s, e) => s + e.calories, 0)),
    protein:  round1(todayEntries.reduce((s, e) => s + e.protein,  0)),
    carbs:    round1(todayEntries.reduce((s, e) => s + e.carbs,    0)),
    fat:      round1(todayEntries.reduce((s, e) => s + e.fat,      0)),
    sugar:    round1(todayEntries.reduce((s, e) => s + e.sugar,    0)),
  }), [todayEntries]);

  const mealGroups = useMemo(() => {
    const g: Record<MealSlot, FoodEntry[]> = { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] };
    for (const e of todayEntries) g[getMealSlot(e.logged_at)].push(e);
    return g;
  }, [todayEntries]);

  const historyByDate = useMemo(() => {
    const map = new Map<string, { entries: FoodEntry[]; totals: MacroTargets }>();
    for (const e of foodLog) {
      if (e.logged_date === today) continue;
      if (!map.has(e.logged_date)) {
        map.set(e.logged_date, { entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0 } });
      }
      const d = map.get(e.logged_date)!;
      d.entries.push(e);
      d.totals.calories += e.calories;
      d.totals.protein  += e.protein;
      d.totals.carbs    += e.carbs;
      d.totals.fat      += e.fat;
      d.totals.sugar    += e.sugar;
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);
  }, [foodLog, today]);

  useEffect(() => {
    setAiTips(getTips(profile?.goal, targets, todayTotals));
  }, [todayTotals, targets, profile?.goal]);

  // ── USDA Search ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { void doSearch(searchQuery.trim()); }, 450);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery]);

  async function doSearch(query: string) {
    setSearchLoading(true);
    try {
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=${USDA_API_KEY}&pageSize=20&dataType=Branded,Foundation,SR%20Legacy`;
      const res  = await fetch(url);
      const data = await res.json() as { foods?: USDAFood[] };

      const results: SearchResult[] = (data.foods ?? [])
        .map((food) => {
          // Energy — USDA sometimes uses "Energy" or "Energy (Atwater General Factors)"
          const calories = usdaNutrient(food, "Energy");
          const protein  = usdaNutrient(food, "Protein");
          const carbs    = usdaNutrient(food, "Carbohydrate, by difference", "Carbohydrate");
          const fat      = usdaNutrient(food, "Total lipid (fat)", "Total fat");
          const sugar    = usdaNutrient(food, "Sugars, total", "Sugars");

          const serving = food.servingSize
            ? `${food.servingSize}${food.servingSizeUnit ?? "g"}`
            : "100g";

          return {
            name:         food.description,
            brand:        food.brandOwner || food.brandName || "",
            serving_size: serving,
            calories:     round1(calories),
            protein:      round1(protein),
            carbs:        round1(carbs),
            fat:          round1(fat),
            sugar:        round1(sugar),
          };
        })
        // Only keep results with calorie data and a real name
        .filter((r) => r.calories > 0 && r.name.trim().length > 0)
        // Remove obvious duplicates (same name + brand)
        .filter((r, i, arr) =>
          arr.findIndex((x) => x.name === r.name && x.brand === r.brand) === i
        )
        .slice(0, 10);

      setSearchResults(results);
    } catch {
      setStatus("Search failed. Check your connection.");
    } finally {
      setSearchLoading(false);
    }
  }

  // ── Barcode (Open Food Facts — USDA doesn't support barcode) ─────────────────

  async function lookupBarcode(barcode: string) {
    if (!barcode.trim()) return;
    setBarcodeLoading(true);
    setStatus("Looking up barcode...");
    try {
      const res  = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode.trim()}.json`);
      const data = await res.json() as { status: number; product?: OFFProduct };
      if (data.status !== 1 || !data.product) {
        setStatus("Product not found. Try searching by name instead.");
        setBarcodeLoading(false);
        return;
      }
      const p = data.product;
      setPendingFood({
        name:         p.product_name ?? "Unknown Product",
        brand:        p.brands ?? "",
        serving_size: p.serving_size ?? "100g",
        ...offMacros(p),
      });
      setPendingServings("1");
      setStatus("");
      stopCamera();
    } catch {
      setStatus("Barcode lookup failed. Check your connection.");
    } finally {
      setBarcodeLoading(false);
    }
  }

  async function startCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraActive(true);

      if ("BarcodeDetector" in window) {
        const detector = new (window as unknown as {
          BarcodeDetector: new (o: object) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
        }).BarcodeDetector({ formats: ["ean_13","ean_8","upc_a","upc_e","code_128","code_39"] });

        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) { stopCamera(); void lookupBarcode(codes[0].rawValue); }
          } catch { /* next frame */ }
        }, 500);
      } else {
        setCameraError("Auto-scan not supported on this browser. Enter the barcode number below.");
      }
    } catch {
      setCameraError("Camera access denied. Enter the barcode number manually.");
      setCameraActive(false);
    }
  }

  function stopCamera() {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (streamRef.current)       { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setCameraActive(false);
  }

  // ── Log food → Supabase ──────────────────────────────────────────────────────

  async function logFood(food: SearchResult, servings: number) {
    if (!userId) return;
    const mult = servings || 1;
    setSyncing(true);

    const row = {
      user_id:      userId,
      food_name:    food.name,
      brand:        food.brand || null,
      serving_size: food.serving_size || null,
      servings:     mult,
      calories:     round1(food.calories * mult),
      protein:      round1(food.protein  * mult),
      carbs:        round1(food.carbs    * mult),
      fat:          round1(food.fat      * mult),
      sugar:        round1(food.sugar    * mult),
      logged_at:    new Date().toISOString(),
      logged_date:  today,
    };

    const { data, error } = await supabase
      .from("nutrition_logs")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error("Log food error:", error);
      setStatus("Failed to save. Check your connection.");
      setSyncing(false);
      return;
    }

    setFoodLog((prev) => [{ ...row, id: String(data.id) }, ...prev]);

    setRecentFoods((prev) => {
      const next = [food, ...prev.filter((r) => r.name !== food.name)].slice(0, 10);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });

    // Reset UI
    setPendingFood(null);
    setPendingServings("1");
    setSearchQuery("");
    setSearchResults([]);
    setBarcodeInput("");
    setShowAddPanel(false);
    setSyncing(false);
    setStatus(`✓ ${food.name} logged.`);
    setTimeout(() => setStatus(""), 2500);
  }

  function logCustomFood() {
    const { name, calories, protein, carbs, fat, sugar, serving_size } = customFood;
    if (!name.trim()) { setStatus("Enter a food name."); return; }
    void logFood({
      name: name.trim(), brand: "Custom",
      calories: toNum(calories), protein: toNum(protein),
      carbs: toNum(carbs), fat: toNum(fat), sugar: toNum(sugar),
      serving_size: serving_size || "1 serving",
    }, 1);
    setCustomFood({ name: "", calories: "", protein: "", carbs: "", fat: "", sugar: "", serving_size: "" });
  }

  async function removeEntry(id: string) {
    setSyncing(true);
    const { error } = await supabase.from("nutrition_logs").delete().eq("id", id);
    if (error) { setStatus("Failed to remove entry."); setSyncing(false); return; }
    setFoodLog((prev) => prev.filter((e) => e.id !== id));
    setSyncing(false);
  }

  function saveTargets() {
    setTargets(draftTargets);
    localStorage.setItem(TARGETS_KEY, JSON.stringify(draftTargets));
    setShowTargetEditor(false);
    setStatus("Targets saved.");
    setTimeout(() => setStatus(""), 1500);
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <p style={eyebrowStyle}>RESPAWN NUTRITION</p>
          <h1 style={heroTitleStyle}>Loading...</h1>
          <p style={{ color: "#555", fontSize: "14px", margin: 0 }}>Pulling your logs from Supabase.</p>
        </section>
      </main>
    );
  }

  const caloriesRemaining = targets.calories - todayTotals.calories;
  const caloriesPct = Math.min((todayTotals.calories / targets.calories) * 100, 100);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main style={pageStyle}>

      {/* ── Hero ── */}
      <section style={heroCardStyle}>
        <div style={heroTopRowStyle}>
          <div>
            <p style={eyebrowStyle}>RESPAWN NUTRITION</p>
            <h1 style={heroTitleStyle}>Today&apos;s Fuel</h1>
            <p style={heroSubStyle}>
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          {syncing && <div style={syncPillStyle}>Syncing…</div>}
        </div>

        {/* Calorie strip */}
        <div style={calorieStripStyle}>
          <div style={calorieStatStyle}>
            <div style={calorieNumStyle}>{Math.round(todayTotals.calories)}</div>
            <div style={calorieSubStyle}>eaten</div>
          </div>
          <div style={calorieDivStyle} />
          <div style={calorieStatStyle}>
            <div style={{ ...calorieNumStyle, color: caloriesRemaining < 0 ? "#ff6b6b" : "#5AFFA0" }}>
              {Math.abs(Math.round(caloriesRemaining))}
            </div>
            <div style={calorieSubStyle}>{caloriesRemaining < 0 ? "over" : "left"}</div>
          </div>
          <div style={calorieDivStyle} />
          <div style={calorieStatStyle}>
            <div style={calorieNumStyle}>{Math.round(targets.calories)}</div>
            <div style={calorieSubStyle}>goal</div>
          </div>
        </div>

        {/* Calorie progress bar */}
        <div style={calBarTrackStyle}>
          <div style={{
            ...calBarFillStyle,
            width: `${caloriesPct}%`,
            background: caloriesRemaining < 0
              ? "linear-gradient(90deg,#ff4d4d,#ff1a1a)"
              : "linear-gradient(90deg,#5AFFA0,#00cc6a)",
          }} />
        </div>

        {/* Macro bars */}
        <div style={macroBarsWrapStyle}>
          <MacroBar label="Protein" value={todayTotals.protein} target={targets.protein} color="#5AFFA0" />
          <MacroBar label="Carbs"   value={todayTotals.carbs}   target={targets.carbs}   color="#60a5fa" />
          <MacroBar label="Fat"     value={todayTotals.fat}     target={targets.fat}     color="#fbbf24" />
          <MacroBar label="Sugar"   value={todayTotals.sugar}   target={targets.sugar}   color="#f472b6" />
        </div>

        {/* Actions */}
        <div style={heroActionsStyle}>
          <button onClick={() => { setShowAddPanel((p) => !p); setViewMode("today"); }} style={addFoodButtonStyle}>
            {showAddPanel ? "✕ Close" : "+ Log Food"}
          </button>
          <button onClick={() => setViewMode((v) => v === "today" ? "history" : "today")} style={ghostButtonStyle}>
            {viewMode === "today" ? "📅 History" : "← Today"}
          </button>
          <button onClick={() => { setShowTargetEditor((p) => !p); setDraftTargets(targets); }} style={ghostButtonStyle}>
            🎯 Targets
          </button>
        </div>
      </section>

      {/* ── Target editor ── */}
      {showTargetEditor && (
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Daily Targets</h2>
            <button onClick={() => setShowTargetEditor(false)} style={ghostButtonStyle}>Cancel</button>
          </div>
          <div style={targetGridStyle}>
            {(["calories","protein","carbs","fat","sugar"] as (keyof MacroTargets)[]).map((key) => (
              <div key={key} style={targetFieldStyle}>
                <div style={fieldLabelStyle}>
                  {key.charAt(0).toUpperCase() + key.slice(1)} {key === "calories" ? "(kcal)" : "(g)"}
                </div>
                <input
                  type="number" inputMode="numeric"
                  value={draftTargets[key]}
                  onChange={(e) => setDraftTargets((p) => ({ ...p, [key]: toNum(e.target.value) }))}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
          <button onClick={saveTargets} style={primaryButtonStyle}>Save Targets</button>
        </section>
      )}

      {/* ── Add food panel ── */}
      {showAddPanel && (
        <section style={addPanelStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Log Food</h2>
            <span style={poweredByStyle}>Search powered by USDA</span>
          </div>

          {/* Mode tabs */}
          <div style={modeTabsStyle}>
            {(["search","barcode","quick","custom"] as AddMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setAddMode(m); setPendingFood(null); stopCamera(); }}
                style={addMode === m ? modeTabActiveStyle : modeTabStyle}
              >
                {m === "search" ? "🔍 Search" : m === "barcode" ? "📷 Scan" : m === "quick" ? "⚡ Quick" : "✏️ Custom"}
              </button>
            ))}
          </div>

          {/* ── Search ── */}
          {addMode === "search" && !pendingFood && (
            <div style={{ display: "grid", gap: "12px" }}>
              <input
                placeholder="Search any food (e.g. chicken breast, Greek yogurt…)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={inputStyle}
                autoFocus
              />
              {searchLoading && (
                <div style={searchingStyle}>Searching USDA database…</div>
              )}
              {!searchLoading && searchResults.length > 0 && (
                <div style={resultListStyle}>
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => { setPendingFood(r); setPendingServings("1"); }}
                      style={resultRowStyle}
                    >
                      <div style={resultInfoStyle}>
                        <div style={resultNameStyle}>{r.name}</div>
                        <div style={resultMetaStyle}>
                          {r.brand && `${r.brand} · `}{r.serving_size}
                          {" · "}P:{r.protein}g C:{r.carbs}g F:{r.fat}g
                        </div>
                      </div>
                      <div style={resultKcalStyle}>{Math.round(r.calories)}<span style={kcalUnitStyle}> kcal</span></div>
                    </button>
                  ))}
                </div>
              )}
              {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                <p style={mutedStyle}>No results found. Try a different search term.</p>
              )}
              {/* Recents */}
              {!searchQuery && recentFoods.length > 0 && (
                <div>
                  <div style={recentLabelStyle}>Recently Logged</div>
                  <div style={resultListStyle}>
                    {recentFoods.slice(0, 6).map((food, i) => (
                      <button
                        key={i}
                        onClick={() => { setPendingFood(food); setPendingServings("1"); }}
                        style={resultRowStyle}
                      >
                        <div style={resultInfoStyle}>
                          <div style={resultNameStyle}>{food.name}</div>
                          <div style={resultMetaStyle}>{food.serving_size}</div>
                        </div>
                        <div style={resultKcalStyle}>{Math.round(food.calories)}<span style={kcalUnitStyle}> kcal</span></div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Barcode ── */}
          {addMode === "barcode" && !pendingFood && (
            <div style={{ display: "grid", gap: "12px" }}>
              {!cameraActive
                ? (
                  <button onClick={startCamera} style={primaryButtonStyle}>
                    📷 Open Camera Scanner
                  </button>
                ) : (
                  <div style={cameraWrapStyle}>
                    <video ref={videoRef} style={videoStyle} playsInline muted />
                    <div style={scanOverlayStyle}>
                      <div style={scanBoxStyle}>
                        <div style={cornerTLStyle} />
                        <div style={cornerTRStyle} />
                        <div style={cornerBLStyle} />
                        <div style={cornerBRStyle} />
                      </div>
                    </div>
                    <button onClick={stopCamera} style={closeCameraStyle}>✕ Close</button>
                    <div style={scanHintStyle}>Point camera at barcode</div>
                  </div>
                )}
              {cameraError && <p style={warnStyle}>{cameraError}</p>}
              <div style={barcodeRowStyle}>
                <input
                  placeholder="Or type barcode number manually"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                  inputMode="numeric"
                  onKeyDown={(e) => { if (e.key === "Enter") void lookupBarcode(barcodeInput); }}
                />
                <button
                  onClick={() => void lookupBarcode(barcodeInput)}
                  disabled={barcodeLoading}
                  style={primaryButtonStyle}
                >
                  {barcodeLoading ? "…" : "Look Up"}
                </button>
              </div>
              <p style={mutedStyle}>Barcode lookup uses Open Food Facts database.</p>
            </div>
          )}

          {/* ── Quick add ── */}
          {addMode === "quick" && !pendingFood && (
            <div style={resultListStyle}>
              {QUICK_FOODS.map((food, i) => (
                <button
                  key={i}
                  onClick={() => { setPendingFood(food); setPendingServings("1"); }}
                  style={resultRowStyle}
                >
                  <div style={resultInfoStyle}>
                    <div style={resultNameStyle}>{food.name}</div>
                    <div style={resultMetaStyle}>
                      {food.serving_size} · P:{food.protein}g C:{food.carbs}g F:{food.fat}g
                    </div>
                  </div>
                  <div style={resultKcalStyle}>{food.calories}<span style={kcalUnitStyle}> kcal</span></div>
                </button>
              ))}
            </div>
          )}

          {/* ── Custom ── */}
          {addMode === "custom" && !pendingFood && (
            <div style={{ display: "grid", gap: "12px" }}>
              <input
                placeholder="Food name *"
                value={customFood.name}
                onChange={(e) => setCustomFood((p) => ({ ...p, name: e.target.value }))}
                style={inputStyle}
              />
              <input
                placeholder="Serving size (e.g. 1 cup, 100g)"
                value={customFood.serving_size}
                onChange={(e) => setCustomFood((p) => ({ ...p, serving_size: e.target.value }))}
                style={inputStyle}
              />
              <div style={customMacroGridStyle}>
                {(["calories","protein","carbs","fat","sugar"] as const).map((key) => (
                  <div key={key} style={targetFieldStyle}>
                    <div style={fieldLabelStyle}>{key.charAt(0).toUpperCase() + key.slice(1)}</div>
                    <input
                      type="number" inputMode="decimal" placeholder="0"
                      value={customFood[key]}
                      onChange={(e) => setCustomFood((p) => ({ ...p, [key]: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
              <button onClick={logCustomFood} style={primaryButtonStyle}>Log Custom Food</button>
            </div>
          )}

          {/* ── Pending confirm ── */}
          {pendingFood && (
            <div style={pendingCardStyle}>
              <div style={pendingNameStyle}>{pendingFood.name}</div>
              {pendingFood.brand && (
                <div style={pendingBrandStyle}>{pendingFood.brand} · {pendingFood.serving_size}</div>
              )}

              <div style={pendingMacroGridStyle}>
                {[
                  { label: "kcal", value: Math.round(pendingFood.calories * toNum(pendingServings)) },
                  { label: "protein", value: round1(pendingFood.protein * toNum(pendingServings)), unit: "g" },
                  { label: "carbs", value: round1(pendingFood.carbs * toNum(pendingServings)), unit: "g" },
                  { label: "fat", value: round1(pendingFood.fat * toNum(pendingServings)), unit: "g" },
                ].map((m) => (
                  <div key={m.label} style={pendingMacroBoxStyle}>
                    <div style={pendingMacroValueStyle}>{m.value}{m.unit ?? ""}</div>
                    <div style={pendingMacroLabelStyle}>{m.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gap: "8px" }}>
                <div style={fieldLabelStyle}>Servings</div>
                <div style={servingsRowStyle}>
                  <button
                    onClick={() => setPendingServings((p) => String(Math.max(0.25, round1(toNum(p) - 0.25))))}
                    style={servingAdjStyle}
                  >−</button>
                  <input
                    type="number" inputMode="decimal"
                    value={pendingServings}
                    onChange={(e) => setPendingServings(e.target.value)}
                    style={servingInputStyle}
                  />
                  <button
                    onClick={() => setPendingServings((p) => String(round1(toNum(p) + 0.25)))}
                    style={servingAdjStyle}
                  >+</button>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button
                  onClick={() => void logFood(pendingFood, toNum(pendingServings))}
                  style={{ ...primaryButtonStyle, flex: 1 }}
                  disabled={syncing}
                >
                  {syncing ? "Saving…" : "✓ Log This Food"}
                </button>
                <button onClick={() => { setPendingFood(null); setPendingServings("1"); }} style={ghostButtonStyle}>
                  Back
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── AI tips ── */}
      {aiTips.length > 0 && viewMode === "today" && (
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Coach Nutrition Call</h2>
            <span style={aiBadgeStyle}>AI</span>
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            {aiTips.map((tip, i) => (
              <div key={i} style={tipCardStyle}>
                <span style={tipIconStyle}>💡</span>
                <span style={tipTextStyle}>{tip}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Today's log — meal groups ── */}
      {viewMode === "today" && (
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Today&apos;s Log</h2>
            <span style={logCountStyle}>{todayEntries.length} items · {Math.round(todayTotals.calories)} kcal</span>
          </div>

          {todayEntries.length === 0 ? (
            <div style={emptyStyle}>
              <div style={emptyIconStyle}>🥗</div>
              <div style={emptyTitleStyle}>Nothing logged yet</div>
              <div style={emptySubStyle}>Tap "+ Log Food" to start tracking your day.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "18px" }}>
              {MEAL_SLOTS.map((slot) => {
                const entries = mealGroups[slot];
                if (!entries.length) return null;
                const slotCals = entries.reduce((s, e) => s + e.calories, 0);
                return (
                  <div key={slot}>
                    <div style={mealHeaderStyle}>
                      <span style={mealNameStyle}>{slot}</span>
                      <span style={mealKcalStyle}>{Math.round(slotCals)} kcal</span>
                    </div>
                    <div style={{ display: "grid", gap: "7px" }}>
                      {entries.map((entry) => (
                        <div key={entry.id} style={logRowStyle}>
                          <div style={logInfoStyle}>
                            <div style={logNameStyle}>{entry.food_name}</div>
                            <div style={logMetaStyle}>
                              {Math.round(entry.calories)} kcal · P:{round1(entry.protein)}g · C:{round1(entry.carbs)}g · F:{round1(entry.fat)}g
                              {entry.servings !== 1 && ` · ×${entry.servings}`}
                            </div>
                          </div>
                          <button
                            onClick={() => void removeEntry(entry.id)}
                            style={removeButtonStyle}
                            disabled={syncing}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Totals bar */}
              <div style={totalsBarStyle}>
                <div style={totalsLabelStyle}>Day Total</div>
                <div style={totalsMacrosStyle}>
                  <span style={totalMacroStyle}>{Math.round(todayTotals.calories)} kcal</span>
                  <span style={totalMacroStyle}>P: {round1(todayTotals.protein)}g</span>
                  <span style={totalMacroStyle}>C: {round1(todayTotals.carbs)}g</span>
                  <span style={totalMacroStyle}>F: {round1(todayTotals.fat)}g</span>
                  <span style={totalMacroStyle}>S: {round1(todayTotals.sugar)}g</span>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── History ── */}
      {viewMode === "history" && (
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Last 7 Days</h2>
          </div>
          {historyByDate.length === 0 ? (
            <p style={mutedStyle}>No history yet. Start logging to see your past days here.</p>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {historyByDate.map(([date, day]) => {
                const pct   = Math.min((day.totals.calories / targets.calories) * 100, 100);
                const over  = day.totals.calories > targets.calories;
                return (
                  <div key={date} style={historyRowStyle}>
                    <div style={historyHeaderStyle}>
                      <span style={historyDateStyle}>{formatDate(date)}</span>
                      <span style={{ ...historyKcalStyle, color: over ? "#ff6b6b" : "#5AFFA0" }}>
                        {Math.round(day.totals.calories)} kcal
                      </span>
                    </div>
                    <div style={historyBarTrackStyle}>
                      <div style={{ ...historyBarFillStyle, width: `${pct}%`, background: over ? "#ff4d4d" : "#5AFFA0" }} />
                    </div>
                    <div style={historyMacrosStyle}>
                      <span style={histMacroStyle}>P: {round1(day.totals.protein)}g</span>
                      <span style={histMacroStyle}>C: {round1(day.totals.carbs)}g</span>
                      <span style={histMacroStyle}>F: {round1(day.totals.fat)}g</span>
                      <span style={histMacroStyle}>{day.entries.length} items</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {status && <p style={statusStyle}>{status}</p>}
    </main>
  );
}

/* ─── STYLES ──────────────────────────────────────────────────────────────── */

const pageStyle: CSSProperties = { minHeight: "100vh", background: "linear-gradient(180deg,#020202 0%,#080808 40%,#0e0e0e 100%)", color: "#fff", padding: "20px 14px 140px", fontFamily: "sans-serif" };
const heroCardStyle: CSSProperties = { background: "linear-gradient(135deg,rgba(90,255,160,0.11) 0%,rgba(14,14,14,1) 60%,rgba(8,8,8,1) 100%)", border: "1px solid rgba(90,255,160,0.14)", borderRadius: "24px", padding: "22px", marginBottom: "14px", boxShadow: "0 0 40px rgba(90,255,160,0.04),0 10px 30px rgba(0,0,0,0.4)" };
const heroTopRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" };
const eyebrowStyle: CSSProperties = { color: "#5AFFA0", fontSize: "11px", fontWeight: 800, letterSpacing: "0.16em", margin: "0 0 6px" };
const heroTitleStyle: CSSProperties = { color: "#fff", fontSize: "28px", fontWeight: 900, lineHeight: 1.1, margin: "0 0 2px" };
const heroSubStyle: CSSProperties = { color: "#444", fontSize: "13px", margin: 0 };
const syncPillStyle: CSSProperties = { background: "rgba(90,255,160,0.10)", border: "1px solid rgba(90,255,160,0.22)", color: "#5AFFA0", borderRadius: "999px", padding: "5px 12px", fontSize: "11px", fontWeight: 800, flexShrink: 0 };
const calorieStripStyle: CSSProperties = { display: "flex", justifyContent: "space-around", alignItems: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "14px", marginBottom: "12px" };
const calorieStatStyle: CSSProperties = { textAlign: "center" };
const calorieNumStyle: CSSProperties = { fontSize: "26px", fontWeight: 900, color: "#fff", lineHeight: 1 };
const calorieSubStyle: CSSProperties = { fontSize: "11px", color: "#444", marginTop: "4px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" };
const calorieDivStyle: CSSProperties = { width: "1px", height: "42px", background: "rgba(255,255,255,0.07)" };
const calBarTrackStyle: CSSProperties = { height: "7px", background: "#151515", borderRadius: "999px", overflow: "hidden", marginBottom: "14px" };
const calBarFillStyle: CSSProperties = { height: "100%", borderRadius: "999px", transition: "width 0.5s ease" };
const macroBarsWrapStyle: CSSProperties = { display: "grid", gap: "10px", marginBottom: "16px" };
const macroBarWrapStyle: CSSProperties = { display: "grid", gap: "5px" };
const macroBarTopStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const macroBarLabelStyle: CSSProperties = { color: "#666", fontSize: "12px", fontWeight: 700 };
const macroBarValueStyle: CSSProperties = { fontSize: "12px", fontWeight: 900 };
const macroBarTargetStyle: CSSProperties = { color: "#444", fontWeight: 600 };
const macroBarTrackStyle: CSSProperties = { height: "5px", background: "#151515", borderRadius: "999px", overflow: "hidden" };
const macroBarFillStyle: CSSProperties = { height: "100%", borderRadius: "999px" };
const heroActionsStyle: CSSProperties = { display: "flex", gap: "8px", flexWrap: "wrap" };
const addFoodButtonStyle: CSSProperties = { background: "#5AFFA0", border: "none", color: "#000", borderRadius: "999px", padding: "11px 20px", fontWeight: 900, fontSize: "14px", cursor: "pointer" };
const ghostButtonStyle: CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "999px", padding: "10px 14px", color: "#aaa", fontWeight: 700, fontSize: "13px", cursor: "pointer" };
const cardStyle: CSSProperties = { background: "#0f0f0f", border: "1px solid #1c1c1c", borderRadius: "20px", padding: "18px", marginBottom: "12px" };
const addPanelStyle: CSSProperties = { background: "#0f0f0f", border: "1px solid rgba(90,255,160,0.18)", borderRadius: "20px", padding: "18px", marginBottom: "12px" };
const sectionHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", gap: "10px", flexWrap: "wrap" };
const sectionTitleStyle: CSSProperties = { color: "#fff", fontSize: "17px", fontWeight: 800, margin: 0 };
const poweredByStyle: CSSProperties = { color: "#444", fontSize: "11px", fontWeight: 700 };
const modeTabsStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px", marginBottom: "14px" };
const modeTabStyle: CSSProperties = { background: "#161616", border: "1px solid #222", borderRadius: "10px", padding: "10px 4px", color: "#555", fontSize: "12px", fontWeight: 700, cursor: "pointer", textAlign: "center" };
const modeTabActiveStyle: CSSProperties = { ...modeTabStyle, background: "rgba(90,255,160,0.09)", border: "1px solid rgba(90,255,160,0.28)", color: "#5AFFA0" };
const inputStyle: CSSProperties = { width: "100%", background: "#090909", border: "1px solid #1e1e1e", borderRadius: "10px", padding: "12px", color: "#fff", fontSize: "15px", fontFamily: "sans-serif", outline: "none", boxSizing: "border-box" };
const primaryButtonStyle: CSSProperties = { background: "#5AFFA0", border: "none", color: "#000", borderRadius: "10px", padding: "12px 18px", fontWeight: 900, fontSize: "14px", cursor: "pointer" };
const searchingStyle: CSSProperties = { color: "#555", fontSize: "13px" };
const resultListStyle: CSSProperties = { display: "grid", gap: "7px", maxHeight: "360px", overflowY: "auto" };
const resultRowStyle: CSSProperties = { background: "#161616", border: "1px solid #222", borderRadius: "12px", padding: "11px 13px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", cursor: "pointer", textAlign: "left", color: "#fff", width: "100%" };
const resultInfoStyle: CSSProperties = { flex: 1, minWidth: 0 };
const resultNameStyle: CSSProperties = { color: "#fff", fontSize: "14px", fontWeight: 700, wordBreak: "break-word", lineHeight: 1.3 };
const resultMetaStyle: CSSProperties = { color: "#555", fontSize: "11px", marginTop: "3px" };
const resultKcalStyle: CSSProperties = { color: "#5AFFA0", fontSize: "15px", fontWeight: 900, flexShrink: 0 };
const kcalUnitStyle: CSSProperties = { fontSize: "10px", fontWeight: 700 };
const recentLabelStyle: CSSProperties = { color: "#5AFFA0", fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" };
const cameraWrapStyle: CSSProperties = { position: "relative", borderRadius: "14px", overflow: "hidden", background: "#000", aspectRatio: "4/3" };
const videoStyle: CSSProperties = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
const scanOverlayStyle: CSSProperties = { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" };
const scanBoxStyle: CSSProperties = { width: "60%", aspectRatio: "1.8", position: "relative" };
const cornerBase: CSSProperties = { position: "absolute", width: "22px", height: "22px", border: "3px solid #5AFFA0" };
const cornerTLStyle: CSSProperties = { ...cornerBase, top: 0, left: 0, borderRight: "none", borderBottom: "none", borderRadius: "3px 0 0 0" };
const cornerTRStyle: CSSProperties = { ...cornerBase, top: 0, right: 0, borderLeft: "none", borderBottom: "none", borderRadius: "0 3px 0 0" };
const cornerBLStyle: CSSProperties = { ...cornerBase, bottom: 0, left: 0, borderRight: "none", borderTop: "none", borderRadius: "0 0 0 3px" };
const cornerBRStyle: CSSProperties = { ...cornerBase, bottom: 0, right: 0, borderLeft: "none", borderTop: "none", borderRadius: "0 0 3px 0" };
const closeCameraStyle: CSSProperties = { position: "absolute", top: "10px", right: "10px", background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "999px", color: "#fff", padding: "6px 12px", fontSize: "12px", fontWeight: 800, cursor: "pointer" };
const scanHintStyle: CSSProperties = { position: "absolute", bottom: "12px", left: 0, right: 0, textAlign: "center", color: "rgba(90,255,160,0.8)", fontSize: "12px", fontWeight: 700 };
const barcodeRowStyle: CSSProperties = { display: "flex", gap: "10px", alignItems: "center" };
const warnStyle: CSSProperties = { color: "#fbbf24", fontSize: "13px", lineHeight: 1.4, margin: 0 };
const customMacroGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: "10px" };
const targetGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "12px", marginBottom: "16px" };
const targetFieldStyle: CSSProperties = { display: "grid", gap: "6px" };
const fieldLabelStyle: CSSProperties = { color: "#555", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" };
const pendingCardStyle: CSSProperties = { background: "rgba(90,255,160,0.04)", border: "1px solid rgba(90,255,160,0.16)", borderRadius: "16px", padding: "16px" };
const pendingNameStyle: CSSProperties = { color: "#fff", fontSize: "17px", fontWeight: 900, marginBottom: "3px", lineHeight: 1.3 };
const pendingBrandStyle: CSSProperties = { color: "#555", fontSize: "12px", marginBottom: "14px" };
const pendingMacroGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px", marginBottom: "16px" };
const pendingMacroBoxStyle: CSSProperties = { background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "10px 6px", textAlign: "center" };
const pendingMacroValueStyle: CSSProperties = { color: "#fff", fontSize: "15px", fontWeight: 900 };
const pendingMacroLabelStyle: CSSProperties = { color: "#555", fontSize: "10px", marginTop: "3px" };
const servingsRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: "10px" };
const servingAdjStyle: CSSProperties = { background: "#161616", border: "1px solid #252525", borderRadius: "8px", color: "#fff", width: "38px", height: "38px", fontSize: "20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const servingInputStyle: CSSProperties = { ...inputStyle, width: "80px", textAlign: "center" };
const aiBadgeStyle: CSSProperties = { background: "rgba(90,255,160,0.10)", border: "1px solid rgba(90,255,160,0.22)", color: "#5AFFA0", borderRadius: "999px", padding: "4px 10px", fontSize: "11px", fontWeight: 800 };
const tipCardStyle: CSSProperties = { background: "rgba(255,255,255,0.02)", border: "1px solid #1c1c1c", borderRadius: "12px", padding: "12px 14px", display: "flex", gap: "10px", alignItems: "flex-start" };
const tipIconStyle: CSSProperties = { fontSize: "15px", flexShrink: 0 };
const tipTextStyle: CSSProperties = { color: "#bbb", fontSize: "14px", lineHeight: 1.55 };
const logCountStyle: CSSProperties = { color: "#444", fontSize: "12px", fontWeight: 700 };
const emptyStyle: CSSProperties = { textAlign: "center", padding: "28px 0" };
const emptyIconStyle: CSSProperties = { fontSize: "36px", marginBottom: "10px" };
const emptyTitleStyle: CSSProperties = { color: "#fff", fontSize: "16px", fontWeight: 800, marginBottom: "6px" };
const emptySubStyle: CSSProperties = { color: "#444", fontSize: "13px" };
const mealHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" };
const mealNameStyle: CSSProperties = { color: "#5AFFA0", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" };
const mealKcalStyle: CSSProperties = { color: "#444", fontSize: "11px", fontWeight: 700 };
const logRowStyle: CSSProperties = { background: "#161616", border: "1px solid #1e1e1e", borderRadius: "11px", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" };
const logInfoStyle: CSSProperties = { flex: 1, minWidth: 0 };
const logNameStyle: CSSProperties = { color: "#fff", fontSize: "14px", fontWeight: 700, wordBreak: "break-word" };
const logMetaStyle: CSSProperties = { color: "#444", fontSize: "11px", marginTop: "3px" };
const removeButtonStyle: CSSProperties = { background: "rgba(255,77,77,0.07)", border: "1px solid rgba(255,77,77,0.18)", color: "#ff9c9c", borderRadius: "7px", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "12px", fontWeight: 900, flexShrink: 0, padding: 0 };
const totalsBarStyle: CSSProperties = { background: "rgba(90,255,160,0.04)", border: "1px solid rgba(90,255,160,0.10)", borderRadius: "12px", padding: "12px 14px" };
const totalsLabelStyle: CSSProperties = { color: "#5AFFA0", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" };
const totalsMacrosStyle: CSSProperties = { display: "flex", gap: "12px", flexWrap: "wrap" };
const totalMacroStyle: CSSProperties = { color: "#fff", fontSize: "13px", fontWeight: 800 };
const historyRowStyle: CSSProperties = { background: "#161616", border: "1px solid #1e1e1e", borderRadius: "14px", padding: "14px" };
const historyHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" };
const historyDateStyle: CSSProperties = { color: "#fff", fontSize: "14px", fontWeight: 800 };
const historyKcalStyle: CSSProperties = { fontSize: "14px", fontWeight: 900 };
const historyBarTrackStyle: CSSProperties = { height: "5px", background: "#111", borderRadius: "999px", overflow: "hidden", marginBottom: "10px" };
const historyBarFillStyle: CSSProperties = { height: "100%", borderRadius: "999px", transition: "width 0.4s ease" };
const historyMacrosStyle: CSSProperties = { display: "flex", gap: "12px", flexWrap: "wrap" };
const histMacroStyle: CSSProperties = { color: "#444", fontSize: "12px", fontWeight: 700 };
const mutedStyle: CSSProperties = { color: "#444", margin: 0, lineHeight: 1.5, fontSize: "13px" };
const statusStyle: CSSProperties = { color: "#5AFFA0", marginTop: "12px", fontSize: "13px", fontWeight: 700 };