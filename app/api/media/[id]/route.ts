import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { mediaIdFromPathSegment } from "@/lib/campaigns/follow-up-audio";

type RouteProps = { params: Promise<{ id: string }> };

/**
 * Serve an uploaded voice note. Public on purpose: Instagram fetches the file
 * from this URL when a follow-up step is sent. Ids are unguessable cuids and
 * a stored file never changes, so it can be cached for good.
 */
export async function GET(_request: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: mediaIdFromPathSegment(id) },
    select: { data: true, mimeType: true, size: true },
  });
  if (!asset) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
