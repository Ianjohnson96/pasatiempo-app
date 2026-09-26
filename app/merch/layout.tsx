// Sign-in, account and admin pages for the merchandise program. (The program
// itself is served by app/merch/route.ts as a standalone HTML page.)
import "./merch.css";

export const metadata = {
  title: "Pasatiempo Merchandise Program",
  robots: { index: false, follow: false },
};

export default function MerchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
