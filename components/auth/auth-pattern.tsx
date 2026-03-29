"use client";

import type { LucideIcon } from "lucide-react";
import {
  Apple,
  Carrot,
  ChefHat,
  Cookie,
  CookingPot,
  Croissant,
  Salad,
  Sandwich,
  Soup,
  UtensilsCrossed,
  Wheat,
} from "lucide-react";

const ICONS: LucideIcon[] = [
  ChefHat,
  CookingPot,
  Carrot,
  Wheat,
  Soup,
  Salad,
  Sandwich,
  Croissant,
  Cookie,
  Apple,
  UtensilsCrossed,
];

export function AuthPattern() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "-6%",
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: "28px 18px",
          opacity: 0.18,
          transform: "rotate(-8deg) scale(1.08)",
        }}
      >
        {Array.from({ length: 48 }, (_, index) => {
          const Icon = ICONS[index % ICONS.length];

          return (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(247, 241, 232, 0.42)",
              }}
            >
              <Icon size={index % 3 === 0 ? 38 : 30} strokeWidth={1.6} />
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at top, rgba(247, 241, 232, 0.12), transparent 40%), linear-gradient(180deg, rgba(96, 42, 18, 0.16), rgba(96, 42, 18, 0.34))",
        }}
      />
    </div>
  );
}

export function FoodIconPattern({
  iconColor = "rgba(247, 241, 232, 0.42)",
  opacity = 0.18,
  overlay =
    "radial-gradient(circle at top, rgba(247, 241, 232, 0.12), transparent 40%), linear-gradient(180deg, rgba(96, 42, 18, 0.16), rgba(96, 42, 18, 0.34))",
  columns = 6,
  gap = "28px 18px",
  rotation = -8,
  scale = 1.08,
}: {
  iconColor?: string;
  opacity?: number;
  overlay?: string;
  columns?: number;
  gap?: string;
  rotation?: number;
  scale?: number;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "-6%",
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap,
          opacity,
          transform: `rotate(${rotation}deg) scale(${scale})`,
        }}
      >
        {Array.from({ length: 48 }, (_, index) => {
          const Icon = ICONS[index % ICONS.length];

          return (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: iconColor,
              }}
            >
              <Icon size={index % 3 === 0 ? 38 : 30} strokeWidth={1.6} />
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: overlay,
        }}
      />
    </div>
  );
}
