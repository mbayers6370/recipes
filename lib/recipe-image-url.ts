import "server-only";
import { normalizeExternalUrl } from "@/lib/url";

const REQUEST_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

const IMAGE_PATH_PATTERN = /\.(avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i;
const PRIMARY_HEADERS: HeadersInit[] = [
  REQUEST_HEADERS,
  { Accept: "text/html,application/xhtml+xml" },
];
const FETCH_TIMEOUT_MS = 12000;
const FALLBACK_FETCH_ATTEMPTS = 2;

function extractMetaContent(html: string, key: "og:image" | "twitter:image" | "twitter:image:src") {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];

  for (const tag of metaTags) {
    const nameOrProperty = tag.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1]?.trim().toLowerCase();
    if (nameOrProperty !== key) continue;

    const content = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1]?.trim();
    if (content) return content;
  }

  return undefined;
}

function resolveUrl(candidate: string, baseUrl: string) {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function buildMirrorUrls(url: string) {
  const stripped = url.replace(/^https?:\/\//i, "");
  return Array.from(
    new Set([
      `https://r.jina.ai/http://${stripped}`,
      `https://r.jina.ai/http://${url}`,
      `https://r.jina.ai/http://https://${stripped}`,
      `https://r.jina.ai/http://http://${stripped}`,
    ])
  );
}

function extractImageFromMirrorText(text: string, baseUrl: string) {
  const linkedImageMatch = text.match(/\[[^\]]*]\((https?:\/\/[^)\s]+\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?[^)\s]*)?)\)/i);
  if (linkedImageMatch) {
    return resolveUrl(linkedImageMatch[1], baseUrl);
  }

  const markdownMatch = text.match(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/i);
  if (markdownMatch) {
    return resolveUrl(markdownMatch[1], baseUrl);
  }

  const mediaMatch = text.match(/https?:\/\/\S+\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?\S*)?/i);
  if (mediaMatch) {
    return resolveUrl(mediaMatch[0], baseUrl);
  }

  return undefined;
}

export function isLikelyDirectImageUrl(value?: string | null) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return IMAGE_PATH_PATTERN.test(url.pathname) || IMAGE_PATH_PATTERN.test(url.toString());
  } catch {
    return false;
  }
}

export async function resolveRecipeImageUrl(url: string) {
  const normalizedUrl = normalizeExternalUrl(url);
  if (!normalizedUrl) {
    throw new Error("Could not fetch that URL");
  }

  if (isLikelyDirectImageUrl(normalizedUrl)) {
    return normalizedUrl;
  }

  let blocked = false;
  let shouldTryMirror = false;

  for (let attempt = 0; attempt < FALLBACK_FETCH_ATTEMPTS; attempt += 1) {
    for (const headers of PRIMARY_HEADERS) {
      const response = await fetch(normalizedUrl, {
        headers,
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.startsWith("image/")) {
          return response.url || normalizedUrl;
        }

        const html = await response.text();
        const metaImage =
          extractMetaContent(html, "og:image") ||
          extractMetaContent(html, "twitter:image") ||
          extractMetaContent(html, "twitter:image:src");

        if (!metaImage) {
          shouldTryMirror = true;
          continue;
        }

        const resolvedMetaImage = resolveUrl(metaImage, response.url || normalizedUrl);
        if (resolvedMetaImage) {
          return resolvedMetaImage;
        }

        shouldTryMirror = true;
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        blocked = true;
        shouldTryMirror = true;
        continue;
      }

      throw new Error("Could not fetch that URL");
    }
  }

  if (blocked || shouldTryMirror) {
    for (let attempt = 0; attempt < FALLBACK_FETCH_ATTEMPTS; attempt += 1) {
      for (const mirrorUrl of buildMirrorUrls(normalizedUrl)) {
        const mirrorResponse = await fetch(mirrorUrl, {
          headers: { Accept: "text/plain, text/markdown, text/html;q=0.9, */*;q=0.8" },
          cache: "no-store",
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });

        if (!mirrorResponse.ok) continue;

        const text = await mirrorResponse.text();
        const image = extractImageFromMirrorText(text, normalizedUrl);
        if (image) return image;
      }
    }

    throw new Error("Could not fetch that URL");
  }

  return undefined;
}
