# Planner Mode Rework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix Planner mode so browser-selected plan lines compute real dependency output and the planner UI presents readable, icon-backed production information.

**Architecture:** Keep the existing static `web/app.js` rendering model, but add a graph-backed planner dependency expander for browser use and enrich planner render helpers with graph item metadata. Update `web/index.html` and `web/styles.css` so Planner mode reads as separated queue, breakdown, and routing panels without changing the overall app shell.

**Tech Stack:** Vanilla JavaScript, static HTML, CSS, Node test runner

---

### Task 1: Lock the missing planner compute path with a failing test

**Files:**
- Modify: `tests/test_planner_ui_shell.js`
- Check: `web/app.js`

**Step 1: Write the failing test**

Add a test that creates a planner runtime, injects a graph-backed planner expander, adds a craft target, and expects raw materials to appear.

```js
runtime.setExpandDependencies((typeId, quantity, resolveRecipeFn) =>
  buildPlannerDependencyNode(sampleGraph, typeId, quantity, resolveRecipeFn),
);

runtime.addLine({ lineId: "line-a", outputTypeId: 200, quantity: 2 });

assert.deepEqual(runtime.getRenderModel().plannerResult.rawMaterials, [{ typeId: 100, quantity: 4 }]);
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/test_planner_ui_shell.js`
Expected: FAIL because the runtime does not yet expose the expander setter or graph-backed dependency builder.

**Step 3: Write minimal implementation**

Add the runtime setter and planner dependency builder support in `web/app.js`.

**Step 4: Run test to verify it passes**

Run: `node --test tests/test_planner_ui_shell.js`
Expected: PASS

### Task 2: Lock readable planner labels with failing tests

**Files:**
- Modify: `tests/test_planner_plan_builder.js`
- Modify: `tests/test_planner_output_ui.js`
- Modify: `tests/test_planner_decision_panel.js`
- Check: `web/app.js`

**Step 1: Write the failing tests**

Add assertions that planner queue rows, output rows, and decision groups render item names and icon hooks instead of leading with raw `Type` and `Blueprint` labels.

```js
assert.match(markup, /Composite Plate/);
assert.match(markup, /data-icon-type-id="200"/);
assert.doesNotMatch(markup, /Blueprint 6001/);
```

**Step 2: Run tests to verify they fail**

Run: `node --test tests/test_planner_plan_builder.js tests/test_planner_output_ui.js tests/test_planner_decision_panel.js`
Expected: FAIL because the current planner markup is ID-first and icon-free.

**Step 3: Write minimal implementation**

Enrich planner render helpers with graph metadata and readable recipe summaries.

**Step 4: Run tests to verify they pass**

Run: `node --test tests/test_planner_plan_builder.js tests/test_planner_output_ui.js tests/test_planner_decision_panel.js`
Expected: PASS

### Task 3: Rebuild the Planner layout into separated queue, breakdown, and routing regions

**Files:**
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Check: `tests/test_planner_ui_shell.js`

**Step 1: Write the failing test**

Add markup assertions for separated planner builder subsections.

```js
assert.match(indexHtml, /id="plannerCatalogPanel"/);
assert.match(indexHtml, /id="plannerQueuePanel"/);
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/test_planner_ui_shell.js`
Expected: FAIL because the current planner builder is one undifferentiated column.

**Step 3: Write minimal implementation**

Split the left planner column into clearer catalog and queue surfaces and refresh the planner styling in `web/styles.css`.

**Step 4: Run test to verify it passes**

Run: `node --test tests/test_planner_ui_shell.js`
Expected: PASS

### Task 4: Hydrate planner icons and verify the planner suite

**Files:**
- Modify: `web/app.js`
- Verify: `tests/test_planner_ui_shell.js`
- Verify: `tests/test_planner_plan_builder.js`
- Verify: `tests/test_planner_output_ui.js`
- Verify: `tests/test_planner_decision_panel.js`

**Step 1: Implement icon hydration for planner shell**

Hydrate planner icons after planner rendering so icon ZIP assets appear in the new planner rows and cards.

**Step 2: Run the targeted suite**

Run: `node --test tests/test_planner_ui_shell.js tests/test_planner_plan_builder.js tests/test_planner_output_ui.js tests/test_planner_decision_panel.js tests/test_planner_compute.js`
Expected: PASS

**Step 3: Run broader safety checks**

Run: `node --test tests/test_layout_structure.js tests/test_calculator_workspace_ui.js tests/test_web_app.js`
Expected: PASS
