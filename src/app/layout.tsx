import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Explorer",
  description: "Browse and compare AI agent source code with DeepSeek-powered analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0d1117] text-gray-300 antialiased overflow-hidden">{children}</body>
    </html>
  );
}
