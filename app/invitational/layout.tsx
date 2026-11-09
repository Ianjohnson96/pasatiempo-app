import type { Metadata, Viewport } from "next";
import "./invitational.css";

// Loads only the Invitational stylesheet (scoped under .mci), for /invitational
// routes — isolated from the other sections, same as El Sombrero and MHI.
export const metadata: Metadata = {
  title: "Men's Club Invitational 2027 · Pasatiempo",
  description:
    "The Pasatiempo Men's Club Invitational — schedule, flights, format, the field, wagering, prizes and player information.",
  icons: { icon: "/logo-mark.png" },
};

export const viewport: Viewport = { themeColor: "#16294a" };

export default function InvitationalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
