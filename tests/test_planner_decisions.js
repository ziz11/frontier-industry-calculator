const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getDefaultRecipeForType,
  resolveRecipeForType,
} = require("../web/planner/recipe_resolution.js");
const {
  buildDecisionSet,
  buildDecisionSummary,
} = require("../web/planner/decisions.js");

function createOptions(...blueprintIds) {
  return blueprintIds.map((blueprintId) => ({ blueprintId }));
}

test("resolveRecipeForType returns null when no options exist", () => {
  assert.equal(resolveRecipeForType(100, {}, {}), null);
  assert.equal(resolveRecipeForType(100, {}, { 100: [] }), null);
});

test("resolveRecipeForType returns deterministic default when no override exists", () => {
  const recipeOptionsByType = {
    100: createOptions(3002, 3001, 3003),
  };

  assert.deepEqual(resolveRecipeForType(100, {}, recipeOptionsByType), { blueprintId: 3001 });
});

test("resolveRecipeForType default is stable with shuffled input order", () => {
  const left = resolveRecipeForType(100, {}, { 100: createOptions(7, 2, 4) });
  const right = resolveRecipeForType(100, {}, { 100: createOptions(4, 7, 2) });

  assert.deepEqual(left, { blueprintId: 2 });
  assert.deepEqual(right, { blueprintId: 2 });
});

test("resolveRecipeForType uses valid override when present", () => {
  const recipeOptionsByType = {
    100: createOptions(10, 20, 30),
  };

  assert.deepEqual(resolveRecipeForType(100, { 100: 30 }, recipeOptionsByType), { blueprintId: 30 });
});

test("resolveRecipeForType ignores stale override and falls back to default", () => {
  const recipeOptionsByType = {
    100: createOptions(10, 20, 30),
  };

  assert.deepEqual(resolveRecipeForType(100, { 100: 999 }, recipeOptionsByType), { blueprintId: 10 });
});

test("getDefaultRecipeForType returns null with no options", () => {
  assert.equal(getDefaultRecipeForType(100, {}), null);
  assert.equal(getDefaultRecipeForType(100, { 100: [] }), null);
});

test("getDefaultRecipeForType returns first recipe by blueprintId ascending", () => {
  const recipeOptionsByType = {
    100: createOptions(10, 2, 8),
  };

  assert.deepEqual(getDefaultRecipeForType(100, recipeOptionsByType), { blueprintId: 2 });
});

test("buildDecisionSet includes only typeIds with more than one recipe", () => {
  const decisionSet = buildDecisionSet(
    [100, 200, 300],
    {
      100: createOptions(1),
      200: createOptions(2, 3),
      300: createOptions(4, 5, 6),
    },
    {},
  );

  assert.deepEqual(
    decisionSet.map((entry) => entry.typeId),
    [200, 300],
  );
});

test("buildDecisionSet output is sorted by typeId ascending", () => {
  const decisionSet = buildDecisionSet(
    [900, 100, 500],
    {
      100: createOptions(10, 11),
      500: createOptions(20, 21),
      900: createOptions(30, 31),
    },
    {},
  );

  assert.deepEqual(
    decisionSet.map((entry) => entry.typeId),
    [100, 500, 900],
  );
});

test("buildDecisionSet returns deterministic sorted options and recipes", () => {
  const decisionSet = buildDecisionSet(
    [100],
    {
      100: [{ blueprintId: 40 }, { blueprintId: 10 }, { blueprintId: 30, note: "x" }],
    },
    {},
  );

  assert.equal(decisionSet.length, 1);
  assert.deepEqual(
    decisionSet[0].options.map((option) => option.blueprintId),
    [10, 30, 40],
  );
  assert.deepEqual(decisionSet[0].defaultRecipe, { blueprintId: 10 });
  assert.deepEqual(decisionSet[0].currentRecipe, { blueprintId: 10 });
});

test("buildDecisionSet marks decisionState default when current equals default", () => {
  const decisionSet = buildDecisionSet(
    [100],
    {
      100: createOptions(2, 3),
    },
    {},
  );

  assert.equal(decisionSet[0].decisionState, "default");
});

test("buildDecisionSet marks decisionState overridden when valid override differs", () => {
  const decisionSet = buildDecisionSet(
    [100],
    {
      100: createOptions(2, 3, 4),
    },
    {
      100: 4,
    },
  );

  assert.equal(decisionSet[0].decisionState, "overridden");
  assert.deepEqual(decisionSet[0].currentRecipe, { blueprintId: 4 });
  assert.deepEqual(decisionSet[0].defaultRecipe, { blueprintId: 2 });
});

test("buildDecisionSet treats stale override as default decision", () => {
  const decisionSet = buildDecisionSet(
    [100],
    {
      100: createOptions(2, 3, 4),
    },
    {
      100: 999,
    },
  );

  assert.equal(decisionSet[0].decisionState, "default");
  assert.deepEqual(decisionSet[0].currentRecipe, { blueprintId: 2 });
});

test("buildDecisionSummary counts total default and overridden", () => {
  const decisionSet = [
    { typeId: 100, decisionState: "default" },
    { typeId: 200, decisionState: "overridden" },
    { typeId: 300, decisionState: "default" },
  ];

  assert.deepEqual(buildDecisionSummary(decisionSet), {
    totalMultiPathItems: 3,
    defaultCount: 2,
    overriddenCount: 1,
  });
});

test("buildDecisionSummary returns zero counts for empty decision set", () => {
  assert.deepEqual(buildDecisionSummary([]), {
    totalMultiPathItems: 0,
    defaultCount: 0,
    overriddenCount: 0,
  });
});
