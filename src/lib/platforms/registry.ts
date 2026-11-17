/**
 * The Chorus platform registry.
 *
 * Every network Chorus can post to is described here once: its limits, what it
 * accepts, how it authenticates and which capabilities the composer should
 * offer. The UI, the validator and the publishing adapters all read from this
 * single source of truth, so adding a network means adding one entry.
 */

export type PlatformCategory =
  | "social"
  | "video"
  | "messaging"
  | "blogging"
  | "community"
  | "business"
  | "audio"
  | "creative"
  | "regional";

export type AuthKind =
  | "oauth2"       // full OAuth 2.0 app (needs client id + secret)
  | "token"        // per-account access token the user pastes in
  | "webhook"      // incoming webhook URL
  | "app-password";// handle + app password (Bluesky)

export type PlatformCapability =
  | "text"
  | "image"
  | "video"
  | "gif"
  | "link"
  | "thread"
  | "poll"
  | "story"
  | "reel"
  | "short"
  | "carousel"
  | "first-comment"
  | "hashtags"
  | "mentions"
  | "title"
  | "alt-text"
  | "scheduling"
  | "analytics"
  | "profile-analytics";

export interface PlatformDefinition {
  key: string;
  name: string;
  shortName: string;
  category: PlatformCategory;
  /** Brand colour, used for charts, chips and account avatars. */
  color: string;
  /** Inline SVG path data drawn on a 24x24 viewBox. */
  icon: string;
  /** Hard character ceiling for a single post. */
  charLimit: number;
  /** Soft target where engagement usually peaks - shown as a hint. */
  idealChars?: number;
  maxImages: number;
  maxVideos: number;
  maxHashtags: number;
  /** Max video length in seconds, when the network enforces one. */
  maxVideoSeconds?: number;
  capabilities: PlatformCapability[];
  auth: AuthKind;
  /** Env vars that must be present for live (non-sandbox) publishing. */
  credentialEnv: string[];
  /** Extra fields Chorus asks for when connecting this account. */
  connectFields?: Array<{
    name: string;
    label: string;
    type: "text" | "password" | "url";
    placeholder?: string;
    help?: string;
    required?: boolean;
  }>;
  /** Per-post options surfaced in the composer. */
  postOptions?: Array<{
    name: string;
    label: string;
    type: "text" | "select" | "boolean";
    options?: string[];
    placeholder?: string;
    required?: boolean;
  }>;
  /** True when Chorus ships a working live publisher for this network. */
  liveAdapter: boolean;
  docsUrl?: string;
  notes?: string;
}

const C = {
  text: "text",
  image: "image",
  video: "video",
  link: "link",
  hashtags: "hashtags",
  mentions: "mentions",
  scheduling: "scheduling",
  analytics: "analytics",
  profile: "profile-analytics",
} as const;

const BASE: PlatformCapability[] = [
  "text",
  "link",
  "scheduling",
  "analytics",
  "profile-analytics",
];

