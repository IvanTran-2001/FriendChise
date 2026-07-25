import { requireSuperAdminPage } from "@/lib/authz";
import { AdminLayoutShell } from "./_components/admin-layout-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Consolidate security at the layout level
  await requireSuperAdminPage();

  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}