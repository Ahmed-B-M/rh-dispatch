-- AlterTable
ALTER TABLE "User" ADD COLUMN "allowedPages" TEXT[] DEFAULT ARRAY[]::TEXT[];
