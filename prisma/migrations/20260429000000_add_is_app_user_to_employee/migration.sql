-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "isAppUser" BOOLEAN NOT NULL DEFAULT false;

-- Mark existing app users in the Employee table so they are hidden from RESPONSABLE views.
-- These employees also hold a User account (ADMIN or RESPONSABLE role) and should not appear
-- in planning / recap / PQS lists for other RESPONSABLE users.
UPDATE "Employee"
SET "isAppUser" = true
WHERE (nom = 'BILLAND' AND prenom = 'Estelle')
   OR (nom = 'KONIOKO' AND prenom = 'Olivier')
   OR (nom = 'DIALLO' AND prenom = 'Aissatou')
   OR (nom = 'DIABIRA' AND prenom = 'Seckou')
   OR (nom = 'ZARGLAYOUNE' AND prenom = 'Medhi')
   OR (nom = 'LEBLANC' AND prenom = 'Pascal')
   OR (nom = 'MESSAOUDENE' AND prenom ILIKE 'M%hamed%')
   OR (nom = 'IZIDI' AND prenom = 'Logan')
   OR (nom = 'RAMDANI' AND prenom = 'Abdelhak')
   OR (nom = 'NARRAINEN' AND prenom = 'Nedy');
