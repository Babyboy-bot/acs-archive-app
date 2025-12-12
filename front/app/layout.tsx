import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeInitializer } from "@/components/ThemeInitializer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ACS Archive - Gestion d'Archives",
  description: "Application de gestion d'archives pour ACS - Assureurs Conseils Service",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-theme-base text-theme-primary`}>
        <ThemeInitializer />
        {children}
      </body>
    </html>
  );
}
