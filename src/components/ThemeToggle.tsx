"use client";

import { useEffect, useState } from "react";
import { Icon, ICONS } from "./ui";

/**
 * Light/dark switch. The initial theme is applied by an inline script in the
 * root layout, so this component only has to keep up with it after mount -
 * which is why it renders a neutral placeholder on the server.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("chorus-theme", next);
    } catch {
      // Private browsing can block storage; the toggle still works for this visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-sm"
      aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
      title={theme === "light" ? "Dark theme" : "Light theme"}
    >
      <Icon path={theme === "light" ? ICONS.moon : ICONS.sun} size={15} />
    </button>
  );
}
