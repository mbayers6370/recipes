export function normalizeExternalUrl(value?: string | null) {
  if (typeof value !== "string") return undefined;

  const normalized = value
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .trim();

  if (!normalized) return undefined;

  const withProtocol = normalized.startsWith("//")
    ? `https:${normalized}`
    : /^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)
      ? normalized
      : `https://${normalized}`;

  try {
    const url = new URL(withProtocol);
    if (!/^https?:$/i.test(url.protocol)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function isValidHttpUrl(value?: string | null) {
  return Boolean(normalizeExternalUrl(value));
}
