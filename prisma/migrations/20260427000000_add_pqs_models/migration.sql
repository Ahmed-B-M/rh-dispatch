-- CreateTable
CREATE TABLE "PqsCriteria" (
    "id" TEXT NOT NULL,
    "posteConfigId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(8,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PqsCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PqsEvaluation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "validatedBy" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PqsEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PqsEvaluationItem" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "achieved" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,

    CONSTRAINT "PqsEvaluationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PqsCriteria_posteConfigId_idx" ON "PqsCriteria"("posteConfigId");

-- CreateIndex
CREATE INDEX "PqsEvaluation_employeeId_idx" ON "PqsEvaluation"("employeeId");

-- CreateIndex
CREATE INDEX "PqsEvaluation_year_month_idx" ON "PqsEvaluation"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PqsEvaluation_employeeId_year_month_key" ON "PqsEvaluation"("employeeId", "year", "month");

-- CreateIndex
CREATE INDEX "PqsEvaluationItem_evaluationId_idx" ON "PqsEvaluationItem"("evaluationId");

-- CreateIndex
CREATE INDEX "PqsEvaluationItem_criteriaId_idx" ON "PqsEvaluationItem"("criteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "PqsEvaluationItem_evaluationId_criteriaId_key" ON "PqsEvaluationItem"("evaluationId", "criteriaId");

-- AddForeignKey
ALTER TABLE "PqsCriteria" ADD CONSTRAINT "PqsCriteria_posteConfigId_fkey" FOREIGN KEY ("posteConfigId") REFERENCES "PosteConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PqsEvaluation" ADD CONSTRAINT "PqsEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PqsEvaluationItem" ADD CONSTRAINT "PqsEvaluationItem_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "PqsEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PqsEvaluationItem" ADD CONSTRAINT "PqsEvaluationItem_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "PqsCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
