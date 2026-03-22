# Tree UX Redesign Design

**Date:** 2026-03-22

**Scope:** Rework the Tree workspace so dependency exploration feels fast, readable, and reliable in the existing workbench UI.

## Problem

The current tree has three core failures:

- expand and collapse is broken because the rendered toggle attribute and the click handler do not match
- node rows feel like disconnected mini-cards instead of one readable dependency structure
- the interaction model puts too much weight on a tiny `+/-` control instead of the row itself

The result is a tree that looks dense but does not behave like a dependable planning tool.

## Direction

Use a compact row-first dependency outline with an industrial signal-board feel.

The visual goal is not dashboard polish or stacked card components. The tree should read like operational equipment:

- one clear vertical spine
- strong indentation and connector cues
- dense but legible rows
- restrained use of status color as signal, not decoration

## Primary Interaction Model

- The whole row toggles expand and collapse when the node has children.
- Leaf rows are inert for expansion and should not look clickable in the same way.
- Recipe controls remain separate interactive targets inside the row and must not trigger expand or collapse.
- Global `Expand` and `Collapse` actions remain available from the view settings drawer.

This is the right fit for the calculator because the tree is used for rapid scanning and traversal, not for selecting a single node and opening a side inspector.

## Node Anatomy

Each node row should be reorganized into three bands:

1. **Structure band**
   - chevron affordance
   - connector rail
   - depth indentation

2. **Identity band**
   - item icon
   - item name
   - quantity needed
   - run count or raw-material label

3. **State band**
   - recipe choice chip
   - recipe details chip when enabled
   - tracked-status chip when enabled
   - thin status progress meter

Children should remain visually nested under the same spine so depth can be understood at a glance.

## Behavior Rules

- The root row is expanded by default.
- Clicking a branch row toggles its descendants open or closed.
- Clicking the recipe chip opens the recipe chooser without toggling the row.
- Changing the recipe select updates all occurrences of that item in the current plan, matching current behavior.
- Hidden-covered filtering and depth filtering continue to apply before rendering child rows.

## Accessibility

- Expandable rows should expose `role="button"` and `aria-expanded`.
- Non-expandable rows should not advertise expansion behavior.
- Focus styling needs to be visible on the row itself, not just a tiny internal control.
- Recipe actions stay keyboard reachable and semantically separate.

## Implementation Notes

The redesign can stay within the existing static HTML app architecture:

- update `renderDependencyOutlineMarkup` in `web/app.js` so rows own expansion behavior
- fix the tree click handler to listen for the actual tree row attributes
- keep recipe actions isolated with event targeting
- replace the current boxed node styling in `web/styles.css` with cleaner connector, hover, and focus treatments
- preserve the existing toolbar and view settings controls

## Success Criteria

The redesign is complete when:

- row click expand and collapse works reliably
- recipe actions still work without collapsing rows
- the tree reads as one coherent outline instead of stacked boxes
- the Tree workspace feels denser and easier to scan on desktop while still wrapping cleanly on narrower widths
