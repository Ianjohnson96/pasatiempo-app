import type { Metadata, Viewport } from "next";
import "./invitational.css";

// Loads only the Invitational stylesheet (scoped under .mci), for /invitational
// routes — isolated from the other sections, same as El Sombrero and MHI.
export const metadata: Metadata = {
  title: "Men's Club Invitational 2027 · Pasatiempo",
  description:
    "The Pasatiempo Men's Club Invitational — schedule, flights, format, the field, wagering, prizes and player information.",
  icons: { icon: "/logo-mark.png" },
  // The card a shared link shows (texts, social posts): the dawn aerial,
  // the crest, PASATIEMPO. Next resolves the path against the deployment's
  // own address.
  openGraph: {
    type: "website",
    title: "Men's Club Invitational 2027 · Pasatiempo",
    description: "The Pasatiempo Men's Club Invitational — Alister MacKenzie's Pasatiempo, since 1929.",
    images: [
      {
        url: "/invitational/img/og-invitational.jpg",
        width: 1200,
        height: 630,
        alt: "PASATIEMPO — The Men's Club Invitational, 2027",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Men's Club Invitational 2027 · Pasatiempo",
    description: "The Pasatiempo Men's Club Invitational — Alister MacKenzie's Pasatiempo, since 1929.",
    images: ["/invitational/img/og-invitational.jpg"],
  },
};

export const viewport: Viewport = { themeColor: "#16294a" };

export default function InvitationalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
