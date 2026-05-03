import { Suspense } from "react";
import JoinFranchisePage from "./join-franchise-client";

export default function Page() {
  return (
    <Suspense>
      <JoinFranchisePage />
    </Suspense>
  );
}
