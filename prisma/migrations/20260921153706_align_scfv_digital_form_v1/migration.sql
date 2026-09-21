/*
  Ficha Digital SCFV v1

  Alterações principais:

  - Remove schoolClass e schoolAttendance de ChildProfile.
  - Remove ElderlyProfile.
  - Preserva as observações existentes dos idosos,
    transferindo-as para ScfvUser.observations.
  - Adiciona os campos aprovados da ficha digital.
*/

-- CreateEnum
CREATE TYPE "Sex" AS ENUM (
  'MALE',
  'FEMALE'
);

-- CreateEnum
CREATE TYPE "ActivityShift" AS ENUM (
  'MORNING',
  'AFTERNOON'
);

-- CreateEnum
CREATE TYPE "PriorityReason" AS ENUM (
  'ISOLATION',
  'CHILD_LABOR',
  'VIOLENCE_OR_NEGLECT',
  'OUT_OF_SCHOOL_OR_GRADE_DELAY',
  'INSTITUTIONAL_CARE',
  'SOCIOEDUCATIONAL_MEASURE',
  'SEXUAL_ABUSE_OR_EXPLOITATION',
  'ECA_PROTECTION_MEASURES',
  'STREET_SITUATION',
  'DISABILITY_VULNERABILITY'
);

-- AlterEnum
ALTER TYPE "ResponsibleRelationship"
ADD VALUE 'SEM_PARENTESCO';

-- Novos campos da ficha infantil
ALTER TABLE "ChildProfile"
DROP COLUMN "schoolAttendance",
DROP COLUMN "schoolClass",
ADD COLUMN "familyNis" VARCHAR(11),
ADD COLUMN "familyResponsibleName" VARCHAR(150),
ADD COLUMN "fatherName" VARCHAR(150),
ADD COLUMN "motherName" VARCHAR(150),
ADD COLUMN "receivesBolsaFamilia" BOOLEAN,
ADD COLUMN "schoolShift" VARCHAR(50);

-- Novos campos gerais da Ficha Digital SCFV
ALTER TABLE "ScfvUser"
ADD COLUMN "activityShift" "ActivityShift",
ADD COLUMN "allergyDetails" VARCHAR(200),
ADD COLUMN "birthplace" VARCHAR(120),
ADD COLUMN "disabilityDetails" VARCHAR(200),
ADD COLUMN "educationNotes" VARCHAR(200),
ADD COLUMN "familyMembersInfo" TEXT,
ADD COLUMN "hasAllergy" BOOLEAN,
ADD COLUMN "hasDisability" BOOLEAN,
ADD COLUMN "identityNumber" VARCHAR(30),
ADD COLUMN "isLiterate" BOOLEAN,
ADD COLUMN "isPriority" BOOLEAN,
ADD COLUMN "neighborhood" VARCHAR(100),
ADD COLUMN "observations" TEXT,
ADD COLUMN "otherServiceDetails" VARCHAR(200),
ADD COLUMN "participatesOtherService" BOOLEAN,
ADD COLUMN "priorityReasons" "PriorityReason"[]
  DEFAULT ARRAY[]::"PriorityReason"[],
ADD COLUMN "receivesBpc" BOOLEAN,
ADD COLUMN "referencePoint" VARCHAR(200),
ADD COLUMN "referralDate" DATE,
ADD COLUMN "referralDocumentNumber" VARCHAR(30),
ADD COLUMN "referralDocumentType" VARCHAR(30),
ADD COLUMN "referralOriginAgency" VARCHAR(150),
ADD COLUMN "sex" "Sex",
ADD COLUMN "zipCode" VARCHAR(8);

-- Preserva as observações que já estavam
-- cadastradas no antigo perfil de idosos.
UPDATE "ScfvUser"
SET "observations" = "ElderlyProfile"."observations"
FROM "ElderlyProfile"
WHERE
  "ElderlyProfile"."scfvUserId" = "ScfvUser"."id"
  AND "ElderlyProfile"."observations" IS NOT NULL;

-- Remove a relação do antigo perfil de idosos.
ALTER TABLE "ElderlyProfile"
DROP CONSTRAINT "ElderlyProfile_scfvUserId_fkey";

-- ElderlyProfile deixa de existir na Ficha Digital SCFV v1.
DROP TABLE "ElderlyProfile";