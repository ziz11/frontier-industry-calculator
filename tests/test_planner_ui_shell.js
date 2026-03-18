const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createPlannerRuntime } = require("../web/app.js");

const indexHtml = fs.readFileSync(path.join(__dirname, "..", "web", "index.html"), "utf8");

test("mode switch exists", () => {
  assert.match(indexHtml, /id="modeCalculator"/);
  assert.match(indexHtml, /id="modePlanner"/);
});

test("default mode is calculator", () => {
  const runtime = createPlannerRuntime({
    datasetFingerprint: "fp-default",
    plannerSupport: {
      createEmptyPlannerState: (datasetFingerprint) => ({
        planLines: [],
        recipeChoiceByType: {},
        uiState: {},
        datasetFingerprint,
      }),
      savePlannerState: () => {},
      loadPlannerState: () => null,
      computePlannerPlan: () => ({
        rawMaterials: [],
        components: [],
        dependencyOutline: [],
        totals: { totalRuntime: 0, totalMass: 0, totalVolume: 0 },
        decisions: [],
        decisionSummary: { totalMultiPathItems: 0, defaultCount: 0, overriddenCount: 0 },
      }),
    },
  });

  assert.equal(runtime.getRenderModel().mode, "calculator");
});

test("switching to planner has planner regions in markup", () => {
  assert.match(indexHtml, /data-testid="planner-left"/);
  assert.match(indexHtml, /data-testid="planner-center"/);
  assert.match(indexHtml, /data-testid="planner-right"/);
});

test("planner state loads and persists", () => {
  const calls = {
    saved: null,
    loaded: false,
  };

  const runtime = createPlannerRuntime({
    datasetFingerprint: "fp-1",
    plannerSupport: {
      createEmptyPlannerState: (datasetFingerprint) => ({
        planLines: [],
        recipeChoiceByType: {},
        uiState: {},
        datasetFingerprint,
      }),
      loadPlannerState: () => {
        calls.loaded = true;
        return {
          planLines: [{ lineId: "l1", outputTypeId: 42, quantity: 2 }],
          recipeChoiceByType: {},
          uiState: {},
          datasetFingerprint: "fp-1",
        };
      },
      savePlannerState: (state) => {
        calls.saved = state;
      },
      computePlannerPlan: ({ planLines }) => ({
        rawMaterials: planLines.map((line) => ({ typeId: line.outputTypeId, quantity: line.quantity })),
        components: [],
        dependencyOutline: [],
        totals: { totalRuntime: 0, totalMass: 0, totalVolume: 0 },
        decisions: [],
        decisionSummary: { totalMultiPathItems: 0, defaultCount: 0, overriddenCount: 0 },
      }),
    },
  });

  runtime.load();
  runtime.updateLineQuantity("l1", 3);

  assert.equal(calls.loaded, true);
  assert.equal(calls.saved.planLines[0].quantity, 3);
});

test("adding line updates computed center output", () => {
  const runtime = createPlannerRuntime({
    datasetFingerprint: "fp-2",
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
        rawMaterials: planLines.map((line) => ({ typeId: line.outputTypeId, quantity: line.quantity })),
        components: [],
        dependencyOutline: [],
        totals: { totalRuntime: 0, totalMass: 0, totalVolume: 0 },
        decisions: [],
        decisionSummary: { totalMultiPathItems: 0, defaultCount: 0, overriddenCount: 0 },
      }),
    },
  });

  runtime.load();
  runtime.addLine({ lineId: "line-a", outputTypeId: 88, quantity: 5 });

  assert.deepEqual(runtime.getRenderModel().plannerResult.rawMaterials, [{ typeId: 88, quantity: 5 }]);
});
