"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MutableRefObject } from "react";

type CookTimer = {
  key: string;
  recipeId: string;
  stepIndex: number;
  label: string;
  recipeTitle?: string;
  durationSeconds: number;
  remainingSeconds: number;
  endsAt: number | null;
  running: boolean;
  alarmPlayed: boolean;
};

type StartCookTimerInput = {
  recipeId: string;
  stepIndex: number;
  label: string;
  durationSeconds: number;
  recipeTitle?: string;
};

type CookTimerContextValue = {
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  getTimer: (recipeId: string, stepIndex: number) => CookTimer | null;
  getTimerSeconds: (recipeId: string, stepIndex: number) => number | undefined;
  startTimer: (input: StartCookTimerInput) => void;
  pauseTimer: (recipeId: string, stepIndex: number) => void;
  resumeTimer: (recipeId: string, stepIndex: number) => void;
  resetTimer: (input: StartCookTimerInput) => void;
  clearRecipeTimers: (recipeId: string) => void;
  prepareAlarm: () => Promise<void>;
};

const STORAGE_KEY = "abovo:cook-timers:v1";
const SOUND_STORAGE_KEY = "abovo:timer-sound-enabled:v1";

const CookTimerContext = createContext<CookTimerContextValue | null>(null);

function getTimerKey(recipeId: string, stepIndex: number) {
  return `${recipeId}:${stepIndex}`;
}

function getRemainingSeconds(timer: CookTimer, now = Date.now()) {
  if (!timer.running || timer.endsAt === null) return timer.remainingSeconds;
  return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
}

async function unlockAudioContext(audioContextRef: MutableRefObject<AudioContext | null>) {
  if (typeof window === "undefined") return null;

  const AudioCtx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtx) return null;

  if (!audioContextRef.current) {
    audioContextRef.current = new AudioCtx();
  }

  if (audioContextRef.current.state === "suspended") {
    await audioContextRef.current.resume();
  }

  return audioContextRef.current;
}

async function prepareTimerAlarm(
  audioContextRef: MutableRefObject<AudioContext | null>,
  audioElementRef: MutableRefObject<HTMLAudioElement | null>
) {
  await unlockAudioContext(audioContextRef);

  if (typeof window === "undefined") return;

  if (!audioElementRef.current) {
    const audio = new Audio("/timer-alarm.wav");
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
    audio.crossOrigin = "anonymous";
    audio.volume = 1;
    audio.load();
    audioElementRef.current = audio;
  }

  const audio = audioElementRef.current;
  if (!audio) return;

  try {
    audio.currentTime = 0;
    audio.muted = true;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    audio.load();
  } catch {
    audio.muted = false;
  }
}

async function playTimerDoneSound(
  audioContextRef: MutableRefObject<AudioContext | null>,
  audioElementRef: MutableRefObject<HTMLAudioElement | null>
) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.([180, 120, 220]);
  }

  const audio = audioElementRef.current;
  if (audio) {
    try {
      const playback = audio.cloneNode(true) as HTMLAudioElement;
      playback.setAttribute("playsinline", "true");
      playback.preload = "auto";
      playback.volume = 1;
      playback.currentTime = 0;
      playback.muted = false;
      await playback.play();
      return;
    } catch {
      // Fall back to oscillator alarm below.
    }
  }

  const context = await unlockAudioContext(audioContextRef);
  if (!context) return;

  const now = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
  master.connect(context.destination);

  const notes = [
    { frequency: 1046.5, start: 0, duration: 0.42 },
    { frequency: 1318.5, start: 0.18, duration: 0.48 },
    { frequency: 1567.98, start: 0.4, duration: 0.62 },
  ];

  notes.forEach((note) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(note.frequency, now + note.start);

    gain.gain.setValueAtTime(0.0001, now + note.start);
    gain.gain.exponentialRampToValueAtTime(0.16, now + note.start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);

    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now + note.start);
    oscillator.stop(now + note.start + note.duration + 0.02);
  });
}

