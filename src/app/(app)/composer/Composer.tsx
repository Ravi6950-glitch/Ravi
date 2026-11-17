"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Badge,
  Card,
  Icon,
  ICONS,
  PlatformAvatar,
  PlatformIcon,
  formatNumber,
} from "@/components/ui";
import { platformOrFallback } from "@/lib/platforms/registry";
import { validateForPlatform } from "@/lib/platforms/validate";
import {
  runComposerAction,
  runHashtagAction,
  savePostAction,
  type AgentActionState,
  type SavePostState,
} from "../actions";

interface AccountLite {
  id: string;
  platform: string;
  platformName: string;
  handle: string;
  displayName: string;
  status: string;
  connection: string;
  followers: number;
}

interface MediaLite {
  id: string;
  url: string;
  kind: string;
  alt: string | null;
}

interface EditingPost {
  id: string;
  baseContent: string;
  title: string | null;
  link: string | null;
  firstComment: string | null;
  status: string;
  scheduledAt: string | null;
  accountIds: string[];
  mediaIds: string[];
  overrides: Record<string, string>;
}

const emptySave: SavePostState = {};
const emptyAgent: AgentActionState = {};

export function Composer({
  accounts,
  media,
  queueSlotCount,
  brandVoice,
  canPublish,
  aiEnabled,
  initialIdea,
  editing,
}: {
  accounts: AccountLite[];
  media: MediaLite[];
  queueSlotCount: number;
  brandVoice: string;
  canPublish: boolean;
  aiEnabled: boolean;
  initialIdea: string;
  editing: EditingPost | null;
}) {
  const router = useRouter();
  const [content, setContent] = useState(editing?.baseContent ?? initialIdea);
  const [selected, setSelected] = useState<string[]>(editing?.accountIds ?? []);
  const [overrides, setOverrides] = useState<Record<string, string>>(
    editing?.overrides ?? {},
  );
  const [options, setOptions] = useState<Record<string, string>>({});
  const [chosenMedia, setChosenMedia] = useState<string[]>(editing?.mediaIds ?? []);
  const [link, setLink] = useState(editing?.link ?? "");
  const [firstComment, setFirstComment] = useState(editing?.firstComment ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [intent, setIntent] = useState<"draft" | "schedule" | "queue" | "now">(
    editing?.scheduledAt ? "schedule" : "queue",
  );
  const [scheduledAt, setScheduledAt] = useState(
    editing?.scheduledAt ? toLocalInput(editing.scheduledAt) : defaultSchedule(),
  );
  const [showAi, setShowAi] = useState(false);
  const [aiIdea, setAiIdea] = useState("");
  const [aiTone, setAiTone] = useState("");
  const [aiCta, setAiCta] = useState("");

  const [saveState, saveAction, saving] = useActionState(savePostAction, emptySave);
  const [aiState, aiAction, aiPending] = useActionState(runComposerAction, emptyAgent);
  const [tagState, tagAction, tagPending] = useActionState(runHashtagAction, emptyAgent);
  const [, startTransition] = useTransition();

  const selectedAccounts = useMemo(
    () => accounts.filter((a) => selected.includes(a.id)),
    [accounts, selected],
  );

  const mediaForValidation = useMemo(
    () =>
      media
        .filter((m) => chosenMedia.includes(m.id))
        .map((m) => ({ kind: m.kind, alt: m.alt })),
    [media, chosenMedia],
  );

  // Validate every selected destination on each keystroke, so limits are
  // visible before anything is submitted.
  const validations = useMemo(
    () =>
      selectedAccounts.map((account) => {
        const text = overrides[account.id] ?? content;
        const opts: Record<string, unknown> = {};
        for (const o of platformOrFallback(account.platform).postOptions ?? []) {
          const v = options[`${account.id}_${o.name}`];
          if (v) opts[o.name] = v;
        }
        return {
          account,
          text,
          result: validateForPlatform(account.platform, text, mediaForValidation, opts),
        };
      }),
    [selectedAccounts, overrides, content, options, mediaForValidation],
  );

  const errorCount = validations.reduce(
    (t, v) => t + v.result.issues.filter((i) => i.level === "error").length,
    0,
  );
  const reach = selectedAccounts.reduce((t, a) => t + a.followers, 0);

  function toggleAccount(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function applyVariant(platform: string, text: string) {
    // Apply the agent's draft to every selected account on that platform.
    const ids = accounts.filter((a) => a.platform === platform && selected.includes(a.id));
    if (ids.length === 0) return;
    setOverrides((prev) => {
      const next = { ...prev };
      for (const a of ids) next[a.id] = text;
      return next;
    });
    setActiveTab(ids[0].id);
  }

  function applyAllVariants() {
    if (!aiState.composer) return;
    const next: Record<string, string> = { ...overrides };
    for (const v of aiState.composer.variants) {
      for (const a of accounts.filter(
        (x) => x.platform === v.platform && selected.includes(x.id),
      )) {
        next[a.id] = v.content;
      }
    }
    setOverrides(next);
    if (aiState.composer.firstComment && !firstComment) {
      setFirstComment(aiState.composer.firstComment);
    }
    // Put the longest variant in the base box so the "All" tab reads sensibly.
    const longest = [...aiState.composer.variants].sort(
      (a, b) => b.content.length - a.content.length,
    )[0];
    if (longest && !content.trim()) setContent(longest.content);
    setShowAi(false);
  }

  function appendHashtags(platform: string, tags: string[]) {
    const line = tags.map((t) => `#${t.replace(/^#/, "")}`).join(" ");
    const ids = accounts.filter((a) => a.platform === platform && selected.includes(a.id));
    setOverrides((prev) => {
      const next = { ...prev };
      for (const a of ids) {
        const base = next[a.id] ?? content;
        next[a.id] = `${base.trimEnd()}\n\n${line}`;
      }
      return next;
    });
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: "var(--bg-elevated)", color: "var(--text-faint)" }}
          >
            <Icon path={ICONS.link} size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold">Connect an account first</p>
            <p
              className="mx-auto mt-1 max-w-sm text-[0.8125rem] leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              The composer needs somewhere to publish to. Connect any of the 46
              supported networks - sandbox mode works without developer credentials.
            </p>
          </div>
          <Link href="/accounts" className="btn btn-primary btn-sm">
            <Icon path={ICONS.plus} size={14} />
            Connect an account
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-bold tracking-[-0.02em]">
            {editing ? "Edit post" : "Composer"}
          </h1>
          <p className="mt-0.5 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            {selectedAccounts.length === 0
              ? "Pick where this is going, then write it."
              : `${selectedAccounts.length} destination${selectedAccounts.length === 1 ? "" : "s"} · reaching ${formatNumber(reach)} followers`}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            setShowAi((v) => !v);
            if (!aiIdea) setAiIdea(content);
          }}
        >
          <Icon path={ICONS.sparkle} size={14} />
          {showAi ? "Hide AI assist" : "AI assist"}
        </button>
      </header>

      {/* ------------------------------------------------------- AI panel */}
      {showAi ? (
        <Card
          className="rise"
          // A tinted surface so it reads as a tool, not part of the post.
        >
          <div
            className="-m-5 mb-4 rounded-t-[12px] px-5 py-3"
            style={{ background: "var(--brand-soft)" }}
          >
            <p className="flex items-center gap-2 text-[0.875rem] font-semibold">
              <Icon path={ICONS.sparkle} size={15} />
              Composer agent
              {!aiEnabled ? <Badge>Built-in engine</Badge> : <Badge tone="brand">Claude</Badge>}
            </p>
            <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
              Describe the idea. The agent writes a version for each selected
              platform, sized to its limits.
            </p>
          </div>

          <form action={aiAction} className="flex flex-col gap-3">
            {selected.map((id) => {
              const a = accounts.find((x) => x.id === id);
              return a ? (
                <input key={id} type="hidden" name="platforms" value={a.platform} />
              ) : null;
            })}

            <div>
              <label className="label" htmlFor="ai-idea">
                What is this post about?
              </label>
              <textarea
                id="ai-idea"
                name="idea"
                rows={3}
                value={aiIdea}
                onChange={(e) => setAiIdea(e.target.value)}
                className="textarea"
                placeholder="We shipped offline mode. It took four months, the hardest part was conflict resolution, and it works on a plane now."
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="ai-tone">
                  Tone <span style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  id="ai-tone"
                  name="tone"
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value)}
                  className="input"
                  placeholder="Direct and technical"
                />
              </div>
              <div>
                <label className="label" htmlFor="ai-cta">
                  Call to action <span style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  id="ai-cta"
                  name="callToAction"
                  value={aiCta}
                  onChange={(e) => setAiCta(e.target.value)}
                  className="input"
                  placeholder="Try it and tell us what breaks"
                />
              </div>
            </div>
            <input type="hidden" name="link" value={link} />

            <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
              Brand voice in use: {brandVoice}
            </p>

            {aiState.error ? (
              <p
                role="alert"
                className="rounded-lg px-3 py-2 text-[0.8125rem]"
                style={{ background: "var(--bad-soft)", color: "var(--bad)" }}
              >
                {aiState.error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={aiPending || selected.length === 0}
              >
                {aiPending ? (
                  <>
                    <Icon path={ICONS.refresh} size={14} className="spin" />
                    Writing…
                  </>
                ) : (
                  <>
                    <Icon path={ICONS.sparkle} size={14} />
                    Write {selected.length || "0"} version
                    {selected.length === 1 ? "" : "s"}
                  </>
                )}
              </button>
              {selected.length === 0 ? (
                <span
                  className="self-center text-[0.75rem]"
                  style={{ color: "var(--text-faint)" }}
                >
                  Select at least one destination below.
                </span>
              ) : null}
            </div>
          </form>

          {aiState.composer ? (
            <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                  {aiState.composer.summary}
                </p>
                <button type="button" onClick={applyAllVariants} className="btn btn-primary btn-sm">
                  <Icon path={ICONS.check} size={14} />
                  Use all
                </button>
              </div>
              <ul className="flex flex-col gap-2.5">
                {aiState.composer.variants.map((v) => {
                  const def = platformOrFallback(v.platform);
                  const over = v.content.length > def.charLimit;
                  return (
                    <li
                      key={v.platform}
                      className="card p-3"
                      style={{ background: "var(--bg-elevated)" }}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <PlatformAvatar platform={v.platform} size={22} />
                        <span className="text-[0.8125rem] font-semibold">{def.name}</span>
                        <Badge tone={over ? "bad" : "neutral"}>
                          {v.content.length}/{def.charLimit}
                        </Badge>
                        <button
                          type="button"
                          className="btn btn-sm ml-auto"
                          onClick={() => applyVariant(v.platform, v.content)}
                        >
                          Use this
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap text-[0.8125rem] leading-relaxed">
                        {v.content}
                      </p>
                      {v.threadParts.length > 0 ? (
                        <div
                          className="mt-2 border-l-2 pl-3"
                          style={{ borderColor: "var(--border-strong)" }}
                        >
                          {v.threadParts.map((p, i) => (
                            <p
                              key={i}
                              className="mt-1 whitespace-pre-wrap text-[0.75rem] leading-relaxed"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {p}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-2 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                        {v.rationale}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        {/* ------------------------------------------------- the editor */}
        <form action={saveAction} className="flex flex-col gap-4">
          {editing ? <input type="hidden" name="postId" value={editing.id} /> : null}
          <input type="hidden" name="intent" value={intent} />
          <input type="hidden" name="baseContent" value={content} />
          <input type="hidden" name="link" value={link} />
          <input type="hidden" name="title" value={title} />
          <input type="hidden" name="firstComment" value={firstComment} />
          {intent === "schedule" ? (
            <input type="hidden" name="scheduledAt" value={toIso(scheduledAt)} />
          ) : null}
          {selected.map((id) => (
            <input key={id} type="hidden" name="accountIds" value={id} />
          ))}
          {chosenMedia.map((id) => (
            <input key={id} type="hidden" name="mediaIds" value={id} />
          ))}
          {Object.entries(overrides).map(([accountId, text]) =>
            selected.includes(accountId) ? (
              <input key={accountId} type="hidden" name={`content_${accountId}`} value={text} />
            ) : null,
          )}
          {Object.entries(options).map(([key, value]) =>
            value ? <input key={key} type="hidden" name={`opt_${key}`} value={value} /> : null,
          )}

          <Card>
            {/* Per-platform tabs */}
            <div
              className="-mx-5 -mt-5 mb-4 flex gap-1 overflow-x-auto border-b px-5 pt-3"
              style={{ borderColor: "var(--border)" }}
            >
              <TabButton
                active={activeTab === "all"}
                onClick={() => setActiveTab("all")}
                label="All"
                icon={ICONS.compose}
              />
              {selectedAccounts.map((a) => {
                const v = validations.find((x) => x.account.id === a.id);
                const hasError = v?.result.issues.some((i) => i.level === "error");
                const customised = overrides[a.id] !== undefined;
                return (
                  <TabButton
                    key={a.id}
                    active={activeTab === a.id}
                    onClick={() => setActiveTab(a.id)}
                    label={`@${a.handle}`}
                    platform={a.platform}
                    error={hasError}
                    dot={customised}
                  />
                );
              })}
            </div>

            {activeTab === "all" ? (
              <>
                <label className="label" htmlFor="content">
                  Your post
                </label>
                <textarea
                  id="content"
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="textarea"
                  placeholder="Write it once here. Switch to a platform tab to tailor it for that network."
                />
                <p className="mt-2 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                  {content.length} characters · this text is used for any platform you
                  have not customised.
                </p>
              </>
            ) : (
              (() => {
                const a = selectedAccounts.find((x) => x.id === activeTab);
                if (!a) return null;
                const def = platformOrFallback(a.platform);
                const v = validations.find((x) => x.account.id === a.id);
                const text = overrides[a.id] ?? content;
                const customised = overrides[a.id] !== undefined;
                return (
                  <>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label className="label mb-0" htmlFor={`content-${a.id}`}>
                        {def.name} · @{a.handle}
                      </label>
                      {customised ? (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() =>
                            setOverrides((prev) => {
                              const next = { ...prev };
                              delete next[a.id];
                              return next;
                            })
                          }
                        >
                          <Icon path={ICONS.refresh} size={13} />
                          Reset to shared copy
                        </button>
                      ) : null}
                    </div>
                    <textarea
                      id={`content-${a.id}`}
                      rows={8}
                      value={text}
                      onChange={(e) =>
                        setOverrides((prev) => ({ ...prev, [a.id]: e.target.value }))
                      }
                      className="textarea"
                    />

                    {/* Character budget */}
                    <div className="mt-2">
                      <div
                        className="h-1 w-full overflow-hidden rounded-full"
                        style={{ background: "var(--bg-elevated)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (text.length / def.charLimit) * 100)}%`,
                            background:
                              text.length > def.charLimit
                                ? "var(--bad)"
                                : text.length > def.charLimit * 0.9
                                  ? "var(--warn)"
                                  : "var(--good)",
                          }}
                        />
                      </div>
                      <p
                        className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem]"
                        style={{ color: "var(--text-faint)" }}
                      >
                        <span
                          style={{
                            color:
                              text.length > def.charLimit ? "var(--bad)" : "var(--text-faint)",
                          }}
                        >
                          {text.length.toLocaleString()} / {def.charLimit.toLocaleString()}
                        </span>
                        <span>
                          {v?.result.hashtagCount ?? 0} / {def.maxHashtags} hashtags
                        </span>
                        {def.idealChars ? <span>best around {def.idealChars}</span> : null}
                      </p>
                    </div>

                    {/* Platform-specific options */}
                    {(def.postOptions ?? []).length > 0 ? (
                      <div
                        className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {(def.postOptions ?? []).map((opt) => {
                          const key = `${a.id}_${opt.name}`;
                          return (
                            <div key={opt.name}>
                              <label className="label" htmlFor={`opt-${key}`}>
                                {opt.label}
                                {opt.required ? (
                                  <span style={{ color: "var(--bad)" }}> *</span>
                                ) : null}
                              </label>
                              {opt.type === "select" ? (
                                <select
                                  id={`opt-${key}`}
                                  className="select"
                                  value={options[key] ?? opt.options?.[0] ?? ""}
                                  onChange={(e) =>
                                    setOptions((p) => ({ ...p, [key]: e.target.value }))
                                  }
                                >
                                  {(opt.options ?? []).map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                              ) : opt.type === "boolean" ? (
                                <label className="flex items-center gap-2 text-[0.8125rem]">
                                  <input
                                    id={`opt-${key}`}
                                    type="checkbox"
                                    checked={options[key] === "true"}
                                    onChange={(e) =>
                                      setOptions((p) => ({
                                        ...p,
                                        [key]: e.target.checked ? "true" : "",
                                      }))
                                    }
                                  />
                                  Enabled
                                </label>
                              ) : (
                                <input
                                  id={`opt-${key}`}
                                  className="input"
                                  placeholder={opt.placeholder}
                                  value={options[key] ?? ""}
                                  onChange={(e) =>
                                    setOptions((p) => ({ ...p, [key]: e.target.value }))
                                  }
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {def.notes ? (
                      <p
                        className="mt-3 flex items-start gap-1.5 text-[0.75rem]"
                        style={{ color: "var(--text-faint)" }}
                      >
                        <Icon path={ICONS.info} size={13} className="mt-[1px] shrink-0" />
                        {def.notes}
                      </p>
                    ) : null}
                  </>
                );
              })()
            )}
          </Card>

          {/* -------------------------------------------- extras */}
          <Card>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="link">
                  Link <span style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  id="link"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="input"
                  placeholder="https://example.com/post"
                  type="url"
                />
              </div>
              <div>
                <label className="label" htmlFor="title">
                  Internal title <span style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  placeholder="Launch announcement - week 1"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="label" htmlFor="firstComment">
                First comment{" "}
                <span style={{ fontWeight: 400 }}>
                  (posted right after, where the network supports it)
                </span>
              </label>
              <textarea
                id="firstComment"
                rows={2}
                value={firstComment}
                onChange={(e) => setFirstComment(e.target.value)}
                className="textarea"
                placeholder="Links and extra hashtags go here to keep the main post clean."
              />
            </div>

            {/* Media library */}
            <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[0.8125rem] font-medium">
                  Media{" "}
                  {chosenMedia.length > 0 ? (
                    <span style={{ color: "var(--text-faint)" }}>
                      ({chosenMedia.length} selected)
                    </span>
                  ) : null}
                </p>
                <Link href="/settings#media" className="btn btn-sm">
                  <Icon path={ICONS.plus} size={13} />
                  Add media
                </Link>
              </div>
              {media.length === 0 ? (
                <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                  No media in the library yet. Add an image URL from Settings.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {media.map((m) => {
                    const on = chosenMedia.includes(m.id);
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setChosenMedia((prev) =>
                              prev.includes(m.id)
                                ? prev.filter((x) => x !== m.id)
                                : [...prev, m.id],
                            )
                          }
                          className="relative block h-16 w-16 overflow-hidden rounded-lg border-2 transition-colors"
                          style={{ borderColor: on ? "var(--brand)" : "var(--border)" }}
                          title={m.alt ?? m.url}
                          aria-pressed={on}
                        >
                          {/* Remote media: a plain img keeps this independent of
                              any image-host configuration. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.url}
                            alt={m.alt ?? ""}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          {on ? (
                            <span
                              className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-white"
                              style={{ background: "var(--brand)" }}
                            >
                              <Icon path={ICONS.check} size={10} strokeWidth={3} />
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>

          {/* -------------------------------------------- publish bar */}
          <Card>
            {saveState.error ? (
              <div
                role="alert"
                className="mb-3 rounded-lg px-3 py-2.5 text-[0.8125rem]"
                style={{ background: "var(--bad-soft)", color: "var(--bad)" }}
              >
                <p className="font-medium">{saveState.error}</p>
                {saveState.validation?.map((v) => (
                  <p key={v.platform} className="mt-1 text-[0.75rem]">
                    <strong>{platformOrFallback(v.platform).name}:</strong>{" "}
                    {v.errors.join(" ")}
                  </p>
                ))}
              </div>
            ) : null}
            {saveState.ok && saveState.message ? (
              <div
                role="status"
                className="mb-3 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[0.8125rem]"
                style={{ background: "var(--good-soft)", color: "var(--good)" }}
              >
                <span className="flex items-center gap-2">
                  <Icon path={ICONS.check} size={15} />
                  {saveState.message}
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => startTransition(() => router.push("/queue"))}
                >
                  View queue
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[160px] flex-1">
                <label className="label" htmlFor="intent">
                  When
                </label>
                <select
                  id="intent"
                  className="select"
                  value={intent}
                  onChange={(e) => setIntent(e.target.value as typeof intent)}
                >
                  <option value="queue">
                    Add to queue{queueSlotCount > 0 ? ` (${queueSlotCount} slots)` : ""}
                  </option>
                  <option value="schedule">Schedule for a specific time</option>
                  <option value="now">Publish now</option>
                  <option value="draft">Save as draft</option>
                </select>
              </div>

              {intent === "schedule" ? (
                <div className="min-w-[200px] flex-1">
                  <label className="label" htmlFor="scheduledAt">
                    Date and time
                  </label>
                  <input
                    id="scheduledAt"
                    type="datetime-local"
                    className="input"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </div>
              ) : null}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  saving ||
                  selected.length === 0 ||
                  (errorCount > 0 && intent !== "draft") ||
                  (!canPublish && intent !== "draft")
                }
              >
                {saving ? (
                  <>
                    <Icon path={ICONS.refresh} size={15} className="spin" />
                    Working…
                  </>
                ) : (
                  <>
                    <Icon
                      path={
                        intent === "now"
                          ? ICONS.send
                          : intent === "draft"
                            ? ICONS.copy
                            : ICONS.clock
                      }
                      size={15}
                    />
                    {intent === "now"
                      ? "Publish now"
                      : intent === "draft"
                        ? "Save draft"
                        : intent === "queue"
                          ? "Add to queue"
                          : "Schedule"}
                  </>
                )}
              </button>
            </div>

            {errorCount > 0 && intent !== "draft" ? (
              <p
                className="mt-2.5 flex items-center gap-1.5 text-[0.75rem]"
                style={{ color: "var(--bad)" }}
              >
                <Icon path={ICONS.alert} size={13} />
                {errorCount} problem{errorCount === 1 ? "" : "s"} to fix first - see the
                checks on the right.
              </p>
            ) : null}
            {!canPublish ? (
              <p className="mt-2.5 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                Your role can draft posts but not publish them.
              </p>
            ) : null}
          </Card>
        </form>

        {/* ------------------------------------------- destinations panel */}
        <div className="flex flex-col gap-4">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[0.875rem] font-semibold">Destinations</p>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() =>
                  setSelected(
                    selected.length === accounts.length ? [] : accounts.map((a) => a.id),
                  )
                }
              >
                {selected.length === accounts.length ? "None" : "All"}
              </button>
            </div>
            <ul className="flex max-h-[360px] flex-col gap-1 overflow-y-auto">
              {accounts.map((a) => {
                const on = selected.includes(a.id);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => toggleAccount(a.id)}
                      aria-pressed={on}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors"
                      style={{
                        background: on ? "var(--brand-soft)" : "transparent",
                      }}
                    >
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                        style={{
                          borderColor: on ? "var(--brand)" : "var(--border-strong)",
                          background: on ? "var(--brand)" : "transparent",
                        }}
                      >
                        {on ? (
                          <Icon path={ICONS.check} size={10} strokeWidth={3} className="text-white" />
                        ) : null}
                      </span>
                      <PlatformAvatar platform={a.platform} size={24} handle={a.handle} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.8125rem] font-medium">
                          @{a.handle}
                        </span>
                        <span
                          className="block truncate text-[0.6875rem]"
                          style={{ color: "var(--text-faint)" }}
                        >
                          {a.platformName}
                          {a.connection === "SANDBOX" ? " · sandbox" : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Live per-platform checks */}
          {validations.length > 0 ? (
            <Card>
              <p className="mb-3 text-[0.875rem] font-semibold">Checks</p>
              <ul className="flex flex-col gap-2.5">
                {validations.map(({ account, result }) => {
                  const errors = result.issues.filter((i) => i.level === "error");
                  const warnings = result.issues.filter((i) => i.level === "warning");
                  const tips = result.issues.filter((i) => i.level === "tip");
                  return (
                    <li key={account.id}>
                      <button
                        type="button"
                        onClick={() => setActiveTab(account.id)}
                        className="flex w-full items-center gap-2 text-left"
                      >
                        <PlatformIcon platform={account.platform} size={14} />
                        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">
                          {account.platformName}
                        </span>
                        {errors.length > 0 ? (
                          <Badge tone="bad">{errors.length} error</Badge>
                        ) : warnings.length > 0 ? (
                          <Badge tone="warn">{warnings.length} warning</Badge>
                        ) : (
                          <Badge tone="good">
                            <Icon path={ICONS.check} size={10} strokeWidth={3} />
                            Ready
                          </Badge>
                        )}
                      </button>
                      {[...errors, ...warnings, ...tips].slice(0, 3).map((issue, i) => (
                        <p
                          key={i}
                          className="mt-1 pl-[22px] text-[0.6875rem] leading-relaxed"
                          style={{
                            color:
                              issue.level === "error"
                                ? "var(--bad)"
                                : issue.level === "warning"
                                  ? "var(--warn)"
                                  : "var(--text-faint)",
                          }}
                        >
                          {issue.message}
                        </p>
                      ))}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}

          {/* Hashtag agent */}
          {selected.length > 0 ? (
            <Card>
              <p className="mb-2 flex items-center gap-2 text-[0.875rem] font-semibold">
                <Icon path={ICONS.sparkle} size={14} />
                Hashtag strategist
              </p>
              <form action={tagAction}>
                <input type="hidden" name="idea" value={content} />
                {[...new Set(selectedAccounts.map((a) => a.platform))].map((p) => (
                  <input key={p} type="hidden" name="platforms" value={p} />
                ))}
                <button
                  type="submit"
                  className="btn btn-sm w-full"
                  disabled={tagPending || !content.trim()}
                >
                  {tagPending ? (
                    <>
                      <Icon path={ICONS.refresh} size={13} className="spin" />
                      Finding tags…
                    </>
                  ) : (
                    "Suggest hashtags"
                  )}
                </button>
              </form>
              {tagState.error ? (
                <p className="mt-2 text-[0.75rem]" style={{ color: "var(--bad)" }}>
                  {tagState.error}
                </p>
              ) : null}
              {tagState.hashtags ? (
                <ul className="mt-3 flex flex-col gap-2.5">
                  {tagState.hashtags.sets.map((s) => (
                    <li key={s.platform}>
                      <p className="flex items-center gap-1.5 text-[0.75rem] font-medium">
                        <PlatformIcon platform={s.platform} size={12} />
                        {platformOrFallback(s.platform).name}
                        <Badge>{s.reach}</Badge>
                      </p>
                      {s.hashtags.length > 0 ? (
                        <>
                          <p className="mt-1 flex flex-wrap gap-1">
                            {s.hashtags.map((t) => (
                              <span key={t} className="chip">
                                #{t}
                              </span>
                            ))}
                          </p>
                          <button
                            type="button"
                            className="btn btn-sm mt-1.5"
                            onClick={() => appendHashtags(s.platform, s.hashtags)}
                          >
                            <Icon path={ICONS.plus} size={12} />
                            Append to copy
                          </button>
                        </>
                      ) : (
                        <p className="mt-1 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                          {s.note}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- fragments */

function TabButton({
  active,
  onClick,
  label,
  icon,
  platform,
  error,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: string;
  platform?: string;
  error?: boolean;
  dot?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2 text-[0.8125rem] font-medium transition-colors"
      style={{
        borderColor: active ? "var(--brand)" : "transparent",
        color: active ? "var(--text)" : "var(--text-muted)",
      }}
      aria-current={active ? "true" : undefined}
    >
      {platform ? (
        <PlatformIcon platform={platform} size={14} />
      ) : icon ? (
        <Icon path={icon} size={14} />
      ) : null}
      {label}
      {error ? (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--bad)" }}
          title="Has an error"
        />
      ) : dot ? (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--brand)" }}
          title="Customised"
        />
      ) : null}
    </button>
  );
}

/** datetime-local wants "YYYY-MM-DDTHH:mm" in local time. */
function defaultSchedule(): string {
  const d = new Date(Date.now() + 2 * 3_600_000);
  d.setMinutes(0, 0, 0);
  return toLocalInput(d.toISOString());
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(localValue: string): string {
  const d = new Date(localValue);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
