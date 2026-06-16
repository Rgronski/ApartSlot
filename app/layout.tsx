import type { Metadata } from "next";
import "./globals.css";
import { APP_VERSION } from "@/lib/app-version";

export const metadata: Metadata = {
  title: "Rezerwacje apartamentu",
  description: "System do obslugi rezerwacji apartamentu krotkoterminowego.",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pl">
      <body>
        {children}
        <div className="app-version-badge">Wersja {APP_VERSION}</div>
      </body>
    </html>
  );
}
