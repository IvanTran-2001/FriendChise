"use client";

import { useSidebar, SidebarTrigger } from "@/components/ui/sidebar";
import { Logo } from "@/components/layout/logo";
import Link from "next/link";

/**
 * Wraps SidebarTrigger so it fades out smoothly when the sidebar is open.
 * When the sidebar is open the user can close it from inside, so the
 * navbar trigger becomes redundant and is hidden to reduce clutter.
 */
export function NavbarSidebarTrigger() {
  const { open } = useSidebar();
  if (open) return null;
  return (
    <SidebarTrigger
      className="transition-all duration-200 ease-in-out opacity-100 translate-x-0"
    />
  );
}

/**
 * Spacer between the navbar logo and org switcher — hidden when the sidebar
 * is open so the org switcher doesn't float to the right unnecessarily.
 */
export function NavbarLogoSpacer() {
  const { open } = useSidebar();
  return open ? null : <div className="w-3" />;
}

/**
 * Navbar logo — fades out when the sidebar is open (the sidebar already
 * shows its own logo, so the navbar one becomes duplicate clutter).
 */
export function NavbarLogo() {
  const { open } = useSidebar();
  if (open) return null;
  return (
    <Link
      href="/"
      className="rounded-lg px-2 py-1 -mx-2 -my-1 hover:bg-primary/8 hover:ring-1 hover:ring-primary/30 transition-all duration-200 ease-in-out"
    >
      <Logo />
    </Link>
  );
}