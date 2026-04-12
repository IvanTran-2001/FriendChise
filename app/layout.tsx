import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import "./globals.css";

// Using system fonts as fallback to avoid network requests during build
const fontVariables = {
  sans: "--font-sans",
  logo: "--font-logo",
  mono: "--font-mono",
};

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
        className="antialiased"
        suppressHydrationWarning
        style={{
          "--font-sans": "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          "--font-logo": "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          "--font-mono": "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace",
        } as React.CSSProperties}
      >
        <TooltipProvider>
          {children}
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}