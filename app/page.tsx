import { redirect } from "next/navigation";

// The bare address is for staff: the proxy asks signed-out visitors to sign
// in first, then everyone lands on the dashboard. The public sites have their
// own addresses (/events, /mhi, /sombrero).
export default function Home() {
  redirect("/admin");
}
