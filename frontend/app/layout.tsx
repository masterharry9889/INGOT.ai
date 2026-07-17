import type { Metadata } from "next";
import "./globals.css";
import Link from 'next/link';
import { Settings, MessageSquare, Network, PenTool } from 'lucide-react';

export const metadata: Metadata = {
  title: "BrainWeb.ai - AI Orchestration",
  description: "Enterprise Multi-Agent Orchestration Engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="app-container" suppressHydrationWarning>
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
