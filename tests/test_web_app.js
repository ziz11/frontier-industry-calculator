const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildManagedDefaultRecipePresets,
  buildManagedDefaultPresetCardMarkup,
  filterManagedDefaultRecipePresetsForSelection,
  renderManagedDefaultRecipePathsMarkup,
  renderManagedDefaultRecipeWorkspaceMarkup,
  buildGraphFromStrippedData,
  buildDependencyTree,
  buildCatalogTree,
  buildPlanStorageKey,
  buildProgressSections,
  buildRecipeOptionLabel,
  mergeManagedDefaultRecipeSelections,
  filterCatalogItems,
  getAvailableRecipesForType,
  getProgressStatus,
  loadStoredPlanProgress,
  renderDependencyOutlineMarkup,
  renderCompactProgressListMarkup,
  renderSelectedTargetMarkup,
  resolveRecipeChoice,
  rollupDependencyTree,
  saveStoredPlanProgress,
  searchCraftableItems,
  shouldDataSectionBeOpen,
  buildDependencyPipelineGroups,
  buildNextActions,
  getBottleneckLine,
  summarizeWorkspaceHeader,
  updateProgressInputValue,
  createRecipeSummary,
} = require("../web/app.js");

const sampleGraph = {
  meta: {
    schemaVersion: 1,
    snapshot: "sample.snapshot",
    generatedAt: "2026-03-17T00:00:00Z",
  },
  items: {
    100: {
      typeID: 100,
      name: "Raw Ore A",
      groupID: 10,
      categoryID: 1,
      mass: 10,
      volume: 0.5,
      isBaseMaterial: true,
      isCraftable: false,
    },
    200: {
      typeID: 200,
      name: "Composite Plate",
      groupID: 20,
      categoryID: 2,
      mass: 1.5,
      volume: 0.4,
      isBaseMaterial: false,
      isCraftable: true,
    },
    300: {
      typeID: 300,
      name: "Shield Relay",
      groupID: 21,
      categoryID: 2,
      mass: 1.2,
      volume: 0.2,
      isBaseMaterial: false,
      isCraftable: true,
    },
    400: {
      typeID: 400,
      name: "Composite Hull",
      groupID: 30,
      categoryID: 3,
      mass: 5,
      volume: 2,
      isBaseMaterial: false,
      isCraftable: true,
    },
    900: {
      typeID: 900,
      name: "Process Slag",
      groupID: 40,
      categoryID: 4,
      mass: 0.1,
      volume: 0.1,
      isBaseMaterial: false,
      isCraftable: true,
    },
  },
  recipes: {
    1000: {
      blueprintID: 1000,
      primaryTypeID: 200,
      runTime: 5,
      inputs: [{ typeID: 100, quantity: 2 }],
      outputs: [{ typeID: 200, quantity: 1 }],
    },
    1002: {
      blueprintID: 1002,
      primaryTypeID: 200,
      runTime: 6,
      inputs: [{ typeID: 100, quantity: 5 }],
      outputs: [
        { typeID: 200, quantity: 2 },
        { typeID: 900, quantity: 1 },
      ],
    },
    1001: {
      blueprintID: 1001,
      primaryTypeID: 300,
      runTime: 4,
      inputs: [{ typeID: 100, quantity: 3 }],
      outputs: [{ typeID: 300, quantity: 1 }],
    },
    2000: {
      blueprintID: 2000,
      primaryTypeID: 400,
      runTime: 10,
      inputs: [
        { typeID: 200, quantity: 2 },
        { typeID: 300, quantity: 1 },
      ],
      outputs: [{ typeID: 400, quantity: 1 }],
    },
  },
  recipesByOutput: {
    200: [1000, 1002],
    300: [1001],
    400: [2000],
    900: [1002],
  },
  baseMaterials: [100],
};

