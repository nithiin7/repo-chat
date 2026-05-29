import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CodeLens — Ask anything about any codebase",
  description: "RAG-powered codebase Q&A. Index a GitHub or Bitbucket repo and chat with it instantly.",
};

const RootLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <html
    lang="en"
    suppressHydrationWarning
    className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
  >
    <body className="min-h-full flex flex-col">
      <Providers>{children}</Providers>
    </body>
  </html>
)

export default RootLayout
