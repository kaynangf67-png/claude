import type { Metadata } from "next";
import { AdminView } from "@/components/views/AdminView";

export const metadata: Metadata = { title: "Painel do fundador", robots: { index: false, follow: false } };

export default function Page() {
  return <AdminView />;
}
