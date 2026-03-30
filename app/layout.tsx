import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FriendChise",
  description: "Franchise management made simple.",
};

/**
 * Root HTML shell shared by every page.
 *
 * Responsibilities:
 * - Injects Geist Sans and Geist Mono CSS variables for the design system.
 * - Wraps the tree in `TooltipProvider` so any component can render a tooltip
 *   without mounting its own provider.
 * - Mounts the Sonner `Toaster` globally so server actions and client code can
 *   call `toast()` from anywhere.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <TooltipProvider>
          {children}
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
