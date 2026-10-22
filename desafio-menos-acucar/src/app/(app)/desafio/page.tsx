import type { Metadata } from "next";
import { ChallengeMapView } from "@/components/views/ChallengeMapView";

export const metadata: Metadata = { title: "Desafio" };

export default function Page() {
  return <ChallengeMapView />;
}