export const PLATFORMS: PlatformDefinition[] = [
  // ---------------------------------------------------------------- social
  {
    key: "instagram",
    name: "Instagram",
    shortName: "IG",
    category: "social",
    color: "#E1306C",
    icon: "M12 2.2c3.2 0 3.6 0 4.9.07 1.2.05 1.8.25 2.2.42.6.22 1 .5 1.4.95.45.4.73.8.95 1.4.17.4.37 1 .42 2.2.07 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.05 1.2-.25 1.8-.42 2.2a3.8 3.8 0 0 1-.95 1.4c-.4.45-.8.73-1.4.95-.4.17-1 .37-2.2.42-1.3.07-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.05-1.8-.25-2.2-.42a3.8 3.8 0 0 1-1.4-.95 3.8 3.8 0 0 1-.95-1.4c-.17-.4-.37-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.05-1.2.25-1.8.42-2.2.22-.6.5-1 .95-1.4.4-.45.8-.73 1.4-.95.4-.17 1-.37 2.2-.42C8.4 2.2 8.8 2.2 12 2.2zm0 3.4a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8zm0 10.55a4.15 4.15 0 1 1 0-8.3 4.15 4.15 0 0 1 0 8.3zm8.15-10.8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z",
    charLimit: 2200,
    idealChars: 150,
    maxImages: 10,
    maxVideos: 1,
    maxHashtags: 30,
    maxVideoSeconds: 90,
    capabilities: [...BASE, "image", "video", "carousel", "reel", "story", "first-comment", "hashtags", "mentions", "alt-text"],
    auth: "oauth2",
    credentialEnv: ["META_CLIENT_ID", "META_CLIENT_SECRET"],
    postOptions: [
      { name: "format", label: "Format", type: "select", options: ["Feed", "Reel", "Story", "Carousel"] },
    ],
    liveAdapter: false,
    docsUrl: "https://developers.facebook.com/docs/instagram-platform",
    notes: "Needs an Instagram Business or Creator account linked to a Facebook Page.",
  },
  {
    key: "facebook",
    name: "Facebook Page",
    shortName: "FB",
    category: "social",
    color: "#1877F2",
    icon: "M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12z",
    charLimit: 63206,
    idealChars: 120,
    maxImages: 10,
    maxVideos: 1,
    maxHashtags: 10,
    capabilities: [...BASE, "image", "video", "gif", "carousel", "first-comment", "hashtags", "mentions", "story"],
    auth: "oauth2",
    credentialEnv: ["META_CLIENT_ID", "META_CLIENT_SECRET"],
    liveAdapter: false,
    docsUrl: "https://developers.facebook.com/docs/pages-api",
  },
  {
    key: "x",
    name: "X (Twitter)",
    shortName: "X",
    category: "social",
    color: "#111827",
    icon: "M18.9 2H22l-7 8 7.6 12h-6.3l-5-7.6-5.7 7.6H2.4l7.4-9.4L2 2h6.4l4.6 7.1L18.9 2z",
    charLimit: 280,
    idealChars: 120,
    maxImages: 4,
    maxVideos: 1,
    maxHashtags: 3,
    maxVideoSeconds: 140,
    capabilities: [...BASE, "image", "video", "gif", "thread", "poll", "hashtags", "mentions", "alt-text"],
    auth: "oauth2",
    credentialEnv: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
    liveAdapter: true,
    docsUrl: "https://docs.x.com/x-api",
    notes: "Premium tier recommended - the free API tier is write-limited.",
  },
  {
    key: "threads",
    name: "Threads",
    shortName: "TH",
    category: "social",
    color: "#000000",
    icon: "M12.2 22C6.5 22 3 18.6 3 12.1 3 5.5 6.6 2 12.3 2c4 0 6.9 1.7 8.2 4.9l-2.3.9c-1-2.3-2.9-3.4-5.9-3.4-4.3 0-6.8 2.6-6.8 7.7 0 5.1 2.5 7.6 6.7 7.6 3.5 0 5.6-1.5 5.6-3.7 0-1.4-.8-2.4-2.3-2.9.2 2.9-1.6 4.6-4.2 4.6-2.3 0-3.9-1.4-3.9-3.5 0-2.3 1.9-3.8 5-3.8.9 0 1.7.1 2.4.2-.2-1.6-1.1-2.4-2.7-2.4-1.2 0-2.1.4-2.8 1.3l-1.8-1.3c1.1-1.5 2.7-2.2 4.7-2.2 3.2 0 5 1.9 5.1 5.3 2.1.8 3.3 2.5 3.3 4.8 0 3.6-3.1 6-8.4 6zm-.8-7.9c-1.6 0-2.6.6-2.6 1.7 0 .9.7 1.5 1.8 1.5 1.5 0 2.4-1.1 2.2-3.1-.4-.1-.9-.1-1.4-.1z",
    charLimit: 500,
    idealChars: 160,
    maxImages: 10,
    maxVideos: 1,
    maxHashtags: 1,
    capabilities: [...BASE, "image", "video", "thread", "mentions", "alt-text"],
    auth: "oauth2",
    credentialEnv: ["META_CLIENT_ID", "META_CLIENT_SECRET"],
    liveAdapter: false,
    docsUrl: "https://developers.facebook.com/docs/threads",
  },
  {
    key: "linkedin",
    name: "LinkedIn",
    shortName: "LI",
    category: "business",
    color: "#0A66C2",
    icon: "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM2.4 21h5.1V9.5H2.4V21zM9.6 9.5H14.5v1.57h.07c.68-1.2 2.35-2.07 4.2-2.07 3.5 0 4.73 2.1 4.73 5.6V21h-5.1v-5.6c0-1.4-.5-2.35-1.75-2.35-1.06 0-1.7.7-1.98 1.38-.1.24-.12.58-.12.92V21H9.6V9.5z",
    charLimit: 3000,
    idealChars: 1300,
    maxImages: 9,
    maxVideos: 1,
    maxHashtags: 5,
    maxVideoSeconds: 600,
    capabilities: [...BASE, "image", "video", "carousel", "poll", "first-comment", "hashtags", "mentions", "title"],
    auth: "oauth2",
    credentialEnv: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    postOptions: [
      { name: "audience", label: "Audience", type: "select", options: ["Anyone", "Connections only"] },
    ],
    liveAdapter: true,
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/",
  },
  {
    key: "bluesky",
    name: "Bluesky",
    shortName: "BS",
    category: "social",
    color: "#0085FF",
    icon: "M12 10.8C10.9 8.7 7.9 4.7 5.1 2.7 2.4.8 1.4 1.1.8 1.4.1 1.7 0 2.8 0 3.4c0 .6.4 5.2.6 6 .8 2.6 3.5 3.4 6 3.2-3.7.5-7 1.9-2.7 6.7 4.8 4.9 6.6-1.1 7.5-4.1.9 3 2 8.8 7.4 4.1 4-4.1 1.1-6.2-2.6-6.7 2.5.2 5.2-.6 6-3.2.2-.8.6-5.4.6-6 0-.6-.1-1.7-.8-2C21.4.9 20.4.6 17.7 2.5c-2.8 2-5.8 6-6.9 8.1l1.2.2z",
    charLimit: 300,
    idealChars: 180,
    maxImages: 4,
    maxVideos: 1,
    maxHashtags: 3,
    capabilities: [...BASE, "image", "video", "thread", "mentions", "alt-text"],
    auth: "app-password",
    credentialEnv: [],
    connectFields: [
      { name: "service", label: "PDS host", type: "url", placeholder: "https://bsky.social", required: true, help: "Leave as bsky.social unless you self-host." },
      { name: "identifier", label: "Handle", type: "text", placeholder: "you.bsky.social", required: true },
      { name: "password", label: "App password", type: "password", required: true, help: "Settings -> Privacy and security -> App passwords." },
    ],
    liveAdapter: true,
    docsUrl: "https://docs.bsky.app",
    notes: "No developer app needed - an app password is enough.",
  },
  {
    key: "mastodon",
    name: "Mastodon",
    shortName: "MA",
    category: "social",
    color: "#6364FF",
    icon: "M21.3 8c0-4.3-2.8-5.6-2.8-5.6C17.1 1.8 14.7 1.5 12.2 1.5h-.06c-2.5 0-4.9.3-6.3.9 0 0-2.8 1.3-2.8 5.6 0 1 0 2.2.03 3.4.1 4.2.4 8.3 4.3 9.3 1.8.5 3.3.6 4.6.5 2.1-.1 3.3-.7 3.3-.7l-.07-1.5s-1.5.5-3.2.4c-1.7-.06-3.5-.2-3.8-2.3a4 4 0 0 1-.04-.6s1.7.4 3.8.5c1.3.06 2.5-.07 3.7-.2 2.4-.3 4.4-1.8 4.7-3.2.4-2.2.4-5.4.4-5.4zm-3.2 5.3h-2V8.5c0-1-.4-1.5-1.3-1.5-.9 0-1.4.6-1.4 1.8v2.6h-2V8.8c0-1.2-.5-1.8-1.4-1.8-.9 0-1.3.5-1.3 1.5v4.8h-2V8.3c0-1 .2-1.8.7-2.4a2.9 2.9 0 0 1 2.3-.9c1.1 0 1.9.4 2.4 1.2l.5.8.5-.8c.5-.8 1.3-1.2 2.4-1.2.9 0 1.7.3 2.3.9.5.6.7 1.4.7 2.4v5z",
    charLimit: 500,
    idealChars: 250,
    maxImages: 4,
    maxVideos: 1,
    maxHashtags: 5,
    capabilities: [...BASE, "image", "video", "thread", "poll", "hashtags", "mentions", "alt-text"],
    auth: "token",
    credentialEnv: [],
    connectFields: [
      { name: "instance", label: "Instance URL", type: "url", placeholder: "https://mastodon.social", required: true },
      { name: "token", label: "Access token", type: "password", required: true, help: "Preferences -> Development -> New application (write:statuses)." },
    ],
    postOptions: [
      { name: "visibility", label: "Visibility", type: "select", options: ["public", "unlisted", "private"] },
    ],
    liveAdapter: true,
    docsUrl: "https://docs.joinmastodon.org/client/intro/",
    notes: "No developer app needed - create a token in your instance settings.",
  },
  {
    key: "pinterest",
    name: "Pinterest",
    shortName: "PI",
    category: "creative",
    color: "#E60023",
    icon: "M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9.2-.8 1.3-5.4 1.3-5.4s-.3-.7-.3-1.7c0-1.6.9-2.8 2.1-2.8 1 0 1.5.7 1.5 1.6 0 1-.6 2.5-1 3.9-.3 1.1.6 2.1 1.7 2.1 2 0 3.5-2.6 3.5-5.7 0-2.4-1.6-4.2-4.6-4.2-3.4 0-5.5 2.5-5.5 5.2 0 1 .4 2.1.9 2.7.1.1.1.2.1.3l-.3 1.3c0 .2-.2.3-.4.2-1.3-.6-2.1-2.5-2.1-4 0-3.3 2.4-6.3 6.9-6.3 3.6 0 6.4 2.6 6.4 6 0 3.6-2.3 6.5-5.4 6.5-1.1 0-2.1-.6-2.4-1.2l-.7 2.5c-.2.9-.9 2.1-1.3 2.8A10 10 0 1 0 12 2z",
    charLimit: 500,
    idealChars: 200,
    maxImages: 1,
    maxVideos: 1,
    maxHashtags: 8,
    capabilities: [...BASE, "image", "video", "link", "title", "hashtags", "alt-text"],
    auth: "oauth2",
    credentialEnv: ["PINTEREST_CLIENT_ID", "PINTEREST_CLIENT_SECRET"],
    postOptions: [
      { name: "board", label: "Board", type: "text", placeholder: "Board name or ID", required: true },
      { name: "title", label: "Pin title", type: "text", placeholder: "Up to 100 characters" },
    ],
    liveAdapter: false,
    docsUrl: "https://developers.pinterest.com/docs/api/v5/",
  },

  // ---------------------------------------------------------------- video
  {
    key: "tiktok",
    name: "TikTok",
    shortName: "TT",
    category: "video",
    color: "#010101",
    icon: "M16.6 5.8a6.3 6.3 0 0 0 3.7 1.2V9.9a9.7 9.7 0 0 1-3.6-.8v5.9a6.1 6.1 0 1 1-6.1-6.1c.3 0 .6 0 .9.1v3a3.1 3.1 0 1 0 2.2 3V2h3a6.3 6.3 0 0 0-.1 1.1c0 .9.3 1.9.9 2.7z",
    charLimit: 2200,
    idealChars: 100,
    maxImages: 35,
    maxVideos: 1,
    maxHashtags: 8,
    maxVideoSeconds: 600,
    capabilities: [...BASE, "video", "image", "carousel", "hashtags", "mentions", "title"],
    auth: "oauth2",
    credentialEnv: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    postOptions: [
      { name: "privacy", label: "Privacy", type: "select", options: ["Public", "Friends", "Private"] },
      { name: "allowComments", label: "Allow comments", type: "boolean" },
    ],
    liveAdapter: false,
    docsUrl: "https://developers.tiktok.com/doc/content-posting-api-get-started",
  },
  {
    key: "youtube",
    name: "YouTube",
    shortName: "YT",
    category: "video",
    color: "#FF0000",
    icon: "M23 7.5a3 3 0 0 0-2.1-2.1C19 4.9 12 4.9 12 4.9s-7 0-8.9.5A3 3 0 0 0 1 7.5C.5 9.4.5 12 .5 12s0 2.6.5 4.5a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-4.5.5-4.5s0-2.6-.5-4.5zM9.8 15.6V8.4l6.2 3.6-6.2 3.6z",
    charLimit: 5000,
    idealChars: 300,
    maxImages: 1,
    maxVideos: 1,
    maxHashtags: 15,
    maxVideoSeconds: 43200,
    capabilities: [...BASE, "video", "short", "title", "hashtags", "first-comment"],
    auth: "oauth2",
    credentialEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    postOptions: [
      { name: "title", label: "Video title", type: "text", placeholder: "Up to 100 characters", required: true },
      { name: "privacy", label: "Privacy", type: "select", options: ["public", "unlisted", "private"] },
      { name: "madeForKids", label: "Made for kids", type: "boolean" },
    ],
    liveAdapter: false,
    docsUrl: "https://developers.google.com/youtube/v3/docs/videos/insert",
  },
  {
    key: "vimeo",
    name: "Vimeo",
    shortName: "VM",
    category: "video",
    color: "#1AB7EA",
    icon: "M22 7.4c-.1 2.1-1.6 5-4.4 8.7-2.9 3.9-5.4 5.8-7.4 5.8-1.3 0-2.3-1.2-3.2-3.5l-1.7-6.4c-.6-2.3-1.3-3.5-2-3.5-.2 0-.7.3-1.6.9L0 8.2c1-.9 2-1.8 3-2.7C4.4 4.3 5.4 3.7 6.1 3.6c1.6-.2 2.6.9 3 3.3.4 2.6.7 4.2.8 4.8.5 2.1 1 3.2 1.6 3.2.4 0 1.1-.7 2-2.1.9-1.4 1.4-2.5 1.5-3.2.1-1.2-.4-1.9-1.5-1.9-.5 0-1 .1-1.6.4 1-3.3 3-4.9 5.9-4.8 2.1.1 3.1 1.5 3 4.1z",
    charLimit: 5000,
    maxImages: 1,
    maxVideos: 1,
    maxHashtags: 10,
    capabilities: [...BASE, "video", "title"],
    auth: "token",
    credentialEnv: [],
    connectFields: [{ name: "token", label: "Personal access token", type: "password", required: true }],
    liveAdapter: false,
    docsUrl: "https://developer.vimeo.com/api/reference",
  },
  {
    key: "twitch",
    name: "Twitch",
    shortName: "TW",
    category: "video",
    color: "#9146FF",
    icon: "M4.3 2 2 6.2v13.6h4.6V22h2.3l2.3-2.3h3.4L21 14V2H4.3zm15.5 11.5L16.4 17h-3.4l-2.3 2.3V17H6.9V3.7h12.9v9.8zM15.3 7v4.6h1.7V7h-1.7zm-4.6 0v4.6h1.7V7h-1.7z",
    charLimit: 500,
    maxImages: 1,
    maxVideos: 0,
    maxHashtags: 5,
    capabilities: [...BASE, "image", "title"],
    auth: "oauth2",
    credentialEnv: ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"],
    liveAdapter: false,
    docsUrl: "https://dev.twitch.tv/docs/api/",
    notes: "Posts stream announcements and channel updates.",
  },
  {
    key: "rumble",
    name: "Rumble",
    shortName: "RB",
    category: "video",
    color: "#85C742",
    icon: "M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.3 7 3.9v7.6l-7 3.9-7-3.9V8.2l7-3.9zm-2 4v7l6-3.5-6-3.5z",
    charLimit: 2000,
    maxImages: 1,
    maxVideos: 1,
    maxHashtags: 10,
    capabilities: [...BASE, "video", "title"],
    auth: "token",
    credentialEnv: [],
    connectFields: [{ name: "token", label: "API token", type: "password", required: true }],
    liveAdapter: false,
  },

  // ---------------------------------------------------------------- messaging
  {
    key: "telegram",
    name: "Telegram",
    shortName: "TG",
    category: "messaging",
    color: "#2AABEE",
    icon: "M22 3 2.3 10.6c-.9.4-.9 1 0 1.3l4.8 1.5 1.8 5.6c.2.6.4.8 1 .3l2.4-2 4.8 3.6c.9.5 1.5.2 1.7-.8L22.9 4.4c.2-1-.3-1.5-1-1.4zM8.5 13.3 17 8l-6.6 6.1-.3 3.5-1.6-4.3z",
    charLimit: 4096,
    maxImages: 10,
    maxVideos: 1,
    maxHashtags: 10,
    capabilities: [...BASE, "image", "video", "gif", "link"],
    auth: "token",
    credentialEnv: [],
    connectFields: [
      { name: "botToken", label: "Bot token", type: "password", required: true, help: "Create a bot with @BotFather." },
      { name: "chatId", label: "Channel / chat ID", type: "text", placeholder: "@mychannel or -1001234567890", required: true },
    ],
    liveAdapter: true,
    docsUrl: "https://core.telegram.org/bots/api",
    notes: "No developer app needed - a bot token is enough.",
  },
  {
    key: "whatsapp",
    name: "WhatsApp Business",
    shortName: "WA",
    category: "messaging",
    color: "#25D366",
    icon: "M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.4A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 0 1 0 16.4 8.2 8.2 0 0 1-4.2-1.2l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3.3 4c-.2 0-.5.1-.7.3-.2.3-.8.8-.8 1.9s.8 2.2.9 2.3c.1.2 1.5 2.4 3.7 3.3 1.8.7 2.2.6 2.6.5.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3l-1.4-.7c-.2-.1-.4-.1-.5.1l-.6.8c-.1.2-.3.2-.5.1-.2-.1-.9-.3-1.7-1-.6-.6-1-1.2-1.2-1.4-.1-.2 0-.3.1-.4l.4-.5c.1-.2.1-.3 0-.5l-.6-1.4c-.1-.4-.3-.4-.5-.4h-.6z",
    charLimit: 4096,
    maxImages: 1,
    maxVideos: 1,
    maxHashtags: 0,
    capabilities: [...BASE, "image", "video", "link"],
    auth: "oauth2",
    credentialEnv: ["META_CLIENT_ID", "META_CLIENT_SECRET"],
    postOptions: [
      { name: "template", label: "Message template", type: "text", placeholder: "Approved template name" },
    ],
    liveAdapter: false,
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    notes: "Business messaging requires pre-approved templates for broadcasts.",
  },
  {
    key: "discord",
    name: "Discord",
    shortName: "DC",
    category: "community",
    color: "#5865F2",
    icon: "M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.4.8a14.8 14.8 0 0 1 4.4 1.4 15.9 15.9 0 0 0-14.9 0A14.9 14.9 0 0 1 9 3.8L8.6 3a19.8 19.8 0 0 0-5 1.4C.6 9 .1 13.4.4 17.7A20 20 0 0 0 6.4 21l.8-1.3c-1.1-.4-2.1-.9-3-1.6l.7-.5a14.2 14.2 0 0 0 12.2 0l.7.5c-.9.7-1.9 1.2-3 1.6L15.6 21a20 20 0 0 0 6-3.3c.4-5-.5-9.4-1.3-13.3zM8.3 15.1c-1.2 0-2.1-1.1-2.1-2.4 0-1.3.9-2.4 2.1-2.4 1.2 0 2.2 1.1 2.1 2.4 0 1.3-.9 2.4-2.1 2.4zm7.4 0c-1.2 0-2.1-1.1-2.1-2.4 0-1.3.9-2.4 2.1-2.4 1.2 0 2.2 1.1 2.1 2.4 0 1.3-.9 2.4-2.1 2.4z",
    charLimit: 2000,
    maxImages: 10,
    maxVideos: 1,
    maxHashtags: 0,
    capabilities: [...BASE, "image", "video", "gif", "link"],
    auth: "webhook",
    credentialEnv: [],
    connectFields: [
      { name: "webhookUrl", label: "Channel webhook URL", type: "url", placeholder: "https://discord.com/api/webhooks/...", required: true, help: "Channel settings -> Integrations -> Webhooks." },
    ],
    liveAdapter: true,
    docsUrl: "https://discord.com/developers/docs/resources/webhook",
    notes: "No developer app needed - a channel webhook is enough.",
  },
  {
    key: "slack",
    name: "Slack",
    shortName: "SL",
    category: "community",
    color: "#4A154B",
    icon: "M5.1 15.1a2.1 2.1 0 1 1-2.1-2.1h2.1v2.1zm1 0a2.1 2.1 0 0 1 4.2 0v5.2a2.1 2.1 0 0 1-4.2 0v-5.2zM8.9 5.1A2.1 2.1 0 1 1 11 3v2.1H8.9zm0 1a2.1 2.1 0 0 1 0 4.2H3.7a2.1 2.1 0 0 1 0-4.2h5.2zM18.9 8.9A2.1 2.1 0 1 1 21 11h-2.1V8.9zm-1 0a2.1 2.1 0 0 1-4.2 0V3.7a2.1 2.1 0 0 1 4.2 0v5.2zM15.1 18.9a2.1 2.1 0 1 1-2.1 2.1v-2.1h2.1zm0-1a2.1 2.1 0 0 1 0-4.2h5.2a2.1 2.1 0 0 1 0 4.2h-5.2z",
    charLimit: 4000,
    maxImages: 10,
    maxVideos: 1,
    maxHashtags: 0,
    capabilities: [...BASE, "image", "link"],
    auth: "webhook",
    credentialEnv: [],
    connectFields: [
      { name: "webhookUrl", label: "Incoming webhook URL", type: "url", placeholder: "https://hooks.slack.com/services/...", required: true },
    ],
    liveAdapter: true,
    docsUrl: "https://api.slack.com/messaging/webhooks",
  },
  {
    key: "line",
    name: "LINE",
    shortName: "LN",
    category: "messaging",
    color: "#06C755",
    icon: "M12 2C6.5 2 2 5.6 2 10c0 3.9 3.3 7.2 7.8 7.9.4.1.9.3 1 .6.1.3.1.7 0 1l-.2 1c-.1.3-.2.9.6.5 1.6-.7 7-4.1 8.6-6.6 1.1-1.2 1.7-2.7 1.7-4.4 0-4.4-4.5-8-10-8zM8 12.6H6.5c-.2 0-.4-.2-.4-.4V8.8c0-.2.2-.4.4-.4s.4.2.4.4v3h1.1c.2 0 .4.2.4.4s-.2.4-.4.4zm1.9-.4c0 .2-.2.4-.4.4s-.4-.2-.4-.4V8.8c0-.2.2-.4.4-.4s.4.2.4.4v3.4zm4.1 0c0 .2-.1.3-.3.4h-.1c-.1 0-.3-.1-.3-.2l-1.6-2.1v1.9c0 .2-.2.4-.4.4s-.4-.2-.4-.4V8.8c0-.2.1-.3.3-.4.2 0 .3 0 .4.2l1.6 2.1V8.8c0-.2.2-.4.4-.4s.4.2.4.4v3.4zm2.8-2.1c.2 0 .4.2.4.4s-.2.4-.4.4h-1.1v.7h1.1c.2 0 .4.2.4.4s-.2.4-.4.4h-1.5c-.2 0-.4-.2-.4-.4V8.8c0-.2.2-.4.4-.4h1.5c.2 0 .4.2.4.4s-.2.4-.4.4h-1.1v.7h1.1z",
    charLimit: 5000,
    maxImages: 5,
    maxVideos: 1,
    maxHashtags: 0,
    capabilities: [...BASE, "image", "video", "link"],
    auth: "token",
    credentialEnv: [],
    connectFields: [{ name: "token", label: "Channel access token", type: "password", required: true }],
    liveAdapter: false,
    docsUrl: "https://developers.line.biz/en/docs/messaging-api/",
  },
  {
    key: "kakaotalk",
    name: "KakaoTalk",
    shortName: "KK",
    category: "regional",
    color: "#FEE500",
    icon: "M12 3C6.9 3 2.8 6.3 2.8 10.3c0 2.6 1.7 4.9 4.3 6.2l-1 3.7c-.1.3.2.5.5.4l4.4-2.9c.3 0 .7.1 1 .1 5.1 0 9.2-3.3 9.2-7.5S17.1 3 12 3z",
    charLimit: 1000,
    maxImages: 3,
    maxVideos: 1,
    maxHashtags: 0,
    capabilities: [...BASE, "image", "link"],
    auth: "oauth2",
    credentialEnv: ["KAKAO_CLIENT_ID", "KAKAO_CLIENT_SECRET"],
    liveAdapter: false,
  },

  // ---------------------------------------------------------------- community
  {
    key: "reddit",
    name: "Reddit",
    shortName: "RD",
    category: "community",
    color: "#FF4500",
    icon: "M22 12a2.1 2.1 0 0 0-3.6-1.5 10.4 10.4 0 0 0-5.5-1.7l1.1-3.5 3 .7a1.5 1.5 0 1 0 .2-1l-3.6-.8c-.2 0-.4.1-.5.3l-1.3 4.3a10.4 10.4 0 0 0-5.6 1.7A2.1 2.1 0 1 0 3.4 14c0 .2-.1.5-.1.7 0 3.5 3.9 6.3 8.7 6.3s8.7-2.8 8.7-6.3c0-.2 0-.5-.1-.7.9-.3 1.4-1.1 1.4-2zM7.9 13.4a1.4 1.4 0 1 1 1.4 1.4 1.4 1.4 0 0 1-1.4-1.4zm7.6 4.2a5.8 5.8 0 0 1-3.5 1 5.8 5.8 0 0 1-3.5-1 .5.5 0 0 1 .7-.7 4.8 4.8 0 0 0 2.8.8 4.8 4.8 0 0 0 2.8-.8.5.5 0 0 1 .7.7zm-.8-2.8a1.4 1.4 0 1 1 1.4-1.4 1.4 1.4 0 0 1-1.4 1.4z",
    charLimit: 40000,
    idealChars: 500,
    maxImages: 20,
    maxVideos: 1,
    maxHashtags: 0,
    capabilities: [...BASE, "image", "video", "link", "title"],
    auth: "oauth2",
    credentialEnv: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"],
    postOptions: [
      { name: "subreddit", label: "Subreddit", type: "text", placeholder: "r/yoursubreddit", required: true },
      { name: "title", label: "Post title", type: "text", placeholder: "Up to 300 characters", required: true },
      { name: "flair", label: "Flair", type: "text" },
    ],
    liveAdapter: true,
    docsUrl: "https://www.reddit.com/dev/api/",
    notes: "Respect each subreddit's self-promotion rules.",
  },
  {
    key: "quora",
    name: "Quora Space",
    shortName: "QR",
    category: "community",
    color: "#B92B27",
    icon: "M12.7 17.3c-.6-1.2-1.3-2.4-3-2.4-.3 0-.7.1-1 .2l-.6-1.2c.4-.3 1.1-.6 2-.6 1.4 0 2.4.7 3.2 1.7.5-1 .7-2.3.7-3.9 0-3.9-1.2-5.9-4.1-5.9S5.8 7.2 5.8 11.1c0 3.9 1.2 5.8 4.1 5.8.7 0 1.3-.1 1.8-.3zm1 1.9c-.9.3-1.9.5-3 .5C6 19.7 2.7 16.3 2.7 11.1 2.7 5.9 6 2.4 10.7 2.4c4.8 0 8.1 3.4 8.1 8.7 0 2.9-1 5.3-2.8 6.8.6.9 1.2 1.5 2.1 1.5.9 0 1.3-.7 1.4-1.3h1.3c-.1 1.5-.9 3.5-3.5 3.5-1.6 0-2.6-.9-3.6-2.4z",
    charLimit: 10000,
    maxImages: 5,
    maxVideos: 1,
    maxHashtags: 0,
    capabilities: [...BASE, "image", "link", "title"],
    auth: "token",
    credentialEnv: [],
    connectFields: [{ name: "token", label: "Session token", type: "password", required: true }],
    liveAdapter: false,
  },
  {
    key: "nextdoor",
    name: "Nextdoor",
    shortName: "ND",
    category: "business",
    color: "#8ED500",
    icon: "M12 2 2 9.3h2.8V22h5.4v-6.4h3.6V22h5.4V9.3H22L12 2z",
    charLimit: 2000,
    maxImages: 10,
    maxVideos: 1,
    maxHashtags: 0,
    capabilities: [...BASE, "image", "link"],
    auth: "oauth2",
    credentialEnv: ["NEXTDOOR_CLIENT_ID", "NEXTDOOR_CLIENT_SECRET"],
    liveAdapter: false,
  },

  // ---------------------------------------------------------------- business
  {
    key: "google-business",
    name: "Google Business Profile",
    shortName: "GB",
    category: "business",
    color: "#4285F4",
    icon: "M22 12.2c0-.8-.1-1.4-.2-2H12v3.8h5.6c-.1.9-.7 2.3-2 3.2l3.2 2.5c1.9-1.7 3.2-4.3 3.2-7.5zM12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 1-3.5 1a5.6 5.6 0 0 1-5.3-3.9l-3.3 2.6A10 10 0 0 0 12 22zM6.7 14.2a5.6 5.6 0 0 1 0-3.6L3.4 8A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.4l3.6-2.2zM12 6.4c1.5 0 2.6.6 3.3 1.2l2.9-2.8A10 10 0 0 0 12 2 10 10 0 0 0 3.4 8l3.3 2.6A5.6 5.6 0 0 1 12 6.4z",
    charLimit: 1500,
    idealChars: 250,
    maxImages: 10,
    maxVideos: 1,
    maxHashtags: 0,
    capabilities: [...BASE, "image", "link", "title"],
    auth: "oauth2",
    credentialEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    postOptions: [
      { name: "postType", label: "Post type", type: "select", options: ["Update", "Offer", "Event"] },
      { name: "cta", label: "Call to action", type: "select", options: ["None", "Book", "Order", "Shop", "Learn more", "Sign up", "Call"] },
    ],
    liveAdapter: false,
    docsUrl: "https://developers.google.com/my-business",
  },

  // ---------------------------------------------------------------- blogging
  {
    key: "medium",
    name: "Medium",
    shortName: "MD",
    category: "blogging",
    color: "#000000",
    icon: "M4.4 7.4c0-.2 0-.4-.2-.6L2.6 4.9V4.6h5l3.9 8.5 3.4-8.5H19.6v.3l-1.4 1.3c-.1.1-.2.2-.2.4v9.9c0 .2 0 .3.2.4l1.3 1.3v.3h-6.7v-.3l1.4-1.4c.1-.1.1-.2.1-.4V9l-3.8 9.6h-.5L5.5 9v6.4c0 .3.1.6.3.8l1.8 2.2v.3H2.5v-.3l1.8-2.2c.2-.2.3-.5.2-.8V7.4z",
    charLimit: 100000,
    maxImages: 20,
    maxVideos: 0,
    maxHashtags: 5,
    capabilities: [...BASE, "image", "link", "title"],
    auth: "token",
    credentialEnv: [],
    connectFields: [{ name: "token", label: "Integration token", type: "password", required: true }],
    postOptions: [
      { name: "title", label: "Story title", type: "text", required: true },
      { name: "publishStatus", label: "Publish as", type: "select", options: ["public", "draft", "unlisted"] },
    ],
    liveAdapter: false,
    docsUrl: "https://github.com/Medium/medium-api-docs",
  },
  {
    key: "ghost",
    name: "Ghost",
    shortName: "GH",
    category: "blogging",
    color: "#15171A",
    icon: "M12 2a10 10 0 0 0-10 10v8a2 2 0 0 0 2 2h3v-4h10v4h3a2 2 0 0 0 2-2v-8A10 10 0 0 0 12 2zm-3.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm7 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z",
    charLimit: 100000,
    maxImages: 20,
    maxVideos: 0,
    maxHashtags: 10,
    capabilities: [...BASE, "image", "link", "title"],
    auth: "token",
    credentialEnv: [],
    connectFields: [
      { name: "apiUrl", label: "Ghost admin URL", type: "url", placeholder: "https://yourblog.com", required: true },
      { name: "adminKey", label: "Admin API key", type: "password", required: true },
    ],
    postOptions: [
      { name: "title", label: "Post title", type: "text", required: true },
      { name: "status", label: "Status", type: "select", options: ["published", "draft"] },
    ],
    liveAdapter: false,
    docsUrl: "https://ghost.org/docs/admin-api/",
  },
  {
    key: "wordpress",
    name: "WordPress",
    shortName: "WP",
    category: "blogging",
    color: "#21759B",
    icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM3.2 12a8.8 8.8 0 0 1 .8-3.6l4.3 11.8A8.8 8.8 0 0 1 3.2 12zm8.8 8.8c-.9 0-1.7-.1-2.5-.4l2.6-7.6 2.7 7.4v.1c-.9.3-1.8.5-2.8.5zm1.2-12.9c.5 0 1 0 1 0 .3 0 .2-.5-.1-.4 0 0-1 .1-1.7.1-.6 0-1.6-.1-1.6-.1-.3 0-.4.4 0 .4 0 0 .4 0 .9.1l1.3 3.6-1.9 5.6-3.1-9.2c.5 0 1 .1 1 .1.3 0 .2-.5-.1-.4 0 0-1 .1-1.7.1h-.4A8.8 8.8 0 0 1 17 4.6h-.2c-.6 0-1.1.6-1.1 1.2 0 .4.2.8.5 1.2.2.4.5 1 .5 1.8 0 .6-.2 1.3-.5 2.3l-.7 2.2-2.3-6.4zm5.2 11a8.8 8.8 0 0 0 3.2-11.3c.1.9.1 1.4.1 1.8 0 .9-.2 1.9-.7 3.1l-2.6 6.4z",
    charLimit: 100000,
    maxImages: 20,
    maxVideos: 1,
    maxHashtags: 15,
    capabilities: [...BASE, "image", "link", "title"],
    auth: "token",
    credentialEnv: [],
    connectFields: [
      { name: "siteUrl", label: "Site URL", type: "url", placeholder: "https://yourblog.com", required: true },
      { name: "username", label: "Username", type: "text", required: true },
      { name: "appPassword", label: "Application password", type: "password", required: true },
    ],
    postOptions: [
      { name: "title", label: "Post title", type: "text", required: true },
      { name: "status", label: "Status", type: "select", options: ["publish", "draft", "pending"] },
    ],
    liveAdapter: false,
    docsUrl: "https://developer.wordpress.org/rest-api/",
  },
  {
    key: "devto",
    name: "DEV Community",
    shortName: "DEV",
    category: "blogging",
    color: "#0A0A0A",
    icon: "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2.6 5.3v7.4h2.1c1.6 0 2.6-1 2.6-2.6v-2.2c0-1.6-1-2.6-2.6-2.6H6.6zm1.7 1.5h.4c.6 0 .9.3.9 1.1v2.2c0 .8-.3 1.1-.9 1.1h-.4V9.8zm5.3-1.5 1.5 7.4h1.9l1.5-7.4h-1.8l-.7 4.6-.7-4.6h-1.7z",
    charLimit: 100000,
    maxImages: 20,
    maxVideos: 0,
    maxHashtags: 4,
    capabilities: [...BASE, "image", "link", "title", "hashtags"],
    auth: "token",
    credentialEnv: [],
    connectFields: [{ name: "apiKey", label: "DEV API key", type: "password", required: true, help: "Settings -> Extensions -> DEV Community API Keys." }],
    postOptions: [
      { name: "title", label: "Article title", type: "text", required: true },
      { name: "published", label: "Publish immediately", type: "boolean" },
    ],
    liveAdapter: true,
    docsUrl: "https://developers.forem.com/api",
    notes: "No developer app needed - generate an API key in your settings.",
  },
  {
    key: "hashnode",
    name: "Hashnode",
    shortName: "HN",
    category: "blogging",
    color: "#2962FF",
    icon: "M2.3 9.1a3.6 3.6 0 0 1 5.1-5.1l1.6 1.6a3.6 3.6 0 0 1 5.1 0l1.6-1.6a3.6 3.6 0 0 1 5.1 5.1l-1.6 1.6a3.6 3.6 0 0 1 0 5.1l1.6 1.6a3.6 3.6 0 0 1-5.1 5.1l-1.6-1.6a3.6 3.6 0 0 1-5.1 0l-1.6 1.6a3.6 3.6 0 0 1-5.1-5.1l1.6-1.6a3.6 3.6 0 0 1 0-5.1L2.3 9.1zm9.7-.5a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z",
    charLimit: 100000,
    maxImages: 20,
    maxVideos: 0,
    maxHashtags: 5,
    capabilities: [...BASE, "image", "link", "title", "hashtags"],
    auth: "token",
    credentialEnv: [],
    connectFields: [
      { name: "token", label: "Personal access token", type: "password", required: true },
      { name: "publicationId", label: "Publication ID", type: "text", required: true },
    ],
    postOptions: [{ name: "title", label: "Article title", type: "text", required: true }],
    liveAdapter: false,
    docsUrl: "https://apidocs.hashnode.com/",
  },
  {
    key: "substack",
    name: "Substack",
    shortName: "SS",
    category: "blogging",
    color: "#FF6719",
    icon: "M4 3h16v2.6H4V3zm0 4.6h16V22l-8-4.5L4 22V7.6z",
    charLimit: 100000,
    maxImages: 20,
    maxVideos: 0,
    maxHashtags: 0,
    capabilities: [...BASE, "image", "link", "title"],
    auth: "token",
    credentialEnv: [],
    connectFields: [
      { name: "publicationUrl", label: "Publication URL", type: "url", placeholder: "https://you.substack.com", required: true },
      { name: "sessionToken", label: "Session token", type: "password", required: true },
    ],
    liveAdapter: false,
    notes: "Substack has no public write API - Chorus drafts to your clipboard queue.",
  },
  {
    key: "tumblr",
    name: "Tumblr",
    shortName: "TB",
    category: "blogging",
    color: "#36465D",
    icon: "M14.6 21.8c-3.4 0-5.9-1.8-5.9-6V9.5H5.9V6.2c3-.8 4.3-3.4 4.5-6h3.2v5.6h3.8v3.7h-3.8v5.5c0 1.6.8 2.2 2.1 2.2h1.9v4.1c-.8.3-2 .5-3 .5z",
    charLimit: 4096,
    maxImages: 10,
    maxVideos: 1,
    maxHashtags: 30,
    capabilities: [...BASE, "image", "video", "gif", "link", "title", "hashtags"],
    auth: "oauth2",
    credentialEnv: ["TUMBLR_CLIENT_ID", "TUMBLR_CLIENT_SECRET"],
    liveAdapter: false,
    docsUrl: "https://www.tumblr.com/docs/en/api/v2",
  },

  // ---------------------------------------------------------------- creative
  {
    key: "behance",
    name: "Behance",
    shortName: "BE",
    category: "creative",
    color: "#1769FF",
    icon: "M8.3 11.1c.9-.4 1.4-1.2 1.4-2.3 0-2.1-1.6-2.9-3.5-2.9H1v12h5.4c2.1 0 4-1 4-3.4 0-1.5-.7-2.6-2.1-3.1v-.3zM3.7 8h2.3c.7 0 1.4.2 1.4 1.1 0 .8-.5 1.2-1.3 1.2H3.7V8zm2.5 7.7H3.7v-3h2.6c.9 0 1.5.4 1.5 1.4 0 1.1-.7 1.6-1.6 1.6zM19.6 7.1h-5V5.9h5v1.2zm2.4 7.8c0-2.9-1.7-5.3-4.8-5.3-3 0-5 2.3-5 5.2 0 3.1 1.9 5.2 5 5.2 2.4 0 4.1-1.1 4.7-3.4h-2.4c-.2.7-1.1 1.2-2.1 1.2-1.5 0-2.4-.9-2.4-2.4H22c0-.1 0-.3 0-.5zm-7-1.3c.1-1.2 1-2 2.2-2 1.2 0 1.9.7 2 2h-4.2z",
    charLimit: 1000,
    maxImages: 10,
    maxVideos: 1,
    maxHashtags: 10,
    capabilities: [...BASE, "image", "title", "hashtags"],
    auth: "oauth2",
    credentialEnv: ["BEHANCE_CLIENT_ID", "BEHANCE_CLIENT_SECRET"],
    liveAdapter: false,
  },
  {
    key: "dribbble",
    name: "Dribbble",
    shortName: "DR",
    category: "creative",
    color: "#EA4C89",
    icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.6 4.6a8.4 8.4 0 0 1 1.9 5.2c-.3-.1-3.3-.7-6.3-.3a29 29 0 0 0-.8-1.8c3.3-1.4 4.8-3.3 5.2-3.1zM12 3.5c1.9 0 3.7.7 5 1.9-.3.4-1.6 2.2-4.8 3.4a44 44 0 0 0-3.3-5.1c1-.1 2-.2 3.1-.2zM7.3 4.3a52 52 0 0 1 3.3 5A20 20 0 0 1 3.7 10a8.5 8.5 0 0 1 3.6-5.7zM3.5 12v-.3c.3 0 4.1.1 7.8-1l.6 1.2c-3 .9-5.6 3.3-6.7 5.6A8.4 8.4 0 0 1 3.5 12zm3 6.8c.7-1.5 2.7-4 6.3-5.2a35 35 0 0 1 1.8 6.4 8.4 8.4 0 0 1-8.1-1.2zm9.7.5a37 37 0 0 0-1.7-6.1c2.8-.4 5.3.3 5.6.4a8.4 8.4 0 0 1-3.9 5.7z",
    charLimit: 1000,
    maxImages: 4,
    maxVideos: 1,
    maxHashtags: 12,
    capabilities: [...BASE, "image", "title", "hashtags"],
    auth: "oauth2",
    credentialEnv: ["DRIBBBLE_CLIENT_ID", "DRIBBBLE_CLIENT_SECRET"],
    liveAdapter: false,
  },
  {
    key: "flickr",
    name: "Flickr",
    shortName: "FK",
    category: "creative",
    color: "#FF0084",
    icon: "M6.5 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm11 0a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
    charLimit: 2000,
    maxImages: 10,
    maxVideos: 1,
    maxHashtags: 20,
    capabilities: [...BASE, "image", "title", "hashtags", "alt-text"],
    auth: "oauth2",
    credentialEnv: ["FLICKR_CLIENT_ID", "FLICKR_CLIENT_SECRET"],
    liveAdapter: false,
  },
  {
    key: "snapchat",
    name: "Snapchat",
    shortName: "SC",
    category: "social",
    color: "#FFFC00",
    icon: "M12 2.2c2.9 0 4.6 2 4.6 4.8 0 .9-.1 1.7-.1 2.2.3.2.8.2 1.2 0 .3-.1.5-.2.8-.2.5 0 1 .4 1 .9 0 .6-.6.9-1.3 1.2-.6.2-1.2.4-1.2.9 0 .2.1.4.2.6.7 1.6 2 3.1 3.6 3.5.3.1.5.3.5.6 0 .7-1.6 1.2-2.6 1.4-.3 0-.4.3-.5.6-.1.4-.2.8-.7.8-.3 0-.7-.1-1.2-.2-.5-.1-1-.2-1.6-.2-1.3 0-2 .7-2.9 1.4-.7.6-1.4 1.1-2.4 1.1s-1.7-.5-2.4-1.1c-.9-.7-1.6-1.4-2.9-1.4-.6 0-1.1.1-1.6.2-.5.1-.9.2-1.2.2-.5 0-.6-.4-.7-.8-.1-.3-.2-.6-.5-.6-1-.2-2.6-.7-2.6-1.4 0-.3.2-.5.5-.6 1.6-.4 2.9-1.9 3.6-3.5.1-.2.2-.4.2-.6 0-.5-.6-.7-1.2-.9-.7-.3-1.3-.6-1.3-1.2 0-.5.5-.9 1-.9.3 0 .5.1.8.2.4.2.9.2 1.2 0 0-.5-.1-1.3-.1-2.2C7.4 4.2 9.1 2.2 12 2.2z",
    charLimit: 250,
    maxImages: 1,
    maxVideos: 1,
    maxHashtags: 3,
    maxVideoSeconds: 180,
    capabilities: [...BASE, "image", "video", "story"],
    auth: "oauth2",
    credentialEnv: ["SNAPCHAT_CLIENT_ID", "SNAPCHAT_CLIENT_SECRET"],
    liveAdapter: false,
    docsUrl: "https://developers.snap.com/",
  },

  // ---------------------------------------------------------------- audio
  {
    key: "soundcloud",
    name: "SoundCloud",
    shortName: "SO",
    category: "audio",
    color: "#FF5500",
    icon: "M1.5 14.5c0-1.2.4-2.3 1.1-3.1v6.2c-.7-.8-1.1-1.9-1.1-3.1zm2.2-4.2c.4-.2.8-.3 1.2-.3v8.9c-.4 0-.8-.1-1.2-.3v-8.3zm2.4-.4c.4 0 .8.1 1.2.2v8.9c-.4.1-.8.2-1.2.2v-9.3zm2.4.6c.4.2.8.5 1.1.8v7.6c-.3.3-.7.6-1.1.8v-9.2zM11 6.1c3.4-1.4 7.2.7 7.9 4.3.4-.1.8-.2 1.2-.2 2 0 3.6 1.6 3.6 3.6s-1.6 3.6-3.6 3.6H11V6.1z",
    charLimit: 2000,
    maxImages: 1,
    maxVideos: 0,
    maxHashtags: 10,
    capabilities: [...BASE, "title", "hashtags"],
    auth: "oauth2",
    credentialEnv: ["SOUNDCLOUD_CLIENT_ID", "SOUNDCLOUD_CLIENT_SECRET"],
    liveAdapter: false,
  },
  {
    key: "spotify-podcast",
    name: "Spotify for Creators",
    shortName: "SP",
    category: "audio",
    color: "#1DB954",
    icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.4c-.2.3-.6.4-.9.2-2.5-1.5-5.7-1.9-9.4-1-.4.1-.7-.1-.8-.5-.1-.4.1-.7.5-.8 4.1-.9 7.6-.5 10.4 1.2.3.2.4.6.2.9zm1.2-2.8c-.3.4-.7.5-1.1.3-2.9-1.8-7.2-2.3-10.6-1.3-.4.1-.9-.1-1-.6-.1-.4.1-.9.6-1 3.9-1.2 8.7-.6 12 1.5.4.2.5.7.1 1.1zm.1-2.9C14.5 8.6 8.8 8.4 5.5 9.4c-.5.2-1.1-.1-1.3-.7-.2-.5.1-1.1.7-1.3 3.8-1.1 10.1-.9 14.1 1.4.5.3.7.9.4 1.4-.3.4-.9.6-1.4.3z",
    charLimit: 4000,
    maxImages: 1,
    maxVideos: 0,
    maxHashtags: 5,
    capabilities: [...BASE, "title"],
    auth: "oauth2",
    credentialEnv: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"],
    liveAdapter: false,
  },

  // ---------------------------------------------------------------- regional
  {
    key: "weibo",
    name: "Sina Weibo",
    shortName: "WB",
    category: "regional",
    color: "#DF2029",
    icon: "M9.9 20.3c-4.2 0-7.6-2-7.6-4.6 0-1.3.9-2.9 2.4-4.4 2-2 4.4-2.9 5.3-2 .4.4.4 1.1.1 2-.2.5.1.6.4.5 1.4-.6 2.7-.6 3.2.2.2.4.2 1 0 1.6-.1.3 0 .4.2.4.8.2 1.6.9 1.6 2 0 2.2-3.2 4.3-5.6 4.3zm-.6-7.1c-2.3 0-4.2 1.2-4.2 2.6s1.9 2.6 4.2 2.6 4.2-1.2 4.2-2.6-1.9-2.6-4.2-2.6zm8.9-4.9c-.3 0-.6-.3-.6-.6 0-1.4-1.2-2.6-2.6-2.6-.3 0-.6-.3-.6-.6s.3-.6.6-.6a3.9 3.9 0 0 1 3.9 3.9c0 .3-.3.5-.7.5zm3-1.3c-.4 0-.7-.3-.7-.7A4.3 4.3 0 0 0 16.2 2c-.4 0-.7-.3-.7-.7s.3-.7.7-.7a5.7 5.7 0 0 1 5.7 5.7c0 .4-.3.7-.7.7z",
    charLimit: 2000,
    maxImages: 9,
    maxVideos: 1,
    maxHashtags: 5,
    capabilities: [...BASE, "image", "video", "hashtags", "mentions"],
    auth: "oauth2",
    credentialEnv: ["WEIBO_CLIENT_ID", "WEIBO_CLIENT_SECRET"],
    liveAdapter: false,
  },
  {
    key: "douyin",
    name: "Douyin",
    shortName: "DY",
    category: "regional",
    color: "#FE2C55",
    icon: "M17 5.6a6.1 6.1 0 0 0 3.6 1.2v2.9a9.4 9.4 0 0 1-3.5-.8v5.8a6 6 0 1 1-6-6c.3 0 .6 0 .9.1v3a2.9 2.9 0 1 0 2.1 2.8V2h2.9c0 .4 0 .7.1 1.1 0 .9.3 1.8.9 2.5z",
    charLimit: 1000,
    maxImages: 35,
    maxVideos: 1,
    maxHashtags: 5,
    capabilities: [...BASE, "video", "image", "hashtags"],
    auth: "oauth2",
    credentialEnv: ["DOUYIN_CLIENT_KEY", "DOUYIN_CLIENT_SECRET"],
    liveAdapter: false,
  },
  {
    key: "xiaohongshu",
    name: "Xiaohongshu",
    shortName: "XHS",
    category: "regional",
    color: "#FF2442",
    icon: "M3 6h2.4l1.8 5.4L9 6h2.4l-3 8.8H6.1L3 6zm10.2 0h5.4v2h-3.3v1.6h3v1.9h-3V13h3.4v1.8h-5.5V6zM20 16.5c0 .8-.7 1.5-1.5 1.5h-13c-.8 0-1.5-.7-1.5-1.5V16h16v.5z",
    charLimit: 1000,
    maxImages: 18,
    maxVideos: 1,
    maxHashtags: 10,
    capabilities: [...BASE, "image", "video", "carousel", "title", "hashtags"],
    auth: "oauth2",
    credentialEnv: ["XHS_CLIENT_ID", "XHS_CLIENT_SECRET"],
    liveAdapter: false,
  },
  {
    key: "kuaishou",
    name: "Kuaishou",
    shortName: "KS",
    category: "regional",
    color: "#FF4906",
    icon: "M4 4h6a5 5 0 0 1 0 10H6.5v6H4V4zm2.5 2.4v5.2H10a2.6 2.6 0 0 0 0-5.2H6.5zM14.5 4H17l2.2 5.3L21.4 4H24l-3.6 8h-2.3L14.5 4z",
    charLimit: 1000,
    maxImages: 20,
    maxVideos: 1,
    maxHashtags: 6,
    capabilities: [...BASE, "video", "image", "hashtags"],
    auth: "oauth2",
    credentialEnv: ["KUAISHOU_CLIENT_ID", "KUAISHOU_CLIENT_SECRET"],
    liveAdapter: false,
  },
  {
    key: "bilibili",
    name: "Bilibili",
    shortName: "BL",
    category: "regional",
    color: "#00A1D6",
    icon: "M6.3 2.2 9 4.9h6l2.7-2.7a1.3 1.3 0 0 1 1.9 1.8L18.3 5H20a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h1.7L4.4 4a1.3 1.3 0 0 1 1.9-1.8zM4 7.4a.6.6 0 0 0-.6.6v9c0 .3.3.6.6.6h16a.6.6 0 0 0 .6-.6V8a.6.6 0 0 0-.6-.6H4zm3.6 3a1 1 0 0 1 1 1v1.8a1 1 0 0 1-2 0v-1.8a1 1 0 0 1 1-1zm8.8 0a1 1 0 0 1 1 1v1.8a1 1 0 0 1-2 0v-1.8a1 1 0 0 1 1-1z",
    charLimit: 2000,
    maxImages: 9,
    maxVideos: 1,
    maxHashtags: 10,
    capabilities: [...BASE, "video", "image", "title", "hashtags"],
    auth: "oauth2",
    credentialEnv: ["BILIBILI_CLIENT_ID", "BILIBILI_CLIENT_SECRET"],
    liveAdapter: false,
  },
  {
    key: "zhihu",
    name: "Zhihu",
    shortName: "ZH",
    category: "regional",
    color: "#0084FF",
    icon: "M5.7 4h7.6v1.9H9.9v2.9h3.4v1.9H9.8c-.1 1.4-.4 2.6-.9 3.6l3.2 3.9-1.5 1.3-2.8-3.4c-.8 1.2-1.9 2.3-3.2 3.2l-1.1-1.6c2.2-1.5 3.4-3.6 3.6-6.9H4.2V8.8h2.9V5.9H6c-.3.9-.7 1.7-1.2 2.4L3.3 7.2C4.3 5.9 5 4.9 5.7 4zm8.1 2.4h7.1v10.9h-2.3l-2.6 2.5-.8-2.5h-1.4V6.4zm1.9 1.9v7.1h1.2l.4 1.2 1.3-1.2h1.4V8.3h-4.3z",
    charLimit: 10000,
    maxImages: 10,
    maxVideos: 1,
    maxHashtags: 5,
    capabilities: [...BASE, "image", "title"],
    auth: "oauth2",
    credentialEnv: ["ZHIHU_CLIENT_ID", "ZHIHU_CLIENT_SECRET"],
    liveAdapter: false,
  },
  {
    key: "vk",
    name: "VK",
    shortName: "VK",
    category: "regional",
    color: "#0077FF",
    icon: "M12.8 17.3c-6.3 0-9.9-4.3-10-11.5h3.2c.1 5.3 2.4 7.5 4.3 8V5.8h3v4.6c1.8-.2 3.7-2.3 4.4-4.6h3c-.5 2.8-2.6 4.9-4.1 5.8 1.5.7 3.9 2.6 4.8 5.7h-3.3c-.7-2.2-2.4-3.9-4.8-4.2v4.2h-.5z",
    charLimit: 16000,
    maxImages: 10,
    maxVideos: 1,
    maxHashtags: 10,
    capabilities: [...BASE, "image", "video", "poll", "hashtags", "mentions"],
    auth: "oauth2",
    credentialEnv: ["VK_CLIENT_ID", "VK_CLIENT_SECRET"],
    liveAdapter: false,
  },
  {
    key: "naver-blog",
    name: "Naver Blog",
    shortName: "NV",
    category: "regional",
    color: "#03C75A",
    icon: "M4 4h5.3l4.1 6.1V4H20v16h-5.3l-4.1-6.1V20H4V4z",
    charLimit: 50000,
    maxImages: 20,
    maxVideos: 1,
    maxHashtags: 10,
    capabilities: [...BASE, "image", "title"],
    auth: "oauth2",
    credentialEnv: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"],
    liveAdapter: false,
  },
  {
    key: "lemon8",
    name: "Lemon8",
    shortName: "L8",
    category: "regional",
    color: "#FFE000",
    icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3.2a4.2 4.2 0 0 1 4.2 4.2c0 2.9-4.2 9.2-4.2 9.2S7.8 12.3 7.8 9.4A4.2 4.2 0 0 1 12 5.2zm0 2a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z",
    charLimit: 1000,
    maxImages: 18,
    maxVideos: 1,
    maxHashtags: 10,
    capabilities: [...BASE, "image", "carousel", "title", "hashtags"],
    auth: "oauth2",
    credentialEnv: ["LEMON8_CLIENT_ID", "LEMON8_CLIENT_SECRET"],
    liveAdapter: false,
  },
  {
    key: "truth-social",
    name: "Truth Social",
    shortName: "TS",
    category: "social",
    color: "#5448EE",
    icon: "M4 4h16v4h-6v12h-4V8H4V4z",
    charLimit: 500,
    maxImages: 4,
    maxVideos: 1,
    maxHashtags: 5,
    capabilities: [...BASE, "image", "video", "hashtags"],
    auth: "token",
    credentialEnv: [],
    connectFields: [
      { name: "instance", label: "Instance URL", type: "url", placeholder: "https://truthsocial.com", required: true },
      { name: "token", label: "Access token", type: "password", required: true },
    ],
    liveAdapter: true,
    notes: "Mastodon-compatible API.",
  },
];

