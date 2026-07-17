export type TaskTagGroupDef = {
  name: string;
  color: string;
  taskNames: string[];
};

export const data: TaskTagGroupDef[] = [
  {
    name: "Recipe",
    color: "#8B5CF6",
    taskNames: [
      "Recipe: White Choc Biscoff Frappe",
      "Recipe: Honeycomb Frappe",
      "Recipe: Coffee Frappe",
      "Recipe: Salted Caramel Frappe",
      "Recipe: Matcha Frappe",
      "Recipe: Chocolate Milkshake",
      "Recipe: Biscoff Custard Shake",
    ],
  },
  {
    name: "Cleaning",
    color: "#22C55E",
    taskNames: [
      "Clean Ice Cream Machine",
      "Deep Clean Hatco (Hot Jam) Unit",
      "Deep Clean All Fridges",
      "Deep Clean Doughnut Display",
      "Clean & Tidy Storeroom",
      "Clean Fryer (End of Day)",
      "Clean Fondant Bain-Marie",
    ],
  },
  {
    name: "Critical",
    color: "#EF4444",
    taskNames: ["Fry Morning Batches", "Fryer Oil Quality Check"],
  },
  {
    name: "Operations",
    color: "#F59E0B",
    taskNames: ["Open Shop Checklist", "Close Shop Checklist", "Shift Handover"],
  },
];