-- Additive only: steps without hours keep sending at any time.
ALTER TABLE "FollowUpStep" ADD COLUMN "sendWindowStartHour" INTEGER;
ALTER TABLE "FollowUpStep" ADD COLUMN "sendWindowEndHour" INTEGER;
ALTER TABLE "FollowUpStep" ADD COLUMN "sendWindowTimeZone" TEXT;
