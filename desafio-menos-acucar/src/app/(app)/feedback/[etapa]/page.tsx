import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeedbackView } from "@/components/views/FeedbackView";
import { FEEDBACK_STAGES } from "@/domain/feedback";

type Stage = keyof typeof FEEDBACK_STAGES;
const isStage = (s: string): s is Stage => s in FEEDBACK_STAGES;

export const metadata: Metadata = { title: "Pesquisa da Primeira Turma" };

export function generateStaticParams() {
  return Object.keys(FEEDBACK_STAGES).map((etapa) => ({ etapa }));
}

export const dynamicParams = false;

export default async function FeedbackPage({ params }: PageProps<"/feedback/[etapa]">) {
  const { etapa } = await params;
  if (!isStage(etapa)) notFound();
  return <FeedbackView key={etapa} stage={etapa} />;
}
