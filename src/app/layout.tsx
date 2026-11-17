import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Chorus - social command centre",
    template: "%s - Chorus",
  },
  description:
    "Chorus connects every social network you publish to, schedules everything from one queue, and runs AI agents in the background that watch your performance and tell you what to do next.",
  applicationName: "Chorus",
  authors: [{ name: "Chorus" }],
  robots: { index: false, follow: false }, // a private workspace tool
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0d14" },
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Apply the saved theme before first paint. Without this the page
          would flash the default theme on every navigation.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('chorus-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
