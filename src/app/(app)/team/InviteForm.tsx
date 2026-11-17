"use client";

import { useActionState } from "react";
import { Card, Icon, ICONS, SectionHeader } from "@/components/ui";
import { inviteMemberAction, type ActionState } from "../actions";

const initial: ActionState = {};

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteMemberAction, initial);

  return (
    <Card>
      <SectionHeader
        title="Invite someone"
        subtitle="If they already have a Chorus account they are added immediately; otherwise you get a link to send them."
        icon={ICONS.plus}
      />

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
          <span className="break-all">{state.message}</span>
        </p>
      ) : null}

      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="invite-email">
            Email address
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            className="input"
            placeholder="teammate@company.com"
          />
        </div>
        <div className="min-w-[150px]">
          <label className="label" htmlFor="invite-role">
            Role
          </label>
          <select id="invite-role" name="role" defaultValue="EDITOR" className="select">
            <option value="ADMIN">Admin</option>
            <option value="EDITOR">Editor</option>
            <option value="CONTRIBUTOR">Contributor</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? (
            <>
              <Icon path={ICONS.refresh} size={15} className="spin" />
              Inviting…
            </>
          ) : (
            <>
              <Icon path={ICONS.send} size={15} />
              Send invite
            </>
          )}
        </button>
      </form>
    </Card>
  );
}
