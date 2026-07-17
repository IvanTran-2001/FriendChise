export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type RosterMemberDef = {
  key: string;
  botName?: string;
  days: DayKey[];
  start: number;
  end: number;
};

export const data: RosterMemberDef[] = [
  { key: "owner", days: ["mon", "tue", "wed", "thu", "fri"], start: 7 * 60, end: 15 * 60 },
  { key: "jordan", botName: "Jordan", days: ["mon", "tue", "wed", "thu", "fri"], start: 6 * 60, end: 14 * 60 + 30 },
  { key: "casey", botName: "Casey", days: ["tue", "wed", "thu", "fri", "sat"], start: 9 * 60, end: 17 * 60 + 30 },
  { key: "riley", botName: "Riley", days: ["mon", "wed", "fri", "sat"], start: 10 * 60, end: 18 * 60 + 30 },
  { key: "alex", botName: "Alex", days: ["mon", "tue", "thu"], start: 8 * 60, end: 14 * 60 },
  { key: "openSlot", botName: "Open Slot", days: ["mon", "wed", "fri"], start: 6 * 60, end: 14 * 60 },
  { key: "morningRunner", botName: "Morning Runner", days: ["tue", "thu", "sat"], start: 6 * 60, end: 14 * 60 + 30 },
  { key: "fryerBackup", botName: "Fryer Backup", days: ["mon", "tue", "wed"], start: 7 * 60, end: 15 * 60 },
  { key: "counterFloat", botName: "Counter Float", days: ["wed", "fri", "sun"], start: 9 * 60, end: 17 * 60 + 30 },
  { key: "weekendFill", botName: "Weekend Fill", days: ["sat", "sun"], start: 8 * 60, end: 16 * 60 },
];