import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import { Card, Icon, ICONS } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex justify-center">
          <Wordmark />
        </div>
        <Card>
          <p className="flex items-center gap-2 text-[1.125rem] font-semibold">
            <Icon path={ICONS.alert} size={18} />
            Page not found
          </p>
          <p className="mt-2 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            That page does not exist. It may have been removed, or the link may be
            incomplete.
          </p>
          <Link href="/" className="btn btn-primary mt-5">
            <Icon path={ICONS.home} size={15} />
            Back to the dashboard
          </Link>
        </Card>
      </div>
    </div>
  );
}
