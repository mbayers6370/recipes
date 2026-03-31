-- CreateTable
CREATE TABLE "household_plans" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_plan_items" (
    "id" TEXT NOT NULL,
    "household_plan_id" TEXT NOT NULL,
    "recipe_id" TEXT,
    "created_by_user_id" TEXT,
    "day_of_week" INTEGER NOT NULL,
    "meal_type" TEXT NOT NULL,
    "note" TEXT,
    "servings" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_ideas" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "proposed_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_idea_votes" (
    "id" TEXT NOT NULL,
    "household_idea_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_idea_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "household_plans_household_id_idx" ON "household_plans"("household_id");

-- CreateIndex
CREATE UNIQUE INDEX "household_plans_household_id_week_start_key" ON "household_plans"("household_id", "week_start");

-- CreateIndex
CREATE INDEX "household_plan_items_household_plan_id_idx" ON "household_plan_items"("household_plan_id");

-- CreateIndex
CREATE INDEX "household_plan_items_created_by_user_id_idx" ON "household_plan_items"("created_by_user_id");

-- CreateIndex
CREATE INDEX "household_ideas_household_id_idx" ON "household_ideas"("household_id");

-- CreateIndex
CREATE INDEX "household_ideas_proposed_by_user_id_idx" ON "household_ideas"("proposed_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "household_ideas_household_id_recipe_id_key" ON "household_ideas"("household_id", "recipe_id");

-- CreateIndex
CREATE INDEX "household_idea_votes_user_id_idx" ON "household_idea_votes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "household_idea_votes_household_idea_id_user_id_key" ON "household_idea_votes"("household_idea_id", "user_id");

-- AddForeignKey
ALTER TABLE "household_plans" ADD CONSTRAINT "household_plans_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_plan_items" ADD CONSTRAINT "household_plan_items_household_plan_id_fkey" FOREIGN KEY ("household_plan_id") REFERENCES "household_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_plan_items" ADD CONSTRAINT "household_plan_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_plan_items" ADD CONSTRAINT "household_plan_items_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_ideas" ADD CONSTRAINT "household_ideas_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_ideas" ADD CONSTRAINT "household_ideas_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_ideas" ADD CONSTRAINT "household_ideas_proposed_by_user_id_fkey" FOREIGN KEY ("proposed_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_idea_votes" ADD CONSTRAINT "household_idea_votes_household_idea_id_fkey" FOREIGN KEY ("household_idea_id") REFERENCES "household_ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_idea_votes" ADD CONSTRAINT "household_idea_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
