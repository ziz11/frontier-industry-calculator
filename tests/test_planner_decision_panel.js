const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createPlannerRuntime,
  renderPlannerAggregatedOutputMarkup,
  renderPlannerDecisionPanelMarkup,
  focusPlannerDecisionFromOutput,
} = require("../web/app.js");

function countMatches(source, pattern) {
  return (source.match(pattern) || []).length;
}

function createDecisionSupport(calls = {}) {
  return {
    createEmptyPlannerState: (datasetFingerprint) => ({
      planLines: [{ lineId: "line-a", outputTypeId: 600, quantity: 1 }],
      recipeChoiceByType: {},
      uiState: {},
      datasetFingerprint,
    }),
    loadPlannerState: () => null,
    savePlannerState: (state) => {
      calls.saved = JSON.parse(JSON.stringify(state));
    },
    computePlannerPlan: ({ recipeChoiceByType }) => {
      const selectedBlueprintId = Number(recipeChoiceByType?.[600] ?? 6001);
      const decisionState = selectedBlueprintId === 6001 ? "default" : "overridden";

      return {
        rawMaterials: [{ typeId: 600, quantity: selectedBlueprintId === 6002 ? 2 : 5 }],
        components: [{ typeId: 700, quantity: 3 }],
        dependencyOutline: [],
        totals: { totalRuntime: 0, totalMass: 0, totalVolume: 0 },
        decisions: [
          {
            typeId: 600,
            decisionState,
            currentRecipe: { blueprintId: selectedBlueprintId },
            defaultRecipe: { blueprintId: 6001 },
            options: [
              { blueprintId: 6001, outputQuantity: 2, runtime: 5, keyInputHint: "Ore x4" },
              { blueprintId: 6002, outputQuantity: 3, runtime: 9, keyInputHint: "Gas x2" },
            ],
          },
        ],
        decisionSummary: {
          totalMultiPathItems: 1,
          defaultCount: decisionState === "default" ? 1 : 0,
          overriddenCount: decisionState === "overridden" ? 1 : 0,
        },
      };
    },
  };
}

function createRuntime(calls = {}) {
  return createPlannerRuntime({
    datasetFingerprint: "fp-decision-panel",
    plannerSupport: createDecisionSupport(calls),
  });
}

function createRenderModel(overrides = {}) {
  return {
    plannerState: {
      planLines: [{ lineId: "line-a", outputTypeId: 600, quantity: 1 }],
      recipeChoiceByType: {},
      uiState: {},
      datasetFingerprint: "fp-render",
      ...(overrides.plannerState || {}),
    },
    plannerResult: {
      rawMaterials: [{ typeId: 600, quantity: 5 }],
      components: [{ typeId: 700, quantity: 3 }],
      decisions: [
        {
          typeId: 600,
          decisionState: "default",
          currentRecipe: { blueprintId: 6001 },
          defaultRecipe: { blueprintId: 6001 },
          options: [
            { blueprintId: 6001, outputQuantity: 2, runtime: 5, keyInputHint: "Ore x4" },
            { blueprintId: 6002, outputQuantity: 3, runtime: 9, keyInputHint: "Gas x2" },
          ],
        },
        {
          typeId: 900,
          decisionState: "overridden",
          currentRecipe: { blueprintId: 9002 },
          defaultRecipe: { blueprintId: 9001 },
          options: [
            { blueprintId: 9001, outputQuantity: 1, runtime: 4, keyInputHint: "Water x1" },
            { blueprintId: 9002, outputQuantity: 2, runtime: 8, keyInputHint: "Slurry x3" },
          ],
        },
      ],
      decisionSummary: {
        totalMultiPathItems: 2,
        defaultCount: 1,
        overriddenCount: 1,
      },
      ...(overrides.plannerResult || {}),
    },
    recipeOptionsByType: {},
    ...overrides,
  };
}

