export type FranchiseeTaskDef = [string, string, number, string, string, number, number];

export const model = "franchiseeTask" as const;

export const data: FranchiseeTaskDef[] = [
  [
    "Morning Opening Procedure",
    "#F59E0B",
    30,
    "**Steps**\n1. Unlock front door and disable alarm\n2. Turn on all equipment (fryer, display warmers, POS)\n3. Check and record temperatures for all refrigerated units\n4. Set up till with correct opening float\n5. Sign off on the opening checklist",
    "07:00",
    0,
    999,
  ],
  [
    "Doughnut Quality Check",
    "#EC4899",
    15,
    "**Before opening the display case:**\n1. Check each tray for freshness — maximum 4 hours since frying\n2. Remove any damaged or stale product\n3. Record the count in the wastage log\n4. Ensure display is clean and lit correctly",
    "07:30",
    0,
    999,
  ],
  [
    "Afternoon Restock",
    "#3B82F6",
    20,
    "**Mid-day restock procedure:**\n1. Check remaining stock vs. projected afternoon sales\n2. Pull fresh product from back if available\n3. Restock packaging (bags, boxes, napkins)\n4. Note any items running low for next morning's order",
    "12:00",
    0,
    999,
  ],
  [
    "End of Day Report",
    "#8B5CF6",
    20,
    "**Complete before closing:**\n1. Tally total sales vs. opening float — note any discrepancies\n2. Record wastage for the day\n3. Complete and submit the shift summary\n4. Brief next shift lead on any issues",
    "16:00",
    0,
    999,
  ],
  [
    "Equipment Temperature Log",
    "#22C55E",
    10,
    "**Record twice daily (opening and mid-day):**\n- Fridge 1 (Fillings): must be 1–4°C\n- Fridge 2 (Display): must be 1–4°C\n- Freezer: must be −18°C or below\n\n_If any unit is out of range, notify the manager immediately._",
    "07:00",
    0,
    1,
  ],
];

export const seed = {
  model,
  data,
} satisfies { model: "franchiseeTask"; data: FranchiseeTaskDef[] };

export const FRANCHISEE_TASKS = data;


