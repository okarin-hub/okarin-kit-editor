import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/i18n/I18nProvider";

export const metadata: Metadata = {
  title: "Okarin Kit Editor | PES 2021 Kit Editor",
  description: "Create and edit custom PES 2021 kits with 2D part canvas rendering and texture export.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-i18n-pending="">
      <body className="antialiased h-screen w-screen overflow-hidden bg-[#0d1017] text-slate-100">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
