-- Add support for multiple plans per (owner, class, room) with a default flag

-- Add isDefault column with default false
ALTER TABLE "SeatingPlan" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Drop unique constraint to allow multiple plans per context
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = ANY (current_schemas(false)) AND indexname = 'SeatingPlan_ownerProfileId_classId_roomId_key'
  ) THEN
    DROP INDEX "SeatingPlan_ownerProfileId_classId_roomId_key";
  END IF;
END $$;

-- Create a non-unique index for efficient lookups by context
CREATE INDEX IF NOT EXISTS "SeatingPlan_owner_class_room_idx" ON "SeatingPlan"("ownerProfileId", "classId", "roomId");

