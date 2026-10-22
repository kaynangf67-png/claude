import type { Metadata } from "next";
import { ReportView } from "@/components/views/ReportView";

export const metadata: Metadata = { title: "Relatório final" };

export default function Page() {
  return <ReportView />;
}
