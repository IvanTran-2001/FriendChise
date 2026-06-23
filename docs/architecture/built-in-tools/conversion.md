---
title: Conversion
description: Convert between tool items using directed rates and templates
order: 2
---

The Conversion tool turns item-to-item rates into a calculator for kitchen prep and yield math.

## How it works

- A `ConversionSet` groups rates and templates for one org.
- A `ConversionRate` is a directed edge from one `ToolItem` to another.
- The stored rate is `toQty / fromQty`, so the UI can multiply through a chain of rates.
- The calculator follows connected rates as a graph and keeps a visited set so cycles do not loop forever.

## Why it is not a tree

- A tree would imply one parent and one path.
- Conversion rates can connect in multiple directions, so the data behaves like a graph.
- The UI uses graph traversal to find connected items and chained conversions.

## Templates

- Templates store the active calculator state for a set.
- The active template is selected from the URL and restored on reload.
- This lets a manager keep different calculations for different recipes or batches.

## Why this section exists

- Conversion logic is easier to understand when the rates, templates, and calculator are documented together.
- The UI layer handles selection and form state; the service layer holds the reusable rate logic.
