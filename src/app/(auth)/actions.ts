"use server";

import { redirect } from "next/navigation";
import { signIn, signUp } from "@/lib/auth";

export interface AuthFormState {
  error?: string;
  values?: { email?: string; name?: string; workspaceName?: string };
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password.", values: { email } };
  }

  const result = await signIn({ email, password });
  if (!result.ok) {
    return { error: result.error, values: { email } };
  }
  // redirect() throws, so it must sit outside the try/catch above.
  redirect("/");
}

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const workspaceName = String(formData.get("workspaceName") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "UTC").trim();

  const values = { email, name, workspaceName };

  const result = await signUp({
    name,
    email,
    password,
    workspaceName: workspaceName || undefined,
    timezone: timezone || "UTC",
  });
  if (!result.ok) {
    return { error: result.error, values };
  }
  redirect("/?welcome=1");
}