const managedDefaultGraph = {
  meta: {
    schemaVersion: 1,
    snapshot: "managed.defaults.snapshot",
    generatedAt: "2026-03-20T00:00:00Z",
  },
  items: {
    500: { typeID: 500, name: "Reinforced Alloys", isBaseMaterial: false, isCraftable: true },
    510: { typeID: 510, name: "Carbon Weave", isBaseMaterial: false, isCraftable: true },
    520: { typeID: 520, name: "Thermal Composites", isBaseMaterial: false, isCraftable: true },
    700: { typeID: 700, name: "Silicon Dust", isBaseMaterial: false, isCraftable: true },
    710: { typeID: 710, name: "Tholin Aggregates", isBaseMaterial: false, isCraftable: true },
    720: { typeID: 720, name: "Feldspar Crystal Shards", isBaseMaterial: false, isCraftable: true },
    730: { typeID: 730, name: "Hydrocarbon Residue", isBaseMaterial: false, isCraftable: true },
    740: { typeID: 740, name: "Nickel-Iron Veins", isBaseMaterial: false, isCraftable: true },
    530: { typeID: 530, name: "Binder Matrix", isBaseMaterial: false, isCraftable: true },
    990: { typeID: 990, name: "Frontier Frame", isBaseMaterial: false, isCraftable: true },
    900: { typeID: 900, name: "Raw Ore A", isBaseMaterial: true, isCraftable: false },
  },
  recipes: {
    5001: {
      blueprintID: 5001,
      primaryTypeID: 500,
      runTime: 5,
      inputs: [
        { typeID: 530, quantity: 2 },
        { typeID: 740, quantity: 1 },
      ],
      outputs: [{ typeID: 500, quantity: 1 }],
    },
    5002: {
      blueprintID: 5002,
      primaryTypeID: 500,
      runTime: 6,
      inputs: [
        { typeID: 530, quantity: 2 },
        { typeID: 740, quantity: 1 },
      ],
      outputs: [{ typeID: 500, quantity: 1 }],
    },
    5101: {
      blueprintID: 5101,
      primaryTypeID: 510,
      runTime: 5,
      inputs: [{ typeID: 530, quantity: 1 }],
      outputs: [{ typeID: 510, quantity: 1 }],
    },
    5102: {
      blueprintID: 5102,
      primaryTypeID: 510,
      runTime: 6,
      inputs: [{ typeID: 530, quantity: 1 }],
      outputs: [{ typeID: 510, quantity: 1 }],
    },
    5201: {
      blueprintID: 5201,
      primaryTypeID: 520,
      runTime: 5,
      inputs: [{ typeID: 530, quantity: 3 }],
      outputs: [{ typeID: 520, quantity: 1 }],
    },
    5202: {
      blueprintID: 5202,
      primaryTypeID: 520,
      runTime: 6,
      inputs: [{ typeID: 530, quantity: 3 }],
      outputs: [{ typeID: 520, quantity: 1 }],
    },
    7001: {
      blueprintID: 7001,
      primaryTypeID: 700,
      runTime: 6,
      inputs: [{ typeID: 710, quantity: 2 }],
      outputs: [{ typeID: 700, quantity: 1 }],
    },
    7002: {
      blueprintID: 7002,
      primaryTypeID: 700,
      runTime: 5,
      inputs: [{ typeID: 720, quantity: 2 }],
      outputs: [{ typeID: 700, quantity: 1 }],
    },
    7101: {
      blueprintID: 7101,
      primaryTypeID: 710,
      runTime: 5,
      inputs: [{ typeID: 900, quantity: 3 }],
      outputs: [{ typeID: 710, quantity: 1 }],
    },
    7102: {
      blueprintID: 7102,
      primaryTypeID: 710,
      runTime: 4,
      inputs: [{ typeID: 900, quantity: 2 }],
      outputs: [{ typeID: 710, quantity: 1 }],
    },
    7201: {
      blueprintID: 7201,
      primaryTypeID: 720,
      runTime: 5,
      inputs: [{ typeID: 900, quantity: 3 }],
      outputs: [{ typeID: 720, quantity: 1 }],
    },
    7202: {
      blueprintID: 7202,
      primaryTypeID: 720,
      runTime: 4,
      inputs: [{ typeID: 900, quantity: 2 }],
      outputs: [{ typeID: 720, quantity: 1 }],
    },
    7301: {
      blueprintID: 7301,
      primaryTypeID: 730,
      runTime: 6,
      inputs: [{ typeID: 900, quantity: 4 }],
      outputs: [{ typeID: 730, quantity: 1 }],
    },
    7302: {
      blueprintID: 7302,
      primaryTypeID: 730,
      runTime: 5,
      inputs: [{ typeID: 900, quantity: 3 }],
      outputs: [{ typeID: 730, quantity: 1 }],
    },
    7401: {
      blueprintID: 7401,
      primaryTypeID: 740,
      runTime: 6,
      inputs: [{ typeID: 900, quantity: 4 }],
      outputs: [{ typeID: 740, quantity: 1 }],
    },
    7402: {
      blueprintID: 7402,
      primaryTypeID: 740,
      runTime: 5,
      inputs: [{ typeID: 900, quantity: 3 }],
      outputs: [{ typeID: 740, quantity: 1 }],
    },
    5301: {
      blueprintID: 5301,
      primaryTypeID: 530,
      runTime: 4,
      inputs: [{ typeID: 900, quantity: 2 }],
      outputs: [{ typeID: 530, quantity: 1 }],
    },
    5302: {
      blueprintID: 5302,
      primaryTypeID: 530,
      runTime: 3,
      inputs: [{ typeID: 900, quantity: 1 }],
      outputs: [{ typeID: 530, quantity: 1 }],
    },
    9901: {
      blueprintID: 9901,
      primaryTypeID: 990,
      runTime: 12,
      inputs: [
        { typeID: 500, quantity: 2 },
        { typeID: 700, quantity: 3 },
      ],
      outputs: [{ typeID: 990, quantity: 1 }],
    },
  },
  recipesByOutput: {
    500: [5001, 5002],
    510: [5101, 5102],
    520: [5201, 5202],
    700: [7001, 7002],
    710: [7101, 7102],
    720: [7201, 7202],
    730: [7301, 7302],
    740: [7401, 7402],
    530: [5301, 5302],
    990: [9901],
  },
  recipeFacilityPrefixesByBlueprint: {
    5001: ["M"],
    5002: ["S"],
    5101: ["L"],
    5102: ["S"],
    5201: ["P"],
    5202: ["S"],
    7001: ["L"],
    7002: ["S"],
    7101: ["M"],
    7102: ["S"],
    7201: ["M"],
    7202: ["S"],
    7301: ["M"],
    7302: ["S"],
    7401: ["M"],
    7402: ["S"],
    5301: ["M"],
    5302: ["S"],
    9901: ["M"],
  },
  baseMaterials: [900],
};

test("searchCraftableItems returns matching craftable outputs sorted by exactness", () => {
  const results = searchCraftableItems(sampleGraph, "comp");

  assert.deepEqual(
    results.map((entry) => entry.typeID),
    [400, 200],
  );
  assert.equal(results[0].name, "Composite Hull");
});

test("searchCraftableItems supports exact typeID lookup for craftable items", () => {
  const results = searchCraftableItems(sampleGraph, "400");

  assert.deepEqual(
    results.map((entry) => entry.typeID),
    [400],
  );
});

test("searchCraftableItems still returns craftable entries when item names are missing", () => {
  const graphWithMissingNames = JSON.parse(JSON.stringify(sampleGraph));
  graphWithMissingNames.items[400].name = null;

  const results = searchCraftableItems(graphWithMissingNames, "400");
  assert.deepEqual(results.map((entry) => entry.typeID), [400]);
});

