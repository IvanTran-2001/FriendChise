---

title: Feedback System

order: 18.5

---
Users can submit feedback (bug reports or feature ideas) from anywhere in the app via the **Feedback button** in the navbar. Submissions are stored in the `Feedback` table and reviewed by admins at `/admin/feedback`.

### How it works

1. User clicks the **Feedback** button (top-right of the navbar).
2. An `ActionSidebar` panel opens with a two-step form:
   - **Step 1** — pick a type: Issue or Idea.
   - **Step 2** — write a message and optionally attach a screenshot.
3. Screenshots are compressed client-side (max 1 MB / 1280px via `browser-image-compression`), then uploaded directly from the browser to Supabase Storage (`friendchise-public` bucket, path `feedback/{userId}/{uuid}.{ext}`) using a signed upload URL — bypassing Vercel's 4.5 MB body limit.
4. On submit, `submitFeedbackAction` saves the feedback row (with the optional `imageUrl` storage path).