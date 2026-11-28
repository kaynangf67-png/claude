import type { Metadata } from "next";
import { Suspense } from "react";
import { Editor } from "@/components/editor/Editor";

export const metadata: Metadata = { title: "Criar figurinha" };

export default function CriarPage() {
  return (
    <Suspense>
      <Editor />
    </Suspense>
  );
}
