"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, ICONS } from "./ui";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { logoutAction } from "@/app/(app)/actions";

export interface NavCounts {
  queued: number;
  needsApproval: number;
  unreadInsights: number;
  accounts: number;
}

const NAV: Array<{
  href: string;
  label: string;
  icon: string;
  badge?: keyof NavCounts;
  group: string;
}> = [
  { href: "/", label: "Dashboard", icon: ICONS.home, group: "Overview" },
  { href: "/composer", label: "Composer", icon: ICONS.compose, group: "Publish" },
  { href: "/calendar", label: "Calendar", icon: ICONS.calendar, group: "Publish" },
  { href: "/queue", label: "Queue", icon: ICONS.queue, badge: "queued", group: "Publish" },
  { href: "/analytics", label: "Analytics", icon: ICONS.chart, group: "Measure" },
  {
    href: "/insights",
    label: "Insights",
    icon: ICONS.bulb,
    badge: "unreadInsights",
    group: "Measure",
  },
  { href: "/agents", label: "AI agents", icon: ICONS.agent, group: "Automate" },
  {
    href: "/accounts",
    label: "Connections",
    icon: ICONS.link,
    badge: "accounts",
    group: "Automate",
  },
  { href: "/team", label: "Team", icon: ICONS.users, group: "Workspace" },
  { href: "/settings", label: "Settings", icon: ICONS.settings, group: "Workspace" },
];

const GROUPS = ["Overview", "Publish", "Measure", "Automate", "Workspace"];

export function Sidebar({
  user,
  counts,
}: {
  user: {
    name: string;
    email: string;
    avatarColor: string;
    role: string;
    workspace: { name: string; plan: string };
  };
  counts: NavCounts;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const nav = (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {GROUPS.map((group) => {
        const items = NAV.filter((n) => n.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group}>
            <p
              className="mb-1.5 px-2.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "var(--text-faint)" }}
            >
              {group}
            </p>
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active = isActive(item.href);
                const badgeValue = item.badge ? counts[item.badge] : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-[0.4375rem] text-[0.8125rem] font-medium transition-colors"
                      style={{
                        background: active ? "var(--brand-soft)" : "transparent",
                        color: active ? "var(--brand-text)" : "var(--text-muted)",
                      }}
                    >
                      <Icon path={item.icon} size={16} className="shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badgeValue > 0 ? (
                        <span
                          className="min-w-[1.25rem] rounded-full px-1.5 py-[0.0625rem] text-center text-[0.6875rem] font-semibold tabular-nums"
                          style={{
                            background: active ? "var(--brand)" : "var(--bg-elevated)",
                            color: active ? "#fff" : "var(--text-muted)",
                          }}
                        >
                          {badgeValue > 99 ? "99+" : badgeValue}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t px-3 py-3" style={{ borderColor: "var(--border)" }}>
      <div className="mb-2 flex items-center gap-2.5 px-1">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-bold text-white"
          style={{ background: user.avatarColor }}
          aria-hidden="true"
        >
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-semibold">{user.name}</p>
          <p className="truncate text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
            {user.role.charAt(0) + user.role.slice(1).toLowerCase()} ·{" "}
            {user.workspace.name}
          </p>
        </div>
      </div>
      <div className="flex gap-1.5">
        <ThemeToggle />
        <form action={logoutAction} className="flex-1">
          <button type="submit" className="btn btn-sm w-full" title="Sign out">
            <Icon path={ICONS.logout} size={14} />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-2.5 lg:hidden"
        style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
      >
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="chorus-sidebar"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          <Icon path={open ? ICONS.x : ICONS.queue} size={16} />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <Logo size={22} />
          <span className="text-[0.9375rem] font-bold tracking-[-0.02em]">Chorus</span>
        </Link>
      </header>

      {/* Backdrop for the mobile drawer */}
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: "rgb(0 0 0 / 0.5)" }}
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          tabIndex={-1}
        />
      ) : null}

      <aside
        id="chorus-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3.5"
          style={{ borderColor: "var(--border)" }}
        >
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={26} />
            <span>
              <span className="block text-[0.9375rem] font-bold leading-none tracking-[-0.02em]">
                Chorus
              </span>
              <span
                className="mt-[3px] block text-[0.625rem] leading-none"
                style={{ color: "var(--text-faint)" }}
              >
                Social command centre
              </span>
            </span>
          </Link>
          <button
            type="button"
            className="btn btn-sm lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <Icon path={ICONS.x} size={15} />
          </button>
        </div>

        {nav}
        {footer}
      </aside>
    </>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
