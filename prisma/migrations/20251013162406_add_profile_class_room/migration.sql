-- DropForeignKey
ALTER TABLE "ProfileClassRoom" DROP CONSTRAINT "ProfileClassRoom_classId_fkey";

-- DropForeignKey
ALTER TABLE "ProfileClassRoom" DROP CONSTRAINT "ProfileClassRoom_profileId_fkey";

-- DropForeignKey
ALTER TABLE "ProfileClassRoom" DROP CONSTRAINT "ProfileClassRoom_roomId_fkey";

-- DropIndex
DROP INDEX "SeatingPlan_owner_class_room_idx";

-- AddForeignKey
ALTER TABLE "ProfileClassRoom" ADD CONSTRAINT "ProfileClassRoom_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileClassRoom" ADD CONSTRAINT "ProfileClassRoom_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileClassRoom" ADD CONSTRAINT "ProfileClassRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
