import { prisma } from "@/lib/db/client";
import { buildTrackedUrl } from "@/lib/tracking/message";
import {
  DEFAULT_SEND_WINDOW_TIME_ZONE,
  FOLLOW_UP_WINDOW_MS,
  MAX_FOLLOW_UP_STEP_DELAY_MINUTES,
} from "@/lib/campaigns/follow-up-limits";
import { FOLLOWUP_STEP_JOB_NAME, getDMQueue } from "./client";

export {
  DEFAULT_SEND_WINDOW_TIME_ZONE,
  FOLLOW_UP_WINDOW_MS,
  MAX_FOLLOW_UP_STEP_DELAY_MINUTES,
  MAX_FOLLOW_UP_STEPS,
} from "@/lib/campaigns/follow-up-limits";

const DAY_MS = 24 * 60 * 60 * 1000;

export type FollowUpConditionValue = "ALWAYS" | "NOT_CLICKED" | "CLICKED";

export type FollowUpSkipReason = "replied" | "window_closed" | "condition";

/**
 * Decide, when a step fires, whether it should still be sent.
 * - "replied": the person wrote back after the sequence started, so a human
 *   (or another bot) has the conversation now.
 * - "window_closed": more than 24 h since the link was delivered.
 * - "condition": the click condition no longer matches.
 */
export function followUpStepSkipReason({
  condition,
  startedAt,
  now,
  lastInboundAt,
  clicked,
}: {
  condition: FollowUpConditionValue;
  startedAt: number;
  now: number;
  lastInboundAt: number | null;
  clicked: boolean;
}): FollowUpSkipReason | null {
  if (lastInboundAt !== null && lastInboundAt > startedAt) return "replied";
  if (now - startedAt >= FOLLOW_UP_WINDOW_MS) return "window_closed";
  if (condition === "CLICKED" && !clicked) return "condition";
  if (condition === "NOT_CLICKED" && clicked) return "condition";
  return null;
}

/** Hour and minute of a moment in a given time zone. */
function localTime(at: number, timeZone: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(at));
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { hour: value("hour") % 24, minute: value("minute") };
}

/**
 * How long to wait until a step's sending hours open: 0 when `at` is already
 * inside [startHour, endHour) in `timeZone`, or when the step has no hours.
 */
export function followUpSendWindowDelayMs({
  at,
  startHour,
  endHour,
  timeZone,
}: {
  at: number;
  startHour: number | null;
  endHour: number | null;
  timeZone: string | null;
}): number {
  if (startHour === null || endHour === null || startHour >= endHour) return 0;
  let zone = timeZone || DEFAULT_SEND_WINDOW_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
  } catch {
    zone = DEFAULT_SEND_WINDOW_TIME_ZONE;
  }
  const { hour, minute } = localTime(at, zone);
  const nowMinutes = hour * 60 + minute;
  const start = startHour * 60;
  const end = endHour * 60;
  if (nowMinutes >= start && nowMinutes < end) return 0;
  const waitMinutes =
    nowMinutes < start ? start - nowMinutes : 24 * 60 - nowMinutes + start;
  return waitMinutes * 60_000;
}

/**
 * Margin kept before the 24-hour window closes when a step is pushed to its
 * next sending hours, so it still gets out after waiting in the queue.
 */
const SEND_WINDOW_SAFETY_MS = 30 * 60_000;

/**
 * True when waiting `delayMs` for the sending hours still leaves the step
 * inside Instagram's 24-hour window (with a safety margin).
 */
export function canWaitForSendWindow({
  now,
  startedAt,
  delayMs,
}: {
  now: number;
  startedAt: number;
  delayMs: number;
}): boolean {
  return now + delayMs - startedAt < FOLLOW_UP_WINDOW_MS - SEND_WINDOW_SAFETY_MS;
}

/** Re-queue a step that fired outside its sending hours. */
export async function deferFollowUpStep(
  data: {
    instagramAccountId: string;
    accountConnectionId?: string;
    userId: string;
    automationId: string;
    stepId: string;
    startedAt: number;
    commenterName?: string | null;
  },
  delayMs: number
): Promise<void> {
  await getDMQueue().add(FOLLOWUP_STEP_JOB_NAME, data, {
    delay: delayMs,
    jobId: `fstep_${data.stepId}_${data.userId}_${data.startedAt}_hours`,
  });
}

export function clampFollowUpDelayMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  return Math.min(
    MAX_FOLLOW_UP_STEP_DELAY_MINUTES,
    Math.max(0, Math.round(minutes))
  );
}

/**
 * The step's web-link button, if it has one. A URL that matches one of the
 * campaign's tracked links is sent as that tracked link (with the recipient
 * token), so the click is counted and can drive later CLICKED / NOT_CLICKED
 * steps. Any other URL is sent as is.
 */
export function resolveFollowUpButton({
  buttonLabel,
  buttonUrl,
  trackedLinks,
  recipientToken,
  baseUrl,
}: {
  buttonLabel: string | null;
  buttonUrl: string | null;
  trackedLinks: { slug: string; destinationUrl: string }[];
  recipientToken: string;
  baseUrl?: string;
}): { title: string; url: string } | null {
  const url = buttonUrl?.trim();
  const title = buttonLabel?.trim();
  if (!url || !title) return null;
  const normalize = (value: string) => value.trim().replace(/\/+$/, "");
  const tracked = trackedLinks.find(
    (link) => normalize(link.destinationUrl) === normalize(url)
  );
  return {
    title: title.slice(0, 20),
    url: tracked
      ? buildTrackedUrl(tracked.slug, baseUrl, recipientToken)
      : url,
  };
}

/**
 * Schedule every step of a campaign's follow-up sequence for one recipient,
 * right after their link was delivered. Returns how many steps were scheduled
 * (0 when the campaign has none, in which case the legacy single follow-up
 * applies). Job ids are per step, recipient and day, so repeat taps on the
 * same day do not schedule a second sequence.
 */
export async function scheduleFollowUpSequence({
  automationId,
  instagramBusinessId,
  accountConnectionId,
  userId,
  commenterName,
  startedAt = Date.now(),
}: {
  automationId: string;
  instagramBusinessId: string;
  accountConnectionId?: string;
  userId: string;
  commenterName?: string | null;
  startedAt?: number;
}): Promise<number> {
  const steps = await prisma.followUpStep.findMany({
    where: { automationId },
    orderBy: [{ delayMinutes: "asc" }, { position: "asc" }],
    select: { id: true, delayMinutes: true },
  });
  if (steps.length === 0) return 0;

  const queue = getDMQueue();
  const day = Math.floor(startedAt / DAY_MS);
  for (const step of steps) {
    await queue.add(
      FOLLOWUP_STEP_JOB_NAME,
      {
        instagramAccountId: instagramBusinessId,
        accountConnectionId,
        userId,
        automationId,
        stepId: step.id,
        startedAt,
        commenterName: commenterName ?? null,
      },
      {
        delay: clampFollowUpDelayMinutes(step.delayMinutes) * 60_000,
        jobId: `fstep_${step.id}_${userId}_${day}`,
      }
    );
  }
  return steps.length;
}

/** Remember that this person just wrote to the account (stops their sequences). */
export async function recordInboundMessage({
  instagramBusinessId,
  userId,
  at = new Date(),
}: {
  instagramBusinessId: string;
  userId: string;
  at?: Date;
}): Promise<void> {
  await prisma.conversationActivity.upsert({
    where: {
      instagramBusinessId_userId: { instagramBusinessId, userId },
    },
    create: { instagramBusinessId, userId, lastInboundAt: at },
    update: { lastInboundAt: at },
  });
}
