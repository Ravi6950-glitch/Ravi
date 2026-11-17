"use client";

import { useState } from "react";
import { Icon, ICONS } from "@/components/ui";
import { reschedulePostAction } from "../actions";

/**
 * A reschedule button that expands into a datetime picker only when needed,
 * so a list of 40 queued posts is not a wall of date inputs.
 */
export function RescheduleControl({
  postId,
  current,
}: {
  postId: string;
  current: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() => toLocalInput(current ?? new Date().toISOString()));

  if (!open) {
    return (
      <button type="button" className="btn btn-sm w-full" onClick={() => setOpen(true)}>
        <Icon path={ICONS.clock} size={13} />
        Reschedule
      </button>
    );
  }

  return (
    <form action={reschedulePostAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="scheduledAt" value={toIso(value)} />
      <input
        type="datetime-local"
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="New date and time"
      />
      <div className="flex gap-1.5">
        <button type="submit" className="btn btn-primary btn-sm flex-1">
          Save
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
          <Icon path={ICONS.x} size={13} />
        </button>
      </div>
    </form>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(local: string): string {
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
