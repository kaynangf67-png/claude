import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/quiz/OnboardingFlow";

export const metadata: Metadata = { title: "Questionário inicial" };

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
