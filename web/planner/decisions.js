const {
  getDefaultRecipeForType,
  resolveRecipeForType,
} = require("./recipe_resolution.js");

function getSortedNumericTypeIds(typeIdsInPlan) {
  return Array.from(new Set((Array.isArray(typeIdsInPlan) ? typeIdsInPlan : []).map(Number).filter(Number.isFinite))).sort(
    (left, right) => left - right,
  );
}

function getSortedOptions(typeId, recipeOptionsByType = {}) {
  const options = recipeOptionsByType[typeId] ?? recipeOptionsByType[String(typeId)] ?? [];
  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .filter((option) => option && Number.isFinite(Number(option.blueprintId)))
    .slice()
    .sort((left, right) => Number(left.blueprintId) - Number(right.blueprintId));
}

function buildDecisionSet(typeIdsInPlan, recipeOptionsByType = {}, recipeChoiceByType = {}) {
  const decisionSet = [];

  for (const typeId of getSortedNumericTypeIds(typeIdsInPlan)) {
    const options = getSortedOptions(typeId, recipeOptionsByType);
    if (options.length <= 1) {
      continue;
    }

    const defaultRecipe = getDefaultRecipeForType(typeId, recipeOptionsByType);
    const currentRecipe = resolveRecipeForType(typeId, recipeChoiceByType, recipeOptionsByType);

    if (!defaultRecipe || !currentRecipe) {
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

function buildDecisionSummary(decisionSet) {
  const normalized = Array.isArray(decisionSet) ? decisionSet : [];
  const defaultCount = normalized.filter((entry) => entry?.decisionState === "default").length;
  const overriddenCount = normalized.filter((entry) => entry?.decisionState === "overridden").length;

  return {
    totalMultiPathItems: normalized.length,
    defaultCount,
    overriddenCount,
  };
}

module.exports = {
  buildDecisionSet,
  buildDecisionSummary,
};
