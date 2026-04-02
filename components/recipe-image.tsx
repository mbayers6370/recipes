"use client";

import { useEffect, useState } from "react";
import {
  Apple,
  Cookie,
  CookingPot,
  Croissant,
  Sandwich,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { getRecipeType, type RecipeType } from "@/lib/recipe-taxonomy";

type NetworkInformationLike = EventTarget & {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  saveData?: boolean;
  downlink?: number;
  rtt?: number;
};

type RecipeImageProps = {
  imageUrl?: string | null;
  title: string;
  tags?: string[] | null;
  iconSize?: number;
  showLabel?: boolean;
  sizes: string;
  imageStyle?: React.CSSProperties;
  priority?: boolean;
};

const TYPE_STYLES: Record<
  RecipeType | "default",
  { icon: LucideIcon; background: string; color: string; label: string }
> = {
  breakfast: {
    icon: Croissant,
    background: "rgb(196 132 98)",
    color: "rgb(255 255 255)",
    label: "Breakfast recipe",
  },
  lunch: {
    icon: Sandwich,
    background: "rgb(196 132 98)",
    color: "rgb(255 255 255)",
    label: "Lunch recipe",
  },
  dinner: {
    icon: CookingPot,
    background: "rgb(196 132 98)",
    color: "rgb(255 255 255)",
    label: "Dinner recipe",
  },
  snack: {
    icon: Apple,
    background: "rgb(196 132 98)",
    color: "rgb(255 255 255)",
    label: "Snack recipe",
  },
  dessert: {
    icon: Cookie,
    background: "rgb(196 132 98)",
    color: "rgb(255 255 255)",
    label: "Dessert recipe",
  },
  default: {
    icon: UtensilsCrossed,
    background: "rgb(196 132 98)",
    color: "rgb(255 255 255)",
    label: "No image yet",
  },
};

export function RecipeImage({
  imageUrl,
  title,
  tags,
  sizes,
  iconSize = 28,
  showLabel = false,
  imageStyle,
  priority = false,
}: RecipeImageProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [shouldSkipImageLoad, setShouldSkipImageLoad] = useState(false);

  useEffect(() => {
    setFailedUrl(null);
  }, [imageUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const getConnection = () =>
      (navigator as Navigator & {
        connection?: NetworkInformationLike;
        mozConnection?: NetworkInformationLike;
        webkitConnection?: NetworkInformationLike;
      }).connection ??
      (navigator as Navigator & {
        mozConnection?: NetworkInformationLike;
      }).mozConnection ??
      (navigator as Navigator & {
        webkitConnection?: NetworkInformationLike;
      }).webkitConnection;

    const syncConstrainedNetworkState = () => {
      const connection = getConnection();
      const hasSlowEffectiveType = connection?.effectiveType
        ? ["slow-2g", "2g", "3g"].includes(connection.effectiveType)
        : false;
      const hasLowBandwidth = typeof connection?.downlink === "number" && connection.downlink < 1.5;
      const hasHighLatency = typeof connection?.rtt === "number" && connection.rtt > 300;

      setShouldSkipImageLoad(
        navigator.onLine === false ||
        Boolean(connection?.saveData) ||
        hasSlowEffectiveType ||
        hasLowBandwidth ||
        hasHighLatency
      );
    };

    syncConstrainedNetworkState();

    const connection = getConnection();
    window.addEventListener("online", syncConstrainedNetworkState);
    window.addEventListener("offline", syncConstrainedNetworkState);
    connection?.addEventListener?.("change", syncConstrainedNetworkState);

    return () => {
      window.removeEventListener("online", syncConstrainedNetworkState);
      window.removeEventListener("offline", syncConstrainedNetworkState);
      connection?.removeEventListener?.("change", syncConstrainedNetworkState);
    };
  }, []);

  const recipeType = getRecipeType(tags);
  const fallback = TYPE_STYLES[recipeType || "default"];
  const Icon = fallback.icon;
  const hasError = !!imageUrl && failedUrl === imageUrl;
  const shouldShowFallback = !imageUrl || hasError || shouldSkipImageLoad;

  if (shouldShowFallback) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: fallback.background,
          color: fallback.color,
          textAlign: "center",
          padding: "12px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: showLabel ? 8 : 0,
            width: "100%",
            maxWidth: "100%",
          }}
        >
          <Icon size={iconSize} strokeWidth={1.9} />
          {showLabel ? (
            <span style={{ fontSize: 13, fontWeight: 600, color: fallback.color }}>
              {shouldSkipImageLoad && imageUrl ? "Image paused for slow connection" : fallback.label}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={title}
      loading={priority ? "eager" : "lazy"}
      sizes={sizes}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        objectFit: "cover",
        objectPosition: "center center",
        ...imageStyle,
      }}
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(imageUrl)}
    />
  );
}
