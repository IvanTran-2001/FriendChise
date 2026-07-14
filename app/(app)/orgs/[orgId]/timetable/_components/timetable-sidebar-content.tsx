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
import { X } from "lucide-react";
import { RoleFilterButton } from "./role-filter-button";
import { TagMultiFilterButton } from "./tag-multi-filter-button";
import { TimetableViewPicker } from "./timetable-view-picker";
import { useTimetableZoom, MIN_HOUR_HEIGHT, MAX_HOUR_HEIGHT } from "../_shared/timetable-zoom-context";
import { TimetableActions } from "./timetable-actions";
import { ColorFilterButton } from "./color-filter-button";
import { type TemplateOption } from "./apply-template-dialog";
import type { SharedTask } from "../_shared/types";

interface TimetableSidebarContentProps {
  orgId: string;
  anchor: string;
  mode: "calendar" | "simple";
  span: "day" | "week";
  selectedRoleIds: string[];
  roles: { id: string; name: string; color: string | null }[];
  tags: { id: string; name: string; color: string }[];
  selectedTagIds: string[];
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
  onModeChange: (mode: "calendar" | "simple") => void;
  onSpanChange: (span: "day" | "week") => void;
}

function ZoomSlider() {
  const { hourHeight, setHourHeight } = useTimetableZoom();

  return (
    <div className="mt-3 px-1">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <label htmlFor="hour-height-slider" className="text-xs font-medium text-muted-foreground">
          Zoom
        </label>
        <span className="text-xs tabular-nums text-muted-foreground">{hourHeight}px</span>
      </div>
      <input
        id="hour-height-slider"
        type="range"
        min={MIN_HOUR_HEIGHT}
        max={MAX_HOUR_HEIGHT}
        value={hourHeight}
        onChange={(e) => setHourHeight(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-primary"
      />
    </div>
  );
}

export function TimetableSidebarContent({
  orgId,
  anchor,
  mode,
  span,
  selectedRoleIds,
  roles,
  tags,
  selectedTagIds,
  canManage,
  templates,
  todayStr,
  userId,
  tasks,
  isModeExplicit,
  isSpanExplicit,
  isFiltersExplicit,
  onModeChange,
  onSpanChange,
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
    roleIds?: string[];
    tagIds?: string[];
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
      roleIds?: string[];
      tagIds?: string[];
    } = {};

    const cookie = readPrefsCookie();

    let cookieRoleIds: string[] = [];
    if (cookie?.roleIds && Array.isArray(cookie.roleIds)) {
      cookieRoleIds = cookie.roleIds;
    } else if (typeof cookie?.roleId === "string") {
      cookieRoleIds = [cookie.roleId];
    }

    let cookieTagIds: string[] = [];
    if (cookie?.tagIds && Array.isArray(cookie.tagIds)) {
      cookieTagIds = cookie.tagIds;
    } else if (typeof cookie?.tagId === "string") {
      cookieTagIds = [cookie.tagId];
    }

    if (!isModeExplicit) {
      let savedMode: string | null = cookie?.mode ?? null;
      if (!savedMode) {
        try { savedMode = localStorage.getItem(`${PREFS_KEY}:mode`); } catch { /* ignore */ }
      }
      if ((savedMode === "simple" || savedMode === "calendar") && savedMode !== mode) {
        overrides.mode = savedMode;
      }
    }

    if (!isSpanExplicit) {
      let savedSpan: string | null = cookie?.span ?? null;
      if (!savedSpan) {
        try { savedSpan = localStorage.getItem(`${PREFS_KEY}:span`); } catch { /* ignore */ }
      }
      if ((savedSpan === "day" || savedSpan === "week") && savedSpan !== span) {
        overrides.span = savedSpan;
      }
    }

    if (!isFiltersExplicit && cookie) {
      const validRoleIds = cookieRoleIds.filter((id) => roles.some((r) => r.id === id));
      if (validRoleIds.length > 0) {
        overrides.roleIds = validRoleIds;
      }
      const validTagIds = cookieTagIds.filter((id) => tags.some((t) => t.id === id));
      if (validTagIds.length > 0) {
        overrides.tagIds = validTagIds;
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
        roleIds: overrides.roleIds !== undefined ? overrides.roleIds : selectedRoleIds,
        tagIds: overrides.tagIds !== undefined ? overrides.tagIds : selectedTagIds,
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
    const value = JSON.stringify({
      mode,
      span,
      roleIds: selectedRoleIds,
      tagIds: selectedTagIds,
    });
    setPrefsCookie(value);
    try {
      localStorage.setItem(`${PREFS_KEY}:mode`, mode);
      localStorage.setItem(`${PREFS_KEY}:span`, span);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, span, selectedRoleIds, selectedTagIds]);

  function buildHref(overrides: {
    mode?: "calendar" | "simple";
    span?: "day" | "week";
    roleIds?: string[];
    tagIds?: string[];
  }) {
    const next = {
      mode,
      span,
      roleIds: selectedRoleIds,
      tagIds: selectedTagIds,
      ...overrides,
    };
    const params = new URLSearchParams({ anchor, mode: next.mode, span: next.span });
    if (next.roleIds && next.roleIds.length > 0) params.set("roleId", next.roleIds.join(","));
    if (next.tagIds && next.tagIds.length > 0) params.set("tagId", next.tagIds.join(","));
    return `/orgs/${orgId}/timetable?${params.toString()}`;
  }

  function handleRoleChange(nextRoleIds: string[]) {
    setPrefsCookie(
      JSON.stringify({ mode, span, roleIds: nextRoleIds, tagIds: selectedTagIds }),
    );
    router.push(buildHref({ roleIds: nextRoleIds }));
  }

  function handleTagChange(nextTagIds: string[]) {
    setPrefsCookie(
      JSON.stringify({ mode, span, roleIds: selectedRoleIds, tagIds: nextTagIds }),
    );
    router.push(buildHref({ tagIds: nextTagIds }));
  }

  function handleClearAll() {
    setPrefsCookie(
      JSON.stringify({ mode, span, roleIds: [], tagIds: [] }),
    );
    router.push(buildHref({ roleIds: [], tagIds: [] }));
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
            selectedRoleIds={selectedRoleIds}
            selectedTagIds={selectedTagIds}
            orgId={orgId}
            onNavigate={handleRoleChange}
          />
          {tags.length > 0 && (
            <TagMultiFilterButton
              tags={tags}
              selectedTagIds={selectedTagIds}
              basePath={`/orgs/${orgId}/timetable`}
              extraParams={{
                anchor,
                mode,
                span,
                ...(selectedRoleIds.length > 0 ? { roleId: selectedRoleIds.join(",") } : {}),
              }}
              onNavigate={handleTagChange}
            />
          )}
          <ColorFilterButton />
        </div>

        {/* Active filters badges */}
        {(selectedRoleIds.length > 0 || selectedTagIds.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-3 px-1">
            {selectedRoleIds.map((id) => {
              const role = roles.find((r) => r.id === id);
              if (!role) return null;
              return (
                <div
                  key={role.id}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-foreground shadow-sm max-w-full"
                >
                  {role.color && (
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: role.color }}
                    />
                  )}
                  <span className="truncate max-w-30">{role.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${role.name} filter`}
                    onClick={() => {
                      const next = selectedRoleIds.filter((x) => x !== id);
                      handleRoleChange(next);
                    }}
                    className="text-muted-foreground hover:text-foreground active:scale-95 ml-0.5 shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            {selectedTagIds.map((id) => {
              const tag = tags.find((t) => t.id === id);
              if (!tag) return null;
              return (
                <div
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-foreground shadow-sm max-w-full"
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="truncate max-w-30">{tag.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${tag.name} filter`}
                    onClick={() => {
                      const next = selectedTagIds.filter((x) => x !== id);
                      handleTagChange(next);
                    }}
                    className="text-muted-foreground hover:text-foreground active:scale-95 ml-0.5 shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[11px] font-medium text-primary hover:underline active:scale-95 px-1 py-0.5"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* View section */}
      <div className="px-3 pt-2.5 pb-3 border-t border-border">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
          View
        </p>
        <TimetableViewPicker
          orgId={orgId}
          anchor={anchor}
          mode={mode}
          span={span}
          roleId={selectedRoleIds.join(",")}
          tagId={selectedTagIds.join(",")}
          onModeChange={onModeChange}
          onSpanChange={onSpanChange}
          className="flex-col items-start"
        />
        {mode === "calendar" && <ZoomSlider />}
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
