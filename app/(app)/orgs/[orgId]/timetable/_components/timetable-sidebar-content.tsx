"use client";

/**
 * TimetableSidebarContent — the content rendered inside the page sidebar
 * (and the mobile bottom-sheet) for the timetable page.
 *
 * Sections:
 *  - Filters  — role filter dropdown + Day/Week + Calendar/Simple toggles
 *  - Actions  — Apply Template + Templates link (canManage only)
 *
 * Pref persistence (mirrors the tasks sidebar pattern):
 *  - On mount: if URL is missing mode/span or filters, read saved prefs from
 *    the client-side cookie (set on previous visits) then fall back to
 *    localStorage, and call router.replace() immediately so the correct view
 *    renders without a second round-trip.
 *  - On pref change (after first render): write both cookie and localStorage
 *    so the server can restore on the next bare navigation.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { RoleFilterButton } from "./role-filter-button";
import { TimetableViewPicker } from "./timetable-view-picker";
import { TimetableActions } from "./timetable-actions";
import { TagFilterButton } from "@/components/ui/tag-filter-button";
import { type TemplateOption } from "./apply-template-dialog";
import type { SharedTask } from "../_shared/types";

interface TimetableSidebarContentProps {
  orgId: string;
  anchor: string;
  mode: "calendar" | "simple";
  span: "day" | "week";
  selectedRoleId: string | null;
  roles: { id: string; name: string; color: string | null }[];
  tags: { id: string; name: string; color: string }[];
  selectedTagId: string | null;
  calendarHref: string;
  simpleHref: string;
  dayHref: string;
  weekHref: string;
  canManage: boolean;
  templates: TemplateOption[];
  todayStr: string;
  userId?: string;
  tasks?: SharedTask[];
  /** True when the URL has an explicit `mode` param (user is navigating within timetable). */
  isModeExplicit: boolean;
  /** True when the URL has an explicit `span` param. */
  isSpanExplicit: boolean;
  /** True when the URL has at least one of roleId / tagId. */
  isFiltersExplicit: boolean;
}