export function CookTimerProvider({ children }: { children: React.ReactNode }) {
  const [timers, setTimers] = useState<Record<string, CookTimer>>({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);
      if (!storedValue) return;

      const parsed = JSON.parse(storedValue) as Record<string, CookTimer>;
      if (!parsed || typeof parsed !== "object") return;

      setTimers(parsed);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    const storedSoundEnabled = window.localStorage.getItem(SOUND_STORAGE_KEY);
    if (storedSoundEnabled === "false") {
      setSoundEnabled(false);
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
  }, [hydrated, timers]);

  useEffect(() => {
    if (typeof window === "undefined" || !hydrated) return;
    window.localStorage.setItem(SOUND_STORAGE_KEY, String(soundEnabled));
  }, [hydrated, soundEnabled]);

  useEffect(() => {
    const primeAlarm = () => {
      void prepareTimerAlarm(audioContextRef, audioElementRef);
    };

    window.addEventListener("pointerdown", primeAlarm, { passive: true });
    window.addEventListener("keydown", primeAlarm);

    return () => {
      window.removeEventListener("pointerdown", primeAlarm);
      window.removeEventListener("keydown", primeAlarm);
    };
  }, []);

  useEffect(() => {
    const runningTimers = Object.values(timers).filter((timer) => timer.running);
    if (runningTimers.length === 0) return;

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const expiredTimers = Object.values(timers).filter(
        (timer) => timer.running && !timer.alarmPlayed && getRemainingSeconds(timer, now) === 0
      );

      if (expiredTimers.length === 0) return;

      if (soundEnabled) {
        void prepareTimerAlarm(audioContextRef, audioElementRef).then(() =>
          playTimerDoneSound(audioContextRef, audioElementRef)
        );
      }

      setTimers((currentTimers) => {
        const nextTimers = { ...currentTimers };
        expiredTimers.forEach((timer) => {
          const existingTimer = nextTimers[timer.key];
          if (!existingTimer) return;
          nextTimers[timer.key] = {
            ...existingTimer,
            running: false,
            endsAt: null,
            remainingSeconds: 0,
            alarmPlayed: true,
          };
        });
        return nextTimers;
      });
    }, 500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [soundEnabled, timers]);

  const getTimer = useCallback((recipeId: string, stepIndex: number) => {
    const timer = timers[getTimerKey(recipeId, stepIndex)];
    if (!timer) return null;

    return {
      ...timer,
      remainingSeconds: getRemainingSeconds(timer),
    };
  }, [timers]);

  const getTimerSeconds = useCallback((recipeId: string, stepIndex: number) => {
    const timer = timers[getTimerKey(recipeId, stepIndex)];
    if (!timer) return undefined;
    return getRemainingSeconds(timer);
  }, [timers]);

  const startTimer = useCallback((input: StartCookTimerInput) => {
    const key = getTimerKey(input.recipeId, input.stepIndex);
    setTimers((currentTimers) => ({
      ...currentTimers,
      [key]: {
        key,
        recipeId: input.recipeId,
        stepIndex: input.stepIndex,
        label: input.label,
        recipeTitle: input.recipeTitle,
        durationSeconds: input.durationSeconds,
        remainingSeconds: input.durationSeconds,
        endsAt: Date.now() + input.durationSeconds * 1000,
        running: true,
        alarmPlayed: false,
      },
    }));
  }, []);

  const pauseTimer = useCallback((recipeId: string, stepIndex: number) => {
    const key = getTimerKey(recipeId, stepIndex);
    setTimers((currentTimers) => {
      const existingTimer = currentTimers[key];
      if (!existingTimer) return currentTimers;

      return {
        ...currentTimers,
        [key]: {
          ...existingTimer,
          remainingSeconds: getRemainingSeconds(existingTimer),
          endsAt: null,
          running: false,
        },
      };
    });
  }, []);

  const resumeTimer = useCallback((recipeId: string, stepIndex: number) => {
    const key = getTimerKey(recipeId, stepIndex);
    setTimers((currentTimers) => {
      const existingTimer = currentTimers[key];
      if (!existingTimer) return currentTimers;

      const seconds = getRemainingSeconds(existingTimer);
      return {
        ...currentTimers,
        [key]: {
          ...existingTimer,
          remainingSeconds: seconds,
          endsAt: Date.now() + seconds * 1000,
          running: true,
          alarmPlayed: false,
        },
      };
    });
  }, []);

  const resetTimer = useCallback((input: StartCookTimerInput) => {
    const key = getTimerKey(input.recipeId, input.stepIndex);
    setTimers((currentTimers) => ({
      ...currentTimers,
      [key]: {
        key,
        recipeId: input.recipeId,
        stepIndex: input.stepIndex,
        label: input.label,
        recipeTitle: input.recipeTitle,
        durationSeconds: input.durationSeconds,
        remainingSeconds: input.durationSeconds,
        endsAt: null,
        running: false,
        alarmPlayed: false,
      },
    }));
  }, []);

  const clearRecipeTimers = useCallback((recipeId: string) => {
    setTimers((currentTimers) => {
      const nextTimers = { ...currentTimers };
      Object.keys(nextTimers).forEach((key) => {
        if (nextTimers[key]?.recipeId === recipeId) {
          delete nextTimers[key];
        }
      });
      return nextTimers;
    });
  }, []);

  const prepareAlarm = useCallback(async () => {
    await prepareTimerAlarm(audioContextRef, audioElementRef);
  }, []);

  const value = useMemo<CookTimerContextValue>(() => ({
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
  }), [clearRecipeTimers, getTimer, getTimerSeconds, pauseTimer, prepareAlarm, resetTimer, resumeTimer, soundEnabled, startTimer]);

  return <CookTimerContext.Provider value={value}>{children}</CookTimerContext.Provider>;
}

export function useCookTimers() {
  const context = useContext(CookTimerContext);
  if (!context) throw new Error("useCookTimers must be used within CookTimerProvider");
  return context;
}