// --------------------------------------------------------------------------
// Lookups & helpers
// --------------------------------------------------------------------------

const BY_KEY = new Map(PLATFORMS.map((p) => [p.key, p]));

export function getPlatform(key: string): PlatformDefinition | undefined {
  return BY_KEY.get(key);
}

/** Never throws - unknown keys fall back to a neutral definition. */
export function platformOrFallback(key: string): PlatformDefinition {
  return (
    BY_KEY.get(key) ?? {
      key,
      name: key,
      shortName: key.slice(0, 2).toUpperCase(),
      category: "social",
      color: "#64748b",
      icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
      charLimit: 1000,
      maxImages: 1,
      maxVideos: 0,
      maxHashtags: 5,
      capabilities: [...BASE],
      auth: "token",
      credentialEnv: [],
      liveAdapter: false,
    }
  );
}

export const PLATFORM_KEYS = PLATFORMS.map((p) => p.key);

export const CATEGORY_LABELS: Record<PlatformCategory, string> = {
  social: "Social networks",
  video: "Video & streaming",
  messaging: "Messaging & broadcast",
  blogging: "Blogs & newsletters",
  community: "Communities",
  business: "Business & local",
  audio: "Audio & podcasts",
  creative: "Portfolios & creative",
  regional: "Regional networks",
};

export function platformsByCategory(): Array<{
  category: PlatformCategory;
  label: string;
  platforms: PlatformDefinition[];
}> {
  const order: PlatformCategory[] = [
    "social",
    "video",
    "business",
    "community",
    "messaging",
    "blogging",
    "creative",
    "audio",
    "regional",
  ];
  return order.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    platforms: PLATFORMS.filter((p) => p.category === category),
  }));
}

export function hasCapability(key: string, cap: PlatformCapability): boolean {
  return platformOrFallback(key).capabilities.includes(cap);
}

/** True when every env var this platform needs is set to a non-empty value. */
export function hasLiveCredentials(key: string): boolean {
  const def = BY_KEY.get(key);
  if (!def) return false;
  if (def.credentialEnv.length === 0) return true; // per-account token, no app needed
  return def.credentialEnv.every((name) => {
    const v = process.env[name];
    return typeof v === "string" && v.trim().length > 0;
  });
}

export { C };
