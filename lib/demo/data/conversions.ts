export type ConversionItemDef = {
  name: string;
  unit: string;
};

export type ConversionRateDef = {
  from: string;
  to: string;
  fromQty: number;
  toQty: number;
};

export type ConversionTemplateDef = {
  name: string;
};

export type ConversionTemplateEntryDef = {
  template: string;
  item: string;
  quantity: number | null;
  pinnedOutput: 1 | 2 | 3;
};

export const conversionItems: ConversionItemDef[] = [
  { name: "Donut Ring", unit: "each" },
  { name: "Dough", unit: "g" },
  { name: "Cake Flour", unit: "g" },
  { name: "Yeast", unit: "g" },
  { name: "Salt", unit: "g" },
  { name: "Fry Oil", unit: "L" },
  { name: "Custard Cream", unit: "g" },
  { name: "Biscoff Spread", unit: "g" },
  { name: "Raspberry Jam", unit: "g" },
  { name: "Chocolate Fondant", unit: "g" },
  { name: "Glaze", unit: "g" },
  { name: "Hundreds & Thousands", unit: "g" },
  { name: "Biscoff Crumb", unit: "g" },
  { name: "Whipped Cream", unit: "g" },
  { name: "Cocoa Powder", unit: "g" },
];

export const conversionRates: ConversionRateDef[] = [
  { from: "Donut Ring", to: "Dough", fromQty: 1, toQty: 75 },
  { from: "Donut Ring", to: "Cake Flour", fromQty: 1, toQty: 45 },
  { from: "Donut Ring", to: "Yeast", fromQty: 100, toQty: 5 },
  { from: "Donut Ring", to: "Salt", fromQty: 100, toQty: 4 },
  { from: "Donut Ring", to: "Fry Oil", fromQty: 12, toQty: 1 },
  { from: "Donut Ring", to: "Custard Cream", fromQty: 1, toQty: 35 },
  { from: "Donut Ring", to: "Biscoff Spread", fromQty: 1, toQty: 30 },
  { from: "Donut Ring", to: "Raspberry Jam", fromQty: 1, toQty: 25 },
  { from: "Donut Ring", to: "Chocolate Fondant", fromQty: 1, toQty: 40 },
  { from: "Donut Ring", to: "Glaze", fromQty: 1, toQty: 20 },
  { from: "Donut Ring", to: "Hundreds & Thousands", fromQty: 1, toQty: 8 },
  { from: "Donut Ring", to: "Biscoff Crumb", fromQty: 1, toQty: 10 },
  { from: "Donut Ring", to: "Whipped Cream", fromQty: 1, toQty: 15 },
  { from: "Donut Ring", to: "Cocoa Powder", fromQty: 1, toQty: 5 },
  { from: "Dough", to: "Cake Flour", fromQty: 100, toQty: 60 },
];

export const conversionTemplates: ConversionTemplateDef[] = [
  { name: "Default" },
  { name: "Morning Batch" },
  { name: "Weekday Batch" },
  { name: "Weekend Batch" },
  { name: "Event / Catering" },
];

