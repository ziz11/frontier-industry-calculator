const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createPlannerRuntime,
  searchPlannerCatalog,
  renderPlannerLinesMarkup,
  buildPlannerLineViewModels,
} = require("../web/app.js");

function createRuntime() {
  return createPlannerRuntime({
    datasetFingerprint: "fp-plan-builder",
    plannerSupport: {
      createEmptyPlannerState: (datasetFingerprint) => ({
        planLines: [],
        recipeChoiceByType: {},
        uiState: {},
        datasetFingerprint,
      }),
      loadPlannerState: () => null,
      savePlannerState: () => {},
      computePlannerPlan: ({ planLines }) => ({
        rawMaterials: [{ typeId: 999, quantity: planLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0) }],
        components: [],
        dependencyOutline: [],
        totals: { totalRuntime: 0, totalMass: 0, totalVolume: 0 },
        decisions: [],
        decisionSummary: { totalMultiPathItems: 0, defaultCount: 0, overriddenCount: 0 },
      }),
    },
  });
}

const sampleGraph = {
  items: {
    100: { typeID: 100, name: "Dense Ore", isCraftable: false },
    101: { typeID: 101, name: "Signal Core", isCraftable: false },
    102: { typeID: 102, name: "Gas Cell", isCraftable: false },
    200: { typeID: 200, name: "Composite Plate", isCraftable: true },
    300: { typeID: 300, name: "Shield Relay", isCraftable: true },
  },
  recipes: {
    1000: {
      blueprintID: 1000,
      runTime: 12,
      inputs: [{ typeID: 100, quantity: 2 }],
      outputs: [{ typeID: 200, quantity: 1 }],
    },
    1001: {
      blueprintID: 1001,
      runTime: 9,
      inputs: [{ typeID: 101, quantity: 1 }],
      outputs: [{ typeID: 300, quantity: 1 }],
    },
    1002: {
      blueprintID: 1002,
      runTime: 6,
      inputs: [{ typeID: 102, quantity: 1 }],
      outputs: [{ typeID: 200, quantity: 2 }],
    },
  },
  recipesByOutput: {
    200: [1000, 1002],
    300: [1001],
  },
};

test("add line from planner search", () => {
  const runtime = createRuntime();
  runtime.load();

  const results = searchPlannerCatalog(sampleGraph, "plate");
  assert.equal(results.length, 1);
  assert.equal(results[0].typeID, 200);

  runtime.addLine({ outputTypeId: results[0].typeID, quantity: 1 });

  assert.equal(runtime.getRenderModel().plannerState.planLines.length, 1);
  assert.equal(runtime.getRenderModel().plannerState.planLines[0].outputTypeId, 200);
});

test("update quantity mutates planner line quantity", () => {
  const runtime = createRuntime();
  runtime.load();
  runtime.addLine({ lineId: "line-a", outputTypeId: 200, quantity: 1 });

  runtime.updateLineQuantity("line-a", 7);

  assert.equal(runtime.getRenderModel().plannerState.planLines[0].quantity, 7);
});

test("remove line deletes matching planner line", () => {
  const runtime = createRuntime();
  runtime.load();
  runtime.addLine({ lineId: "line-a", outputTypeId: 200, quantity: 1 });
  runtime.addLine({ lineId: "line-b", outputTypeId: 300, quantity: 2 });

  runtime.removeLine("line-a");

  assert.deepEqual(
    runtime.getRenderModel().plannerState.planLines.map((line) => line.lineId),
    ["line-b"],
  );
});

test("duplicate lines are allowed in planner edit state", () => {
  const runtime = createRuntime();
  runtime.load();

  runtime.addLine({ lineId: "line-a", outputTypeId: 200, quantity: 1 });
  runtime.addLine({ lineId: "line-b", outputTypeId: 200, quantity: 2 });

  assert.equal(runtime.getRenderModel().plannerState.planLines.length, 2);
  assert.deepEqual(
    runtime.getRenderModel().plannerState.planLines.map((line) => line.outputTypeId),
    [200, 200],
  );
});

test("multi-recipe badge appears when output has more than one recipe option", () => {
  const viewModels = buildPlannerLineViewModels({
    planLines: [{ lineId: "line-a", outputTypeId: 200, quantity: 1 }],
    recipeChoiceByType: {},
    recipeOptionsByType: {},
    graph: sampleGraph,
  });

  assert.equal(viewModels[0].hasMultiRecipe, true);

  const markup = renderPlannerLinesMarkup({
    planLines: [{ lineId: "line-a", outputTypeId: 200, quantity: 1 }],
    recipeChoiceByType: {},
    recipeOptionsByType: {},
    graph: sampleGraph,
  });

  assert.match(markup, /planner-multi-recipe-badge/);
});

test("empty state appears with no planner lines", () => {
  const markup = renderPlannerLinesMarkup({
    planLines: [],
    recipeChoiceByType: {},
    recipeOptionsByType: {},
    graph: sampleGraph,
  });

  assert.match(markup, /No plan lines yet/);
  assert.match(markup, /planner-empty-state/);
});

test("planner line markup renders readable item identity instead of raw ids", () => {
  const markup = renderPlannerLinesMarkup({
    planLines: [{ lineId: "line-a", outputTypeId: 200, quantity: 1 }],
    recipeChoiceByType: {},
    recipeOptionsByType: {},
    graph: sampleGraph,
  });

  assert.match(markup, /Composite Plate/);
  assert.match(markup, /data-icon-type-id="200"/);
  assert.match(markup, /planner-line-meta">Type 200/);
  assert.doesNotMatch(markup, /Blueprint 1000/);
});

test("recompute output changes after planner edits", () => {
  const runtime = createRuntime();
  runtime.load();

  const before = runtime.getRenderModel().plannerResult.rawMaterials[0].quantity;
  runtime.addLine({ lineId: "line-a", outputTypeId: 200, quantity: 3 });
  const afterAdd = runtime.getRenderModel().plannerResult.rawMaterials[0].quantity;
  runtime.updateLineQuantity("line-a", 5);
  const afterUpdate = runtime.getRenderModel().plannerResult.rawMaterials[0].quantity;
  runtime.removeLine("line-a");
  const afterRemove = runtime.getRenderModel().plannerResult.rawMaterials[0].quantity;

  assert.equal(before, 0);
  assert.equal(afterAdd, 3);
  assert.equal(afterUpdate, 5);
  assert.equal(afterRemove, 0);
});
