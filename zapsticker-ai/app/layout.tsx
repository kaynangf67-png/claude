import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ZapSticker AI — Sua foto. Sua voz. Sua figurinha.", template: "%s · ZapSticker AI" },
  description: "Transforme uma foto e um áudio em uma figurinha com som, pronta para compartilhar no WhatsApp.",
  applicationName: "ZapSticker AI",
  appleWebApp: { capable: true, title: "ZapSticker", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070b0d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
