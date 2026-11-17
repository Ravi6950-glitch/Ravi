"use client";

import { useActionState } from "react";
import { Card, Icon, ICONS, SectionHeader } from "@/components/ui";
import {
  addMediaByUrlAction,
  updatePasswordAction,
  updateProfileAction,
  updateWorkspaceAction,
  type ActionState,
} from "../actions";

const initial: ActionState = {};

/** Shared feedback banner so every form reports the same way. */
function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="mb-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[0.8125rem]"
        style={{ background: "var(--bad-soft)", color: "var(--bad)" }}
      >
        <Icon path={ICONS.alert} size={15} className="mt-[1px] shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p
        role="status"
        className="mb-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[0.8125rem]"
        style={{ background: "var(--good-soft)", color: "var(--good)" }}
      >
        <Icon path={ICONS.check} size={15} className="mt-[1px] shrink-0" />
        {state.message}
      </p>
    );
  }
  return null;
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? (
        <>
          <Icon path={ICONS.refresh} size={15} className="spin" />
          Saving…
        </>
      ) : (
        <>
          <Icon path={ICONS.check} size={15} />
          {label}
        </>
      )}
    </button>
  );
}

export function ProfileForm({
  name,
  email,
  jobTitle,
  timezone,
}: {
  name: string;
  email: string;
  jobTitle: string;
  timezone: string;
}) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);

  return (
    <Card>
      <SectionHeader title="Your profile" icon={ICONS.users} />
      <Feedback state={state} />
      <form action={action} className="flex flex-col gap-3">
        <div>
          <label className="label" htmlFor="p-name">
            Name
          </label>
          <input id="p-name" name="name" defaultValue={name} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="p-email">
            Email
          </label>
          <input
            id="p-email"
            value={email}
            disabled
            className="input"
            style={{ opacity: 0.6 }}
          />
          <p className="mt-1 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
            Your email is your sign-in and cannot be changed here.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="p-title">
              Job title
            </label>
            <input
              id="p-title"
              name="jobTitle"
              defaultValue={jobTitle}
              className="input"
              placeholder="Head of social"
            />
          </div>
          <div>
            <label className="label" htmlFor="p-tz">
              Timezone
            </label>
            <input
              id="p-tz"
              name="timezone"
              defaultValue={timezone}
              className="input"
              placeholder="Europe/London"
            />
          </div>
        </div>
        <div>
          <SubmitButton pending={pending} label="Save profile" />
        </div>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, initial);

  return (
    <Card>
      <SectionHeader title="Password" icon={ICONS.shield} />
      <Feedback state={state} />
      <form action={action} className="flex flex-col gap-3">
        <div>
          <label className="label" htmlFor="pw-current">
            Current password
          </label>
          <input
            id="pw-current"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className="input"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pw-new">
              New password
            </label>
            <input
              id="pw-new"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="pw-confirm">
              Confirm it
            </label>
            <input
              id="pw-confirm"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="input"
            />
          </div>
        </div>
        <div>
          <SubmitButton pending={pending} label="Change password" />
        </div>
      </form>
    </Card>
  );
}

export function WorkspaceForm({
  name,
  slug,
  brandVoice,
  timezone,
  weekStart,
  canManage,
}: {
  name: string;
  slug: string;
  brandVoice: string;
  timezone: string;
  weekStart: number;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(updateWorkspaceAction, initial);

  return (
    <Card>
      <SectionHeader
        title="Workspace"
        subtitle={`chorus.app/${slug}`}
        icon={ICONS.settings}
      />
      <Feedback state={state} />
      <form action={action} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="w-name">
              Workspace name
            </label>
            <input
              id="w-name"
              name="name"
              defaultValue={name}
              required
              className="input"
              disabled={!canManage}
            />
          </div>
          <div>
            <label className="label" htmlFor="w-tz">
              Timezone
            </label>
            <input
              id="w-tz"
              name="timezone"
              defaultValue={timezone}
              className="input"
              disabled={!canManage}
            />
          </div>
          <div>
            <label className="label" htmlFor="w-week">
              Week starts on
            </label>
            <select
              id="w-week"
              name="weekStart"
              defaultValue={String(weekStart)}
              className="select"
              disabled={!canManage}
            >
              <option value="1">Monday</option>
              <option value="0">Sunday</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="w-voice">
            Brand voice
          </label>
          <textarea
            id="w-voice"
            name="brandVoice"
            rows={3}
            defaultValue={brandVoice}
            className="textarea"
            disabled={!canManage}
            placeholder="Direct and practical. We explain the trade-off rather than claiming there isn't one. No hype, no emoji."
          />
          <p className="mt-1 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
            Every agent that writes copy is given this. The more specific it is, the
            less you will have to rewrite.
          </p>
        </div>

        {canManage ? (
          <div>
            <SubmitButton pending={pending} label="Save workspace" />
          </div>
        ) : (
          <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            Only owners and admins can change workspace settings.
          </p>
        )}
      </form>
    </Card>
  );
}

export function MediaForm() {
  const [state, action, pending] = useActionState(addMediaByUrlAction, initial);

  return (
    <>
      <Feedback state={state} />
      <form action={action} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[240px] flex-1">
          <label className="label" htmlFor="m-url">
            Media URL
          </label>
          <input
            id="m-url"
            name="url"
            type="url"
            required
            className="input"
            placeholder="https://images.example.com/launch.jpg"
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="label" htmlFor="m-alt">
            Alt text
          </label>
          <input
            id="m-alt"
            name="alt"
            className="input"
            placeholder="Describe the image for screen readers"
          />
        </div>
        <div className="min-w-[110px]">
          <label className="label" htmlFor="m-kind">
            Type
          </label>
          <select id="m-kind" name="kind" defaultValue="image" className="select">
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="gif">GIF</option>
            <option value="document">Document</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? (
            <>
              <Icon path={ICONS.refresh} size={15} className="spin" />
              Adding…
            </>
          ) : (
            <>
              <Icon path={ICONS.plus} size={15} />
              Add
            </>
          )}
        </button>
      </form>
    </>
  );
}
