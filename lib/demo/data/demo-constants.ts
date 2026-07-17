export const ORGANIZATION_OPERATING_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export const FRANCHISEE_OPERATING_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;

export const WORKING_DAYS_WEEKDAY = ["mon", "tue", "wed", "thu", "fri"] as const;

export const DAY_INDEX_BY_KEY = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
} as const;

export const GLOBAL_TASK_SCOPE_TASK_NAMES = [
  "Recipe: White Choc Biscoff Frappe",
  "Recipe: Honeycomb Frappe",
  "Recipe: Coffee Frappe",
  "Recipe: Salted Caramel Frappe",
  "Recipe: Matcha Frappe",
  "Recipe: Chocolate Milkshake",
  "Recipe: Biscoff Custard Shake",
  "Clean Ice Cream Machine",
  "Clean Fryer (End of Day)",
  "Deep Clean Hatco (Hot Jam) Unit",
  "Deep Clean All Fridges",
  "Deep Clean Doughnut Display",
] as const;
