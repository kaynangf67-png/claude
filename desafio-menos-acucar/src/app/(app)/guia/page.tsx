import type { Metadata } from "next";
import { GuideView } from "@/components/views/GuideView";

export const metadata: Metadata = { title: "Guia" };

export default function Page() {
  return <GuideView />;
}
