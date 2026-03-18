const test = require("node:test");
const assert = require("node:assert/strict");

const { computePlannerPlan } = require("../web/planner/compute_plan.js");

const recipeOptionsByType = {
  500: [{ blueprintId: 5001 }],
  600: [{ blueprintId: 6001 }, { blueprintId: 6002 }],
  700: [{ blueprintId: 7001 }],
};

function makeExpandDependencies() {
  return function expandDependencies(typeId, quantity, resolveRecipeFn) {
    const selected = resolveRecipeFn(typeId);

    if (typeId === 500) {
      const selectedFor600 = resolveRecipeFn(600);
      const usesAlt600 = selectedFor600 && selectedFor600.blueprintId === 6002;
      return {
        typeId: 500,
        quantity,
        runs: quantity,
        isBaseMaterial: false,
        recipe: selected,
        runtime: quantity * 10,
        mass: 0,
        volume: 0,
        children: [
          {
            typeId: 600,
            quantity,
            runs: quantity,
            isBaseMaterial: false,
            recipe: selectedFor600,
            runtime: quantity * (usesAlt600 ? 9 : 5),
            mass: 0,
            volume: 0,
            children: [
              {
                typeId: 100,
                quantity: usesAlt600 ? quantity : quantity * 2,
                runs: 0,
                isBaseMaterial: true,
                recipe: null,
                runtime: 0,
                mass: usesAlt600 ? quantity * 2 : quantity * 4,
                volume: usesAlt600 ? quantity * 2 : quantity * 8,
                children: [],
              },
            ],
          },
          {
            typeId: 700,
            quantity,
            runs: quantity,
            isBaseMaterial: false,
            recipe: resolveRecipeFn(700),
            runtime: quantity * 3,
            mass: 0,
            volume: 0,
            children: [
              {
                typeId: 100,
                quantity,
                runs: 0,
                isBaseMaterial: true,
                recipe: null,
                runtime: 0,
                mass: quantity * 2,
                volume: quantity * 3,
                children: [],
              },
              {
                typeId: 200,
                quantity,
                runs: 0,
                isBaseMaterial: true,
                recipe: null,
                runtime: 0,
                mass: quantity * 5,
                volume: quantity * 6,
                children: [],
              },
            ],
          },
        ],
      };
    }

    if (typeId === 600) {
      const blueprintId = selected ? selected.blueprintId : null;
      if (blueprintId === 6002) {
        return {
          typeId: 600,
          quantity,
          runs: quantity,
          isBaseMaterial: false,
          recipe: selected,
          runtime: quantity * 9,
          mass: 0,
          volume: 0,
          children: [
            {
              typeId: 100,
              quantity,
              runs: 0,
              isBaseMaterial: true,
              recipe: null,
              runtime: 0,
              mass: quantity * 2,
              volume: quantity * 2,
              children: [],
            },
          ],
        };
      }

      return {
        typeId: 600,
        quantity,
        runs: quantity,
        isBaseMaterial: false,
        recipe: selected,
        runtime: quantity * 5,
        mass: 0,
        volume: 0,
        children: [
          {
            typeId: 100,
            quantity: quantity * 2,
            runs: 0,
            isBaseMaterial: true,
            recipe: null,
            runtime: 0,
            mass: quantity * 4,
            volume: quantity * 8,
            children: [],
          },
        ],
      };
    }

    if (typeId === 700) {
      return {
        typeId: 700,
        quantity,
        runs: quantity,
        isBaseMaterial: false,
        recipe: selected,
        runtime: quantity * 3,
        mass: 0,
        volume: 0,
        children: [
          {
            typeId: 200,
            quantity,
            runs: 0,
            isBaseMaterial: true,
            recipe: null,
            runtime: 0,
            mass: quantity * 5,
            volume: quantity * 6,
            children: [],
          },
        ],
      };
    }

    return {
      typeId,
      quantity,
      runs: quantity,
      isBaseMaterial: true,
      recipe: null,
      runtime: 0,
      mass: quantity,
      volume: quantity,
      children: [],
    };
  };
}

