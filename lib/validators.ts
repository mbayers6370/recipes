import { z } from "zod";

// ── Auth ──────────────────────────────────────────────────────────────────────

export const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  displayName: z.string().max(60).optional(),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Email or username required"),
  password: z.string().min(1, "Password required"),
});

// ── Recipe ────────────────────────────────────────────────────────────────────

export const ingredientSchema = z.object({
  id: z.string().optional(),
  amount: z.string().optional(),
  unit: z.string().optional(),
  name: z.string().min(1),
  notes: z.string().optional(),
});

export const stepSchema = z.object({
  id: z.string().optional(),
  order: z.number().int().min(0),
  instruction: z.string().min(1),
  timerSeconds: z.number().int().min(0).optional(),
  ingredientIds: z.array(z.string()).optional(),
});

export const recipeSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  prepTime: z.number().int().min(0).optional(),
  cookTime: z.number().int().min(0).optional(),
  totalTime: z.number().int().min(0).optional(),
  servings: z.number().int().min(1).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  cuisine: z.string().max(50).optional(),
  tags: z.array(z.string()).default([]),
  ingredients: z.array(ingredientSchema).default([]),
  steps: z.array(stepSchema).default([]),
  nutrition: z
    .object({
      calories: z.number().optional(),
      protein: z.number().optional(),
      carbs: z.number().optional(),
      fat: z.number().optional(),
      fiber: z.number().optional(),
    })
    .optional(),
  notes: z.string().max(2000).optional(),
  isFavorite: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  householdId: z.string().nullable().optional(),
});

export const importUrlSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
});

export const importTextSchema = z.object({
  text: z.string().min(20, "Please paste more recipe text"),
  title: z.string().max(200).optional(),
});

// ── Meal Plan ─────────────────────────────────────────────────────────────────

export const mealPlanItemSchema = z.object({
  recipeId: z.string().optional(),
  dayOfWeek: z.number().int().min(0).max(6),
  mealType: z.enum(["breakfast", "brunch", "lunch", "dinner", "snack", "dessert", "side"]),
  note: z.string().max(200).optional(),
  servings: z.number().int().min(1).optional(),
});

// ── Grocery ───────────────────────────────────────────────────────────────────

export const groceryItemSchema = z.object({
  name: z.string().min(1).max(200),
  amount: z.string().max(50).optional(),
  unit: z.string().max(50).optional(),
  category: z.string().max(50).optional(),
  notes: z.string().max(200).optional(),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RecipeInput = z.infer<typeof recipeSchema>;
export type IngredientInput = z.infer<typeof ingredientSchema>;
export type StepInput = z.infer<typeof stepSchema>;
export type MealPlanItemInput = z.infer<typeof mealPlanItemSchema>;
export type GroceryItemInput = z.infer<typeof groceryItemSchema>;
export type ImportTextInput = z.infer<typeof importTextSchema>;
