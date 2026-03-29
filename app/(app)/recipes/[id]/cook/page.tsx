"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlarmClock, ArrowLeft, Pause, Play, RotateCcw, X } from "lucide-react";
import type { Recipe, Step } from "@/types";
import { getStepTimerSuggestion } from "@/lib/step-timers";

export default function CookModePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timers, setTimers] = useState<Record<number, number>>({}); // stepIndex → seconds remaining
  const [timerRunning, setTimerRunning] = useState<Record<number, boolean>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Keep screen awake while cooking
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((wl) => { wakeLock = wl; }).catch(() => {});
    }
    return () => { wakeLock?.release(); };
  }, []);

  useEffect(() => {
    fetch(`/api/recipes/${id}`)
      .then((r) => r.json())
      .then((json) => {
        setRecipe(json.data);
        setLoading(false);
        // Init timers from recipe steps
        const steps = (json.data?.steps || []) as Step[];
        const initial: Record<number, number> = {};
        steps.forEach((s, i) => { if (s.timerSeconds) initial[i] = s.timerSeconds; });
        setTimers(initial);
      });

    // Resume session
    fetch(`/api/recipes/${id}/cook`)
      .then((r) => r.json())
      .then((json) => { if (json.data?.currentStep) setCurrentStep(json.data.currentStep); });
  }, [id]);

  // Timer tick
  useEffect(() => {
    const running = Object.entries(timerRunning).filter(([, v]) => v).map(([k]) => Number(k));
    if (running.length === 0) { if (intervalRef.current) clearInterval(intervalRef.current); return; }

    intervalRef.current = setInterval(() => {
      setTimers((prev) => {
        const next = { ...prev };
        running.forEach((idx) => {
          if (next[idx] > 0) next[idx]--;
          else { setTimerRunning((r) => ({ ...r, [idx]: false })); }
        });
        return next;
      });
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning]);

  const saveProgress = useCallback(async (step: number, completed = false) => {
    await fetch(`/api/recipes/${id}/cook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentStep: step, isCompleted: completed }),
    });
  }, [id]);

  const goToStep = (n: number) => {
    if (!recipe) return;
    const steps = recipe.steps as Step[];
    const clamped = Math.max(0, Math.min(n, steps.length - 1));
    setCurrentStep(clamped);
    saveProgress(clamped);
  };

  const finish = () => {
    saveProgress(0, true);
    router.push(`/recipes/${id}`);
  };

  if (loading) return <div style={S.loading}>Loading…</div>;
  if (!recipe) return <div style={S.loading}>Recipe not found.</div>;

  const steps = recipe.steps as Step[];
  const step = steps[currentStep];
  const stepTimer = step ? getStepTimerSuggestion(step) : null;
  const isLast = currentStep === steps.length - 1;
  const progress = ((currentStep) / steps.length) * 100;

  const ingredients = (recipe.ingredients as Array<{ amount?: string; unit?: string; name: string }>)
    .filter((_, i) => {
      // Show ingredients referenced in this step (if linked) or all if not
      const linkedIds = (step as Step & { ingredientIds?: string[] }).ingredientIds;
      if (!linkedIds || linkedIds.length === 0) return true;
      return linkedIds.includes(String(i));
    });

  return (
    <div style={S.page}>
      {/* Top bar */}
      <div style={S.topBar}>
        <button onClick={() => router.back()} style={S.topBackBtn}>
          <X size={18} strokeWidth={2.2} />
        </button>
        <div style={S.topMeta}>
          <span style={S.topTitle}>{recipe.title}</span>
          <span style={S.topProgress}>
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={S.progressTrack}>
        <div style={{ ...S.progressBar, width: `${progress}%` }} />
      </div>

      {/* Step display */}
      <div style={S.stepArea} className="recipe-copy">
        <div style={S.stepNumBadge}>{currentStep + 1}</div>
        <p style={S.stepText}>{step?.instruction}</p>

        {stepTimer && timers[currentStep] === undefined && (
          <button
            type="button"
            style={S.timerChip}
            onClick={() => {
              setTimers((prev) => ({ ...prev, [currentStep]: stepTimer.seconds }));
              setTimerRunning((prev) => ({ ...prev, [currentStep]: true }));
            }}
          >
            <span style={S.timerChipIconWrap}>
              <AlarmClock size={14} strokeWidth={2.1} />
            </span>
            <span style={S.timerChipCopy}>
              <span style={S.timerChipLabel}>Start {stepTimer.label} timer</span>
            </span>
          </button>
        )}

        {/* Timer for this step */}
        {timers[currentStep] !== undefined && stepTimer && (
          <TimerBlock
            seconds={timers[currentStep]}
            running={timerRunning[currentStep] || false}
            label={stepTimer.label}
            onToggle={() =>
              setTimerRunning((r) => ({ ...r, [currentStep]: !r[currentStep] }))
            }
            onReset={() => {
              setTimers((t) => ({ ...t, [currentStep]: stepTimer.seconds }));
              setTimerRunning((r) => ({ ...r, [currentStep]: false }));
            }}
          />
        )}

        {/* Inline ingredients */}
        {ingredients.length > 0 && ingredients.length < 6 && (
          <div style={S.inlineIngredients}>
            <p style={S.inlineTitle}>Ingredients for this step:</p>
            {ingredients.map((ing, i) => (
              <span key={i} style={S.inlineIng}>
                {[ing.amount, ing.unit, ing.name].filter(Boolean).join(" ")}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Step navigation */}
      <div style={S.nav}>
        <button
          style={{ ...S.navBtn, ...(currentStep === 0 ? S.navBtnDisabled : {}) }}
          onClick={() => goToStep(currentStep - 1)}
          disabled={currentStep === 0}
        >
          <ArrowLeft size={16} strokeWidth={2.2} />
          <span>Prev</span>
        </button>

        {/* Step dots */}
        <div style={S.dots}>
          {steps.map((_, i) => (
            <button
              key={i}
              style={{
                ...S.dot,
                ...(i === currentStep ? S.dotActive : {}),
                ...(i < currentStep ? S.dotDone : {}),
              }}
              onClick={() => goToStep(i)}
            />
          ))}
        </div>

        {isLast ? (
          <button style={{ ...S.navBtn, ...S.navBtnFinish }} onClick={finish}>
            <span>Done</span>
          </button>
        ) : (
          <button style={S.navBtn} onClick={() => goToStep(currentStep + 1)}>
            <span>Next</span>
          </button>
        )}
      </div>
    </div>
  );
}

function TimerBlock({
  seconds,
  label,
  running,
  onToggle,
  onReset,
}: {
  seconds: number;
  label: string;
  running: boolean;
  onToggle: () => void;
  onReset: () => void;
}) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const display = `${mins}:${String(secs).padStart(2, "0")}`;
  const done = seconds === 0;

  return (
    <div style={{ ...T.wrap, ...(done ? T.wrapDone : {}) }}>
      <div style={T.info}>
        <span style={T.label}>{label}</span>
        <span style={T.time}>{done ? "Done!" : display}</span>
      </div>
      <div style={T.actions}>
        <button onClick={onToggle} style={T.btn}>
          {running ? <Pause size={14} strokeWidth={2.4} /> : <Play size={14} strokeWidth={2.4} />}
          <span>{running ? "Pause" : "Start"}</span>
        </button>
        <button onClick={onReset} style={{ ...T.btn, ...T.btnReset }}>
          <RotateCcw size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

const T: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
    maxWidth: 360,
    margin: "16px auto 0",
    background: "linear-gradient(180deg, rgb(var(--terra-50)) 0%, rgb(255 247 241) 100%)",
    borderRadius: 16,
    padding: "14px 16px",
    border: "1px solid rgba(196, 90, 44, 0.18)",
    fontFamily: "var(--font-body)",
  },
  wrapDone: { background: "rgb(var(--terra-50))", border: "1.5px solid rgb(var(--terra-200))" },
  info: { display: "flex", flexDirection: "column", gap: 2, textAlign: "center" },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgb(var(--terra-600))" },
  time: { fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "rgb(var(--warm-900))", fontFamily: "var(--font-body)" },
  actions: { display: "flex", gap: 8 },
  btn: { background: "rgb(var(--terra-600))", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)" },
  btnReset: { background: "rgb(var(--warm-200))", color: "rgb(var(--warm-700))" },
};

const S: Record<string, React.CSSProperties> = {
  loading: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", fontSize: 16, color: "rgb(var(--warm-500))" },
  page: { display: "flex", flexDirection: "column", height: "100dvh", background: "white", overflow: "hidden" },
  topBar: { display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 12px", borderBottom: "1px solid rgb(var(--warm-100))" },
  topBackBtn: { background: "none", border: "none", cursor: "pointer", color: "rgb(var(--warm-500))", padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "center" },
  topMeta: { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  topTitle: { fontSize: 14, fontWeight: 600, color: "rgb(var(--warm-800))", lineHeight: 1.2 },
  topProgress: { fontSize: 12, color: "rgb(var(--warm-400))" },
  progressTrack: { height: 4, background: "rgb(var(--warm-100))" },
  progressBar: { height: "100%", background: "rgb(var(--terra-500))", transition: "width 0.3s" },
  stepArea: { flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "32px 20px 24px", display: "flex", flexDirection: "column" },
  stepNumBadge: { width: 40, height: 40, borderRadius: "50%", background: "rgb(var(--terra-600))", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, marginBottom: 20 },
  stepText: { fontSize: 22, lineHeight: 1.7, color: "rgb(var(--warm-900))", fontFamily: "var(--font-serif)", flex: 1 },
  timerChip: {
    marginTop: 20,
    alignSelf: "center",
    display: "inline-flex",
    alignItems: "center",
    gap: 12,
    border: "1px solid rgb(var(--terra-600))",
    borderRadius: 999,
    background: "linear-gradient(180deg, rgb(var(--terra-500)) 0%, rgb(163,70,36) 100%)",
    color: "white",
    padding: "10px 14px 10px 10px",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
  },
  timerChipIconWrap: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.18)",
    color: "rgb(var(--warm-50))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  timerChipCopy: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 },
  timerChipLabel: { fontSize: 13, fontWeight: 700, color: "white", fontFamily: "var(--font-body)" },
  inlineIngredients: { marginTop: 24, background: "rgb(var(--warm-50))", borderRadius: 12, padding: "14px" },
  inlineTitle: { fontSize: 11, fontWeight: 700, color: "rgb(var(--warm-500))", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 },
  inlineIng: { display: "inline-block", fontSize: 13, color: "rgb(var(--warm-700))", background: "white", border: "1px solid rgb(var(--warm-200))", borderRadius: 20, padding: "3px 10px", margin: "2px 3px" },
  nav: { padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgb(var(--warm-100))", background: "white", paddingBottom: "max(16px, env(safe-area-inset-bottom))", position: "sticky", bottom: 0 },
  navBtn: { background: "rgb(var(--warm-100))", color: "rgb(var(--warm-800))", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  navBtnDisabled: { opacity: 0.35, cursor: "not-allowed" },
  navBtnFinish: { background: "rgb(var(--terra-600))", color: "white" },
  dots: { display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", justifyContent: "center", maxWidth: 160 },
  dot: { width: 8, height: 8, borderRadius: "50%", background: "rgb(var(--warm-200))", border: "none", cursor: "pointer", padding: 0 },
  dotActive: { background: "rgb(var(--terra-600))", transform: "scale(1.3)" },
  dotDone: { background: "rgb(var(--terra-300))" },
};
