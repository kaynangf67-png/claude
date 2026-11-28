import type { Metadata } from "next";
import { Gallery } from "@/components/gallery/Gallery";

export const metadata: Metadata = { title: "Minhas figurinhas" };

export default function MinhasFigurinhasPage() {
  return <Gallery />;
}