test("buildCatalogTree groups craftable items by category and group with numeric fallback labels", () => {
  const catalog = buildCatalogTree(sampleGraph);

  assert.equal(catalog.totalCraftableItems, 4);
  assert.equal(catalog.nodes[0].label, "Category 2");
  assert.equal(catalog.nodes[0].children[0].label, "Group 20");
  assert.deepEqual(
    catalog.nodes[0].children[0].items.map((item) => item.typeID),
    [200],
  );
  assert.equal(catalog.nodes[1].label, "Category 3");
  assert.equal(catalog.nodes[1].children[0].label, "Group 30");
});

test("filterCatalogItems scopes search to the selected catalog branch", () => {
  const catalog = buildCatalogTree(sampleGraph);
  const categoryTwoBranch = catalog.nodes.find((node) => node.key === "category:2");
  const groupTwentyOneBranch = categoryTwoBranch.children.find((node) => node.key === "group:21");

  const categoryResults = filterCatalogItems(sampleGraph, categoryTwoBranch, "shield");
  const groupResults = filterCatalogItems(sampleGraph, groupTwentyOneBranch, "");
  const allResults = filterCatalogItems(sampleGraph, null, "comp");

  assert.deepEqual(categoryResults.map((item) => item.typeID), [300]);
  assert.deepEqual(groupResults.map((item) => item.typeID), [300]);
  assert.deepEqual(allResults.map((item) => item.typeID), [400, 200]);
});

test("createRecipeSummary scales quantity-driven runtime, inputs, and outputs", () => {
  const summary = createRecipeSummary(sampleGraph, 400, 3);

  assert.equal(summary.item.name, "Composite Hull");
  assert.equal(summary.recipe.blueprintID, 2000);
  assert.equal(summary.requestedQuantity, 3);
  assert.equal(summary.runsNeeded, 3);
  assert.equal(summary.producedQuantity, 3);
  assert.equal(summary.totalRuntime, 30);
  assert.deepEqual(summary.inputs, [
    { typeID: 200, name: "Composite Plate", quantityPerRun: 2, requiredQuantity: 6 },
    { typeID: 300, name: "Shield Relay", quantityPerRun: 1, requiredQuantity: 3 },
  ]);
  assert.deepEqual(summary.outputs, [
    { typeID: 400, name: "Composite Hull", quantityPerRun: 1, totalQuantity: 3 },
  ]);
});

test("getAvailableRecipesForType and resolveRecipeChoice expose and select alternative recipes", () => {
  const recipes = getAvailableRecipesForType(sampleGraph, 200);
  const graphWithPrefixPriority = {
    ...sampleGraph,
    recipeFacilityPrefixesByBlueprint: {
      1000: ["P"],
      1002: ["L"],
    },
  };
  const prioritizedRecipes = getAvailableRecipesForType(graphWithPrefixPriority, 200);

  assert.deepEqual(recipes.map((recipe) => recipe.blueprintID), [1000, 1002]);
  assert.deepEqual(prioritizedRecipes.map((recipe) => recipe.blueprintID), [1002, 1000]);
  assert.equal(resolveRecipeChoice(sampleGraph, 200, {}).blueprintID, 1000);
  assert.equal(resolveRecipeChoice(graphWithPrefixPriority, 200, {}).blueprintID, 1002);
  assert.equal(resolveRecipeChoice(sampleGraph, 200, { 200: 1002 }).blueprintID, 1002);
});

test("buildManagedDefaultRecipePresets initializes managed roots with S-preferring recipe trees", () => {
  const presets = buildManagedDefaultRecipePresets(managedDefaultGraph, {});

  assert.deepEqual(presets.map((preset) => preset.name), [
    "Reinforced Alloys",
    "Carbon Weave",
    "Thermal Composites",
    "Silicon Dust",
    "Tholin Aggregates",
    "Feldspar Crystal Shards",
    "Hydrocarbon Residue",
    "Nickel-Iron Veins",
  ]);
  assert.equal(presets[0].typeID, 500);
  assert.equal(presets[0].recipeSelections[500], 5002);
  assert.equal(presets[1].recipeSelections[510], 5102);
  assert.equal(presets[2].recipeSelections[520], 5202);
  assert.equal(presets[3].recipeSelections[700], 7002);
  assert.equal(presets[4].recipeSelections[710], 7102);
  assert.equal(presets[5].recipeSelections[720], 7202);
  assert.equal(presets[6].recipeSelections[730], 7302);
  assert.equal(presets[7].recipeSelections[740], 7402);
  assert.equal(presets[0].recipeSelections[530], 5302);
});

test("mergeManagedDefaultRecipeSelections preserves isolated stored overrides per managed root", () => {
  const presets = buildManagedDefaultRecipePresets(managedDefaultGraph, {
    "reinforced-alloys": { 500: 5001 },
    "carbon-weave": { 510: 5101, 530: 5301 },
  });

  assert.deepEqual(mergeManagedDefaultRecipeSelections(presets), {
    500: 5001,
    510: 5101,
    520: 5202,
    530: 5301,
    700: 7002,
    710: 7102,
    720: 7202,
    730: 7302,
    740: 7402,
  });
});

test("buildManagedDefaultPresetCardMarkup exposes the root path summary and controls", () => {
  const preset = buildManagedDefaultRecipePresets(managedDefaultGraph, {})[0];

  const markup = buildManagedDefaultPresetCardMarkup(preset, managedDefaultGraph, {
    isActive: true,
    isOpen: true,
  });

  assert.match(markup, /\[S\] path/);
  assert.match(markup, /Custom path/);
  assert.match(markup, /data-managed-default-root-select-key="reinforced-alloys"/);
  assert.match(markup, /data-managed-default-root-toggle-key="reinforced-alloys"/);
});

