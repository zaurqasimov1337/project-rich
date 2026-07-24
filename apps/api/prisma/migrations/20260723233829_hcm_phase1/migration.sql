-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "address" TEXT,
ADD COLUMN     "birthDate" DATE,
ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "employeeNo" TEXT,
ADD COLUMN     "exemptionQepik" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hrStatus" TEXT NOT NULL DEFAULT 'aktiv',
ADD COLUMN     "idCardNumber" TEXT,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "pin" TEXT,
ADD COLUMN     "sector" TEXT NOT NULL DEFAULT 'private_nonoil',
ADD COLUMN     "unionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "workType" TEXT;

-- CreateTable
CREATE TABLE "employee_contracts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aktiv',
    "signedAt" DATE,
    "expiresAt" DATE,
    "approvedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_changes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "oldQepik" INTEGER NOT NULL,
    "newQepik" INTEGER NOT NULL,
    "reason" TEXT,
    "approvedBy" TEXT,
    "effectiveAt" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_contracts_tenantId_employeeId_idx" ON "employee_contracts"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "employee_contracts_tenantId_expiresAt_idx" ON "employee_contracts"("tenantId", "expiresAt");

-- CreateIndex
CREATE INDEX "salary_changes_tenantId_employeeId_idx" ON "salary_changes"("tenantId", "employeeId");

-- AddForeignKey
ALTER TABLE "employee_contracts" ADD CONSTRAINT "employee_contracts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_changes" ADD CONSTRAINT "salary_changes_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
