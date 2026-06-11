/*
  Warnings:

  - You are about to drop the column `estado` on the `activos` table. All the data in the column will be lost.
  - You are about to drop the column `estadoAnterior` on the `ordenes_trabajo` table. All the data in the column will be lost.
  - You are about to drop the column `estadoNuevo` on the `ordenes_trabajo` table. All the data in the column will be lost.
  - Added the required column `cicloVidaNueva` to the `ordenes_trabajo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `disponibilidadNueva` to the `ordenes_trabajo` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CicloVida" AS ENUM ('OPERATIVO', 'DADO_DE_BAJA');

-- CreateEnum
CREATE TYPE "Disponibilidad" AS ENUM ('EN_SERVICIO', 'AVERIADO', 'FUERA_DE_SERVICIO');

-- CreateEnum
CREATE TYPE "ResultadoIntervencion" AS ENUM ('OPERATIVO', 'DEFECTUOSO', 'EN_DESCARGO');

-- DropIndex
DROP INDEX "activos_estado_idx";

-- AlterTable
ALTER TABLE "activos" DROP COLUMN "estado",
ADD COLUMN     "cicloVida" "CicloVida" NOT NULL DEFAULT 'OPERATIVO',
ADD COLUMN     "disponibilidad" "Disponibilidad" NOT NULL DEFAULT 'EN_SERVICIO';

-- AlterTable
ALTER TABLE "ordenes_trabajo" DROP COLUMN "estadoAnterior",
DROP COLUMN "estadoNuevo",
ADD COLUMN     "cicloVidaAnterior" "CicloVida",
ADD COLUMN     "cicloVidaNueva" "CicloVida" NOT NULL,
ADD COLUMN     "disponibilidadAnterior" "Disponibilidad",
ADD COLUMN     "disponibilidadNueva" "Disponibilidad" NOT NULL,
ADD COLUMN     "resultadoIntervencion" "ResultadoIntervencion";

-- DropEnum
DROP TYPE "EstadoActivo";

-- CreateIndex
CREATE INDEX "activos_cicloVida_idx" ON "activos"("cicloVida");

-- CreateIndex
CREATE INDEX "activos_disponibilidad_idx" ON "activos"("disponibilidad");
