export type FranchiseTokenDef = {
  invitedEmail: string;
  expiresInDays: number;
};

export const data: FranchiseTokenDef[] = [
  { invitedEmail: "owner@downtown-donuts.com.au", expiresInDays: 30 },
  { invitedEmail: "franchise@northside-rings.com.au", expiresInDays: 14 },
  { invitedEmail: "ops@southbay-donuts.com.au", expiresInDays: 7 },
];