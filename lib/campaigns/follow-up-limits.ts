/** Instagram lets a business message someone for 24 h after their last interaction. */
export const FOLLOW_UP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Longest delay a follow-up step may have. It leaves a margin before the
 * 24-hour window closes, so a step that waits in the queue a little still
 * gets out.
 */
export const MAX_FOLLOW_UP_STEP_DELAY_MINUTES = 23 * 60 + 30;

/** Most steps a campaign's follow-up sequence may have. */
export const MAX_FOLLOW_UP_STEPS = 10;
