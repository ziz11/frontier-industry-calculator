const test = require("node:test");
const assert = require("node:assert/strict");

const { createEmptyPlannerState } = require("../web/planner/state.js");
const { normalizePlanLines } = require("../web/planner/normalize.js");

test("createEmptyPlannerState returns initialized planner state with provided fingerprint", () => {
  const state = createEmptyPlannerState("dataset-v1");

  assert.deepEqual(state, {
    planLines: [],
    recipeChoiceByType: {},
    uiState: {},
    datasetFingerprint: "dataset-v1",
  });
});

test("normalizePlanLines keeps a single valid line unchanged", () => {
  const output = normalizePlanLines([{ lineId: "line-1", outputTypeId: 42, quantity: 3 }]);

  assert.deepEqual(output, [{ typeId: 42, quantity: 3 }]);
});

test("normalizePlanLines merges duplicate output types by summing quantities", () => {
  const output = normalizePlanLines([
    { lineId: "line-1", outputTypeId: 42, quantity: 3 },
    { lineId: "line-2", outputTypeId: 42, quantity: 5 },
    { lineId: "line-3", outputTypeId: 7, quantity: 2 },
  ]);

  assert.deepEqual(output, [
    { typeId: 7, quantity: 2 },
    { typeId: 42, quantity: 8 },
  ]);
});

test("normalizePlanLines sorts aggregated output by typeId ascending", () => {
  const output = normalizePlanLines([
    { lineId: "line-1", outputTypeId: 900, quantity: 1 },
    { lineId: "line-2", outputTypeId: 1, quantity: 1 },
    { lineId: "line-3", outputTypeId: 50, quantity: 1 },
  ]);

  assert.deepEqual(output, [
    { typeId: 1, quantity: 1 },
    { typeId: 50, quantity: 1 },
    { typeId: 900, quantity: 1 },
  ]);
});

test("normalizePlanLines excludes lines with invalid quantities", () => {
  const output = normalizePlanLines([
    { lineId: "line-1", outputTypeId: 10, quantity: 0 },
    { lineId: "line-2", outputTypeId: 11, quantity: -2 },
    { lineId: "line-3", outputTypeId: 12, quantity: Number.NaN },
    { lineId: "line-4", outputTypeId: 10, quantity: 4 },
  ]);

  assert.deepEqual(output, [{ typeId: 10, quantity: 4 }]);
});

test("normalizePlanLines returns empty output for empty input", () => {
  assert.deepEqual(normalizePlanLines([]), []);
});
