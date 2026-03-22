# Planner Mode Redesign Design

**Date:** 2026-03-22

**Scope:** Repair Planner mode so selected targets compute correctly and the workspace reads like an industrial production planner instead of a debug console.

## Problem

The current Planner mode has three linked failures:

- plan lines can be added, but the browser planner runtime does not expand them into dependency output, so the center and right panels stay empty
- the builder stack visually collapses catalog search and plan queue into one muddy column with weak separation
- plan lines and decision options expose raw `Type` and `Blueprint` identifiers instead of readable item names, useful recipe summaries, and icons

This makes Planner mode look partially implemented even when the user has selected valid craft targets.

## Direction

Use a compact signal-board layout with three clearly separated work zones:

- **Queue** on the left for searching and assembling the craft plan
- **Breakdown** in the middle for named raw materials and intermediate components
- **Routing** on the right for ambiguous recipe choices and planner status

The aesthetic should stay within the existing dark industrial theme, but feel more deliberate and easier to scan.

## Functional Fix

Planner mode must stop relying on the placeholder dependency expander in the browser app. After a dataset is loaded, planner computation should use the live graph and current recipe choices to build dependency nodes for each selected plan line.

That graph-backed expander should:

- resolve the currently selected recipe for each craftable type
- compute runs and required child quantities from recipe outputs and inputs
- recurse until base materials or uncraftable items are reached
- tolerate cycles by stopping recursion and marking the node as non-base

Once this is wired, the existing planner compute pipeline can populate raw materials, components, and decision groups correctly.

## Planner Presentation

The Planner workspace should be reorganized around clearer semantic blocks:

1. **Catalog**
   - search field
   - result list with item icons, names, type metadata, and add action

2. **Plan Queue**
   - explicit subpanel below catalog
   - queue cards with item icon, readable item name, selected recipe summary, quantity control, and remove action

3. **Production Breakdown**
   - raw materials and components shown as named rows with icons
   - recipe-linked rows retain focus behavior into the decisions panel

4. **Recipe Decisions**
   - summary cards remain at top
   - each decision group shows the item name first
   - options are described by facility/output/runtime/input hints rather than blueprint IDs

## Behavior Rules

- adding a plan line immediately recomputes planner output
- changing line quantity immediately recomputes planner output
- changing a decision recomputes planner output for every occurrence of that type in the current plan
- planner sections remain informative with or without loaded icons
- planner output rows only advertise focus behavior when a corresponding decision exists

## Accessibility

- keep buttons and quantity inputs as native controls
- make recipe-linked output rows keyboard focusable only when interactive
- preserve meaningful text labels when icons are missing

## Success Criteria

The redesign is complete when:

- valid planner lines populate raw materials or components in the browser app
- the left column clearly separates search from queued plan lines
- planner rows and decision groups show readable item names instead of leading with raw IDs
- icons hydrate correctly in planner catalog, queue, output, and decision views when an icon archive is loaded
