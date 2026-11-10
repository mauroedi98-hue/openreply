import { describe, expect, it } from "vitest";
import {
  audioExtensionForMimeType,
  mediaIdFromPathSegment,
  resolveFollowUpAudioType,
} from "@/lib/campaigns/follow-up-audio";

describe("follow-up voice notes", () => {
  it("accepts the formats Instagram can send as audio", () => {
    expect(resolveFollowUpAudioType("hola.m4a")).toEqual({
      extension: "m4a",
      mimeType: "audio/mp4",
    });
    expect(resolveFollowUpAudioType("Nota de voz.WAV")?.mimeType).toBe("audio/wav");
    expect(resolveFollowUpAudioType("clip.aac")?.mimeType).toBe("audio/aac");
    expect(resolveFollowUpAudioType("clip.mp4")?.mimeType).toBe("audio/mp4");
  });

  it("rejects formats Instagram does not accept", () => {
    expect(resolveFollowUpAudioType("voz.mp3")).toBeNull();
    expect(resolveFollowUpAudioType("voz.ogg")).toBeNull();
    expect(resolveFollowUpAudioType("sin-extension")).toBeNull();
  });

  it("builds and reads the public media path", () => {
    expect(audioExtensionForMimeType("audio/mp4")).toBe("m4a");
    expect(audioExtensionForMimeType("audio/wav")).toBe("wav");
    expect(mediaIdFromPathSegment("cm1abc.m4a")).toBe("cm1abc");
    expect(mediaIdFromPathSegment("cm1abc")).toBe("cm1abc");
  });
});