test("single plan line produces correct raw materials", () => {
  const result = computePlannerPlan({
    planLines: [{ lineId: "a", outputTypeId: 500, quantity: 2 }],
    recipeChoiceByType: {},
    recipeOptionsByType,
    expandDependencies: makeExpandDependencies(),
  });

  assert.deepEqual(result.rawMaterials, [
    { typeId: 100, quantity: 6 },
    { typeId: 200, quantity: 2 },
  ]);
});

test("multiple plan lines aggregate correctly", () => {
  const result = computePlannerPlan({
    planLines: [
      { lineId: "a", outputTypeId: 500, quantity: 1 },
      { lineId: "b", outputTypeId: 700, quantity: 2 },
    ],
    recipeChoiceByType: {},
    recipeOptionsByType,
    expandDependencies: makeExpandDependencies(),
  });

  assert.deepEqual(result.rawMaterials, [
    { typeId: 100, quantity: 3 },
    { typeId: 200, quantity: 3 },
  ]);
});

test("duplicate typeIds in planLines merge correctly", () => {
  const calls = [];
  const expandDependencies = (typeId, quantity, resolveRecipeFn) => {
    calls.push({ typeId, quantity, recipe: resolveRecipeFn(typeId)?.blueprintId ?? null });
    return makeExpandDependencies()(typeId, quantity, resolveRecipeFn);
  };

  computePlannerPlan({
    planLines: [
      { lineId: "a", outputTypeId: 500, quantity: 1 },
      { lineId: "b", outputTypeId: 500, quantity: 4 },
    ],
    recipeChoiceByType: {},
    recipeOptionsByType,
    expandDependencies,
  });

  assert.deepEqual(calls, [{ typeId: 500, quantity: 5, recipe: 5001 }]);
});

test("recipe override affects all occurrences globally", () => {
  const result = computePlannerPlan({
    planLines: [
      { lineId: "a", outputTypeId: 500, quantity: 1 },
      { lineId: "b", outputTypeId: 600, quantity: 2 },
    ],
    recipeChoiceByType: { 600: 6002 },
    recipeOptionsByType,
    expandDependencies: makeExpandDependencies(),
  });

  assert.deepEqual(result.rawMaterials, [
    { typeId: 100, quantity: 4 },
    { typeId: 200, quantity: 1 },
  ]);
});

test("components include all non-base crafted items", () => {
  const result = computePlannerPlan({
    planLines: [{ lineId: "a", outputTypeId: 500, quantity: 2 }],
    recipeChoiceByType: {},
    recipeOptionsByType,
    expandDependencies: makeExpandDependencies(),
  });

  assert.deepEqual(result.components, [
    { typeId: 600, quantity: 2 },
    { typeId: 700, quantity: 2 },
  ]);
});

test("components exclude final target outputs", () => {
  const result = computePlannerPlan({
    planLines: [
      { lineId: "a", outputTypeId: 500, quantity: 2 },
      { lineId: "b", outputTypeId: 600, quantity: 1 },
    ],
    recipeChoiceByType: {},
    recipeOptionsByType,
    expandDependencies: makeExpandDependencies(),
  });

  assert.deepEqual(result.components, [{ typeId: 700, quantity: 2 }]);
});

test("dependency outline merges nodes by typeId", () => {
  const result = computePlannerPlan({
    planLines: [
      { lineId: "a", outputTypeId: 500, quantity: 2 },
      { lineId: "b", outputTypeId: 600, quantity: 1 },
    ],
    recipeChoiceByType: {},
    recipeOptionsByType,
    expandDependencies: makeExpandDependencies(),
  });

  const node600 = result.dependencyOutline.find((node) => node.typeId === 600);
  assert.deepEqual(node600.children, [{ typeId: 100, quantity: 6 }]);
});