test("renderManagedDefaultRecipePathsMarkup renders a split drawer with an active detail tree", () => {
  const presets = buildManagedDefaultRecipePresets(managedDefaultGraph, {});
  const markup = renderManagedDefaultRecipePathsMarkup(managedDefaultGraph, presets, {
    activeRootKey: "reinforced-alloys",
    openRootKey: "reinforced-alloys",
    expandedNodeIdsByRoot: {
      "reinforced-alloys": new Set(),
    },
  });

  assert.match(markup, /default-recipe-summary/);
  assert.match(markup, /default-recipe-layout/);
  assert.match(markup, /data-managed-default-root-detail-key="reinforced-alloys"/);
  assert.match(markup, /default-recipe-detail/);
  assert.match(markup, /outline-list/);
});

test("filterManagedDefaultRecipePresetsForSelection shows only managed direct inputs and descendants", () => {
  const presets = buildManagedDefaultRecipePresets(managedDefaultGraph, {});
  const visiblePresets = filterManagedDefaultRecipePresetsForSelection(
    managedDefaultGraph,
    presets,
    990,
    mergeManagedDefaultRecipeSelections(presets),
  );

  assert.deepEqual(
    visiblePresets.map((preset) => preset.name),
    ["Reinforced Alloys", "Silicon Dust", "Feldspar Crystal Shards", "Nickel-Iron Veins"],
  );
});

test("filterManagedDefaultRecipePresetsForSelection follows current managed recipe selections", () => {
  const presets = buildManagedDefaultRecipePresets(managedDefaultGraph, {
    "silicon-dust": {
      700: 7001,
    },
  });
  const visiblePresets = filterManagedDefaultRecipePresetsForSelection(
    managedDefaultGraph,
    presets,
    990,
    mergeManagedDefaultRecipeSelections(presets),
  );

  assert.deepEqual(
    visiblePresets.map((preset) => preset.name),
    ["Reinforced Alloys", "Silicon Dust", "Tholin Aggregates", "Nickel-Iron Veins"],
  );
});

test("renderManagedDefaultRecipeWorkspaceMarkup renders filtered workspace cards", () => {
  const presets = buildManagedDefaultRecipePresets(managedDefaultGraph, {});
  const markup = renderManagedDefaultRecipeWorkspaceMarkup(managedDefaultGraph, presets, {
    selectedTypeID: 990,
    recipeSelections: mergeManagedDefaultRecipeSelections(presets),
    activeRootKey: "silicon-dust",
  });

  assert.match(markup, /Visible managed/);
  assert.match(markup, /data-managed-default-workspace-root-select-key="silicon-dust"/);
  assert.match(markup, /planner-decision-option/);
  assert.doesNotMatch(markup, /Carbon Weave/);
});

test("renderManagedDefaultRecipeWorkspaceMarkup shows empty states for no target and no matches", () => {
  const presets = buildManagedDefaultRecipePresets(managedDefaultGraph, {});
  const noTargetMarkup = renderManagedDefaultRecipeWorkspaceMarkup(managedDefaultGraph, presets, {
    selectedTypeID: null,
    recipeSelections: mergeManagedDefaultRecipeSelections(presets),
  });
  const noMatchesMarkup = renderManagedDefaultRecipeWorkspaceMarkup(managedDefaultGraph, presets, {
    selectedTypeID: 530,
    recipeSelections: mergeManagedDefaultRecipeSelections(presets),
  });

  assert.match(noTargetMarkup, /Select a target to filter managed defaults for the active recipe\./);
  assert.match(noMatchesMarkup, /This recipe path does not use any managed default materials\./);
});

test("createRecipeSummary handles ceil runs and preserves byproducts for multi-output recipes", () => {
  const summary = createRecipeSummary(sampleGraph, 200, 3, { 200: 1002 });

  assert.equal(summary.recipe.blueprintID, 1002);
  assert.equal(summary.requestedQuantity, 3);
  assert.equal(summary.runsNeeded, 2);
  assert.equal(summary.producedQuantity, 4);
  assert.equal(summary.totalRuntime, 12);
  assert.deepEqual(summary.inputs, [
    { typeID: 100, name: "Raw Ore A", quantityPerRun: 5, requiredQuantity: 10 },
  ]);
  assert.deepEqual(summary.outputs, [
    { typeID: 200, name: "Composite Plate", quantityPerRun: 2, totalQuantity: 4 },
    { typeID: 900, name: "Process Slag", quantityPerRun: 1, totalQuantity: 2 },
  ]);
});

test("buildDependencyTree creates a recursive chain using the selected recipe path", () => {
  const tree = buildDependencyTree(sampleGraph, 400, 1, {});

  assert.equal(tree.item.name, "Composite Hull");
  assert.equal(tree.runsNeeded, 1);
  assert.equal(tree.children.length, 2);
  assert.equal(tree.children[0].item.name, "Composite Plate");
  assert.equal(tree.children[0].requestedQuantity, 2);
  assert.equal(tree.children[0].runsNeeded, 2);
  assert.equal(tree.children[0].children[0].item.name, "Raw Ore A");
  assert.equal(tree.children[0].children[0].requestedQuantity, 4);
  assert.equal(tree.children[1].children[0].requestedQuantity, 3);
});

test("rollupDependencyTree aggregates direct components, base materials, runtime, mass, and volume", () => {
  const tree = buildDependencyTree(sampleGraph, 400, 1, { 200: 1002 });
  const rollup = rollupDependencyTree(tree);

  assert.deepEqual(rollup.directComponents, [
    { typeID: 200, name: "Composite Plate", quantity: 2, mass: 3, volume: 0.8 },
    { typeID: 300, name: "Shield Relay", quantity: 1, mass: 1.2, volume: 0.2 },
  ]);
  assert.deepEqual(rollup.baseMaterials, [
    { typeID: 100, name: "Raw Ore A", quantity: 8, mass: 80, volume: 4 },
  ]);
  assert.equal(rollup.totalRuntime, 20);
  assert.equal(rollup.totalMass, 80);
  assert.equal(rollup.totalVolume, 4);
});

