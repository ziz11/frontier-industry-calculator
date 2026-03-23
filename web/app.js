(function initCalculatorApp(globalScope) {
  function toNumber(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? null : numericValue;
  }

  function normalizeQuantity(value) {
    const numericValue = Math.floor(Number(value) || 0);
    return Math.max(1, numericValue);
  }

  function normalizeProgressValue(value) {
    return Math.max(0, Number(value) || 0);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function normalizeMaterialNode(node) {
    return {
      typeID: Number(node.typeID),
      quantity: Number(node.quantity),
    };
  }

  function sortedNumericEntries(data) {
    return Object.entries(data || {})
      .map(([key, value]) => [Number(key), value])
      .filter(([key, value]) => Number.isFinite(key) && value && typeof value === "object")
      .sort((left, right) => left[0] - right[0]);
  }

  function resolveItemName(record, typeId) {
    for (const key of ["name", "typeName_en-us", "typeName_en", "typeName"]) {
      const value = record?.[key];
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
    return `Type ${typeId}`;
  }

  const FACILITY_PREFIX_ORDER = ["L", "M", "S", "P"];
  const MANAGED_DEFAULT_RECIPE_STORAGE_KEY = "frontier-industry-calculator:managed-default-recipes:v1";
  const MANAGED_DEFAULT_RECIPE_ROOTS = [
    { key: "reinforced-alloys", name: "Reinforced Alloys", preferredPrefixes: ["S"] },
    { key: "carbon-weave", name: "Carbon Weave", preferredPrefixes: ["S"] },
    { key: "thermal-composites", name: "Thermal Composites", preferredPrefixes: ["S"] },
    { key: "silicon-dust", name: "Silicon Dust", preferredPrefixes: ["S"] },
    { key: "tholin-aggregates", name: "Tholin Aggregates", preferredPrefixes: ["S"] },
    { key: "feldspar-crystal-shards", name: "Feldspar Crystal Shards", preferredPrefixes: ["S"] },
    { key: "hydrocarbon-residue", name: "Hydrocarbon Residue", preferredPrefixes: ["S"] },
    { key: "nickel-iron-veins", name: "Nickel-Iron Veins", preferredPrefixes: ["S"] },
  ];
  const KNOWN_FACILITY_PREFIX_BY_TYPE_ID = {
    87119: "S", // Mini Printer
    87120: "L", // Heavy Printer
    87161: "P", // Field Refinery
    87162: "P", // Field Printer
    88063: "M", // Refinery
    88064: "L", // Heavy Refinery
    88067: "M", // Printer
    88068: "M", // Assembler
    88069: "S", // Mini Berth
    88070: "M", // Berth
    88071: "L", // Heavy Berth
    91978: "P", // Nursery
  };

  function toOrderedFacilityPrefixes(prefixes = []) {
    const unique = Array.from(new Set((Array.isArray(prefixes) ? prefixes : []).map((entry) => String(entry || "").trim())));
    return unique
      .filter((entry) => FACILITY_PREFIX_ORDER.includes(entry))
      .sort((left, right) => FACILITY_PREFIX_ORDER.indexOf(left) - FACILITY_PREFIX_ORDER.indexOf(right));
  }

  function inferFacilityPrefixFromName(name) {
    const normalized = String(name || "").toLowerCase();
    if (!normalized) {
      return null;
    }
    if (normalized.includes("portable") || normalized.includes("field")) {
      return "P";
    }
    if (normalized.includes("mini")) {
      return "S";
    }
    if (normalized.includes("heavy")) {
      return "L";
    }
    if (
      normalized.includes("refinery") ||
      normalized.includes("printer") ||
      normalized.includes("assembler") ||
      normalized.includes("berth") ||
      normalized.includes("shipyard")
    ) {
      return "M";
    }
    return null;
  }

  function resolveFacilityPrefix(typeId, typesData = {}) {
    const known = KNOWN_FACILITY_PREFIX_BY_TYPE_ID[Number(typeId)];
    if (known) {
      return known;
    }

    const record = typesData?.[typeId] ?? typesData?.[String(typeId)] ?? null;
    const facilityName = record?.["typeName_en-us"] ?? record?.name ?? "";
    return inferFacilityPrefixFromName(facilityName);
  }

  function buildRecipeFacilityPrefixesByBlueprint(typesData = {}, facilitiesData = {}) {
    const prefixesByBlueprint = {};

    for (const [facilityTypeId, facilityRecord] of sortedNumericEntries(facilitiesData)) {
      const prefix = resolveFacilityPrefix(facilityTypeId, typesData);
      if (!prefix) {
        continue;
      }

      for (const blueprintRef of facilityRecord?.blueprints || []) {
        const blueprintId = Number(blueprintRef?.blueprintID);
        if (!Number.isFinite(blueprintId)) {
          continue;
        }

        if (!prefixesByBlueprint[blueprintId]) {
          prefixesByBlueprint[blueprintId] = [];
        }
        prefixesByBlueprint[blueprintId].push(prefix);
      }
    }

    for (const blueprintId of Object.keys(prefixesByBlueprint)) {
      prefixesByBlueprint[blueprintId] = toOrderedFacilityPrefixes(prefixesByBlueprint[blueprintId]);
    }

    return prefixesByBlueprint;
  }

  function getRecipeFacilityPrefixTag(graph, recipe) {
    const blueprintId = Number(recipe?.blueprintID);
    const rawPrefixes = Number.isFinite(blueprintId)
      ? graph?.recipeFacilityPrefixesByBlueprint?.[blueprintId] ??
        graph?.recipeFacilityPrefixesByBlueprint?.[String(blueprintId)] ??
        recipe?.facilityPrefixes ??
        recipe?.facilities ??
        []
      : recipe?.facilityPrefixes ?? recipe?.facilities ?? [];
    const prefixes = toOrderedFacilityPrefixes(rawPrefixes);
    return prefixes.length ? `[${prefixes.join("/")}]` : "";
  }

  function normalizeManagedDefaultRecipeSelectionMap(graph, selections = {}) {
    const normalized = {};
    for (const [typeID, recipeID] of Object.entries(selections || {})) {
      const safeTypeID = Number(typeID);
      const safeRecipeID = Number(recipeID);
      if (!Number.isFinite(safeTypeID) || !Number.isFinite(safeRecipeID)) {
        continue;
      }

      const recipe = getRecipe(graph, safeRecipeID);
      if (!recipe) {
        continue;
      }

      const availableRecipes = getAvailableRecipesForType(graph, safeTypeID);
      if (!availableRecipes.some((candidate) => Number(candidate.blueprintID) === safeRecipeID)) {
        continue;
      }
      normalized[safeTypeID] = safeRecipeID;
    }
    return normalized;
  }

  function findPreferredRecipe(graph, typeID, preferredPrefixes = ["S"]) {
    const availableRecipes = getAvailableRecipesForType(graph, typeID);
    if (!availableRecipes.length) {
      return null;
    }

    const normalizedPreferredPrefixes = (Array.isArray(preferredPrefixes) ? preferredPrefixes : [])
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);

    for (const prefix of normalizedPreferredPrefixes) {
      const preferredRecipe = availableRecipes.find((recipe) => {
        const prefixes =
          graph?.recipeFacilityPrefixesByBlueprint?.[recipe.blueprintID] ??
          graph?.recipeFacilityPrefixesByBlueprint?.[String(recipe.blueprintID)] ??
          [];
        return toOrderedFacilityPrefixes(prefixes).includes(prefix);
      });
      if (preferredRecipe) {
        return preferredRecipe;
      }
    }

    return availableRecipes[0];
  }

  function buildPreferredRecipeSelections(graph, typeID, preferredPrefixes = ["S"], selections = {}, activePath = new Set()) {
    const safeTypeID = Number(typeID);
    if (!graph || !Number.isFinite(safeTypeID) || activePath.has(safeTypeID)) {
      return selections;
    }

    const recipe = findPreferredRecipe(graph, safeTypeID, preferredPrefixes);
    if (!recipe) {
      return selections;
    }

    selections[safeTypeID] = Number(recipe.blueprintID);
    activePath.add(safeTypeID);
    for (const input of recipe.inputs || []) {
      buildPreferredRecipeSelections(graph, input.typeID, preferredPrefixes, selections, activePath);
    }
    activePath.delete(safeTypeID);
    return selections;
  }

  function getManagedDefaultRecipeRootItem(graph, name) {
    return Object.values(graph?.items || {}).find(
      (item) => String(item?.name || "").trim().toLowerCase() === String(name || "").trim().toLowerCase(),
    ) ?? null;
  }

  function buildManagedDefaultRecipePresets(graph, storedSelectionsByRoot = {}) {
    if (!graph) {
      return [];
    }

    return MANAGED_DEFAULT_RECIPE_ROOTS
      .map((definition) => {
        const item = getManagedDefaultRecipeRootItem(graph, definition.name);
        if (!item) {
          return null;
        }

        const autoRecipeSelections = buildPreferredRecipeSelections(graph, item.typeID, definition.preferredPrefixes);
        const storedRecipeSelections = normalizeManagedDefaultRecipeSelectionMap(
          graph,
          storedSelectionsByRoot?.[definition.key] || {},
        );
        const recipeSelections = {
          ...autoRecipeSelections,
          ...storedRecipeSelections,
        };
        const tree = buildDependencyTree(graph, item.typeID, 1, recipeSelections);
        const rootRecipe = resolveRecipeChoice(graph, item.typeID, recipeSelections);

        return {
          ...definition,
          item,
          typeID: Number(item.typeID),
          autoRecipeSelections,
          storedRecipeSelections,
          recipeSelections,
          tree,
          rootRecipe,
          isCustomized:
            serializeRecipeSelections(storedRecipeSelections) !== "" &&
            serializeRecipeSelections(storedRecipeSelections) !== serializeRecipeSelections(autoRecipeSelections),
        };
      })
      .filter(Boolean);
  }

  function mergeManagedDefaultRecipeSelections(presets = []) {
    const merged = {};
    for (const preset of Array.isArray(presets) ? presets : []) {
      for (const [typeID, recipeID] of Object.entries(preset?.autoRecipeSelections || {})) {
        if (!(typeID in merged)) {
          merged[typeID] = recipeID;
        }
      }
    }
    for (const preset of Array.isArray(presets) ? presets : []) {
      Object.assign(merged, preset?.storedRecipeSelections || {});
    }
    return merged;
  }

  function buildManagedDefaultTypeIdSet(presets = []) {
    return new Set(
      (Array.isArray(presets) ? presets : [])
        .map((preset) => Number(preset?.typeID))
        .filter(Number.isFinite),
    );
  }

  function mergeRecipeSelectionsWithManagedDefaults(currentSelections = {}, managedSelections = {}, presets = []) {
    const managedTypeIds = buildManagedDefaultTypeIdSet(presets);
    const merged = {};

    for (const [typeID, recipeID] of Object.entries(currentSelections || {})) {
      const safeTypeID = Number(typeID);
      const safeRecipeID = Number(recipeID);
      if (!Number.isFinite(safeTypeID) || !Number.isFinite(safeRecipeID) || managedTypeIds.has(safeTypeID)) {
        continue;
      }
      merged[safeTypeID] = safeRecipeID;
    }

    return {
      ...merged,
      ...managedSelections,
    };
  }

  function collectManagedDefaultReachableTypeIds(graph, selectedTypeID, recipeSelections = {}) {
    const safeTypeID = Number(selectedTypeID);
    if (!graph || !Number.isFinite(safeTypeID)) {
      return new Set();
    }

    const rootRecipe = resolveRecipeChoice(graph, safeTypeID, recipeSelections);
    if (!rootRecipe) {
      return new Set();
    }

    const reachable = new Set();
    const visited = new Set();

    function visitType(typeID) {
      const safeChildTypeID = Number(typeID);
      if (!Number.isFinite(safeChildTypeID) || visited.has(safeChildTypeID)) {
        return;
      }

      visited.add(safeChildTypeID);
      reachable.add(safeChildTypeID);

      const childRecipe = resolveRecipeChoice(graph, safeChildTypeID, recipeSelections);
      if (!childRecipe) {
        return;
      }

      for (const input of childRecipe.inputs || []) {
        visitType(input.typeID);
      }
    }

    for (const input of rootRecipe.inputs || []) {
      visitType(input.typeID);
    }

    return reachable;
  }

  function filterManagedDefaultRecipePresetsForSelection(graph, presets = [], selectedTypeID = null, recipeSelections = {}) {
    if (!graph) {
      return [];
    }

    const reachableTypeIds = collectManagedDefaultReachableTypeIds(graph, selectedTypeID, recipeSelections);
    if (!reachableTypeIds.size) {
      return [];
    }

    return (Array.isArray(presets) ? presets : []).filter((preset) => reachableTypeIds.has(Number(preset?.typeID)));
  }

  function loadStoredManagedDefaultRecipePresets(storage) {
    if (!storage || typeof storage.getItem !== "function") {
      return {};
    }

    try {
      const raw = storage.getItem(MANAGED_DEFAULT_RECIPE_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function saveStoredManagedDefaultRecipePresets(storage, presetsByRoot = {}) {
    if (!storage || typeof storage.setItem !== "function") {
      return;
    }

    const normalized = {};
    for (const [rootKey, selections] of Object.entries(presetsByRoot || {})) {
      const serializedSelections = serializeRecipeSelections(selections);
      if (!serializedSelections) {
        continue;
      }
      normalized[rootKey] = Object.entries(selections || {}).reduce((accumulator, [typeID, recipeID]) => {
        const safeTypeID = Number(typeID);
        const safeRecipeID = Number(recipeID);
        if (Number.isFinite(safeTypeID) && Number.isFinite(safeRecipeID)) {
          accumulator[safeTypeID] = safeRecipeID;
        }
        return accumulator;
      }, {});
    }

    try {
      storage.setItem(MANAGED_DEFAULT_RECIPE_STORAGE_KEY, JSON.stringify(normalized));
    } catch (_error) {
      // ignore storage failures for static local mode
    }
  }

  function buildManagedDefaultSelectionCardMarkup(preset, graph, options = {}) {
    if (!preset) {
      return "";
    }

    const isActive = Boolean(options.isActive);
    const rootSelectDataAttribute = String(options.rootSelectDataAttribute || "data-managed-default-root-select-key");
    const rootPrefixTag = getRecipeFacilityPrefixTag(graph, preset.rootRecipe) || "[Base]";
    const currentPathLabel = preset.isCustomized ? "Custom path" : "Default path";
    const currentStateValue = preset.isCustomized ? "overridden" : "default";
    const recipeOptionCount = getAvailableRecipesForType(graph, preset.typeID).length;

    return `
      <section
        class="managed-default-selection-card planner-decision-group${isActive ? " is-active" : ""}"
        data-managed-default-root-key="${preset.key}"
        ${rootSelectDataAttribute}="${preset.key}"
      >
        <button
          type="button"
          class="managed-default-selection-select"
          ${rootSelectDataAttribute}="${preset.key}"
          aria-pressed="${String(isActive)}"
        >
          <div class="planner-decision-group-head managed-default-selection-head">
            <div class="planner-decision-head-main managed-default-selection-main">
              <div class="planner-decision-type-label">${renderItemMarkup(preset.name, preset.typeID)}</div>
              <div class="planner-decision-type-meta">Type ${formatNumber(preset.typeID)}</div>
              <div class="planner-decision-count">${formatNumber(recipeOptionCount)} recipe option${recipeOptionCount === 1 ? "" : "s"}</div>
            </div>
            <div class="managed-default-selection-side">
              <span class="planner-decision-state-pill" data-state="${currentStateValue}">
                ${escapeHtml(currentStateValue)}
              </span>
            </div>
          </div>
          <div class="managed-default-path-row">
            <span class="managed-default-path-chip is-selected">${escapeHtml(rootPrefixTag)} path</span>
            <span class="managed-default-path-chip${preset.isCustomized ? " is-custom" : ""}">${escapeHtml(currentPathLabel)}</span>
          </div>
        </button>
      </section>
    `;
  }

  function buildManagedDefaultPresetCardMarkup(preset, graph, options = {}) {
    return buildManagedDefaultSelectionCardMarkup(preset, graph, {
      ...options,
      rootSelectDataAttribute: options.rootSelectDataAttribute || "data-managed-default-root-select-key",
    });
  }

  function buildManagedDefaultDetailMarkup(preset, graph, options = {}) {
    if (!preset) {
      return `
        <section class="managed-default-detail-panel planner-decision-group managed-default-unified-detail">
          <div class="planner-decision-group-head">
            <div class="planner-decision-head-main">
              <div class="planner-decision-type-meta">Default recipe paths</div>
              <div class="planner-decision-count">No material selected</div>
            </div>
          </div>
          <p class="planner-decision-scope-note">${escapeHtml(options.emptyMessage || "Choose a material on the left to edit its default recipe path.")}</p>
        </section>
      `;
    }

    const currentStateValue = preset.isCustomized ? "overridden" : "default";
    const stateLabel = currentStateValue;
    const currentBlueprintId = Number(preset?.rootRecipe?.blueprintID);
    const recipeOptions = getAvailableRecipesForType(graph, preset.typeID);
    const interactionId = String(options.interactionId || "managed-default-detail");
    const optionTypeDataAttribute = String(options.optionTypeDataAttribute || "data-managed-default-workspace-option-type-id");
    const optionRootDataAttribute = String(options.optionRootDataAttribute || "data-managed-default-workspace-option-root-key");
    const scopeNote = options.scopeNote || "Applies to current filtered recipe path.";
    const stateDetailLabel = options.stateDetailLabel || stateLabel;

    return `
      <section
        class="managed-default-detail-panel planner-decision-group managed-default-unified-detail is-open"
        data-managed-default-root-detail-key="${preset.key}"
      >
        <div class="planner-decision-group-head">
          <div class="planner-decision-head-main">
            <div class="planner-decision-type-label">${renderItemMarkup(preset.name, preset.typeID)}</div>
          </div>
          <span class="planner-decision-state-pill" data-state="${currentStateValue}">
            ${escapeHtml(currentStateValue)}
          </span>
        </div>
        <div class="planner-decision-facts">
          <div class="planner-decision-fact">
            <span class="summary-key">Type</span>
            <strong class="planner-decision-fact-value">Type ${formatNumber(preset.typeID)}</strong>
          </div>
          <div class="planner-decision-fact">
            <span class="summary-key">Recipe options</span>
            <strong class="planner-decision-fact-value">${formatNumber(recipeOptions.length)}</strong>
          </div>
          <div class="planner-decision-fact planner-decision-meta">
            <span class="summary-key">STATE</span>
            <strong class="planner-decision-state" data-state="${currentStateValue}">${escapeHtml(stateDetailLabel)}</strong>
          </div>
        </div>
        <p class="planner-decision-scope-note">${escapeHtml(scopeNote)}</p>
        <div class="planner-decision-options">
          ${recipeOptions
            .map((option) =>
              renderPlannerDecisionOptionMarkup({
                option,
                typeId: preset.typeID,
                graph,
                currentBlueprintId,
                inputName: `${interactionId}-type-${preset.typeID}`,
                inputAttributes: `${optionTypeDataAttribute}="${preset.typeID}" ${optionRootDataAttribute}="${preset.key}"`,
              }),
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function buildManagedDefaultPresetDetailMarkup(preset, graph, options = {}) {
    return buildManagedDefaultDetailMarkup(preset, graph, {
      interactionId: "managed-default-drawer",
      optionTypeDataAttribute: "data-managed-default-drawer-option-type-id",
      optionRootDataAttribute: "data-managed-default-drawer-option-root-key",
      scopeNote: options.scopeNote || "Applies as global default for calculator targets.",
      stateDetailLabel: options.stateDetailLabel || (preset?.isCustomized ? "overridden" : "default"),
      emptyMessage: options.emptyMessage || "Choose a material on the left to edit its global default recipe path.",
    });
  }

  function renderManagedDefaultRecipePathsMarkup(graph, presets = [], state = {}) {
    if (!graph) {
      return `
        <div class="default-recipe-empty">Load data to configure global recipe defaults.</div>
      `;
    }

    if (!Array.isArray(presets) || !presets.length) {
      return `
        <div class="default-recipe-empty">This dataset does not expose any managed default recipe paths.</div>
      `;
    }

    const rootCount = presets.length;
    const activeRootKey =
      presets.some((preset) => preset.key === state.activeRootKey)
        ? state.activeRootKey
        : presets[0]?.key ?? null;
    const activePreset = presets.find((preset) => preset.key === activeRootKey) ?? presets[0] ?? null;
    const customizedCount = presets.filter((preset) => preset.isCustomized).length;

    const summaryMarkup = `
      <section class="planner-decision-summary default-recipe-summary">
        <div class="planner-decision-summary-card">
          <span class="summary-key">Managed roots</span>
          <strong class="planner-decision-summary-value">${formatNumber(rootCount)}</strong>
        </div>
        <div class="planner-decision-summary-card">
          <span class="summary-key">Customized</span>
          <strong class="planner-decision-summary-value">${formatNumber(customizedCount)}</strong>
        </div>
        <div class="planner-decision-summary-card">
          <span class="summary-key">Default</span>
          <strong class="planner-decision-summary-value">${formatNumber(rootCount - customizedCount)}</strong>
        </div>
      </section>
    `;

    const railMarkup = `
        <section class="default-recipe-list">
        ${presets
          .map((preset) =>
            buildManagedDefaultSelectionCardMarkup(preset, graph, {
              isActive: preset.key === activeRootKey,
              rootSelectDataAttribute: "data-managed-default-root-select-key",
            }),
          )
          .join("")}
      </section>
    `;

    const detailMarkup = buildManagedDefaultPresetDetailMarkup(activePreset, graph);

    return `
      <div class="default-recipe-shell">
        ${summaryMarkup}
        <div class="default-recipe-layout">
          ${railMarkup}
          <section class="default-recipe-detail">
            ${detailMarkup}
          </section>
        </div>
      </div>
    `;
  }

  function buildGraphFromStrippedData(snapshot, typesData, blueprintsData, facilitiesData = null) {
    const recipes = {};
    const recipesByOutput = {};
    const craftableTypeIds = new Set();

    for (const [blueprintId, record] of sortedNumericEntries(blueprintsData)) {
      const inputs = Array.isArray(record.inputs)
        ? record.inputs
            .filter((node) => node && node.typeID !== undefined && node.quantity !== undefined)
            .map(normalizeMaterialNode)
        : [];
      const outputs = Array.isArray(record.outputs)
        ? record.outputs
            .filter((node) => node && node.typeID !== undefined && node.quantity !== undefined)
            .map(normalizeMaterialNode)
        : [];
      const primaryTypeID =
        toNumber(record.primaryTypeID) ?? (outputs.length ? Number(outputs[0].typeID) : null);

      recipes[blueprintId] = {
        blueprintID: toNumber(record.blueprintID) ?? blueprintId,
        primaryTypeID,
        runTime: toNumber(record.runTime),
        inputs,
        outputs,
      };

      for (const output of outputs) {
        craftableTypeIds.add(output.typeID);
        if (!recipesByOutput[output.typeID]) {
          recipesByOutput[output.typeID] = [];
        }
        recipesByOutput[output.typeID].push(blueprintId);
      }
    }

    const referencedInputTypeIds = new Set();
    for (const recipe of Object.values(recipes)) {
      for (const inputNode of recipe.inputs) {
        referencedInputTypeIds.add(inputNode.typeID);
      }
    }

    const items = {};
    for (const [typeId, record] of sortedNumericEntries(typesData)) {
      const isCraftable = craftableTypeIds.has(typeId);
      const isBaseMaterial = referencedInputTypeIds.has(typeId) && !isCraftable;

      items[typeId] = {
        typeID: toNumber(record.typeID) ?? typeId,
        name: resolveItemName(record, typeId),
        groupID: toNumber(record.groupID),
        categoryID: toNumber(record.categoryID),
        mass: toNumber(record.mass),
        volume: toNumber(record.volume),
        isBaseMaterial,
        isCraftable,
      };
    }

    const baseMaterials = Array.from(referencedInputTypeIds)
      .filter((typeId) => !craftableTypeIds.has(typeId))
      .sort((left, right) => left - right);
    const recipeFacilityPrefixesByBlueprint =
      facilitiesData && typeof facilitiesData === "object"
        ? buildRecipeFacilityPrefixesByBlueprint(typesData, facilitiesData)
        : {};

    return {
      meta: {
        schemaVersion: 1,
        snapshot,
        generatedAt: new Date().toISOString(),
      },
      items,
      recipes,
      recipesByOutput,
      baseMaterials,
      recipeFacilityPrefixesByBlueprint,
    };
  }

  function getItem(graph, typeID) {
    return graph?.items?.[typeID] ?? graph?.items?.[String(typeID)] ?? null;
  }

  function getRecipe(graph, blueprintID) {
    return graph?.recipes?.[blueprintID] ?? graph?.recipes?.[String(blueprintID)] ?? null;
  }

  function getRecipeFacilitySortRank(graph, recipe) {
    const blueprintId = Number(recipe?.blueprintID);
    if (!Number.isFinite(blueprintId)) {
      return FACILITY_PREFIX_ORDER.length;
    }

    const rawPrefixes =
      graph?.recipeFacilityPrefixesByBlueprint?.[blueprintId] ??
      graph?.recipeFacilityPrefixesByBlueprint?.[String(blueprintId)] ??
      [];
    const orderedPrefixes = toOrderedFacilityPrefixes(rawPrefixes);
    if (!orderedPrefixes.length) {
      return FACILITY_PREFIX_ORDER.length;
    }

    const rank = FACILITY_PREFIX_ORDER.indexOf(orderedPrefixes[0]);
    return rank === -1 ? FACILITY_PREFIX_ORDER.length : rank;
  }

  function getAvailableRecipesForType(graph, typeID) {
    const recipeIds = graph?.recipesByOutput?.[typeID] ?? graph?.recipesByOutput?.[String(typeID)] ?? [];
    return recipeIds
      .map((recipeID) => getRecipe(graph, recipeID))
      .filter(Boolean)
      .sort((left, right) => {
        const rankDiff = getRecipeFacilitySortRank(graph, left) - getRecipeFacilitySortRank(graph, right);
        if (rankDiff !== 0) {
          return rankDiff;
        }
        return Number(left.blueprintID) - Number(right.blueprintID);
      });
  }

  function resolveRecipeChoice(graph, typeID, recipeSelections = {}) {
    const availableRecipes = getAvailableRecipesForType(graph, typeID);
    if (!availableRecipes.length) {
      return null;
    }

    const selectedRecipeID = toNumber(recipeSelections?.[typeID] ?? recipeSelections?.[String(typeID)]);
    const selectedRecipe = availableRecipes.find((recipe) => Number(recipe.blueprintID) === selectedRecipeID);
    return selectedRecipe ?? availableRecipes[0];
  }

  function getRecipeOutputForType(recipe, typeID) {
    return (
      recipe?.outputs?.find((output) => Number(output.typeID) === Number(typeID)) ??
      recipe?.outputs?.[0] ??
      null
    );
  }

  function getIconFallbackLabel(name) {
    const words = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!words.length) {
      return "?";
    }
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
  }

  function renderItemMarkup(name, typeID) {
    return `
      <span class="item-inline">
        <span class="item-icon" data-icon-type-id="${typeID}" data-icon-fallback="${escapeHtml(getIconFallbackLabel(name))}">
          ${escapeHtml(getIconFallbackLabel(name))}
        </span>
        <span class="item-label-text">${escapeHtml(name)}</span>
      </span>
    `;
  }

  function compareNamedItems(left, right) {
    return left.name.localeCompare(right.name);
  }

  function sortSearchResults(items, normalizedQuery, numericQuery) {
    const query = String(normalizedQuery || "").trim().toLowerCase();
    const hasQuery = Boolean(query);

    return items.slice().sort((left, right) => {
      if (numericQuery !== null) {
        const leftTypeMatch = Number(left.typeID) === numericQuery ? 0 : 1;
        const rightTypeMatch = Number(right.typeID) === numericQuery ? 0 : 1;
        if (leftTypeMatch !== rightTypeMatch) {
          return leftTypeMatch - rightTypeMatch;
        }
      }

      if (hasQuery) {
        const leftName = left.name.toLowerCase();
        const rightName = right.name.toLowerCase();
        const leftStarts = leftName.startsWith(query) ? 0 : 1;
        const rightStarts = rightName.startsWith(query) ? 0 : 1;
        if (leftStarts !== rightStarts) {
          return leftStarts - rightStarts;
        }
      }

      return compareNamedItems(left, right);
    });
  }

  function getCraftableItems(graph) {
    return Object.entries(graph?.items || {})
      .map(([typeIdKey, item]) => {
        const typeId = Number(item?.typeID ?? typeIdKey);
        return {
          ...(item || {}),
          typeID: Number.isFinite(typeId) ? typeId : item?.typeID,
          name: resolveItemName(item, Number.isFinite(typeId) ? typeId : item?.typeID),
        };
      })
      .filter((item) => item?.isCraftable)
      .sort(compareNamedItems);
  }

  function createCatalogBranch(branch) {
    return {
      branchKey: branch.branchKey,
      key: branch.key,
      label: branch.label,
      type: branch.type,
      count: branch.itemTypeIDs.length,
      itemTypeIDs: branch.itemTypeIDs.slice(),
      items: branch.items.slice(),
      children: branch.children.slice(),
    };
  }

  function buildCatalogTree(graph) {
    const craftableItems = getCraftableItems(graph);
    const categoryMap = new Map();
    const rootGroupMap = new Map();

    function ensureCategory(categoryID) {
      const branchKey = `category:${categoryID}`;
      if (!categoryMap.has(branchKey)) {
        categoryMap.set(branchKey, {
          branchKey,
          key: branchKey,
          label: `Category ${categoryID}`,
          type: "category",
          itemTypeIDs: [],
          items: [],
          children: [],
          childMap: new Map(),
        });
      }
      return categoryMap.get(branchKey);
    }

    function ensureGroup(container, groupID, parentBranchKey = "") {
      const key = Number.isFinite(groupID) ? `group:${groupID}` : "group:unknown";
      const branchKey = parentBranchKey ? `${parentBranchKey}>${key}` : key;
      if (!container.childMap.has(branchKey)) {
        container.childMap.set(branchKey, {
          branchKey,
          key,
          label: Number.isFinite(groupID) ? `Group ${groupID}` : "Ungrouped",
          type: "group",
          itemTypeIDs: [],
          items: [],
          children: [],
          childMap: new Map(),
        });
      }
      return container.childMap.get(branchKey);
    }

    const rootContainer = {
      childMap: rootGroupMap,
    };

    for (const item of craftableItems) {
      const categoryID = Number.isFinite(item.categoryID) ? Number(item.categoryID) : null;
      const groupID = Number.isFinite(item.groupID) ? Number(item.groupID) : null;

      if (categoryID !== null) {
        const category = ensureCategory(categoryID);
        category.itemTypeIDs.push(item.typeID);
        category.items.push(item);
        const group = ensureGroup(category, groupID, category.branchKey);
        group.itemTypeIDs.push(item.typeID);
        group.items.push(item);
      } else {
        const group = ensureGroup(rootContainer, groupID);
        group.itemTypeIDs.push(item.typeID);
        group.items.push(item);
      }
    }

    function finalizeBranch(branch) {
      branch.children = Array.from(branch.childMap?.values() || [])
        .sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }))
        .map((child) => finalizeBranch(child));
      delete branch.childMap;
      branch.itemTypeIDs.sort((left, right) => left - right);
      branch.items.sort(compareNamedItems);
      return createCatalogBranch(branch);
    }

    const categoryBranches = Array.from(categoryMap.values())
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }))
      .map((category) => finalizeBranch(category));
    const rootGroups = Array.from(rootGroupMap.values())
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }))
      .map((group) => finalizeBranch(group));

    const nodes = categoryBranches.concat(rootGroups);
    const branchMap = new Map();

    function indexBranch(branch) {
      branchMap.set(branch.branchKey, branch);
      for (const child of branch.children) {
        indexBranch(child);
      }
    }

    for (const branch of nodes) {
      indexBranch(branch);
    }

    return {
      totalCraftableItems: craftableItems.length,
      allItems: craftableItems,
      nodes,
      branchMap,
    };
  }

  function filterCatalogItems(graph, branch, query, limit = 60) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    const numericQuery = /^\d+$/.test(normalizedQuery) ? Number(normalizedQuery) : null;
    const allowedTypeIds = branch ? new Set(branch.itemTypeIDs || []) : null;
    const baseItems = getCraftableItems(graph).filter((item) => !allowedTypeIds || allowedTypeIds.has(item.typeID));
    const filtered = normalizedQuery
      ? baseItems.filter((item) => {
          const nameMatches = item.name.toLowerCase().includes(normalizedQuery);
          const typeMatches = numericQuery !== null && Number(item.typeID) === numericQuery;
          return nameMatches || typeMatches;
        })
      : baseItems;

    return sortSearchResults(filtered, normalizedQuery, numericQuery).slice(0, limit);
  }

  function searchCraftableItems(graph, query, limit = 25) {
    return filterCatalogItems(graph, null, query, limit);
  }

  function searchPlannerCatalog(graph, branchOrQuery, queryOrLimit, limit = 30) {
    if (!graph) {
      return [];
    }

    const hasBranchArgument =
      branchOrQuery !== null && typeof branchOrQuery === "object" && !Array.isArray(branchOrQuery);
    const branch = hasBranchArgument ? branchOrQuery : null;
    const query = hasBranchArgument ? queryOrLimit : branchOrQuery;
    const resolvedLimit =
      typeof queryOrLimit === "number" && !Number.isNaN(queryOrLimit)
        ? queryOrLimit
        : typeof limit === "number" && !Number.isNaN(limit)
          ? limit
          : 30;

    return filterCatalogItems(graph, branch, query, resolvedLimit);
  }

  function normalizePlannerLineQuantity(value) {
    const numericValue = Math.floor(Number(value) || 0);
    return Math.max(1, numericValue);
  }

  function getPlannerRecipeOptionsForType(typeId, recipeOptionsByType = {}, graph = null) {
    const mappedOptions = recipeOptionsByType?.[typeId] ?? recipeOptionsByType?.[String(typeId)];
    if (Array.isArray(mappedOptions) && mappedOptions.length) {
      return mappedOptions
        .filter((option) => option && Number.isFinite(Number(option.blueprintId)))
        .map((option) => ({
          blueprintId: Number(option.blueprintId),
          label: option.label || null,
          outputQuantity: Number(option.outputQuantity ?? option.output ?? 0) || null,
          runtime: Number(option.runtime ?? option.runTime ?? 0) || null,
          keyInputHint: option.keyInputHint || option.inputHint || null,
        }))
        .sort((left, right) => left.blueprintId - right.blueprintId);
    }

    const graphRecipeIds = graph?.recipesByOutput?.[typeId] ?? graph?.recipesByOutput?.[String(typeId)] ?? [];
    return graphRecipeIds
      .map((recipeId) => Number(recipeId))
      .filter((recipeId) => Number.isFinite(recipeId))
      .sort((left, right) => left - right)
      .map((recipeId) => ({ blueprintId: recipeId, label: null }));
  }

  function buildPlannerItemDescriptor(typeId, graph = null) {
    const item = getItem(graph, typeId);
    const name = item?.name ?? `Type ${typeId}`;

    return {
      typeId: Number(typeId),
      item,
      name,
      itemMarkup: renderItemMarkup(name, typeId),
      typeMeta: `Type ${typeId}`,
    };
  }

  function buildPlannerRecipeSummary(typeId, option = {}, graph = null) {
    if (option?.label) {
      return option.label;
    }

    const blueprintId = Number(option?.blueprintId);
    const recipe = Number.isFinite(blueprintId) ? getRecipe(graph, blueprintId) : null;
    if (recipe) {
      return buildRecipeOptionLabel(graph, recipe, typeId);
    }

    const outputQuantity = Math.max(1, Number(option?.outputQuantity) || 1);
    const runtime = Number(option?.runtime ?? option?.runTime) || 0;
    const keyInputHint = option?.keyInputHint || option?.inputHint || null;
    const summaryBits = [`out ${formatNumber(outputQuantity)}`, formatRuntime(runtime)];
    if (keyInputHint) {
      summaryBits.push(keyInputHint);
    }
    return summaryBits.join(" · ");
  }

  function buildPlannerLineViewModels({ planLines = [], recipeChoiceByType = {}, recipeOptionsByType = {}, graph = null }) {
    return (Array.isArray(planLines) ? planLines : []).map((line) => {
      const outputTypeId = Number(line.outputTypeId);
      const quantity = normalizePlannerLineQuantity(line.quantity);
      const itemDescriptor = buildPlannerItemDescriptor(outputTypeId, graph);
      const options = getPlannerRecipeOptionsForType(outputTypeId, recipeOptionsByType, graph);
      const selectedBlueprintId = Number(
        recipeChoiceByType?.[outputTypeId] ?? recipeChoiceByType?.[String(outputTypeId)] ?? options[0]?.blueprintId,
      );
      const selectedOption = options.find((option) => option.blueprintId === selectedBlueprintId) || options[0] || null;
      const selectedRecipeSummary = selectedOption ? buildPlannerRecipeSummary(outputTypeId, selectedOption, graph) : null;

      return {
        lineId: line.lineId,
        outputTypeId,
        quantity,
        itemName: itemDescriptor.name,
        itemMarkup: itemDescriptor.itemMarkup,
        typeMeta: itemDescriptor.typeMeta,
        selectedRecipeSummary,
        hasMultiRecipe: options.length > 1,
      };
    });
  }

  function renderPlannerLinesMarkup({ planLines = [], recipeChoiceByType = {}, recipeOptionsByType = {}, graph = null }) {
    const viewModels = buildPlannerLineViewModels({
      planLines,
      recipeChoiceByType,
      recipeOptionsByType,
      graph,
    });

    if (!viewModels.length) {
      return `<div class="planner-empty-state">No plan lines yet. Search and add a craftable item to begin.</div>`;
    }

    return viewModels
      .map(
        (line) => `
          <div class="planner-line-row" data-line-id="${line.lineId}">
            <div class="planner-line-main">
              <div class="planner-line-type">${line.itemMarkup}</div>
              <div class="planner-line-meta">${escapeHtml(line.typeMeta)}</div>
              ${
                line.selectedRecipeSummary
                  ? `<div class="planner-line-recipe">${escapeHtml(line.selectedRecipeSummary)}</div>`
                  : `<div class="planner-line-recipe planner-line-recipe-empty">No recipe selected</div>`
              }
            </div>
            <input type="number" min="1" step="1" value="${line.quantity}" data-planner-quantity-line-id="${line.lineId}" />
            <div class="planner-line-actions">
              ${line.hasMultiRecipe ? `<span class="planner-multi-recipe-badge">Multi</span>` : ""}
              <button type="button" class="mini-button" data-planner-remove-line-id="${line.lineId}">Remove</button>
            </div>
          </div>
        `,
      )
      .join("");
  }

  function buildPlannerRecipeOptionsByTypeFromGraph(graph) {
    const optionsByType = {};
    const recipesByOutput = graph?.recipesByOutput || {};

    for (const [typeIdKey, blueprintIds] of Object.entries(recipesByOutput)) {
      const typeId = Number(typeIdKey);
      if (!Number.isFinite(typeId) || !Array.isArray(blueprintIds)) {
        continue;
      }
      optionsByType[typeId] = blueprintIds
        .map((blueprintId) => Number(blueprintId))
        .filter((blueprintId) => Number.isFinite(blueprintId))
        .sort((left, right) => left - right)
        .map((blueprintId) => {
          const recipe = getRecipe(graph, blueprintId);
          const selectedOutput = recipe ? getRecipeOutputForType(recipe, typeId) : null;
          const keyInputHint = recipe?.inputs?.[0]
            ? `${getItem(graph, recipe.inputs[0].typeID)?.name ?? `Type ${recipe.inputs[0].typeID}`} x${formatNumber(
                recipe.inputs[0].quantity,
              )}`
            : null;

          return {
            blueprintId,
            outputQuantity: Math.max(1, Number(selectedOutput?.quantity) || 1),
            runtime: Number(recipe?.runTime) || 0,
            keyInputHint,
          };
        });
    }

    return optionsByType;
  }

  function toSortedPlannerRows(rows = []) {
    return (Array.isArray(rows) ? rows : [])
      .map((row) => ({
        typeId: Number(row?.typeId ?? row?.typeID),
        quantity: Number(row?.quantity),
      }))
      .filter((row) => Number.isFinite(row.typeId) && Number.isFinite(row.quantity))
      .sort((left, right) => left.typeId - right.typeId);
  }

  function getPlannerDecisionTypeIdSet(plannerResult = {}) {
    const typeIds = new Set();
    for (const decision of plannerResult?.decisions || []) {
      const typeId = Number(decision?.typeId);
      if (Number.isFinite(typeId)) {
        typeIds.add(typeId);
      }
    }
    return typeIds;
  }

  function renderPlannerOutputSectionMarkup({
    title,
    rows = [],
    emptyMessage,
    decisionTypeIds = new Set(),
    activeDecisionTypeId = null,
    graph = null,
  }) {
    const sortedRows = toSortedPlannerRows(rows);
    const bodyMarkup = sortedRows.length
      ? `
        <div class="planner-output-table">
          <div class="planner-output-row planner-output-row-head">
            <span>Item</span>
            <span>Quantity</span>
          </div>
          ${sortedRows
            .map((row) => {
              const itemDescriptor = buildPlannerItemDescriptor(row.typeId, graph);
              const isDecisionLinked = decisionTypeIds.has(row.typeId);
              const isActive = Number(activeDecisionTypeId) === row.typeId;
              const className = [
                "planner-output-row",
                isDecisionLinked ? "planner-output-row-link" : "",
                isActive ? "is-active-decision-link" : "",
              ]
                .filter(Boolean)
                .join(" ");
              const activationAttributes = isDecisionLinked
                ? `data-planner-focus-decision-type-id="${row.typeId}" tabindex="0" role="button" aria-controls="planner-decision-${row.typeId}" aria-label="Focus decision for ${escapeHtml(
                    itemDescriptor.name,
                  )}"`
                : "";

              return `
                <div class="${className}" data-planner-row-type-id="${row.typeId}" ${activationAttributes}>
                  <span class="planner-output-item">
                    ${itemDescriptor.itemMarkup}
                    <small>${escapeHtml(itemDescriptor.typeMeta)}</small>
                  </span>
                  <span>${row.quantity}</span>
                </div>
              `;
            })
            .join("")}
        </div>
      `
      : `<div class="planner-output-empty">${escapeHtml(emptyMessage)}</div>`;

    return `
      <section class="planner-output-section">
        <h3>${escapeHtml(title)}</h3>
        ${bodyMarkup}
      </section>
    `;
  }

  function renderPlannerAggregatedOutputMarkup(model = {}) {
    const planLines = model.planLines ?? model.plannerState?.planLines ?? [];
    const plannerResult = model.plannerResult || {};
    const hasPlanLines = Array.isArray(planLines) && planLines.length > 0;
    const noPlanMessage = "No plan lines yet.";
    const decisionTypeIds = getPlannerDecisionTypeIdSet(plannerResult);
    const activeDecisionTypeId = Number(model.plannerState?.uiState?.activeDecisionTypeId);
    const graph = model.graph || null;

    return {
      rawMaterialsMarkup: renderPlannerOutputSectionMarkup({
        title: "Raw Materials to Mine",
        rows: hasPlanLines ? plannerResult.rawMaterials || [] : [],
        emptyMessage: hasPlanLines ? "No raw materials required" : noPlanMessage,
        decisionTypeIds,
        activeDecisionTypeId,
        graph,
      }),
      componentsMarkup: renderPlannerOutputSectionMarkup({
        title: "Components to Produce",
        rows: hasPlanLines ? plannerResult.components || [] : [],
        emptyMessage: hasPlanLines ? "No components required" : noPlanMessage,
        decisionTypeIds,
        activeDecisionTypeId,
        graph,
      }),
    };
  }

  function buildPlannerDecisionOptionMetadata(option = {}, typeId, graph = null) {
    const blueprintId = Number(option?.blueprintId ?? option?.blueprintID);
    const recipe = Number.isFinite(blueprintId) ? getRecipe(graph, blueprintId) : null;
    const selectedOutput = recipe ? getRecipeOutputForType(recipe, typeId) : null;
    const outputQuantity = Math.max(1, Number(option?.outputQuantity ?? selectedOutput?.quantity) || 1);
    const runtime = Number(option?.runtime ?? option?.runTime ?? recipe?.runTime) || 0;
    const facilityTag = recipe ? getRecipeFacilityPrefixTag(graph, recipe) : "";
    const outputTypeId = Number(selectedOutput?.typeID ?? typeId);
    const outputItemName = getItem(graph, outputTypeId)?.name ?? `Type ${outputTypeId}`;
    const outputDescriptor = `${outputItemName} x${formatNumber(outputQuantity)}`;
    const inputDescriptor = Array.isArray(recipe?.inputs) && recipe.inputs.length
      ? recipe.inputs
          .map((input) => `${getItem(graph, input.typeID)?.name ?? `Type ${input.typeID}`} x${formatNumber(input.quantity)}`)
          .join(" + ")
      : option?.keyInputHint || option?.inputHint || null;

    return {
      blueprintId,
      outputQuantity,
      runtime,
      outputLabel: `${formatNumber(outputQuantity)} · ${formatRuntime(runtime)}`,
      facilityTag,
      outputDescriptor,
      inputDescriptor,
      label: `${facilityTag ? `${facilityTag} ` : ""}out ${formatNumber(outputQuantity)} · ${formatRuntime(runtime)} · ${outputDescriptor}`,
    };
  }

  function renderPlannerDecisionOptionMarkup({
    option = {},
    typeId,
    graph = null,
    currentBlueprintId = null,
    inputName = "",
    inputAttributes = "",
  } = {}) {
    const metadata = buildPlannerDecisionOptionMetadata(option, typeId, graph);
    const checked = metadata.blueprintId === Number(currentBlueprintId);

    return `
      <label class="planner-decision-option${checked ? " is-selected" : ""}">
        <input
          type="radio"
          name="${escapeHtml(inputName || `planner-decision-type-${typeId}`)}"
          value="${metadata.blueprintId}"
          ${inputAttributes}
          ${checked ? "checked" : ""}
        />
        <span class="planner-decision-option-main">
          <span class="planner-decision-option-title">${escapeHtml(metadata.label)}</span>
          <span class="planner-decision-option-details">
            <span class="planner-decision-option-detail">
              <span class="planner-decision-option-detail-label">OUTPUT</span>
              <span class="planner-decision-option-detail-value">${escapeHtml(metadata.outputLabel)}</span>
            </span>
            <span class="planner-decision-option-detail">
              <span class="planner-decision-option-detail-label">INPUT</span>
              <span class="planner-decision-option-detail-value planner-decision-option-hint">${escapeHtml(metadata.inputDescriptor || "No inputs")}</span>
            </span>
          </span>
        </span>
      </label>
    `;
  }

  function renderPlannerDecisionPanelMarkup(model = {}, graph = null) {
    const plannerResult = model.plannerResult || {};
    const plannerState = model.plannerState || {};
    const decisionSummary = plannerResult.decisionSummary || {
      totalMultiPathItems: 0,
      defaultCount: 0,
      overriddenCount: 0,
    };
    const decisions = Array.isArray(plannerResult.decisions) ? plannerResult.decisions : [];
    const activeDecisionTypeId = Number(plannerState.uiState?.activeDecisionTypeId);

    const summaryMarkup = `
      <section class="planner-decision-summary">
        <div class="planner-decision-summary-card">
          <span class="summary-key">Total ambiguous items</span>
          <strong class="planner-decision-summary-value">${formatNumber(decisionSummary.totalMultiPathItems || 0)}</strong>
        </div>
        <div class="planner-decision-summary-card">
          <span class="summary-key">Overridden</span>
          <strong class="planner-decision-summary-value">${formatNumber(decisionSummary.overriddenCount || 0)}</strong>
        </div>
        <div class="planner-decision-summary-card">
          <span class="summary-key">Default</span>
          <strong class="planner-decision-summary-value">${formatNumber(decisionSummary.defaultCount || 0)}</strong>
        </div>
      </section>
    `;

    if (!decisions.length) {
      return `${summaryMarkup}<div class="planner-empty-state">No decisions</div>`;
    }

    const groupsMarkup = decisions
      .map((decision) => {
        const typeId = Number(decision?.typeId);
        const itemDescriptor = buildPlannerItemDescriptor(typeId, graph);
        const currentBlueprintId = Number(decision?.currentRecipe?.blueprintId);
        const isActive = typeId === activeDecisionTypeId;
        const stateValue = decision?.decisionState === "overridden" ? "overridden" : "default";
        const options = Array.isArray(decision?.options) ? decision.options : [];

        return `
          <section data-planner-decision-type-id="${typeId}" id="planner-decision-${typeId}" class="planner-decision-group${
            isActive ? " is-active" : ""
          }" tabindex="-1">
            <div class="planner-decision-group-head">
              <div class="planner-decision-head-main">
                <div class="planner-decision-type-label">${itemDescriptor.itemMarkup}</div>
              </div>
              <span class="planner-decision-state-pill" data-state="${stateValue}">${escapeHtml(stateValue)}</span>
            </div>
            <div class="planner-decision-facts">
              <div class="planner-decision-fact">
                <span class="summary-key">Type</span>
                <strong class="planner-decision-fact-value">${escapeHtml(itemDescriptor.typeMeta)}</strong>
              </div>
              <div class="planner-decision-fact">
                <span class="summary-key">Recipe options</span>
                <strong class="planner-decision-fact-value">${formatNumber(options.length)}</strong>
              </div>
              <div class="planner-decision-fact planner-decision-meta">
                <span class="summary-key">State</span>
                <strong class="planner-decision-state" data-state="${stateValue}">${escapeHtml(stateValue)}</strong>
              </div>
            </div>
            <p class="planner-decision-scope-note">This choice applies to all occurrences of this item in the current plan.</p>
            <div class="planner-decision-options">
              ${options
                .map((option) =>
                  renderPlannerDecisionOptionMarkup({
                    option,
                    typeId,
                    graph,
                    currentBlueprintId,
                    inputName: `planner-decision-type-${typeId}`,
                    inputAttributes: `data-planner-decision-option-type-id="${typeId}" data-planner-decision-blueprint-id="${Number(
                      option?.blueprintId,
                    )}"`,
                  }),
                )
                .join("")}
            </div>
          </section>
        `;
      })
      .join("");

    return `${summaryMarkup}<div class="planner-decision-groups">${groupsMarkup}</div>`;
  }

  function buildManagedDefaultWorkspaceDetailMarkup(preset, graph) {
    return buildManagedDefaultDetailMarkup(preset, graph, {
      interactionId: "managed-default-workspace",
      optionTypeDataAttribute: "data-managed-default-workspace-option-type-id",
      optionRootDataAttribute: "data-managed-default-workspace-option-root-key",
      scopeNote: "Applies to current filtered recipe path.",
      stateDetailLabel: preset?.isCustomized ? "overridden" : "default",
      emptyMessage: "Choose a material on the left to edit its default recipe path.",
    });
  }

  function renderManagedDefaultRecipeWorkspaceMarkup(graph, presets = [], state = {}) {
    if (!graph) {
      return `<div class="default-recipe-empty">Load data to configure default recipe paths.</div>`;
    }

    if (!Number.isFinite(toNumber(state.selectedTypeID))) {
      return `<div class="default-recipe-empty">Select a target to filter managed defaults for the active recipe.</div>`;
    }

    const recipeSelections = state.recipeSelections || {};
    const visiblePresets = filterManagedDefaultRecipePresetsForSelection(
      graph,
      presets,
      state.selectedTypeID,
      recipeSelections,
    );

    if (!visiblePresets.length) {
      return `<div class="default-recipe-empty">This recipe path does not use any managed default materials.</div>`;
    }

    const activeRootKey = visiblePresets.some((preset) => preset.key === state.activeRootKey)
      ? state.activeRootKey
      : visiblePresets[0]?.key ?? null;
    const activePreset = visiblePresets.find((preset) => preset.key === activeRootKey) ?? visiblePresets[0] ?? null;
    const customizedCount = visiblePresets.filter((preset) => preset.isCustomized).length;

    return `
      <div class="default-recipe-shell default-recipe-workspace-shell">
        <section class="planner-decision-summary default-recipe-summary">
          <div class="planner-decision-summary-card">
            <span class="summary-key">Visible managed</span>
            <strong class="planner-decision-summary-value">${formatNumber(visiblePresets.length)}</strong>
          </div>
          <div class="planner-decision-summary-card">
            <span class="summary-key">Customized</span>
            <strong class="planner-decision-summary-value">${formatNumber(customizedCount)}</strong>
          </div>
          <div class="planner-decision-summary-card">
            <span class="summary-key">Default</span>
            <strong class="planner-decision-summary-value">${formatNumber(visiblePresets.length - customizedCount)}</strong>
          </div>
        </section>
        <div class="default-recipe-layout default-recipe-workspace-layout">
          <section class="default-recipe-list default-recipe-workspace-list">
            ${visiblePresets
              .map((preset) =>
                buildManagedDefaultSelectionCardMarkup(preset, graph, {
                  isActive: preset.key === activeRootKey,
                  rootSelectDataAttribute: "data-managed-default-workspace-root-select-key",
                }),
              )
              .join("")}
          </section>
          <section class="default-recipe-detail">
            ${buildManagedDefaultWorkspaceDetailMarkup(activePreset, graph)}
          </section>
        </div>
      </div>
    `;
  }

  function focusPlannerDecisionFromOutput(plannerRuntime, typeId) {
    if (!plannerRuntime || typeof plannerRuntime.focusDecision !== "function") {
      return false;
    }

    return plannerRuntime.focusDecision(typeId);
  }

  function getEventTargetElement(event) {
    const target = event?.target ?? null;
    if (!target) {
      return null;
    }
    if (typeof target.closest === "function") {
      return target;
    }
    if (target.parentElement && typeof target.parentElement.closest === "function") {
      return target.parentElement;
    }
    return null;
  }

  function createInputLine(graph, node, runsNeeded) {
    const item = getItem(graph, node.typeID);
    return {
      typeID: node.typeID,
      name: item?.name ?? `Type ${node.typeID}`,
      quantityPerRun: node.quantity,
      requiredQuantity: node.quantity * runsNeeded,
    };
  }

  function createOutputLine(graph, node, runsNeeded) {
    const item = getItem(graph, node.typeID);
    return {
      typeID: node.typeID,
      name: item?.name ?? `Type ${node.typeID}`,
      quantityPerRun: node.quantity,
      totalQuantity: node.quantity * runsNeeded,
    };
  }

  function createRecipeSummary(graph, typeID, requestedQuantity = 1, recipeSelections = {}) {
    const item = getItem(graph, typeID);
    if (!item) {
      throw new Error(`Unknown item typeID: ${typeID}`);
    }

    const recipe = resolveRecipeChoice(graph, typeID, recipeSelections);
    if (!recipe) {
      throw new Error(`No recipe found for typeID: ${typeID}`);
    }

    const selectedOutput = getRecipeOutputForType(recipe, typeID);
    if (!selectedOutput) {
      throw new Error(`Recipe ${recipe.blueprintID} has no output for typeID: ${typeID}`);
    }

    const normalizedQuantity = normalizeQuantity(requestedQuantity);
    const outputPerRun = Math.max(1, Number(selectedOutput.quantity) || 1);
    const runsNeeded = Math.ceil(normalizedQuantity / outputPerRun);
    const producedQuantity = outputPerRun * runsNeeded;

    return {
      item,
      recipe,
      requestedQuantity: normalizedQuantity,
      selectedOutput,
      outputPerRun,
      runsNeeded,
      producedQuantity,
      totalRuntime: (Number(recipe.runTime) || 0) * runsNeeded,
      availableRecipes: getAvailableRecipesForType(graph, typeID),
      inputs: recipe.inputs.map((node) => createInputLine(graph, node, runsNeeded)),
      outputs: recipe.outputs.map((node) => createOutputLine(graph, node, runsNeeded)),
    };
  }

  function buildDependencyTree(
    graph,
    typeID,
    requestedQuantity = 1,
    recipeSelections = {},
    traversalState = {},
  ) {
    const item = getItem(graph, typeID);
    if (!item) {
      throw new Error(`Unknown item typeID: ${typeID}`);
    }

    const path = traversalState.path ?? "root";
    const depth = traversalState.depth ?? 0;
    const nodeId = traversalState.nodeId ?? `${path}:${typeID}`;
    const baseMaterials = traversalState.baseMaterials ?? new Set(graph?.baseMaterials ?? []);
    const ancestry = traversalState.ancestry ?? new Set();
    const normalizedQuantity = normalizeQuantity(requestedQuantity);
    const availableRecipes = getAvailableRecipesForType(graph, typeID);
    const recipe = resolveRecipeChoice(graph, typeID, recipeSelections);

    if (ancestry.has(Number(typeID))) {
      return {
        nodeId,
        typeID: Number(typeID),
        item,
        requestedQuantity: normalizedQuantity,
        recipe,
        availableRecipes,
        runsNeeded: 0,
        producedQuantity: normalizedQuantity,
        selectedOutput: null,
        inputs: [],
        outputs: [],
        children: [],
        depth,
        isBaseMaterial: false,
        cycleDetected: true,
      };
    }

    if (!recipe) {
      return {
        nodeId,
        typeID: Number(typeID),
        item,
        requestedQuantity: normalizedQuantity,
        recipe: null,
        availableRecipes: [],
        runsNeeded: 0,
        producedQuantity: normalizedQuantity,
        selectedOutput: null,
        inputs: [],
        outputs: [],
        children: [],
        depth,
        isBaseMaterial: baseMaterials.has(Number(typeID)) || Boolean(item.isBaseMaterial) || !item.isCraftable,
        cycleDetected: false,
      };
    }

    const selectedOutput = getRecipeOutputForType(recipe, typeID);
    const outputPerRun = Math.max(1, Number(selectedOutput?.quantity) || 1);
    const runsNeeded = Math.ceil(normalizedQuantity / outputPerRun);
    const producedQuantity = outputPerRun * runsNeeded;
    const inputs = recipe.inputs.map((node) => createInputLine(graph, node, runsNeeded));
    const outputs = recipe.outputs.map((node) => createOutputLine(graph, node, runsNeeded));

    const nextAncestry = new Set(ancestry);
    nextAncestry.add(Number(typeID));
    const children = inputs.map((input, index) =>
      buildDependencyTree(graph, input.typeID, input.requiredQuantity, recipeSelections, {
        path: `${nodeId}.${index}`,
        depth: depth + 1,
        nodeId: `${nodeId}.${index}:${input.typeID}`,
        baseMaterials,
        ancestry: nextAncestry,
      }),
    );

    return {
      nodeId,
      typeID: Number(typeID),
      item,
      requestedQuantity: normalizedQuantity,
      recipe,
      availableRecipes,
      runsNeeded,
      producedQuantity,
      selectedOutput,
      inputs,
      outputs,
      children,
      depth,
      isBaseMaterial: baseMaterials.has(Number(typeID)) || Boolean(item.isBaseMaterial),
      cycleDetected: false,
    };
  }

  function buildPlannerDependencyNode(
    graph,
    typeID,
    requestedQuantity = 1,
    resolveRecipeFn = () => null,
    traversalState = {},
  ) {
    if (!graph) {
      return null;
    }

    const item = getItem(graph, typeID);
    if (!item) {
      return null;
    }

    const normalizedQuantity = normalizeQuantity(requestedQuantity);
    const baseMaterials = traversalState.baseMaterials ?? new Set(graph?.baseMaterials ?? []);
    const ancestry = traversalState.ancestry ?? new Set();
    const numericTypeID = Number(typeID);

    if (ancestry.has(numericTypeID)) {
      return {
        typeID: numericTypeID,
        quantity: normalizedQuantity,
        runs: 0,
        isBaseMaterial: false,
        recipe: null,
        runtime: 0,
        mass: (Number(item.mass) || 0) * normalizedQuantity,
        volume: (Number(item.volume) || 0) * normalizedQuantity,
        children: [],
        cycleDetected: true,
      };
    }

    const selectedRecipeMeta = typeof resolveRecipeFn === "function" ? resolveRecipeFn(numericTypeID) : null;
    const selectedBlueprintId = Number(selectedRecipeMeta?.blueprintId);
    const recipe = Number.isFinite(selectedBlueprintId)
      ? getRecipe(graph, selectedBlueprintId)
      : resolveRecipeChoice(graph, numericTypeID, {});
    const isBaseMaterial = baseMaterials.has(numericTypeID) || Boolean(item.isBaseMaterial) || !item.isCraftable;

    if (!recipe) {
      return {
        typeID: numericTypeID,
        quantity: normalizedQuantity,
        runs: 0,
        isBaseMaterial,
        recipe: null,
        runtime: 0,
        mass: (Number(item.mass) || 0) * normalizedQuantity,
        volume: (Number(item.volume) || 0) * normalizedQuantity,
        children: [],
        cycleDetected: false,
      };
    }

    const selectedOutput = getRecipeOutputForType(recipe, numericTypeID);
    const outputPerRun = Math.max(1, Number(selectedOutput?.quantity) || 1);
    const runs = Math.ceil(normalizedQuantity / outputPerRun);
    const nextAncestry = new Set(ancestry);
    nextAncestry.add(numericTypeID);
    const children = (recipe.inputs || [])
      .map((input) =>
        buildPlannerDependencyNode(
          graph,
          input.typeID,
          (Number(input.quantity) || 0) * runs,
          resolveRecipeFn,
          {
            baseMaterials,
            ancestry: nextAncestry,
          },
        ),
      )
      .filter(Boolean);

    return {
      typeID: numericTypeID,
      quantity: normalizedQuantity,
      runs,
      isBaseMaterial,
      recipe,
      runtime: (Number(recipe.runTime) || 0) * runs,
      mass: (Number(item.mass) || 0) * normalizedQuantity,
      volume: (Number(item.volume) || 0) * normalizedQuantity,
      children,
      cycleDetected: false,
    };
  }

  function createAggregateLine(item, quantity) {
    const safeQuantity = Number(quantity) || 0;
    const mass = (Number(item?.mass) || 0) * safeQuantity;
    const volume = (Number(item?.volume) || 0) * safeQuantity;

    return {
      typeID: Number(item?.typeID),
      name: item?.name ?? `Type ${item?.typeID}`,
      quantity: safeQuantity,
      mass,
      volume,
    };
  }

  function upsertAggregate(map, item, quantity) {
    const key = Number(item?.typeID);
    const nextLine = createAggregateLine(item, quantity);

    if (!map.has(key)) {
      map.set(key, nextLine);
      return;
    }

    const current = map.get(key);
    current.quantity += nextLine.quantity;
    current.mass += nextLine.mass;
    current.volume += nextLine.volume;
  }

  function sortedAggregateValues(map) {
    return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name));
  }

  function rollupDependencyTree(tree) {
    const directComponents = new Map();
    const craftedComponents = new Map();
    const baseMaterials = new Map();
    let totalRuntime = 0;

    for (const child of tree.children || []) {
      if (!child.isBaseMaterial) {
        upsertAggregate(directComponents, child.item, child.requestedQuantity);
      }
    }

    function visit(node, isRoot = false) {
      if (node.recipe) {
        totalRuntime += (Number(node.recipe.runTime) || 0) * (Number(node.runsNeeded) || 0);
      }

      if (!isRoot) {
        if (node.cycleDetected) {
          upsertAggregate(craftedComponents, node.item, node.requestedQuantity);
        } else if (node.children.length && !node.isBaseMaterial) {
          upsertAggregate(craftedComponents, node.item, node.requestedQuantity);
        } else {
          upsertAggregate(baseMaterials, node.item, node.requestedQuantity);
        }
      }

      for (const child of node.children) {
        visit(child, false);
      }
    }

    visit(tree, true);

    const baseMaterialLines = sortedAggregateValues(baseMaterials);
    return {
      directComponents: sortedAggregateValues(directComponents),
      craftedComponents: sortedAggregateValues(craftedComponents),
      baseMaterials: baseMaterialLines,
      totalRuntime,
      totalMass: baseMaterialLines.reduce((sum, line) => sum + line.mass, 0),
      totalVolume: baseMaterialLines.reduce((sum, line) => sum + line.volume, 0),
    };
  }

  function getProgressStatus(line) {
    const need = Math.max(0, Number(line?.need) || 0);
    const have = Math.max(0, Number(line?.have) || 0);
    if (!need || have <= 0) {
      return "missing";
    }
    if (have >= need) {
      return "ready";
    }
    return "partial";
  }

  function createProgressLine(line, progressMap = {}) {
    const need = Math.max(0, Number(line?.quantity) || 0);
    const have = normalizeProgressValue(progressMap?.[line.typeID] ?? progressMap?.[String(line.typeID)] ?? 0);
    const remaining = Math.max(0, need - have);
    const progressPercent = need > 0 ? Math.min(100, Number(((have / need) * 100).toFixed(2))) : 100;

    return {
      typeID: Number(line.typeID),
      name: line.name,
      need,
      have,
      remaining,
      progressPercent,
      mass: Number(line.mass) || 0,
      volume: Number(line.volume) || 0,
      status: getProgressStatus({ need, have }),
    };
  }

  function buildDynamicBaseMaterials(rollup, progressMap = {}, options = {}) {
    const graph = options?.graph || null;
    const tree = options?.tree || null;
    const recipeSelections = options?.recipeSelections || {};
    if (!graph || !tree) {
      return rollup?.baseMaterials || [];
    }

    const baseMaterials = new Map();

    for (const child of tree.children || []) {
      if (child?.isBaseMaterial) {
        upsertAggregate(baseMaterials, child.item, child.requestedQuantity);
      }
    }

    for (const componentLine of rollup?.directComponents || []) {
      const typeID = Number(componentLine?.typeID);
      const need = Math.max(0, Number(componentLine?.quantity) || 0);
      const have = normalizeProgressValue(progressMap?.[typeID] ?? progressMap?.[String(typeID)] ?? 0);
      const remaining = Math.max(0, need - have);
      if (!remaining) {
        continue;
      }

      const componentTree = buildDependencyTree(graph, typeID, remaining, recipeSelections);
      const componentRollup = rollupDependencyTree(componentTree);
      for (const baseLine of componentRollup.baseMaterials || []) {
        const item =
          getItem(graph, baseLine.typeID) ||
          ({
            typeID: baseLine.typeID,
            name: baseLine.name,
            mass: (Number(baseLine.quantity) || 0) > 0 ? Number(baseLine.mass || 0) / Number(baseLine.quantity) : 0,
            volume: (Number(baseLine.quantity) || 0) > 0 ? Number(baseLine.volume || 0) / Number(baseLine.quantity) : 0,
          });
        upsertAggregate(baseMaterials, item, baseLine.quantity);
      }
    }

    return sortedAggregateValues(baseMaterials);
  }

  function buildProgressSections(rollup, progressMap = {}, options = {}) {
    const directComponents = (rollup?.directComponents || []).map((line) => createProgressLine(line, progressMap));
    const dynamicBaseMaterials = buildDynamicBaseMaterials(rollup, progressMap, options);
    const baseMaterials = dynamicBaseMaterials.map((line) => createProgressLine(line, progressMap));

    return {
      directComponents,
      baseMaterials,
      allLines: directComponents.concat(baseMaterials),
    };
  }

  function buildProgressLookup(progressSections) {
    const lookup = new Map();
    for (const line of progressSections?.allLines || []) {
      lookup.set(Number(line.typeID), line);
    }
    return lookup;
  }

  function sortOutstandingLines(lines = [], options = {}) {
    const shouldIncludeCompleted = Boolean(options.includeCompleted);
    return (Array.isArray(lines) ? lines : [])
      .filter((line) => shouldIncludeCompleted || Number(line?.remaining) > 0)
      .slice()
      .sort((left, right) => {
        const remainingDiff = Number(right?.remaining || 0) - Number(left?.remaining || 0);
        if (remainingDiff !== 0) {
          return remainingDiff;
        }
        return String(left?.name || "").localeCompare(String(right?.name || ""));
      });
  }

  function sortProgressListLines(lines = [], options = {}) {
    const shouldIncludeCompleted = options.includeCompleted !== false;
    return (Array.isArray(lines) ? lines : [])
      .filter((line) => shouldIncludeCompleted || Number(line?.remaining) > 0)
      .slice()
      .sort((left, right) => {
        const needDiff = Number(right?.need || 0) - Number(left?.need || 0);
        if (needDiff !== 0) {
          return needDiff;
        }
        return String(left?.name || "").localeCompare(String(right?.name || ""));
      });
  }

  function buildNextActions(progressSections = {}) {
    const actions = [];
    const topMaterial = sortOutstandingLines(progressSections?.baseMaterials || [])[0];
    const topComponent = sortOutstandingLines(progressSections?.directComponents || [])[0];

    if (topMaterial) {
      actions.push({
        kind: "mine",
        typeID: Number(topMaterial.typeID),
        name: topMaterial.name,
        remaining: Number(topMaterial.remaining) || 0,
      });
    }

    if (topComponent) {
      actions.push({
        kind: "produce",
        typeID: Number(topComponent.typeID),
        name: topComponent.name,
        remaining: Number(topComponent.remaining) || 0,
      });
    }

    return actions;
  }

  function getBottleneckLine(progressSections = {}) {
    return sortOutstandingLines([
      ...(progressSections?.baseMaterials || []),
      ...(progressSections?.directComponents || []),
    ])[0] || null;
  }

  function summarizeWorkspaceHeader({ currentSummary = null, currentProgressSections = null, currentRollup = null } = {}) {
    const trackedLines = currentProgressSections?.allLines || [];
    const totals = trackedLines.reduce(
      (summary, line) => {
        summary.need += Math.max(0, Number(line?.need) || 0);
        summary.have += Math.max(0, Number(line?.have) || 0);
        return summary;
      },
      { need: 0, have: 0 },
    );
    const progressPercent = totals.need > 0
      ? Math.round(Math.min(100, (totals.have / totals.need) * 100))
      : 0;

    return {
      targetName: currentSummary?.item?.name || "No target selected",
      progressPercent,
      etaLabel: currentSummary ? formatRuntime(currentRollup?.totalRuntime ?? currentSummary.totalRuntime ?? 0) : "--",
    };
  }

  function renderActionCardsMarkup(actions = []) {
    if (!actions.length) {
      return `<p class="workspace-empty">Choose a target to surface immediate work.</p>`;
    }

    return actions
      .map((action) => `
        <article class="action-card" data-kind="${escapeHtml(action.kind)}">
          <span class="action-kicker">${action.kind === "mine" ? "Mine" : "Produce"}</span>
          <div class="action-title">${escapeHtml(action.name)}</div>
          <div class="action-meta">${formatNumber(action.remaining)} remaining</div>
        </article>
      `)
      .join("");
  }

  function renderBottleneckMarkup(line) {
    if (!line) {
      return `<p class="workspace-empty">No bottleneck yet.</p>`;
    }

    return `
      <article class="bottleneck-card">
        <span class="action-kicker">Most Constrained</span>
        <div class="bottleneck-title">${escapeHtml(line.name)}</div>
        <div class="bottleneck-meta">${formatNumber(line.remaining)} left · ${formatNumber(line.progressPercent || 0)}% tracked</div>
      </article>
    `;
  }

  function renderCompactProgressListMarkup(title, lines = [], options = {}) {
    const sortedLines = sortProgressListLines(lines, {
      includeCompleted: true,
    });
    const expanded = Boolean(options?.expanded);
    const visibleLines = expanded ? sortedLines : sortedLines.slice(0, 5);

    if (!sortedLines.length) {
      return `<div class="progress-list"><p class="workspace-empty">${escapeHtml(options?.emptyMessage || `No items in ${title}`)}</p></div>`;
    }

    const rowsMarkup = visibleLines
      .map((line) => `
        <article class="progress-list-row progress-list-row-compact" data-progress-line-type-id="${line.typeID}">
          <div class="progress-list-main">
            <div class="progress-list-copy">
              <div class="progress-list-name">${renderItemMarkup(line.name, line.typeID)}</div>
            </div>
            <div class="progress-list-stats">
              <span>Need ${formatNumber(line.need)}</span>
              <span>${escapeHtml(String(options?.doneLabel || "done")).replace(/^./, (value) => value.toUpperCase())} ${formatNumber(line.have)}</span>
            </div>
            <div class="progress-track" aria-hidden="true">
              <span class="progress-track-fill" style="width:${Math.max(0, Math.min(100, Number(line.progressPercent) || 0))}%"></span>
            </div>
          </div>
          <div class="progress-list-side">
            <div class="progress-list-amount">${formatNumber(line.remaining)} left</div>
            ${options?.interactive
              ? `
              <div class="progress-list-controls progress-list-controls-compact">
                <label class="progress-inline-field">
                  <span class="field-label">${escapeHtml(options?.doneLabel || "done")}</span>
                  <input
                    class="number-input progress-inline-input"
                    type="number"
                    min="0"
                    step="any"
                    value="${Number(line.have) || 0}"
                    aria-label="${escapeHtml(options?.doneLabel || "done")} ${escapeHtml(line.name)}"
                    data-progress-have-type-id="${line.typeID}"
                  />
                </label>
                <label class="progress-inline-check progress-done-pill">
                  <input
                    type="checkbox"
                    aria-label="Complete ${escapeHtml(line.name)}"
                    data-progress-complete-type-id="${line.typeID}"
                    ${line.status === "ready" ? "checked" : ""}
                  />
                  <span>Done</span>
                </label>
              </div>
            `
              : ""}
          </div>
        </article>
      `)
      .join("");

    const footerMarkup = sortedLines.length > 5
      ? `
        <div class="progress-list-footer">
          <span class="progress-list-count">${formatNumber(visibleLines.length)} items shown</span>
          <button type="button" class="mini-button" data-progress-list-toggle="${escapeHtml(options?.listKey || "")}">
            ${expanded ? "Show less" : "Show all"}
          </button>
        </div>
      `
      : "";

    return `
      <div class="progress-list">
        <div class="progress-list-body">${rowsMarkup}</div>
        ${footerMarkup}
      </div>
    `;
  }

  function aggregatePipelineEntries(targetList, node) {
    const safeTypeID = Number(node?.typeID);
    if (!Number.isFinite(safeTypeID)) {
      return;
    }

    const existing = targetList.get(safeTypeID) || {
      typeID: safeTypeID,
      name: node?.item?.name || `Type ${safeTypeID}`,
      quantity: 0,
    };
    existing.quantity += Math.max(0, Number(node?.requestedQuantity) || 0);
    targetList.set(safeTypeID, existing);
  }

  function finalizePipelineEntries(map) {
    return Array.from(map.values()).sort((left, right) => String(left.name).localeCompare(String(right.name)));
  }

  function buildDependencyPipelineGroups(tree) {
    const mining = new Map();
    const processing = new Map();
    const assembly = new Map();
    const final = new Map();

    if (!tree) {
      return {
        mining: [],
        processing: [],
        assembly: [],
        final: [],
      };
    }

    aggregatePipelineEntries(final, tree);

    for (const child of tree.children || []) {
      if (child?.isBaseMaterial) {
        aggregatePipelineEntries(mining, child);
      } else {
        aggregatePipelineEntries(assembly, child);
      }

      function visitDescendants(node) {
        for (const descendant of node.children || []) {
          if (descendant?.isBaseMaterial) {
            aggregatePipelineEntries(mining, descendant);
          } else {
            aggregatePipelineEntries(processing, descendant);
          }
          visitDescendants(descendant);
        }
      }

      visitDescendants(child);
    }

    return {
      mining: finalizePipelineEntries(mining),
      processing: finalizePipelineEntries(processing),
      assembly: finalizePipelineEntries(assembly),
      final: finalizePipelineEntries(final),
    };
  }

  function renderDependencyPipelineMarkup(tree) {
    const groups = buildDependencyPipelineGroups(tree);
    const steps = [
      { key: "mining", label: "Step 1: Mining", note: "Base materials and raw extraction." },
      { key: "processing", label: "Step 2: Processing", note: "Intermediate refinement and conversion." },
      { key: "assembly", label: "Step 3: Assembly", note: "Direct crafted parts for the target." },
      { key: "final", label: "Step 4: Final", note: "Final output delivery." },
    ];

    return `
      <div class="pipeline-grid">
        ${steps
          .map((step) => `
            <section class="pipeline-step">
              <div class="pipeline-step-header">
                <span class="pipeline-step-kicker">${escapeHtml(step.label)}</span>
                <h3>${escapeHtml(step.label.replace(/^Step \d+:\s*/, ""))}</h3>
                <p class="pipeline-step-note">${escapeHtml(step.note)}</p>
              </div>
              ${groups[step.key].length
                ? `
                  <ol class="pipeline-list">
                    ${groups[step.key]
                      .map((entry) => `
                        <li class="pipeline-item">
                          <span>${renderItemMarkup(entry.name, entry.typeID)}</span>
                          <span class="pipeline-item-qty">${formatNumber(entry.quantity)}</span>
                        </li>
                      `)
                      .join("")}
                  </ol>
                `
                : `<p class="workspace-empty">No items in this stage.</p>`}
            </section>
          `)
          .join("")}
      </div>
    `;
  }

  function createCalculatorWorkspaceState() {
    return {
      activeWorkspaceTab: "plan",
      openDrawer: null,
      isUploadModalOpen: false,
      expandedLists: {
        materials: false,
        components: false,
      },
    };
  }

  function reduceCalculatorWorkspaceState(currentState = createCalculatorWorkspaceState(), action = {}) {
    const state = {
      ...currentState,
      expandedLists: {
        ...currentState.expandedLists,
      },
    };

    switch (action.type) {
      case "set-workspace-tab":
        if (
          action.tab === "plan" ||
          action.tab === "pipeline" ||
          action.tab === "tree" ||
          action.tab === "default-recipes"
        ) {
          state.activeWorkspaceTab = action.tab;
        }
        return state;
      case "toggle-drawer":
        state.openDrawer = state.openDrawer === action.drawer ? null : action.drawer || null;
        return state;
      case "toggle-upload-modal":
        state.isUploadModalOpen = typeof action.open === "boolean" ? action.open : !state.isUploadModalOpen;
        return state;
      case "toggle-list":
        if (action.listKey && Object.prototype.hasOwnProperty.call(state.expandedLists, action.listKey)) {
          state.expandedLists[action.listKey] = !state.expandedLists[action.listKey];
        }
        return state;
      case "close-overlays":
        state.openDrawer = null;
        state.isUploadModalOpen = false;
        return state;
      default:
        return state;
    }
  }

  function serializeRecipeSelections(recipeSelections = {}) {
    return Object.entries(recipeSelections)
      .map(([typeID, recipeID]) => [Number(typeID), Number(recipeID)])
      .filter(([typeID, recipeID]) => Number.isFinite(typeID) && Number.isFinite(recipeID))
      .sort((left, right) => left[0] - right[0])
      .map(([typeID, recipeID]) => `${typeID}:${recipeID}`)
      .join(",");
  }

  function buildPlanStorageKey({ graph, selectedTypeID, requestedQuantity, recipeSelections }) {
    if (!graph || !selectedTypeID) {
      return null;
    }

    const snapshot = graph.meta?.snapshot || "unknown";
    const normalizedSelections = serializeRecipeSelections(recipeSelections);
    return [
      "frontier-industry-calculator:plan",
      snapshot,
      Number(selectedTypeID),
      normalizeQuantity(requestedQuantity),
      normalizedSelections || "default",
    ].join(":");
  }

  function buildRecipeOptionLabel(graph, recipe, typeID) {
    if (!recipe) {
      return "";
    }

    const selectedOutput = getRecipeOutputForType(recipe, typeID);
    const outputQuantity = Math.max(1, Number(selectedOutput?.quantity) || 1);
    const runtime = formatRuntime(recipe.runTime || 0);
    const keyInput = recipe.inputs?.[0]
      ? `${getItem(graph, recipe.inputs[0].typeID)?.name ?? `Type ${recipe.inputs[0].typeID}`} x${formatNumber(recipe.inputs[0].quantity)}`
      : "No inputs";
    const prefixTag = getRecipeFacilityPrefixTag(graph, recipe);
    return `${prefixTag ? `${prefixTag} ` : ""}out ${formatNumber(outputQuantity)} · ${runtime} · ${keyInput}`;
  }

  function buildRecipeChoiceSummary(recipe, typeID, graph = null) {
    if (!recipe) {
      return "Base";
    }

    const selectedOutput = getRecipeOutputForType(recipe, typeID);
    const outputQuantity = Math.max(1, Number(selectedOutput?.quantity) || 1);
    const prefixTag = getRecipeFacilityPrefixTag(graph, recipe);
    return `${prefixTag ? `${prefixTag} ` : ""}out ${formatNumber(outputQuantity)} · ${formatRuntime(
      recipe.runTime || 0,
    )}`;
  }

  function renderSelectedTargetMarkup(summary) {
    if (!summary) {
      return `
        <span class="meta-label">Selected</span>
        <strong>No target selected</strong>
      `;
    }

    const recipeCount = summary.availableRecipes?.length || 0;
    const recipeBadge = recipeCount > 1 ? `<span>${recipeCount} recipes</span>` : "";

    return `
      <span class="meta-label">Selected</span>
      <strong>${renderItemMarkup(summary.item.name, summary.item.typeID)}</strong>
      <div class="selected-item-meta">
        <span>typeID ${summary.item.typeID}</span>
        ${recipeBadge}
      </div>
    `;
  }

  function normalizeProgressMap(progressMap) {
    const normalized = {};
    for (const [typeID, value] of Object.entries(progressMap || {})) {
      const safeTypeID = Number(typeID);
      const safeValue = normalizeProgressValue(value);
      if (!Number.isFinite(safeTypeID) || safeValue <= 0) {
        continue;
      }
      normalized[safeTypeID] = safeValue;
    }
    return normalized;
  }

  function loadStoredPlanProgress(storage, key) {
    if (!storage || !key) {
      return {};
    }

    try {
      const payload = storage.getItem(key);
      if (!payload) {
        return {};
      }
      return normalizeProgressMap(JSON.parse(payload));
    } catch (_error) {
      return {};
    }
  }

  function saveStoredPlanProgress(storage, key, progressMap) {
    if (!storage || !key) {
      return;
    }

    try {
      storage.setItem(key, JSON.stringify(normalizeProgressMap(progressMap)));
    } catch (_error) {
      // ignore storage failures for static local mode
    }
  }

  function updateProgressInputValue({
    state,
    typeID,
    value,
    refreshProgressState,
    persistCurrentPlanProgress,
    renderActiveTargetCard,
    renderTree,
  }) {
    // Keep the live input stable while typing; re-rendering the progress table here
    // would replace the active <input> and drop the user's cursor after each keypress.
    state.progressByTypeID[typeID] = normalizeProgressValue(value);
    refreshProgressState();
    persistCurrentPlanProgress();
    renderActiveTargetCard();
    renderTree();
  }

  function shouldDataSectionBeOpen(graph) {
    return !graph;
  }

  function renderProgressTableMarkup(title, lines, doneLabel) {
    const safeDoneLabel = escapeHtml(doneLabel || "done");
    const rows = lines.length
      ? lines
          .map(
            (line) => `
              <tr class="progress-row" data-status="${line.status}">
                <td class="item-cell">${renderItemMarkup(line.name, line.typeID)}</td>
                <td>${formatNumber(line.need)}</td>
                <td>
                  <input
                    class="progress-input"
                    type="number"
                    min="0"
                    step="any"
                    value="${line.have}"
                    aria-label="${safeDoneLabel} ${escapeHtml(line.name)}"
                    data-progress-have-type-id="${line.typeID}"
                  />
                </td>
                <td>${formatNumber(line.remaining)}</td>
                <td>
                  <div class="progress-bar">
                    <span class="progress-bar-fill status-${line.status}" style="width: ${line.progressPercent}%"></span>
                  </div>
                </td>
                <td>
                  <input
                    class="quick-complete"
                    type="checkbox"
                    aria-label="Complete ${escapeHtml(line.name)}"
                    data-progress-complete-type-id="${line.typeID}"
                    ${line.status === "ready" ? "checked" : ""}
                  />
                </td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr class="progress-row progress-empty-row">
            <td colspan="6">${escapeHtml(`No lines in ${title}`)}</td>
          </tr>
        `;

    return `
      <table class="progress-table" aria-label="${escapeHtml(title)}">
        <thead>
          <tr>
            <th>Item</th>
            <th>Need</th>
            <th>${safeDoneLabel}</th>
            <th>Remain</th>
            <th>Progress</th>
            <th>Done</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  function renderDependencyOutlineMarkup(tree, progressLookup = new Map(), options = {}) {
    if (!tree) {
      return `<div class="outline-empty">No dependency outline available.</div>`;
    }

    const {
      hideCovered = false,
      maxDepth = null,
      showRecipeDetails = false,
      showTrackedStatus = true,
      activeRecipeChooserTypeID = null,
      graph = null,
      expandedNodeIds = new Set(),
      interactionScope = "outline",
      interactionRootKey = "",
    } = options;
    const rowToggleNodeAttribute = `data-${interactionScope}-row-toggle-node-id`;
    const recipeToggleAttribute = `data-${interactionScope}-recipe-toggle-type-id`;
    const recipeSelectAttribute = `data-${interactionScope}-recipe-type-id`;
    const rootKeyAttribute = interactionRootKey ? `data-${interactionScope}-root-key="${escapeHtml(interactionRootKey)}"` : "";

    function getTrackedPercent(trackedLine) {
      const rawValue = Number(
        trackedLine?.progressPercent
          ?? (Number(trackedLine?.need) > 0
            ? (Number(trackedLine?.have) / Number(trackedLine?.need)) * 100
            : 0),
      );
      if (!Number.isFinite(rawValue)) {
        return 0;
      }
      return Math.min(100, Math.max(0, rawValue));
    }

    function isCovered(node) {
      const trackedLine = progressLookup.get(Number(node.typeID));
      return trackedLine && getProgressStatus(trackedLine) === "ready";
    }

    function renderNode(node) {
      if (maxDepth !== null && Number(node.depth) > Number(maxDepth)) {
        return "";
      }

      if (hideCovered && isCovered(node)) {
        return "";
      }

      const isExpanded = node.nodeId === tree.nodeId || expandedNodeIds.has(node.nodeId);
      const canExpand = node.children.length > 0;
      const trackedLine = progressLookup.get(Number(node.typeID));
      const trackedStatus = trackedLine ? getProgressStatus(trackedLine) : "";
      const recipeCount = node.availableRecipes?.length || 0;
      const showRecipeChooser = recipeCount > 1 && Number(activeRecipeChooserTypeID) === Number(node.typeID);
      const trackedPercent = trackedLine ? getTrackedPercent(trackedLine) : 0;
      const sizeTag = node.recipe && graph ? getRecipeFacilityPrefixTag(graph, node.recipe) : "";
      const rowClasses = [
        "outline-row",
        recipeCount > 1 ? "has-alternates" : "",
      ].filter(Boolean).join(" ");
      const rowBodyClasses = [
        "outline-row-body",
        canExpand ? "is-expandable" : "is-leaf",
        canExpand && isExpanded ? "is-expanded" : "",
      ].filter(Boolean).join(" ");
      const rowActionAttributes = canExpand
        ? `${rowToggleNodeAttribute}="${node.nodeId}" ${rootKeyAttribute} role="button" tabindex="0" aria-expanded="${String(isExpanded)}" aria-label="${escapeHtml(isExpanded ? `Collapse ${node.item.name}` : `Expand ${node.item.name}`)}"`
        : `aria-label="${escapeHtml(`${node.item.name} has no child dependencies`)}"`;
      const pillMarkup = [];

      if (recipeCount > 1) {
        if (sizeTag && interactionScope === "default-preset") {
          pillMarkup.push(`<span class="outline-pill outline-pill-size">${escapeHtml(sizeTag)}</span>`);
        }
        pillMarkup.push(`
          <button
            type="button"
            class="outline-pill outline-pill-alt outline-recipe-toggle${showRecipeChooser ? " is-open" : ""}"
            ${recipeToggleAttribute}="${node.typeID}"
            ${rootKeyAttribute}
            aria-label="Choose recipe for ${escapeHtml(node.item.name)}"
          >
            ${formatNumber(recipeCount)} recipes
          </button>
        `);
        pillMarkup.push(
          `<span class="outline-pill outline-pill-choice">${
            escapeHtml(
              interactionScope === "default-preset" && sizeTag
                ? buildRecipeChoiceSummary(node.recipe, node.typeID, null)
                : buildRecipeChoiceSummary(node.recipe, node.typeID, graph),
            )
          }</span>`,
        );
      } else if (sizeTag) {
        pillMarkup.push(`<span class="outline-pill outline-pill-size">${escapeHtml(sizeTag)}</span>`);
      }

      if (showRecipeDetails && node.recipe) {
        const outputQuantity = Math.max(1, Number(node.selectedOutput?.quantity) || 1);
        pillMarkup.push(`
          <span class="outline-pill outline-pill-meta">
            out ${formatNumber(outputQuantity)} · ${formatRuntime(node.recipe.runTime || 0)}
          </span>
        `);
      }

      if (showTrackedStatus && trackedLine) {
        pillMarkup.push(`
          <span class="outline-pill status-${trackedStatus}">
            ${escapeHtml(trackedStatus)} ${formatNumber(trackedLine.have)} / ${formatNumber(trackedLine.need)}
          </span>
        `);
      }

      const childMarkup = canExpand && isExpanded
        ? node.children.map((child) => renderNode(child)).join("")
        : "";

      const chooserMarkup = showRecipeChooser && graph
        ? `
          <div class="outline-recipe-chooser" data-depth="${node.depth}" style="--depth:${node.depth}">
            <label class="outline-recipe-label">
              <span class="visually-hidden">Recipe for ${escapeHtml(node.item.name)}</span>
              <select class="text-input outline-recipe-select" ${recipeSelectAttribute}="${node.typeID}" ${rootKeyAttribute}>
                ${node.availableRecipes.map((recipe) => `
                  <option value="${recipe.blueprintID}" ${Number(recipe.blueprintID) === Number(node.recipe?.blueprintID) ? "selected" : ""}>
                    ${escapeHtml(buildRecipeOptionLabel(graph, recipe, node.typeID))}
                  </option>
                `).join("")}
              </select>
            </label>
            <p class="outline-recipe-note">Applies to all occurrences of this item in the current plan.</p>
          </div>
        `
        : "";

      const statusMeterMarkup = showTrackedStatus && trackedLine
        ? `
          <div class="outline-status-meter" aria-hidden="true">
            <span class="outline-status-meter-fill status-${trackedStatus}" style="width:${trackedPercent.toFixed(1)}%"></span>
          </div>
        `
        : "";

      return `
        <div class="${rowClasses}" data-depth="${node.depth}" data-status="${trackedStatus || "none"}" style="--depth:${node.depth}">
          <div class="${rowBodyClasses}" ${rowActionAttributes}>
            <span class="outline-chevron${canExpand ? "" : " is-leaf"}" aria-hidden="true">
              ${canExpand ? (isExpanded ? "▾" : "▸") : "•"}
            </span>
            <div class="outline-main">
              <span class="item-icon" data-icon-type-id="${node.item.typeID}" data-icon-fallback="${escapeHtml(getIconFallbackLabel(node.item.name))}">
                ${escapeHtml(getIconFallbackLabel(node.item.name))}
              </span>
              <div class="outline-main-copy">
                <span class="outline-name">${escapeHtml(node.item.name)}</span>
                <div class="outline-inline-meta">
                  <span class="outline-qty">need ${formatNumber(node.requestedQuantity)}</span>
                  <span class="outline-runs">${node.recipe ? `${formatNumber(node.runsNeeded)} run${node.runsNeeded === 1 ? "" : "s"}` : "raw material"}</span>
                </div>
              </div>
            </div>
            <div class="outline-side">
              <div class="outline-pill-group">
                ${pillMarkup.join("")}
              </div>
              ${statusMeterMarkup}
            </div>
          </div>
        </div>
        ${chooserMarkup}
        ${childMarkup}
      `;
    }

    return `<div class="outline-list">${renderNode(tree)}</div>`;
  }

  async function readJsonFile(file) {
    const payload = await file.text();
    return JSON.parse(payload);
  }

  async function readArrayBuffer(file) {
    return file.arrayBuffer();
  }

  function getDataViewString(view, start, length) {
    let result = "";
    for (let index = 0; index < length; index += 1) {
      result += String.fromCharCode(view.getUint8(start + index));
    }
    return result;
  }

  function parseZipDirectory(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const eocdSignature = 0x06054b50;
    const centralDirectorySignature = 0x02014b50;
    const localHeaderSignature = 0x04034b50;
    let eocdOffset = -1;

    for (let offset = view.byteLength - 22; offset >= Math.max(0, view.byteLength - 65557); offset -= 1) {
      if (view.getUint32(offset, true) === eocdSignature) {
        eocdOffset = offset;
        break;
      }
    }

    if (eocdOffset < 0) {
      throw new Error("Invalid ZIP: EOCD not found");
    }

    const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
    const entryCount = view.getUint16(eocdOffset + 10, true);
    const entries = new Map();
    let offset = centralDirectoryOffset;

    for (let index = 0; index < entryCount; index += 1) {
      if (view.getUint32(offset, true) !== centralDirectorySignature) {
        throw new Error("Invalid ZIP: central directory entry not found");
      }

      const compressionMethod = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const fileNameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);
      const fileName = getDataViewString(view, offset + 46, fileNameLength);

      entries.set(fileName, {
        fileName,
        compressionMethod,
        compressedSize,
        uncompressedSize,
        localHeaderOffset,
      });

      offset += 46 + fileNameLength + extraLength + commentLength;
    }

    for (const entry of entries.values()) {
      if (view.getUint32(entry.localHeaderOffset, true) !== localHeaderSignature) {
        throw new Error(`Invalid ZIP: local header missing for ${entry.fileName}`);
      }
      const fileNameLength = view.getUint16(entry.localHeaderOffset + 26, true);
      const extraLength = view.getUint16(entry.localHeaderOffset + 28, true);
      entry.dataOffset = entry.localHeaderOffset + 30 + fileNameLength + extraLength;
    }

    return entries;
  }

  async function inflateRawBytes(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function extractZipEntryBytes(iconArchive, entry) {
    const compressedBytes = new Uint8Array(
      iconArchive.arrayBuffer,
      entry.dataOffset,
      entry.compressedSize,
    );

    if (entry.compressionMethod === 0) {
      return compressedBytes;
    }

    if (entry.compressionMethod === 8) {
      return inflateRawBytes(compressedBytes);
    }

    throw new Error(`Unsupported ZIP compression method: ${entry.compressionMethod}`);
  }

  async function createIconArchive(file) {
    const arrayBuffer = await readArrayBuffer(file);
    return {
      fileName: file.name,
      arrayBuffer,
      entries: parseZipDirectory(arrayBuffer),
      objectUrls: new Map(),
    };
  }

  async function getIconObjectUrl(iconArchive, typeID) {
    if (!iconArchive) {
      return null;
    }

    const cacheKey = String(typeID);
    if (iconArchive.objectUrls.has(cacheKey)) {
      return iconArchive.objectUrls.get(cacheKey);
    }

    const entry = iconArchive.entries.get(`${cacheKey}.png`) ?? iconArchive.entries.get(`${cacheKey}.jpg`);
    if (!entry) {
      return null;
    }

    const bytes = await extractZipEntryBytes(iconArchive, entry);
    const mimeType = entry.fileName.endsWith(".jpg") ? "image/jpeg" : "image/png";
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    iconArchive.objectUrls.set(cacheKey, objectUrl);
    return objectUrl;
  }

  async function hydrateIcons(rootNode, iconArchive) {
    if (!rootNode || !iconArchive) {
      return;
    }

    const iconNodes = Array.from(rootNode.querySelectorAll("[data-icon-type-id]"));
    await Promise.all(
      iconNodes.map(async (iconNode) => {
        if (iconNode.dataset.iconHydrated === "true") {
          return;
        }
        const iconUrl = await getIconObjectUrl(iconArchive, iconNode.dataset.iconTypeId);
        if (!iconUrl) {
          return;
        }
        iconNode.dataset.iconHydrated = "true";
        iconNode.innerHTML = `<img src="${iconUrl}" alt="" />`;
      }),
    );
  }

  function inferSnapshotFromFolderFiles(files) {
    const firstPath = files[0]?.webkitRelativePath || "";
    const parts = firstPath.split("/").filter(Boolean);
    return parts[0] || "selected.stripped.folder";
  }

  async function createGraphFromFolderFiles(files) {
    const typesFile = files.find((file) => file.name === "types.json");
    const blueprintsFile = files.find((file) => file.name === "industry_blueprints.json");
    const facilitiesFile = files.find((file) => file.name === "industry_facilities.json");

    if (!typesFile || !blueprintsFile) {
      throw new Error("Folder must contain both types.json and industry_blueprints.json");
    }

    const [typesData, blueprintsData, facilitiesData] = await Promise.all([
      readJsonFile(typesFile),
      readJsonFile(blueprintsFile),
      facilitiesFile ? readJsonFile(facilitiesFile) : Promise.resolve(null),
    ]);

    return buildGraphFromStrippedData(
      inferSnapshotFromFolderFiles(files),
      typesData,
      blueprintsData,
      facilitiesData,
    );
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value ?? 0);
  }

  function formatRuntime(seconds) {
    const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    const parts = [];

    if (hours) {
      parts.push(`${hours}h`);
    }
    if (minutes) {
      parts.push(`${minutes}m`);
    }
    if (remainingSeconds || !parts.length) {
      parts.push(`${remainingSeconds}s`);
    }

    return parts.join(" ");
  }

  function formatVolume(value) {
    return `${formatNumber(value)} m³`;
  }

  function formatMass(value) {
    return formatNumber(value);
  }

  function createBrowserPlannerState(datasetFingerprint) {
    return {
      planLines: [],
      recipeChoiceByType: {},
      uiState: {},
      datasetFingerprint,
    };
  }

  function buildBrowserPlannerStorageKey(datasetFingerprint) {
    return `fic.planner.v1.${datasetFingerprint}`;
  }

  function saveBrowserPlannerState(state) {
    if (!state || !state.datasetFingerprint) {
      return;
    }

    const storage = getBrowserStorage();
    if (!storage || typeof storage.setItem !== "function") {
      return;
    }

    storage.setItem(
      buildBrowserPlannerStorageKey(state.datasetFingerprint),
      JSON.stringify({
        planLines: Array.isArray(state.planLines) ? state.planLines : [],
        recipeChoiceByType:
          state.recipeChoiceByType && typeof state.recipeChoiceByType === "object" ? state.recipeChoiceByType : {},
        uiState: state.uiState && typeof state.uiState === "object" ? state.uiState : {},
        datasetFingerprint: state.datasetFingerprint,
      }),
    );
  }

  function loadBrowserPlannerState(datasetFingerprint) {
    if (!datasetFingerprint) {
      return null;
    }

    const storage = getBrowserStorage();
    if (!storage || typeof storage.getItem !== "function") {
      return null;
    }

    const raw = storage.getItem(buildBrowserPlannerStorageKey(datasetFingerprint));
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.datasetFingerprint !== datasetFingerprint) {
        return null;
      }

      return {
        planLines: Array.isArray(parsed.planLines) ? parsed.planLines : [],
        recipeChoiceByType:
          parsed.recipeChoiceByType && typeof parsed.recipeChoiceByType === "object" ? parsed.recipeChoiceByType : {},
        uiState: parsed.uiState && typeof parsed.uiState === "object" ? parsed.uiState : {},
        datasetFingerprint: parsed.datasetFingerprint,
      };
    } catch (_error) {
      return null;
    }
  }

  function browserNormalizePlannerLines(planLines) {
    const aggregate = new Map();

    for (const line of Array.isArray(planLines) ? planLines : []) {
      const typeId = Number(line?.outputTypeId);
      const quantity = Number(line?.quantity);

      if (!Number.isInteger(typeId) || !Number.isInteger(quantity) || quantity < 1) {
        continue;
      }

      aggregate.set(typeId, (aggregate.get(typeId) || 0) + quantity);
    }

    return Array.from(aggregate.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([typeId, quantity]) => ({ typeId, quantity }));
  }

  function browserGetPlannerRecipeOptions(typeId, recipeOptionsByType = {}) {
    const options = recipeOptionsByType[typeId] ?? recipeOptionsByType[String(typeId)] ?? [];
    if (!Array.isArray(options)) {
      return [];
    }

    return options
      .filter((option) => option && Number.isFinite(Number(option.blueprintId)))
      .slice()
      .sort((left, right) => Number(left.blueprintId) - Number(right.blueprintId));
  }

  function browserResolveRecipeForType(typeId, recipeChoiceByType = {}, recipeOptionsByType = {}) {
    const options = browserGetPlannerRecipeOptions(typeId, recipeOptionsByType);
    if (!options.length) {
      return null;
    }

    const chosenBlueprintId = Number(recipeChoiceByType[typeId] ?? recipeChoiceByType[String(typeId)]);
    if (Number.isFinite(chosenBlueprintId)) {
      const matched = options.find((option) => Number(option.blueprintId) === chosenBlueprintId);
      if (matched) {
        return matched;
      }
    }

    return options[0];
  }

  function browserBuildDecisionSet(typeIdsInPlan, recipeOptionsByType = {}, recipeChoiceByType = {}) {
    const decisionSet = [];
    const sortedTypeIds = Array.from(new Set((Array.isArray(typeIdsInPlan) ? typeIdsInPlan : []).map(Number)))
      .filter(Number.isFinite)
      .sort((left, right) => left - right);

    for (const typeId of sortedTypeIds) {
      const options = browserGetPlannerRecipeOptions(typeId, recipeOptionsByType);
      if (options.length <= 1) {
        continue;
      }

      const defaultRecipe = options[0];
      const currentRecipe = browserResolveRecipeForType(typeId, recipeChoiceByType, recipeOptionsByType);
      if (!currentRecipe) {
        continue;
      }

      decisionSet.push({
        typeId,
        options,
        currentRecipe,
        defaultRecipe,
        decisionState:
          Number(currentRecipe.blueprintId) === Number(defaultRecipe.blueprintId) ? "default" : "overridden",
      });
    }

    return decisionSet;
  }

  function browserBuildDecisionSummary(decisionSet) {
    const normalized = Array.isArray(decisionSet) ? decisionSet : [];
    const defaultCount = normalized.filter((entry) => entry?.decisionState === "default").length;
    const overriddenCount = normalized.filter((entry) => entry?.decisionState === "overridden").length;

    return {
      totalMultiPathItems: normalized.length,
      defaultCount,
      overriddenCount,
    };
  }

  function browserComputePlannerPlan({
    planLines,
    recipeChoiceByType,
    recipeOptionsByType,
    expandDependencies,
  }) {
    const normalizedPlanLines = browserNormalizePlannerLines(planLines);
    const resolver = (typeId) => browserResolveRecipeForType(typeId, recipeChoiceByType || {}, recipeOptionsByType || {});
    const rawMaterialsMap = new Map();
    const componentsMap = new Map();
    const outlineMap = new Map();
    const typeIdsInGraph = new Set();
    const targetTypeIds = new Set(normalizedPlanLines.map((line) => Number(line.typeId)));

    let totalRuntime = 0;
    let totalMass = 0;
    let totalVolume = 0;

    function toNumericValue(value) {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : 0;
    }

    function normalizeNodeTypeId(node) {
      const typeId = Number(node?.typeId ?? node?.typeID);
      return Number.isFinite(typeId) ? typeId : null;
    }

    function normalizeNodeChildren(node) {
      return Array.isArray(node?.children) ? node.children : [];
    }

    function isBaseMaterialNode(node) {
      if (typeof node?.isBaseMaterial === "boolean") {
        return node.isBaseMaterial;
      }
      return normalizeNodeChildren(node).length === 0;
    }

    function incrementMapValue(map, typeId, quantity) {
      map.set(typeId, (map.get(typeId) || 0) + quantity);
    }

    function sortedQuantityLines(map) {
      return Array.from(map.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([typeId, quantity]) => ({ typeId, quantity }));
    }

    function ensureOutlineNode(typeId, recipe) {
      if (!outlineMap.has(typeId)) {
        outlineMap.set(typeId, {
          typeId,
          quantity: 0,
          runs: 0,
          selectedRecipe: recipe ?? null,
          usageCount: 0,
          children: new Map(),
        });
      }
      const current = outlineMap.get(typeId);
      if (!current.selectedRecipe && recipe) {
        current.selectedRecipe = recipe;
      }
      return current;
    }

    function finalizeOutline() {
      return Array.from(outlineMap.values())
        .sort((left, right) => left.typeId - right.typeId)
        .map((entry) => ({
          typeId: entry.typeId,
          quantity: entry.quantity,
          runs: entry.runs,
          selectedRecipe: entry.selectedRecipe,
          usageCount: entry.usageCount,
          children: Array.from(entry.children.entries())
            .sort((left, right) => left[0] - right[0])
            .map(([typeId, quantity]) => ({ typeId, quantity })),
        }));
    }

    function visitNode(node, isRoot = false) {
      const typeId = normalizeNodeTypeId(node);
      if (typeId === null) {
        return;
      }

      const quantity = toNumericValue(node?.quantity);
      const runs = toNumericValue(node?.runs ?? node?.runsNeeded);
      const runtime = toNumericValue(node?.runtime ?? node?.totalRuntime);
      const mass = toNumericValue(node?.mass ?? node?.totalMass);
      const volume = toNumericValue(node?.volume ?? node?.totalVolume);
      const recipe = node?.recipe ?? null;
      const children = normalizeNodeChildren(node);

      totalRuntime += runtime;
      totalMass += mass;
      totalVolume += volume;
      typeIdsInGraph.add(typeId);

      const outlineNode = ensureOutlineNode(typeId, recipe);
      outlineNode.quantity += quantity;
      outlineNode.runs += runs;
      outlineNode.usageCount += 1;

      for (const child of children) {
        const childTypeId = normalizeNodeTypeId(child);
        if (childTypeId === null) {
          continue;
        }
        incrementMapValue(outlineNode.children, childTypeId, toNumericValue(child?.quantity));
      }

      if (isBaseMaterialNode(node)) {
        incrementMapValue(rawMaterialsMap, typeId, quantity);
      } else if (!isRoot && !targetTypeIds.has(typeId)) {
        incrementMapValue(componentsMap, typeId, quantity);
      }

      for (const child of children) {
        visitNode(child, false);
      }
    }

    for (const line of normalizedPlanLines) {
      const expanded = typeof expandDependencies === "function" ? expandDependencies(line.typeId, line.quantity, resolver) : null;
      if (expanded) {
        visitNode(expanded, true);
      }
    }

    const decisions = browserBuildDecisionSet(Array.from(typeIdsInGraph), recipeOptionsByType || {}, recipeChoiceByType || {});

    return {
      rawMaterials: sortedQuantityLines(rawMaterialsMap),
      components: sortedQuantityLines(componentsMap),
      dependencyOutline: finalizeOutline(),
      totals: {
        totalRuntime,
        totalMass,
        totalVolume,
      },
      decisions,
      decisionSummary: browserBuildDecisionSummary(decisions),
    };
  }

  function collectExpandableNodeIds(tree) {
    const ids = [];

    function visit(node) {
      if (node.children.length) {
        ids.push(node.nodeId);
      }
      for (const child of node.children) {
        visit(child);
      }
    }

    visit(tree);
    return ids;
  }

  function getDefaultExpandedNodeIds(tree) {
    const ids = new Set([tree.nodeId]);
    for (const child of tree.children) {
      ids.add(child.nodeId);
    }
    return ids;
  }

  function getBrowserStorage() {
    try {
      if (typeof localStorage !== "undefined") {
        return localStorage;
      }
    } catch (_error) {
      return null;
    }
    return null;
  }

  function getPlannerSupport() {
    const fallback = {
      createEmptyPlannerState: createBrowserPlannerState,
      savePlannerState: saveBrowserPlannerState,
      loadPlannerState: loadBrowserPlannerState,
      computePlannerPlan: browserComputePlannerPlan,
    };

    if (typeof require !== "function") {
      return fallback;
    }

    try {
      const { createEmptyPlannerState } = require("./planner/state.js");
      const { savePlannerState, loadPlannerState } = require("./planner/storage.js");
      const { computePlannerPlan } = require("./planner/compute_plan.js");
      return {
        createEmptyPlannerState,
        savePlannerState,
        loadPlannerState,
        computePlannerPlan,
      };
    } catch (_error) {
      return fallback;
    }
  }

  function createPlannerRuntime({
    datasetFingerprint,
    recipeOptionsByType = {},
    expandDependencies = () => null,
    plannerSupport = getPlannerSupport(),
  }) {
    const support = plannerSupport || getPlannerSupport();
    const runtimeState = {
      mode: "calculator",
      expandDependencies: typeof expandDependencies === "function" ? expandDependencies : () => null,
      recipeOptionsByType: recipeOptionsByType || {},
      plannerState: support.createEmptyPlannerState(datasetFingerprint),
      plannerResult: {
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
      },
    };

    function recompute() {
      runtimeState.plannerResult = support.computePlannerPlan({
        planLines: runtimeState.plannerState.planLines,
        recipeChoiceByType: runtimeState.plannerState.recipeChoiceByType,
        recipeOptionsByType: runtimeState.recipeOptionsByType,
        expandDependencies: runtimeState.expandDependencies,
      });
    }

    function persist() {
      support.savePlannerState(runtimeState.plannerState);
    }

    function load() {
      const loaded = support.loadPlannerState(datasetFingerprint);
      runtimeState.plannerState = loaded || support.createEmptyPlannerState(datasetFingerprint);
      runtimeState.plannerState.planLines = Array.isArray(runtimeState.plannerState.planLines)
        ? runtimeState.plannerState.planLines
        : [];
      runtimeState.plannerState.recipeChoiceByType =
        runtimeState.plannerState.recipeChoiceByType && typeof runtimeState.plannerState.recipeChoiceByType === "object"
          ? runtimeState.plannerState.recipeChoiceByType
          : {};
      runtimeState.plannerState.uiState =
        runtimeState.plannerState.uiState && typeof runtimeState.plannerState.uiState === "object"
          ? runtimeState.plannerState.uiState
          : {};
      runtimeState.plannerState.datasetFingerprint =
        runtimeState.plannerState.datasetFingerprint || datasetFingerprint;
      recompute();
      return runtimeState.plannerState;
    }

    function addLine(nextLine = {}) {
      const line = {
        lineId: nextLine.lineId || `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        outputTypeId: Number(nextLine.outputTypeId) || 1,
        quantity: normalizePlannerLineQuantity(nextLine.quantity),
      };
      runtimeState.plannerState.planLines = runtimeState.plannerState.planLines.concat([line]);
      recompute();
      persist();
      return line;
    }

    function updateLineQuantity(lineId, quantity) {
      runtimeState.plannerState.planLines = runtimeState.plannerState.planLines.map((line) =>
        line.lineId === lineId ? { ...line, quantity: normalizePlannerLineQuantity(quantity) } : line,
      );
      recompute();
      persist();
    }

    function removeLine(lineId) {
      runtimeState.plannerState.planLines = runtimeState.plannerState.planLines.filter((line) => line.lineId !== lineId);
      recompute();
      persist();
    }

    function selectRecipe(typeId, blueprintId) {
      const numericTypeId = Number(typeId);
      const numericBlueprintId = Number(blueprintId);
      if (!Number.isFinite(numericTypeId) || !Number.isFinite(numericBlueprintId)) {
        return false;
      }

      runtimeState.plannerState.recipeChoiceByType = {
        ...(runtimeState.plannerState.recipeChoiceByType || {}),
        [numericTypeId]: numericBlueprintId,
      };
      runtimeState.plannerState.uiState = {
        ...(runtimeState.plannerState.uiState || {}),
        activeDecisionTypeId: numericTypeId,
      };
      recompute();
      persist();
      return true;
    }

    function focusDecision(typeId) {
      const numericTypeId = Number(typeId);
      if (!Number.isFinite(numericTypeId)) {
        return false;
      }

      const hasDecision = (runtimeState.plannerResult.decisions || []).some(
        (decision) => Number(decision?.typeId) === numericTypeId,
      );
      if (!hasDecision) {
        return false;
      }

      runtimeState.plannerState.uiState = {
        ...(runtimeState.plannerState.uiState || {}),
        activeDecisionTypeId: numericTypeId,
      };
      return true;
    }

    function setMode(mode) {
      runtimeState.mode = mode === "planner" ? "planner" : "calculator";
    }

    function setRecipeOptionsByType(nextRecipeOptionsByType = {}) {
      runtimeState.recipeOptionsByType = nextRecipeOptionsByType || {};
      recompute();
    }

    function setExpandDependencies(nextExpandDependencies = () => null) {
      runtimeState.expandDependencies = typeof nextExpandDependencies === "function" ? nextExpandDependencies : () => null;
      recompute();
    }

    function getRenderModel() {
      return {
        mode: runtimeState.mode,
        recipeOptionsByType: runtimeState.recipeOptionsByType,
        plannerState: runtimeState.plannerState,
        plannerResult: runtimeState.plannerResult,
      };
    }

    return {
      addLine,
      focusDecision,
      getRenderModel,
      load,
      persist,
      recompute,
      removeLine,
      selectRecipe,
      setExpandDependencies,
      setMode,
      setRecipeOptionsByType,
      updateLineQuantity,
    };
  }

  function bindBrowserApp() {
    const graphFileInput = document.getElementById("graphFile");
    const folderInput = document.getElementById("folderInput");
    const iconZipInput = document.getElementById("iconZipFile");
    const statusPill = document.getElementById("statusPill");
    const workspaceHeaderTarget = document.getElementById("workspaceHeaderTarget");
    const workspaceHeaderProgress = document.getElementById("workspaceHeaderProgress");
    const workspaceHeaderEta = document.getElementById("workspaceHeaderEta");
    const openUploadModalButton = document.getElementById("openUploadModal");
    const openDatasetDrawerButton = document.getElementById("openDatasetDrawer");
    const openFiltersDrawerButton = document.getElementById("openFiltersDrawer");
    const openDefaultRecipePathsDrawerButton = document.getElementById("openDefaultRecipePathsDrawer");
    const openViewDrawerButton = document.getElementById("openViewDrawer");
    const searchInput = document.getElementById("searchInput");
    const searchResults = document.getElementById("searchResults");
    const catalogTree = document.getElementById("catalogTree");
    const catalogBranchTitle = document.getElementById("catalogBranchTitle");
    const catalogBranchCount = document.getElementById("catalogBranchCount");
    const selectedItemCard = document.getElementById("selectedItemCard");
    const quantityInput = document.getElementById("quantityInput");
    const summaryRecipeField = document.getElementById("summaryRecipeField");
    const summaryRecipeSelect = document.getElementById("summaryRecipeSelect");
    const defaultRecipePresetsList = document.getElementById("defaultRecipePresetsList");
    const nextActionsContent = document.getElementById("nextActionsContent");
    const bottleneckContent = document.getElementById("bottleneckContent");
    const materialsList = document.getElementById("materialsList");
    const materialsMeta = document.getElementById("materialsMeta");
    const componentsList = document.getElementById("componentsList");
    const componentsMeta = document.getElementById("componentsMeta");
    const workspaceTabPlan = document.getElementById("workspaceTabPlan");
    const workspaceTabPipeline = document.getElementById("workspaceTabPipeline");
    const workspaceTabTree = document.getElementById("workspaceTabTree");
    const workspaceTabDefaultRecipes = document.getElementById("workspaceTabDefaultRecipes");
    const planWorkspacePanel = document.getElementById("planWorkspacePanel");
    const pipelineWorkspacePanel = document.getElementById("pipelineWorkspacePanel");
    const treeWorkspacePanel = document.getElementById("treeWorkspacePanel");
    const defaultRecipeWorkspacePanel = document.getElementById("defaultRecipeWorkspacePanel");
    const defaultRecipeWorkspaceContent = document.getElementById("defaultRecipeWorkspaceContent");
    const dependencyPipeline = document.getElementById("dependencyPipeline");
    const dependencyPipelineContent = document.getElementById("dependencyPipelineContent");
    const treePreview = document.getElementById("treePreview");
    const outlineMeta = document.getElementById("outlineMeta");
    const snapshotMetrics = document.getElementById("snapshotMetrics");
    const activeTargetCard = document.getElementById("activeTargetCard");
    const datasetDrawer = document.getElementById("datasetDrawer");
    const filtersDrawer = document.getElementById("filtersDrawer");
    const defaultRecipePathsDrawer = document.getElementById("defaultRecipePathsDrawer");
    const viewDrawer = document.getElementById("viewDrawer");
    const dataUploadModal = document.getElementById("dataUploadModal");
    const treeDepthSelect = document.getElementById("treeDepthSelect");
    const hideCoveredToggle = document.getElementById("hideCoveredToggle");
    const showRecipeDetailsToggle = document.getElementById("showRecipeDetailsToggle");
    const showTrackedStatusToggle = document.getElementById("showTrackedStatusToggle");
    const modeCalculatorButton = document.getElementById("modeCalculator");
    const modePlannerButton = document.getElementById("modePlanner");
    const calculatorShell = document.getElementById("calculatorShell");
    const plannerShell = document.getElementById("plannerShell");
    const plannerCatalogSearch = document.getElementById("plannerCatalogSearch");
    const plannerCatalogResults = document.getElementById("plannerCatalogResults");
    const plannerLines = document.getElementById("plannerLines");
    const plannerRawMaterials = document.getElementById("plannerRawMaterials");
    const plannerComponents = document.getElementById("plannerComponents");
    const plannerDecisions = document.getElementById("plannerDecisions");
    const plannerAddLine = document.getElementById("plannerAddLine");
    const storage = getBrowserStorage();

    const state = {
      graph: null,
      catalog: null,
      selectedCatalogBranchKey: "all",
      searchResults: [],
      searchQuery: "",
      selectedTypeID: null,
      requestedQuantity: 1,
      recipeSelections: {},
      managedDefaultRecipePresets: [],
      managedDefaultStoredSelections: loadStoredManagedDefaultRecipePresets(storage),
      managedDefaultExpandedPresetKeys: new Set(),
      managedDefaultExpandedNodeIdsByRoot: {},
      managedDefaultActivePresetRootKey: null,
      activeManagedDefaultRecipeChooserTypeID: null,
      activeManagedDefaultRecipeChooserRootKey: null,
      expandedNodeIds: new Set(),
      currentTree: null,
      currentRollup: null,
      currentSummary: null,
      currentProgressSections: null,
      currentProgressLookup: new Map(),
      progressByTypeID: {},
      currentPlanKey: null,
      iconArchive: null,
      activeRecipeChooserTypeID: null,
      treeDepth: null,
      hideCovered: false,
      showRecipeDetails: false,
      showTrackedStatus: true,
      workspaceUi: createCalculatorWorkspaceState(),
    };
    const plannerRuntime = createPlannerRuntime({
      datasetFingerprint: "default",
      recipeOptionsByType: {},
      expandDependencies: (typeId, quantity, resolveRecipeFn) =>
        buildPlannerDependencyNode(state.graph, typeId, quantity, resolveRecipeFn),
    });

    function renderPlannerShell() {
      const model = plannerRuntime.getRenderModel();
      const isPlanner = model.mode === "planner";
      const plannerQuery = plannerCatalogSearch?.value || "";
      const plannerSearchResults = searchPlannerCatalog(state.graph, getSelectedCatalogBranch(), plannerQuery, 30);
      if (calculatorShell) {
        calculatorShell.hidden = isPlanner;
      }
      if (plannerShell) {
        plannerShell.hidden = !isPlanner;
      }
      if (modeCalculatorButton) {
        modeCalculatorButton.setAttribute("aria-pressed", String(!isPlanner));
      }
      if (modePlannerButton) {
        modePlannerButton.setAttribute("aria-pressed", String(isPlanner));
      }

      if (plannerCatalogResults) {
        plannerCatalogResults.innerHTML = plannerSearchResults.length
          ? plannerSearchResults
              .map(
                (item) => `
                  <li class="planner-catalog-result">
                    <span class="planner-catalog-result-label">
                      ${renderItemMarkup(item.name, item.typeID)}
                      <small>Type ${item.typeID}</small>
                    </span>
                    <button type="button" class="mini-button" data-planner-add-type-id="${item.typeID}">Add</button>
                  </li>
                `,
              )
              .join("")
          : `<li class="planner-catalog-result-empty">${
              state.graph ? "No matching craftable items." : "Load data to search craftable items."
            }</li>`;
      }

      if (plannerLines) {
        plannerLines.innerHTML = renderPlannerLinesMarkup({
          planLines: model.plannerState.planLines || [],
          recipeChoiceByType: model.plannerState.recipeChoiceByType || {},
          recipeOptionsByType: model.recipeOptionsByType || {},
          graph: state.graph,
        });
      }

      const aggregatedOutputMarkup = renderPlannerAggregatedOutputMarkup({
        planLines: model.plannerState.planLines || [],
        graph: state.graph,
        plannerResult: model.plannerResult || {},
      });

      if (plannerRawMaterials) {
        plannerRawMaterials.innerHTML = aggregatedOutputMarkup.rawMaterialsMarkup;
      }

      if (plannerComponents) {
        plannerComponents.innerHTML = aggregatedOutputMarkup.componentsMarkup;
      }

      if (plannerDecisions) {
        plannerDecisions.innerHTML = renderPlannerDecisionPanelMarkup(model, state.graph);
        const activeDecisionGroup = plannerDecisions.querySelector(".planner-decision-group.is-active");
        if (activeDecisionGroup && typeof activeDecisionGroup.scrollIntoView === "function") {
          activeDecisionGroup.scrollIntoView({ block: "nearest" });
        }
      }

      hydrateIcons(plannerShell, state.iconArchive);
    }

    function getSelectedCatalogBranch() {
      if (!state.catalog || !state.selectedCatalogBranchKey || state.selectedCatalogBranchKey === "all") {
        return null;
      }
      return state.catalog.branchMap.get(state.selectedCatalogBranchKey) ?? null;
    }

    function updateSearchResults() {
      if (!state.graph) {
        state.searchResults = [];
        return;
      }

      state.searchResults = filterCatalogItems(
        state.graph,
        getSelectedCatalogBranch(),
        state.searchQuery,
        80,
      );
    }

    function refreshProgressState() {
      if (!state.currentRollup || !state.currentPlanKey) {
        state.currentProgressSections = null;
        state.currentProgressLookup = new Map();
        return;
      }

      state.currentProgressSections = buildProgressSections(state.currentRollup, state.progressByTypeID, {
        graph: state.graph,
        tree: state.currentTree,
        recipeSelections: state.recipeSelections,
      });
      state.currentProgressLookup = buildProgressLookup(state.currentProgressSections);
    }

    function syncPlanProgressFromStorage() {
      const nextPlanKey = buildPlanStorageKey({
        graph: state.graph,
        selectedTypeID: state.selectedTypeID,
        requestedQuantity: state.requestedQuantity,
        recipeSelections: state.recipeSelections,
      });

      if (nextPlanKey !== state.currentPlanKey) {
        state.currentPlanKey = nextPlanKey;
        state.progressByTypeID = loadStoredPlanProgress(storage, state.currentPlanKey);
      }

      refreshProgressState();
    }

    function persistCurrentPlanProgress() {
      saveStoredPlanProgress(storage, state.currentPlanKey, state.progressByTypeID);
    }

    function syncManagedDefaultPresetState() {
      state.managedDefaultRecipePresets = buildManagedDefaultRecipePresets(
        state.graph,
        state.managedDefaultStoredSelections,
      );
      const validRootKeys = new Set(state.managedDefaultRecipePresets.map((preset) => preset.key));
      const nextActivePresetRootKey = validRootKeys.has(state.managedDefaultActivePresetRootKey)
        ? state.managedDefaultActivePresetRootKey
        : state.managedDefaultRecipePresets[0]?.key ?? null;
      const nextExpandedNodeIdsByRoot = {};
      for (const preset of state.managedDefaultRecipePresets) {
        const previousExpandedNodeIds = state.managedDefaultExpandedNodeIdsByRoot[preset.key];
        const validNodeIds = new Set(collectExpandableNodeIds(preset.tree));
        const normalizedExpandedNodeIds = previousExpandedNodeIds
          ? new Set(Array.from(previousExpandedNodeIds).filter((nodeId) => validNodeIds.has(nodeId)))
          : getDefaultExpandedNodeIds(preset.tree);
        if (!normalizedExpandedNodeIds.size) {
          nextExpandedNodeIdsByRoot[preset.key] = getDefaultExpandedNodeIds(preset.tree);
        } else {
          nextExpandedNodeIdsByRoot[preset.key] = normalizedExpandedNodeIds;
        }
      }
      state.managedDefaultExpandedNodeIdsByRoot = nextExpandedNodeIdsByRoot;
      state.managedDefaultActivePresetRootKey = nextActivePresetRootKey;
      const nextOpenPresetKey = Array.from(state.managedDefaultExpandedPresetKeys).find((rootKey) => validRootKeys.has(rootKey));
      state.managedDefaultExpandedPresetKeys = nextOpenPresetKey
        ? new Set([nextOpenPresetKey])
        : nextActivePresetRootKey
          ? new Set([nextActivePresetRootKey])
          : new Set();
      if (!validRootKeys.has(state.activeManagedDefaultRecipeChooserRootKey)) {
        state.activeManagedDefaultRecipeChooserRootKey = null;
        state.activeManagedDefaultRecipeChooserTypeID = null;
      }
    }

    function getManagedDefaultPresetByKey(rootKey) {
      return state.managedDefaultRecipePresets.find((preset) => preset.key === rootKey) ?? null;
    }

    function persistManagedDefaultPresetSelections() {
      saveStoredManagedDefaultRecipePresets(storage, state.managedDefaultStoredSelections);
    }

    function setStatus(text, tone) {
      if (!statusPill) {
        return;
      }

      statusPill.textContent = text;
      statusPill.dataset.tone = tone || "default";
    }

    function renderSnapshotMetrics() {
      if (!snapshotMetrics) {
        return;
      }

      if (!state.graph) {
        snapshotMetrics.innerHTML = `
          <div class="summary-row">
            <span class="summary-key">Dataset</span>
            <strong>No graph</strong>
          </div>
        `;
        return;
      }

      const itemsCount = Object.keys(state.graph.items || {}).length;
      const recipesCount = Object.keys(state.graph.recipes || {}).length;
      const baseMaterialsCount = Array.isArray(state.graph.baseMaterials) ? state.graph.baseMaterials.length : 0;
      const iconStatus = state.iconArchive ? state.iconArchive.fileName : "No icon ZIP";

      snapshotMetrics.innerHTML = `
        <div class="summary-row"><span class="summary-key">Snapshot</span><strong>${escapeHtml(state.graph.meta?.snapshot || "unknown")}</strong></div>
        <div class="summary-row"><span class="summary-key">Items</span><strong>${formatNumber(itemsCount)}</strong></div>
        <div class="summary-row"><span class="summary-key">Recipes</span><strong>${formatNumber(recipesCount)}</strong></div>
        <div class="summary-row"><span class="summary-key">Base Mats</span><strong>${formatNumber(baseMaterialsCount)}</strong></div>
        <div class="summary-row"><span class="summary-key">Icons</span><strong>${escapeHtml(iconStatus)}</strong></div>
      `;
    }

    function renderWorkspaceHeader() {
      const summary = summarizeWorkspaceHeader({
        currentSummary: state.currentSummary,
        currentProgressSections: state.currentProgressSections,
        currentRollup: state.currentRollup,
      });

      if (workspaceHeaderTarget) {
        workspaceHeaderTarget.innerHTML = `
          <span class="metric-label">Target</span>
          <strong>${escapeHtml(summary.targetName)}</strong>
        `;
      }

      if (workspaceHeaderProgress) {
        workspaceHeaderProgress.innerHTML = `
          <span class="metric-label">Progress</span>
          <strong>${formatNumber(summary.progressPercent)}%</strong>
        `;
      }

      if (workspaceHeaderEta) {
        workspaceHeaderEta.innerHTML = `
          <span class="metric-label">ETA</span>
          <strong>${escapeHtml(summary.etaLabel)}</strong>
        `;
      }
    }

    function renderActiveTargetCard() {
      if (!activeTargetCard) {
        return;
      }

      if (!state.currentSummary) {
        activeTargetCard.innerHTML = `
          <div class="summary-row"><span class="summary-key">Target</span><strong>No target</strong></div>
        `;
        return;
      }

      const trackedLines = state.currentProgressSections?.allLines || [];
      const readyLines = trackedLines.filter((line) => line.status === "ready").length;

      activeTargetCard.innerHTML = `
        <div class="summary-row"><span class="summary-key">Target</span><strong>${escapeHtml(state.currentSummary.item.name)}</strong></div>
        <div class="summary-row"><span class="summary-key">Type</span><strong>${state.currentSummary.item.typeID}</strong></div>
        <div class="summary-row"><span class="summary-key">Progress</span><strong>${formatNumber(readyLines)} / ${formatNumber(trackedLines.length)}</strong></div>
      `;
    }

    function renderCatalogTree() {
      if (!catalogTree) {
        return;
      }

      if (!state.catalog) {
        catalogTree.innerHTML = `<p class="result-empty">Load data to browse craftable categories.</p>`;
        return;
      }

      function renderBranch(branch, depth = 0) {
        const isSelected = state.selectedCatalogBranchKey === branch.branchKey;
        const hasChildren = branch.children.length > 0;

        return `
          <li class="catalog-branch depth-${depth}">
            <button
              type="button"
              class="catalog-branch-button${isSelected ? " is-selected" : ""}"
              data-catalog-branch-key="${branch.branchKey}"
            >
              <span class="catalog-branch-copy">
                <strong>${escapeHtml(branch.label)}</strong>
                <span>${formatNumber(branch.count)}</span>
              </span>
            </button>
            ${hasChildren
              ? `<ol class="catalog-branch-children">${branch.children.map((child) => renderBranch(child, depth + 1)).join("")}</ol>`
              : ""}
          </li>
        `;
      }

      catalogTree.innerHTML = `
        <div class="catalog-all">
          <button
            type="button"
            class="catalog-all-button${state.selectedCatalogBranchKey === "all" ? " is-selected" : ""}"
            data-catalog-branch-key="all"
          >
            <span class="catalog-branch-copy">
              <strong>All craftable</strong>
              <span>${formatNumber(state.catalog.totalCraftableItems)}</span>
            </span>
          </button>
        </div>
        <ol class="catalog-tree-list">
          ${state.catalog.nodes.map((branch) => renderBranch(branch)).join("")}
        </ol>
      `;
    }

    function renderSelectedItemCard() {
      if (!selectedItemCard) {
        return;
      }

      if (!state.selectedTypeID) {
        selectedItemCard.innerHTML = `
          <span class="meta-label">Selected</span>
          <strong>No target selected</strong>
        `;
        return;
      }

      const item = getItem(state.graph, state.selectedTypeID);
      const recipes = getAvailableRecipesForType(state.graph, state.selectedTypeID);
      selectedItemCard.innerHTML = state.currentSummary
        ? renderSelectedTargetMarkup(state.currentSummary)
        : `
            <span class="meta-label">Selected</span>
            <strong>${renderItemMarkup(item?.name || `Type ${state.selectedTypeID}`, state.selectedTypeID)}</strong>
            <div class="selected-item-meta">
              <span>typeID ${state.selectedTypeID}</span>
              ${recipes.length > 1 ? `<span>${formatNumber(recipes.length)} recipes</span>` : ""}
            </div>
          `;

      hydrateIcons(selectedItemCard, state.iconArchive);
    }

    function renderManagedDefaultRecipePresets() {
      if (!defaultRecipePresetsList) {
        return;
      }

      if (!state.graph) {
        defaultRecipePresetsList.innerHTML = `
          <p class="result-empty">Load data to configure global recipe defaults.</p>
        `;
        return;
      }

      if (!state.managedDefaultRecipePresets.length) {
        defaultRecipePresetsList.innerHTML = `
          <p class="result-empty">This dataset does not expose any managed default recipe paths.</p>
        `;
        return;
      }

      defaultRecipePresetsList.innerHTML = renderManagedDefaultRecipePathsMarkup(
        state.graph,
        state.managedDefaultRecipePresets,
        {
          activeRootKey: state.managedDefaultActivePresetRootKey,
          openRootKey: Array.from(state.managedDefaultExpandedPresetKeys)[0] ?? null,
          activeManagedDefaultRecipeChooserRootKey: state.activeManagedDefaultRecipeChooserRootKey,
          activeManagedDefaultRecipeChooserTypeID: state.activeManagedDefaultRecipeChooserTypeID,
          expandedNodeIdsByRoot: state.managedDefaultExpandedNodeIdsByRoot,
        },
      );
      hydrateIcons(defaultRecipePresetsList, state.iconArchive);
    }

    function renderManagedDefaultRecipeWorkspace() {
      if (!defaultRecipeWorkspaceContent) {
        return;
      }

      const visiblePresets = filterManagedDefaultRecipePresetsForSelection(
        state.graph,
        state.managedDefaultRecipePresets,
        state.selectedTypeID,
        state.recipeSelections,
      );
      if (visiblePresets.length) {
        state.managedDefaultActivePresetRootKey = visiblePresets.some(
          (preset) => preset.key === state.managedDefaultActivePresetRootKey,
        )
          ? state.managedDefaultActivePresetRootKey
          : visiblePresets[0].key;
      }

      defaultRecipeWorkspaceContent.innerHTML = renderManagedDefaultRecipeWorkspaceMarkup(
        state.graph,
        state.managedDefaultRecipePresets,
        {
          selectedTypeID: state.selectedTypeID,
          recipeSelections: state.recipeSelections,
          activeRootKey: state.managedDefaultActivePresetRootKey,
        },
      );
      hydrateIcons(defaultRecipeWorkspaceContent, state.iconArchive);
    }

    function renderSearchResults() {
      if (!searchResults || !catalogBranchTitle || !catalogBranchCount) {
        return;
      }

      if (!state.graph) {
        searchResults.innerHTML = `<li class="result-empty">Load a graph or stripped folder first.</li>`;
        catalogBranchTitle.textContent = "No catalog loaded";
        catalogBranchCount.textContent = "";
        return;
      }

      const selectedBranch = getSelectedCatalogBranch();
      catalogBranchTitle.textContent = selectedBranch ? selectedBranch.label : "All craftable";
      catalogBranchCount.textContent = `${formatNumber(state.searchResults.length)} visible`;

      if (!state.searchResults.length) {
        searchResults.innerHTML = `<li class="result-empty">No craftable items in this catalog branch.</li>`;
        return;
      }

      searchResults.innerHTML = state.searchResults
        .map((item) => {
          const isSelected = Number(state.selectedTypeID) === Number(item.typeID);
          return `
            <li>
              <button class="result-button${isSelected ? " is-selected" : ""}" data-type-id="${item.typeID}">
                <span class="result-name">${renderItemMarkup(item.name, item.typeID)}</span>
                <span class="result-meta">typeID ${item.typeID} · ${item.groupID !== null ? `Group ${item.groupID}` : "Ungrouped"}</span>
              </button>
            </li>
          `;
        })
        .join("");

      hydrateIcons(searchResults, state.iconArchive);
    }

    function recomputeCalculation(resetExpansion = false) {
      if (!state.graph || !state.selectedTypeID) {
        state.currentSummary = null;
        state.currentTree = null;
        state.currentRollup = null;
        state.currentProgressSections = null;
        state.currentProgressLookup = new Map();
        state.currentPlanKey = null;
        state.progressByTypeID = {};
        return;
      }

      state.currentSummary = createRecipeSummary(
        state.graph,
        state.selectedTypeID,
        state.requestedQuantity,
        state.recipeSelections,
      );
      state.currentTree = buildDependencyTree(
        state.graph,
        state.selectedTypeID,
        state.requestedQuantity,
        state.recipeSelections,
      );
      state.currentRollup = rollupDependencyTree(state.currentTree);
      syncPlanProgressFromStorage();

      const validIds = new Set(collectExpandableNodeIds(state.currentTree));
      if (resetExpansion || !state.expandedNodeIds.size) {
        state.expandedNodeIds = getDefaultExpandedNodeIds(state.currentTree);
        return;
      }

      state.expandedNodeIds = new Set(
        Array.from(state.expandedNodeIds).filter((nodeId) => validIds.has(nodeId)),
      );

      if (!state.expandedNodeIds.size) {
        state.expandedNodeIds = getDefaultExpandedNodeIds(state.currentTree);
      }
    }

    function renderSummary() {
      if (!summaryRecipeField || !summaryRecipeSelect) {
        return;
      }

      if (!state.currentSummary) {
        summaryRecipeField.hidden = true;
        summaryRecipeSelect.innerHTML = "";
        return;
      }

      const summary = state.currentSummary;

      if (summary.availableRecipes.length > 1) {
        summaryRecipeField.hidden = false;
        summaryRecipeSelect.innerHTML = summary.availableRecipes
          .map((recipe) => `<option value="${recipe.blueprintID}">${escapeHtml(buildRecipeOptionLabel(state.graph, recipe, summary.item.typeID))}</option>`)
          .join("");
        summaryRecipeSelect.value = String(summary.recipe.blueprintID);
      } else {
        summaryRecipeField.hidden = true;
        summaryRecipeSelect.innerHTML = "";
      }
    }

    function renderTree() {
      if (!treePreview || !outlineMeta) {
        return;
      }

      if (!state.currentTree) {
        treePreview.innerHTML = `<p>Load data and select a craftable item to start exploring the chain.</p>`;
        outlineMeta.textContent = "Collapsed";
        return;
      }

      const markup = renderDependencyOutlineMarkup(state.currentTree, state.currentProgressLookup, {
        hideCovered: state.hideCovered,
        maxDepth: state.treeDepth,
        showRecipeDetails: state.showRecipeDetails,
        showTrackedStatus: state.showTrackedStatus,
        activeRecipeChooserTypeID: state.activeRecipeChooserTypeID,
        graph: state.graph,
        expandedNodeIds: state.expandedNodeIds,
      });
      const rowCount = (markup.match(/class="outline-row/g) || []).length;
      const toolbarBits = [];
      if (state.showRecipeDetails) {
        toolbarBits.push("Recipe details");
      }
      if (state.showTrackedStatus) {
        toolbarBits.push("Tracked status");
      }
      toolbarBits.push(state.hideCovered ? "Covered hidden" : "All visible");
      toolbarBits.push(state.treeDepth ? `Depth ${state.treeDepth}` : "All depths");
      outlineMeta.textContent = `${rowCount} rows`;
      const toolbarPillsMarkup = toolbarBits
        .map((bit) => `<span class="outline-toolbar-pill">${escapeHtml(bit)}</span>`)
        .join("");
      const statusLegendMarkup = state.showTrackedStatus
        ? `
          <div class="outline-toolbar-legend" aria-hidden="true">
            <span class="outline-legend-item"><span class="outline-legend-dot ready"></span>Ready</span>
            <span class="outline-legend-item"><span class="outline-legend-dot partial"></span>Partial</span>
            <span class="outline-legend-item"><span class="outline-legend-dot missing"></span>Missing</span>
          </div>
        `
        : "";
      treePreview.innerHTML = `
        <div class="outline-toolbar">
          <div class="outline-toolbar-primary">
            ${toolbarPillsMarkup}
          </div>
          <div class="outline-toolbar-secondary">
            <span class="outline-toolbar-count">${formatNumber(rowCount)} rows</span>
            ${statusLegendMarkup}
          </div>
        </div>
        ${markup}
      `;
      hydrateIcons(treePreview, state.iconArchive);
    }

    function renderPlanWorkspace() {
      if (!materialsList || !componentsList || !materialsMeta || !componentsMeta || !nextActionsContent || !bottleneckContent) {
        return;
      }

      if (!state.currentProgressSections) {
        nextActionsContent.innerHTML = `<p class="workspace-empty">Choose a target to surface immediate work.</p>`;
        bottleneckContent.innerHTML = `<p class="workspace-empty">No bottleneck yet.</p>`;
        materialsList.innerHTML = `<p class="workspace-empty">Choose a target to generate the mining list.</p>`;
        componentsList.innerHTML = `<p class="workspace-empty">Choose a target to generate production work.</p>`;
        materialsMeta.textContent = "";
        componentsMeta.textContent = "";
        return;
      }

      const nextActions = buildNextActions(state.currentProgressSections);
      const bottleneck = getBottleneckLine(state.currentProgressSections);
      nextActionsContent.innerHTML = renderActionCardsMarkup(nextActions);
      bottleneckContent.innerHTML = renderBottleneckMarkup(bottleneck);

      materialsMeta.textContent = `${formatNumber(state.currentProgressSections.baseMaterials.length)} tracked`;
      componentsMeta.textContent = `${formatNumber(state.currentProgressSections.directComponents.length)} tracked`;
      materialsList.innerHTML = renderCompactProgressListMarkup(
        "Materials",
        state.currentProgressSections.baseMaterials,
        {
          expanded: state.workspaceUi.expandedLists.materials,
          listKey: "materials",
          emptyMessage: "No raw materials required",
          interactive: true,
          doneLabel: "mined",
        },
      );
      componentsList.innerHTML = renderCompactProgressListMarkup(
        "Components",
        state.currentProgressSections.directComponents,
        {
          expanded: state.workspaceUi.expandedLists.components,
          listKey: "components",
          emptyMessage: "No components required",
          interactive: true,
          doneLabel: "produced",
        },
      );
      hydrateIcons(materialsList, state.iconArchive);
      hydrateIcons(componentsList, state.iconArchive);
    }

    function renderPipelineWorkspace() {
      if (!dependencyPipelineContent) {
        return;
      }

      if (!state.currentTree) {
        dependencyPipelineContent.innerHTML = `<p class="workspace-empty">Select a target to inspect the production pipeline.</p>`;
      } else {
        dependencyPipelineContent.innerHTML = renderDependencyPipelineMarkup(state.currentTree);
        hydrateIcons(dependencyPipelineContent, state.iconArchive);
      }
    }

    function patchRenderedProgressListRow(container, typeID) {
      const trackedLine = state.currentProgressLookup.get(Number(typeID));
      if (!container || !trackedLine) {
        return;
      }

      const row = container.querySelector(`[data-progress-line-type-id="${Number(typeID)}"]`);
      if (!row) {
        return;
      }

      const amount = row.querySelector(".progress-list-amount");
      if (amount) {
        amount.textContent = `${formatNumber(trackedLine.remaining)} left`;
      }

      const stats = row.querySelector(".progress-list-stats");
      if (stats) {
        const doneLabel = container === componentsList ? "Produced" : "Mined";
        stats.innerHTML = `<span>Need ${formatNumber(trackedLine.need)}</span><span>${doneLabel} ${formatNumber(trackedLine.have)}</span>`;
      }

      const fill = row.querySelector(".progress-track-fill");
      if (fill) {
        fill.style.width = `${Math.max(0, Math.min(100, Number(trackedLine.progressPercent) || 0))}%`;
      }

      const input = row.querySelector(`[data-progress-have-type-id="${Number(typeID)}"]`);
      if (input && input !== document.activeElement) {
        input.value = String(Number(trackedLine.have) || 0);
      }

      const toggle = row.querySelector(`[data-progress-complete-type-id="${Number(typeID)}"]`);
      if (toggle) {
        toggle.checked = trackedLine.status === "ready";
      }
    }

    function renderWorkspaceChrome() {
      const isPlan = state.workspaceUi.activeWorkspaceTab === "plan";
      const isPipeline = state.workspaceUi.activeWorkspaceTab === "pipeline";
      const isTree = state.workspaceUi.activeWorkspaceTab === "tree";
      const isDefaultRecipes = state.workspaceUi.activeWorkspaceTab === "default-recipes";
      if (workspaceTabPlan) {
        workspaceTabPlan.classList?.toggle("is-active", isPlan);
        workspaceTabPlan.setAttribute("aria-selected", String(isPlan));
      }
      if (workspaceTabPipeline) {
        workspaceTabPipeline.classList?.toggle("is-active", isPipeline);
        workspaceTabPipeline.setAttribute("aria-selected", String(isPipeline));
      }
      if (workspaceTabTree) {
        workspaceTabTree.classList?.toggle("is-active", isTree);
        workspaceTabTree.setAttribute("aria-selected", String(isTree));
      }
      if (workspaceTabDefaultRecipes) {
        workspaceTabDefaultRecipes.classList?.toggle("is-active", isDefaultRecipes);
        workspaceTabDefaultRecipes.setAttribute("aria-selected", String(isDefaultRecipes));
      }
      if (planWorkspacePanel) {
        planWorkspacePanel.hidden = !isPlan;
      }
      if (pipelineWorkspacePanel) {
        pipelineWorkspacePanel.hidden = !isPipeline;
      }
      if (treeWorkspacePanel) {
        treeWorkspacePanel.hidden = !isTree;
      }
      if (defaultRecipeWorkspacePanel) {
        defaultRecipeWorkspacePanel.hidden = !isDefaultRecipes;
      }

      if (datasetDrawer) {
        datasetDrawer.hidden = state.workspaceUi.openDrawer !== "dataset";
      }
      if (filtersDrawer) {
        filtersDrawer.hidden = state.workspaceUi.openDrawer !== "filters";
      }
      if (defaultRecipePathsDrawer) {
        defaultRecipePathsDrawer.hidden = state.workspaceUi.openDrawer !== "default-recipes";
      }
      if (viewDrawer) {
        viewDrawer.hidden = state.workspaceUi.openDrawer !== "view";
      }
      if (dataUploadModal) {
        dataUploadModal.hidden = !state.workspaceUi.isUploadModalOpen;
      }
    }

    function renderAll() {
      plannerRuntime.setRecipeOptionsByType(buildPlannerRecipeOptionsByTypeFromGraph(state.graph));
      renderWorkspaceHeader();
      renderSnapshotMetrics();
      renderActiveTargetCard();
      renderCatalogTree();
      renderSelectedItemCard();
      renderManagedDefaultRecipePresets();
      renderManagedDefaultRecipeWorkspace();
      renderSearchResults();
      renderSummary();
      renderTree();
      renderPlanWorkspace();
      renderPipelineWorkspace();
      renderWorkspaceChrome();
      renderPlannerShell();
    }

    function setGraph(graph, sourceLabel) {
      state.graph = graph;
      state.catalog = buildCatalogTree(graph);
      syncManagedDefaultPresetState();
      state.selectedCatalogBranchKey = "all";
      state.searchQuery = "";
      state.selectedTypeID = null;
      state.requestedQuantity = 1;
      state.recipeSelections = mergeManagedDefaultRecipeSelections(state.managedDefaultRecipePresets);
      state.activeRecipeChooserTypeID = null;
      state.expandedNodeIds = new Set();
      state.currentTree = null;
      state.currentRollup = null;
      state.currentSummary = null;
      state.currentProgressSections = null;
      state.currentProgressLookup = new Map();
      state.progressByTypeID = {};
      state.currentPlanKey = null;
      state.workspaceUi = reduceCalculatorWorkspaceState(state.workspaceUi, {
        type: "close-overlays",
      });

      if (searchInput) {
        searchInput.disabled = false;
        searchInput.value = "";
        searchInput.placeholder = "Search item or typeID";
      }
      if (quantityInput) {
        quantityInput.disabled = false;
        quantityInput.value = "1";
      }

      updateSearchResults();
      renderAll();
      setStatus(sourceLabel, "ready");
    }

    async function handleIconZipSelection(event) {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setStatus(`Loading icon archive ${file.name}...`, "loading");

      try {
        state.iconArchive = await createIconArchive(file);
        renderAll();
        setStatus(`Icons loaded: ${file.name}`, "ready");
      } catch (error) {
        setStatus(`Failed to load icon ZIP: ${error.message}`, "error");
      }
    }

    async function handleGraphFileSelection(event) {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setStatus(`Loading ${file.name}...`, "loading");

      try {
        const graph = await readJsonFile(file);
        setGraph(graph, `Graph loaded: ${file.name}`);
      } catch (error) {
        setStatus(`Failed to load graph: ${error.message}`, "error");
      }
    }

    async function handleFolderSelection(event) {
      const files = Array.from(event.target.files || []);
      if (!files.length) {
        return;
      }

      setStatus("Building runtime graph from stripped folder...", "loading");

      try {
        const graph = await createGraphFromFolderFiles(files);
        setGraph(graph, `Stripped folder loaded: ${graph.meta.snapshot}`);
      } catch (error) {
        setStatus(`Failed to load stripped folder: ${error.message}`, "error");
      }
    }

    function handleSearchInput(event) {
      if (!state.graph) {
        return;
      }

      state.searchQuery = event.target.value;
      updateSearchResults();
      renderSearchResults();
    }

    function handleCatalogClick(event) {
      const target = getEventTargetElement(event);
      const button = target?.closest("[data-catalog-branch-key]");
      if (!button || !state.graph) {
        return;
      }

      state.selectedCatalogBranchKey = button.dataset.catalogBranchKey || "all";
      updateSearchResults();
      renderCatalogTree();
      renderSearchResults();
    }

    function handleSearchSelection(event) {
      const target = getEventTargetElement(event);
      const button = target?.closest("[data-type-id]");
      if (!button) {
        return;
      }

      state.selectedTypeID = Number(button.dataset.typeId);
      state.recipeSelections = mergeManagedDefaultRecipeSelections(state.managedDefaultRecipePresets);
      state.activeRecipeChooserTypeID = null;
      state.requestedQuantity = normalizeQuantity(quantityInput?.value || 1);
      state.workspaceUi = reduceCalculatorWorkspaceState(state.workspaceUi, {
        type: "set-workspace-tab",
        tab: "plan",
      });
      recomputeCalculation(true);
      renderAll();
    }

    function handleQuantityInput(event) {
      state.requestedQuantity = normalizeQuantity(event.target.value);
      event.target.value = String(state.requestedQuantity);
      recomputeCalculation(false);
      renderAll();
    }

    function handleRecipeSelection(typeID, recipeID) {
      state.recipeSelections[typeID] = Number(recipeID);
      state.activeRecipeChooserTypeID = null;
      recomputeCalculation(false);
      renderAll();
    }

    function handleManagedDefaultRecipeSelection(rootKey, typeID, recipeID) {
      const preset = getManagedDefaultPresetByKey(rootKey);
      if (!preset) {
        return;
      }

      state.managedDefaultStoredSelections = {
        ...state.managedDefaultStoredSelections,
        [rootKey]: {
          ...preset.recipeSelections,
          [Number(typeID)]: Number(recipeID),
        },
      };
      persistManagedDefaultPresetSelections();
      syncManagedDefaultPresetState();
      state.activeManagedDefaultRecipeChooserRootKey = null;
      state.activeManagedDefaultRecipeChooserTypeID = null;
      state.recipeSelections = mergeRecipeSelectionsWithManagedDefaults(
        state.recipeSelections,
        mergeManagedDefaultRecipeSelections(state.managedDefaultRecipePresets),
        state.managedDefaultRecipePresets,
      );
      if (state.graph && state.selectedTypeID) {
        recomputeCalculation(false);
      }
      renderAll();
    }

    function handleTreeClick(event) {
      const target = getEventTargetElement(event);
      const recipeToggleButton = target?.closest("[data-outline-recipe-toggle-type-id]");
      if (recipeToggleButton) {
        const typeID = Number(recipeToggleButton.dataset.outlineRecipeToggleTypeId);
        state.activeRecipeChooserTypeID = Number(state.activeRecipeChooserTypeID) === typeID ? null : typeID;
        renderTree();
        return;
      }

      const rowToggle = target?.closest("[data-outline-row-toggle-node-id]");
      if (rowToggle) {
        const nodeId = rowToggle.dataset.outlineRowToggleNodeId;
        if (state.expandedNodeIds.has(nodeId)) {
          state.expandedNodeIds.delete(nodeId);
        } else {
          state.expandedNodeIds.add(nodeId);
        }
        renderTree();
        return;
      }

      const treeAction = target?.closest("[data-tree-action]");
      if (!treeAction || !state.currentTree) {
        return;
      }

      const action = treeAction.dataset.treeAction;
      if (action === "expand-all") {
        state.expandedNodeIds = new Set(collectExpandableNodeIds(state.currentTree));
        renderTree();
      } else if (action === "collapse-all") {
        state.expandedNodeIds = new Set([state.currentTree.nodeId]);
        renderTree();
      }
    }

    function handleManagedDefaultPresetClick(event) {
      const target = getEventTargetElement(event);
      const rootSelectButton = target?.closest("[data-managed-default-root-select-key]");
      if (rootSelectButton) {
        const rootKey = rootSelectButton.dataset.managedDefaultRootSelectKey || "";
        state.managedDefaultActivePresetRootKey = rootKey;
        renderManagedDefaultRecipePresets();
        return;
      }
    }

    function handleOutlineRecipeChange(event) {
      const target = getEventTargetElement(event);
      const select = target?.closest("[data-outline-recipe-type-id]");
      if (!select) {
        return;
      }
      handleRecipeSelection(Number(select.dataset.outlineRecipeTypeId), select.value);
    }

    function handleManagedDefaultRecipeChange(event) {
      const target = getEventTargetElement(event);
      const select = target?.closest("[data-default-preset-recipe-type-id]");
      if (!select) {
        return;
      }
      handleManagedDefaultRecipeSelection(
        select.dataset.defaultPresetRootKey || "",
        Number(select.dataset.defaultPresetRecipeTypeId),
        select.value,
      );
    }

    function handleManagedDefaultDrawerChange(event) {
      const target = getEventTargetElement(event);
      const input = target?.closest("[data-managed-default-drawer-option-type-id]");
      if (!input) {
        return;
      }

      handleManagedDefaultRecipeSelection(
        input.dataset.managedDefaultDrawerOptionRootKey || "",
        Number(input.dataset.managedDefaultDrawerOptionTypeId),
        input.value,
      );
    }

    function handleManagedDefaultWorkspaceClick(event) {
      const target = getEventTargetElement(event);
      const rootSelectButton = target?.closest("[data-managed-default-workspace-root-select-key]");
      if (!rootSelectButton) {
        return;
      }

      state.managedDefaultActivePresetRootKey = rootSelectButton.dataset.managedDefaultWorkspaceRootSelectKey || "";
      renderManagedDefaultRecipeWorkspace();
    }

    function handleManagedDefaultWorkspaceChange(event) {
      const target = getEventTargetElement(event);
      const input = target?.closest("[data-managed-default-workspace-option-type-id]");
      if (!input) {
        return;
      }

      handleManagedDefaultRecipeSelection(
        input.dataset.managedDefaultWorkspaceOptionRootKey || "",
        Number(input.dataset.managedDefaultWorkspaceOptionTypeId),
        input.value,
      );
    }

    function handleSummaryRecipeChange(event) {
      if (!state.selectedTypeID) {
        return;
      }
      handleRecipeSelection(state.selectedTypeID, event.target.value);
    }

    function handleProgressInput(event) {
      const target = getEventTargetElement(event);
      const input = target?.closest("[data-progress-have-type-id]");
      if (!input || !state.currentPlanKey) {
        return;
      }

      const typeID = Number(input.dataset.progressHaveTypeId);
      updateProgressInputValue({
        state,
        typeID,
        value: input.value,
        refreshProgressState,
        persistCurrentPlanProgress,
        renderActiveTargetCard() {
          renderActiveTargetCard();
          renderWorkspaceHeader();
        },
        renderTree,
      });
      patchRenderedProgressListRow(materialsList, typeID);
      patchRenderedProgressListRow(componentsList, typeID);
    }

    function handleProgressCommit(event) {
      const target = getEventTargetElement(event);
      const input = target?.closest("[data-progress-have-type-id]");
      if (!input || !state.currentPlanKey) {
        return;
      }
      renderAll();
    }

    function handleProgressToggle(event) {
      const target = getEventTargetElement(event);
      const toggle = target?.closest("[data-progress-complete-type-id]");
      if (!toggle || !state.currentPlanKey) {
        return;
      }

      const typeID = Number(toggle.dataset.progressCompleteTypeId);
      const trackedLine = state.currentProgressLookup.get(typeID);
      state.progressByTypeID[typeID] = toggle.checked ? trackedLine?.need || 0 : 0;
      refreshProgressState();
      persistCurrentPlanProgress();
      renderAll();
    }

    function handleTreeViewChange() {
      state.treeDepth = treeDepthSelect?.value ? Number(treeDepthSelect.value) : null;
      state.hideCovered = Boolean(hideCoveredToggle?.checked);
      state.showRecipeDetails = Boolean(showRecipeDetailsToggle?.checked);
      state.showTrackedStatus = Boolean(showTrackedStatusToggle?.checked);
      renderTree();
      renderPipelineWorkspace();
    }

    function handleWorkspaceTabChange(event) {
      const target = getEventTargetElement(event);
      const button = target?.closest("[data-workspace-tab]");
      if (!button) {
        return;
      }

      state.workspaceUi = reduceCalculatorWorkspaceState(state.workspaceUi, {
        type: "set-workspace-tab",
        tab: button.dataset.workspaceTab,
      });
      renderWorkspaceChrome();
      renderPipelineWorkspace();
    }

    function toggleDrawer(drawer) {
      state.workspaceUi = reduceCalculatorWorkspaceState(state.workspaceUi, {
        type: "toggle-drawer",
        drawer,
      });
      renderWorkspaceChrome();
    }

    function handleOverlayClose(event) {
      const target = getEventTargetElement(event);
      const closeButton = target?.closest("[data-close-overlay]");
      if (!closeButton) {
        return;
      }

      state.workspaceUi = reduceCalculatorWorkspaceState(state.workspaceUi, {
        type: "close-overlays",
      });
      renderWorkspaceChrome();
    }

    function handleUploadModalToggle() {
      state.workspaceUi = reduceCalculatorWorkspaceState(state.workspaceUi, {
        type: "toggle-upload-modal",
      });
      renderWorkspaceChrome();
    }

    function handlePlanListToggle(event) {
      const target = getEventTargetElement(event);
      const button = target?.closest("[data-progress-list-toggle]");
      if (!button) {
        return;
      }

      state.workspaceUi = reduceCalculatorWorkspaceState(state.workspaceUi, {
        type: "toggle-list",
        listKey: button.dataset.progressListToggle,
      });
      renderPlanWorkspace();
    }

    function handleModeSwitch(event) {
      const target = getEventTargetElement(event);
      const button = target?.closest("[data-mode]");
      if (!button) {
        return;
      }
      plannerRuntime.setMode(button.dataset.mode);
      state.workspaceUi = reduceCalculatorWorkspaceState(state.workspaceUi, {
        type: "close-overlays",
      });
      renderWorkspaceChrome();
      renderPlannerShell();
    }

    function handlePlannerAddLine() {
      plannerRuntime.addLine({ outputTypeId: 1, quantity: 1 });
      renderPlannerShell();
    }

    function handlePlannerLineEvent(event) {
      const target = getEventTargetElement(event);
      const addButton = target?.closest("[data-planner-add-type-id]");
      if (addButton) {
        plannerRuntime.addLine({
          outputTypeId: Number(addButton.dataset.plannerAddTypeId),
          quantity: 1,
        });
        renderPlannerShell();
        return;
      }

      const removeButton = target?.closest("[data-planner-remove-line-id]");
      if (removeButton) {
        plannerRuntime.removeLine(removeButton.dataset.plannerRemoveLineId);
        renderPlannerShell();
        return;
      }

      const quantityInputNode = target?.closest("[data-planner-quantity-line-id]");
      if (quantityInputNode) {
        plannerRuntime.updateLineQuantity(
          quantityInputNode.dataset.plannerQuantityLineId,
          quantityInputNode.value,
        );
        renderPlannerShell();
      }
    }

    function handlePlannerCatalogSearch() {
      renderPlannerShell();
    }

    function handlePlannerDecisionEvent(event) {
      const target = getEventTargetElement(event);
      const decisionInput = target?.closest("[data-planner-decision-blueprint-id]");
      if (!decisionInput) {
        return;
      }

      plannerRuntime.selectRecipe(
        decisionInput.dataset.plannerDecisionOptionTypeId,
        decisionInput.dataset.plannerDecisionBlueprintId,
      );
      renderPlannerShell();
    }

    function handlePlannerOutputEvent(event) {
      const target = getEventTargetElement(event);
      const decisionRow = target?.closest("[data-planner-focus-decision-type-id]");
      if (!decisionRow) {
        return;
      }

      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") {
        return;
      }
      if (event.type === "keydown") {
        event.preventDefault();
      }

      if (focusPlannerDecisionFromOutput(plannerRuntime, decisionRow.dataset.plannerFocusDecisionTypeId)) {
        renderPlannerShell();
      }
    }

    graphFileInput?.addEventListener("change", handleGraphFileSelection);
    folderInput?.addEventListener("change", handleFolderSelection);
    iconZipInput?.addEventListener("change", handleIconZipSelection);
    openUploadModalButton?.addEventListener("click", handleUploadModalToggle);
    openDatasetDrawerButton?.addEventListener("click", () => toggleDrawer("dataset"));
    openFiltersDrawerButton?.addEventListener("click", () => toggleDrawer("filters"));
    openDefaultRecipePathsDrawerButton?.addEventListener("click", () => toggleDrawer("default-recipes"));
    openViewDrawerButton?.addEventListener("click", () => toggleDrawer("view"));
    searchInput?.addEventListener("input", handleSearchInput);
    catalogTree?.addEventListener("click", handleCatalogClick);
    searchResults?.addEventListener("click", handleSearchSelection);
    quantityInput?.addEventListener("input", handleQuantityInput);
    summaryRecipeSelect?.addEventListener("change", handleSummaryRecipeChange);
    defaultRecipePresetsList?.addEventListener("click", handleManagedDefaultPresetClick);
    defaultRecipePresetsList?.addEventListener("change", handleManagedDefaultRecipeChange);
    defaultRecipePresetsList?.addEventListener("change", handleManagedDefaultDrawerChange);
    workspaceTabPlan?.addEventListener("click", handleWorkspaceTabChange);
    workspaceTabPipeline?.addEventListener("click", handleWorkspaceTabChange);
    workspaceTabTree?.addEventListener("click", handleWorkspaceTabChange);
    workspaceTabDefaultRecipes?.addEventListener("click", handleWorkspaceTabChange);
    treePreview?.addEventListener("click", handleTreeClick);
    treePreview?.addEventListener("change", handleOutlineRecipeChange);
    defaultRecipeWorkspaceContent?.addEventListener("click", handleManagedDefaultWorkspaceClick);
    defaultRecipeWorkspaceContent?.addEventListener("change", handleManagedDefaultWorkspaceChange);
    viewDrawer?.addEventListener("click", handleTreeClick);
    datasetDrawer?.addEventListener("click", handleOverlayClose);
    filtersDrawer?.addEventListener("click", handleOverlayClose);
    defaultRecipePathsDrawer?.addEventListener("click", handleOverlayClose);
    viewDrawer?.addEventListener("click", handleOverlayClose);
    dataUploadModal?.addEventListener("click", handleOverlayClose);
    materialsList?.addEventListener("click", handlePlanListToggle);
    materialsList?.addEventListener("input", handleProgressInput);
    materialsList?.addEventListener("change", handleProgressCommit);
    materialsList?.addEventListener("change", handleProgressToggle);
    componentsList?.addEventListener("click", handlePlanListToggle);
    componentsList?.addEventListener("input", handleProgressInput);
    componentsList?.addEventListener("change", handleProgressCommit);
    componentsList?.addEventListener("change", handleProgressToggle);
    treeDepthSelect?.addEventListener("change", handleTreeViewChange);
    hideCoveredToggle?.addEventListener("change", handleTreeViewChange);
    showRecipeDetailsToggle?.addEventListener("change", handleTreeViewChange);
    showTrackedStatusToggle?.addEventListener("change", handleTreeViewChange);
    modeCalculatorButton?.addEventListener("click", handleModeSwitch);
    modePlannerButton?.addEventListener("click", handleModeSwitch);
    plannerAddLine?.addEventListener("click", handlePlannerAddLine);
    plannerCatalogSearch?.addEventListener("input", handlePlannerCatalogSearch);
    plannerCatalogResults?.addEventListener("click", handlePlannerLineEvent);
    plannerLines?.addEventListener("click", handlePlannerLineEvent);
    plannerLines?.addEventListener("input", handlePlannerLineEvent);
    plannerRawMaterials?.addEventListener("click", handlePlannerOutputEvent);
    plannerRawMaterials?.addEventListener("keydown", handlePlannerOutputEvent);
    plannerComponents?.addEventListener("click", handlePlannerOutputEvent);
    plannerComponents?.addEventListener("keydown", handlePlannerOutputEvent);
    plannerDecisions?.addEventListener("change", handlePlannerDecisionEvent);

    plannerRuntime.load();
    renderPlannerShell();
    renderAll();
  }

  const api = {
    buildCatalogTree,
    buildPlannerDependencyNode,
    buildDependencyPipelineGroups,
    buildNextActions,
    buildGraphFromStrippedData,
    buildDependencyTree,
    buildManagedDefaultRecipePresets,
    buildManagedDefaultPresetCardMarkup,
    buildManagedDefaultPresetDetailMarkup,
    buildPlanStorageKey,
    buildProgressSections,
    buildRecipeOptionLabel,
    createCalculatorWorkspaceState,
    createGraphFromFolderFiles,
    createRecipeSummary,
    filterCatalogItems,
    getBottleneckLine,
    getAvailableRecipesForType,
    getProgressStatus,
    loadStoredPlanProgress,
    mergeManagedDefaultRecipeSelections,
    reduceCalculatorWorkspaceState,
    renderCompactProgressListMarkup,
    renderDependencyOutlineMarkup,
    renderDependencyPipelineMarkup,
    renderProgressTableMarkup,
    renderSelectedTargetMarkup,
    renderPlannerDecisionPanelMarkup,
    renderManagedDefaultRecipePathsMarkup,
    resolveRecipeChoice,
    rollupDependencyTree,
    saveStoredPlanProgress,
    searchCraftableItems,
    searchPlannerCatalog,
    shouldDataSectionBeOpen,
    summarizeWorkspaceHeader,
    buildPlannerLineViewModels,
    focusPlannerDecisionFromOutput,
    filterManagedDefaultRecipePresetsForSelection,
    renderPlannerAggregatedOutputMarkup,
    renderPlannerLinesMarkup,
    renderManagedDefaultRecipeWorkspaceMarkup,
    updateProgressInputValue,
    createPlannerRuntime,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (typeof document !== "undefined") {
    bindBrowserApp();
  }

  globalScope.FrontierIndustryCalculator = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
