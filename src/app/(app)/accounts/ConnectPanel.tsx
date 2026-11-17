"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Badge, Card, Icon, ICONS, PlatformAvatar } from "@/components/ui";
import { connectAccountAction, type ActionState } from "../actions";

interface ConnectField {
  name: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder?: string;
  help?: string;
  required?: boolean;
}

const initial: ActionState = {};

export function ConnectPanel({
  platform,
  mode,
  hasLiveAdapter,
}: {
  platform: {
    key: string;
    name: string;
    color: string;
    auth: string;
    connectFields: ConnectField[];
    docsUrl?: string;
    notes?: string;
    charLimit: number;
    maxImages: number;
    maxHashtags: number;
  };
  mode: "oauth" | "token" | "sandbox";
  hasLiveAdapter: boolean;
}) {
  const [state, action, pending] = useActionState(connectAccountAction, initial);
  // Default to sandbox where that is the only honest option.
  const [sandbox, setSandbox] = useState(mode === "sandbox");

  const liveImpossible = mode === "sandbox";

  return (
    <Card className="rise">
      <div
        className="-m-5 mb-4 flex flex-wrap items-center gap-3 rounded-t-[12px] px-5 py-3.5"
        style={{ background: `color-mix(in srgb, ${platform.color} 12%, transparent)` }}
      >
        <PlatformAvatar platform={platform.key} size={38} />
        <div className="min-w-0 flex-1">
          <p className="text-[1rem] font-semibold">Connect {platform.name}</p>
          <p className="text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
            {platform.charLimit.toLocaleString()} characters · up to {platform.maxImages}{" "}
            image(s) · {platform.maxHashtags} hashtag(s)
          </p>
        </div>
        <div className="flex gap-1.5">
          {platform.docsUrl ? (
            <a
              href={platform.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm"
            >
              <Icon path={ICONS.external} size={13} />
              API docs
            </a>
          ) : null}
          <Link href="/accounts" className="btn btn-sm" aria-label="Close">
            <Icon path={ICONS.x} size={14} />
          </Link>
        </div>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[0.8125rem]"
          style={{ background: "var(--bad-soft)", color: "var(--bad)" }}
        >
          <Icon path={ICONS.alert} size={15} className="mt-[1px] shrink-0" />
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p
          role="status"
          className="mb-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[0.8125rem]"
          style={{ background: "var(--good-soft)", color: "var(--good)" }}
        >
          <Icon path={ICONS.check} size={15} className="mt-[1px] shrink-0" />
          {state.message}
        </p>
      ) : null}

      {/* What is possible for this platform right now */}
      <div
        className="mb-4 flex flex-col gap-2 rounded-lg p-3 text-[0.8125rem] leading-relaxed"
        style={{ background: "var(--bg-elevated)" }}
      >
        {mode === "oauth" ? (
          <p className="flex items-start gap-2">
            <Badge tone="brand">OAuth configured</Badge>
            <span style={{ color: "var(--text-muted)" }}>
              This platform&apos;s client credentials are present, so you can authorise a
              real account.
            </span>
          </p>
        ) : mode === "token" ? (
          <p className="flex items-start gap-2">
            <Badge tone="info">No app needed</Badge>
            <span style={{ color: "var(--text-muted)" }}>
              Fill in the fields below with a token you create yourself and{" "}
              {hasLiveAdapter
                ? "Chorus will publish for real."
                : "Chorus will store it for publishing."}
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-2">
            <Badge>Sandbox only</Badge>
            <span style={{ color: "var(--text-muted)" }}>
              {platform.name} needs a reviewed developer app. Add its client id and
              secret to your environment to enable live publishing. Until then you can
              connect it in sandbox mode and build the whole workflow.
            </span>
          </p>
        )}
        {platform.notes ? (
          <p className="flex items-start gap-1.5" style={{ color: "var(--text-faint)" }}>
            <Icon path={ICONS.info} size={13} className="mt-[2px] shrink-0" />
            {platform.notes}
          </p>
        ) : null}
      </div>

      {/* OAuth path */}
      {mode === "oauth" && !sandbox ? (
        <div className="mb-4">
          <a href={`/api/connect/${platform.key}/start`} className="btn btn-primary">
            <Icon path={ICONS.shield} size={15} />
            Authorise with {platform.name}
          </a>
          <p className="mt-2 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            You will be sent to {platform.name} to approve access, then back here.
          </p>
        </div>
      ) : null}

      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="platform" value={platform.key} />
        {sandbox ? <input type="hidden" name="sandbox" value="on" /> : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="handle">
              Account handle <span style={{ color: "var(--bad)" }}>*</span>
            </label>
            <input
              id="handle"
              name="handle"
              required
              className="input"
              placeholder="yourbrand"
            />
          </div>
          <div>
            <label className="label" htmlFor="displayName">
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              className="input"
              placeholder="Your Brand"
            />
          </div>
        </div>

        {/* Platform-specific credential fields, hidden in sandbox mode where
            they would serve no purpose. */}
        {!sandbox && platform.connectFields.length > 0 ? (
          <div
            className="flex flex-col gap-3 border-t pt-3"
            style={{ borderColor: "var(--border)" }}
          >
            {platform.connectFields.map((f) => (
              <div key={f.name}>
                <label className="label" htmlFor={`field-${f.name}`}>
                  {f.label}
                  {f.required ? <span style={{ color: "var(--bad)" }}> *</span> : null}
                </label>
                <input
                  id={`field-${f.name}`}
                  name={`field_${f.name}`}
                  type={f.type === "password" ? "password" : f.type === "url" ? "url" : "text"}
                  placeholder={f.placeholder}
                  autoComplete="off"
                  className="input"
                />
                {f.help ? (
                  <p className="mt-1 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                    {f.help}
                  </p>
                ) : null}
              </div>
            ))}
            <p
              className="flex items-start gap-1.5 text-[0.6875rem]"
              style={{ color: "var(--text-faint)" }}
            >
              <Icon path={ICONS.shield} size={12} className="mt-[1px] shrink-0" />
              Tokens are encrypted with AES-256-GCM before being stored, and are never
              shown again after you save them.
            </p>
          </div>
        ) : null}

        <label
          className="flex cursor-pointer items-start gap-2 rounded-lg p-2.5 text-[0.8125rem]"
          style={{ background: sandbox ? "var(--info-soft)" : "transparent" }}
        >
          <input
            type="checkbox"
            checked={sandbox}
            disabled={liveImpossible}
            onChange={(e) => setSandbox(e.target.checked)}
            className="mt-[3px]"
          />
          <span>
            <span className="font-medium">Connect in sandbox mode</span>
            <span className="mt-0.5 block text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
              Posts are validated and scheduled exactly as normal but not sent to the
              network. Seeded with a plausible audience so analytics and the agents have
              something to work with.
              {liveImpossible ? " Required until credentials are configured." : ""}
            </span>
          </span>
        </label>

        <div>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? (
              <>
                <Icon path={ICONS.refresh} size={15} className="spin" />
                Connecting…
              </>
            ) : (
              <>
                <Icon path={ICONS.plus} size={15} />
                Connect {platform.name}
              </>
            )}
          </button>
        </div>
      </form>
    </Card>
  );
}