export function TimetableSidebarContent({
  orgId,
  anchor,
  mode,
  span,
  selectedRoleId,
  roles,
  tags,
  selectedTagId,
  calendarHref,
  simpleHref,
  dayHref,
  weekHref,
  canManage,
  templates,
  todayStr,
  userId,
  tasks,
  isModeExplicit,
  isSpanExplicit,
  isFiltersExplicit,
}: TimetableSidebarContentProps) {
  const router = useRouter();
  const PREFS_KEY = `timetable-prefs-${orgId}`;
  const isFirstRender = useRef(true);
  // Guard against React StrictMode double-invoking the mount effect.
  const hasRestoredPrefs = useRef(false);

  function setPrefsCookie(value: string) {
    try {
      document.cookie = `${PREFS_KEY}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      /* ignore */
    }
  }

  function readPrefsCookie(): {
    mode?: string;
    span?: string;
    roleId?: string | null;
    tagId?: string | null;
  } | null {
    try {
      const match = document.cookie.match(
        new RegExp(`(?:^|; )${PREFS_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`),
      );
      return match ? JSON.parse(decodeURIComponent(match[1])) : null;
    } catch {
      return null;
    }
  }

  // On mount: if the URL is missing mode/span/filters, resolve saved prefs from
  // the client-side cookie (written on previous visits) or localStorage (migration
  // for first-time cookie users), then call router.replace() immediately.
  useEffect(() => {
    // Prevent StrictMode double-invoke from navigating twice.
    if (hasRestoredPrefs.current) return;
    hasRestoredPrefs.current = true;

    const overrides: {
      mode?: "calendar" | "simple";
      span?: "day" | "week";
      roleId?: string | null;
      tagId?: string | null;
    } = {};

    const cookie = readPrefsCookie();

    if (!isModeExplicit) {
      let savedMode: string | null = cookie?.mode ?? null;
      if (!savedMode) {
        try { savedMode = localStorage.getItem("timetable:mode"); } catch { /* ignore */ }
      }
      if ((savedMode === "simple" || savedMode === "calendar") && savedMode !== mode) {
        overrides.mode = savedMode;
      }
    }

    if (!isSpanExplicit) {
      let savedSpan: string | null = cookie?.span ?? null;
      if (!savedSpan) {
        try { savedSpan = localStorage.getItem("timetable:span"); } catch { /* ignore */ }
      }
      if ((savedSpan === "day" || savedSpan === "week") && savedSpan !== span) {
        overrides.span = savedSpan;
      }
    }

    if (!isFiltersExplicit && cookie) {
      if (typeof cookie.roleId === "string" && cookie.roleId !== selectedRoleId) {
        if (roles.find((r) => r.id === cookie.roleId)) {
          overrides.roleId = cookie.roleId;
        }
      }
      if (typeof cookie.tagId === "string" && cookie.tagId !== selectedTagId) {
        if (tags.find((t) => t.id === cookie.tagId)) {
          overrides.tagId = cookie.tagId;
        }
      }
    }

    if (Object.keys(overrides).length > 0) {
      router.replace(buildHref(overrides));
    }

    // Seed the cookie with the fully resolved state for future server-side restores.
    setPrefsCookie(
      JSON.stringify({
        mode: overrides.mode ?? mode,
        span: overrides.span ?? span,
        roleId: overrides.roleId !== undefined ? overrides.roleId : selectedRoleId,
        tagId: overrides.tagId !== undefined ? overrides.tagId : selectedTagId,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep cookie (and localStorage) up-to-date whenever prefs change (skip first render
  // so we don't overwrite saved state before the mount restore has run).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const value = JSON.stringify({ mode, span, roleId: selectedRoleId, tagId: selectedTagId });
    setPrefsCookie(value);
    try {
      localStorage.setItem("timetable:mode", mode);
      localStorage.setItem("timetable:span", span);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, span, selectedRoleId, selectedTagId]);

  function buildHref(overrides: {
    mode?: "calendar" | "simple";
    span?: "day" | "week";
    roleId?: string | null;
    tagId?: string | null;
  }) {
    const next = { mode, span, roleId: selectedRoleId, tagId: selectedTagId, ...overrides };
    const params = new URLSearchParams({ anchor, mode: next.mode, span: next.span });
    if (next.roleId) params.set("roleId", next.roleId);
    if (next.tagId) params.set("tagId", next.tagId);
    return `/orgs/${orgId}/timetable?${params.toString()}`;
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      {/* Filters section */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
          Filters
        </p>
        <div className="flex flex-col gap-2">
          <RoleFilterButton
            roles={roles}
            anchor={anchor}
            mode={mode}
            span={span}
            selectedRoleId={selectedRoleId}
            selectedTagId={selectedTagId}
            orgId={orgId}
            onNavigate={(newRoleId) => {
              setPrefsCookie(
                JSON.stringify({ mode, span, roleId: newRoleId, tagId: selectedTagId }),
              );
            }}
          />
          {tags.length > 0 && (
            <TagFilterButton
              tags={tags}
              selectedTagId={selectedTagId}
              basePath={`/orgs/${orgId}/timetable`}
              extraParams={{
                anchor,
                mode,
                span,
                ...(selectedRoleId ? { roleId: selectedRoleId } : {}),
              }}
              onNavigate={(newTagId) => {
                setPrefsCookie(
                  JSON.stringify({ mode, span, roleId: selectedRoleId, tagId: newTagId }),
                );
              }}
            />
          )}
        </div>
      </div>

      {/* View section */}
      <div className="px-3 pt-2.5 pb-3 border-t border-border">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
          View
        </p>
        <TimetableViewPicker
          mode={mode}
          span={span}
          calendarHref={calendarHref}
          simpleHref={simpleHref}
          dayHref={dayHref}
          weekHref={weekHref}
          className="flex-col items-start"
        />
      </div>

      {/* Actions section — managers only */}
      {canManage && (
        <div className="px-3 pt-2 pb-3 border-t border-border">
          <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
            Actions
          </p>
          <div className="flex flex-col gap-2">
            <TimetableActions
              orgId={orgId}
              templates={templates}
              anchor={anchor}
              todayStr={todayStr}
              userId={userId}
              tasks={tasks}
            />
          </div>
        </div>
      )}
    </div>
  );
}
