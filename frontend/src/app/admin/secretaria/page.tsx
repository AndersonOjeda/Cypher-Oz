import type { Metadata } from "next";
import { Secretary } from "@/features/catalog/secretary";

export const metadata: Metadata = {
  title: "Secretaria IA · TTI",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <Secretary />;
}
