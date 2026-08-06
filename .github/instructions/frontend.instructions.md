# Frontend Instructions

Use these rules for UI, layout, styling, and frontend component work.

## Design Direction

- Match the existing FriendChise visual language: calm, refined, and functional.
- Prefer clean surfaces, subtle borders, and restrained shadows.
- Avoid generic SaaS styling unless it already matches the page you are editing.
- Keep interfaces intentional, not decorative.

## Component Choices

- Prefer existing shared UI components before creating custom ones.
- If the current building blocks are close but not quite enough, extend the shared component instead of cloning it into a one-off variant.
- If a new component is necessary, design it as a reusable shared building block with a clear API so other screens can use it later.
- Use the repo's shadcn-based primitives when they already fit the job.
- Use `AlertDialog` for destructive confirmation flows.
- Use `Button` variants and sizes consistently with the existing design system.
- Keep compact icon buttons at the repo-standard touch target sizes.

## Layout Rules

- Add `min-w-0` to flex and grid children when content can grow horizontally.
- Protect mobile layouts from overflow and clipped content.
- Preserve responsive behavior across desktop and mobile.
- Avoid introducing unnecessary scroll containers.
- Prefer local layout fixes over global styling changes.

## Interaction Rules

- Make primary actions obvious and secondary actions quieter.
- Do not hide important actions behind hover-only behavior on touch devices.
- Use loading, empty, and error states that are specific to the feature.
- Keep destructive actions explicit.

## Accessibility

- Every icon-only button needs a clear accessible label.
- Interactive elements should have the correct semantic element and keyboard behavior.
- Do not rely on color alone to communicate state.
- Make sure dialogs, menus, and drawers remain keyboard accessible.

## Styling Guidelines

- Reuse existing Tailwind tokens and component patterns.
- Prefer small, targeted styling changes over broad visual rewrites.
- Keep spacing, radius, and typography aligned with nearby components.
- If a page already has an established tone, follow it rather than rebranding it.

## Examples

Good:

```tsx
<Button size="icon-sm" variant="ghost" aria-label="Delete draft">
	<Trash2 className="h-3.5 w-3.5" />
</Button>
```

Bad:

```tsx
<button className="h-6 w-6 rounded bg-purple-500 text-white">
	<Trash2 />
</button>
```

Good:

```tsx
<div className="flex min-w-0 flex-1 items-center gap-3">
	<span className="min-w-0 truncate">Long title text</span>
</div>
```

Bad:

```tsx
<div className="flex flex-1 items-center gap-3">
	<span>Long title text</span>
</div>
```

Good:

```tsx
<AlertDialog>
	<AlertDialogTrigger asChild>
		<Button variant="destructive">Delete</Button>
	</AlertDialogTrigger>
</AlertDialog>
```

Bad:

```tsx
if (confirm("Delete this item?")) {
	deleteItem();
}
```
