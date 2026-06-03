import { redirect } from "next/navigation";
import { hasConfiguredApiKey } from "@/lib/settings";
import { StudioApp } from "@/components/studio/StudioApp";

export default async function Home() {
  const ready = await hasConfiguredApiKey();
  if (!ready) redirect("/setup");
  return <StudioApp />;
}
