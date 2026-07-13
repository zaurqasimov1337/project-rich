-- AlterTable
ALTER TABLE "lead_activities" ADD COLUMN     "meta" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "askedDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "askedPrice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "assignedTo" TEXT,
ADD COLUMN     "budgetOk" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "callAnswered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "closedBy" TEXT,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "currentField" TEXT,
ADD COLUMN     "educationStatus" TEXT,
ADD COLUMN     "followupCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "lastContactAt" TIMESTAMP(3),
ADD COLUMN     "leadNo" INTEGER,
ADD COLUMN     "nextFollowupAt" TIMESTAMP(3),
ADD COLUMN     "notResponding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "objectionReason" TEXT,
ADD COLUMN     "parentInvolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passive7d" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'cold',
ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sourceKey" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'yeni_lead';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "leadId" TEXT;

-- CreateTable
CREATE TABLE "followups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "followups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "followups_tenantId_leadId_idx" ON "followups"("tenantId", "leadId");

-- CreateIndex
CREATE INDEX "followups_tenantId_isDone_dueAt_idx" ON "followups"("tenantId", "isDone", "dueAt");

-- CreateIndex
CREATE INDEX "leads_tenantId_status_idx" ON "leads"("tenantId", "status");

-- CreateIndex
CREATE INDEX "leads_tenantId_priority_idx" ON "leads"("tenantId", "priority");

-- CreateIndex
CREATE INDEX "leads_tenantId_assignedTo_idx" ON "leads"("tenantId", "assignedTo");

-- CreateIndex
CREATE INDEX "leads_tenantId_phone_idx" ON "leads"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "leads_tenantId_nextFollowupAt_idx" ON "leads"("tenantId", "nextFollowupAt");

-- CreateIndex
CREATE INDEX "leads_tenantId_createdAt_idx" ON "leads"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "tasks_tenantId_leadId_idx" ON "tasks"("tenantId", "leadId");

-- AddForeignKey
ALTER TABLE "followups" ADD CONSTRAINT "followups_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
