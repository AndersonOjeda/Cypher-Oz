import type { Metadata } from "next";
import { SettingsManager } from "@/features/configuration/settings-manager";

export const metadata: Metadata = {
  title: "Configuración · Cypher Oz",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <SettingsManager />;
}
