import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MissionView } from "@/components/views/MissionView";
import { CHALLENGE_DAYS, getMission } from "@/domain/missions";

function parseDay(raw: string): number | null {
  if (!/^\d{1,2}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= CHALLENGE_DAYS ? n : null;
}

export async function generateMetadata({ params }: PageProps<"/desafio/[dia]">): Promise<Metadata> {
  const { dia } = await params;
  const day = parseDay(dia);
  const m = day ? getMission(day) : undefined;
  return { title: m ? `Dia ${m.day}: ${m.title}` : "Missão" };
}

export function generateStaticParams() {
  return Array.from({ length: CHALLENGE_DAYS }, (_, i) => ({ dia: String(i + 1) }));
}

export const dynamicParams = false;

export default async function MissionPage({ params }: PageProps<"/desafio/[dia]">) {
  const { dia } = await params;
  const day = parseDay(dia);
  if (!day) notFound();
  return <MissionView key={day} day={day} />;
}
