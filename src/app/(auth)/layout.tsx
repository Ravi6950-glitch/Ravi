import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Wordmark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Already signed in - no reason to show a login form.
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left: the form. */}
      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center justify-between">
            <Wordmark />
            <ThemeToggle />
          </div>
          {children}
        </div>
      </main>

      {/* Right: what the product is. Hidden on small screens. */}
      <aside
        className="hidden w-[46%] max-w-[620px] flex-col justify-center gap-8 px-12 lg:flex"
        style={{
          background:
            "linear-gradient(155deg, color-mix(in srgb, var(--brand) 13%, var(--bg-elevated)), var(--bg-elevated) 60%)",
          borderLeft: "1px solid var(--border)",
        }}
      >
        <div>
          <h2 className="text-[1.75rem] font-bold leading-tight tracking-[-0.02em]">
            Every platform.
            <br />
            One voice.
          </h2>
          <p
            className="mt-3 max-w-md text-[0.9375rem] leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            Connect 46 networks, write once and let Chorus reshape it for each
            one, then schedule the lot from a single queue.
          </p>
        </div>

        <ul className="flex flex-col gap-4">
          {[
            {
              title: "One composer, every network",
              body: "Write the idea once. Chorus adapts the length, the hashtags and the format for each platform, and tells you before you break a limit.",
            },
            {
              title: "A queue that just drains",
              body: "Set your posting times once. Drop things in the queue and they go out in the next free slot, in the right order.",
            },
            {
              title: "Agents that work while you don't",
              body: "Seven AI agents run in the background - auditing every profile, learning when your audience shows up, and explaining what moved and why.",
            },
          ].map((f) => (
            <li key={f.title} className="flex gap-3">
              <span
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--brand)" }}
              />
              <div>
                <p className="text-[0.875rem] font-semibold">{f.title}</p>
                <p
                  className="mt-0.5 text-[0.8125rem] leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {f.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