const decisionGraph = {
  items: {
    600: { typeID: 600, name: "Composite Plate", isCraftable: true },
    900: { typeID: 900, name: "Shield Matrix", isCraftable: true },
    910: { typeID: 910, name: "Ore", isCraftable: false },
    920: { typeID: 920, name: "Gas", isCraftable: false },
    930: { typeID: 930, name: "Water", isCraftable: false },
    940: { typeID: 940, name: "Slurry", isCraftable: false },
  },
  recipes: {
    6001: { blueprintID: 6001, runTime: 5, inputs: [{ typeID: 910, quantity: 4 }], outputs: [{ typeID: 600, quantity: 2 }] },
    6002: { blueprintID: 6002, runTime: 9, inputs: [{ typeID: 920, quantity: 2 }], outputs: [{ typeID: 600, quantity: 3 }] },
    9001: { blueprintID: 9001, runTime: 4, inputs: [{ typeID: 930, quantity: 1 }], outputs: [{ typeID: 900, quantity: 1 }] },
    9002: { blueprintID: 9002, runTime: 8, inputs: [{ typeID: 940, quantity: 3 }], outputs: [{ typeID: 900, quantity: 2 }] },
  },
};

test("decision summary renders counts", () => {
  const markup = renderPlannerDecisionPanelMarkup(createRenderModel(), decisionGraph);

  assert.match(markup, /Total ambiguous items/);
  assert.match(markup, />2</);
  assert.match(markup, /Overridden/);
  assert.match(markup, /Default/);
});

