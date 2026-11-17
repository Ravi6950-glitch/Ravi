"use client";

import { useActionState } from "react";
import { Icon, ICONS } from "@/components/ui";
import { loginAction, type AuthFormState } from "../actions";

const initial: AuthFormState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
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
        <label className="label" htmlFor="email">
          Email
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
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="input"
        />
      </div>

      <button type="submit" className="btn btn-primary mt-1 w-full" disabled={pending}>
        {pending ? (
          <>
            <Icon path={ICONS.refresh} size={15} className="spin" />
            Signing in…
          </>
        ) : (
          <>
            Sign in
            <Icon path={ICONS.chevronRight} size={15} />
          </>
        )}
      </button>
    </form>
  );
}
