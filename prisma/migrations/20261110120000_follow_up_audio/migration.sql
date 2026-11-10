-- Additive only: steps without audio keep sending text as before.
ALTER TABLE "FollowUpStep" ADD COLUMN "audioUrl" TEXT;

CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MediaAsset_workspaceId_idx" ON "MediaAsset"("workspaceId");

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
