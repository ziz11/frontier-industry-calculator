const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createCalculatorWorkspaceState,
  reduceCalculatorWorkspaceState,
  summarizeWorkspaceHeader,
  createRecipeSummary,
} = require("../web/app.js");

test("calculator workspace state defaults to plan tab and closed overlays", () => {
  const state = createCalculatorWorkspaceState();

  assert.deepEqual(state, {
    activeWorkspaceTab: "plan",
    openDrawer: null,
    isUploadModalOpen: false,
    expandedLists: {
      materials: false,
      components: false,
    },
  });
});

test("calculator workspace reducer switches across direct plan pipeline and tree tabs", () => {
  const base = createCalculatorWorkspaceState();
  const withPipeline = reduceCalculatorWorkspaceState(base, {
    type: "set-workspace-tab",
    tab: "pipeline",
  });
  const withTree = reduceCalculatorWorkspaceState(withPipeline, {
    type: "set-workspace-tab",
    tab: "tree",
  });
  const backToPlan = reduceCalculatorWorkspaceState(withTree, {
    type: "set-workspace-tab",
    tab: "plan",
  });

  assert.equal(withPipeline.activeWorkspaceTab, "pipeline");
  assert.equal(withTree.activeWorkspaceTab, "tree");
  assert.equal(backToPlan.activeWorkspaceTab, "plan");
});

test("calculator workspace reducer toggles drawers and upload modal independently", () => {
  const base = createCalculatorWorkspaceState();
  const datasetOpen = reduceCalculatorWorkspaceState(base, {
    type: "toggle-drawer",
    drawer: "dataset",
  });
  const filtersOpen = reduceCalculatorWorkspaceState(datasetOpen, {
    type: "toggle-drawer",
    drawer: "filters",
  });
  const modalOpen = reduceCalculatorWorkspaceState(filtersOpen, {
    type: "toggle-upload-modal",
  });
  const modalClosed = reduceCalculatorWorkspaceState(modalOpen, {
    type: "toggle-upload-modal",
  });

  assert.equal(datasetOpen.openDrawer, "dataset");
  assert.equal(filtersOpen.openDrawer, "filters");
  assert.equal(modalOpen.isUploadModalOpen, true);
  assert.equal(modalClosed.isUploadModalOpen, false);
});

test("header summary reports zero progress when no tracked lines exist", () => {
  const summary = summarizeWorkspaceHeader({
    currentSummary: createRecipeSummary({
      meta: { snapshot: "x" },
      items: {
        400: { typeID: 400, name: "Composite Hull", mass: 1, volume: 1, isCraftable: true },
      },
      recipes: {
        1: {
          blueprintID: 1,
          primaryTypeID: 400,
          runTime: 10,
          inputs: [],
          outputs: [{ typeID: 400, quantity: 1 }],
        },
      },
      recipesByOutput: { 400: [1] },
      baseMaterials: [],
    }, 400, 1, {}),
    currentProgressSections: {
      allLines: [],
    },
  });

  assert.equal(summary.progressPercent, 0);
  assert.equal(summary.etaLabel, "10s");
});
