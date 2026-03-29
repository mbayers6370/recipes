export interface StepTimerSuggestion {
  seconds: number;
  label: string;
  source: "explicit" | "detected";
}

const RANGE_PATTERN =
  /\b(?:for|about|around|approximately|approx\.?)?\s*(\d{1,3})\s*(?:-|to)\s*(\d{1,3})\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i;
const SINGLE_PATTERN =
  /\b(?:for|about|around|approximately|approx\.?)?\s*(\d{1,3})\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i;

export function getStepTimerSuggestion(step: { instruction: string; timerSeconds?: number }) {
  if (step.timerSeconds && step.timerSeconds > 0) {
    return {
      seconds: step.timerSeconds,
      label: formatDurationLabel(step.timerSeconds),
      source: "explicit" as const,
    };
  }

  return detectTimerFromInstruction(step.instruction);
}

export function detectTimerFromInstruction(instruction: string): StepTimerSuggestion | null {
  const text = instruction.trim();
  if (!text) return null;

  const rangeMatch = text.match(RANGE_PATTERN);
  if (rangeMatch) {
    const lower = Number.parseInt(rangeMatch[1], 10);
    const upper = Number.parseInt(rangeMatch[2], 10);
    const unit = normalizeUnit(rangeMatch[3]);
    const seconds = toSeconds(Math.round((lower + upper) / 2), unit);

    if (seconds > 0) {
      return {
        seconds,
        label: `${lower}-${upper} ${shortUnit(unit)}`,
        source: "detected",
      };
    }
  }

  const singleMatch = text.match(SINGLE_PATTERN);
  if (singleMatch) {
    const amount = Number.parseInt(singleMatch[1], 10);
    const unit = normalizeUnit(singleMatch[2]);
    const seconds = toSeconds(amount, unit);

    if (seconds > 0) {
      return {
        seconds,
        label: `${amount} ${shortUnit(unit)}`,
        source: "detected",
      };
    }
  }

  return null;
}

function normalizeUnit(unit: string) {
  if (/^h/i.test(unit)) return "hour";
  if (/^s/i.test(unit)) return "second";
  return "minute";
}

function shortUnit(unit: "second" | "minute" | "hour") {
  if (unit === "hour") return "hr";
  if (unit === "second") return "sec";
  return "min";
}

function toSeconds(amount: number, unit: "second" | "minute" | "hour") {
  if (unit === "hour") return amount * 60 * 60;
  if (unit === "second") return amount;
  return amount * 60;
}

function formatDurationLabel(seconds: number) {
  if (seconds % 3600 === 0) {
    return `${seconds / 3600} hr`;
  }

  if (seconds % 60 === 0) {
    return `${seconds / 60} min`;
  }

  return `${seconds} sec`;
}
