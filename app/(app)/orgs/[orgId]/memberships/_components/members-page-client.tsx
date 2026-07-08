"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { MembersSidebarContent } from "./members-sidebar-content";
import { MembersView } from "./members-view-infinite";
import { usePersistedState } from "@/hooks/use-persisted-state";

type Role = { id: string; name: string; color: string };

type Member = {
  id: string;
  userId: string | null;
  botName: string | null;
  status: "ACTIVE" | "RESTRICTED";
  workingDays: string[];
  joinedAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  memberRoles: { role: { id: string; name: string; color: string } }[];
};

type MemberApiResponse = Omit<Member, "joinedAt"> & {
  joinedAt: string;
};

function normalizeMember(member: MemberApiResponse): Member {
  return {
    ...member,
    joinedAt: new Date(member.joinedAt),
  };
}

function mergeUniqueMembers(existing: Member[], incoming: Member[]) {
  const byId = new Map<string, Member>();
  for (const member of existing) byId.set(member.id, member);
  for (const member of incoming) byId.set(member.id, member);
  return Array.from(byId.values());
}

interface MembersPageClientProps {
  orgId: string;
  roles: Role[];
  canManage: boolean;
  initialRoleId: string | null;
  initialView: "list" | "card";
}

export function MembersPageClient({
  orgId,
  roles,
  canManage,
  initialRoleId,
  initialView,
}: MembersPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [roleId, setRoleId, roleHydrated] = usePersistedState<string | null>(
    `memberships-role-${orgId}`,
    initialRoleId,
  );
  const [view, setView, viewHydrated] = usePersistedState<"list" | "card">(
    `memberships-view-${orgId}`,
    initialView,
  );
  const [search, setSearch, searchHydrated] = usePersistedState<string>(
    `memberships-search-${orgId}`,
    "",
  );

  const [members, setMembers] = useState<Member[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestSeqRef = useRef(0);

  const hydrated = roleHydrated && viewHydrated && searchHydrated;

  useEffect(() => {
    if (!hydrated) return;

    const params = new URLSearchParams();
    if (roleId) params.set("roleId", roleId);
    if (view !== "card") params.set("view", view);
    const trimmedSearch = search.trim();
    if (trimmedSearch) params.set("search", trimmedSearch);

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [hydrated, pathname, router, roleId, search, view]);

  const loadMembersPage = useCallback(
    async ({
      targetPage,
      replace,
      signal,
      requestSeq,
    }: {
      targetPage: number;
      replace: boolean;
      signal: AbortSignal;
      requestSeq: number;
    }) => {
      const pageSize = view === "list" ? 30 : 24;
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("pageSize", String(pageSize));
      if (search.trim()) params.set("search", search.trim());
      if (roleId) params.set("roleId", roleId);

      const response = await fetch(`/api/orgs/${orgId}/memberships?${params.toString()}`, {
        signal,
      });
      if (!response.ok) throw new Error("Failed to load members.");

      const data = (await response.json()) as {
        memberships: MemberApiResponse[];
        totalCount: number;
        totalPages: number;
      };

      if (requestSeqRef.current !== requestSeq) return;

      const normalizedMembers = data.memberships.map(normalizeMember);
      setMembers((current) =>
        replace ? mergeUniqueMembers([], normalizedMembers) : mergeUniqueMembers(current, normalizedMembers),
      );
      setTotalPages(Math.max(1, data.totalPages));
      setTotalCount(data.totalCount);
      setPage(targetPage);
    },
    [orgId, roleId, search, view],
  );

  useEffect(() => {
    if (!hydrated) return;

    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    const controller = new AbortController();

    void (async () => {
      setIsLoadingInitial(true);
      setIsLoadingMore(false);
      try {
        setMembers([]);
        setPage(0);
        setTotalPages(1);
        setTotalCount(0);
        await loadMembersPage({
          targetPage: 1,
          replace: true,
          signal: controller.signal,
          requestSeq,
        });
      } catch {
        if (requestSeqRef.current !== requestSeq) return;
        setMembers([]);
        setTotalPages(1);
        setTotalCount(0);
      } finally {
        if (requestSeqRef.current !== requestSeq) return;
        setIsLoadingInitial(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [hydrated, loadMembersPage, reloadToken, roleId, search, view]);

  const refreshMembers = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (isLoadingInitial || isLoadingMore) return;
    if (members.length === 0) return;
    if (page === 0 || page >= totalPages) return;

    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (isLoadingInitial || isLoadingMore || page >= totalPages) return;

        const nextPage = page + 1;
        const requestSeq = requestSeqRef.current;
        const controller = new AbortController();

        setIsLoadingMore(true);

        void loadMembersPage({
          targetPage: nextPage,
          replace: false,
          signal: controller.signal,
          requestSeq,
        })
          .catch(() => {
            // The sentinel stays mounted, so another intersection can retry.
          })
          .finally(() => {
            if (requestSeqRef.current !== requestSeq) return;
            setIsLoadingMore(false);
          });

        return () => {
          controller.abort();
        };
      },
      { rootMargin: "240px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hydrated, isLoadingInitial, isLoadingMore, loadMembersPage, members.length, page, totalPages]);

  return (
    <>
      <RegisterPageSidebarSubContent
        content={
          <MembersSidebarContent
            orgId={orgId}
            roles={roles}
            canManage={canManage}
            roleId={roleId}
            view={view}
            onRoleChange={(nextRoleId) => {
              setRoleId(nextRoleId);
            }}
            onViewChange={(nextView) => {
              setView(nextView);
            }}
          />
        }
      />
      <MembersView
        members={members}
        orgId={orgId}
        canManage={canManage}
        allRoles={roles}
        view={view}
        search={search}
        onSearchChange={(value: string) => {
          setSearch(value);
        }}
        totalCount={totalCount}
        isLoadingInitial={isLoadingInitial}
        isLoadingMore={isLoadingMore}
        hasMore={members.length > 0 && page < totalPages}
        sentinelRef={sentinelRef}
        onMemberSaved={refreshMembers}
      />
    </>
  );
}