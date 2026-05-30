/**
 * Walker's Doughnuts seed data + seeding function.
 *
 * Exported and called by:
 *   - prisma/seed.ts  (local dev full seed)
 *   - private/seed-walkers-doughnuts.ts  (standalone production/one-off seed)
 */

import { PrismaClient, PermissionAction } from "@prisma/client";
import { ROLE_KEYS } from "@/lib/rbac";

const ALL_OWNER_PERMISSIONS = Object.values(PermissionAction);

// ─── Tool Items ───────────────────────────────────────────────────────────────

const TOOL_ITEMS: { name: string; unit: string }[] = [
  { name: "Apple Crumble", unit: "each" },
  { name: "Banana Custard", unit: "each" },
  { name: "Banoffee", unit: "each" },
  { name: "Boston Cream", unit: "each" },
  { name: "Bronut", unit: "each" },
  { name: "Chocolate Custard", unit: "g" },
  { name: "Chocolate Frappe", unit: "g" },
  { name: "Classic Custard", unit: "each" },
  { name: "Coffee Cream ball", unit: "each" },
  { name: "Cookies and Cream", unit: "each" },
  { name: "Custard", unit: "g" },
  { name: "Custard Decorate", unit: "each" },
  { name: "Custard Noonie", unit: "each" },
  { name: "Custard Powder", unit: "g" },
  { name: "Full Cream Milk", unit: "g" },
  { name: "Honey Comb Custard", unit: "g" },
  { name: "Honey Comb Donut", unit: "each" },
  { name: "Honey Comb Flavour", unit: "g" },
  { name: "Iced VoVo", unit: "each" },
  { name: "Lamington", unit: "each" },
  { name: "Lemon Coconut", unit: "each" },
  { name: "Mama's lemon path", unit: "each" },
  { name: "Neapolitan", unit: "each" },
  { name: "Pineapple Splice", unit: "each" },
  { name: "Pistachio Choc Ball", unit: "each" },
  { name: "Pistachio Cream Ball", unit: "each" },
  { name: "Pistachio Custard", unit: "g" },
  { name: "Pistachio Flavour", unit: "g" },
  { name: "Quarks", unit: "g" },
  { name: "Raspberry Cheesecake Custard", unit: "g" },
  { name: "Raspberry Cheesecake Donut", unit: "each" },
  { name: "Raspberry Powder", unit: "g" },
  { name: "Rocky Road", unit: "each" },
  { name: "Strawberry and Cream", unit: "each" },
  { name: "Strawberry Cheesecake Custard", unit: "g" },
  { name: "Strawberry Cheesecake Donut", unit: "each" },
  { name: "Strawberry Custard", unit: "g" },
  { name: "Strawberry Frappe", unit: "g" },
  { name: "Strawberry Powder", unit: "g" },
  { name: "Strawberry Shortcake Donut", unit: "each" },
  { name: "Thick Cream", unit: "g" },
  { name: "Tripple Chocolate Donut", unit: "each" },
];

// ─── Conversion Sets ──────────────────────────────────────────────────────────

