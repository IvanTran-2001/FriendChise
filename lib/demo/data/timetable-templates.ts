export type TimetableTemplateDef = {
  name: string;
  cycleLengthDays: number;
};

export const data: TimetableTemplateDef[] = [
  { name: "Weekday Rotation", cycleLengthDays: 5 },
  { name: "Weekend Shift", cycleLengthDays: 2 },
  { name: "Weekly Cleaning Schedule", cycleLengthDays: 7 },
];