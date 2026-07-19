import type { Metadata, Viewport } from "next";
import "./mhi.css";

// The MHI section loads ONLY its own stylesheet (Cormorant + warm serif design),
// scoped to /mhi routes. The events design system is imported by the events /
// admin layouts instead, so the two never collide.
export const metadata: Metadata = {
  title: "Marion Hollins Invitational 2026 · Pasatiempo Golf Club",
  description:
    "The 2026 Marion Hollins Invitational at Pasatiempo Golf Club — schedule, flights, formats, the Horse Race, parimutuel betting, and contests.",
  icons: { icon: "/mhi/images/emblem.png" },
};

export const viewport: Viewport = { themeColor: "#163c28" };

export default function MhiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
