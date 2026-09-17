-- CreateEnum
CREATE TYPE "ResponsibleRelationship" AS ENUM ('PAI', 'MAE', 'OUTRO');

-- AlterTable
ALTER TABLE "ScfvUser" ADD COLUMN     "address" VARCHAR(200),
ADD COLUMN     "phone" VARCHAR(11);

-- CreateTable
CREATE TABLE "Responsible" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "phone" VARCHAR(11),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Responsible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildProfile" (
    "id" SERIAL NOT NULL,
    "scfvUserId" INTEGER NOT NULL,
    "responsibleId" INTEGER NOT NULL,
    "relationship" "ResponsibleRelationship" NOT NULL,
    "relationshipOther" VARCHAR(50),
    "school" VARCHAR(150),
    "grade" VARCHAR(50),
    "schoolClass" VARCHAR(50),
    "schoolAttendance" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElderlyProfile" (
    "id" SERIAL NOT NULL,
    "scfvUserId" INTEGER NOT NULL,
    "income" DECIMAL(10,2),
    "situation" VARCHAR(200),
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElderlyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Responsible_cpf_key" ON "Responsible"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "ChildProfile_scfvUserId_key" ON "ChildProfile"("scfvUserId");

-- CreateIndex
CREATE INDEX "ChildProfile_responsibleId_idx" ON "ChildProfile"("responsibleId");

-- CreateIndex
CREATE UNIQUE INDEX "ElderlyProfile_scfvUserId_key" ON "ElderlyProfile"("scfvUserId");

-- AddForeignKey
ALTER TABLE "ChildProfile" ADD CONSTRAINT "ChildProfile_scfvUserId_fkey" FOREIGN KEY ("scfvUserId") REFERENCES "ScfvUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildProfile" ADD CONSTRAINT "ChildProfile_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "Responsible"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElderlyProfile" ADD CONSTRAINT "ElderlyProfile_scfvUserId_fkey" FOREIGN KEY ("scfvUserId") REFERENCES "ScfvUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