export const conversionTemplateEntries: ConversionTemplateEntryDef[] = [
  { template: "Default", item: "Donut Ring", quantity: null, pinnedOutput: 1 },
  { template: "Default", item: "Dough", quantity: null, pinnedOutput: 2 },
  { template: "Default", item: "Cake Flour", quantity: null, pinnedOutput: 2 },
  { template: "Default", item: "Yeast", quantity: null, pinnedOutput: 2 },
  { template: "Default", item: "Fry Oil", quantity: null, pinnedOutput: 2 },
  { template: "Default", item: "Custard Cream", quantity: null, pinnedOutput: 2 },
  { template: "Default", item: "Biscoff Spread", quantity: null, pinnedOutput: 2 },
  { template: "Default", item: "Raspberry Jam", quantity: null, pinnedOutput: 2 },
  { template: "Default", item: "Chocolate Fondant", quantity: null, pinnedOutput: 2 },
  { template: "Default", item: "Glaze", quantity: null, pinnedOutput: 2 },
  { template: "Morning Batch", item: "Donut Ring", quantity: 120, pinnedOutput: 1 },
  { template: "Morning Batch", item: "Dough", quantity: null, pinnedOutput: 2 },
  { template: "Morning Batch", item: "Cake Flour", quantity: null, pinnedOutput: 2 },
  { template: "Morning Batch", item: "Yeast", quantity: null, pinnedOutput: 2 },
  { template: "Morning Batch", item: "Fry Oil", quantity: null, pinnedOutput: 2 },
  { template: "Morning Batch", item: "Custard Cream", quantity: null, pinnedOutput: 2 },
  { template: "Morning Batch", item: "Biscoff Spread", quantity: null, pinnedOutput: 2 },
  { template: "Morning Batch", item: "Glaze", quantity: null, pinnedOutput: 2 },
  { template: "Weekday Batch", item: "Donut Ring", quantity: 80, pinnedOutput: 1 },
  { template: "Weekday Batch", item: "Dough", quantity: null, pinnedOutput: 2 },
  { template: "Weekday Batch", item: "Cake Flour", quantity: null, pinnedOutput: 2 },
  { template: "Weekday Batch", item: "Fry Oil", quantity: null, pinnedOutput: 2 },
  { template: "Weekday Batch", item: "Custard Cream", quantity: null, pinnedOutput: 2 },
  { template: "Weekday Batch", item: "Raspberry Jam", quantity: null, pinnedOutput: 2 },
  { template: "Weekday Batch", item: "Glaze", quantity: null, pinnedOutput: 2 },
  { template: "Weekend Batch", item: "Donut Ring", quantity: 200, pinnedOutput: 1 },
  { template: "Weekend Batch", item: "Dough", quantity: null, pinnedOutput: 2 },
  { template: "Weekend Batch", item: "Cake Flour", quantity: null, pinnedOutput: 2 },
  { template: "Weekend Batch", item: "Yeast", quantity: null, pinnedOutput: 2 },
  { template: "Weekend Batch", item: "Fry Oil", quantity: null, pinnedOutput: 2 },
  { template: "Weekend Batch", item: "Custard Cream", quantity: null, pinnedOutput: 2 },
  { template: "Weekend Batch", item: "Biscoff Spread", quantity: null, pinnedOutput: 2 },
  { template: "Weekend Batch", item: "Chocolate Fondant", quantity: null, pinnedOutput: 2 },
  { template: "Weekend Batch", item: "Glaze", quantity: null, pinnedOutput: 2 },
  { template: "Weekend Batch", item: "Hundreds & Thousands", quantity: null, pinnedOutput: 2 },
  { template: "Weekend Batch", item: "Biscoff Crumb", quantity: null, pinnedOutput: 2 },
  { template: "Weekend Batch", item: "Whipped Cream", quantity: null, pinnedOutput: 2 },
  { template: "Event / Catering", item: "Donut Ring", quantity: 360, pinnedOutput: 1 },
  { template: "Event / Catering", item: "Dough", quantity: null, pinnedOutput: 2 },
  { template: "Event / Catering", item: "Cake Flour", quantity: null, pinnedOutput: 2 },
  { template: "Event / Catering", item: "Yeast", quantity: null, pinnedOutput: 2 },
  { template: "Event / Catering", item: "Salt", quantity: null, pinnedOutput: 2 },
  { template: "Event / Catering", item: "Fry Oil", quantity: null, pinnedOutput: 2 },
  { template: "Event / Catering", item: "Custard Cream", quantity: null, pinnedOutput: 2 },
  { template: "Event / Catering", item: "Biscoff Spread", quantity: null, pinnedOutput: 2 },
  { template: "Event / Catering", item: "Raspberry Jam", quantity: null, pinnedOutput: 2 },
  { template: "Event / Catering", item: "Chocolate Fondant", quantity: null, pinnedOutput: 2 },
  { template: "Event / Catering", item: "Glaze", quantity: null, pinnedOutput: 2 },
  { template: "Event / Catering", item: "Hundreds & Thousands", quantity: null, pinnedOutput: 2 },
  { template: "Event / Catering", item: "Biscoff Crumb", quantity: null, pinnedOutput: 2 },
  { template: "Event / Catering", item: "Whipped Cream", quantity: null, pinnedOutput: 2 },
  { template: "Event / Catering", item: "Cocoa Powder", quantity: null, pinnedOutput: 2 },
];
