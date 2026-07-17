/**
 * Server-side function to generate the list of dev users for the sign-in picker.
 * Uses the seeded users constant which includes namespaced emails.
 * Only works on the server since it calls resolveSeedNamespace().
 */

import { SEEDED_USERS } from "@/lib/demo/seeded-users";

export interface DevUser {
  email: string;
  label: string;
  role: string;
}

export function getDevUsers(): DevUser[] {
  return [
    { email: SEEDED_USERS.owner.email, label: "MainDev", role: "Owner" },
    { email: SEEDED_USERS.jordan.email, label: "Jordan", role: "Shift Lead" },
    { email: SEEDED_USERS.casey.email, label: "Casey", role: "Fryer Op" },
    {
      email: SEEDED_USERS.riley.email,
      label: "Riley",
      role: "Shift Lead + Fryer",
    },
    { email: SEEDED_USERS.alex.email, label: "Alex", role: "Trainee" },
    { email: SEEDED_USERS.morgan.email, label: "Morgan", role: "" },
    { email: SEEDED_USERS.taylor.email, label: "Taylor", role: "" },
    { email: SEEDED_USERS.sam.email, label: "Sam", role: "" },
    { email: SEEDED_USERS.quinn.email, label: "Quinn", role: "" },
  ];
}
