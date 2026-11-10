-- One delivery per person per audio: the voice note is not repeated when the
-- same person receives a second resource.
CREATE TABLE "FollowUpAudioDelivery" (
    "id" TEXT NOT NULL,
    "instagramBusinessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "automationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpAudioDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FollowUpAudioDelivery_instagramBusinessId_userId_audioUrl_key" ON "FollowUpAudioDelivery"("instagramBusinessId", "userId", "audioUrl");