test("buildProgressSections creates quantitative progress lines for base and direct materials", () => {
  const tree = buildDependencyTree(sampleGraph, 400, 1, { 200: 1002 });
  const rollup = rollupDependencyTree(tree);
  const sections = buildProgressSections(rollup, {
    100: 3,
    200: 2,
  });

  assert.equal(sections.baseMaterials[0].typeID, 100);
  assert.equal(sections.baseMaterials[0].need, 8);
  assert.equal(sections.baseMaterials[0].have, 3);
  assert.equal(sections.baseMaterials[0].remaining, 5);
  assert.equal(sections.baseMaterials[0].progressPercent, 37.5);
  assert.equal(sections.directComponents[0].typeID, 200);
  assert.equal(sections.directComponents[0].need, 2);
  assert.equal(sections.directComponents[0].have, 2);
  assert.equal(sections.directComponents[0].remaining, 0);
  assert.equal(sections.directComponents[0].progressPercent, 100);
});

test("buildProgressSections can recalculate base material needs from remaining direct components", () => {
  const tree = buildDependencyTree(sampleGraph, 400, 1, { 200: 1002 });
  const rollup = rollupDependencyTree(tree);

  const sections = buildProgressSections(
    rollup,
    {
      100: 1,
      200: 2,
    },
    {
      graph: sampleGraph,
      tree,
      recipeSelections: { 200: 1002 },
    },
  );

  assert.equal(sections.baseMaterials[0].typeID, 100);
  assert.equal(sections.baseMaterials[0].need, 3);
  assert.equal(sections.baseMaterials[0].have, 1);
  assert.equal(sections.baseMaterials[0].remaining, 2);
});

test("buildProgressSections dynamic base material recalculation keeps recipe batch rounding", () => {
  const tree = buildDependencyTree(sampleGraph, 400, 1, { 200: 1002 });
  const rollup = rollupDependencyTree(tree);

  const sections = buildProgressSections(
    rollup,
    {
      200: 1,
    },
    {
      graph: sampleGraph,
      tree,
      recipeSelections: { 200: 1002 },
    },
  );

  assert.equal(sections.baseMaterials[0].typeID, 100);
  assert.equal(sections.baseMaterials[0].need, 8);
});

test("buildProgressSections keeps direct raw inputs out of components to produce", () => {
  const directRawGraph = JSON.parse(JSON.stringify(sampleGraph));
  directRawGraph.items[500] = {
    typeID: 500,
    name: "Raw Ore B",
    groupID: 11,
    categoryID: 1,
    mass: 6,
    volume: 1,
    isBaseMaterial: true,
    isCraftable: false,
  };
  directRawGraph.recipes[2001] = {
    blueprintID: 2001,
    primaryTypeID: 400,
    runTime: 12,
    inputs: [
      { typeID: 200, quantity: 2 },
      { typeID: 500, quantity: 4 },
    ],
    outputs: [{ typeID: 400, quantity: 1 }],
  };
  directRawGraph.recipesByOutput[400] = [2001];
  directRawGraph.baseMaterials = [100, 500];

  const tree = buildDependencyTree(directRawGraph, 400, 1, {});
  const rollup = rollupDependencyTree(tree);
  const sections = buildProgressSections(rollup, {});

  assert.deepEqual(
    sections.directComponents.map((line) => line.typeID),
    [200],
  );
  assert.deepEqual(
    sections.baseMaterials.map((line) => line.typeID).sort((left, right) => left - right),
    [100, 500],
  );
});

test("getProgressStatus returns missing partial and ready states from progress quantities", () => {
  assert.equal(getProgressStatus({ need: 10, have: 0 }), "missing");
  assert.equal(getProgressStatus({ need: 10, have: 4 }), "partial");
  assert.equal(getProgressStatus({ need: 10, have: 10 }), "ready");
  assert.equal(getProgressStatus({ need: 10, have: 25 }), "ready");
});

test("buildPlanStorageKey keys plan persistence by snapshot target quantity and recipe selections", () => {
  const key = buildPlanStorageKey({
    graph: sampleGraph,
    selectedTypeID: 400,
    requestedQuantity: 3,
    recipeSelections: { 200: 1002, 400: 2000 },
  });
  const sameKey = buildPlanStorageKey({
    graph: sampleGraph,
    selectedTypeID: 400,
    requestedQuantity: 3,
    recipeSelections: { 400: 2000, 200: 1002 },
  });
  const differentQuantityKey = buildPlanStorageKey({
    graph: sampleGraph,
    selectedTypeID: 400,
    requestedQuantity: 4,
    recipeSelections: { 200: 1002, 400: 2000 },
  });

  assert.match(key, /^frontier-industry-calculator:plan:/);
  assert.equal(key, sameKey);
  assert.notEqual(key, differentQuantityKey);
});

test("buildRecipeOptionLabel includes output runtime and key input hint without blueprint id", () => {
  const recipe = sampleGraph.recipes[1002];
  const label = buildRecipeOptionLabel(sampleGraph, recipe, 200);

  assert.doesNotMatch(label, /BP 1002/);
  assert.match(label, /out 2/);
  assert.match(label, /6s/);
  assert.match(label, /Raw Ore A x5/);
});

test("buildRecipeOptionLabel prepends a single facility prefix when recipe metadata is present", () => {
  const recipe = sampleGraph.recipes[1002];
  const graphWithPrefixes = {
    ...sampleGraph,
    recipeFacilityPrefixesByBlueprint: {
      1002: ["P"],
    },
  };

  const label = buildRecipeOptionLabel(graphWithPrefixes, recipe, 200);
  assert.match(label, /^\[P\] out 2/);
});

