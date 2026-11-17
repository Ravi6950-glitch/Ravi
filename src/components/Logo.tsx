/**
 * The Chorus mark: five rising bars, like voices entering one after another.
 * Drawn rather than imported so it inherits the theme and scales cleanly.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Chorus"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="chorus-mark" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="55%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#chorus-mark)" />
      <g fill="#fff" fillOpacity="0.96">
        <rect x="7" y="18" width="3" height="7" rx="1.5" />
        <rect x="12" y="14" width="3" height="11" rx="1.5" fillOpacity="0.85" />
        <rect x="17" y="9" width="3" height="16" rx="1.5" />
        <rect x="22" y="13" width="3" height="12" rx="1.5" fillOpacity="0.72" />
      </g>
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <Logo size={size} />
      <span className="text-[1.0625rem] font-bold tracking-[-0.02em]">Chorus</span>
    </span>
  );
}
