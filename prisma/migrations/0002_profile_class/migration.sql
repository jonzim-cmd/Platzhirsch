-- CreateTable
CREATE TABLE "ProfileClass" (
    "profileId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,

    CONSTRAINT "ProfileClass_pkey" PRIMARY KEY ("profileId","classId")
);

-- AddForeignKey
ALTER TABLE "ProfileClass" ADD CONSTRAINT "ProfileClass_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileClass" ADD CONSTRAINT "ProfileClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

