import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getBaseUrl } from "@/lib/env";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";
import {
  audioExtensionForMimeType,
  MAX_FOLLOW_UP_AUDIO_BYTES,
  resolveFollowUpAudioType,
} from "@/lib/campaigns/follow-up-audio";

export const dynamic = "force-dynamic";

/**
 * Upload a voice note for a follow-up step. Returns the public URL that the
 * step stores and that Instagram downloads when the step is sent.
 */
export async function POST(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: "Only owners and admins can upload audio" },
      { status: 403 }
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { success: false, error: "Attach an audio file" },
      { status: 400 }
    );
  }

  const type = resolveFollowUpAudioType(file.name);
  if (!type) {
    return NextResponse.json(
      {
        success: false,
        error: "Instagram accepts audio as m4a, aac, wav or mp4",
      },
      { status: 400 }
    );
  }
  if (file.size === 0 || file.size > MAX_FOLLOW_UP_AUDIO_BYTES) {
    return NextResponse.json(
      { success: false, error: "The audio must be under 4 MB" },
      { status: 400 }
    );
  }

  const data = Buffer.from(await file.arrayBuffer());
  const asset = await prisma.mediaAsset.create({
    data: {
      workspaceId: context.workspaceId,
      mimeType: type.mimeType,
      filename: file.name.slice(0, 200),
      size: data.length,
      data,
    },
    select: { id: true, mimeType: true, filename: true },
  });

  const url = `${getBaseUrl().replace(/\/$/, "")}/api/media/${asset.id}.${audioExtensionForMimeType(asset.mimeType)}`;
  return NextResponse.json({
    success: true,
    data: { id: asset.id, url, filename: asset.filename },
  });
}
