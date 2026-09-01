/*
  Warnings:

  - The values [ATENDENTE] on the enum `PerfilUsuario` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PerfilUsuario_new" AS ENUM ('ADMIN', 'ORIENTADOR');
ALTER TABLE "public"."Usuario" ALTER COLUMN "perfil" DROP DEFAULT;
ALTER TABLE "Usuario" ALTER COLUMN "perfil" TYPE "PerfilUsuario_new" USING ("perfil"::text::"PerfilUsuario_new");
ALTER TYPE "PerfilUsuario" RENAME TO "PerfilUsuario_old";
ALTER TYPE "PerfilUsuario_new" RENAME TO "PerfilUsuario";
DROP TYPE "public"."PerfilUsuario_old";
ALTER TABLE "Usuario" ALTER COLUMN "perfil" SET DEFAULT 'ORIENTADOR';
COMMIT;

-- AlterTable
ALTER TABLE "Usuario" ALTER COLUMN "perfil" SET DEFAULT 'ORIENTADOR';

-- CreateTable
CREATE TABLE "session" (
    "sid" TEXT NOT NULL,
    "sess" JSONB NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE INDEX "IDX_session_expire" ON "session"("expire");