test("dependency outline usageCount reflects multiple occurrences", () => {
  const result = computePlannerPlan({
    planLines: [
      { lineId: "a", outputTypeId: 500, quantity: 2 },
      { lineId: "b", outputTypeId: 600, quantity: 1 },
    ],
    recipeChoiceByType: {},
    recipeOptionsByType,
    expandDependencies: makeExpandDependencies(),
  });

  const node100 = result.dependencyOutline.find((node) => node.typeId === 100);
  const node600 = result.dependencyOutline.find((node) => node.typeId === 600);

  assert.equal(node100.usageCount, 3);
  assert.equal(node600.usageCount, 2);
});

test("dependency outline structure is deterministic and sorted", () => {
  const result = computePlannerPlan({
    planLines: [
      { lineId: "a", outputTypeId: 700, quantity: 1 },
      { lineId: "b", outputTypeId: 500, quantity: 1 },
      { lineId: "c", outputTypeId: 600, quantity: 1 },
    ],
    recipeChoiceByType: {},
    recipeOptionsByType,
    expandDependencies: makeExpandDependencies(),
  });

  assert.deepEqual(result.dependencyOutline.map((node) => node.typeId), [100, 200, 500, 600, 700]);
});

test("totals are aggregated across all lines", () => {
  const result = computePlannerPlan({
    planLines: [
      { lineId: "a", outputTypeId: 500, quantity: 2 },
      { lineId: "b", outputTypeId: 700, quantity: 1 },
    ],
    recipeChoiceByType: {},
    recipeOptionsByType,
    expandDependencies: makeExpandDependencies(),
  });

  assert.deepEqual(result.totals, {
    totalRuntime: 39,
    totalMass: 27,
    totalVolume: 40,
  });
});

test("decisionSet includes only multi-recipe types", () => {
  const result = computePlannerPlan({
    planLines: [{ lineId: "a", outputTypeId: 500, quantity: 1 }],
    recipeChoiceByType: { 600: 6002 },
    recipeOptionsByType,
    expandDependencies: makeExpandDependencies(),
  });

  assert.deepEqual(result.decisions.map((entry) => entry.typeId), [600]);
});

test("decisionSummary matches counts", () => {
  const result = computePlannerPlan({
    planLines: [{ lineId: "a", outputTypeId: 500, quantity: 1 }],
    recipeChoiceByType: { 600: 6002 },
    recipeOptionsByType,
    expandDependencies: makeExpandDependencies(),
  });

  assert.deepEqual(result.decisionSummary, {
    totalMultiPathItems: 1,
    defaultCount: 0,
    overriddenCount: 1,
  });
});

test("empty plan returns empty outputs", () => {
  const result = computePlannerPlan({
    planLines: [],
    recipeChoiceByType: {},
    recipeOptionsByType,
    expandDependencies: makeExpandDependencies(),
  });

  assert.deepEqual(result, {
    rawMaterials: [],
    components: [],
    dependencyOutline: [],
    totals: {
      totalRuntime: 0,
      totalMass: 0,
      totalVolume: 0,
    },
    decisions: [],
    decisionSummary: {
      totalMultiPathItems: 0,
      defaultCount: 0,
      overriddenCount: 0,
    },
  });
});

test("invalid lines are ignored", () => {
  const result = computePlannerPlan({
    planLines: [
      { lineId: "a", outputTypeId: 500, quantity: 0 },
      { lineId: "b", outputTypeId: 500, quantity: Number.NaN },
      { lineId: "c", outputTypeId: 500, quantity: -2 },
    ],
    recipeChoiceByType: {},
    recipeOptionsByType,
    expandDependencies: makeExpandDependencies(),
  });

  assert.deepEqual(result.rawMaterials, []);
  assert.deepEqual(result.components, []);
});

test("stale override falls back correctly", () => {
  const result = computePlannerPlan({
    planLines: [{ lineId: "a", outputTypeId: 600, quantity: 2 }],
    recipeChoiceByType: { 600: 9999 },
    recipeOptionsByType,
    expandDependencies: makeExpandDependencies(),
  });

  assert.deepEqual(result.rawMaterials, [{ typeId: 100, quantity: 4 }]);
  assert.equal(result.decisions[0].decisionState, "default");
});
