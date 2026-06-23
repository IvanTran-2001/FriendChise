---
title: Item List
description: Build reusable item lists as grids, checklists, or cards
order: 1
---

The Item List tool lets managers build named lists of `ToolItem`s for stations or jobs.

## What it does

- Lists can be used as a prep checklist, a grid of required items, or a structured list.
- Each list stores a `displayType` so the UI opens in the right mode.
- `GRID` supports fixed dimensions through `ToolItemGridConfig`.
- `CHECKLIST` stores checked state separately so checking and unchecking stay cheap.
- `TABLE` and `GALLERY` are reserved for future list views.

## Key ideas

- `ToolItemList` is the named container.
- `ToolItemListEntry` is one slot in the list.
- `ToolItemChecklistEntry` only exists when a checklist item is checked.
- Managers can create, rename, duplicate, and delete lists.

## Connection to other tools

- The grid view can use a `ConversionSet` overlay to show live rates for the selected items.
- That makes the Item List tool useful for prep math as well as organization.
