/**
 * The data each agent reads.
 *
 * Gathered once by `collect*` in run.ts, then handed to either Claude (as JSON
 * inside the prompt) or the heuristic engine. Keeping these as plain
 * serialisable shapes is what lets both engines share one code path.
 */

export interface ComposerInput {
  idea: string;
  platforms: string[];
  brandVoice?: string;
  tone?: string;
  callToAction?: string;
  link?: string;
  /** Recent well-performing copy, so the agent can match what works. */
  examples?: Array<{ platform: string; content: string; engagementRate: number }>;
}

export interface PeriodMetrics {
  followers: number;
  impressions: number;
  reach: number;
  engagements: number;
  clicks: number;
  postsCount: number;
}

export interface PerformanceInput {
  periodDays: number;
  workspaceName: string;
  accounts: Array<{
    id: string;
    platform: string;
    handle: string;
    current: PeriodMetrics;
    previous: PeriodMetrics;
  }>;
  topPosts: Array<{
    postId: string;
    platform: string;
    excerpt: string;
    engagements: number;
    engagementRate: number;
    publishedAt: string;
  }>;
}

export interface AccountSnapshot {
  id: string;
  platform: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  status: string;
  followers: number;
  following: number;
  postsInWindow: number;
  followerDeltaInWindow: number;
  engagementRate: number;
  windowDays: number;
}

export interface TimingInput {
  timezone: string;
  accounts: Array<{
    id: string;
    platform: string;
    handle: string;
    recentPosts: Array<{ publishedAt: string; engagementRate: number; engagements: number }>;
  }>;
}

export interface QueueInput {
  timezone: string;
  scheduled: Array<{
    postId: string;
    scheduledAt: string;
    excerpt: string;
    accountIds: string[];
    platforms: string[];
  }>;
  bestTimes: Array<{ accountId: string; dayOfWeek: number; hour: number; score: number }>;
}
