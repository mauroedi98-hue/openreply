import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ prisma: {} }));
vi.mock("@/lib/queue/client", () => ({
  FOLLOWUP_STEP_JOB_NAME: "process-followup-step",
  getDMQueue: vi.fn(),
}));

import {
  canWaitForSendWindow,
  clampFollowUpDelayMinutes,
  followUpSendWindowDelayMs,
  followUpStepSkipReason,
  MAX_FOLLOW_UP_STEP_DELAY_MINUTES,
  resolveFollowUpButton,
} from "../lib/queue/follow-up-sequence";

const START = 1_800_000_000_000;
const MIN = 60_000;

describe("followUpStepSkipReason", () => {
  const base = {
    condition: "ALWAYS" as const,
    startedAt: START,
    now: START + 30 * MIN,
    lastInboundAt: null,
    clicked: false,
  };

  it("sends when nothing stops it", () => {
    expect(followUpStepSkipReason(base)).toBeNull();
  });

  it("stops when the person wrote after the link was delivered", () => {
    expect(
      followUpStepSkipReason({ ...base, lastInboundAt: START + MIN })
    ).toBe("replied");
  });

  it("ignores a message sent before the link (the keyword itself)", () => {
    expect(
      followUpStepSkipReason({ ...base, lastInboundAt: START - MIN })
    ).toBeNull();
  });

  it("stops at the 24-hour window", () => {
    expect(
      followUpStepSkipReason({ ...base, now: START + 24 * 60 * MIN })
    ).toBe("window_closed");
  });

  it("applies the click conditions", () => {
    expect(
      followUpStepSkipReason({ ...base, condition: "CLICKED", clicked: false })
    ).toBe("condition");
    expect(
      followUpStepSkipReason({ ...base, condition: "CLICKED", clicked: true })
    ).toBeNull();
    expect(
      followUpStepSkipReason({ ...base, condition: "NOT_CLICKED", clicked: true })
    ).toBe("condition");
    expect(
      followUpStepSkipReason({ ...base, condition: "NOT_CLICKED", clicked: false })
    ).toBeNull();
  });
});

describe("followUpSendWindowDelayMs (Bogotá is UTC-5, no DST)", () => {
  const window = { startHour: 8, endHour: 19, timeZone: "America/Bogota" };
  // 2026-11-06 at a given Bogotá hour, expressed in UTC.
  const bogota = (hour: number, minute = 0) =>
    Date.UTC(2026, 10, 6, hour + 5, minute);

  it("sends right away inside the hours", () => {
    expect(followUpSendWindowDelayMs({ ...window, at: bogota(10) })).toBe(0);
    expect(followUpSendWindowDelayMs({ ...window, at: bogota(8) })).toBe(0);
  });

  it("waits until the morning when it fires before opening", () => {
    expect(followUpSendWindowDelayMs({ ...window, at: bogota(3, 30) })).toBe(
      (4 * 60 + 30) * MIN
    );
  });

  it("waits until the next morning when it fires after closing", () => {
    expect(followUpSendWindowDelayMs({ ...window, at: bogota(19) })).toBe(
      13 * 60 * MIN
    );
    expect(followUpSendWindowDelayMs({ ...window, at: bogota(22, 15) })).toBe(
      (9 * 60 + 45) * MIN
    );
  });

  it("has no hours when they are not set or make no sense", () => {
    expect(
      followUpSendWindowDelayMs({
        at: bogota(3),
        startHour: null,
        endHour: null,
        timeZone: null,
      })
    ).toBe(0);
    expect(
      followUpSendWindowDelayMs({
        at: bogota(3),
        startHour: 19,
        endHour: 8,
        timeZone: "America/Bogota",
      })
    ).toBe(0);
  });

  it("falls back to Bogotá for an unknown time zone", () => {
    expect(
      followUpSendWindowDelayMs({ ...window, timeZone: "Mars/Base", at: bogota(3, 30) })
    ).toBe((4 * 60 + 30) * MIN);
  });
});

describe("canWaitForSendWindow", () => {
  it("only waits while it stays inside the 24-hour window", () => {
    expect(
      canWaitForSendWindow({ now: START + 6 * 60 * MIN, startedAt: START, delayMs: 9 * 60 * MIN })
    ).toBe(true);
    expect(
      canWaitForSendWindow({ now: START + 20 * 60 * MIN, startedAt: START, delayMs: 4 * 60 * MIN })
    ).toBe(false);
  });
});

describe("clampFollowUpDelayMinutes", () => {
  it("keeps delays inside the window", () => {
    expect(clampFollowUpDelayMinutes(-5)).toBe(0);
    expect(clampFollowUpDelayMinutes(240)).toBe(240);
    expect(clampFollowUpDelayMinutes(5000)).toBe(
      MAX_FOLLOW_UP_STEP_DELAY_MINUTES
    );
    expect(clampFollowUpDelayMinutes(Number.NaN)).toBe(0);
  });
});

describe("resolveFollowUpButton", () => {
  const trackedLinks = [
    { slug: "slug_kit", destinationUrl: "https://kit.cerebrosia.com" },
  ];

  it("has no button without both a label and a link", () => {
    expect(
      resolveFollowUpButton({
        buttonLabel: "Ver el kit",
        buttonUrl: null,
        trackedLinks,
        recipientToken: "tok",
      })
    ).toBeNull();
    expect(
      resolveFollowUpButton({
        buttonLabel: " ",
        buttonUrl: "https://kit.cerebrosia.com",
        trackedLinks,
        recipientToken: "tok",
      })
    ).toBeNull();
  });

  it("sends a campaign link as its tracked link, so the click counts", () => {
    expect(
      resolveFollowUpButton({
        buttonLabel: "Ver el kit",
        buttonUrl: "https://kit.cerebrosia.com/",
        trackedLinks,
        recipientToken: "tok",
        baseUrl: "https://openreply.example",
      })
    ).toEqual({
      title: "Ver el kit",
      url: "https://openreply.example/r/slug_kit?r=tok",
    });
  });

  it("sends any other link as is and trims the label to 20 characters", () => {
    expect(
      resolveFollowUpButton({
        buttonLabel: "Escríbeme por WhatsApp ahora",
        buttonUrl: "https://wa.me/573165373306?text=KIT",
        trackedLinks,
        recipientToken: "tok",
      })
    ).toEqual({
      title: "Escríbeme por WhatsA",
      url: "https://wa.me/573165373306?text=KIT",
    });
  });
});
