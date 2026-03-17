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

  function buildGraphFromStrippedData(snapshot, typesData, blueprintsData) {
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
        name: record.name ?? `Type ${typeId}`,
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
    };
  }

  function getItem(graph, typeID) {
    return graph?.items?.[typeID] ?? graph?.items?.[String(typeID)] ?? null;
  }

  function getRecipe(graph, blueprintID) {
    return graph?.recipes?.[blueprintID] ?? graph?.recipes?.[String(blueprintID)] ?? null;
  }

  function getAvailableRecipesForType(graph, typeID) {
    const recipeIds = graph?.recipesByOutput?.[typeID] ?? graph?.recipesByOutput?.[String(typeID)] ?? [];
    return recipeIds.map((recipeID) => getRecipe(graph, recipeID)).filter(Boolean);
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
    return Object.values(graph?.items || {})
      .filter((item) => item?.isCraftable && typeof item.name === "string")
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

  function buildProgressSections(rollup, progressMap = {}) {
    const directComponents = (rollup?.directComponents || []).map((line) => createProgressLine(line, progressMap));
    const baseMaterials = (rollup?.baseMaterials || []).map((line) => createProgressLine(line, progressMap));

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

    return `BP ${recipe.blueprintID} · out ${formatNumber(outputQuantity)} · ${runtime} · ${keyInput}`;
  }

  function buildRecipeChoiceSummary(recipe, typeID) {
    if (!recipe) {
      return "Base";
    }

    const selectedOutput = getRecipeOutputForType(recipe, typeID);
    const outputQuantity = Math.max(1, Number(selectedOutput?.quantity) || 1);
    return `BP ${recipe.blueprintID} · out ${formatNumber(outputQuantity)} · ${formatRuntime(recipe.runTime || 0)}`;
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
      showBlueprintIds = true,
      showTrackedStatus = true,
      activeRecipeChooserTypeID = null,
      graph = null,
      expandedNodeIds = new Set(),
    } = options;

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
      const rowClasses = [
        "outline-row",
        recipeCount > 1 ? "has-alternates" : "",
      ].filter(Boolean).join(" ");
      const pillMarkup = [];

      if (showBlueprintIds || !node.recipe) {
        pillMarkup.push(`
          <span class="outline-pill">${escapeHtml(node.recipe ? `BP ${node.recipe.blueprintID}` : "Base")}</span>
        `);
      }

      if (recipeCount > 1) {
        pillMarkup.push(`
          <button
            type="button"
            class="outline-pill outline-pill-alt outline-recipe-toggle${showRecipeChooser ? " is-open" : ""}"
            data-outline-recipe-toggle-type-id="${node.typeID}"
            aria-label="Choose recipe for ${escapeHtml(node.item.name)}"
          >
            ${formatNumber(recipeCount)} recipes
          </button>
        `);
        pillMarkup.push(`<span class="outline-pill outline-pill-choice">${escapeHtml(buildRecipeChoiceSummary(node.recipe, node.typeID))}</span>`);
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
              <select class="text-input outline-recipe-select" data-outline-recipe-type-id="${node.typeID}">
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

      return `
        <div class="${rowClasses}" data-depth="${node.depth}" style="--depth:${node.depth}">
          <button
            type="button"
            class="outline-toggle${canExpand ? "" : " is-disabled"}"
            data-toggle-node-id="${node.nodeId}"
            ${canExpand ? "" : "disabled"}
          >
            ${canExpand ? (isExpanded ? "−" : "+") : "·"}
          </button>
          <div class="outline-main">
            <span class="item-icon" data-icon-type-id="${node.item.typeID}" data-icon-fallback="${escapeHtml(getIconFallbackLabel(node.item.name))}">
              ${escapeHtml(getIconFallbackLabel(node.item.name))}
            </span>
            <span class="outline-name">${escapeHtml(node.item.name)}</span>
          </div>
          <span class="outline-qty">${formatNumber(node.requestedQuantity)}</span>
          <span class="outline-runs">${node.recipe ? `${formatNumber(node.runsNeeded)}r` : "raw"}</span>
          ${pillMarkup.join("")}
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

    if (!typesFile || !blueprintsFile) {
      throw new Error("Folder must contain both types.json and industry_blueprints.json");
    }

    const [typesData, blueprintsData] = await Promise.all([
      readJsonFile(typesFile),
      readJsonFile(blueprintsFile),
    ]);

    return buildGraphFromStrippedData(
      inferSnapshotFromFolderFiles(files),
      typesData,
      blueprintsData,
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

  function bindBrowserApp() {
    const dataSection = document.getElementById("dataSection");
    const graphFileInput = document.getElementById("graphFile");
    const folderInput = document.getElementById("folderInput");
    const iconZipInput = document.getElementById("iconZipFile");
    const statusPill = document.getElementById("statusPill");
    const searchInput = document.getElementById("searchInput");
    const searchResults = document.getElementById("searchResults");
    const catalogTree = document.getElementById("catalogTree");
    const catalogBranchTitle = document.getElementById("catalogBranchTitle");
    const catalogBranchCount = document.getElementById("catalogBranchCount");
    const selectedItemCard = document.getElementById("selectedItemCard");
    const quantityInput = document.getElementById("quantityInput");
    const summaryEmpty = document.getElementById("summaryEmpty");
    const summaryContent = document.getElementById("summaryContent");
    const summaryTitle = document.getElementById("summaryTitle");
    const summaryMeta = document.getElementById("summaryMeta");
    const summaryRecipeField = document.getElementById("summaryRecipeField");
    const summaryRecipeSelect = document.getElementById("summaryRecipeSelect");
    const rawMaterialsPreview = document.getElementById("rawMaterialsPreview");
    const componentsPreview = document.getElementById("componentsPreview");
    const rawMaterialsCount = document.getElementById("rawMaterialsCount");
    const componentsCount = document.getElementById("componentsCount");
    const dependencyOutlineSection = document.getElementById("dependencyOutlineSection");
    const treePreview = document.getElementById("treePreview");
    const outlineMeta = document.getElementById("outlineMeta");
    const snapshotMetrics = document.getElementById("snapshotMetrics");
    const activeTargetCard = document.getElementById("activeTargetCard");
    const summaryRail = document.getElementById("summaryRail");
    const treeDepthSelect = document.getElementById("treeDepthSelect");
    const hideCoveredToggle = document.getElementById("hideCoveredToggle");
    const showRecipeDetailsToggle = document.getElementById("showRecipeDetailsToggle");
    const showBlueprintIdsToggle = document.getElementById("showBlueprintIdsToggle");
    const showTrackedStatusToggle = document.getElementById("showTrackedStatusToggle");
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
      showBlueprintIds: true,
      showTrackedStatus: true,
    };

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

      state.currentProgressSections = buildProgressSections(state.currentRollup, state.progressByTypeID);
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
        <div class="summary-row"><span class="summary-key">Quantity</span><strong>${formatNumber(state.currentSummary.requestedQuantity)}</strong></div>
        <div class="summary-row"><span class="summary-key">Recipe</span><strong>BP ${state.currentSummary.recipe.blueprintID}</strong></div>
        ${state.currentSummary.availableRecipes.length > 1
          ? `<div class="summary-row"><span class="summary-key">Alternates</span><strong>${formatNumber(state.currentSummary.availableRecipes.length)} recipes</strong></div>`
          : ""}
        <div class="summary-row"><span class="summary-key">Type</span><strong>${state.currentSummary.item.typeID}</strong></div>
        <div class="summary-row"><span class="summary-key">Runtime</span><strong>${formatRuntime(state.currentRollup?.totalRuntime || 0)}</strong></div>
        <div class="summary-row"><span class="summary-key">Mass</span><strong>${formatMass(state.currentRollup?.totalMass || 0)}</strong></div>
        <div class="summary-row"><span class="summary-key">Volume</span><strong>${formatVolume(state.currentRollup?.totalVolume || 0)}</strong></div>
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
      if (!summaryEmpty || !summaryContent) {
        return;
      }

      if (!state.currentSummary) {
        summaryEmpty.hidden = false;
        summaryContent.hidden = true;
        summaryEmpty.textContent = "Select a craftable item to render its recipe summary.";
        return;
      }

      const summary = state.currentSummary;
      summaryEmpty.hidden = true;
      summaryContent.hidden = false;

      summaryTitle.innerHTML = renderItemMarkup(summary.item.name, summary.item.typeID);
      summaryMeta.innerHTML = `
        <span>Requested ${formatNumber(summary.requestedQuantity)}</span>
        <span>${formatNumber(summary.runsNeeded)} run${summary.runsNeeded === 1 ? "" : "s"}</span>
        <span>Produced ${formatNumber(summary.producedQuantity)}</span>
        <span>${formatRuntime(summary.totalRuntime)}</span>
        ${summary.availableRecipes.length > 1 ? `<span>${formatNumber(summary.availableRecipes.length)} recipes</span>` : ""}
      `;

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

      hydrateIcons(summaryContent, state.iconArchive);
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
        showBlueprintIds: state.showBlueprintIds,
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
      if (state.showBlueprintIds) {
        toolbarBits.push("Blueprint ids");
      }
      if (state.showTrackedStatus) {
        toolbarBits.push("Tracked status");
      }
      toolbarBits.push(state.hideCovered ? "Covered hidden" : "All visible");
      toolbarBits.push(state.treeDepth ? `Depth ${state.treeDepth}` : "All depths");
      outlineMeta.textContent = `${rowCount} rows`;
      treePreview.innerHTML = `
        <div class="outline-toolbar">
          <span>${escapeHtml(toolbarBits.join(" · "))}</span>
        </div>
        ${markup}
      `;
      hydrateIcons(treePreview, state.iconArchive);
    }

    function renderProgress() {
      if (!rawMaterialsPreview || !componentsPreview || !rawMaterialsCount || !componentsCount) {
        return;
      }

      if (!state.currentRollup || !state.currentProgressSections) {
        rawMaterialsPreview.innerHTML = `<p>Choose a target to generate the mining list.</p>`;
        componentsPreview.innerHTML = `<p>Choose a target to generate direct component work.</p>`;
        rawMaterialsCount.textContent = "";
        componentsCount.textContent = "";
        return;
      }

      rawMaterialsCount.textContent = `${formatNumber(state.currentProgressSections.baseMaterials.length)} rows`;
      componentsCount.textContent = `${formatNumber(state.currentProgressSections.directComponents.length)} rows`;
      rawMaterialsPreview.innerHTML = renderProgressTableMarkup(
        "Raw Materials to Mine",
        state.currentProgressSections.baseMaterials,
        "mined",
      );
      componentsPreview.innerHTML = renderProgressTableMarkup(
        "Components to Produce",
        state.currentProgressSections.directComponents,
        "produced",
      );

      hydrateIcons(rawMaterialsPreview, state.iconArchive);
      hydrateIcons(componentsPreview, state.iconArchive);
    }

    function renderAll() {
      renderSnapshotMetrics();
      renderActiveTargetCard();
      renderCatalogTree();
      renderSelectedItemCard();
      renderSearchResults();
      renderSummary();
      renderTree();
      renderProgress();
    }

    function setGraph(graph, sourceLabel) {
      state.graph = graph;
      state.catalog = buildCatalogTree(graph);
      state.selectedCatalogBranchKey = "all";
      state.searchQuery = "";
      state.selectedTypeID = null;
      state.requestedQuantity = 1;
      state.recipeSelections = {};
      state.activeRecipeChooserTypeID = null;
      state.expandedNodeIds = new Set();
      state.currentTree = null;
      state.currentRollup = null;
      state.currentSummary = null;
      state.currentProgressSections = null;
      state.currentProgressLookup = new Map();
      state.progressByTypeID = {};
      state.currentPlanKey = null;

      if (searchInput) {
        searchInput.disabled = false;
        searchInput.value = "";
        searchInput.placeholder = "Search item or typeID";
      }
      if (quantityInput) {
        quantityInput.disabled = false;
        quantityInput.value = "1";
      }
      if (dataSection) {
        // Keep the section user-visible while data is available; don't auto-collapse on graph load.
        dataSection.open = true;
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
      const button = event.target.closest("[data-catalog-branch-key]");
      if (!button || !state.graph) {
        return;
      }

      state.selectedCatalogBranchKey = button.dataset.catalogBranchKey || "all";
      updateSearchResults();
      renderCatalogTree();
      renderSearchResults();
    }

    function handleSearchSelection(event) {
      const button = event.target.closest("[data-type-id]");
      if (!button) {
        return;
      }

      state.selectedTypeID = Number(button.dataset.typeId);
      state.recipeSelections = {};
      state.activeRecipeChooserTypeID = null;
      state.requestedQuantity = normalizeQuantity(quantityInput?.value || 1);
      recomputeCalculation(true);
      renderAll();
    }

    function handleQuantityInput(event) {
      state.requestedQuantity = normalizeQuantity(event.target.value);
      event.target.value = String(state.requestedQuantity);
      recomputeCalculation(false);
      renderActiveTargetCard();
      renderSummary();
      renderTree();
      renderProgress();
    }

    function handleRecipeSelection(typeID, recipeID) {
      state.recipeSelections[typeID] = Number(recipeID);
      state.activeRecipeChooserTypeID = null;
      recomputeCalculation(false);
      renderActiveTargetCard();
      renderSummary();
      renderTree();
      renderProgress();
    }

    function handleTreeClick(event) {
      const recipeToggleButton = event.target.closest("[data-outline-recipe-toggle-type-id]");
      if (recipeToggleButton) {
        const typeID = Number(recipeToggleButton.dataset.outlineRecipeToggleTypeId);
        state.activeRecipeChooserTypeID = Number(state.activeRecipeChooserTypeID) === typeID ? null : typeID;
        renderTree();
        return;
      }

      const toggleButton = event.target.closest("[data-toggle-node-id]");
      if (toggleButton) {
        const nodeId = toggleButton.dataset.toggleNodeId;
        if (state.expandedNodeIds.has(nodeId)) {
          state.expandedNodeIds.delete(nodeId);
        } else {
          state.expandedNodeIds.add(nodeId);
        }
        renderTree();
        return;
      }

      const treeAction = event.target.closest("[data-tree-action]");
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

    function handleOutlineRecipeChange(event) {
      const select = event.target.closest("[data-outline-recipe-type-id]");
      if (!select) {
        return;
      }
      handleRecipeSelection(Number(select.dataset.outlineRecipeTypeId), select.value);
    }

    function handleSummaryRecipeChange(event) {
      if (!state.selectedTypeID) {
        return;
      }
      handleRecipeSelection(state.selectedTypeID, event.target.value);
    }

    function handleProgressInput(event) {
      const input = event.target.closest("[data-progress-have-type-id]");
      if (!input || !state.currentPlanKey) {
        return;
      }

      const typeID = Number(input.dataset.progressHaveTypeId);
      state.progressByTypeID[typeID] = normalizeProgressValue(input.value);
      refreshProgressState();
      persistCurrentPlanProgress();
      renderActiveTargetCard();
      renderProgress();
      renderTree();
    }

    function handleProgressToggle(event) {
      const toggle = event.target.closest("[data-progress-complete-type-id]");
      if (!toggle || !state.currentPlanKey) {
        return;
      }

      const typeID = Number(toggle.dataset.progressCompleteTypeId);
      const trackedLine = state.currentProgressLookup.get(typeID);
      state.progressByTypeID[typeID] = toggle.checked ? trackedLine?.need || 0 : 0;
      refreshProgressState();
      persistCurrentPlanProgress();
      renderActiveTargetCard();
      renderProgress();
      renderTree();
    }

    function handleTreeViewChange() {
      state.treeDepth = treeDepthSelect?.value ? Number(treeDepthSelect.value) : null;
      state.hideCovered = Boolean(hideCoveredToggle?.checked);
      state.showRecipeDetails = Boolean(showRecipeDetailsToggle?.checked);
      state.showBlueprintIds = Boolean(showBlueprintIdsToggle?.checked);
      state.showTrackedStatus = Boolean(showTrackedStatusToggle?.checked);
      renderTree();
    }

    graphFileInput?.addEventListener("change", handleGraphFileSelection);
    folderInput?.addEventListener("change", handleFolderSelection);
    iconZipInput?.addEventListener("change", handleIconZipSelection);
    searchInput?.addEventListener("input", handleSearchInput);
    catalogTree?.addEventListener("click", handleCatalogClick);
    searchResults?.addEventListener("click", handleSearchSelection);
    quantityInput?.addEventListener("input", handleQuantityInput);
    summaryRecipeSelect?.addEventListener("change", handleSummaryRecipeChange);
    treePreview?.addEventListener("click", handleTreeClick);
    treePreview?.addEventListener("change", handleOutlineRecipeChange);
    summaryRail?.addEventListener("click", handleTreeClick);
    rawMaterialsPreview?.addEventListener("input", handleProgressInput);
    rawMaterialsPreview?.addEventListener("change", handleProgressToggle);
    componentsPreview?.addEventListener("input", handleProgressInput);
    componentsPreview?.addEventListener("change", handleProgressToggle);
    treeDepthSelect?.addEventListener("change", handleTreeViewChange);
    hideCoveredToggle?.addEventListener("change", handleTreeViewChange);
    showRecipeDetailsToggle?.addEventListener("change", handleTreeViewChange);
    showBlueprintIdsToggle?.addEventListener("change", handleTreeViewChange);
    showTrackedStatusToggle?.addEventListener("change", handleTreeViewChange);

    renderAll();
  }

  const api = {
    buildCatalogTree,
    buildGraphFromStrippedData,
    buildDependencyTree,
    buildPlanStorageKey,
    buildProgressSections,
    buildRecipeOptionLabel,
    createGraphFromFolderFiles,
    createRecipeSummary,
    filterCatalogItems,
    getAvailableRecipesForType,
    getProgressStatus,
    loadStoredPlanProgress,
    renderDependencyOutlineMarkup,
    renderProgressTableMarkup,
    renderSelectedTargetMarkup,
    resolveRecipeChoice,
    rollupDependencyTree,
    saveStoredPlanProgress,
    searchCraftableItems,
    shouldDataSectionBeOpen,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (typeof document !== "undefined") {
    bindBrowserApp();
  }

  globalScope.FrontierIndustryCalculator = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
