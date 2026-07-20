-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('SERVICE', 'SUPPLY', 'RENTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "additionalFees" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BRL',
ADD COLUMN     "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "type" "ContractType" NOT NULL DEFAULT 'OTHER';

ALTER TABLE "Contract" ALTER COLUMN "type" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ContractApprovalRevision" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "ContractApprovalRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractApprovalRevision_contractId_submittedAt_idx" ON "ContractApprovalRevision"("contractId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractApprovalRevision_contractId_version_key" ON "ContractApprovalRevision"("contractId", "version");

-- CreateIndex
CREATE INDEX "Contract_type_idx" ON "Contract"("type");

-- CreateIndex
CREATE INDEX "Contract_approvalStatus_idx" ON "Contract"("approvalStatus");

-- AddForeignKey
ALTER TABLE "ContractApprovalRevision" ADD CONSTRAINT "ContractApprovalRevision_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
