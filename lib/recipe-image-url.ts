import "server-only";

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

function extractMetaContent(html: string, key: "og:image" | "twitter:image" | "twitter:image:src") {
  const propertyMatch = html.match(
    new RegExp(`<meta[^>]*(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`, "i")
  );

  return propertyMatch?.[1];
}

function resolveUrl(candidate: string, baseUrl: string) {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return undefined;
  }
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
  if (isLikelyDirectImageUrl(url)) {
    return url;
  }

  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error("Could not fetch that URL");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.startsWith("image/")) {
    return response.url || url;
  }

  const html = await response.text();
  const metaImage =
    extractMetaContent(html, "og:image") ||
    extractMetaContent(html, "twitter:image") ||
    extractMetaContent(html, "twitter:image:src");

  if (!metaImage) {
    return undefined;
  }

  return resolveUrl(metaImage, response.url || url);
}
