-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('NORMAL', 'ADHOC');

-- CreateEnum
CREATE TYPE "ElementType" AS ENUM ('STUDENT', 'TEACHER_DESK', 'DOOR', 'WINDOW_SIDE', 'WALL_SIDE');

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leadProfileId" TEXT,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RoomType" NOT NULL DEFAULT 'NORMAL',

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "foreName" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatingPlan" (
    "id" TEXT NOT NULL,
    "ownerProfileId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "sourcePlanId" TEXT,
    "title" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatingElement" (
    "id" TEXT NOT NULL,
    "seatingPlanId" TEXT NOT NULL,
    "type" "ElementType" NOT NULL,
    "refId" TEXT,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "w" DOUBLE PRECISION NOT NULL,
    "h" DOUBLE PRECISION NOT NULL,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "z" INTEGER NOT NULL DEFAULT 0,
    "groupId" TEXT,
    "meta" JSONB,

    CONSTRAINT "SeatingElement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_name_key" ON "Profile"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Class_name_key" ON "Class"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Room_name_key" ON "Room"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Student_externalKey_key" ON "Student"("externalKey");

-- CreateIndex
CREATE UNIQUE INDEX "SeatingPlan_ownerProfileId_classId_roomId_key" ON "SeatingPlan"("ownerProfileId", "classId", "roomId");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_leadProfileId_fkey" FOREIGN KEY ("leadProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatingPlan" ADD CONSTRAINT "SeatingPlan_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatingPlan" ADD CONSTRAINT "SeatingPlan_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatingPlan" ADD CONSTRAINT "SeatingPlan_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatingPlan" ADD CONSTRAINT "SeatingPlan_sourcePlanId_fkey" FOREIGN KEY ("sourcePlanId") REFERENCES "SeatingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatingElement" ADD CONSTRAINT "SeatingElement_seatingPlanId_fkey" FOREIGN KEY ("seatingPlanId") REFERENCES "SeatingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

