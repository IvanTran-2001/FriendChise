import { FeedbackType } from "@prisma/client";
import { requireSuperAdminPage } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getAllFeedback } from "@/lib/services/feedback";
import { createSignedReadUrls, getPublicUrl } from "@/lib/supabase-storage";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PhotoTile = {
  key: string;
  label: string;
  sublabel: string;
  src: string;
  href: string;
};

function PhotoGrid({
  title,
  description,
  tiles,
}: {
  title: string;
  description: string;
  tiles: PhotoTile[];
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {tiles.length === 0 ? (
        <Card className="border-dashed border-border/70 bg-card/80">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No images found in this section.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tiles.map((tile) => (
            <Card key={tile.key} className="overflow-hidden border-border/70 bg-card/90 shadow-sm backdrop-blur-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tile.src}
                alt={tile.label}
                className="aspect-video w-full object-cover bg-muted"
              />
              <CardContent className="flex flex-col gap-1 p-4">
                <p className="font-medium leading-tight">{tile.label}</p>
                <p className="text-xs text-muted-foreground">{tile.sublabel}</p>
                <a
                  href={tile.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 text-xs font-medium text-primary hover:underline"
                >
                  Open full size
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function AdminPhotosPage() {
  await requireSuperAdminPage();

  const [orgs, orgImages, feedback] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, image: true },
    }),
    prisma.orgImage.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        storagePath: true,
        name: true,
        createdAt: true,
        org: { select: { name: true } },
      },
    }),
    getAllFeedback(),
  ]);

  const feedbackImages = feedback.filter((item) => item.imageUrl);
  const feedbackSignedUrls = await createSignedReadUrls(
    feedbackImages.map((item) => item.imageUrl!),
  );
  const orgImageSignedUrls = await createSignedReadUrls(
    orgImages.map((image) => image.storagePath),
  );

  const orgLogoTiles: PhotoTile[] = orgs
    .filter((org) => org.image)
    .map((org) => ({
      key: org.id,
      label: org.name,
      sublabel: "Organization logo from the public bucket",
      src: getPublicUrl(org.image!),
      href: getPublicUrl(org.image!),
    }));

  const orgImageTiles: PhotoTile[] = orgImages.map((image) => ({
    key: image.id,
    label: image.name ?? "Org image",
    sublabel: image.org?.name ?? image.storagePath,
    src: orgImageSignedUrls.get(image.storagePath) ?? getPublicUrl(image.storagePath),
    href: orgImageSignedUrls.get(image.storagePath) ?? getPublicUrl(image.storagePath),
  }));

  const feedbackImageTiles: PhotoTile[] = feedbackImages.flatMap((item) => {
    const signedUrl = feedbackSignedUrls.get(item.imageUrl!);
    if (!signedUrl) return [];

    return [
      {
        key: item.id,
        label: item.type === FeedbackType.ISSUE ? "Feedback screenshot — issue" : "Feedback screenshot — idea",
        sublabel: `${item.user.email ?? item.user.name ?? "Unknown user"}${item.org ? ` · ${item.org.name}` : ""}`,
        src: signedUrl,
        href: signedUrl,
      },
    ];
  });

  const totalPhotos = orgLogoTiles.length + orgImageTiles.length + feedbackImageTiles.length;

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/90 shadow-sm backdrop-blur-xl">
        <CardHeader className="gap-2 border-b border-border/60 bg-muted/30">
          <CardTitle className="text-2xl sm:text-3xl">All photos</CardTitle>
          <CardDescription>
            A single gallery for the public org images, org logos, and dev-only
            feedback screenshots.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{totalPhotos}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Org logos</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{orgLogoTiles.length}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Feedback images</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{feedbackImageTiles.length}</p>
          </div>
        </CardContent>
      </Card>

      <PhotoGrid
        title="Org logos"
        description="Public bucket images attached to organizations."
        tiles={orgLogoTiles}
      />

      <PhotoGrid
        title="Org gallery images"
        description="Public gallery images stored in the orgImages table."
        tiles={orgImageTiles}
      />

      <PhotoGrid
        title="Feedback screenshots"
        description="Private bucket uploads from feedback submissions."
        tiles={feedbackImageTiles}
      />
    </div>
  );
}