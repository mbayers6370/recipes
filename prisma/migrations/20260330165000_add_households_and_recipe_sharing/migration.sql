CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "household_members" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "recipes"
ADD COLUMN "household_id" TEXT;

CREATE UNIQUE INDEX "household_members_user_id_key" ON "household_members"("user_id");
CREATE UNIQUE INDEX "household_members_household_id_user_id_key" ON "household_members"("household_id", "user_id");

CREATE INDEX "households_owner_id_idx" ON "households"("owner_id");
CREATE INDEX "household_members_household_id_idx" ON "household_members"("household_id");
CREATE INDEX "recipes_household_id_idx" ON "recipes"("household_id");

ALTER TABLE "households"
ADD CONSTRAINT "households_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "household_members"
ADD CONSTRAINT "household_members_household_id_fkey"
FOREIGN KEY ("household_id") REFERENCES "households"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "household_members"
ADD CONSTRAINT "household_members_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipes"
ADD CONSTRAINT "recipes_household_id_fkey"
FOREIGN KEY ("household_id") REFERENCES "households"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
