-- Create mapping table for server-side class→room assignments per profile
CREATE TABLE IF NOT EXISTS "ProfileClassRoom" (
  "profileId" TEXT NOT NULL,
  "classId"   TEXT NOT NULL,
  "roomId"    TEXT NOT NULL,
  CONSTRAINT "ProfileClassRoom_pkey" PRIMARY KEY ("profileId", "classId", "roomId")
);

-- Foreign keys
ALTER TABLE "ProfileClassRoom"
  ADD CONSTRAINT "ProfileClassRoom_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "ProfileClassRoom"
  ADD CONSTRAINT "ProfileClassRoom_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "Class"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "ProfileClassRoom"
  ADD CONSTRAINT "ProfileClassRoom_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON UPDATE CASCADE ON DELETE CASCADE;

