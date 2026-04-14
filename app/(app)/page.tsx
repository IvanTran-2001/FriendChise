import { Suspense } from "react";
import { OrgNotFoundToast } from "./org-not-found-toast";

/** Home page — currently a placeholder rendered at the app root `/`. */
export default function Home() {
  return (
    <div>
      <Suspense>
        <OrgNotFoundToast />
      </Suspense>
    </div>
  );
}