test("buildRecipeOptionLabel normalizes multi-facility prefixes into L/M/S/P order", () => {
  const recipe = sampleGraph.recipes[1002];
  const graphWithPrefixes = {
    ...sampleGraph,
    recipeFacilityPrefixesByBlueprint: {
      1002: ["L", "P", "M", "S"],
    },
  };

  const label = buildRecipeOptionLabel(graphWithPrefixes, recipe, 200);
  assert.match(label, /^\[L\/M\/S\/P\] out 2/);
});

test("renderSelectedTargetMarkup highlights alternate recipe counts for selected targets", () => {
  const summary = createRecipeSummary(sampleGraph, 200, 3, {});
  const markup = renderSelectedTargetMarkup(summary);

  assert.match(markup, /2 recipes/);
});

test("saveStoredPlanProgress and loadStoredPlanProgress persist progress maps safely", () => {
  const storage = new Map();
  const key = "frontier-industry-calculator:plan:test";
  const adapter = {
    getItem(storageKey) {
      return storage.has(storageKey) ? storage.get(storageKey) : null;
    },
    setItem(storageKey, value) {
      storage.set(storageKey, value);
    },
  };

  saveStoredPlanProgress(adapter, key, { 100: 5, 200: 1 });

  assert.deepEqual(loadStoredPlanProgress(adapter, key), { 100: 5, 200: 1 });
  assert.deepEqual(loadStoredPlanProgress(adapter, "missing"), {});
});

test("shouldDataSectionBeOpen is true before a graph is loaded and false after", () => {
  assert.equal(shouldDataSectionBeOpen(null), true);
  assert.equal(shouldDataSectionBeOpen(sampleGraph), false);
});

test("buildNextActions prioritizes the largest mining and production gaps", () => {
  const actions = buildNextActions({
    baseMaterials: [
      { typeID: 100, name: "Raw Ore A", remaining: 5, progressPercent: 37.5, status: "partial" },
      { typeID: 500, name: "Raw Ore B", remaining: 9, progressPercent: 10, status: "missing" },
    ],
    directComponents: [
      { typeID: 200, name: "Composite Plate", remaining: 2, progressPercent: 50, status: "partial" },
      { typeID: 300, name: "Shield Relay", remaining: 4, progressPercent: 0, status: "missing" },
    ],
  });

  assert.deepEqual(actions, [
    { kind: "mine", typeID: 500, name: "Raw Ore B", remaining: 9 },
    { kind: "produce", typeID: 300, name: "Shield Relay", remaining: 4 },
  ]);
});

test("getBottleneckLine returns the highest remaining outstanding line across sections", () => {
  const bottleneck = getBottleneckLine({
    baseMaterials: [
      { typeID: 100, name: "Raw Ore A", remaining: 5, progressPercent: 37.5, status: "partial" },
    ],
    directComponents: [
      { typeID: 300, name: "Shield Relay", remaining: 7, progressPercent: 0, status: "missing" },
    ],
  });

  assert.equal(bottleneck.typeID, 300);
  assert.equal(bottleneck.remaining, 7);
});

test("summarizeWorkspaceHeader derives target progress and eta from current summary and tracked sections", () => {
  const tree = buildDependencyTree(sampleGraph, 400, 1, {});
  const summary = summarizeWorkspaceHeader({
    currentSummary: createRecipeSummary(sampleGraph, 400, 1, {}),
    currentRollup: rollupDependencyTree(tree),
    currentProgressSections: {
      allLines: [
        { need: 8, have: 2 },
        { need: 2, have: 1 },
      ],
    },
  });

  assert.equal(summary.targetName, "Composite Hull");
  assert.equal(summary.progressPercent, 30);
  assert.equal(summary.etaLabel, "24s");
});

test("renderCompactProgressListMarkup renders a capped vertical list without tables", () => {
  const markup = renderCompactProgressListMarkup("Raw Materials", [
    {
      typeID: 100,
      name: "Raw Ore A",
      need: 8,
      have: 3,
      remaining: 5,
      progressPercent: 37.5,
      status: "partial",
    },
    {
      typeID: 200,
      name: "Raw Ore B",
      need: 10,
      have: 0,
      remaining: 10,
      progressPercent: 0,
      status: "missing",
    },
    {
      typeID: 300,
      name: "Raw Ore C",
      need: 10,
      have: 0,
      remaining: 10,
      progressPercent: 0,
      status: "missing",
    },
    {
      typeID: 400,
      name: "Raw Ore D",
      need: 10,
      have: 0,
      remaining: 10,
      progressPercent: 0,
      status: "missing",
    },
    {
      typeID: 500,
      name: "Raw Ore E",
      need: 10,
      have: 0,
      remaining: 10,
      progressPercent: 0,
      status: "missing",
    },
    {
      typeID: 600,
      name: "Raw Ore F",
      need: 10,
      have: 0,
      remaining: 10,
      progressPercent: 0,
      status: "missing",
    },
  ], { expanded: false, emptyMessage: "Nothing queued" });

  assert.match(markup, /progress-list/);
  assert.match(markup, /Raw Ore B/);
  assert.doesNotMatch(markup, /Raw Ore A/);
  assert.match(markup, /Show all/);
  assert.match(markup, /5 items shown/);
  assert.doesNotMatch(markup, /<table/);
  assert.doesNotMatch(markup, /progress-row/);
});

test("renderCompactProgressListMarkup supports inline progress editing controls", () => {
  const markup = renderCompactProgressListMarkup("Materials", [
    {
      typeID: 100,
      name: "Raw Ore A",
      need: 8,
      have: 3,
      remaining: 5,
      progressPercent: 37.5,
      status: "partial",
    },
  ], {
    expanded: true,
    listKey: "materials",
    interactive: true,
    doneLabel: "mined",
  });

  assert.match(markup, /progress-list-row-compact/);
  assert.match(markup, /progress-done-pill/);
  assert.match(markup, /data-progress-have-type-id="100"/);
  assert.match(markup, /data-progress-complete-type-id="100"/);
  assert.match(markup, /Need 8/);
  assert.match(markup, /Mined/);
  assert.doesNotMatch(markup, /<table/);
});

