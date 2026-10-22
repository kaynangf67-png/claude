import type { Metadata } from "next";
import { ProfileView } from "@/components/views/ProfileView";

export const metadata: Metadata = { title: "Perfil" };

export default function Page() {
  return <ProfileView />;
}
