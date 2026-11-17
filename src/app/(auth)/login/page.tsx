import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="rise">
      <h1 className="text-[1.375rem] font-bold tracking-[-0.02em]">Welcome back</h1>
      <p className="mt-1 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
        Sign in to your workspace.
      </p>

      <div className="mt-6">
        <LoginForm />
      </div>

      <p className="mt-6 text-center text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        No account yet?{" "}
        <Link href="/signup" className="font-medium" style={{ color: "var(--brand-text)" }}>
          Create one
        </Link>
      </p>
    </div>
  );
}
