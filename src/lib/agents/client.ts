import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";

/**
 * The bridge to Claude.
 *
 * Every agent declares a Zod schema for its output and gets back a typed,
 * validated object - no prompt-and-pray string parsing. When no API key is
 * configured, `isAiConfigured()` returns false and each agent falls back to its
 * deterministic heuristic implementation, so the product works offline and
 * out of the box.
 */

const DEFAULT_MODEL = "claude-opus-5-5";

export function isAiConfigured(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

export function aiModel(): string {
  return process.env.CHORUS_AI_MODEL?.trim() || DEFAULT_MODEL;
}

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

function aiEffort(): Effort {
  const raw = process.env.CHORUS_AI_EFFORT?.trim().toLowerCase();
  const allowed: Effort[] = ["low", "medium", "high", "xhigh", "max"];
  return (allowed as string[]).includes(raw ?? "") ? (raw as Effort) : "medium";
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      // The SDK also resolves ANTHROPIC_API_KEY itself; passing it explicitly
      // keeps the failure mode obvious when it is missing.
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 2,
    });
  }
  return client;
}

export interface StructuredCallResult<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export class AiRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiRefusedError";
  }
}

/**
 * One structured request to Claude, validated against `schema`.
 *
 * Opus 5.5 runs with thinking always on; depth is controlled through
 * `output_config.effort`. Server-side fallbacks are enabled so a policy
 * decline on one model is retried on another inside the same call rather than
 * surfacing as a dead agent run.
 */
export async function callStructured<T>(opts: {
  system: string;
  prompt: string;
  schema: ZodType<T>;
  maxTokens?: number;
  effort?: Effort;
}): Promise<StructuredCallResult<T>> {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }
  const model = aiModel();

  const response = await getClient().beta.messages.parse({
    model,
    max_tokens: opts.maxTokens ?? 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: opts.system,
    output_config: {
      effort: opts.effort ?? aiEffort(),
      format: zodOutputFormat(opts.schema),
    },
    messages: [{ role: "user", content: opts.prompt }],
  });

  if (response.stop_reason === "refusal") {
    const detail =
      response.stop_details && "explanation" in response.stop_details
        ? String(response.stop_details.explanation ?? "")
        : "";
    throw new AiRefusedError(
      `The model declined this request${detail ? `: ${detail}` : "."}`,
    );
  }

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("The model returned no parseable structured output.");
  }

  return {
    data: parsed as T,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    model: response.model ?? model,
  };
}
