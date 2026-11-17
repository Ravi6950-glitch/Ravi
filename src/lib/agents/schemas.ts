import { z } from "zod";

/**
 * Output contracts for every agent.
 *
 * These are the schemas Claude is constrained to, and the same shapes the
 * heuristic engine produces - so the rest of the app never needs to know which
 * engine ran.
 */

export const ComposerOutput = z.object({
  variants: z
    .array(
      z.object({
        platform: z.string().describe("Platform key, e.g. instagram"),
        content: z.string().describe("Ready-to-post copy for this platform"),
        rationale: z.string().describe("One sentence on why it is shaped this way"),
        hashtags: z.array(z.string()).describe("Hashtags without the # prefix"),
        threadParts: z
          .array(z.string())
          .describe("Follow-up parts when the platform supports threads; empty otherwise"),
      }),
    )
    .describe("One entry per requested platform"),
  firstComment: z.string().describe("Suggested first comment, or an empty string"),
  summary: z.string().describe("One line describing the approach taken"),
});
export type ComposerOutput = z.infer<typeof ComposerOutput>;

export const HashtagOutput = z.object({
  sets: z.array(
    z.object({
      platform: z.string(),
      hashtags: z.array(z.string()).describe("Without the # prefix"),
      keywords: z.array(z.string()),
      reach: z.enum(["broad", "balanced", "niche"]),
      note: z.string(),
    }),
  ),
  summary: z.string(),
});
export type HashtagOutput = z.infer<typeof HashtagOutput>;

export const TimingOutput = z.object({
  accounts: z.array(
    z.object({
      accountId: z.string(),
      slots: z
        .array(
          z.object({
            dayOfWeek: z.number().describe("0 = Sunday through 6 = Saturday"),
            hour: z.number().describe("0-23, in the workspace timezone"),
            score: z.number().describe("0-100 confidence that this slot performs well"),
            reason: z.string(),
          }),
        )
        .describe("The strongest slots, best first"),
    }),
  ),
  summary: z.string(),
});
export type TimingOutput = z.infer<typeof TimingOutput>;

export const PerformanceOutput = z.object({
  headline: z.string().describe("One sentence summing up the period"),
  insights: z.array(
    z.object({
      severity: z.enum(["GOOD", "INFO", "WARN", "CRITICAL"]),
      title: z.string(),
      body: z.string().describe("Two or three sentences: what happened and what to do"),
      platform: z.string().describe("Platform key, or an empty string when it spans all"),
      metric: z.string().describe("The metric this is about, e.g. engagement rate"),
      metricDelta: z.number().describe("Percent change, negative for a decline"),
    }),
  ),
  recommendations: z.array(z.string()),
});
export type PerformanceOutput = z.infer<typeof PerformanceOutput>;

export const ProfileAuditOutput = z.object({
  audits: z.array(
    z.object({
      accountId: z.string(),
      score: z.number().describe("0-100 overall profile health"),
      grade: z.enum(["A", "B", "C", "D", "F"]),
      summary: z.string(),
      cadence: z.string().describe("Plain-language description of posting rhythm"),
      strengths: z.array(z.string()),
      issues: z.array(
        z.object({
          title: z.string(),
          detail: z.string(),
          severity: z.enum(["low", "medium", "high"]),
          fix: z.string().describe("The specific action to take"),
        }),
      ),
    }),
  ),
  summary: z.string(),
});
export type ProfileAuditOutput = z.infer<typeof ProfileAuditOutput>;

export const TrendOutput = z.object({
  ideas: z.array(
    z.object({
      title: z.string(),
      angle: z.string().describe("The hook - why someone stops scrolling"),
      platforms: z.array(z.string()).describe("Platform keys this suits best"),
      format: z.string().describe("e.g. carousel, short video, text thread"),
      draft: z.string().describe("A usable opening draft"),
      confidence: z.number().describe("0-100"),
    }),
  ),
  summary: z.string(),
});
export type TrendOutput = z.infer<typeof TrendOutput>;

export const QueueOptimizerOutput = z.object({
  moves: z.array(
    z.object({
      postId: z.string(),
      fromIso: z.string(),
      toIso: z.string(),
      reason: z.string(),
      expectedLift: z.number().describe("Estimated percent improvement in reach"),
    }),
  ),
  warnings: z.array(
    z.object({
      kind: z.enum(["clash", "gap", "overload", "empty"]),
      detail: z.string(),
    }),
  ),
  summary: z.string(),
});
export type QueueOptimizerOutput = z.infer<typeof QueueOptimizerOutput>;