const CONVERSION_SETS: {
  name: string;
  rates: { fromItemName: string; toItemName: string; fromQty: number; toQty: number }[];
  templates: { name: string; entries: { itemName: string; quantity: number | null; pinnedOutput: number }[] }[];
}[] = [
  {
    name: "Custard/Donuts",
    rates: [
      { fromItemName: "Custard", toItemName: "Thick Cream", fromQty: 4380, toQty: 2500 },
      { fromItemName: "Custard", toItemName: "Full Cream Milk", fromQty: 4380, toQty: 1250 },
      { fromItemName: "Custard", toItemName: "Custard Powder", fromQty: 4380, toQty: 630 },
      { fromItemName: "Apple Crumble", toItemName: "Custard", fromQty: 1, toQty: 20 },
      { fromItemName: "Pistachio Choc Ball", toItemName: "Custard", fromQty: 1, toQty: 20 },
      { fromItemName: "Lemon Coconut", toItemName: "Custard", fromQty: 1, toQty: 20 },
      { fromItemName: "Lamington", toItemName: "Custard", fromQty: 1, toQty: 20 },
      { fromItemName: "Rocky Road", toItemName: "Custard", fromQty: 1, toQty: 20 },
      { fromItemName: "Banoffee", toItemName: "Custard", fromQty: 1, toQty: 20 },
      { fromItemName: "Boston Cream", toItemName: "Custard", fromQty: 1, toQty: 38 },
      { fromItemName: "Mama's lemon path", toItemName: "Custard", fromQty: 1, toQty: 38 },
      { fromItemName: "Cookies and Cream", toItemName: "Custard", fromQty: 1, toQty: 38 },
      { fromItemName: "Strawberry and Cream", toItemName: "Custard", fromQty: 1, toQty: 38 },
      { fromItemName: "Custard Noonie", toItemName: "Custard", fromQty: 1, toQty: 48 },
      { fromItemName: "Coffee Cream ball", toItemName: "Custard", fromQty: 1, toQty: 38 },
      { fromItemName: "Classic Custard", toItemName: "Custard", fromQty: 1, toQty: 38 },
      { fromItemName: "Pistachio Custard", toItemName: "Pistachio Flavour", fromQty: 250, toQty: 50 },
      { fromItemName: "Pistachio Custard", toItemName: "Custard", fromQty: 250, toQty: 200 },
      { fromItemName: "Honey Comb Custard", toItemName: "Honey Comb Flavour", fromQty: 105, toQty: 5 },
      { fromItemName: "Honey Comb Custard", toItemName: "Custard", fromQty: 105, toQty: 100 },
      { fromItemName: "Strawberry Cheesecake Custard", toItemName: "Strawberry Powder", fromQty: 108, toQty: 3 },
      { fromItemName: "Strawberry Cheesecake Custard", toItemName: "Quarks", fromQty: 108, toQty: 5 },
      { fromItemName: "Strawberry Cheesecake Custard", toItemName: "Custard", fromQty: 108, toQty: 100 },
      { fromItemName: "Raspberry Cheesecake Custard", toItemName: "Quarks", fromQty: 108, toQty: 5 },
      { fromItemName: "Raspberry Cheesecake Custard", toItemName: "Custard", fromQty: 108, toQty: 100 },
      { fromItemName: "Raspberry Cheesecake Custard", toItemName: "Raspberry Powder", fromQty: 108, toQty: 3 },
      { fromItemName: "Strawberry Custard", toItemName: "Strawberry Frappe", fromQty: 116, toQty: 16 },
      { fromItemName: "Strawberry Custard", toItemName: "Custard", fromQty: 116, toQty: 100 },
      { fromItemName: "Strawberry Shortcake Donut", toItemName: "Strawberry Custard", fromQty: 1, toQty: 40 },
      { fromItemName: "Neapolitan", toItemName: "Strawberry Custard", fromQty: 1, toQty: 40 },
      { fromItemName: "Tripple Chocolate Donut", toItemName: "Chocolate Custard", fromQty: 1, toQty: 40 },
      { fromItemName: "Chocolate Custard", toItemName: "Custard", fromQty: 116, toQty: 100 },
      { fromItemName: "Chocolate Custard", toItemName: "Chocolate Frappe", fromQty: 116, toQty: 16 },
      { fromItemName: "Pineapple Splice", toItemName: "Classic Custard", fromQty: 1, toQty: 38 },
      { fromItemName: "Banana Custard", toItemName: "Custard", fromQty: 1, toQty: 38 },
      { fromItemName: "Honey Comb Donut", toItemName: "Honey Comb Custard", fromQty: 1, toQty: 38 },
      { fromItemName: "Pistachio Cream Ball", toItemName: "Pistachio Custard", fromQty: 1, toQty: 40 },
      { fromItemName: "Raspberry Cheesecake Donut", toItemName: "Raspberry Cheesecake Custard", fromQty: 1, toQty: 38 },
      { fromItemName: "Strawberry Cheesecake Donut", toItemName: "Strawberry Cheesecake Custard", fromQty: 1, toQty: 38 },
    ],
    templates: [
      {
        name: "Custard",
        entries: [
          { itemName: "Custard", quantity: 3300, pinnedOutput: 1 },
          { itemName: "Thick Cream", quantity: null, pinnedOutput: 2 },
          { itemName: "Full Cream Milk", quantity: null, pinnedOutput: 2 },
          { itemName: "Custard Powder", quantity: null, pinnedOutput: 2 },
        ],
      },
      {
        name: "Default",
        entries: [
          { itemName: "Apple Crumble", quantity: 6, pinnedOutput: 1 },
          { itemName: "Banoffee", quantity: 2, pinnedOutput: 1 },
          { itemName: "Boston Cream", quantity: 5, pinnedOutput: 1 },
          { itemName: "Coffee Cream ball", quantity: 2, pinnedOutput: 1 },
          { itemName: "Cookies and Cream", quantity: 6, pinnedOutput: 1 },
          { itemName: "Custard Noonie", quantity: 14, pinnedOutput: 1 },
          { itemName: "Lamington", quantity: 2, pinnedOutput: 1 },
          { itemName: "Lemon Coconut", quantity: 4, pinnedOutput: 1 },
          { itemName: "Mama's lemon path", quantity: 3, pinnedOutput: 1 },
          { itemName: "Pistachio Choc Ball", quantity: 3, pinnedOutput: 1 },
          { itemName: "Rocky Road", quantity: 2, pinnedOutput: 1 },
          { itemName: "Strawberry and Cream", quantity: 5, pinnedOutput: 1 },
          { itemName: "Classic Custard", quantity: 6, pinnedOutput: 1 },
          { itemName: "Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Strawberry Cheesecake Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Strawberry Shortcake Donut", quantity: 3, pinnedOutput: 1 },
          { itemName: "Chocolate Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Chocolate Frappe", quantity: null, pinnedOutput: 2 },
          { itemName: "Pistachio Cream Ball", quantity: 3, pinnedOutput: 1 },
          { itemName: "Custard Powder", quantity: null, pinnedOutput: 2 },
          { itemName: "Full Cream Milk", quantity: null, pinnedOutput: 2 },
          { itemName: "Thick Cream", quantity: null, pinnedOutput: 2 },
          { itemName: "Honey Comb Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Honey Comb Flavour", quantity: null, pinnedOutput: 2 },
          { itemName: "Raspberry Cheesecake Donut", quantity: 4, pinnedOutput: 1 },
          { itemName: "Strawberry Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Pistachio Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Pistachio Flavour", quantity: null, pinnedOutput: 2 },
          { itemName: "Raspberry Cheesecake Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Quarks", quantity: null, pinnedOutput: 2 },
          { itemName: "Raspberry Powder", quantity: null, pinnedOutput: 2 },
          { itemName: "Strawberry Cheesecake Donut", quantity: 4, pinnedOutput: 1 },
          { itemName: "Strawberry Frappe", quantity: null, pinnedOutput: 2 },
          { itemName: "Strawberry Powder", quantity: null, pinnedOutput: 2 },
          { itemName: "Tripple Chocolate Donut", quantity: 3, pinnedOutput: 1 },
          { itemName: "Honey Comb Donut", quantity: 3, pinnedOutput: 1 },
          { itemName: "Neapolitan", quantity: 2, pinnedOutput: 1 },
        ],
      },
      {
        name: "Monday",
        entries: [
          { itemName: "Apple Crumble", quantity: 6, pinnedOutput: 1 },
          { itemName: "Banoffee", quantity: 2, pinnedOutput: 1 },
          { itemName: "Boston Cream", quantity: 5, pinnedOutput: 1 },
          { itemName: "Coffee Cream ball", quantity: 2, pinnedOutput: 1 },
          { itemName: "Cookies and Cream", quantity: 6, pinnedOutput: 1 },
          { itemName: "Custard Noonie", quantity: 14, pinnedOutput: 1 },
          { itemName: "Lamington", quantity: 2, pinnedOutput: 1 },
          { itemName: "Lemon Coconut", quantity: 4, pinnedOutput: 1 },
          { itemName: "Mama's lemon path", quantity: 3, pinnedOutput: 1 },
          { itemName: "Pistachio Choc Ball", quantity: 3, pinnedOutput: 1 },
          { itemName: "Rocky Road", quantity: 2, pinnedOutput: 1 },
          { itemName: "Strawberry and Cream", quantity: 5, pinnedOutput: 1 },
          { itemName: "Classic Custard", quantity: 6, pinnedOutput: 1 },
          { itemName: "Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Strawberry Cheesecake Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Strawberry Shortcake Donut", quantity: 3, pinnedOutput: 1 },
          { itemName: "Chocolate Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Chocolate Frappe", quantity: null, pinnedOutput: 2 },
          { itemName: "Pistachio Cream Ball", quantity: 3, pinnedOutput: 1 },
          { itemName: "Custard Powder", quantity: null, pinnedOutput: 2 },
          { itemName: "Full Cream Milk", quantity: null, pinnedOutput: 2 },
          { itemName: "Thick Cream", quantity: null, pinnedOutput: 2 },
          { itemName: "Honey Comb Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Honey Comb Flavour", quantity: null, pinnedOutput: 2 },
          { itemName: "Raspberry Cheesecake Donut", quantity: 4, pinnedOutput: 1 },
          { itemName: "Strawberry Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Pistachio Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Pistachio Flavour", quantity: null, pinnedOutput: 2 },
          { itemName: "Raspberry Cheesecake Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Quarks", quantity: null, pinnedOutput: 2 },
          { itemName: "Raspberry Powder", quantity: null, pinnedOutput: 2 },
          { itemName: "Strawberry Cheesecake Donut", quantity: 4, pinnedOutput: 1 },
          { itemName: "Strawberry Frappe", quantity: null, pinnedOutput: 2 },
          { itemName: "Strawberry Powder", quantity: null, pinnedOutput: 2 },
          { itemName: "Tripple Chocolate Donut", quantity: 3, pinnedOutput: 1 },
          { itemName: "Honey Comb Donut", quantity: 3, pinnedOutput: 1 },
          { itemName: "Neapolitan", quantity: 2, pinnedOutput: 1 },
        ],
      },
      {
        name: "Tuesday",
        entries: [
          { itemName: "Apple Crumble", quantity: 6, pinnedOutput: 1 },
          { itemName: "Banoffee", quantity: 2, pinnedOutput: 1 },
          { itemName: "Boston Cream", quantity: 5, pinnedOutput: 1 },
          { itemName: "Coffee Cream ball", quantity: 2, pinnedOutput: 1 },
          { itemName: "Cookies and Cream", quantity: 6, pinnedOutput: 1 },
          { itemName: "Custard Noonie", quantity: 14, pinnedOutput: 1 },
          { itemName: "Lamington", quantity: 2, pinnedOutput: 1 },
          { itemName: "Lemon Coconut", quantity: 4, pinnedOutput: 1 },
          { itemName: "Mama's lemon path", quantity: 3, pinnedOutput: 1 },
          { itemName: "Pistachio Choc Ball", quantity: 3, pinnedOutput: 1 },
          { itemName: "Rocky Road", quantity: 2, pinnedOutput: 1 },
          { itemName: "Strawberry and Cream", quantity: 5, pinnedOutput: 1 },
          { itemName: "Classic Custard", quantity: 6, pinnedOutput: 1 },
          { itemName: "Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Strawberry Cheesecake Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Strawberry Shortcake Donut", quantity: 3, pinnedOutput: 1 },
          { itemName: "Chocolate Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Chocolate Frappe", quantity: null, pinnedOutput: 2 },
          { itemName: "Pistachio Cream Ball", quantity: 3, pinnedOutput: 1 },
          { itemName: "Custard Powder", quantity: null, pinnedOutput: 2 },
          { itemName: "Full Cream Milk", quantity: null, pinnedOutput: 2 },
          { itemName: "Thick Cream", quantity: null, pinnedOutput: 2 },
          { itemName: "Honey Comb Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Honey Comb Flavour", quantity: null, pinnedOutput: 2 },
          { itemName: "Raspberry Cheesecake Donut", quantity: 4, pinnedOutput: 1 },
          { itemName: "Strawberry Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Pistachio Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Pistachio Flavour", quantity: null, pinnedOutput: 2 },
          { itemName: "Raspberry Cheesecake Custard", quantity: null, pinnedOutput: 2 },
          { itemName: "Quarks", quantity: null, pinnedOutput: 2 },
          { itemName: "Raspberry Powder", quantity: null, pinnedOutput: 2 },
          { itemName: "Strawberry Cheesecake Donut", quantity: 4, pinnedOutput: 1 },
          { itemName: "Strawberry Frappe", quantity: null, pinnedOutput: 2 },
          { itemName: "Strawberry Powder", quantity: null, pinnedOutput: 2 },
          { itemName: "Tripple Chocolate Donut", quantity: 3, pinnedOutput: 1 },
          { itemName: "Honey Comb Donut", quantity: 3, pinnedOutput: 1 },
          { itemName: "Neapolitan", quantity: 2, pinnedOutput: 1 },
        ],
      },
    ],
  },
];

