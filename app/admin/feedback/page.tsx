/**
 * /admin/feedback — super-admin feedback inbox.
 *
 * Access is gated by requireSuperAdminPage(), which checks the signed-in
 * user's email against the AdminUser table. Non-admins are redirected to /.
 *
 * All feedback is fetched server-side on every visit so the list is always
 * fresh; the client component handles optimistic reviewed/unreviewed toggling.
 */

import { requireSuperAdminPage } from "@/lib/authz";
import { getAllFeedback } from "@/lib/services/feedback";
import { AdminFeedbackClient } from "./_components/admin-feedback-client";

export default async function AdminFeedbackPage() {
  await requireSuperAdminPage();
  const feedback = await getAllFeedback();
  return <AdminFeedbackClient feedback={feedback} />;
}
