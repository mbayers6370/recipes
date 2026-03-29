"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
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

type RecipeImageProps = {
  imageUrl?: string | null;
  title: string;
  tags?: string[] | null;
  sizes: string;
  iconSize?: number;
  showLabel?: boolean;
  imageStyle?: ImageProps["style"];
};

const TYPE_STYLES: Record<
  RecipeType | "default",
  { icon: LucideIcon; background: string; color: string; label: string }
> = {
  breakfast: {
    icon: Croissant,
    background: "linear-gradient(180deg, rgb(248 237 212) 0%, rgb(255 248 239) 100%)",
    color: "rgb(169 112 37)",
    label: "Breakfast recipe",
  },
  lunch: {
    icon: Sandwich,
    background: "linear-gradient(180deg, rgb(235 242 227) 0%, rgb(248 252 244) 100%)",
    color: "rgb(105 130 67)",
    label: "Lunch recipe",
  },
  dinner: {
    icon: CookingPot,
    background: "linear-gradient(180deg, rgb(233 223 216) 0%, rgb(248 242 237) 100%)",
    color: "rgb(131 88 59)",
    label: "Dinner recipe",
  },
  snack: {
    icon: Apple,
    background: "linear-gradient(180deg, rgb(238 244 228) 0%, rgb(249 252 245) 100%)",
    color: "rgb(109 144 71)",
    label: "Snack recipe",
  },
  dessert: {
    icon: Cookie,
    background: "linear-gradient(180deg, rgb(246 232 222) 0%, rgb(252 246 242) 100%)",
    color: "rgb(171 101 58)",
    label: "Dessert recipe",
  },
  default: {
    icon: UtensilsCrossed,
    background: "linear-gradient(180deg, rgb(var(--warm-100)) 0%, rgb(var(--warm-50)) 100%)",
    color: "rgb(var(--warm-400))",
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
}: RecipeImageProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const recipeType = getRecipeType(tags);
  const fallback = TYPE_STYLES[recipeType || "default"];
  const Icon = fallback.icon;
  const hasError = !!imageUrl && failedUrl === imageUrl;

  if (!imageUrl || hasError) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: showLabel ? 8 : 0,
          background: fallback.background,
          color: fallback.color,
          textAlign: "center",
          padding: "12px",
        }}
      >
        <Icon size={iconSize} strokeWidth={1.9} />
        {showLabel ? (
          <span style={{ fontSize: 13, fontWeight: 600, color: fallback.color }}>
            {fallback.label}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <Image
      src={imageUrl}
      alt={title}
      fill
      unoptimized
      sizes={sizes}
      style={imageStyle}
      onError={() => setFailedUrl(imageUrl)}
    />
  );
}
