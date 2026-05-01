import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Image Studio",
  description: "Modern image generation studio using OpenAI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body>{children}</body>
    </html>
  );
}
