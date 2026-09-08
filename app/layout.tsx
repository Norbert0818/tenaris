import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Comandă de grup",
  description: "Comenzi de grup la serviciu, cu produse, cantități și centralizare automată.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <body className="antialiased">{children}</body>
    </html>
  );
}
