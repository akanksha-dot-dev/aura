import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-sans-loaded",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono-loaded",
  weight: ["400", "500", "600"],
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
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
