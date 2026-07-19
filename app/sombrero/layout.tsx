import type { Metadata, Viewport } from "next";
import "./sombrero.css";

// Loads only the El Sombrero stylesheet (its own warm serif design), scoped to
// /sombrero routes — isolated from the events design system, same as MHI.
export const metadata: Metadata = {
  title: "El Sombrero 2026 · Pasatiempo Men's Club",
  description:
    "El Sombrero 2026 at Pasatiempo — schedule, flights, format, alternate shot, the Horserace, wagering, and prizes.",
  icons: { icon: "/sombrero/img/img1.png" },
};

export const viewport: Viewport = { themeColor: "#163c28" };

export default function SombreroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
