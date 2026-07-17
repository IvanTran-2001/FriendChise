"use client";

import { DemoSubmitButton } from "@/components/demo-submit-button";

/**
 * Client component — must be a child of the demo <form> so useFormStatus
 * can detect when the server action is pending.
 */
export function TryDemoButton() {
  return (
    <DemoSubmitButton
      className="flex w-full cursor-pointer items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium"
      loadingLabel="Setting up your demo…"
    >
      Try Demo
    </DemoSubmitButton>
  );
}
