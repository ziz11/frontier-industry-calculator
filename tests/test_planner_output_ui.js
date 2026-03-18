const test = require("node:test");
const assert = require("node:assert/strict");

const { createPlannerRuntime, renderPlannerAggregatedOutputMarkup } = require("../web/app.js");

function render({ planLines = [], rawMaterials = [], components = [] }) {
  return renderPlannerAggregatedOutputMarkup({
    planLines,
    plannerResult: {
      rawMaterials,
      components,
    },
  });
}

test("raw materials render correct rows", () => {
  const markup = render({
    planLines: [{ lineId: "l1", outputTypeId: 10, quantity: 1 }],
    rawMaterials: [
      { typeId: 5, quantity: 9 },
      { typeId: 1, quantity: 2 },
    ],
  });

  assert.match(markup.rawMaterialsMarkup, /Raw Materials to Mine/);
  assert.match(markup.rawMaterialsMarkup, /data-planner-row-type-id="1"/);
  assert.match(markup.rawMaterialsMarkup, /data-planner-row-type-id="5"/);
  assert.ok(markup.rawMaterialsMarkup.indexOf('data-planner-row-type-id="1"') < markup.rawMaterialsMarkup.indexOf('data-planner-row-type-id="5"'));
});

test("components render correct rows", () => {
  const markup = render({
    planLines: [{ lineId: "l1", outputTypeId: 10, quantity: 1 }],
    components: [
      { typeId: 9, quantity: 3 },
      { typeId: 2, quantity: 8 },
    ],
  });

  assert.match(markup.componentsMarkup, /Components to Produce/);
  assert.match(markup.componentsMarkup, /data-planner-row-type-id="2"/);
  assert.match(markup.componentsMarkup, /data-planner-row-type-id="9"/);
});

test("components exclude targets", () => {
  const runtime = createPlannerRuntime({
    datasetFingerprint: "fp-output-ui",
    plannerSupport: {
      createEmptyPlannerState: (datasetFingerprint) => ({
        planLines: [],
        recipeChoiceByType: {},
        uiState: {},
        datasetFingerprint,
      }),
      loadPlannerState: () => null,
      savePlannerState: () => {},
      computePlannerPlan: ({ planLines }) => {
        const targetIds = new Set(planLines.map((line) => Number(line.outputTypeId)));
        const crafted = [
          { typeId: 50, quantity: 2 },
          { typeId: 60, quantity: 4 },
        ];
        return {
          rawMaterials: [{ typeId: 1, quantity: 7 }],
          components: crafted.filter((entry) => !targetIds.has(entry.typeId)),
          dependencyOutline: [],
          totals: { totalRuntime: 0, totalMass: 0, totalVolume: 0 },
          decisions: [],
          decisionSummary: { totalMultiPathItems: 0, defaultCount: 0, overriddenCount: 0 },
        };
      },
    },
  });

  runtime.load();
  runtime.addLine({ lineId: "line-a", outputTypeId: 50, quantity: 1 });

  const markup = renderPlannerAggregatedOutputMarkup(runtime.getRenderModel());

  assert.doesNotMatch(markup.componentsMarkup, /data-planner-row-type-id="50"/);
  assert.match(markup.componentsMarkup, /data-planner-row-type-id="60"/);
});

test("ordering is stable", () => {
  const input = {
    planLines: [{ lineId: "l1", outputTypeId: 10, quantity: 1 }],
    rawMaterials: [
      { typeId: 3, quantity: 4 },
      { typeId: 1, quantity: 2 },
      { typeId: 2, quantity: 8 },
    ],
    components: [
      { typeId: 8, quantity: 1 },
      { typeId: 6, quantity: 7 },
    ],
  };

  const first = render(input);
  const second = render(input);

  assert.equal(first.rawMaterialsMarkup, second.rawMaterialsMarkup);
  assert.equal(first.componentsMarkup, second.componentsMarkup);
});

test("empty plan shows empty state", () => {
  const markup = render({
    planLines: [],
    rawMaterials: [],
    components: [],
  });

  assert.match(markup.rawMaterialsMarkup, /No plan lines yet/);
  assert.match(markup.componentsMarkup, /No plan lines yet/);
});

test("removing lines updates output", () => {
  const runtime = createPlannerRuntime({
    datasetFingerprint: "fp-output-update",
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
        rawMaterials: planLines.map((line) => ({ typeId: Number(line.outputTypeId), quantity: Number(line.quantity) })),
        components: [],
        dependencyOutline: [],
        totals: { totalRuntime: 0, totalMass: 0, totalVolume: 0 },
        decisions: [],
        decisionSummary: { totalMultiPathItems: 0, defaultCount: 0, overriddenCount: 0 },
      }),
    },
  });

  runtime.load();
  runtime.addLine({ lineId: "line-a", outputTypeId: 12, quantity: 2 });
  let markup = renderPlannerAggregatedOutputMarkup(runtime.getRenderModel());
  assert.match(markup.rawMaterialsMarkup, /data-planner-row-type-id="12"/);

  runtime.removeLine("line-a");
  markup = renderPlannerAggregatedOutputMarkup(runtime.getRenderModel());
  assert.match(markup.rawMaterialsMarkup, /No plan lines yet/);
});
