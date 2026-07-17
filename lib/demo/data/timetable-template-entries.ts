export type TimetableTemplateEntryDef = {
  templateName: string;
  taskName: string;
  dayIndex: number;
  startTime: string;
  endTime: string;
};

export const data: TimetableTemplateEntryDef[] = [
  { templateName: "Weekday Rotation", taskName: "Open Shop Checklist", dayIndex: 0, startTime: "06:00", endTime: "06:30" },
  { templateName: "Weekday Rotation", taskName: "Fry Morning Batches", dayIndex: 0, startTime: "07:00", endTime: "08:00" },
  { templateName: "Weekday Rotation", taskName: "Mid-Day Stock Check", dayIndex: 0, startTime: "12:00", endTime: "12:20" },
  { templateName: "Weekday Rotation", taskName: "Fry Afternoon Batches", dayIndex: 0, startTime: "13:00", endTime: "13:45" },
  { templateName: "Weekday Rotation", taskName: "Close Shop Checklist", dayIndex: 0, startTime: "17:00", endTime: "17:45" },
  { templateName: "Weekday Rotation", taskName: "Fryer Oil Quality Check", dayIndex: 2, startTime: "07:30", endTime: "07:45" },
  { templateName: "Weekday Rotation", taskName: "Quality Check — Display & Products", dayIndex: 2, startTime: "10:00", endTime: "10:20" },
  { templateName: "Weekday Rotation", taskName: "Restock Packaging & Supplies", dayIndex: 4, startTime: "11:00", endTime: "11:25" },
  { templateName: "Weekend Shift", taskName: "Open Shop Checklist", dayIndex: 0, startTime: "06:00", endTime: "06:30" },
  { templateName: "Weekend Shift", taskName: "Fry Morning Batches", dayIndex: 0, startTime: "07:00", endTime: "08:00" },
  { templateName: "Weekend Shift", taskName: "Mid-Day Stock Check", dayIndex: 0, startTime: "12:00", endTime: "12:20" },
  { templateName: "Weekend Shift", taskName: "Close Shop Checklist", dayIndex: 1, startTime: "17:00", endTime: "17:45" },
  { templateName: "Weekly Cleaning Schedule", taskName: "Clean Ice Cream Machine", dayIndex: 0, startTime: "14:00", endTime: "14:30" },
  { templateName: "Weekly Cleaning Schedule", taskName: "Deep Clean Hatco (Hot Jam) Unit", dayIndex: 1, startTime: "14:30", endTime: "15:15" },
  { templateName: "Weekly Cleaning Schedule", taskName: "Deep Clean All Fridges", dayIndex: 3, startTime: "14:00", endTime: "15:00" },
  { templateName: "Weekly Cleaning Schedule", taskName: "Deep Clean Doughnut Display", dayIndex: 4, startTime: "15:00", endTime: "15:30" },
  { templateName: "Weekly Cleaning Schedule", taskName: "Clean & Tidy Storeroom", dayIndex: 6, startTime: "15:00", endTime: "15:30" },
  { templateName: "Weekly Cleaning Schedule", taskName: "Clean Fryer (End of Day)", dayIndex: 0, startTime: "17:30", endTime: "18:10" },
];