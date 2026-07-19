import type { Metadata } from "next";

// NOTE: no global stylesheet here on purpose. Each section imports its own CSS
// (events design system vs. the MHI serif design system) in its own layout, so
// the two never collide on a shared page.

export const metadata: Metadata = {
  title: "Pasatiempo App",
  description: "Umbrella app for Pasatiempo's event pages.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
