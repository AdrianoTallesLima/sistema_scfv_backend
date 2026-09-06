-- CreateEnum
CREATE TYPE "ScfvActivity" AS ENUM ('SCFV_0_6', 'SCFV_7_15', 'SCFV_IDOSOS');

-- CreateEnum
CREATE TYPE "DeactivationType" AS ENUM ('MANUAL', 'AGE_LIMIT');

-- CreateTable
CREATE TABLE "ScfvUser" (
    "id" SERIAL NOT NULL,
    "activity" "ScfvActivity" NOT NULL,
    "name" TEXT NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "nis" VARCHAR(11),
    "birthDate" DATE NOT NULL,
    "photoPath" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deactivationType" "DeactivationType",
    "inactiveReason" VARCHAR(100),
    "inactiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER,

    CONSTRAINT "ScfvUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScfvUser_cpf_key" ON "ScfvUser"("cpf");

-- CreateIndex
CREATE INDEX "ScfvUser_active_activity_idx" ON "ScfvUser"("active", "activity");

-- AddForeignKey
ALTER TABLE "ScfvUser" ADD CONSTRAINT "ScfvUser_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScfvUser" ADD CONSTRAINT "ScfvUser_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
