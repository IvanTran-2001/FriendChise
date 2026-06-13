# Item List UI Change Log

This file documents the item-list refactor files currently changed in the workspace and what each one now does.

## Changed Files

### `app/(app)/orgs/[orgId]/tools/item-list/lists/[listId]/_components/add-item-to-list-panel.tsx`
- Keeps the add-item flow split into grid selection and manual entry.
- Uses the persisted mode preference so the last selected mode is remembered.
- In grid mode, selecting an item arms placement rather than immediately moving it.
- In manual mode, the user can still enter a position directly and add the item immediately.

### `app/(app)/orgs/[orgId]/tools/item-list/lists/[listId]/_components/item-detail-panel.tsx`
- Shows item details, quantity editing, and position editing in a flatter layout.
- Uses a shared blue action button for the position actions.
- Supports both grid selection and manual page/column/row input for moving the item.
- Keeps the move UI visually aligned with the add-item flow.

### `app/(app)/orgs/[orgId]/tools/item-list/lists/[listId]/_components/list-detail-client.tsx`
- Coordinates the add-item and item-move armed states.
- Shows the shared placement banner while the user is selecting a cell.
- Routes page-grid clicks to either add-item placement or item-detail relocation.
- Keeps the highlighted grid cell in sync with the currently armed action.

### `app/(app)/orgs/[orgId]/tools/item-list/lists/[listId]/_components/list-grid-view.tsx`
- Highlights the grid blue while placement mode is active.
- Makes every cell feel selectable during add-item or move selection.
- Preserves existing drag/drop, highlighting, and stack navigation behavior outside placement mode.

### `app/(app)/orgs/[orgId]/tools/item-list/lists/[listId]/_components/blue-action-button.tsx`
- Shared blue CTA component for the item-list detail UI.
- Keeps the original brand color while giving the action buttons a more polished treatment.
- Used for the item-detail panel's select and move actions.

### `app/(app)/orgs/[orgId]/tools/item-list/lists/[listId]/_components/placement-status-banner.tsx`
- Shared placement banner for both add-item and item-select states.
- Shows the active item name and a short instruction message.
- Provides the cancel action in a consistent layout.

### `hooks/use-persisted-state.ts`
- Persists mode state in localStorage.
- Broadcasts same-tab updates so sidebar and panel state stays in sync immediately.
- Skips redundant writes to avoid echo loops and update-depth issues.

## Notes

- The shared visual pieces are now split into two reusable components: a blue CTA button and a placement banner.
- The grid itself still owns the blue selectable-cell styling, while the parent controller owns the selection state and routing logic.
- The add-item and item-move flows are intentionally aligned so they read as the same interaction pattern.
