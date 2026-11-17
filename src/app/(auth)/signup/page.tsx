import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Create your workspace" };

export default function SignupPage() {
  return (
    <div className="rise">
      <h1 className="text-[1.375rem] font-bold tracking-[-0.02em]">
        Create your workspace
      </h1>
      <p className="mt-1 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
        Free, no card. You can invite your team afterwards.
      </p>

      <div className="mt-6">
        <SignupForm />
      </div>

      <p className="mt-6 text-center text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        Already have an account?{" "}
        <Link href="/login" className="font-medium" style={{ color: "var(--brand-text)" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
