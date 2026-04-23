-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('CDI', 'CDD', 'ALTERNANCE');

-- CreateEnum
CREATE TYPE "EmployeeCategory" AS ENUM ('SEDENTAIRE', 'TRANSPORT', 'LOGISTIQUE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'RESPONSABLE');

-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('MANUAL', 'IMPORT_EXCEL');

-- CreateTable
CREATE TABLE "AbsenceCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isWork" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AbsenceCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "typeContrat" "ContractType" NOT NULL,
    "categorie" "EmployeeCategory" NOT NULL,
    "poste" TEXT NOT NULL,
    "affectationCode" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "dateEntree" TIMESTAMP(3) NOT NULL,
    "dateSortie" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "photoUrl" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSite" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "EmployeeSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "dayName" TEXT NOT NULL,
    "affectation" TEXT,
    "typeContrat" "ContractType" NOT NULL,
    "matricule" TEXT NOT NULL,
    "nomConducteur" TEXT NOT NULL,
    "posteOccupe" TEXT,
    "absenceCodeId" TEXT,
    "heureDebut" TEXT,
    "heureFin" TEXT,
    "tempsTravail" TEXT,
    "heuresDecimales" DECIMAL(5,2),
    "vehicleId" TEXT,
    "typeRoute" TEXT,
    "nbKm" DECIMAL(8,2),
    "source" "EntrySource" NOT NULL DEFAULT 'MANUAL',
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "WorkEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rowsTotal" INTEGER NOT NULL,
    "rowsImported" INTEGER NOT NULL,
    "rowsSkipped" INTEGER NOT NULL,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'RESPONSABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "UserSite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceCode_code_key" ON "AbsenceCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Site_code_key" ON "Site"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_registration_key" ON "Vehicle"("registration");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_matricule_key" ON "Employee"("matricule");

-- CreateIndex
CREATE INDEX "Employee_matricule_idx" ON "Employee"("matricule");

-- CreateIndex
CREATE INDEX "Employee_isActive_idx" ON "Employee"("isActive");

-- CreateIndex
CREATE INDEX "Employee_categorie_idx" ON "Employee"("categorie");

-- CreateIndex
CREATE INDEX "EmployeeSite_employeeId_idx" ON "EmployeeSite"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeSite_siteId_idx" ON "EmployeeSite"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSite_employeeId_siteId_startDate_key" ON "EmployeeSite"("employeeId", "siteId", "startDate");

-- CreateIndex
CREATE INDEX "WorkEntry_date_idx" ON "WorkEntry"("date");

-- CreateIndex
CREATE INDEX "WorkEntry_employeeId_idx" ON "WorkEntry"("employeeId");

-- CreateIndex
CREATE INDEX "WorkEntry_matricule_idx" ON "WorkEntry"("matricule");

-- CreateIndex
CREATE INDEX "WorkEntry_weekNumber_idx" ON "WorkEntry"("weekNumber");

-- CreateIndex
CREATE INDEX "WorkEntry_absenceCodeId_idx" ON "WorkEntry"("absenceCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkEntry_employeeId_date_key" ON "WorkEntry"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserSite_userId_idx" ON "UserSite"("userId");

-- CreateIndex
CREATE INDEX "UserSite_siteId_idx" ON "UserSite"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSite_userId_siteId_key" ON "UserSite"("userId", "siteId");

-- AddForeignKey
ALTER TABLE "EmployeeSite" ADD CONSTRAINT "EmployeeSite_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSite" ADD CONSTRAINT "EmployeeSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkEntry" ADD CONSTRAINT "WorkEntry_absenceCodeId_fkey" FOREIGN KEY ("absenceCodeId") REFERENCES "AbsenceCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkEntry" ADD CONSTRAINT "WorkEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkEntry" ADD CONSTRAINT "WorkEntry_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSite" ADD CONSTRAINT "UserSite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSite" ADD CONSTRAINT "UserSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
