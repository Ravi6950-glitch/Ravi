/**
 * The agent roster.
 *
 * Each agent is a named, independently runnable unit of analysis or
 * generation. The UI, the automation scheduler and the run log all read from
 * this list.
 */

export type AgentKey =
  | "composer"
  | "hashtag-strategist"
  | "timing-oracle"
  | "performance-analyst"
  | "profile-auditor"
  | "trend-scout"
  | "queue-optimizer";

export interface AgentDefinition {
  key: AgentKey;
  name: string;
  tagline: string;
  description: string;
  /** Lucide-style inline SVG path on a 24x24 viewBox. */
  icon: string;
  color: string;
  /** Can this agent be scheduled to run on its own? */
  schedulable: boolean;
  /** Default interval when enabled as an automation, in minutes. */
  defaultIntervalMinutes: number;
  /** What the agent writes back into the product when it runs. */
  outputs: string[];
}

export const AGENTS: AgentDefinition[] = [
  {
    key: "composer",
    name: "Composer",
    tagline: "Writes and reshapes copy for every network",
    description:
      "Takes an idea, a link or a rough draft and produces copy tuned to each connected platform - the right length, the right tone, the right amount of hashtags. Keeps your brand voice consistent across all of them.",
    icon: "M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586M11 11a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
    color: "#6366f1",
    schedulable: false,
    defaultIntervalMinutes: 0,
    outputs: ["Per-platform drafts", "Suggested first comment", "Thread splits"],
  },
  {
    key: "hashtag-strategist",
    name: "Hashtag Strategist",
    tagline: "Finds tags that actually reach people",
    description:
      "Builds a hashtag and keyword set per platform, balancing reach against competition, and drops tags that do nothing on networks where they are ignored.",
    icon: "M4 9h16M4 15h16M10 3L8 21M16 3l-2 18",
    color: "#8b5cf6",
    schedulable: false,
    defaultIntervalMinutes: 0,
    outputs: ["Hashtag sets", "Keyword suggestions", "Reach estimates"],
  },
  {
    key: "timing-oracle",
    name: "Timing Oracle",
    tagline: "Learns when your audience shows up",
    description:
      "Reads the engagement history of every connected account and rebuilds a best-time-to-post heatmap for each one. The queue and the composer both use it.",
    icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2",
    color: "#0ea5e9",
    schedulable: true,
    defaultIntervalMinutes: 360,
    outputs: ["Per-account heatmap", "Recommended slots"],
  },
  {
    key: "performance-analyst",
    name: "Performance Analyst",
    tagline: "Explains what moved and why",
    description:
      "Compares the last period against the one before it across every platform, finds what changed, separates signal from noise and writes up what to do about it.",
    icon: "M3 3v18h18M7 16l4-6 4 3 5-8",
    color: "#22c55e",
    schedulable: true,
    defaultIntervalMinutes: 720,
    outputs: ["Insight feed entries", "Period comparison", "Recommendations"],
  },
  {
    key: "profile-auditor",
    name: "Profile Auditor",
    tagline: "Scores every profile and lists the fixes",
    description:
      "Audits each connected profile on its own terms - bio, avatar, posting cadence, follower trajectory, engagement quality - then grades it and names the specific things to change.",
    icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    color: "#f59e0b",
    schedulable: true,
    defaultIntervalMinutes: 1440,
    outputs: ["Per-profile score and grade", "Prioritised fix list"],
  },
  {
    key: "trend-scout",
    name: "Trend Scout",
    tagline: "Brings back things worth posting about",
    description:
      "Looks at what has been working in your own feed, what formats are pulling ahead, and turns that into concrete content ideas you can send straight to the composer.",
    icon: "M21 3l-9 9M21 3v6M21 3h-6M3 21l6-6M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
    color: "#ec4899",
    schedulable: true,
    defaultIntervalMinutes: 720,
    outputs: ["Content ideas", "Format recommendations"],
  },
  {
    key: "queue-optimizer",
    name: "Queue Optimizer",
    tagline: "Moves scheduled posts to their best slot",
    description:
      "Looks at everything queued, checks it against the timing heatmap, spots clashes and gaps, and proposes a better running order. Never republishes anything already out.",
    icon: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    color: "#14b8a6",
    schedulable: true,
    defaultIntervalMinutes: 480,
    outputs: ["Reschedule proposals", "Gap and clash warnings"],
  },
];

const BY_KEY = new Map(AGENTS.map((a) => [a.key, a]));

export function getAgent(key: string): AgentDefinition | undefined {
  return BY_KEY.get(key as AgentKey);
}

export function agentName(key: string): string {
  return BY_KEY.get(key as AgentKey)?.name ?? key;
}

export const SCHEDULABLE_AGENTS = AGENTS.filter((a) => a.schedulable);
