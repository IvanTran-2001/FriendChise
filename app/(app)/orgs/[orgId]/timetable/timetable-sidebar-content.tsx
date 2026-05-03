/**
 * TimetableSidebarContent — the content rendered inside the page sidebar
 * (and the mobile bottom-sheet) for the timetable page.
 *
 * Sections:
 *  - Filters  — role filter dropdown + Day/Week + Calendar/Simple toggles
 *  - Actions  — Apply Template + Templates link (canManage only)
 */
import { RoleFilterButton } from "./role-filter-button";
import { TimetableViewPicker } from "./timetable-view-picker";
import { TimetableActions } from "./timetable-actions";
import { type TemplateOption } from "./apply-template-dialog";

interface TimetableSidebarContentProps {
  orgId: string;
  anchor: string;
  mode: "calendar" | "simple";
  span: "day" | "week";
  selectedRoleId: string | null;
  roles: { id: string; name: string; color: string | null }[];
  calendarHref: string;
  simpleHref: string;
  dayHref: string;
  weekHref: string;
  canManage: boolean;
  templates: TemplateOption[];
  todayStr: string;
  userId?: string;
}

export function TimetableSidebarContent({
  orgId,
  anchor,
  mode,
  span,
  selectedRoleId,
  roles,
  calendarHref,
  simpleHref,
  dayHref,
  weekHref,
  canManage,
  templates,
  todayStr,
  userId,
}: TimetableSidebarContentProps) {
  return (
    <aside className="flex flex-col flex-1 overflow-y-auto">
      {/* Panel header */}
      <div className="h-12 flex items-center px-4 border-b border-border shrink-0">
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          Timetable
        </span>
      </div>

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
            orgId={orgId}
          />
          <TimetableViewPicker
            mode={mode}
            span={span}
            calendarHref={calendarHref}
            simpleHref={simpleHref}
            dayHref={dayHref}
            weekHref={weekHref}
            className="flex-col"
          />
        </div>
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
            />
          </div>
        </div>
      )}
    </aside>
  );
}
