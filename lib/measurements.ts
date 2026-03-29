const UNICODE_FRACTIONS: Record<string, string> = {
  "¼": "1/4",
  "½": "1/2",
  "¾": "3/4",
  "⅐": "1/7",
  "⅑": "1/9",
  "⅒": "1/10",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅕": "1/5",
  "⅖": "2/5",
  "⅗": "3/5",
  "⅘": "4/5",
  "⅙": "1/6",
  "⅚": "5/6",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};

function normalizeAmount(amount: string) {
  return amount
    .trim()
    .replace(/(\d)([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, "$1 $2")
    .replace(/[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (match) => UNICODE_FRACTIONS[match] || match)
    .replace(/\s+/g, " ");
}

export function parseAmountValue(amount?: string | null): number | null {
  if (!amount?.trim()) return null;

  const normalized = normalizeAmount(amount);
  if (/^\d+(\.\d+)?$/.test(normalized)) {
    return Number(normalized);
  }

  const mixedMatch = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    return Number(mixedMatch[1]) + Number(mixedMatch[2]) / Number(mixedMatch[3]);
  }

  const fractionMatch = normalized.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    return Number(fractionMatch[1]) / Number(fractionMatch[2]);
  }

  return null;
}

function decimalToFraction(value: number) {
  const denominators = [2, 3, 4, 6, 8, 12, 16];
  let best: { numerator: number; denominator: number; error: number } | null = null;

  for (const denominator of denominators) {
    const numerator = Math.round(value * denominator);
    const error = Math.abs(value - numerator / denominator);
    if (!best || error < best.error) {
      best = { numerator, denominator, error };
    }
  }

  if (!best || best.error > 0.03 || best.numerator === 0) {
    return null;
  }

  return best;
}

export function formatAmountValue(value: number) {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return String(value);

  const whole = Math.floor(value);
  const remainder = value - whole;
  const fraction = decimalToFraction(remainder);

  if (fraction) {
    if (fraction.numerator === fraction.denominator) {
      return String(whole + 1);
    }

    const fractionText = `${fraction.numerator}/${fraction.denominator}`;
    return whole > 0 ? `${whole} ${fractionText}` : fractionText;
  }

  return String(Math.round(value * 100) / 100).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

export function scaleAmountText(amount?: string | null, scale = 1) {
  if (!amount?.trim()) return undefined;
  if (scale === 1) return amount.trim();

  const parsed = parseAmountValue(amount);
  if (parsed === null) return amount.trim();

  return formatAmountValue(parsed * scale);
}
