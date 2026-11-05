-- Additive only: existing campaigns keep their single follow-up unchanged.
CREATE TYPE "FollowUpCondition" AS ENUM ('ALWAYS', 'NOT_CLICKED', 'CLICKED');

CREATE TABLE "FollowUpStep" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "automationId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "delayMinutes" INTEGER NOT NULL,
  "message" TEXT NOT NULL,
  "condition" "FollowUpCondition" NOT NULL DEFAULT 'ALWAYS',
  "buttonLabel" TEXT,
  "buttonUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FollowUpStep_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "FollowUpStep_automationId_idx" ON "FollowUpStep"("automationId");

CREATE TABLE "ConversationActivity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "instagramBusinessId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastInboundAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ConversationActivity_instagramBusinessId_userId_key" ON "ConversationActivity"("instagramBusinessId", "userId");
