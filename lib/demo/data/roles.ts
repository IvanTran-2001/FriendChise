export type PermissionDef = {
  roleKey: string;
  action: string;
};

export type RoleDef = {
  key: string;
  name: string;
  color: string;
  isDeletable: boolean;
  isDefault: boolean;
};

export const parentRoles: RoleDef[] = [
  { key: "owner", name: "Owner", color: "#ef4444", isDeletable: false, isDefault: false },
  { key: "default_member", name: "Default Member", color: "#6b7280", isDeletable: false, isDefault: true },
  { key: "fryer_op", name: "Fryer Operator", color: "#F97316", isDeletable: true, isDefault: false },
  { key: "counter_staff", name: "Counter Staff", color: "#06B6D4", isDeletable: true, isDefault: false },
  { key: "shift_lead", name: "Shift Lead", color: "#8B5CF6", isDeletable: true, isDefault: false },
  { key: "trainee", name: "Trainee", color: "#84CC16", isDeletable: true, isDefault: false },
];

export const parentPermissions: PermissionDef[] = [
  { roleKey: "owner", action: "VIEW_TIMETABLE" },
  { roleKey: "owner", action: "MANAGE_TIMETABLE" },
  { roleKey: "owner", action: "MANAGE_MEMBERS" },
  { roleKey: "owner", action: "MANAGE_TASKS" },
  { roleKey: "owner", action: "MANAGE_ROLES" },
  { roleKey: "owner", action: "MANAGE_SETTINGS" },
  { roleKey: "default_member", action: "VIEW_TIMETABLE" },
  { roleKey: "fryer_op", action: "VIEW_TIMETABLE" },
  { roleKey: "fryer_op", action: "MANAGE_TASKS" },
  { roleKey: "counter_staff", action: "VIEW_TIMETABLE" },
  { roleKey: "shift_lead", action: "VIEW_TIMETABLE" },
  { roleKey: "shift_lead", action: "MANAGE_TIMETABLE" },
  { roleKey: "shift_lead", action: "MANAGE_MEMBERS" },
  { roleKey: "trainee", action: "VIEW_TIMETABLE" },
];

export const franchiseeRoles: RoleDef[] = [
  { key: "owner", name: "Owner", color: "#ef4444", isDeletable: false, isDefault: false },
  { key: "worker", name: "Worker", color: "#6B7280", isDeletable: false, isDefault: true },
];

export const franchiseePermissions: PermissionDef[] = [
  { roleKey: "owner", action: "VIEW_TIMETABLE" },
  { roleKey: "owner", action: "MANAGE_TIMETABLE" },
  { roleKey: "owner", action: "MANAGE_MEMBERS" },
  { roleKey: "owner", action: "MANAGE_TASKS" },
  { roleKey: "owner", action: "MANAGE_ROLES" },
  { roleKey: "owner", action: "MANAGE_SETTINGS" },
];
