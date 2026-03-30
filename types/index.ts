export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: string;
  household?: {
    id: string;
    name: string;
    role: "owner" | "member";
    memberCount: number;
    memberLimit: number;
  } | null;
  _count?: { recipes: number };
}

export interface HouseholdMember {
  id: string;
  email: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  joinedAt: string;
  role: "owner" | "member";
}

export interface Household {
  id: string;
  name: string;
  role: "owner" | "member";
  memberCount: number;
  memberLimit: number;
  remainingSlots: number;
  createdAt: string;
  updatedAt: string;
  members: HouseholdMember[];
}

export interface Ingredient {
  id?: string;
  amount?: string;
  unit?: string;
  name: string;
  notes?: string;
}

export interface Step {
  id?: string;
  order: number;
  instruction: string;
  timerSeconds?: number;
  ingredientIds?: string[];
}

export interface Nutrition {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
}

export interface Recipe {
  id: string;
  userId: string;
  householdId?: string | null;
  user?: Pick<User, "id" | "username" | "displayName">;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  prepTime?: number | null;
  cookTime?: number | null;
  totalTime?: number | null;
  servings?: number | null;
  difficulty?: "easy" | "medium" | "hard" | null;
  cuisine?: string | null;
  tags: string[];
  ingredients: Ingredient[];
  steps: Step[];
  nutrition?: Nutrition | null;
  notes?: string | null;
  isFavorite: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeSummary {
  id: string;
  userId?: string;
  householdId?: string | null;
  user?: Pick<User, "id" | "username" | "displayName">;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  prepTime?: number | null;
  cookTime?: number | null;
  totalTime?: number | null;
  servings?: number | null;
  difficulty?: string | null;
  cuisine?: string | null;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MealPlanItem {
  id: string;
  mealPlanId: string;
  recipeId?: string | null;
  recipe?: Pick<Recipe, "id" | "title" | "imageUrl" | "totalTime" | "servings"> | null;
  dayOfWeek: number;
  mealType: string;
  note?: string | null;
  servings?: number | null;
  createdAt: string;
}

export interface MealPlan {
  id: string;
  userId: string;
  weekStart: string;
  items: MealPlanItem[];
  createdAt: string;
  updatedAt: string;
}

export interface GroceryItem {
  id: string;
  groceryListId: string;
  name: string;
  amount?: string | null;
  unit?: string | null;
  category?: string | null;
  notes?: string | null;
  isChecked: boolean;
  checkedAt?: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface GroceryList {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  items: GroceryItem[];
  createdAt: string;
  updatedAt: string;
  _count?: { items: number };
}

export interface CookingSession {
  id: string;
  userId: string;
  recipeId: string;
  recipe?: Recipe;
  currentStep: number;
  servingScale: number;
  isCompleted: boolean;
  startedAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}
