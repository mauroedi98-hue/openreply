/**
 * Voice notes for follow-up steps. Instagram's Send API accepts audio as
 * aac, m4a, wav or mp4 (up to 25 MB), but an upload goes through a Vercel
 * function whose request body is capped near 4.5 MB, so files stay under 4 MB.
 */
export const MAX_FOLLOW_UP_AUDIO_BYTES = 4 * 1024 * 1024;

/** Accepted extensions and the content type each one is served with. */
const AUDIO_TYPES: Record<string, string> = {
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  mp4: "audio/mp4",
};

/** The `accept` attribute for the upload input. */
export const FOLLOW_UP_AUDIO_ACCEPT = ".m4a,.aac,.wav,.mp4,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav";

function extensionOf(filename: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename.trim());
  return match ? match[1].toLowerCase() : "";
}

/**
 * The extension and content type to store for an uploaded file, or null when
 * Instagram would not accept it (an mp3, for example). The file name decides;
 * browsers report m4a/aac with inconsistent MIME types.
 */
export function resolveFollowUpAudioType(
  filename: string
): { extension: string; mimeType: string } | null {
  const extension = extensionOf(filename);
  const mimeType = AUDIO_TYPES[extension];
  return mimeType ? { extension, mimeType } : null;
}

/** Extension used in the public URL of a stored audio asset. */
export function audioExtensionForMimeType(mimeType: string): string {
  if (mimeType === "audio/aac") return "aac";
  if (mimeType === "audio/wav") return "wav";
  return "m4a";
}

/** Asset id from a public media path segment such as "abc123.m4a". */
export function mediaIdFromPathSegment(segment: string): string {
  return segment.replace(/\.[a-z0-9]+$/i, "");
}
