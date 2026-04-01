"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import type { Recipe, Step } from "@/types";
import { getStepTimerSuggestion } from "@/lib/step-timers";
import { useCookTimers } from "@/context/cook-timer-context";

export default function CookModePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  const {
    soundEnabled,
    setSoundEnabled,
    getTimer,
    getTimerSeconds,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    clearRecipeTimers,
    prepareAlarm,
  } = useCookTimers();

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
      });

    // Resume session
    fetch(`/api/recipes/${id}/cook`)
      .then((r) => r.json())
      .then((json) => { if (json.data?.currentStep) setCurrentStep(json.data.currentStep); });
  }, [id]);

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
    clearRecipeTimers(id);
    saveProgress(0, true);
    router.push(`/recipes/${id}`);
  };

  if (loading) return <div style={S.loading}>Loading…</div>;
  if (!recipe) return <div style={S.loading}>Recipe not found.</div>;

  const steps = recipe.steps as Step[];
  const step = steps[currentStep];
  const stepTimer = step ? getStepTimerSuggestion(step) : null;
  const activeTimer = getTimer(id, currentStep);
  const isLast = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;
  const nextStep = !isLast ? steps[currentStep + 1] : null;
  const initialTimerSeconds = stepTimer?.seconds ?? 0;

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
        <div style={S.stepCard}>
          <div style={S.stepHeader}>
            <div style={S.stepNumBadge}>{currentStep + 1}</div>
            <div style={S.stepMetaCopy}>
              <span style={S.stepEyebrow}>{isLast ? "Final step" : "Now cooking"}</span>
              <span style={S.stepCount}>Step {currentStep + 1} of {steps.length}</span>
            </div>
          </div>

          <p style={S.stepText}>{step?.instruction}</p>

          {stepTimer && !activeTimer && (
            <TimerBlock
              seconds={initialTimerSeconds}
              running={false}
              label={stepTimer.label}
              idleLabel={`Ready for ${stepTimer.label}`}
              soundEnabled={soundEnabled}
              onToggleSound={() => {
                void prepareAlarm();
                setSoundEnabled(!soundEnabled);
              }}
              onToggle={() => {
                void prepareAlarm();
                startTimer({
                  recipeId: id,
                  stepIndex: currentStep,
                  label: stepTimer.label,
                  durationSeconds: stepTimer.seconds,
                  recipeTitle: recipe.title,
                });
              }}
              onReset={() => {
                resetTimer({
                  recipeId: id,
                  stepIndex: currentStep,
                  label: stepTimer.label,
                  durationSeconds: stepTimer.seconds,
                  recipeTitle: recipe.title,
                });
              }}
            />
          )}

          {activeTimer && stepTimer && (
            <TimerBlock
              seconds={getTimerSeconds(id, currentStep) ?? 0}
              running={activeTimer.running}
              label={stepTimer.label}
              soundEnabled={soundEnabled}
              onToggleSound={() => {
                void prepareAlarm();
                setSoundEnabled(!soundEnabled);
              }}
              onToggle={() => {
                void prepareAlarm();
                if (activeTimer.running) {
                  pauseTimer(id, currentStep);
                  return;
                }
                resumeTimer(id, currentStep);
              }}
              onReset={() => {
                resetTimer({
                  recipeId: id,
                  stepIndex: currentStep,
                  label: stepTimer.label,
                  durationSeconds: stepTimer.seconds,
                  recipeTitle: recipe.title,
                });
              }}
            />
          )}

          {ingredients.length > 0 && ingredients.length < 7 && (
            <div style={S.inlineIngredients}>
              <p style={S.inlineTitle}>Pull these for this step</p>
              <div style={S.inlineIngredientList}>
                {ingredients.map((ing, i) => {
                  const ingredientKey = `${currentStep}:${i}`;
                  const checked = Boolean(checkedIngredients[ingredientKey]);

                  return (
                    <button
                      key={ingredientKey}
                      type="button"
                      style={{ ...S.inlineIng, ...(checked ? S.inlineIngChecked : {}) }}
                      onClick={() =>
                        setCheckedIngredients((prev) => ({
                          ...prev,
                          [ingredientKey]: !prev[ingredientKey],
                        }))
                      }
                    >
                      <span
                        style={{
                          ...S.inlineIngCheck,
                          ...(checked ? S.inlineIngCheckDone : {}),
                        }}
                      >
                        {checked ? <Check size={12} strokeWidth={3} /> : null}
                      </span>
                      <span>{[ing.amount, ing.unit, ing.name].filter(Boolean).join(" ")}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={S.nextCard}>
            <span style={S.nextLabel}>{nextStep ? "Next up" : "Almost there"}</span>
            <p style={S.nextText}>{nextStep ? nextStep.instruction : "Plate it up and enjoy."}</p>
          </div>
        </div>
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
  idleLabel,
  soundEnabled,
  onToggleSound,
  onToggle,
  onReset,
}: {
  seconds: number;
  label: string;
  running: boolean;
  idleLabel?: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
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
        <span style={T.label}>{idleLabel || label}</span>
        <span style={T.time}>{done ? "Done!" : display}</span>
      </div>
      <div style={T.actions}>
        <button onClick={onToggleSound} style={{ ...T.btn, ...T.btnMute }}>
          {soundEnabled ? <Volume2 size={14} strokeWidth={2.2} /> : <VolumeX size={14} strokeWidth={2.2} />}
        </button>
        <button onClick={onToggle} style={T.btn}>
          {running ? <Pause size={14} strokeWidth={2.4} /> : <Play size={14} strokeWidth={2.4} />}
          <span>{running ? "Pause" : "Start"}</span>
        </button>
        <button onClick={onReset} style={{ ...T.btn, ...T.btnReset }}>
          <RotateCcw size={14} strokeWidth={2.2} />
        </button>
      </div>
      <p style={T.note}>Timer alerts continue while you move through the app, as long as abovo stays open.</p>
    </div>
  );
}

const T: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    width: "100%",
    maxWidth: "100%",
    margin: "16px auto 0",
    background: "rgb(var(--terra-600))",
    borderRadius: "var(--radius-card)",
    padding: "14px 16px",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 18px 36px rgba(108, 52, 31, 0.16)",
    fontFamily: "var(--font-body)",
  },
  wrapDone: { background: "rgb(150, 70, 37)", border: "1px solid rgba(255,255,255,0.18)" },
  info: { display: "flex", flexDirection: "column", gap: 2, textAlign: "center" },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgb(var(--terra-100))" },
  time: { fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "white", fontFamily: "var(--font-body)" },
  actions: { display: "flex", gap: 8 },
  note: { width: "100%", marginTop: 2, fontSize: 12, lineHeight: 1.45, color: "rgb(var(--terra-100))" },
  btn: { background: "rgba(255,255,255,0.14)", color: "white", border: "1px solid rgba(255,255,255,0.16)", borderRadius: "var(--radius-control)", padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)" },
  btnMute: { background: "rgba(255,255,255,0.12)", color: "rgb(var(--warm-50))", border: "1px solid rgba(255,255,255,0.16)", padding: "8px 10px" },
  btnReset: { background: "rgba(53, 49, 46, 0.18)", color: "white", border: "1px solid rgba(255,255,255,0.12)" },
};

const S: Record<string, React.CSSProperties> = {
  loading: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", fontSize: 16, color: "rgb(var(--warm-500))" },
  page: { display: "flex", flexDirection: "column", height: "100dvh", background: "linear-gradient(180deg, rgb(255 250 246) 0%, rgb(var(--warm-50)) 42%, white 100%)", overflow: "hidden" },
  topBar: { display: "flex", alignItems: "center", gap: 12, padding: "18px 16px 12px", borderBottom: "1px solid rgba(181, 88, 47, 0.08)" },
  topBackBtn: { background: "none", border: "none", cursor: "pointer", color: "rgb(var(--warm-500))", padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "center" },
  topMeta: { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  topTitle: { fontSize: 14, fontWeight: 700, color: "rgb(var(--warm-800))", lineHeight: 1.2 },
  topProgress: { fontSize: 12, color: "rgb(var(--terra-600))", fontWeight: 600 },
  progressTrack: { height: 5, background: "rgba(181, 88, 47, 0.08)" },
  progressBar: { height: "100%", background: "rgb(var(--terra-500))", transition: "width 0.3s" },
  stepArea: { flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "28px 18px 24px", display: "flex", flexDirection: "column" },
  stepCard: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,241,232,0.58) 100%)",
    border: "1px solid rgba(181, 88, 47, 0.12)",
    boxShadow: "0 24px 60px rgba(93, 64, 43, 0.08)",
    borderRadius: "var(--radius-modal)",
    padding: "24px 20px 22px",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  stepHeader: { display: "flex", alignItems: "center", gap: 14 },
  stepMetaCopy: { display: "flex", flexDirection: "column", gap: 4 },
  stepEyebrow: { fontSize: 11, fontWeight: 700, color: "rgb(var(--terra-600))", textTransform: "uppercase", letterSpacing: "0.08em" },
  stepCount: { fontSize: 13, color: "rgb(var(--warm-500))", fontWeight: 600 },
  stepNumBadge: { width: 48, height: 48, borderRadius: "50%", background: "rgb(var(--terra-600))", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, flexShrink: 0 },
  stepText: { fontSize: 25, lineHeight: 1.6, color: "rgb(var(--warm-900))", fontFamily: "var(--font-serif)" },
  timerChip: {
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    gap: 12,
    border: "1px solid rgb(var(--terra-600))",
    borderRadius: "var(--radius-pill)",
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
  inlineIngredients: { background: "rgba(255,255,255,0.8)", borderRadius: "var(--radius-card)", padding: "16px", border: "1px solid rgb(var(--warm-100))" },
  inlineTitle: { fontSize: 11, fontWeight: 700, color: "rgb(var(--warm-500))", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 },
  inlineIngredientList: { display: "flex", flexDirection: "column", gap: 8 },
  inlineIng: { display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgb(var(--warm-700))", background: "white", border: "1px solid rgb(var(--warm-200))", borderRadius: "var(--radius-card-inner)", padding: "10px 12px", textAlign: "left", cursor: "pointer" },
  inlineIngChecked: { background: "rgb(var(--terra-50))", border: "1px solid rgb(var(--terra-200))", color: "rgb(var(--warm-900))" },
  inlineIngCheck: { width: 18, height: 18, borderRadius: "50%", border: "1.5px solid rgb(var(--warm-300))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "white" },
  inlineIngCheckDone: { background: "rgb(var(--terra-600))", borderColor: "rgb(var(--terra-600))" },
  nextCard: { background: "rgba(181, 88, 47, 0.08)", borderRadius: "var(--radius-card)", padding: "15px 16px", border: "1px solid rgba(181, 88, 47, 0.12)" },
  nextLabel: { display: "block", fontSize: 11, fontWeight: 700, color: "rgb(var(--terra-600))", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 },
  nextText: { fontSize: 14, lineHeight: 1.5, color: "rgb(var(--warm-700))" },
  nav: { padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgb(var(--warm-100))", background: "rgba(255,255,255,0.94)", backdropFilter: "blur(14px)", paddingBottom: "max(16px, env(safe-area-inset-bottom))", position: "sticky", bottom: 0 },
  navBtn: { background: "rgb(var(--warm-100))", color: "rgb(var(--warm-800))", border: "none", borderRadius: "var(--radius-control)", padding: "12px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  navBtnDisabled: { opacity: 0.35, cursor: "not-allowed" },
  navBtnFinish: { background: "rgb(var(--terra-600))", color: "white" },
  dots: { display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", justifyContent: "center", maxWidth: 160 },
  dot: { width: 8, height: 8, borderRadius: "50%", background: "rgb(var(--warm-200))", border: "none", cursor: "pointer", padding: 0 },
  dotActive: { background: "rgb(var(--terra-600))", transform: "scale(1.3)" },
  dotDone: { background: "rgb(var(--terra-300))" },
};
