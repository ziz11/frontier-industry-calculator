# Tree UX Rework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Tree workspace so dependency rows expand and collapse by clicking the whole row, recipe controls remain independently interactive, and the outline styling reads as a coherent dependency spine.

**Architecture:** Keep the existing static HTML rendering pipeline in `web/app.js`, but shift expansion ownership from the small internal toggle button to the row wrapper. Preserve current data flow and toolbar settings while replacing the node markup and CSS with a more compact, connected outline treatment.

**Tech Stack:** Static HTML, vanilla JavaScript, CSS, Node test runner

---

### Task 1: Lock the row interaction contract with tests

**Files:**
- Modify: `tests/test_web_app.js`
- Check: `web/app.js`

**Step 1: Write the failing test**

Add assertions around `renderDependencyOutlineMarkup(...)` so the rendered tree:

- exposes a row-level toggle attribute for expandable rows
- does not rely on the old small-button-only interaction model
- keeps recipe toggle controls as separate interactive elements

```js
const markup = renderDependencyOutlineMarkup(tree, new Map(), {
  graph: sampleGraph,
  expandedNodeIds: new Set([tree.nodeId]),
});

assert.match(markup, /data-outline-row-toggle-node-id=/);
assert.match(markup, /data-outline-recipe-toggle-type-id="200"/);
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/test_web_app.js`
Expected: FAIL because the current markup does not expose the new row-level contract.

**Step 3: Write minimal implementation**

Update the tree renderer in `web/app.js` so expandable rows render the new row toggle attribute and semantic state.

**Step 4: Run test to verify it passes**

Run: `node --test tests/test_web_app.js`
Expected: PASS for the new tree interaction assertions.

**Step 5: Commit**

```bash
git add tests/test_web_app.js web/app.js
git commit -m "test: lock tree row toggle contract"
```

### Task 2: Move expand and collapse behavior to the full row

**Files:**
- Modify: `web/app.js`
- Test: `tests/test_web_app.js`

**Step 1: Write the failing test**

Add a DOM-level or handler-focused test that proves:

- row clicks toggle expansion
- clicks on recipe controls do not toggle expansion
- `expand-all` and `collapse-all` continue to work

```js
assert.equal(state.expandedNodeIds.has(nodeId), false);
handleTreeClick(makeClickEvent("row"));
assert.equal(state.expandedNodeIds.has(nodeId), true);
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/test_web_app.js`
Expected: FAIL because `handleTreeClick` currently listens for `[data-toggle-node-id]` instead of the tree renderer's actual attributes.

**Step 3: Write minimal implementation**

In `web/app.js`:

- update `handleTreeClick` to target the row-level tree attribute
- prevent row toggling when the click originated in recipe controls
- keep root expansion bookkeeping and re-render logic unchanged

**Step 4: Run test to verify it passes**

Run: `node --test tests/test_web_app.js`
Expected: PASS with working row-owned expansion behavior.

**Step 5: Commit**

```bash
git add tests/test_web_app.js web/app.js
git commit -m "feat: move tree expansion to row clicks"
```

### Task 3: Rebuild the outline styling for a cleaner dependency spine

**Files:**
- Modify: `web/styles.css`
- Check: `web/index.html`
- Test: `tests/test_web_app.js`

**Step 1: Write the failing test**

Add markup expectations that cover the new structural classes needed by the CSS refresh, for example chevron, connector, and row body wrappers.

```js
assert.match(markup, /class="outline-row-body/);
assert.match(markup, /class="outline-chevron/);
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/test_web_app.js`
Expected: FAIL because the current renderer emits the old boxed-node structure.

**Step 3: Write minimal implementation**

Update `web/app.js` and `web/styles.css` so the tree:

- renders a row structure built for full-row interaction
- uses lighter connector rails and clearer indentation
- improves hover, focus, and expanded states
- keeps recipe chooser spacing aligned with the new row layout
- wraps sensibly below desktop widths

**Step 4: Run test to verify it passes**

Run: `node --test tests/test_web_app.js`
Expected: PASS for the structural assertions and no regressions in existing tree markup tests.

**Step 5: Commit**

```bash
git add web/app.js web/styles.css tests/test_web_app.js
git commit -m "feat: redesign dependency tree outline"
```

### Task 4: Run verification on the tree workspace

**Files:**
- Verify: `web/app.js`
- Verify: `web/styles.css`
- Verify: `tests/test_web_app.js`

**Step 1: Run the targeted suite**

Run: `node --test tests/test_web_app.js`
Expected: PASS

**Step 2: Run the broader UI safety net**

Run: `node --test tests/test_layout_structure.js tests/test_calculator_workspace_ui.js`
Expected: PASS

**Step 3: Manually verify in browser**

Check:

- row click expands and collapses
- recipe chip opens chooser without toggling the row
- drawer `Expand` and `Collapse` controls still work
- desktop and narrower widths keep the tree readable

**Step 4: Commit**

```bash
git add web/app.js web/styles.css tests/test_web_app.js docs/plans/2026-03-22-tree-ux-design.md docs/plans/2026-03-22-tree-ux-rework.md
git commit -m "docs: capture tree ux redesign plan"
```
