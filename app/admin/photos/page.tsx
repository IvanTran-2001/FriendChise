import { requireSuperAdminPage } from "@/lib/authz";
import { prisma } from "@/lib/platform/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminPhotosClient } from "./_components/admin-photos-client";

/**
 * Admin photos page — server shell.
 *
 * Fetches only the three summary counts (org logos, org gallery images,
 * feedback screenshots) so the page renders a stats bar instantly.
 * All photo grids are driven by AdminPhotosClient using client-side infinite
 * scroll backed by three dedicated API routes that sign URLs one page at a time.
 */
export default async function AdminPhotosPage() {
  await requireSuperAdminPage();

  const [orgLogosCount, orgImagesCount, feedbackImagesCount] = await Promise.all([
    prisma.organization.count({ where: { image: { not: null } } }),
    prisma.orgImage.count(),
    prisma.feedback.count({ where: { imageUrl: { not: null } } }),
  ]);

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/90 shadow-sm backdrop-blur-xl">
        <CardHeader className="gap-2 border-b border-border/60 bg-muted/30">
          <CardTitle className="text-2xl sm:text-3xl">All photos</CardTitle>
          <CardDescription>
            A single gallery for the public org images, org logos, and dev-only
            feedback screenshots. Images load on demand as you scroll.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <AdminPhotosClient
            orgLogosCount={orgLogosCount}
            orgImagesCount={orgImagesCount}
            feedbackImagesCount={feedbackImagesCount}
          />
        </CardContent>
      </Card>
    </div>
  );
}