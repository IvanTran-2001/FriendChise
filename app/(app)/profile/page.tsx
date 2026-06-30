import Image from "next/image";
import { auth } from "@/auth";
import { requireUserPage } from "@/lib/authz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ThumbsUp } from "lucide-react";

import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  await requireUserPage();
  const session = await auth();
  const user = session?.user;

  if (!user) return null;

  const [upvotes, downvotes] = await Promise.all([
    prisma.taskCommentVote.count({
      where: { userId: user.id, type: "UPVOTE" },
    }),
    prisma.taskCommentVote.count({
      where: { userId: user.id, type: "DOWNVOTE" },
    }),
  ]);

  return (
    <div className="max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Profile</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-border/70">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name ?? "User"}
                  width={64}
                  height={64}
                  className="rounded-full object-cover"
                />
              ) : (
                <span className="text-xl font-semibold text-primary-foreground">
                  {user.name?.[0]?.toUpperCase() ?? "?"}
                </span>
              )}
            </div>
            <div>
              <CardTitle className="text-lg">{user.name ?? "User"}</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Account details
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
            <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </p>
              <p className="text-sm font-medium truncate mt-0.5">
                {user.email}
              </p>
            </div>
          </div>
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
              <ThumbsUp className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex gap-6">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Upvotes
                    </p>
                    <p className="text-sm font-medium mt-0.5">{upvotes}</p>
                  </div>
                  <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Downvotes
                  </p>
                  <p className="text-sm font-medium mt-0.5">{downvotes}</p>
                  </div>
                </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
