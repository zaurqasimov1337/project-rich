-- CreateTable
CREATE TABLE "instagram_automations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mediaId" TEXT,
    "mediaCaption" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publicReply" TEXT,
    "dmMessage" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "lastMatchedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_comment_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "mediaId" TEXT,
    "automationId" TEXT,
    "fromUsername" TEXT,
    "text" TEXT,
    "repliedPublic" BOOLEAN NOT NULL DEFAULT false,
    "sentDm" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_comment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instagram_automations_tenantId_mediaId_idx" ON "instagram_automations"("tenantId", "mediaId");

-- CreateIndex
CREATE INDEX "instagram_comment_events_tenantId_automationId_idx" ON "instagram_comment_events"("tenantId", "automationId");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_comment_events_tenantId_commentId_key" ON "instagram_comment_events"("tenantId", "commentId");

