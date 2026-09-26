import "../globals.css";
import type { Metadata } from "next";

// The caddie portal installs as its own app, separate from the Events one at
// app/manifest.ts. That is not cosmetic: iPhones only deliver web push to a
// site the user has added to their home screen, and job alerts are the whole
// reason this section exists.
export const metadata: Metadata = {
  title: "Pasatiempo Caddies",
  manifest: "/caddie.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Caddies",
    statusBarStyle: "default",
  },
};

export default function CaddieLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
