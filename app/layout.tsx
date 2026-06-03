import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Local Image Studio",
  description: "A local-first GPT image workspace with SQLite queue and Material You UI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