test("only multi-path items render as decision groups", () => {
  const markup = renderPlannerDecisionPanelMarkup(
    createRenderModel({
      plannerResult: {
        decisions: [
          {
            typeId: 600,
            decisionState: "default",
            currentRecipe: { blueprintId: 6001 },
            defaultRecipe: { blueprintId: 6001 },
            options: [
              { blueprintId: 6001, outputQuantity: 2, runtime: 5, keyInputHint: "Ore x4" },
              { blueprintId: 6002, outputQuantity: 3, runtime: 9, keyInputHint: "Gas x2" },
            ],
          },
        ],
        decisionSummary: {
          totalMultiPathItems: 1,
          defaultCount: 1,
          overriddenCount: 0,
        },
      },
    }),
    decisionGraph,
  );

  assert.equal(countMatches(markup, /data-planner-decision-type-id="/g), 1);
  assert.match(markup, /data-planner-decision-type-id="600"/);
  assert.doesNotMatch(markup, /data-planner-decision-type-id="500"/);
});

test("each decision group renders the required scope note", () => {
  const markup = renderPlannerDecisionPanelMarkup(createRenderModel(), decisionGraph);

  assert.equal(
    countMatches(markup, /This choice applies to all occurrences of this item in the current plan\./g),
    2,
  );
});

test("each decision option renders readable metadata", () => {
  const markup = renderPlannerDecisionPanelMarkup(createRenderModel(), decisionGraph);

  assert.match(markup, /Output 2/);
  assert.match(markup, /5s/);
  assert.match(markup, /Ore x4/);
});

test("decision panel renders item names and readable options instead of raw ids", () => {
  const markup = renderPlannerDecisionPanelMarkup(createRenderModel(), decisionGraph);

  assert.match(markup, /Composite Plate/);
  assert.match(markup, /Shield Matrix/);
  assert.match(markup, /data-icon-type-id="600"/);
  assert.doesNotMatch(markup, /planner-decision-type-label">Type 600/);
  assert.doesNotMatch(markup, /Blueprint 6001/);
});

test("selecting a recipe updates recipeChoiceByType", () => {
  const runtime = createRuntime();
  runtime.load();

  runtime.selectRecipe(600, 6002);

  assert.equal(runtime.getRenderModel().plannerState.recipeChoiceByType[600], 6002);
});

test("selecting a recipe recomputes planner output", () => {
  const runtime = createRuntime();
  runtime.load();

  assert.deepEqual(runtime.getRenderModel().plannerResult.rawMaterials, [{ typeId: 600, quantity: 5 }]);

  runtime.selectRecipe(600, 6002);

  assert.deepEqual(runtime.getRenderModel().plannerResult.rawMaterials, [{ typeId: 600, quantity: 2 }]);
});

test("selecting a non-default recipe marks the group as overridden", () => {
  const runtime = createRuntime();
  runtime.load();
  runtime.selectRecipe(600, 6002);

  const markup = renderPlannerDecisionPanelMarkup(runtime.getRenderModel());

  assert.match(markup, /State<\/span>\s*<strong[^>]*>overridden<\/strong>/);
});

test("selecting the default recipe shows default state", () => {
  const runtime = createRuntime();
  runtime.load();
  runtime.selectRecipe(600, 6002);
  runtime.selectRecipe(600, 6001);

  const markup = renderPlannerDecisionPanelMarkup(runtime.getRenderModel());

  assert.match(markup, /State<\/span>\s*<strong[^>]*>default<\/strong>/);
});

test("planner state persists after recipe selection", () => {
  const calls = {};
  const runtime = createRuntime(calls);
  runtime.load();

  runtime.selectRecipe(600, 6002);

  assert.equal(calls.saved.recipeChoiceByType[600], 6002);
});

test("clicking a multi-path item in center output focuses the corresponding decision group", () => {
  const runtime = createRuntime();
  runtime.load();

  const before = renderPlannerDecisionPanelMarkup(runtime.getRenderModel());
  assert.doesNotMatch(before, /planner-decision-group is-active/);

  const focused = focusPlannerDecisionFromOutput(runtime, 600);
  const after = renderPlannerDecisionPanelMarkup(runtime.getRenderModel());

  assert.equal(focused, true);
  assert.match(after, /data-planner-decision-type-id="600"[^>]*class="planner-decision-group is-active"/);
});

test("multiple center rows for the same typeId map to one shared decision group", () => {
  const model = createRenderModel({
    plannerResult: {
      rawMaterials: [{ typeId: 600, quantity: 5 }],
      components: [{ typeId: 600, quantity: 2 }],
      decisions: [
        {
          typeId: 600,
          decisionState: "default",
          currentRecipe: { blueprintId: 6001 },
          defaultRecipe: { blueprintId: 6001 },
          options: [
            { blueprintId: 6001, outputQuantity: 2, runtime: 5, keyInputHint: "Ore x4" },
            { blueprintId: 6002, outputQuantity: 3, runtime: 9, keyInputHint: "Gas x2" },
          ],
        },
      ],
      decisionSummary: {
        totalMultiPathItems: 1,
        defaultCount: 1,
        overriddenCount: 0,
      },
    },
  });

  const outputMarkup = renderPlannerAggregatedOutputMarkup(model);
  const decisionMarkup = renderPlannerDecisionPanelMarkup(model);

  assert.equal(
    countMatches(
      `${outputMarkup.rawMaterialsMarkup}${outputMarkup.componentsMarkup}`,
      /data-planner-focus-decision-type-id="600"/g,
    ),
    2,
  );
  assert.equal(countMatches(decisionMarkup, /data-planner-decision-type-id="600"/g), 1);
});

test("no recipe selector appears in center output rows", () => {
  const markup = renderPlannerAggregatedOutputMarkup(createRenderModel());
  const centerMarkup = `${markup.rawMaterialsMarkup}${markup.componentsMarkup}`;

  assert.doesNotMatch(centerMarkup, /type="radio"/);
  assert.doesNotMatch(centerMarkup, /data-planner-decision-blueprint-id=/);
});

test("no Calculator regressions in mode switching assumptions", () => {
  const runtime = createRuntime();
  runtime.load();

  runtime.setMode("planner");
  runtime.selectRecipe(600, 6002);
  assert.equal(runtime.getRenderModel().mode, "planner");

  runtime.setMode("calculator");
  focusPlannerDecisionFromOutput(runtime, 600);
  assert.equal(runtime.getRenderModel().mode, "calculator");
});