test("renderCompactProgressListMarkup keeps completed rows visible", () => {
  const markup = renderCompactProgressListMarkup("Materials", [
    {
      typeID: 100,
      name: "Raw Ore A",
      need: 8,
      have: 8,
      remaining: 0,
      progressPercent: 100,
      status: "ready",
    },
    {
      typeID: 200,
      name: "Raw Ore B",
      need: 10,
      have: 4,
      remaining: 6,
      progressPercent: 40,
      status: "partial",
    },
  ], {
    expanded: true,
    interactive: true,
    doneLabel: "mined",
  });

  assert.match(markup, /Raw Ore A/);
  assert.match(markup, /Raw Ore B/);
  assert.match(markup, /Mined 8/);
  assert.match(markup, /Need 10/);
  assert.match(markup, /checkbox/);
});

test("renderCompactProgressListMarkup keeps list order stable when a row is marked done", () => {
  const initialMarkup = renderCompactProgressListMarkup("Materials", [
    {
      typeID: 100,
      name: "Raw Ore A",
      need: 8,
      have: 0,
      remaining: 8,
      progressPercent: 0,
      status: "missing",
    },
    {
      typeID: 200,
      name: "Raw Ore B",
      need: 10,
      have: 0,
      remaining: 10,
      progressPercent: 0,
      status: "missing",
    },
    {
      typeID: 300,
      name: "Raw Ore C",
      need: 6,
      have: 0,
      remaining: 6,
      progressPercent: 0,
      status: "missing",
    },
  ], {
    expanded: true,
    interactive: true,
    doneLabel: "mined",
  });

  const completedMarkup = renderCompactProgressListMarkup("Materials", [
    {
      typeID: 100,
      name: "Raw Ore A",
      need: 8,
      have: 0,
      remaining: 8,
      progressPercent: 0,
      status: "missing",
    },
    {
      typeID: 200,
      name: "Raw Ore B",
      need: 10,
      have: 10,
      remaining: 0,
      progressPercent: 100,
      status: "ready",
    },
    {
      typeID: 300,
      name: "Raw Ore C",
      need: 6,
      have: 0,
      remaining: 6,
      progressPercent: 0,
      status: "missing",
    },
  ], {
    expanded: true,
    interactive: true,
    doneLabel: "mined",
  });

  const getNameOrder = (markup) => Array.from(markup.matchAll(/Raw Ore [ABC]/g), (match) => match[0]);

  assert.deepEqual(getNameOrder(completedMarkup), getNameOrder(initialMarkup));
});

test("buildDependencyPipelineGroups maps a dependency tree into mining processing assembly and final stages", () => {
  const tree = buildDependencyTree(sampleGraph, 400, 1, {});
  const pipeline = buildDependencyPipelineGroups(tree);

  assert.deepEqual(Object.keys(pipeline), ["mining", "processing", "assembly", "final"]);
  assert.deepEqual(pipeline.mining.map((entry) => entry.typeID), [100]);
  assert.deepEqual(pipeline.assembly.map((entry) => entry.typeID).sort((left, right) => left - right), [200, 300]);
  assert.deepEqual(pipeline.processing, []);
  assert.deepEqual(pipeline.final.map((entry) => entry.typeID), [400]);
});

