import { redirect } from "next/navigation";
import CaddiePreferences from "@/components/caddie/CaddiePreferences";
import { getSettings } from "@/lib/caddie/data";
import { getCaddieSession } from "@/lib/caddie/session";
import { smsConfigured } from "@/lib/caddie/sms";

// A caddie's own say in what they are offered, and how they hear about it.
export const dynamic = "force-dynamic";

export default async function CaddiePreferencesPage() {
  const caddie = await getCaddieSession();
  if (!caddie) redirect("/caddie");

  const settings = await getSettings();

  return (
    <CaddiePreferences
      prefs={caddie.jobPrefs}
      phone={caddie.phone}
      textsOn={caddie.smsOptIn}
      textsLive={settings.smsEnabled && smsConfigured()}
    />
  );
}
