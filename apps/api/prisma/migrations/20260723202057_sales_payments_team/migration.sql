-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "budgetMatch" TEXT,
ADD COLUMN     "callStatus" TEXT,
ADD COLUMN     "courseStartDate" TIMESTAMP(3),
ADD COLUMN     "demoStatus" TEXT,
ADD COLUMN     "discountPct" INTEGER,
ADD COLUMN     "firstContactChannel" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentPlan" TEXT,
ADD COLUMN     "paymentStatus" TEXT,
ADD COLUMN     "registrationStatus" TEXT,
ADD COLUMN     "remarketingStatus" TEXT;

-- CreateTable
CREATE TABLE "lead_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "trainingId" TEXT,
    "amountDue" INTEGER NOT NULL DEFAULT 0,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "monthlyAmount" INTEGER,
    "paidAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'gozleyir',
    "method" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_manager_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bonusRate" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_manager_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_payments_tenantId_leadId_idx" ON "lead_payments"("tenantId", "leadId");

-- CreateIndex
CREATE INDEX "lead_payments_tenantId_status_idx" ON "lead_payments"("tenantId", "status");

-- CreateIndex
CREATE INDEX "lead_payments_tenantId_nextDueAt_idx" ON "lead_payments"("tenantId", "nextDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "sales_manager_profiles_tenantId_userId_key" ON "sales_manager_profiles"("tenantId", "userId");

-- AddForeignKey
ALTER TABLE "lead_payments" ADD CONSTRAINT "lead_payments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
