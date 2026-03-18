const { normalizePlanLines } = require("./normalize.js");
const { resolveRecipeForType } = require("./recipe_resolution.js");
const { buildDecisionSet, buildDecisionSummary } = require("./decisions.js");

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

function isLeafNode(node) {
  return normalizeNodeChildren(node).length === 0;
}

function isBaseMaterialNode(node) {
  if (typeof node?.isBaseMaterial === "boolean") {
    return node.isBaseMaterial;
  }
  return isLeafNode(node);
}

function incrementMapValue(map, typeId, quantity) {
  map.set(typeId, (map.get(typeId) || 0) + quantity);
}

function sortedQuantityLines(map) {
  return Array.from(map.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([typeId, quantity]) => ({ typeId, quantity }));
}

function ensureOutlineNode(outlineMap, typeId, recipe) {
  if (!outlineMap.has(typeId)) {
    outlineMap.set(typeId, {
      typeId,
      quantity: 0,
      runs: 0,
      selectedRecipe: recipe ?? null,
      usageCount: 0,
      children: new Map(),
    });
    return outlineMap.get(typeId);
  }

  const current = outlineMap.get(typeId);
  if (!current.selectedRecipe && recipe) {
    current.selectedRecipe = recipe;
  }
  return current;
}

function finalizeOutline(outlineMap) {
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

function computePlannerPlan({
  planLines,
  recipeChoiceByType,
  recipeOptionsByType,
  expandDependencies,
}) {
  const normalizedPlanLines = normalizePlanLines(planLines);
  const normalizedChoices = recipeChoiceByType || {};
  const normalizedOptions = recipeOptionsByType || {};
  const resolver = (typeId) => resolveRecipeForType(typeId, normalizedChoices, normalizedOptions);

  const rawMaterialsMap = new Map();
  const componentsMap = new Map();
  const outlineMap = new Map();
  const typeIdsInGraph = new Set();
  const targetTypeIds = new Set(normalizedPlanLines.map((line) => Number(line.typeId)));

  let totalRuntime = 0;
  let totalMass = 0;
  let totalVolume = 0;

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

    const outlineNode = ensureOutlineNode(outlineMap, typeId, recipe);
    outlineNode.quantity += quantity;
    outlineNode.runs += runs;
    outlineNode.usageCount += 1;

    for (const child of children) {
      const childTypeId = normalizeNodeTypeId(child);
      if (childTypeId === null) {
        continue;
      }
      const childQuantity = toNumericValue(child?.quantity);
      incrementMapValue(outlineNode.children, childTypeId, childQuantity);
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
    if (!expanded) {
      continue;
    }
    visitNode(expanded, true);
  }

  const decisions = buildDecisionSet(Array.from(typeIdsInGraph), normalizedOptions, normalizedChoices);
  const decisionSummary = buildDecisionSummary(decisions);

  return {
    rawMaterials: sortedQuantityLines(rawMaterialsMap),
    components: sortedQuantityLines(componentsMap),
    dependencyOutline: finalizeOutline(outlineMap),
    totals: {
      totalRuntime,
      totalMass,
      totalVolume,
    },
    decisions,
    decisionSummary,
  };
}

module.exports = {
  computePlannerPlan,
};
