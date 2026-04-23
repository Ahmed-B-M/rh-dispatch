-- AlterTable
ALTER TABLE "AbsenceCode" ADD COLUMN "isWeekendInclusive" BOOLEAN NOT NULL DEFAULT false;

-- Seed known weekend-inclusive codes
UPDATE "AbsenceCode"
SET "isWeekendInclusive" = true
WHERE code IN (
  'Paternité',
  'Accident travail',
  'Maladie',
  'Mal. professionnelle',
  'Congés naissance',
  'Accident Trajet',
  'Mise à pied'
);
