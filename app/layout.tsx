import type { Metadata, Viewport } from "next";
import { Urbanist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { PwaRegister } from "@/components/pwa-register";

const urbanist = Urbanist({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "abovo — Recipe App",
  description: "From recipe capture to dinner, all in one place.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "abovo — Recipe App",
    description: "From recipe capture to dinner, all in one place.",
    images: [
      {
        url: "/sharing_image.png",
        width: 1200,
        height: 630,
        alt: "abovo recipe app preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "abovo — Recipe App",
    description: "From recipe capture to dinner, all in one place.",
    images: ["/sharing_image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "abovo",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#c45a2c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={urbanist.variable}>
        <PwaRegister />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
