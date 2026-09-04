import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans-loaded",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-loaded",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://aura.akanksha.dev"),
  title: "AURA — AI Voice Incident Commander",
  description:
    "Voice AI war room participant powered by Agora ConvAI. Real-time incident coordination, epistemic classification, and automated SRE postmortems.",
  applicationName: "AURA",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "AURA — AI Voice Incident Commander",
    description:
      "Voice AI war room participant powered by Agora ConvAI. Real-time incident coordination, epistemic classification, and automated SRE postmortems.",
    siteName: "AURA",
    type: "website",
    url: "https://aura.akanksha.dev",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AURA — AI Voice Incident Commander",
    description:
      "Voice AI war room participant powered by Agora ConvAI. Real-time incident coordination, epistemic classification, and automated SRE postmortems.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
