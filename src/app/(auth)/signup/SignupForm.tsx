"use client";

import { useActionState, useEffect, useState } from "react";
import { Icon, ICONS } from "@/components/ui";
import { signupAction, type AuthFormState } from "../actions";

const initial: AuthFormState = {};

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, initial);
  const [password, setPassword] = useState("");
  const [timezone, setTimezone] = useState("UTC");

  // Pick up the browser's timezone so the queue uses the right clock from the
  // start. Resolved after mount, since the server cannot know it.
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    } catch {
      /* keep UTC */
    }
  }, []);

  const strength = scorePassword(password);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="timezone" value={timezone} />

      {state.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-[0.8125rem]"
          style={{ background: "var(--bad-soft)", color: "var(--bad)" }}
        >
          <Icon path={ICONS.alert} size={15} className="mt-[1px] shrink-0" />
          {state.error}
        </p>
      ) : null}

      <div>
        <label className="label" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          defaultValue={state.values?.name ?? ""}
          placeholder="Alex Morgan"
          className="input"
        />
      </div>

      <div>
        <label className="label" htmlFor="email">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email ?? ""}
          placeholder="you@company.com"
          className="input"
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="input"
          aria-describedby="password-strength"
        />
        <div id="password-strength" className="mt-1.5 flex items-center gap-2">
          <span className="flex flex-1 gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="h-[3px] flex-1 rounded-full transition-colors"
                style={{
                  background:
                    password.length === 0
                      ? "var(--border)"
                      : i < strength.level
                        ? strength.color
                        : "var(--border)",
                }}
              />
            ))}
          </span>
          <span
            className="w-20 shrink-0 text-right text-[0.6875rem]"
            style={{ color: "var(--text-faint)" }}
          >
            {password.length === 0 ? "" : strength.label}
          </span>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="workspaceName">
          Workspace name{" "}
          <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          id="workspaceName"
          name="workspaceName"
          type="text"
          defaultValue={state.values?.workspaceName ?? ""}
          placeholder="Acme Social"
          className="input"
        />
      </div>

      <button type="submit" className="btn btn-primary mt-1 w-full" disabled={pending}>
        {pending ? (
          <>
            <Icon path={ICONS.refresh} size={15} className="spin" />
            Creating your workspace…
          </>
        ) : (
          <>
            Create workspace
            <Icon path={ICONS.chevronRight} size={15} />
          </>
        )}
      </button>
    </form>
  );
}

/** A rough strength signal - length matters most, variety next. */
function scorePassword(pw: string): { level: number; label: string; color: string } {
  if (pw.length === 0) return { level: 0, label: "", color: "var(--border)" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  const level = Math.max(1, Math.min(4, score));
  return [
    { level: 1, label: "Weak", color: "var(--bad)" },
    { level: 2, label: "Fair", color: "var(--warn)" },
    { level: 3, label: "Good", color: "var(--info)" },
    { level: 4, label: "Strong", color: "var(--good)" },
  ][level - 1];
}
