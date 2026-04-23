-- CreateTable
CREATE TABLE "PosteConfig" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "mealAllowance" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosteConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PosteConfig_label_key" ON "PosteConfig"("label");