test("renderDependencyOutlineMarkup uses outline rows instead of boxed node cards", () => {
  const tree = buildDependencyTree(sampleGraph, 400, 1, {});
  const markup = renderDependencyOutlineMarkup(tree, new Map(), {
    hideCovered: false,
    maxDepth: null,
    showBlueprintIds: true,
    showRecipeDetails: true,
    showTrackedStatus: true,
    expandedNodeIds: new Set([tree.nodeId, ...tree.children.map((child) => child.nodeId)]),
  });

  assert.match(markup, /class="outline-row"/);
  assert.match(markup, /data-outline-row-toggle-node-id="/);
  assert.match(markup, /class="outline-row-body/);
  assert.match(markup, /class="outline-chevron/);
  assert.match(markup, /2 recipes/);
  assert.doesNotMatch(markup, /tree-card/);
  assert.doesNotMatch(markup, /progress-line/);
  assert.doesNotMatch(markup, /class="outline-toggle"/);
});

test("renderDependencyOutlineMarkup shows inline recipe chooser only for the active multi-recipe row", () => {
  const tree = buildDependencyTree(sampleGraph, 400, 1, {});

  const collapsedMarkup = renderDependencyOutlineMarkup(tree, new Map(), {
    hideCovered: false,
    maxDepth: null,
    showBlueprintIds: true,
    showRecipeDetails: false,
    showTrackedStatus: true,
    expandedNodeIds: new Set([tree.nodeId, ...tree.children.map((child) => child.nodeId)]),
  });

  assert.match(collapsedMarkup, /2 recipes/);
  assert.match(collapsedMarkup, /out 1 · 5s/);
  assert.doesNotMatch(collapsedMarkup, /BP 1000/);
  assert.doesNotMatch(collapsedMarkup, /data-outline-recipe-type-id="200"/);

  const chooserMarkup = renderDependencyOutlineMarkup(tree, new Map(), {
    hideCovered: false,
    maxDepth: null,
    showBlueprintIds: true,
    showRecipeDetails: false,
    showTrackedStatus: true,
    activeRecipeChooserTypeID: 200,
    graph: sampleGraph,
    expandedNodeIds: new Set([tree.nodeId, ...tree.children.map((child) => child.nodeId)]),
  });

  assert.match(chooserMarkup, /data-outline-recipe-type-id="200"/);
  assert.match(chooserMarkup, /out 2 · 6s · Raw Ore A x5/);
  assert.doesNotMatch(chooserMarkup, /BP 1002/);
  assert.match(chooserMarkup, /Applies to all occurrences of this item in the current plan/);
});

test("renderDependencyOutlineMarkup includes facility prefix in recipe choice pill when available", () => {
  const graphWithPrefixes = {
    ...sampleGraph,
    recipeFacilityPrefixesByBlueprint: {
      1000: ["M"],
      1002: ["L"],
    },
  };
  const tree = buildDependencyTree(graphWithPrefixes, 400, 1, {});
  const markup = renderDependencyOutlineMarkup(tree, new Map(), {
    hideCovered: false,
    maxDepth: null,
    showBlueprintIds: true,
    showRecipeDetails: false,
    showTrackedStatus: true,
    expandedNodeIds: new Set([tree.nodeId, ...tree.children.map((child) => child.nodeId)]),
    graph: graphWithPrefixes,
  });

  assert.match(markup, /\[L\] out 2 · 6s/);
  assert.doesNotMatch(markup, /BP 1000/);
});

test("renderDependencyOutlineMarkup keeps facility prefix visible for single-recipe rows without recipe details", () => {
  const graphWithPrefixes = {
    ...sampleGraph,
    recipeFacilityPrefixesByBlueprint: {
      1000: ["M"],
      1001: ["S"],
      1002: ["L"],
      2000: ["P"],
    },
  };
  const tree = buildDependencyTree(graphWithPrefixes, 400, 1, {});
  const markup = renderDependencyOutlineMarkup(tree, new Map(), {
    hideCovered: false,
    maxDepth: null,
    showRecipeDetails: false,
    showTrackedStatus: true,
    expandedNodeIds: new Set([tree.nodeId, ...tree.children.map((child) => child.nodeId)]),
    graph: graphWithPrefixes,
  });

  assert.match(markup, /\[P\]/);
  assert.match(markup, /\[S\]/);
});

test("buildDependencyTree stops recursion on cyclic dependencies", () => {
  const cyclicGraph = JSON.parse(JSON.stringify(sampleGraph));
  cyclicGraph.recipes[3000] = {
    blueprintID: 3000,
    primaryTypeID: 400,
    runTime: 7,
    inputs: [{ typeID: 400, quantity: 1 }],
    outputs: [{ typeID: 300, quantity: 1 }],
  };
  cyclicGraph.recipesByOutput[300] = [3000];

  const tree = buildDependencyTree(cyclicGraph, 400, 1, {});

  assert.equal(tree.children[1].item.name, "Shield Relay");
  assert.equal(tree.children[1].children[0].item.name, "Composite Hull");
  assert.equal(tree.children[1].children[0].cycleDetected, true);
  assert.deepEqual(tree.children[1].children[0].children, []);
});

test("buildGraphFromStrippedData creates a runtime graph from stripped source files", () => {
  const strippedTypes = {
    100: { typeID: 100, name: "Raw Ore A", groupID: 10, categoryID: 1, mass: 1, volume: 1 },
    200: { typeID: 200, name: "Composite Plate", groupID: 20, categoryID: 2, mass: 1.5, volume: 0.4 },
  };
  const strippedBlueprints = {
    1000: {
      blueprintID: 1000,
      primaryTypeID: 200,
      runTime: 5,
      inputs: [{ typeID: 100, quantity: 2 }],
      outputs: [{ typeID: 200, quantity: 1 }],
    },
  };

  const graph = buildGraphFromStrippedData("sample.snapshot", strippedTypes, strippedBlueprints);

  assert.equal(graph.meta.snapshot, "sample.snapshot");
  assert.equal(graph.items[100].isBaseMaterial, true);
  assert.equal(graph.items[200].isCraftable, true);
  assert.deepEqual(graph.recipesByOutput[200], [1000]);
  assert.deepEqual(graph.baseMaterials, [100]);
});

test("buildGraphFromStrippedData derives recipe facility prefixes from optional facilities data", () => {
  const strippedTypes = {
    100: { typeID: 100, name: "Raw Ore A", groupID: 10, categoryID: 1, mass: 1, volume: 1 },
    200: { typeID: 200, name: "Composite Plate", groupID: 20, categoryID: 2, mass: 1.5, volume: 0.4 },
    87162: { typeID: 87162, "typeName_en-us": "Field Printer" },
    88067: { typeID: 88067, "typeName_en-us": "Printer" },
    87120: { typeID: 87120, "typeName_en-us": "Heavy Printer" },
  };
  const strippedBlueprints = {
    1000: {
      blueprintID: 1000,
      primaryTypeID: 200,
      runTime: 5,
      inputs: [{ typeID: 100, quantity: 2 }],
      outputs: [{ typeID: 200, quantity: 1 }],
    },
  };
  const facilitiesData = {
    87162: { blueprints: [{ blueprintID: 1000 }] },
    88067: { blueprints: [{ blueprintID: 1000 }] },
    87120: { blueprints: [{ blueprintID: 1000 }] },
  };

  const graph = buildGraphFromStrippedData("sample.snapshot", strippedTypes, strippedBlueprints, facilitiesData);

  assert.deepEqual(graph.recipeFacilityPrefixesByBlueprint[1000], ["L", "M", "P"]);
});

test("updateProgressInputValue updates progress state without requiring a progress-table rerender", () => {
  const state = {
    progressByTypeID: {},
  };
  const calls = {
    refresh: 0,
    persist: 0,
    active: 0,
    tree: 0,
  };

  updateProgressInputValue({
    state,
    typeID: 200,
    value: "12",
    refreshProgressState() {
      calls.refresh += 1;
    },
    persistCurrentPlanProgress() {
      calls.persist += 1;
    },
    renderActiveTargetCard() {
      calls.active += 1;
    },
    renderTree() {
      calls.tree += 1;
    },
  });

  assert.equal(state.progressByTypeID[200], 12);
  assert.deepEqual(calls, {
    refresh: 1,
    persist: 1,
    active: 1,
    tree: 1,
  });
});
