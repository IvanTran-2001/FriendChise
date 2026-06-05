// Re-exports for the template editor folder. Import from the folder root
// (e.g. `.../templates/[templateId]`) to access the client and subcomponents.
export { TemplateEditorClient } from "./template-editor-client";
export type {
  ClientTemplateInstance,
  ClientTask,
  ClientMembership,
} from "./template-editor-client";
export { TemplateSimpleView } from "./template-timetable-client/simple-view";
export { CalendarEditSidebarContent } from "./template-timetable-client/calendar-edit-sidebar-content";
