-- Add the derived subtotal as nullable while existing contracts are backfilled.
ALTER TABLE "Contract" ADD COLUMN "subtotal" DECIMAL(12,2);

CREATE TABLE "ContractItem" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractItem_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ContractItem" ("id", "contractId", "description", "quantity", "unitPrice")
SELECT gen_random_uuid()::text, "id", 'Item migrado', 1.000, "value"
FROM "Contract";

UPDATE "Contract" SET "subtotal" = "value";
ALTER TABLE "Contract" ALTER COLUMN "subtotal" SET NOT NULL;

CREATE INDEX "ContractItem_contractId_idx" ON "ContractItem"("contractId");
ALTER TABLE "ContractItem" ADD CONSTRAINT "ContractItem_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
