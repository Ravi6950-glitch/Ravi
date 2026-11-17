import { platformOrFallback, type PlatformDefinition } from "./registry";

export interface ValidationIssue {
  level: "error" | "warning" | "tip";
  message: string;
}

export interface TargetValidation {
  platformKey: string
  platformName: string;
  charCount: number;
  charLimit: number;
  hashtagCount: number;
  issues: ValidationIssue[];
  ok: boolean;
}

/** Hashtags in a body of text. */
export function countHashtags(text: string): number {
  return (text.match(/(?:^|\s)#[A-Za-z0-9_]{2,}/g) ?? []).length;
}

/**
 * Validates one platform's copy. Errors block publishing; warnings and tips
 * are advisory and shown inline in the composer.
 */
export function validateForPlatform(
  platformKey: string,
  content: string,
  media: Array<{ kind: string; alt?: string | null }> = [],
  options: Record<string, unknown> = {},
): TargetValidation {
  const def: PlatformDefinition = platformOrFallback(platformKey);
  const issues: ValidationIssue[] = [];
  const chars = content.length;
  const hashtags = countHashtags(content);
  const images = media.filter((m) => m.kind === "image").length;
  const videos = media.filter((m) => m.kind === "video").length;

  if (!content.trim() && media.length === 0) {
    issues.push({ level: "error", message: "Nothing to post yet." });
  }

  if (chars > def.charLimit) {
    issues.push({
      level: "error",
      message: `${chars.toLocaleString()} / ${def.charLimit.toLocaleString()} characters - ${(
        chars - def.charLimit
      ).toLocaleString()} over the limit.`,
    });
  } else if (chars > def.charLimit * 0.9) {
    issues.push({
      level: "warning",
      message: `Close to the ${def.charLimit.toLocaleString()}-character limit.`,
    });
  }

  if (def.idealChars && chars > def.idealChars * 2.2 && chars <= def.charLimit) {
    issues.push({
      level: "tip",
      message: `${def.name} posts tend to perform best around ${def.idealChars} characters.`,
    });
  }

  if (images > def.maxImages) {
    issues.push({
      level: "error",
      message:
        def.maxImages === 0
          ? `${def.name} does not accept images.`
          : `${def.name} accepts up to ${def.maxImages} image(s); ${images} attached.`,
    });
  }
  if (videos > def.maxVideos) {
    issues.push({
      level: "error",
      message:
        def.maxVideos === 0
          ? `${def.name} does not accept video.`
          : `${def.name} accepts up to ${def.maxVideos} video(s); ${videos} attached.`,
    });
  }

  if (def.maxHashtags === 0 && hashtags > 0) {
    issues.push({
      level: "warning",
      message: `Hashtags do nothing on ${def.name} - consider removing them.`,
    });
  } else if (hashtags > def.maxHashtags) {
    issues.push({
      level: "warning",
      message: `${hashtags} hashtags; ${def.name} works best with ${def.maxHashtags} or fewer.`,
    });
  }

  for (const opt of def.postOptions ?? []) {
    if (!opt.required) continue;
    const v = options[opt.name];
    if (v === undefined || v === null || String(v).trim() === "") {
      issues.push({ level: "error", message: `${def.name} requires "${opt.label}".` });
    }
  }

  // Networks that key off media won't accept a text-only post.
  const mediaFirst = ["instagram", "tiktok", "pinterest", "youtube", "snapchat", "xiaohongshu", "lemon8"];
  if (mediaFirst.includes(def.key) && media.length === 0) {
    issues.push({
      level: "error",
      message: `${def.name} needs at least one image or video.`,
    });
  }

  const missingAlt = media.filter((m) => m.kind === "image" && !m.alt?.trim()).length;
  if (missingAlt > 0 && def.capabilities.includes("alt-text")) {
    issues.push({
      level: "tip",
      message: `${missingAlt} image(s) have no alt text - add it so screen readers can describe them.`,
    });
  }

  return {
    platformKey: def.key,
    platformName: def.name,
    charCount: chars,
    charLimit: def.charLimit,
    hashtagCount: hashtags,
    issues,
    ok: !issues.some((i) => i.level === "error"),
  };
}

/**
 * Splits long copy into a thread for networks that support one, breaking on
 * sentence boundaries rather than mid-word.
 */
export function splitIntoThread(text: string, limit: number): string[] {
  const clean = text.trim();
  if (clean.length <= limit) return [clean];

  const suffixLen = 8; // room for a " (n/m)" counter
  const budget = Math.max(40, limit - suffixLen);
  const sentences = clean.match(/[^.!?\n]+[.!?]*\s*/g) ?? [clean];
  const parts: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).trim().length <= budget) {
      current += sentence;
      continue;
    }
    if (current.trim()) parts.push(current.trim());
    if (sentence.trim().length <= budget) {
      current = sentence;
      continue;
    }
    // A single sentence longer than the budget: break it on word boundaries.
    let rest = sentence.trim();
    while (rest.length > budget) {
      let cut = rest.lastIndexOf(" ", budget);
      if (cut < budget * 0.5) cut = budget;
      parts.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    current = rest;
  }
  if (current.trim()) parts.push(current.trim());

  const total = parts.length;
  return total === 1 ? parts : parts.map((p, i) => `${p} (${i + 1}/${total})`);
}