// ─── Tasks ────────────────────────────────────────────────────────────────────
// Each entry: [name, color, durationMin, description]

const TASKS: [string, string, number, string][] = [
  // ── Frappes — purple ───────────────────────────────────────────────────────
  [
    "White Choc Biscoff Frappe",
    "#8B5CF6",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 2/3 cup Milk\n• 1x large scoop Biscoff spread\n• 4x small scoops White Chocolate Powder\n\n**Method**\n1. Blend 35 sec.\n2. Top with Whipped Cream Swirl and a dusting of Biscoff Crumb.\n\n_Wet the scoop with water before measuring Biscoff._",
  ],
  [
    "Strawberries & Cream Frappe",
    "#8B5CF6",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 2/3 cup Milk\n• 3x small scoops White Chocolate Powder\n• 4x small scoops Strawberry Frappe Powder\n\n**Method**\n1. Blend 35 sec.\n2. Top with Whipped Cream Swirl and a dusting of Freeze Dried Raspberries.",
  ],
  [
    "Lemon Cream Frappe",
    "#8B5CF6",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 2/3 cup Milk\n• 2x large scoops Tuscan Lemon Cream Filling\n• 1x large scoop Vanilla Frappe Powder\n\n**Method**\n1. Blend 35 sec.\n2. Top with Whipped Cream Swirl and crushed Meringue pieces.",
  ],
  [
    "Honeycomb Frappe",
    "#8B5CF6",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 2/3 cup Milk\n• 1.5x large scoops Honeycomb Frappe Powder\n• 1x large scoop Vanilla Frappe Powder\n• 12x Chocolate Buttons\n\n**Method**\n1. Blend 35 sec.\n2. Top with Whipped Cream Swirl and Dark Choc Flakettes.",
  ],
  [
    "Coffee Frappe",
    "#8B5CF6",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 1/4 cup Milk\n• 1 double shot Espresso (60ml)\n• 4x small scoops Vanilla Frappe Powder\n\n**Method**\n1. Blend 35 sec.\n2. Top with Whipped Cream Swirl and Dark Chocolate Flakettes.",
  ],
  [
    "Deluxe Choc Chip Frappe",
    "#8B5CF6",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 2/3 cup Milk\n• 8x Chocolate Buttons\n• 4x small scoops Chocolate Frappe Powder\n\n**Method**\n1. Blend 35 sec.\n2. Top with Whipped Cream Swirl, Dark Chocolate Flakettes and Choc Drizzle.",
  ],
  [
    "Mocha Frappe",
    "#8B5CF6",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 1/4 cup Milk\n• 1 double shot Espresso (60ml)\n• 8x Chocolate Buttons\n• 4x small scoops Chocolate Frappe Powder\n\n**Method**\n1. Blend 35 sec.\n2. Top with Whipped Cream Swirl, Dark Chocolate Flakettes and Choc Drizzle.",
  ],
  [
    "Salted Caramel Frappe",
    "#8B5CF6",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 2/3 cup Milk\n• 3 pumps Salted Caramel Syrup (22.5ml)\n• 1x small scoop Salted Caramel Balls\n\n**Method**\n1. Blend 35 sec.\n2. Top with Whipped Cream Swirl and Silky Caramel in a lattice pattern.",
  ],
  [
    "Vanilla Chai Frappe",
    "#8B5CF6",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 1/2 cup Milk\n• 4x small scoops Vanilla Frappe Powder\n• 3x small scoops Vanilla Chai Powder\n\n**Method**\n1. Blend 35 sec.\n2. Top with Whipped Cream Swirl and dust with Cinnamon.",
  ],
  [
    "Matcha Frappe",
    "#8B5CF6",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 2/3 cup Milk\n• 1x small scoop Matcha Powder\n\n**Method**\n1. Mix Matcha Powder with a splash of boiling water to form a paste first.\n2. Blend all 35 sec.\n3. Top with Whipped Cream Swirl and a dusting of Matcha Powder.\n\n_Always make paste fresh — no premix._",
  ],
  [
    "Strawberry Matcha Frappe",
    "#8B5CF6",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 2/3 cup Milk\n• 2x small scoops Strawberry Frappe Powder\n• 1x small scoop Matcha Powder\n• 15g Raspberry Filling\n\n**Method**\n1. Add 15g Raspberry Filling to the first line of the cup.\n2. Mix Matcha with boiling water into a paste first.\n3. Add remaining ingredients and blend 35 sec.\n4. Top with Whipped Cream Swirl and a dusting of Matcha Powder.",
  ],
  [
    "White Choc Matcha Frappe",
    "#8B5CF6",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 2/3 cup Milk\n• 4x small scoops White Choc Powder\n• 1x small scoop Matcha Powder\n\n**Method**\n1. Mix Matcha with boiling water into a paste first.\n2. Blend all 35 sec.\n3. Top with Whipped Cream Swirl and a dusting of Matcha Powder.",
  ],

  // ── Iced Drinks — cyan ────────────────────────────────────────────────────
  [
    "Iced Coffee",
    "#06B6D4",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 1/4 cup Milk\n• 1/2 cup Soft Serve\n• 2x Double Espresso shots\n\n**Method**\n1. Blend 20 sec.\n2. Serve in 16oz PET cup with Dome lid and straw.\n\n_Whipped Cream available at customer's request._",
  ],
  [
    "Iced Latte",
    "#06B6D4",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 2x Double Espresso shots\n• 1 cup Milk\n\n**Method**\n1. Fill cup with Ice.\n2. Add espresso, then top with Milk to the brim.\n3. Serve with Dome lid and straw.\n\n_Sugar syrup can be added at customer request._",
  ],
  [
    "Iced Chocolate",
    "#06B6D4",
    5,
    "**Ingredients**\n• 1/2 cup Ice\n• 1.5 cups Milk\n• 1/2 cup Soft Serve\n• 2x small scoops Choc Drizzle\n\n**Blended method**\n1. Blend all 20 sec.\n2. Top with Whipped Cream, Choc Drizzle and Choc Flakes.\n\n**Unblended method**\n1. Add Milk, Ice and Choc Drizzle, stir.\n2. Add Soft Serve.\n3. Top with Whipped Cream, Choc Drizzle and Choc Flakes.\n\nServe in 16oz PET cup with Dome Lid.",
  ],
  [
    "Iced Chai",
    "#06B6D4",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 1 cup Milk\n• 4x small scoops Vanilla Chai Powder\n• Boiling water (for paste)\n\n**Method**\n1. Mix Vanilla Chai Powder with boiling water to form a paste.\n2. Fill cup with Ice, add Milk then Chai paste, mix.\n3. Top up with Milk.\n4. Serve with Dome lid and straw.\n\n_Sugar syrup at customer request._",
  ],
  [
    "Iced Tea",
    "#06B6D4",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 2 pumps Tea Syrup (15ml)\n• 3 pumps flavour syrup (22.5ml)\n\n**Method**\n1. Fill cup with Ice.\n2. Add Tea Syrup and flavour syrup.\n3. Top with cold water to just before the top.\n4. Stir to mix.\n5. Serve in 16oz PET cup with Dome lid.\n\n_Flavours: Black, Lemon, Strawberry, Watermelon, Peach._",
  ],
  [
    "Iced Matcha",
    "#06B6D4",
    5,
    "**Ingredients**\n• 1 full cup Ice\n• 1 cup Milk\n• 1x small scoop Matcha Powder\n• Boiling water (for paste)\n\n**Method**\n1. Mix Matcha Powder with boiling water to form a paste.\n2. Fill cup with Ice, add Milk then Matcha paste, mix.\n3. Top up with Milk.\n4. Serve with Dome lid and straw.\n\n_Sugar syrup at customer request._",
  ],

  // ── Milkshakes — pink ─────────────────────────────────────────────────────
  [
    "Chocolate Milkshake",
    "#EC4899",
    5,
    "**Small**\n• 1/2 cup Milk\n• 1/4 cup Soft Serve\n• 2 pumps Chocolate flavour\n\n**Large**\n• 1 cup Milk\n• 1/2 cup Soft Serve\n• 4 pumps Chocolate flavour\n\n**Thickshake** _(Large only)_\n• 3/4 cup Milk\n• 1 heaped cup Soft Serve\n• 4 pumps Chocolate flavour\n\n**Method**\n1. Blend 10 sec in metal cup.\n2. Serve in Striped cup with Slotted lid and straw.",
  ],
  [
    "Strawberry Milkshake",
    "#EC4899",
    5,
    "**Small**\n• 1/2 cup Milk\n• 1/4 cup Soft Serve\n• 2 pumps Strawberry flavour\n\n**Large**\n• 1 cup Milk\n• 1/2 cup Soft Serve\n• 3 pumps Strawberry flavour\n\n**Thickshake** _(Large only)_\n• 3/4 cup Milk\n• 1 heaped cup Soft Serve\n• 3 pumps Strawberry flavour\n\n**Method**\n1. Blend 10 sec in metal cup.\n2. Serve in Striped cup with Slotted lid and straw.",
  ],
  [
    "Vanilla Milkshake",
    "#EC4899",
    5,
    "**Small**\n• 1/2 cup Milk\n• 1/4 cup Soft Serve\n• 2 pumps Vanilla flavour\n\n**Large**\n• 1 cup Milk\n• 1/2 cup Soft Serve\n• 3 pumps Vanilla flavour\n\n**Thickshake** _(Large only)_\n• 3/4 cup Milk\n• 1 heaped cup Soft Serve\n• 3 pumps Vanilla flavour\n\n**Method**\n1. Blend 10 sec in metal cup.\n2. Serve in Striped cup with Slotted lid and straw.",
  ],
  [
    "Caramel Milkshake",
    "#EC4899",
    5,
    "**Small**\n• 1/2 cup Milk\n• 1/4 cup Soft Serve\n• 2 pumps Caramel flavour\n\n**Large**\n• 1 cup Milk\n• 1/2 cup Soft Serve\n• 3 pumps Caramel flavour\n\n**Thickshake** _(Large only)_\n• 3/4 cup Milk\n• 1 heaped cup Soft Serve\n• 3 pumps Caramel flavour\n\n**Method**\n1. Blend 10 sec in metal cup.\n2. Serve in Striped cup with Slotted lid and straw.",
  ],
  [
    "Blue Heaven Milkshake",
    "#EC4899",
    5,
    "**Small**\n• 1/2 cup Milk\n• 1/4 cup Soft Serve\n• 2 pumps Blue Heaven flavour\n\n**Large**\n• 1 cup Milk\n• 1/2 cup Soft Serve\n• 3 pumps Blue Heaven flavour\n\n**Thickshake** _(Large only)_\n• 3/4 cup Milk\n• 1 heaped cup Soft Serve\n• 3 pumps Blue Heaven flavour\n\n**Method**\n1. Blend 10 sec in metal cup.\n2. Serve in Striped cup with Slotted lid and straw.",
  ],
  [
    "Banana Milkshake",
    "#EC4899",
    5,
    "**Small**\n• 1/2 cup Milk\n• 1/4 cup Soft Serve\n• 2 pumps Banana flavour\n\n**Large**\n• 1 cup Milk\n• 1/2 cup Soft Serve\n• 3 pumps Banana flavour\n\n**Malted** _(Large only)_\n• Add 2x small scoops Malt before blending\n\n**Thickshake** _(Large only)_\n• 3/4 cup Milk\n• 1 heaped cup Soft Serve\n• 3 pumps Banana flavour\n\n**Method**\n1. Blend 10 sec in metal cup.",
  ],
  [
    "Biscoff Custard Shake",
    "#EC4899",
    5,
    "**Ingredients**\n• 1.5 cups Milk\n• 1.5 cups Ice\n• 1/2 cup Soft Serve\n• 1x large scoop Custard Powder\n• 1x large scoop Biscoff Spread\n\n**Method**\n1. Blend 20 sec.\n2. Top up with Milk if required.\n3. Serve in 22oz Striped cup with Slotted lid and straw.",
  ],
  [
    "Choc Peanut Butter Custard Shake",
    "#EC4899",
    5,
    "**Ingredients**\n• 1.5 cups Milk\n• 1.5 cups Ice\n• 1/2 cup Soft Serve\n• 1x large scoop Custard Powder\n• 2x small scoops Chocolate Powder\n• 1x large scoop Peanut Butter\n\n**Method**\n1. Blend 20 sec.\n2. Serve in 22oz Striped cup with Slotted lid and straw.",
  ],
  [
    "Cookies 'n Cream Custard Shake",
    "#EC4899",
    5,
    "**Ingredients**\n• 1.5 cups Milk\n• 1.5 cups Ice\n• 1/2 cup Soft Serve\n• 1x large scoop Custard Powder\n• 1x large scoop Vanilla Topping\n• 3x whole Oreo Biscuits\n\n**Method**\n1. Blend 20 sec.\n2. Serve in 22oz Striped cup with Slotted lid and straw.",
  ],
  [
    "Nutella Custard Shake",
    "#EC4899",
    5,
    "**Ingredients**\n• 1.5 cups Milk\n• 1.5 cups Ice\n• 1/2 cup Soft Serve\n• 1x large scoop Custard Powder\n• 1x large scoop Nutella\n\n**Method**\n1. Blend 20 sec.\n2. Serve in 22oz Striped cup with Slotted lid and straw.\n\n_Wet the scoop prior to use._",
  ],
  [
    "PB&J Custard Shake",
    "#EC4899",
    5,
    "**Ingredients**\n• 1.5 cups Milk\n• 1.5 cups Ice\n• 1/2 cup Soft Serve\n• 1x large scoop Custard Powder\n• 1x large scoop Peanut Butter\n• 1x small scoop Crushed Nuts\n• 1x large scoop Raspberry Filling\n\n**Method**\n1. Blend 20 sec.\n2. Serve in 22oz Striped cup with Slotted lid and straw.",
  ],
  [
    "Choc Fudge Malt Custard Shake",
    "#EC4899",
    5,
    "**Ingredients**\n• 1.5 cups Milk\n• 1.5 cups Ice\n• 1/2 cup Soft Serve\n• 40g Walker's Deluxe Choc Sauce\n• 20g Silky Caramel\n• 1x large scoop Custard Powder\n• 2x small scoops Malt Powder\n\n**Method**\n1. Blend 20 sec.\n2. Serve in 22oz Striped cup with Slotted lid and straw.\n\n_Wet the scoop prior to use for Silky Caramel._",
  ],

  // ── Doughsserts — orange ──────────────────────────────────────────────────
  [
    "Apple Custard Crumble Doughssert",
    "#F97316",
    10,
    "**Build order**\n1. Silky Caramel to bottom line\n2. 1 sml scoop Biscuit Crumb\n3. 1 blank hot jam quartered\n4. 3 sml scoops Toffee Apple filling\n5. Sprinkle Cinnamon\n6. Custard Cream swirl to top of logo\n7. Cover with Silky Caramel\n8. 1 sml scoop Biscuit Crumb\n9. Whipped Cream swirl to just above rim\n10. Dust with Cinnamon Powder\n\n_Serve in 16oz PET Clear Cup with Dome Lid and Soda Spoon._",
  ],
  [
    "Divine Triple Choc Doughssert",
    "#F97316",
    10,
    "**Build order**\n1. Deluxe Choc Fudge sauce to bottom line\n2. 1 sml scoop Choc Biscuit Crumb\n3. 1 blank hot jam quartered\n4. Choc Custard Cream swirl to top of logo\n5. Cover with Deluxe Choc Fudge sauce\n6. 2 sml scoops Choc Biscuit Crumb\n7. Whipped Cream swirl to just above rim\n8. Sprinkle 1 sml scoop Dark Choc Flakettes\n\n_Serve in 16oz PET Clear Cup with Dome Lid and Soda Spoon._",
  ],
  [
    "Custard Caramel Supreme Doughssert",
    "#F97316",
    10,
    "**Build order**\n1. Silky Caramel to bottom line\n2. 1 sml scoop Biscuit Crumb\n3. 1 blank hot jam quartered\n4. Custard Cream swirl to top of logo\n5. Cover with Silky Caramel\n6. 2 sml scoops Biscuit Crumb\n7. Whipped Cream swirl to just above rim\n8. Sprinkle 1/4 sml scoop Biscuit Crumb and 1/4 sml scoop Crispearls\n\n_Serve in 16oz PET Clear Cup with Dome Lid and Soda Spoon._",
  ],

  // ── Prep: Fillings — amber ────────────────────────────────────────────────
  [
    "Make Custard Cream",
    "#F59E0B",
    30,
    "**Ingredients**\n• 1250g Custard Powder\n• 2500ml Cold Water\n• 5000ml Cream\n\n**Method**\n1. Whisk cream and water together.\n2. Fold in custard until smooth peaks form.\n\n_Makes 8.75kg — enough for 215+ doughnuts. Custard should be light and fluffy._",
  ],
  [
    "Make Raspberry Cheesecake Filling",
    "#F59E0B",
    20,
    "**Per 1kg Custard Cream**\n• 50g Quark\n• 2x small scoops crushed Freeze Dried Raspberries\n\n**Method**\n1. Add Quark and raspberries to Custard Cream.\n2. Mix thoroughly.",
  ],
  [
    "Make Biscoff Filling",
    "#F59E0B",
    15,
    "**Ingredients**\n• 1000g Biscoff\n• 40g Vegetable Oil\n\n**Method**\n1. Mix thoroughly.\n\n_Makes enough for 100+ doughnuts. Adding 4% Vegetable Oil ensures a workable consistency for decorators._",
  ],
  [
    "Make Choc Custard Cream",
    "#F59E0B",
    20,
    "**Per 1kg Custard Cream**\n• 10x small scoops Chocolate Powder\n\n**Method**\n1. Add Chocolate Powder to Custard Cream.\n2. Mix thoroughly.",
  ],
  [
    "Make Honeycomb Custard Cream",
    "#F59E0B",
    20,
    "**Per 1kg Custard Cream**\n• 50g Honeycomb Flavour\n\n**Method**\n1. Add Honeycomb Flavour to Custard Cream.\n2. Mix thoroughly.",
  ],
  [
    "Make Strawberry Custard Cream",
    "#F59E0B",
    20,
    "**Per 1kg Custard Cream**\n• 160g Strawberry Frappe Powder\n\n**Method**\n1. Add Strawberry Frappe Powder to Custard Cream.\n2. Mix thoroughly.",
  ],
  [
    "Make Vanilla Chai Custard Cream",
    "#F59E0B",
    20,
    "**Per 1kg Custard Cream**\n• 120g Vanilla Chai Powder\n\n**Method**\n1. Add Vanilla Chai Powder to Custard Cream.\n2. Mix thoroughly.",
  ],
  [
    "Make Nutella Filling",
    "#F59E0B",
    15,
    "**Ingredients**\n• 3000g Nutella\n• 60g Vegetable Oil (2%)\n\n**Method**\n1. Add Vegetable Oil to Nutella.\n2. Mix until consistency is achieved — can take up to 5 minutes of hand mixing.",
  ],
  [
    "Make Peanut Butter Filling",
    "#F59E0B",
    15,
    "**Ingredients**\n• 1000g Peanut Butter\n• 200ml Vegetable Oil\n• 50g Icing Sugar _(NOT Snow Sugar)_\n\n**Method**\n1. Mix thoroughly.\n\n_Makes enough for 100+ doughnuts._",
  ],
  [
    "Make French Toast Sugar",
    "#F59E0B",
    15,
    "**Ingredients**\n• 1000g Caster Sugar\n• 500g Icing Sugar _(NOT Snow Sugar)_\n• 100g Cinnamon Powder\n\n**Method**\n1. Mix thoroughly.\n\n_Makes enough coating for 100+ doughnuts._",
  ],

  // ── Prep: Fondants & Glazes — yellow ──────────────────────────────────────
  [
    "Prepare Classic Glaze",
    "#EAB308",
    15,
    "Supplied from Bakery Group.\n\nMix all contents thoroughly before use.",
  ],
  [
    "Prepare Peanut Butter Glaze",
    "#EAB308",
    15,
    "**Ingredients**\n• 1000g Walker's Classic Glaze\n• 100g Smooth Peanut Butter\n• 30g Crushed Nuts\n\n**Method**\n1. Mix thoroughly.",
  ],
  [
    "Prepare Pineapple Glaze",
    "#EAB308",
    15,
    "**Ingredients**\n• 1000g Walker's Classic Glaze\n• 30g Icing Sugar _(NOT Snow Sugar)_\n• 30ml Pineapple Flavacol\n\n**Method**\n1. Mix thoroughly.",
  ],
  [
    "Prepare Banana Fondant",
    "#EAB308",
    20,
    "**Ingredients**\n• 1000g White Fondant\n• 40ml Banana Flavacol\n\n**Method**\n1. Bring Fondant to 60–65°C.\n2. Add Banana Flavacol.\n3. Mix thoroughly.",
  ],
  [
    "Prepare Biscoff Fondant",
    "#EAB308",
    20,
    "**Ingredients**\n• 1000g White Fondant\n• 200g Biscoff\n\n**Method**\n1. Place all ingredients in bain-marie.\n2. Bring to 65°C while stirring.\n\n_Bain-marie requires 30+ min to heat adequately._",
  ],
  [
    "Prepare Chocolate Fondant",
    "#EAB308",
    20,
    "**Ingredients**\n• 1000g White Fondant\n• 100g Butter\n• 200g Walker's Chocolate Buttons\n• 60g Cocoa Powder\n• 60ml Hot Water\n\n**Method**\n1. Place all ingredients in bain-marie.\n2. Bring to 65°C while stirring.",
  ],
  [
    "Prepare Coffee Fondant",
    "#EAB308",
    20,
    "**Ingredients**\n• 1000g White Fondant\n• 1 Double Espresso shot (60ml)\n\n**Method**\n1. Mix coffee liquid thoroughly into Fondant until combined.\n\n_Optimum temperature: 65°C._",
  ],
  [
    "Clean Fondant Bain-Marie",
    "#EAB308",
    30,
    "**Steps**\n1. Turn off bain-marie, cool 30 min.\n2. Remove pans, allow Fondants to set hard.\n3. Fill all Fondants (except Choc) with cold water, sit 20 min.\n4. Wipe sides and tops clean.\n5. Refill with fresh Fondant and return to clean bain-marie.",
  ],

  // ── Weekly Cleaning — green ───────────────────────────────────────────────
  [
    "Clean Ice Cream Machine",
    "#22C55E",
    30,
    "Full sanitize cycle. Scheduled **Monday** and **Friday**.\n\n_All cleaning tasks must be completed in full and signed off by those responsible._",
  ],
  [
    "Deep Clean Hatco (Hot Jam) Unit",
    "#22C55E",
    45,
    "Deep clean of the Hatco hot jam unit. Scheduled **Tuesday**.\n\n_All cleaning tasks must be completed in full and signed off by those responsible._",
  ],
  [
    "Empty & Clean Ice Machine",
    "#22C55E",
    30,
    "Empty and fully clean the ice machine. Scheduled **Wednesday**.\n\n_All cleaning tasks must be completed in full and signed off by those responsible._",
  ],
  [
    "Deep Clean All Fridges",
    "#22C55E",
    60,
    "Deep clean interior and exterior of all fridges. Scheduled **Thursday**.\n\n_All cleaning tasks must be completed in full and signed off by those responsible._",
  ],
  [
    "Deep Clean Doughnut Display",
    "#22C55E",
    30,
    "Deep clean the doughnut display unit. Scheduled **Friday**.\n\n_All cleaning tasks must be completed in full and signed off by those responsible._",
  ],
  [
    "Clean Top of Coffee Machine",
    "#22C55E",
    20,
    "Remove all cups etc and clean the top of the coffee machine. Scheduled **Saturday**.\n\n_All cleaning tasks must be completed in full and signed off by those responsible._",
  ],
  [
    "Check Dishwasher Chemicals & Refill Spray Bottles",
    "#22C55E",
    15,
    "Check dishwasher chemical levels and refill all spray bottles. Scheduled **Saturday**.\n\n_All cleaning tasks must be completed in full and signed off by those responsible._",
  ],
  [
    "Clean/Dust Store Shelves & Signage",
    "#22C55E",
    20,
    "Clean and dust all store shelves and signage throughout the store. Scheduled **Sunday**.\n\n_All cleaning tasks must be completed in full and signed off by those responsible._",
  ],
  [
    "Clean & Tidy Storeroom",
    "#22C55E",
    30,
    "Clean and tidy the storeroom. Scheduled **Sunday**.\n\n_All cleaning tasks must be completed in full and signed off by those responsible._",
  ],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function seedConversionData(prisma: PrismaClient, orgId: string) {
  const itemMap = new Map<string, string>();
  for (const item of TOOL_ITEMS) {
    const result = await prisma.toolItem.upsert({
      where: { orgId_name: { orgId, name: item.name } },
      update: { unit: item.unit },
      create: { orgId, name: item.name, unit: item.unit },
      select: { id: true },
    });
    itemMap.set(item.name, result.id);
  }
  console.log(`  ✓ ${TOOL_ITEMS.length} tool items upserted`);

  for (const setDef of CONVERSION_SETS) {
    const set = await prisma.conversionSet.upsert({
      where: { orgId_name: { orgId, name: setDef.name } },
      update: {},
      create: { orgId, name: setDef.name },
      select: { id: true },
    });

    for (const rate of setDef.rates) {
      const fromItemId = itemMap.get(rate.fromItemName);
      const toItemId = itemMap.get(rate.toItemName);
      if (!fromItemId || !toItemId) {
        console.warn(`  ⚠ Skipping rate: item not found (${rate.fromItemName} → ${rate.toItemName})`);
        continue;
      }
      await prisma.conversionRate.upsert({
        where: { setId_fromItemId_toItemId: { setId: set.id, fromItemId, toItemId } },
        update: { fromQty: rate.fromQty, toQty: rate.toQty },
        create: { setId: set.id, fromItemId, toItemId, fromQty: rate.fromQty, toQty: rate.toQty },
      });
    }
    console.log(`  ✓ "${setDef.name}": ${setDef.rates.length} rates upserted`);

    for (const tplDef of setDef.templates) {
      const tpl = await prisma.conversionTemplate.upsert({
        where: { setId_name: { setId: set.id, name: tplDef.name } },
        update: {},
        create: { setId: set.id, name: tplDef.name },
        select: { id: true },
      });
      for (const entry of tplDef.entries) {
        const itemId = itemMap.get(entry.itemName);
        if (!itemId) {
          console.warn(`  ⚠ Skipping template entry: item not found (${entry.itemName})`);
          continue;
        }
        await prisma.conversionTemplateEntry.upsert({
          where: { templateId_itemId: { templateId: tpl.id, itemId } },
          update: { quantity: entry.quantity, pinnedOutput: entry.pinnedOutput },
          create: { templateId: tpl.id, itemId, quantity: entry.quantity, pinnedOutput: entry.pinnedOutput },
        });
      }
      console.log(`    ✓ Template "${tplDef.name}": ${tplDef.entries.length} entries`);
    }
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Seeds the Walker's Doughnuts org.
 * - If the org already exists (matched by name + ownerId), upserts
 *   roles/permissions/membership and replaces tasks + conversion data.
 * - Otherwise creates everything from scratch.
 *
 * The caller is responsible for `--reset` deletion if needed.
 */
export async function seedWalkersDoughnuts(
  prisma: PrismaClient,
  owner: { id: string },
) {
  const existing = await prisma.organization.findFirst({
    where: { name: "Walker's Doughnuts", ownerId: owner.id },
  });

  if (existing) {
    console.log(
      `  ℹ Org already exists (id: ${existing.id}) — upserting roles/permissions/membership and replacing tasks.`,
    );

    const [roleOwner] = await Promise.all([
      prisma.role.upsert({
        where: { orgId_key: { orgId: existing.id, key: ROLE_KEYS.OWNER } },
        update: {},
        create: {
          orgId: existing.id,
          name: "Owner",
          key: ROLE_KEYS.OWNER,
          color: "#ef4444",
          isDeletable: false,
          isDefault: false,
        },
      }),
      prisma.role.upsert({
        where: { orgId_key: { orgId: existing.id, key: ROLE_KEYS.DEFAULT_MEMBER } },
        update: {},
        create: {
          orgId: existing.id,
          name: "Default Member",
          key: ROLE_KEYS.DEFAULT_MEMBER,
          color: "#6b7280",
          isDeletable: false,
          isDefault: true,
        },
      }),
    ]);

    await prisma.permission.createMany({
      data: ALL_OWNER_PERMISSIONS.map((action) => ({ roleId: roleOwner.id, action })),
      skipDuplicates: true,
    });

    const membership = await prisma.membership.upsert({
      where: { userId_orgId: { userId: owner.id, orgId: existing.id } },
      update: {},
      create: {
        orgId: existing.id,
        userId: owner.id,
        workingDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      },
    });
    await prisma.memberRole.createMany({
      data: [{ membershipId: membership.id, roleId: roleOwner.id }],
      skipDuplicates: true,
    });

    await prisma.task.deleteMany({ where: { orgId: existing.id } });
    await prisma.task.createMany({
      data: TASKS.map(([name, color, durationMin, description]) => ({
        orgId: existing.id,
        name,
        color,
        durationMin,
        description,
      })),
    });
    console.log(`  ✓ ${TASKS.length} tasks replaced`);

    console.log("→ Seeding conversion data...");
    await seedConversionData(prisma, existing.id);
    return;
  }

  console.log("→ Creating org...");
  const org = await prisma.organization.create({
    data: {
      name: "Walker's Doughnuts",
      ownerId: owner.id,
      timezone: "Australia/Sydney",
      openTimeMin: 6 * 60,
      closeTimeMin: 18 * 60,
      operatingDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    },
  });
  console.log(`  ✓ Org created (id: ${org.id})`);

  const [roleOwner] = await Promise.all([
    prisma.role.create({
      data: {
        orgId: org.id,
        name: "Owner",
        key: ROLE_KEYS.OWNER,
        color: "#ef4444",
        isDeletable: false,
        isDefault: false,
      },
    }),
    prisma.role.create({
      data: {
        orgId: org.id,
        name: "Default Member",
        key: ROLE_KEYS.DEFAULT_MEMBER,
        color: "#6b7280",
        isDeletable: false,
        isDefault: true,
      },
    }),
  ]);
  await prisma.permission.createMany({
    data: ALL_OWNER_PERMISSIONS.map((action) => ({ roleId: roleOwner.id, action })),
    skipDuplicates: true,
  });
  console.log("  ✓ Roles + permissions created");

  const membership = await prisma.membership.create({
    data: {
      orgId: org.id,
      userId: owner.id,
      workingDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    },
  });
  await prisma.memberRole.create({
    data: { membershipId: membership.id, roleId: roleOwner.id },
  });
  console.log("  ✓ Owner membership + role assigned");

  await prisma.task.createMany({
    data: TASKS.map(([name, color, durationMin, description]) => ({
      orgId: org.id,
      name,
      color,
      durationMin,
      description,
    })),
    skipDuplicates: true,
  });
  console.log(`  ✓ ${TASKS.length} tasks created`);

  console.log("→ Seeding conversion data...");
  await seedConversionData(prisma, org.id);
}
