import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
